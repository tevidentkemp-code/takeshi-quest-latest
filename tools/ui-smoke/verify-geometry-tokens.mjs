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
const menuShell = read('src/styles/modals/menu-shell.css');
const floatingHeader = read('src/styles/live-game/floating-header.css');
const liveV2 = read('src/styles/live-game/v2-panel.css');
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
must(startGame, 'border-radius: var(--sq-radius-card);', 'Start Game option-card token');
must(startGame, 'border-radius: var(--sq-radius-compact);', 'Start Game icon-well token');

must(floatingHeader, 'border-radius:var(--sq-radius-panel);', 'Shared modal shell token');
must(menuShell, 'border-radius:var(--sq-radius-panel);', 'Menu modal shell token');
must(menuShell, 'border-radius:var(--sq-radius-card);', 'Menu row/card token');
must(menuShell, 'border-radius:var(--sq-radius-compact);', 'Menu nested icon token');
must(menuShell, 'border-radius:var(--sq-radius-control);', 'Menu compact control token');
must(menuShell, 'border-radius:var(--sq-radius-full);', 'Menu pill/full token');

must(liveV2, 'border-radius: var(--sq-radius-stage);', 'Live V2 stage token');
must(liveV2, 'border-radius: var(--sq-radius-panel);', 'Live V2 panel token');
must(liveV2, 'border-radius: var(--sq-radius-full);', 'Live V2 full token');

must(liveV2, 'inset: calc(0px - var(--sq-ring-outset)) !important;', 'Turbo outside ring inset');
must(liveV2, 'border-radius: calc(var(--sq-radius-panel) + var(--sq-ring-outset)) !important;', 'Turbo concentric radius');
must(liveV2, 'padding: var(--sq-ring-outset) !important;', 'Turbo ring thickness');

must(leaderboardBase, 'border-radius:var(--sq-radius-card) !important;', 'Leaderboard base card');
must(leaderboardBase, 'border-radius:var(--sq-radius-full);', 'Leaderboard pill');
must(leaderboardPolish, 'border-radius: var(--sq-radius-panel);', 'Leaderboard polished panel');
must(leaderboardPolish, 'border-radius: var(--sq-radius-card);', 'Leaderboard table card');

must(topbar, 'border-radius: var(--sq-radius-stage);', 'Live DMD stage');

must(infoPager, 'border-radius: var(--sq-radius-shell);', 'Info pager shell');
must(infoPager, 'border-radius: var(--sq-radius-stage);', 'Info pager stage');
must(infoPager, 'border-radius: var(--sq-radius-full);', 'Info pager dot');

console.log('VIS-003 geometry token verification PASS');
