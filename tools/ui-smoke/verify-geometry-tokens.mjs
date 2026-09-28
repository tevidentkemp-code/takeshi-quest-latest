import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}
function must(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}
function mustNot(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

const foundations = read('src/styles/core/foundations-tokens.css');
const startGame = read('src/styles/modals/start-game.css');
const liveV2 = read('src/styles/live-game/v2-panel.css');
const turbo = read('src/legacy/styles/inline-016.css');
const gameComplete = read('src/styles/modals/game-complete.css');
const leaderboardBase = read('src/styles/league/leaderboard-base.css');
const leaderboardPolish = read('src/styles/league/leaderboard-polish.css');
const topbar = read('src/styles/live-game/topbar.css');
const infoPager = read('src/styles/live-game/v2-info-pager.css');

const tokens = [
  '--sq-radius-control: 8px;',
  '--sq-radius-compact: 12px;',
  '--sq-radius-card: 14px;',
  '--sq-radius-panel: 18px;',
  '--sq-radius-stage: 22px;',
  '--sq-radius-shell: 26px;',
  '--sq-radius-full: 999px;',
  '--sq-ring-outset: 4px;',
  '--radius:var(--sq-radius-card);',
  '--sq-primary-radius: var(--sq-radius-control);'
];
for (const token of tokens) must(foundations, token, 'geometry token');

must(startGame, 'border-radius: var(--sq-radius-panel);', 'Start Game panel token');
must(startGame, 'border-radius:var(--sq-radius-full);', 'Start Game pill token');

must(liveV2, 'border-radius: var(--sq-radius-stage);', 'Live V2 stage token');
must(liveV2, 'border-radius: var(--sq-radius-panel);', 'Live V2 panel token');
must(liveV2, 'border-radius: var(--sq-radius-full);', 'Live V2 full token');

must(turbo, 'inset:calc(0px - var(--sq-ring-outset));', 'Turbo outside ring inset');
must(turbo, 'border-radius:calc(var(--sq-radius-panel) + var(--sq-ring-outset));', 'Turbo concentric radius');
must(turbo, 'padding:var(--sq-ring-outset);', 'Turbo ring thickness');
mustNot(turbo, 'inset:-4px; border-radius:22px; padding:4px;', 'old Turbo magic-number geometry');

must(gameComplete, 'border-radius: var(--sq-radius-shell) !important;', 'Game Complete shell');
must(gameComplete, 'border-radius: var(--sq-radius-stage) !important;', 'Game Complete stage');

must(leaderboardBase, 'border-radius:var(--sq-radius-card) !important;', 'Leaderboard base card');
must(leaderboardBase, 'border-radius:var(--sq-radius-full);', 'Leaderboard pill');
must(leaderboardPolish, 'border-radius: var(--sq-radius-panel);', 'Leaderboard polished panel');
must(leaderboardPolish, 'border-radius: var(--sq-radius-card);', 'Leaderboard table card');

must(topbar, 'border-radius: var(--sq-radius-stage);', 'Live DMD stage');

must(infoPager, 'border-radius: var(--sq-radius-shell);', 'Info pager shell');
must(infoPager, 'border-radius: var(--sq-radius-stage);', 'Info pager stage');
must(infoPager, 'border-radius: var(--sq-radius-full);', 'Info pager dot');

console.log('VIS-003 geometry token verification PASS');
