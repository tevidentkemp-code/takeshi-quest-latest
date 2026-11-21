/* Halloween 2026 presentation only. No game state, input, or scoring work. */
(function () {
  'use strict';
  if (window.__sqHalloweenEffectsInstalled) return;
  window.__sqHalloweenEffectsInstalled = true;
  var layer = null;
  var timer = null;
  var nextGhost = true;
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function isActive() {
    return typeof window.__sqHalloweenActive === 'function' && window.__sqHalloweenActive();
  }
  function stop() {
    clearTimeout(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
  }
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!layer || !isActive() || document.hidden || (motion && motion.matches)) return;
      var ghost = layer.querySelector('.sq-haunt-ghost');
      var lightning = layer.querySelector('.sq-haunt-lightning');
      if (nextGhost) {
        ghost.dataset.side = Math.random() < 0.5 ? 'left' : 'right';
        ghost.style.top = (18 + Math.floor(Math.random() * 48)) + '%';
        ghost.classList.add('is-haunting');
      } else {
        lightning.classList.add('is-lightning');
      }
      nextGhost = !nextGhost;
      schedule(14000 + Math.random() * 14000);
    }, delay);
  }
  function start() {
    stop();
    if (!document.body || document.hidden || !isActive()) return;
    nextGhost = true;
    layer = document.createElement('div');
    layer.className = 'sq-haunt-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<svg class="sq-haunt-bat sq-haunt-bat-one" viewBox="0 0 100 42" focusable="false"><path d="M50 13 42 5 40 14C27 0 11 1 1 14c10-3 17 0 20 8 5-4 12-4 17 3l12 13 12-13c5-7 12-7 17-3 3-8 10-11 20-8C89 1 73 0 60 14l-2-9z"/></svg>' +
      '<svg class="sq-haunt-bat sq-haunt-bat-two" viewBox="0 0 100 42" focusable="false"><path d="M50 13 42 5 40 14C27 0 11 1 1 14c10-3 17 0 20 8 5-4 12-4 17 3l12 13 12-13c5-7 12-7 17-3 3-8 10-11 20-8C89 1 73 0 60 14l-2-9z"/></svg>' +
      '<svg class="sq-haunt-ghost" viewBox="0 0 64 90" focusable="false"><path d="M8 76V35C8 18 18 7 32 7s24 11 24 28v41l-9-7-8 8-7-8-8 8-8-8z"/><ellipse cx="24" cy="37" rx="3.5" ry="5"/><ellipse cx="40" cy="37" rx="3.5" ry="5"/><ellipse cx="32" cy="52" rx="3" ry="4"/></svg>' +
      '<svg class="sq-haunt-lightning" viewBox="0 0 110 170" focusable="false"><path d="M78 -5 48 43 68 48 35 87 53 93 15 157"/></svg>';
    layer.addEventListener('animationend', function (event) {
      if (event.target.classList.contains('sq-haunt-ghost')) event.target.classList.remove('is-haunting');
      if (event.target.classList.contains('sq-haunt-lightning')) event.target.classList.remove('is-lightning');
    });
    document.body.appendChild(layer);
    if (!motion || !motion.matches) schedule(3000 + Math.random() * 3000);
  }
  document.addEventListener('sq:halloween-change', start);
  document.addEventListener('visibilitychange', start);
  if (motion) {
    if (motion.addEventListener) motion.addEventListener('change', start);
    else if (motion.addListener) motion.addListener(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
