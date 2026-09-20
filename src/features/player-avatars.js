// SC-040 — Player avatar catalogue + rendering helpers.
// Presentation assets are sprite sheets; persistent truth is players.avatar_key.
(function(){
  if (window.__sqAvatarSystemLoaded) return;
  window.__sqAvatarSystemLoaded = true;

  const COUNT = 34;
  const COLS = 7;
  const ROWS = 5;
  const AVATAR_SPRITE = './assets/player-avatars/avatars.webp';
  const CELEBRATION_SPRITE = './assets/player-avatars/celebrations.webp';
  const keys = Array.from({ length: COUNT }, (_, i) => `av${String(i + 1).padStart(2, '0')}`);
  const keySet = new Set(keys);

  function normaliseKey(value){
    const key = String(value || '').trim().toLowerCase();
    return keySet.has(key) ? key : '';
  }
  function indexFor(value){
    const key = normaliseKey(value);
    return key ? Number(key.slice(2)) - 1 : -1;
  }
  function spritePosition(value){
    const index = indexFor(value);
    if (index < 0) return null;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = COLS <= 1 ? 0 : (col / (COLS - 1)) * 100;
    const y = ROWS <= 1 ? 0 : (row / (ROWS - 1)) * 100;
    return `${x}% ${y}%`;
  }
  function applySprite(el, value, kind){
    if (!el) return false;
    const pos = spritePosition(value);
    if (!pos) return false;
    const celebration = kind === 'celebration';
    el.style.setProperty('background-image', `url("${celebration ? CELEBRATION_SPRITE : AVATAR_SPRITE}")`, 'important');
    el.style.setProperty('background-size', `${COLS * 100}% ${ROWS * 100}%`, 'important');
    el.style.setProperty('background-position', pos, 'important');
    el.style.setProperty('background-repeat', 'no-repeat', 'important');
    return true;
  }
  function makeAvatar(value, className){
    const el = document.createElement('span');
    el.className = className || 'sq-avatar';
    el.setAttribute('aria-hidden', 'true');
    if (!applySprite(el, value, 'avatar')) {
      el.classList.add('is-empty');
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="3.4"/><path d="M5.5 19.5c1.2-3.1 3.6-4.7 6.5-4.7s5.3 1.6 6.5 4.7"/></svg>';
    }
    return el;
  }
  function mountPicker(container, selectedValue, onChange, options){
    if (!container) return null;
    const opts = options || {};
    const selected = normaliseKey(selectedValue);
    container.innerHTML = '';
    container.classList.add('sq-avatar-picker');
    const head = document.createElement('div');
    head.className = 'sq-avatar-picker-head';
    const label = document.createElement('div');
    label.className = 'sq-avatar-picker-label';
    label.textContent = opts.label || 'AVATAR';
    const value = document.createElement('div');
    value.className = 'sq-avatar-picker-value';
    value.textContent = selected ? `Avatar ${selected.slice(2)}` : 'Choose one';
    head.append(label, value);
    const grid = document.createElement('div');
    grid.className = 'sq-avatar-grid';
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', opts.ariaLabel || 'Choose player avatar');
    function select(key, notify){
      const valid = normaliseKey(key);
      grid.querySelectorAll('.sq-avatar-option').forEach(btn => {
        const active = btn.dataset.avatarKey === valid;
        btn.classList.toggle('is-selected', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      value.textContent = valid ? `Avatar ${valid.slice(2)}` : 'Choose one';
      container.dataset.avatarKey = valid;
      if (notify && typeof onChange === 'function') onChange(valid);
    }
    keys.forEach((key, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sq-avatar-option';
      btn.dataset.avatarKey = key;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', `Avatar ${String(i + 1).padStart(2, '0')}`);
      btn.setAttribute('aria-checked', 'false');
      btn.appendChild(makeAvatar(key, 'sq-avatar-option-image'));
      btn.onclick = () => select(key, true);
      grid.appendChild(btn);
    });
    container.append(head, grid);
    select(selected, false);
    return { select, getValue: () => normaliseKey(container.dataset.avatarKey) };
  }
  function ensureAddPlayerPickerHost(){
    const body = document.querySelector('#addPlayerModal .np-body');
    if (!body) return null;
    let host = document.getElementById('newPlayerAvatarPicker');
    if (!host) {
      host = document.createElement('div');
      host.id = 'newPlayerAvatarPicker';
      host.className = 'np-field sq-avatar-picker-field';
      body.appendChild(host);
    }
    return host;
  }
  function applyWinnerCelebration(modal, avatarKey){
    if (!modal) return false;
    const visual = modal.querySelector('.gc-arcade-visual');
    const key = normaliseKey(avatarKey);
    if (!visual || !key) return false;
    visual.classList.add('sq-avatar-celebration');
    visual.dataset.avatarKey = key;
    return applySprite(visual, key, 'celebration');
  }

  window.SQ_AVATARS = Object.freeze({ count: COUNT, cols: COLS, rows: ROWS, keys: Object.freeze(keys.slice()) });
  window.__sqAvatarNormaliseKey = normaliseKey;
  window.__sqAvatarMake = makeAvatar;
  window.__sqAvatarApply = applySprite;
  window.__sqMountAvatarPicker = mountPicker;
  window.__sqEnsureAddPlayerPickerHost = ensureAddPlayerPickerHost;
  window.__sqApplyWinnerCelebration = applyWinnerCelebration;
})();