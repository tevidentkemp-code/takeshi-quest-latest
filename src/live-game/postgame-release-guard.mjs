const STYLE_ID = 'sq-sc038-result-stat-polish';

function ensureReleasePolish() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.modal-gamecomplete.sq-gc-arcade .gc-statRow .gc-statValue{
  font-size:clamp(18px,4.8vw,24px) !important;
  font-weight:500 !important;
  line-height:1.05 !important;
  white-space:nowrap !important;
}
.modal-gamecomplete.sq-gc-arcade .sq-pg-xp-screen:not([hidden]){
  min-height:120px;
}
`;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureReleasePolish, { once:true });
} else {
  ensureReleasePolish();
}

export { ensureReleasePolish };
