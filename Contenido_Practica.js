/* ══════════════════════════════════════════════════════════════════
   CONTENIDO_PRACTICA.JS
   Motor de preguntas de práctica para Contenido.html
   Separado para crecer independientemente del renderizador.
   ═══════════════════════════════════════════════════════════════ */

/* ── Estado global del quiz ───────────────────────────────────── */
let _quizData = null;
let _quizType = 'academico';
let _quizQuestions = [];
let _quizIdx = 0;
let _quizAnswered = {};
let _quizTimer = null;
let _quizTimeLeft = 0;
let _quizTotalSec = 20;
let _dragSrc = null;
let _groupAssignments = {};
let _selectedChip = null;
let _currentSortItems = [];

/* ══════════════════════════════════════════════════════════════════
   GENERADORES DE PREGUNTAS POR TIPO DE CONTENIDO
   ═══════════════════════════════════════════════════════════════ */

/* ── LECCIÓN ROMPECABEZAS ─────────────────────────────────────── */
function genQuestionsLeccion(d) {
  const lec = d.formato_rompecabezas_leccion || {};
  const piezas = lec.piezas_diarias || {};
  const diasNums = Object.keys(piezas).filter(k => k.startsWith('dia_')).sort();
  const dias = diasNums.map((dk, i) => ({ num: i + 1, key: dk, ...piezas[dk] }));
  const qs = [];

  if (dias.length >= 3) {

    // ── Q: Ordenar las 6 piezas de primera a última ──
    const items = dias.map(d2 => d2.pieza).filter(Boolean);
    if (items.length >= 3) {
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      qs.push({
        type: 'sort',
        question: '📅 Ordena las piezas diarias de la primera a la última',
        items: shuffled,
        correct: items,
        explanation: 'El orden correcto refleja la progresión temática de la lección a lo largo de la semana.',
        timeSec: 40,
      });
    }

    // ── Q×3: ¿A qué día corresponde esta PROFUNDIZACIÓN? ──
    const conProf = dias.filter(d2 => d2.profundizacion && d2.pieza);
    if (conProf.length >= 2) {
      // Tomar hasta 3 profundizaciones distintas (sin repetir)
      const shuffledProf = [...conProf].sort(() => Math.random() - 0.5);
      const usedProf = shuffledProf.slice(0, Math.min(3, shuffledProf.length));
      usedProf.forEach(target => {
        const wrongPool = conProf
          .filter(d2 => d2.num !== target.num)
          .map(d2 => `Día ${d2.num}`)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        const opts = [`Día ${target.num}`, ...wrongPool].sort(() => Math.random() - 0.5);
        qs.push({
          type: 'choice',
          question: `🔍 ¿A qué día corresponde esta profundización?\n\n"${target.profundizacion}"`,
          options: opts,
          correct: `Día ${target.num}`,
          explanation: `Esta profundización pertenece al Día ${target.num}: "${target.pieza}".`,
          timeSec: 22,
        });
      });
    }

    // ── Q×3: ¿Cuál es la REFERENCIA BÍBLICA del día X? ──
    const conRef = dias.filter(d2 => d2.referencia_biblica?.libro_capitulo_versiculo && d2.pieza);
    if (conRef.length >= 2) {
      const allRefs = conRef.map(d2 => d2.referencia_biblica.libro_capitulo_versiculo);
      const shuffledRef = [...conRef].sort(() => Math.random() - 0.5);
      const usedRef = shuffledRef.slice(0, Math.min(3, shuffledRef.length));
      usedRef.forEach(target => {
        const wrongRefs = allRefs
          .filter(r => r !== target.referencia_biblica.libro_capitulo_versiculo)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        const opts = [target.referencia_biblica.libro_capitulo_versiculo, ...wrongRefs]
          .sort(() => Math.random() - 0.5);
        qs.push({
          type: 'choice',
          question: `📖 ¿Cuál es la referencia bíblica del Día ${target.num}?\n"${target.pieza}"`,
          options: opts,
          correct: target.referencia_biblica.libro_capitulo_versiculo,
          explanation: `El Día ${target.num} — "${target.pieza}" — cita ${target.referencia_biblica.libro_capitulo_versiculo}${target.referencia_biblica.parte_que_aporta ? ': ' + target.referencia_biblica.parte_que_aporta : ''}.`,
          timeSec: 22,
        });
      });
    }

    // ── Q: ¿Qué PIEZA corresponde al día X? ──
    if (dias.length >= 4) {
      const target2 = dias[Math.floor(Math.random() * dias.length)];
      const wrongOpts = dias
        .filter(d2 => d2.num !== target2.num && d2.pieza)
        .map(d2 => d2.pieza)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const opts2 = [target2.pieza, ...wrongOpts].sort(() => Math.random() - 0.5);
      qs.push({
        type: 'choice',
        question: `🧩 ¿Cuál es la pieza del Día ${target2.num}?`,
        options: opts2,
        correct: target2.pieza,
        explanation: `El Día ${target2.num} corresponde a: "${target2.pieza}".`,
        timeSec: 20,
      });
    }

    // ── Q: AGRUPAR días según conjuntos analíticos ──
    const analisis = lec.Analisis || {};
    const conjuntos = analisis.conjuntos || [];
    if (conjuntos.length >= 2) {
      const usedDias = {};
      const buckets = [];
      conjuntos.forEach(c => {
        if (c.dias && c.dias.length) {
          buckets.push({ label: c.nombre, dias: c.dias });
          c.dias.forEach(d3 => { usedDias[d3] = c.nombre; });
        }
      });
      const allDias = Object.keys(usedDias);
      if (allDias.length >= 4 && buckets.length >= 2) {
        qs.push({
          type: 'group',
          question: '🗂️ Agrupa los días según el conjunto analítico al que pertenecen',
          chips: allDias.sort(() => Math.random() - 0.5),
          buckets: buckets.map(b => ({ label: b.label, chips: [], correct: b.dias })),
          correctMap: usedDias,
          explanation: 'Los días se agrupan según los patrones y elementos comunes identificados en el análisis comparativo.',
          timeSec: 45,
        });
      }
    }
  }

  // Fallback si no hay días suficientes
  const preg = lec.pregunta_inicial || {};
  if (hasVal(preg.texto) && qs.length === 0) {
    qs.push({
      type: 'choice',
      question: '¿Cuál es la pregunta central que guía esta lección?',
      options: shuffleWith(preg.texto, ['No hay pregunta definida', 'Es una declaración, no pregunta', 'Es el cierre de la lección']),
      correct: preg.texto,
      explanation: 'La pregunta inicial es el hilo conductor de toda la lección rompecabezas.',
      timeSec: 20,
    });
  }

  return qs;
}

/* ── MATUTINA ─────────────────────────────────────────────────── */
function genQuestionsMatutina(d) {
  const qs = [];

  const v = d.versiculo || {};
  if (hasVal(v.referencia) && hasVal(v.texto)) {
    qs.push({
      type: 'choice',
      question: `📖 ¿A qué pasaje bíblico corresponde este texto?\n\n"${v.texto.length > 120 ? v.texto.slice(0, 120) + '…' : v.texto}"`,
      options: shuffleWith(v.referencia, ['Génesis 1:1', 'Salmos 23:1', 'Juan 3:16', 'Romanos 8:28']),
      correct: v.referencia,
      explanation: `Este texto pertenece a ${v.referencia}.`,
      timeSec: 20,
    });
  }

  if (hasVal(d.problema_planteado)) {
    qs.push({
      type: 'choice',
      question: '⚠️ ¿Cuál es el problema planteado en esta matutina?',
      options: shuffleWith(d.problema_planteado, ['No se menciona ningún problema', 'Es una celebración, sin problema', 'El problema es implícito']),
      correct: d.problema_planteado,
      explanation: `El problema planteado es: "${d.problema_planteado}".`,
      timeSec: 25,
    });
  }

  const inv = (d.invitaciones || []).filter(i => (typeof i === 'string' ? i : i.accion));
  if (inv.length >= 3) {
    const texts = inv.map(i => typeof i === 'string' ? i : i.accion).slice(0, 5);
    const shuffled = [...texts].sort(() => Math.random() - 0.5);
    qs.push({
      type: 'sort',
      question: '🙌 Ordena las invitaciones en el orden en que aparecen',
      items: shuffled,
      correct: texts,
      explanation: 'El orden refleja la secuencia original de las invitaciones de la matutina.',
      timeSec: 35,
    });
  }

  const virt = d.virtudes_promovidas || [];
  const cond = d.conductas_a_evitar || [];
  if (virt.length >= 2 && cond.length >= 2) {
    const allItems = [
      ...virt.slice(0, 3).map(x => ({ label: x, bucket: 'Virtudes promovidas' })),
      ...cond.slice(0, 3).map(x => ({ label: x, bucket: 'Conductas a evitar' })),
    ];
    const correctMap = {};
    allItems.forEach(it => { correctMap[it.label] = it.bucket; });
    qs.push({
      type: 'group',
      question: '⚖️ Clasifica cada elemento: ¿es una virtud promovida o una conducta a evitar?',
      chips: allItems.map(i => i.label).sort(() => Math.random() - 0.5),
      buckets: [
        { label: 'Virtudes promovidas', chips: [], correct: virt.slice(0, 3) },
        { label: 'Conductas a evitar',  chips: [], correct: cond.slice(0, 3) },
      ],
      correctMap,
      explanation: `Virtudes: ${virt.slice(0, 3).join(', ')}. Conductas a evitar: ${cond.slice(0, 3).join(', ')}.`,
      timeSec: 40,
    });
  }

  if (hasVal(d.leccion_central)) {
    qs.push({
      type: 'choice',
      question: '✦ ¿Cuál es la lección central de esta matutina?',
      options: shuffleWith(d.leccion_central, ['No hay lección central definida', 'Es solo una reflexión devocional', 'La lección es el versículo']),
      correct: d.leccion_central,
      explanation: `La lección central es: "${d.leccion_central}".`,
      timeSec: 25,
    });
  }

  return qs;
}

/* ── ENSEÑANZAS ───────────────────────────────────────────────── */
function genQuestionsEnsenanzas(d) {
  const qs = [];
  const ensenanzas = d.ensenanzas || [];
  const tipos = [...new Set(ensenanzas.map(e => e.tipo).filter(Boolean))];

  if (tipos.length >= 2 && ensenanzas.length >= 4) {
    const sample = ensenanzas.filter(e => e.tipo && e.enunciado).slice(0, 8);
    const correctMap = {};
    const buckets = tipos.slice(0, 4).map(t => ({
      label: t.charAt(0).toUpperCase() + t.slice(1),
      chips: [],
      correct: sample.filter(e => e.tipo === t).map(e => e.enunciado),
    }));
    // Build correctMap AFTER buckets so label matches exactly
    sample.forEach(e => {
      const bucket = buckets.find(b => b.correct.includes(e.enunciado));
      if (bucket) correctMap[e.enunciado] = bucket.label;
    });
    qs.push({
      type: 'group',
      question: '🕊️ Clasifica cada enseñanza según su tipo',
      chips: sample.map(e => e.enunciado).sort(() => Math.random() - 0.5),
      buckets,
      correctMap,
      explanation: 'Cada enseñanza corresponde a una categoría específica según su naturaleza.',
      timeSec: 45,
    });
  }

  const conCita = ensenanzas.filter(e => e.cita_textual && e.enunciado);
  if (conCita.length >= 2) {
    const t = conCita[Math.floor(Math.random() * conCita.length)];
    const wrong = conCita.filter(e => e.enunciado !== t.enunciado).map(e => e.enunciado);
    const opts = [t.enunciado, ...wrong.slice(0, 3)].sort(() => Math.random() - 0.5);
    qs.push({
      type: 'choice',
      question: `📖 Esta cita pertenece a una enseñanza. ¿Cuál es su enunciado principal?\n\n"${t.cita_textual.slice(0, 140)}…"`,
      options: opts,
      correct: t.enunciado,
      explanation: `La enseñanza correspondiente es: "${t.enunciado}".`,
      timeSec: 25,
    });
  }

  const conCond = ensenanzas.filter(e => e.condicion?.tiene_condicion && e.enunciado).slice(0, 4);
  if (conCond.length >= 3) {
    const shuffled = conCond.map(e => e.enunciado).sort(() => Math.random() - 0.5);
    qs.push({
      type: 'sort',
      question: '🔄 Ordena estas enseñanzas condicionales en el orden en que aparecen',
      items: shuffled,
      correct: conCond.map(e => e.enunciado),
      explanation: 'El orden refleja la secuencia en que aparecen las enseñanzas en el texto original.',
      timeSec: 35,
    });
  }

  return qs;
}

/* ── ACADÉMICO / GENÉRICO ─────────────────────────────────────── */
function genQuestionsAcademico(d) {
  const qs = [];
  const m = d.metadatos || {};

  if (hasVal(m.titulo)) {
    qs.push({
      type: 'choice',
      question: '📋 ¿Cuál es el título de este documento?',
      options: shuffleWith(m.titulo, ['Sin título definido', 'Es un documento anónimo', 'El título no está disponible']),
      correct: m.titulo,
      explanation: `El título del documento es "${m.titulo}".`,
      timeSec: 20,
    });
  }

  const prob = d.definicion_del_problema || {};
  if (hasVal(prob.pregunta_central)) {
    qs.push({
      type: 'choice',
      question: '❓ ¿Cuál es la pregunta central que aborda este documento?',
      options: shuffleWith(prob.pregunta_central, ['No define pregunta central', 'La pregunta es implícita', 'No es un documento académico']),
      correct: prob.pregunta_central,
      explanation: `La pregunta central es: "${prob.pregunta_central}".`,
      timeSec: 25,
    });
  }

  const et = d.estructura_tesis || {};
  const tesis = (et.tesis || {}).afirmaciones || [];
  const anti  = (et.antitesis || {}).posiciones_opuestas || [];
  if (tesis.length && anti.length) {
    const allItems = [
      ...tesis.slice(0, 3).map(x => ({ label: x, bucket: 'Tesis' })),
      ...anti.slice(0, 3).map(x =>  ({ label: x, bucket: 'Antítesis' })),
    ];
    const correctMap = {};
    allItems.forEach(it => { correctMap[it.label] = it.bucket; });
    qs.push({
      type: 'group',
      question: '⚖️ Clasifica cada afirmación: ¿pertenece a la Tesis o a la Antítesis?',
      chips: allItems.map(i => i.label).sort(() => Math.random() - 0.5),
      buckets: [
        { label: 'Tesis',     chips: [], correct: tesis.slice(0, 3) },
        { label: 'Antítesis', chips: [], correct: anti.slice(0, 3) },
      ],
      correctMap,
      explanation: 'La tesis defiende la posición principal; la antítesis recoge las posiciones opuestas.',
      timeSec: 40,
    });
  }

  return qs;
}

/* ── DISPATCHER ───────────────────────────────────────────────── */
function genQuestions(data, tipo) {
  const generators = {
    leccion:             genQuestionsLeccion,
    matutina:            genQuestionsMatutina,
    ensenanzas:          genQuestionsEnsenanzas,
    academico:           genQuestionsAcademico,
    narrativa_historica: genQuestionsAcademico,
    procedimental:       genQuestionsAcademico,
    prescriptivo:        genQuestionsAcademico,
  };
  const fn = generators[tipo] || genQuestionsAcademico;
  return fn(data).filter(Boolean);
}

function shuffleWith(correct, wrongs) {
  const pool = wrongs.filter(w => w !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
  return [correct, ...pool].sort(() => Math.random() - 0.5);
}

/* ══════════════════════════════════════════════════════════════════
   QUIZ UI — apertura / cierre
   ═══════════════════════════════════════════════════════════════ */
function openQuiz() {
  if (!_quizData) return;
  document.getElementById('quizOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  _quizQuestions = genQuestions(_quizData, _quizType);
  _quizIdx = 0;
  _quizAnswered = {};
  _groupAssignments = {};

  if (_quizQuestions.length === 0) {
    document.getElementById('qmBody').innerHTML = `
      <div style="text-align:center;color:rgba(255,255,255,0.4);padding:2rem 0;">
        <div style="font-size:2rem;margin-bottom:0.5rem;">🤔</div>
        <div>No se encontraron suficientes datos para generar preguntas.</div>
        <div style="margin-top:0.5rem;font-size:0.8rem;">Asegúrate de que el JSON tenga contenido rico.</div>
      </div>`;
    return;
  }

  renderQuizQuestion();
}

function closeQuiz() {
  document.getElementById('quizOverlay').classList.remove('open');
  document.body.style.overflow = '';
  clearInterval(_quizTimer);
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('quizOverlay')) closeQuiz();
}

/* ══════════════════════════════════════════════════════════════════
   QUIZ UI — renderizado de pregunta
   ═══════════════════════════════════════════════════════════════ */
function renderQuizQuestion() {
  clearInterval(_quizTimer);
  const q = _quizQuestions[_quizIdx];
  const total = _quizQuestions.length;

  const typeIcons = { leccion:'🧩', matutina:'🌅', ensenanzas:'🕊️', academico:'🎓', narrativa_historica:'📜', procedimental:'⚙️', prescriptivo:'⚖️' };
  document.getElementById('qmIcon').textContent  = typeIcons[_quizType] || '🧠';
  document.getElementById('qmTitle').textContent = 'Preguntas de práctica';
  document.getElementById('qmSub').textContent   = `${_quizIdx + 1} de ${total} preguntas`;

  // Dots
  let dots = '<div class="qm-progress">';
  for (let i = 0; i < total; i++) {
    let cls = 'qm-pdot';
    if (i === _quizIdx) cls += ' cur';
    else if (_quizAnswered[i]?.correct === true)  cls += ' ok';
    else if (_quizAnswered[i]?.correct === false) cls += ' fail';
    dots += `<div class="${cls}"></div>`;
  }
  dots += '</div>';

  // Timer
  _quizTotalSec = q.timeSec || 25;
  _quizTimeLeft = _quizTotalSec;
  const timerHTML = `<div class="qm-timer"><div class="qm-timer-bar" id="qmTimerBar" style="width:100%"></div></div>`;

  const qText = q.question.replace(/\n/g, '<br>');
  let interactionHTML = '';

  if (q.type === 'choice') {
    const letters = ['A', 'B', 'C', 'D'];
    interactionHTML = '<div class="qm-options" id="qmOpts">';
    q.options.forEach((opt, i) => {
      interactionHTML += `<button class="qm-opt" onclick="answerChoice(${i})" id="qmOpt${i}">
        <span class="qm-opt-key">${letters[i]}</span>${opt}
      </button>`;
    });
    interactionHTML += '</div>';

  } else if (q.type === 'sort') {
    _currentSortItems = [...q.items];
    interactionHTML = `<div class="qm-sort-list" id="qmSortList">`;
    q.items.forEach((item, i) => {
      interactionHTML += `<div class="qm-sort-item" draggable="true" data-idx="${i}" id="qmSort${i}"
        ondragstart="sortDragStart(event,${i})"
        ondragover="sortDragOver(event,${i})"
        ondrop="sortDrop(event,${i})"
        ondragend="sortDragEnd(event)"
        ontouchstart="sortTouchStart(event,${i})">
        <span class="qm-sort-handle">⠿</span><span class="qm-sort-text">${item}</span>
      </div>`;
    });
    interactionHTML += `</div>`;

  } else if (q.type === 'group') {
    _groupAssignments = {};
    _groupCurrentIdx = 0;
    _groupScore = { correct: 0, total: 0 };
    interactionHTML = `<div id="qmGcardWrapper">${buildGroupCard(q)}</div>`;
  }

  document.getElementById('qmBody').innerHTML = `
    ${dots}
    ${timerHTML}
    <div class="qm-question-num">Pregunta ${_quizIdx + 1}</div>
    <div class="qm-question-text">${qText}</div>
    ${interactionHTML}
    <div class="qm-feedback" id="qmFeedback"></div>
    <div class="qm-actions" id="qmActions"></div>
  `;

  // Show verify button for sort/group
  if (q.type === 'sort' || q.type === 'group') showNextActions();

  startTimer();
}

/* ══════════════════════════════════════════════════════════════════
   TIMER
   ═══════════════════════════════════════════════════════════════ */
function startTimer() {
  clearInterval(_quizTimer);
  _quizTimer = setInterval(() => {
    _quizTimeLeft -= 0.5;
    const pct = Math.max(0, (_quizTimeLeft / _quizTotalSec) * 100);
    const b = document.getElementById('qmTimerBar');
    if (b) {
      b.style.width = pct + '%';
      if (pct < 25) b.classList.add('warn');
    }
    if (_quizTimeLeft <= 0) {
      clearInterval(_quizTimer);
      if (_quizAnswered[_quizIdx] === undefined) {
        const q = _quizQuestions[_quizIdx];
        if (q.type === 'choice')  showChoiceFeedback(-1, q);
        else if (q.type === 'sort')  evalSort(true);
        else if (q.type === 'group') { if (_groupCurrentIdx < q.chips.length) evalGroup(true); }
      }
    }
  }, 500);
}

/* ══════════════════════════════════════════════════════════════════
   INTERACCIÓN — CHOICE
   ═══════════════════════════════════════════════════════════════ */
function answerChoice(idx) {
  if (_quizAnswered[_quizIdx] !== undefined) return;
  clearInterval(_quizTimer);
  showChoiceFeedback(idx, _quizQuestions[_quizIdx]);
}

function showChoiceFeedback(selectedIdx, q) {
  const isTimeout = selectedIdx === -1;
  const selected = isTimeout ? null : q.options[selectedIdx];
  const correct = !isTimeout && selected === q.correct;
  _quizAnswered[_quizIdx] = { correct };

  q.options.forEach((opt, i) => {
    const btn = document.getElementById('qmOpt' + i);
    if (!btn) return;
    btn.disabled = true;
    if (opt === q.correct)    btn.classList.add('correct');
    else if (i === selectedIdx) btn.classList.add('incorrect');
  });

  showFeedback(correct, q.explanation, isTimeout ? '⏱ Tiempo agotado. ' : '');
  showNextActions();
}

/* ══════════════════════════════════════════════════════════════════
   INTERACCIÓN — SORT (drag & drop)
   ═══════════════════════════════════════════════════════════════ */
function sortDragStart(e, idx) {
  _dragSrc = idx;
  e.dataTransfer.effectAllowed = 'move';
}
function sortDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function sortDrop(e, idx) {
  e.preventDefault();
  if (_dragSrc === null || _dragSrc === idx) return;
  // Swap in array
  const tmp = _currentSortItems[_dragSrc];
  _currentSortItems[_dragSrc] = _currentSortItems[idx];
  _currentSortItems[idx] = tmp;
  // Update DOM text
  _currentSortItems.forEach((item, i) => {
    const el = document.getElementById('qmSort' + i);
    if (el) el.querySelector('.qm-sort-text').textContent = item;
  });
  _dragSrc = null;
}
function sortDragEnd() {
  document.querySelectorAll('.qm-sort-item').forEach(el => el.classList.remove('drag-over','dragging'));
  _dragSrc = null;
}

/* ── Touch-based sort (Android Cordova) ── */
let _touchSortSrc = null;
let _touchSortOver = null;

function sortTouchStart(e, idx) {
  if (_quizAnswered[_quizIdx] !== undefined) return;
  _touchSortSrc = idx;
  _touchSortOver = null;
  const el = document.getElementById('qmSort' + idx);
  if (el) el.classList.add('dragging');
  // Register global listeners so tracking works even when finger slides off the element
  document.addEventListener('touchmove', _sortGlobalMove, { passive: false });
  document.addEventListener('touchend',  _sortGlobalEnd,  { passive: false });
}

function _sortGlobalMove(e) {
  if (_touchSortSrc === null) return;
  e.preventDefault();
  const touch = e.touches[0];
  // elementFromPoint may return a child span — walk up to .qm-sort-item
  let target = document.elementFromPoint(touch.clientX, touch.clientY);
  while (target && !target.classList.contains('qm-sort-item')) {
    target = target.parentElement;
  }
  document.querySelectorAll('.qm-sort-item').forEach(el => el.classList.remove('drag-over'));
  if (target && target.id !== 'qmSort' + _touchSortSrc) {
    target.classList.add('drag-over');
    // Parse index from id (e.g. "qmSort2" -> 2); reliable because ids never change
    _touchSortOver = parseInt(target.id.replace('qmSort', ''), 10);
  } else {
    _touchSortOver = null;
  }
}

function _sortGlobalEnd(e) {
  document.removeEventListener('touchmove', _sortGlobalMove);
  document.removeEventListener('touchend',  _sortGlobalEnd);
  document.querySelectorAll('.qm-sort-item').forEach(el => el.classList.remove('drag-over', 'dragging'));

  if (_touchSortOver !== null && _touchSortOver !== _touchSortSrc) {
    const tmp = _currentSortItems[_touchSortSrc];
    _currentSortItems[_touchSortSrc] = _currentSortItems[_touchSortOver];
    _currentSortItems[_touchSortOver] = tmp;
    // Update DOM text only — ids stay fixed so subsequent moves still work
    _currentSortItems.forEach((item, i) => {
      const el = document.getElementById('qmSort' + i);
      if (el) el.querySelector('.qm-sort-text').textContent = item;
    });
  }

  _touchSortSrc = null;
  _touchSortOver = null;
}

// Stubs — real logic is handled by global listeners registered in sortTouchStart
function sortTouchEnd() {}
function sortTouchMove() {}

function evalSort(timeout) {
  if (_quizAnswered[_quizIdx] !== undefined && !timeout) return;
  clearInterval(_quizTimer);
  const q = _quizQuestions[_quizIdx];
  const correct = JSON.stringify(_currentSortItems) === JSON.stringify(q.correct);
  _quizAnswered[_quizIdx] = { correct: correct && !timeout };

  _currentSortItems.forEach((item, i) => {
    const el = document.getElementById('qmSort' + i);
    if (el) el.classList.add(item === q.correct[i] ? 'correct-pos' : 'wrong-pos');
  });

  showFeedback(correct && !timeout, q.explanation, timeout ? '⏱ Tiempo agotado. ' : '');
  showNextActions();
}

/* ══════════════════════════════════════════════════════════════════
   INTERACCIÓN — GROUP (tarjetas secuenciales, una por una)
   Cada ítem se muestra solo con botones por categoría.
   Sin drag, sin selección de dos pasos — puro onclick en <button>.
   ═══════════════════════════════════════════════════════════════ */
let _groupCurrentIdx = 0;
let _groupScore = { correct: 0, total: 0 };

function buildGroupCard(q) {
  const chip = q.chips[_groupCurrentIdx];
  const progress = `${_groupCurrentIdx + 1} / ${q.chips.length}`;
  const bucketBtns = q.buckets.map((b, bi) =>
    `<button class="qm-gcard-btn" onclick="groupAnswer(${bi})">${b.label}</button>`
  ).join('');
  return `<div class="qm-gcard" id="qmGcard">
    <div class="qm-gcard-progress">${progress}</div>
    <div class="qm-gcard-item">${chip}</div>
    <div class="qm-gcard-hint">¿A qué categoría pertenece?</div>
    <div class="qm-gcard-btns">${bucketBtns}</div>
    <div class="qm-gcard-feedback" id="qmGcardFb"></div>
  </div>`;
}

function groupAnswer(bi) {
  if (_quizAnswered[_quizIdx] !== undefined) return;
  const q = _quizQuestions[_quizIdx];
  const chip = q.chips[_groupCurrentIdx];
  const chosen = q.buckets[bi].label;
  const isCorrect = q.correctMap[chip] === chosen;

  _groupScore.total++;
  if (isCorrect) _groupScore.correct++;

  // Disable all buttons and show result on this card
  const btns = document.querySelectorAll('.qm-gcard-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === bi) btn.classList.add(isCorrect ? 'gcard-correct' : 'gcard-wrong');
    if (!isCorrect && q.buckets[i].label === q.correctMap[chip]) btn.classList.add('gcard-correct');
  });

  const fb = document.getElementById('qmGcardFb');
  if (fb) {
    fb.textContent = isCorrect ? '✓ Correcto' : `✗ Era: ${q.correctMap[chip]}`;
    fb.className = 'qm-gcard-feedback ' + (isCorrect ? 'fb-ok' : 'fb-no');
  }

  // After short pause move to next card or finish
  setTimeout(() => {
    _groupCurrentIdx++;
    if (_groupCurrentIdx < q.chips.length) {
      const wrapper = document.getElementById('qmGcardWrapper');
      if (wrapper) wrapper.innerHTML = buildGroupCard(q);
    } else {
      evalGroup(false);
    }
  }, 900);
}

function evalGroup(timeout) {
  if (_quizAnswered[_quizIdx] !== undefined && !timeout) return;
  clearInterval(_quizTimer);
  const q = _quizQuestions[_quizIdx];
  const allCorrect = !timeout && (_groupScore.correct === q.chips.length);
  _quizAnswered[_quizIdx] = { correct: allCorrect };

  const wrapper = document.getElementById('qmGcardWrapper');
  if (wrapper) {
    wrapper.innerHTML = `<div class="qm-gcard-result">
      ${timeout ? '<div class="qm-gcard-timeout">⏱ Tiempo agotado</div>' : ''}
      <div class="qm-gcard-score">${_groupScore.correct} / ${q.chips.length} correctas</div>
    </div>`;
  }

  showFeedback(allCorrect, q.explanation, timeout ? '⏱ Tiempo agotado. ' : '');
  showNextActions();
}

/* ══════════════════════════════════════════════════════════════════
   FEEDBACK & NAVEGACIÓN
   ═══════════════════════════════════════════════════════════════ */
function showFeedback(correct, explanation, prefix) {
  const fb = document.getElementById('qmFeedback');
  if (!fb) return;
  fb.className = 'qm-feedback show ' + (correct ? 'correct' : 'incorrect');
  fb.innerHTML = `<div class="qm-fb-label">${correct ? '✓ Correcto' : '✗ Incorrecto'}</div>${prefix}${explanation}`;
}

function showNextActions() {
  const acts = document.getElementById('qmActions');
  if (!acts) return;
  const isLast = _quizIdx >= _quizQuestions.length - 1;
  const q = _quizQuestions[_quizIdx];
  const answered = _quizAnswered[_quizIdx] !== undefined;
  let html = '';

  // Verify button for sort (group is auto-evaluated card by card)
  if (!answered) {
    if (q.type === 'sort') {
      html = `<button class="qm-btn qm-btn-primary" onclick="evalSort(false)">✓ Verificar orden</button>`;
    }
    html += `<button class="qm-btn qm-btn-ghost" onclick="closeQuiz()">Salir</button>`;
  } else {
    // Navigation after answer
    if (!isLast) {
      html = `<button class="qm-btn qm-btn-primary" onclick="nextQuestion()">Siguiente →</button>`;
    } else {
      html = `<button class="qm-btn qm-btn-primary" onclick="showQuizResult()">Ver resultado 🏆</button>`;
    }
    html += `<button class="qm-btn qm-btn-ghost" onclick="closeQuiz()">Cerrar</button>`;
  }

  acts.innerHTML = html;
}

function nextQuestion() {
  _quizIdx++;
  renderQuizQuestion();
}

/* ══════════════════════════════════════════════════════════════════
   RESULTADO FINAL
   ═══════════════════════════════════════════════════════════════ */
function showQuizResult() {
  clearInterval(_quizTimer);
  const total = _quizQuestions.length;
  const correct = Object.values(_quizAnswered).filter(a => a.correct).length;
  const pct = Math.round((correct / total) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚';
  const msg = pct >= 80 ? '¡Excelente dominio!' : pct >= 60 ? 'Buen esfuerzo, sigue repasando.' : 'Sigue estudiando, ¡vas a lograrlo!';
  const scoreClass = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low';

  document.getElementById('qmBody').innerHTML = `
    <div class="qm-result">
      <div class="qm-result-emoji">${emoji}</div>
      <div class="qm-result-score ${scoreClass}">${pct}%</div>
      <div class="qm-result-msg">${msg}</div>
      <div class="qm-result-stats">
        <div class="qm-rs"><div class="num" style="color:#22c55e">${correct}</div><div class="lbl">Correctas</div></div>
        <div class="qm-rs"><div class="num" style="color:#ef4444">${total - correct}</div><div class="lbl">Incorrectas</div></div>
        <div class="qm-rs"><div class="num">${total}</div><div class="lbl">Total</div></div>
      </div>
      <div class="qm-actions" style="justify-content:center;">
        <button class="qm-btn qm-btn-primary" onclick="openQuiz()">🔄 Repetir</button>
        <button class="qm-btn qm-btn-ghost" onclick="closeQuiz()">Cerrar</button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════════
   ARRANQUE — llama al init de Contenido.html una vez que este
   script cargó y todas las variables del motor existen.
   ═══════════════════════════════════════════════════════════════ */
initContenido();