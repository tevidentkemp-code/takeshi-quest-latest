import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const ROOT = process.cwd();
const RUNTIME = 'src/legacy/styles/inline-002.css';
const MANIFEST = 'src/styles/core-source-manifest.json';
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';
const EXPECTED_RUNTIME_SHA256 = '8e1e1fc4716c47d5207784100e235f80ae5b8e7f18caecac322deda5f9ce5ada';
const EXPECTED_RUNTIME_BYTES = 284342;

/*
 * SC-031 semantic source architecture for the historical core stylesheet.
 *
 * IMPORTANT:
 * - These are SOURCE ownership boundaries only.
 * - The browser continues to receive one byte-identical compatibility runtime.
 * - Every boundary is anchored to an existing, unique top-level comment in the
 *   verified source. We do not reorder selectors or "clean up" cascade here.
 * - If the protected runtime changes, this script fails closed and must be
 *   deliberately remapped rather than silently cutting new source.
 */
const DOMAINS = [
  { file:'src/styles/core/foundations-tokens.css', owner:'core', anchor:null },
  { file:'src/styles/live-game/topbar.css', owner:'live-game', anchor:'/* ===== @CSS:GAME_TOPMENU_COLLAPSE' },
  { file:'src/styles/live-game/scroll-gate.css', owner:'live-game', anchor:'/* ===== @CSS:GAME_SCROLL_GATE' },
  { file:'src/styles/live-game/floating-header.css', owner:'live-game', anchor:'/* ===== @CSS:FLOATHEAD_NAMES_COLOR' },
  { file:'src/styles/league/power-ranking-toggles.css', owner:'league', anchor:'/* ===== @CSS:POWER_RANKINGS_TOGGLES' },
  { file:'src/styles/modals/start-game.css', owner:'modal-ui', anchor:'/* ===== @CSS:START_GAME_MODAL' },
  { file:'src/styles/modals/menu-shell.css', owner:'modal-ui', anchor:'/* ===== @CSS:MENU_MODAL' },
  { file:'src/styles/home/footer-navigation.css', owner:'home', anchor:'/* >>> PATCH:home-footer-nav START */' },
  { file:'src/styles/home/live-printer.css', owner:'home', anchor:'/* >>> PATCH:home-live-printer START */' },
  { file:'src/styles/setup/match-setup-base.css', owner:'setup', anchor:'/* ===== @CSS:MATCH-SETUP' },
  { file:'src/styles/setup/match-card-intake.css', owner:'setup', anchor:'/* >>> PATCH:SC014_MATCH_CARD_INTAKE START' },
  { file:'src/styles/setup/unified-setup-controls.css', owner:'setup', anchor:'/* =====================================================================\n   MATCH SETUP — UNIFIED BUTTON SYSTEM' },
  { file:'src/styles/player-stats/profile.css', owner:'player-stats', anchor:'/* ===== Player profile (pp-*) — arcade skin for openPlayerStatsDialog ===== */' },
  { file:'src/styles/league/rankings-arenas.css', owner:'league', anchor:'/* Power Rankings arena (pw-*): podium + sliding ranked rows + power bars */' },
  { file:'src/styles/live-game/v3-shell.css', owner:'live-game', anchor:'/* =====================================================================\n   LIVE V3 — Premium UI test layout (2-player Match Play Classic, beta)' },
  { file:'src/styles/live-game/v3-score-grid.css', owner:'live-game', anchor:'/* ---------------- Score grid ---------------- */' },
  { file:'src/styles/live-game/v3-effects.css', owner:'live-game', anchor:'/* ---------------- Arcade animations ---------------- */' },
  { file:'src/styles/setup/throw-order.css', owner:'setup', anchor:'/* ===== @CSS:THROW-ORDER' },
  { file:'src/styles/modals/game-complete-core.css', owner:'modal-ui', anchor:'/* >>> PATCH:GAME_COMPLETE_MODAL_V1 START */' },
  { file:'src/styles/setup/match-length.css', owner:'setup', anchor:'/* ===== @CSS:MATCH-LENGTH' },
  { file:'src/styles/modals/decider-shootout.css', owner:'modal-ui', anchor:'/* >>> PATCH:decider_shootout_modal START */' },
  { file:'src/styles/league/leaderboard-base.css', owner:'league', anchor:'/* >>> PATCH:lb-style-v1 START */' },
  { file:'src/styles/league/leaderboard-polish.css', owner:'league', anchor:'/* >>> PATCH:leaderboard_style_v23 START */' },
  { file:'src/styles/live-game/v2-mobile.css', owner:'live-game', anchor:'/* >>> PATCH:livev2-mobile-card START */' },
  { file:'src/styles/live-game/v2-panel.css', owner:'live-game', anchor:'/* >>> PATCH:livev2-panel-css START */' },
  { file:'src/styles/practice/solo-live-v2.css', owner:'practice', anchor:'/* >>> PATCH:PRACTICE_SOLO_LIVEV2_V1 START */' },
  { file:'src/styles/live-game/v2-info-pager.css', owner:'live-game', anchor:'/* >>> PATCH:V30_INFO_RECORDS_PAGER START */' },
];

const abs = (p) => path.join(ROOT, p);
const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const byteLength = (value) => Buffer.byteLength(value, 'utf8');

function fail(message){
  console.error(`SC-031 core CSS split FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message){ if(!condition) fail(message); }
function read(file){
  if(!fs.existsSync(abs(file))) fail(`missing required file ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
}
function ensureParent(file){ fs.mkdirSync(path.dirname(abs(file)), {recursive:true}); }
function parseCss(text, file){
  try { postcss.parse(text, {from:file}); }
  catch(error){ fail(`CSS parse failed for ${file}: ${error?.message || error}`); }
}
function uniqueAnchorOffset(source, anchor){
  const first = source.indexOf(anchor);
  assert(first >= 0, `anchor not found: ${anchor}`);
  assert(source.indexOf(anchor, first + anchor.length) === -1, `anchor is not unique: ${anchor}`);
  return first;
}
function countLines(text){ return text.length ? (text.match(/\n/g)?.length || 0) + 1 : 0; }

const runtime = read(RUNTIME);
assert(byteLength(runtime) === EXPECTED_RUNTIME_BYTES,
  `protected runtime byte count changed: ${byteLength(runtime)} vs ${EXPECTED_RUNTIME_BYTES}`);
assert(sha256(runtime) === EXPECTED_RUNTIME_SHA256,
  `protected runtime hash changed; remap required: ${sha256(runtime)}`);
parseCss(runtime, RUNTIME);

const starts = DOMAINS.map((domain, index) => index === 0 ? 0 : uniqueAnchorOffset(runtime, domain.anchor));
for(let i=1;i<starts.length;i+=1){
  assert(starts[i] > starts[i-1], `domain order is invalid at ${DOMAINS[i].file}`);
}

const slices = DOMAINS.map((domain, index) => {
  const start = starts[index];
  const end = index + 1 < starts.length ? starts[index + 1] : runtime.length;
  const content = runtime.slice(start, end);
  assert(content.length > 0, `empty domain ${domain.file}`);
  if(domain.anchor) assert(content.startsWith(domain.anchor), `${domain.file} does not begin at its protected anchor`);
  parseCss(content, domain.file);
  return {domain, start, end, content};
});

const rebuilt = slices.map(item => item.content).join('');
assert(rebuilt === runtime, 'semantic domains do not reconstruct the runtime byte-for-byte');
assert(sha256(rebuilt) === EXPECTED_RUNTIME_SHA256, 'reconstructed runtime hash mismatch');

for(const item of slices){
  ensureParent(item.domain.file);
  fs.writeFileSync(abs(item.domain.file), item.content, 'utf8');
}

const manifest = {
  schemaVersion: 2,
  generatedBy: 'scripts/split-core-styles-v2.mjs',
  strategy: '27-semantic-sources-byte-identical-compatibility-runtime',
  stage: 'semantic-source-ownership',
  runtimeTarget: RUNTIME,
  runtimeBytes: EXPECTED_RUNTIME_BYTES,
  runtimeSha256: EXPECTED_RUNTIME_SHA256,
  domainCount: DOMAINS.length,
  domains: slices.map((item, index) => ({
    order: index + 1,
    owner: item.domain.owner,
    file: item.domain.file,
    anchor: item.domain.anchor,
    startOffset: item.start,
    endOffset: item.end,
    bytes: byteLength(item.content),
    lines: countLines(item.content),
    sha256: sha256(item.content),
  })),
};
ensureParent(MANIFEST);
fs.writeFileSync(abs(MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

/* Keep the compatibility runtime and its migration evidence synchronized. */
fs.writeFileSync(abs(RUNTIME), rebuilt, 'utf8');
const migration = JSON.parse(read(MIGRATION_MANIFEST));
const migrationEntry = (migration.styles || []).find(entry => entry.file === RUNTIME);
assert(migrationEntry, `runtime ${RUNTIME} missing from migration manifest`);
migrationEntry.sha256 = EXPECTED_RUNTIME_SHA256;
fs.writeFileSync(abs(MIGRATION_MANIFEST), `${JSON.stringify(migration, null, 2)}\n`, 'utf8');

const largest = manifest.domains.reduce((a,b) => b.bytes > a.bytes ? b : a, manifest.domains[0]);
console.log(`SC-031 core CSS split PASS: ${DOMAINS.length} semantic source domains -> ${RUNTIME}`);
console.log(`runtime ${EXPECTED_RUNTIME_BYTES} bytes sha256 ${EXPECTED_RUNTIME_SHA256}`);
console.log(`largest domain ${largest.file}: ${largest.bytes} bytes`);
