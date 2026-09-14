import fs from 'node:fs';

function replaceOnce(path, from, to){
  const input=fs.readFileSync(path,'utf8');
  if(!input.includes(from)) throw new Error(`Missing SC-030 cascade anchor in ${path}`);
  fs.writeFileSync(path,input.replace(from,to),'utf8');
}

// Beat later compatibility styles without editing their preserved baseline.
replaceOnce(
  'src/styles/live-game/v2-panel.css',
  'body.livev2-on[data-page="game"] #liveV2Panel.livev2panel{',
  'body.livev2-on[data-page="game"] #game #liveV2Panel.livev2panel{'
);

// The DMD host is structural only. Two-ID specificity keeps later Turbo/legacy
// decoration from recreating a second cabinet around the real .sq-dmd bezel.
replaceOnce(
  'src/styles/live-game/v2-mobile.css',
  'body[data-page="game"] #floatHead{',
  'body.livev2-on[data-page="game"] #game #floatHead{'
);

console.log('SC-030 authoritative shell cascade corrected.');
