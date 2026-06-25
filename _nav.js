// Cordova/Browser navigation helper
// Replaces history.back() with a stack-based navigator
(function(){
  // Build history stack from sessionStorage
  window.__navStack = JSON.parse(sessionStorage.getItem('__navStack') || '[]');

  window.navBack = function() {
    var stack = window.__navStack;
    if (stack.length > 1) {
      stack.pop(); // remove current
      var prev = stack[stack.length - 1];
      sessionStorage.setItem('__navStack', JSON.stringify(stack));
      window.location.replace(prev);
    } else {
      // Already at root — go to index.html
      sessionStorage.removeItem('__navStack');
      window.location.replace('index.html');
    }
  };

  window.navTo = function(url) {
    var stack = window.__navStack;
    // Avoid duplicate consecutive entries
    if (!stack.length || stack[stack.length-1] !== url) {
      stack.push(url);
    }
    sessionStorage.setItem('__navStack', JSON.stringify(stack));
    window.location.href = url;
  };

  // Register current page on load
  (function(){
    var cur = window.location.href.split('/').pop().split('?')[0] + (window.location.search||'');
    var stack = window.__navStack;
    if (!stack.length || stack[stack.length-1] !== cur) {
      // Only push if it's a new page (not a reload)
      stack.push(cur);
      sessionStorage.setItem('__navStack', JSON.stringify(stack));
    }
  })();
})();
