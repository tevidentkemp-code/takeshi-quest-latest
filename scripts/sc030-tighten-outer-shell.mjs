import fs from 'node:fs';

const path = 'src/styles/live-game/v2-panel.css';
const input = fs.readFileSync(path, 'utf8');
const from = `.livev2panel{\n  max-width: 560px;\n  width:100%;\n  border-radius: 0;\n  background: transparent;\n  box-shadow: none;\n  border: 0;\n  padding: 0;\n  margin: 6px auto 0;\n}`;
const to = `body.livev2-on[data-page="game"] #liveV2Panel.livev2panel{\n  max-width: 560px;\n  width:100%;\n  border-radius: 0 !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  border: 0 !important;\n  padding: 0 !important;\n  margin: 6px auto 0;\n}`;
if (!input.includes(from)) throw new Error('SC-030 outer-shell source anchor missing');
fs.writeFileSync(path, input.replace(from, to), 'utf8');
console.log('SC-030 outer-shell cascade source corrected.');
