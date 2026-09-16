const STYLE_ID = 'sq-sc038-bull-colours';

function installBullColours() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Canonical Bull round row has no data-bull attributes; target the Bull-only
   row structurally so number-round S/D/T controls remain untouched. */
body.livev2-on[data-page="game"] #pad .dtBullRow:not(.dtScoreRow) .dtBullBtn:first-child:not(.inner),
body .modal-decider .dtBullRow .dtBullBtn[data-bull="Outer"]{
  background:linear-gradient(180deg,rgba(18,92,52,.90),rgba(8,48,29,.98)) !important;
  border-color:rgba(72,224,124,.86) !important;
  color:#bcffd2 !important;
  box-shadow:0 0 0 1px rgba(47,208,107,.12),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(220,255,232,.10),0 0 18px rgba(47,208,107,.12) !important;
}
body.livev2-on[data-page="game"] #pad .dtBullRow:not(.dtScoreRow) .dtBullBtn.inner,
body .modal-decider .dtBullRow .dtBullBtn.inner[data-bull="Inner"]{
  background:linear-gradient(180deg,rgba(126,27,42,.92),rgba(62,10,23,.98)) !important;
  border-color:rgba(255,77,94,.88) !important;
  color:#ffc1c8 !important;
  box-shadow:0 0 0 1px rgba(255,77,94,.11),0 8px 18px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,225,229,.10),0 0 18px rgba(255,77,94,.11) !important;
}
`;
  document.head.appendChild(style);
}

if (typeof document !== 'undefined') installBullColours();

export { installBullColours };
