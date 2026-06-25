// _share.js — Exportar/Importar nativo (Android/Cordova)
// - Exporta compartiendo el JSON por el "share sheet" del sistema (WhatsApp, Drive, etc.)
// - Recibe JSON abiertos/compartidos desde otras apps (ej. WhatsApp) vía cordova-plugin-openwith
//
// Requiere (solo en build Android real, en navegador funciona igual que antes vía descarga/archivo):
//   cordova plugin add cordova-plugin-file
//   cordova plugin add cordova-plugin-x-socialsharing
//   cordova plugin add cc.fovea.cordova.openwith \
//     --variable ANDROID_MIME_TYPE="application/json" \
//     --variable ANDROID_EXTRA_ACTIONS='<action android:name="android.intent.action.VIEW" />'
//
// Todo aquí es "best effort": si un plugin no está instalado o no estamos en Cordova,
// se cae automáticamente al comportamiento anterior (descarga de archivo / selector manual).

(function () {
  var STUDY = window.STUDY || {};
  var PENDING_KEY = 'study_pending_import';

  STUDY.isCordova = function () {
    return !!window.cordova;
  };

  // ── Descarga clásica (navegador / fallback) ───────────────────────
  STUDY.downloadFallback = function (data, filename) {
    try {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.warn('downloadFallback error', e);
    }
  };

  // ── Escribir un archivo temporal en caché (requiere cordova-plugin-file) ──
  function writeCacheFile(filename, text, onOk, onErr) {
    if (!(window.resolveLocalFileSystemURL && window.cordova && cordova.file)) {
      return onErr && onErr('cordova-plugin-file no disponible');
    }
    window.resolveLocalFileSystemURL(cordova.file.cacheDirectory, function (dir) {
      dir.getFile(filename, { create: true, exclusive: false }, function (fileEntry) {
        fileEntry.createWriter(function (writer) {
          writer.onwriteend = function () { onOk(fileEntry); };
          writer.onerror = onErr;
          var blob = new Blob([text], { type: 'application/json' });
          writer.write(blob);
        }, onErr);
      }, onErr);
    }, onErr);
  }

  // ── Exportar compartiendo por el share sheet nativo (incluye WhatsApp) ──
  // payload: objeto a exportar. filename: nombre sugerido del archivo .json
  STUDY.shareFile = function (payload, filename, opts) {
    opts = opts || {};
    var text = JSON.stringify(payload, null, 2);

    var canNativeShare = STUDY.isCordova() && window.plugins && window.plugins.socialsharing;
    if (!canNativeShare) {
      STUDY.downloadFallback(payload, filename);
      if (opts.onFallback) opts.onFallback();
      return;
    }

    writeCacheFile(filename, text, function (fileEntry) {
      var uri = fileEntry.nativeURL || fileEntry.toURL();
      var onOk = function () { if (opts.onSuccess) opts.onSuccess(); };
      var onErr = function (err) {
        console.warn('share error, usando descarga', err);
        STUDY.downloadFallback(payload, filename);
        if (opts.onFallback) opts.onFallback();
      };
      if (typeof window.plugins.socialsharing.shareWithOptions === 'function') {
        window.plugins.socialsharing.shareWithOptions({
          subject: opts.subject || filename,
          files: [uri],
          chooserTitle: opts.chooserTitle || 'Compartir JSON'
        }, onOk, onErr);
      } else {
        window.plugins.socialsharing.share(null, opts.subject || filename, uri, null, onOk, onErr);
      }
    }, function (err) {
      console.warn('No se pudo escribir el archivo temporal, usando descarga', err);
      STUDY.downloadFallback(payload, filename);
      if (opts.onFallback) opts.onFallback();
    });
  };

  // ── Recepción: helper base64 → texto UTF-8 (soporta tildes/ñ) ─────
  function base64ToUtf8(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (window.TextDecoder) return new TextDecoder('utf-8').decode(bytes);
    var escaped = '';
    for (var j = 0; j < binary.length; j++) {
      escaped += '%' + ('00' + binary.charCodeAt(j).toString(16)).slice(-2);
    }
    return decodeURIComponent(escaped);
  }

  function looksLikeJsonItem(item) {
    if (!item) return false;
    var type = (item.type || '').toLowerCase();
    var uri = (item.uri || '').toLowerCase();
    var name = (item.name || '').toLowerCase();
    var path = (item.path || '').toLowerCase();
    return type.indexOf('json') !== -1 ||
      /\.json($|[?#])/.test(uri) ||
      /\.json($|[?#])/.test(name) ||
      /\.json($|[?#])/.test(path);
  }

  // Deja el payload listo para que index.html lo procese (mismo origen,
  // funciona sin importar en qué pantalla estaba abierta la app).
  function deliverIncomingPayload(obj) {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(obj)); } catch (e) { /* noop */ }
    var onIndex = /(^|\/)index\.html(\?|#|$)/.test(location.pathname) || location.pathname === '/' || location.pathname === '';
    if (onIndex) {
      window.dispatchEvent(new CustomEvent('study:incoming-import'));
    } else if (typeof window.navTo === 'function') {
      window.navTo('index.html');
    } else {
      location.href = 'index.html';
    }
  }

  STUDY.consumePendingImport = function () {
    var raw = null;
    try { raw = sessionStorage.getItem(PENDING_KEY); } catch (e) { /* noop */ }
    if (!raw) return null;
    try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* noop */ }
    try { return JSON.parse(raw); } catch (e) { return { type: 'invalid_json' }; }
  };

  // ── Receptor "Open With" (abrir/compartir un .json desde WhatsApp) ──
  function setupOpenWithReceiver() {
    if (!(window.cordova && cordova.openwith)) return;
    cordova.openwith.init(function () {}, function (err) {
      console.warn('openwith init error', err);
    });
    cordova.openwith.addHandler(function (intent) {
      var items = intent.items || [];
      var handledOne = false;
      var candidate = null;
      items.forEach(function (item) {
        if (!candidate) candidate = item;
        if (handledOne || !looksLikeJsonItem(item)) return;
        handledOne = true;
        loadIncomingItem(item);
      });
      if (!handledOne && candidate) loadIncomingItem(candidate);
      if (intent.exit) { try { cordova.openwith.exit(); } catch (e) { /* noop */ } }
    });
  }

  function loadIncomingItem(item) {
    cordova.openwith.load(item, function (base64) {
      var obj;
      try {
        obj = JSON.parse(base64ToUtf8(base64));
      } catch (e) {
        obj = { type: 'invalid_json' };
      }
      deliverIncomingPayload(obj);
    }, function (err) {
      console.warn('openwith load error', err);
      deliverIncomingPayload({ type: 'invalid_json' });
    });
  }

  document.addEventListener('deviceready', setupOpenWithReceiver, false);

  window.STUDY = STUDY;
})();
