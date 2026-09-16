const GUARD_KEY = '__sqSc038ReleaseGuard';
const BOUND_KEY = 'sqSc038ReleaseBound';

function finalAdvanceLabel(existingText) {
  return /end\s*match|finish\s*match/i.test(String(existingText || '')) ? 'FINISH MATCH' : 'NEXT GAME';
}

function ensureStatStyles() {
  if (document.getElementById('sq-sc038-result-stat-polish')) return;
  const style = document.createElement('style');
  style.id = 'sq-sc038-result-stat-polish';
  style.textContent = `
.modal-gamecomplete.sq-gc-arcade .gc-statRow .gc-statValue{
  font-size:clamp(18px,4.8vw,24px) !important;
  font-weight:500 !important;
  line-height:1.05 !important;
  white-space:nowrap !important;
}
`;
  document.head.appendChild(style);
}

function startXp(modal, next) {
  const xpScreen = modal.querySelector('.sq-pg-xp-screen');
  const host = xpScreen?.querySelector('.sq-pg-xp-host');
  const advanceBtn = modal.querySelector('[data-action="advanceMatch"]');
  if (!xpScreen || !host || !advanceBtn) return false;

  next.dataset.pgStep = '2';
  next.disabled = true;
  next.textContent = 'XP…';

  const enableFinalAdvance = () => {
    next.disabled = false;
    next.textContent = finalAdvanceLabel(advanceBtn.textContent);
  };

  try {
    if (typeof window.__sqGcXpEnsureStyles === 'function') window.__sqGcXpEnsureStyles();
  } catch (_) {}

  if (typeof window.__sqGcXpReveal === 'function') {
    try {
      window.__sqGcXpReveal(host, enableFinalAdvance);
      window.setTimeout(enableFinalAdvance, 9000);
    } catch (_) {
      host.innerHTML = '<div class="gc-xp-title">XP SUMMARY UNAVAILABLE</div>';
      enableFinalAdvance();
    }
  } else {
    host.innerHTML = '<div class="gc-xp-title">XP SUMMARY UNAVAILABLE</div>';
    enableFinalAdvance();
  }
  return true;
}

function handleNext(event, next) {
  const modal = next.closest('.modal-gamecomplete.sq-gc-arcade');
  if (!modal) return;

  const scorecard = modal.querySelector('.sq-pg-scorecard');
  const xpScreen = modal.querySelector('.sq-pg-xp-screen');
  if (!scorecard || !xpScreen) return;

  if (!scorecard.hidden && xpScreen.hidden) {
    event.preventDefault();
    event.stopImmediatePropagation();
    scorecard.hidden = true;
    xpScreen.hidden = false;
    const visual = modal.querySelector('.gc-arcade-visual');
    const confetti = modal.querySelector('.gc-arcade-confetti');
    if (visual) visual.style.display = 'none';
    if (confetti) confetti.style.display = 'none';
    startXp(modal, next);
    return;
  }

  if (!xpScreen.hidden && !next.disabled && /NEXT GAME|FINISH MATCH/i.test(next.textContent || '')) {
    const advanceBtn = modal.querySelector('[data-action="advanceMatch"]');
    if (!advanceBtn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    advanceBtn.click();
  }
}

function bindNext(next) {
  if (!(next instanceof HTMLElement) || next.dataset[BOUND_KEY] === '1') return;
  next.dataset[BOUND_KEY] = '1';
  next.addEventListener('click', event => handleNext(event, next), true);
}

function scan(root = document) {
  if (root instanceof Element && root.matches('.sq-pg-next')) bindNext(root);
  root.querySelectorAll?.('.sq-pg-next').forEach(bindNext);
}

function install() {
  if (window[GUARD_KEY]) return;
  window[GUARD_KEY] = true;
  ensureStatStyles();
  scan();
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) scan(node);
    }));
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.__sqSc038ReleaseObserver = observer;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once:true });
} else {
  install();
}

export { install, ensureStatStyles, bindNext };
