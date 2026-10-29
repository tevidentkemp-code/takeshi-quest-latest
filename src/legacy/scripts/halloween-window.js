  (function () {
    // UK Halloween weekend; 2 November 2026 midnight is UTC after the clocks change.
    var starts = Date.parse('2026-10-29T00:00:00Z');
    var ends = Date.parse('2026-11-02T00:00:00Z');
    var active = false;
    var timer;
    window.__sqHalloweenActive = function () {
      var now = Date.now();
      return now >= starts && now < ends;
    };
    function sync() {
      var next = window.__sqHalloweenActive();
      document.documentElement.classList.toggle('sq-halloween', next);
      if (next !== active) {
        active = next;
        document.dispatchEvent(new Event('sq:halloween-change'));
      }
      clearTimeout(timer);
      var now = Date.now();
      var boundary = now < starts ? starts : now < ends ? ends : 0;
      if (boundary) timer = setTimeout(sync, Math.min(boundary - now + 10, 2147483647));
    }
    document.addEventListener('visibilitychange', sync);
    sync();
  }());
