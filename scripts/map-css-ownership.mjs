import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const ROOT = process.cwd();
const MIGRATION_MANIFEST = 'src/legacy/migration-manifest.json';
const CORE_STYLE_MANIFEST = 'src/core-style-manifest.json';
const OUT = 'docs/architecture/CSS_OWNERSHIP_MAP.md';
const abs = (p) => path.join(ROOT, p);

function fail(message) {
  console.error(`FAIL CSS ownership map: ${message}`);
  process.exit(1);
}
function readText(file) {
  if (!fs.existsSync(abs(file))) fail(`missing ${file}`);
  return fs.readFileSync(abs(file), 'utf8');
}
function esc(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const OWNER_RULES = [
  ['dmd', ['dmd', 'dot matrix', 'dot-matrix']],
  ['throwpad', ['throwpad', 'padbar', 'pad ', 'missx3', 'miss x3', 'undo', 'skip']],
  ['live-game', ['livev2', 'live v2', 'liverace', 'race chart', 'game race', 'shot indicator', '3av', 'mav', 'hud']],
  ['tournament', ['tournament', 'bracket']],
  ['training', ['training', 'practice mode', 'shadow']],
  ['player-stats', ['player stats', 'playerstats', 'progression', 'spider', 'h2h', 'profile', 'achievement', 'trophy']],
  ['league-rankings', ['league', 'ranking', 'rankings', 'top50', 'top 50', 'high score', 'low score', 'power rank', 'premier']],
  ['home-setup', ['home', 'start game', 'startgame', 'details', 'players setup', 'setup']],
  ['modal-ui', ['modal', 'dialog', 'backdrop', 'sheet']],
  ['admin', ['admin', 'keypad']],
  ['shared-ui', ['token', ':root', 'button', 'btn', 'menu', 'card', 'layout']],
];

function classify(text, attrs, selectors) {
  const haystack = `${attrs}\n${text.slice(0, 12000)}\n${selectors.slice(0, 160).join(' ')}`.toLowerCase();
  let best = ['unclassified', 0];
  for (const [owner, terms] of OWNER_RULES) {
    let score = 0;
    for (const term of terms) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      score += (haystack.match(re) || []).length;
    }
    if (score > best[1]) best = [owner, score];
  }
  return best[1] > 0 ? best[0] : 'unclassified';
}

function inspectStyle(entry) {
  const text = readText(entry.file);
  let root;
  try {
    root = postcss.parse(text, { from: entry.file });
  } catch (error) {
    fail(`PostCSS parse failed for ${entry.file}: ${error?.message || error}`);
  }
  const selectors = [];
  let rules = 0;
  let declarations = 0;
  let important = 0;
  let media = 0;
  let customProps = 0;
  root.walkRules((rule) => {
    rules += 1;
    for (const selector of rule.selectors || [rule.selector]) {
      if (selector) selectors.push(selector.trim().replace(/\s+/g, ' '));
    }
  });
  root.walkDecls((decl) => {
    declarations += 1;
    if (decl.important) important += 1;
    if (decl.prop?.startsWith('--')) customProps += 1;
  });
  root.walkAtRules('media', () => { media += 1; });
  return {
    ...entry,
    bytes: Buffer.byteLength(text, 'utf8'),
    rules,
    declarations,
    important,
    media,
    customProps,
    selectors,
    owner: classify(text, entry.originalAttributes || '', selectors),
  };
}

const migration = JSON.parse(readText(MIGRATION_MANIFEST));
const styles = [...(migration.styles || [])].sort((a, b) => a.order - b.order).map(inspectStyle);
if (styles.length !== migration.extractedStyleBlocks) fail(`manifest expected ${migration.extractedStyleBlocks} styles, inspected ${styles.length}`);

const selectorMap = new Map();
for (const style of styles) {
  for (const selector of new Set(style.selectors)) {
    const arr = selectorMap.get(selector) || [];
    arr.push({ order: style.order, file: style.file, owner: style.owner });
    selectorMap.set(selector, arr);
  }
}
const overlaps = [...selectorMap.entries()]
  .filter(([, refs]) => new Set(refs.map((ref) => ref.file)).size > 1)
  .sort((a, b) => {
    const aFiles = new Set(a[1].map((ref) => ref.file)).size;
    const bFiles = new Set(b[1].map((ref) => ref.file)).size;
    return bFiles - aFiles || b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });

const ownerCounts = new Map();
for (const style of styles) ownerCounts.set(style.owner, (ownerCounts.get(style.owner) || 0) + 1);

const md = [];
md.push('# SC-031 CSS Ownership and Cascade Map', '');
md.push('Generated from the current SC-031 extracted stylesheet manifest using PostCSS parsing. This is architecture evidence only: owner labels are heuristic until each fragment is manually confirmed. The manifest order below is the protected browser cascade order for consolidation work.', '');
md.push(`- Extracted stylesheet blocks: **${styles.length}**`);
md.push(`- Parsed rules: **${styles.reduce((n, s) => n + s.rules, 0)}**`);
md.push(`- Parsed declarations: **${styles.reduce((n, s) => n + s.declarations, 0)}**`);
md.push(`- !important declarations: **${styles.reduce((n, s) => n + s.important, 0)}**`);
md.push(`- Selectors repeated across more than one extracted file: **${overlaps.length}**`, '');

if (fs.existsSync(abs(CORE_STYLE_MANIFEST))) {
  const core = JSON.parse(readText(CORE_STYLE_MANIFEST));
  md.push('## Core stylesheet semantic sources', '');
  md.push(`Runtime target: \`${core.runtimeTarget}\` — ${core.runtimeBytes.toLocaleString('en-GB')} bytes — SHA-256 \`${core.runtimeSha256}\`.`, '');
  md.push('| Order | Owner | Source | Marker | Bytes |');
  md.push('| ---: | --- | --- | --- | ---: |');
  for (const domain of core.domains || []) {
    md.push(`| ${domain.order} | ${esc(domain.owner)} | \`${domain.file}\` | \`${esc(domain.marker)}\` | ${domain.bytes.toLocaleString('en-GB')} |`);
  }
  md.push('');
}

md.push('## Extracted stylesheet inventory in protected cascade order', '');
md.push('| Order | File | Existing id/attributes | Likely owner | Bytes | Rules | Decls | !important | Media |');
md.push('| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const style of styles) {
  md.push(`| ${style.order} | \`${style.file}\` | ${esc(style.originalAttributes || '—')} | **${style.owner}** | ${style.bytes.toLocaleString('en-GB')} | ${style.rules} | ${style.declarations} | ${style.important} | ${style.media} |`);
}
md.push('');

md.push('## Heuristic ownership totals', '');
for (const [owner, count] of [...ownerCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  md.push(`- **${owner}:** ${count} extracted stylesheet block${count === 1 ? '' : 's'}`);
}
md.push('');

md.push('## Cross-file selector overlap — highest consolidation risk', '');
md.push('These selectors occur in multiple extracted stylesheet files. They are the first places where moving or merging CSS can change the cascade even when declarations themselves are unchanged.', '');
md.push('| Selector | Files | Orders / likely owners |');
md.push('| --- | ---: | --- |');
for (const [selector, refs] of overlaps.slice(0, 120)) {
  const files = new Set(refs.map((ref) => ref.file)).size;
  const desc = refs.map((ref) => `${ref.order}:${ref.owner}`).join(', ');
  md.push(`| \`${esc(selector)}\` | ${files} | ${esc(desc)} |`);
}
if (overlaps.length === 0) md.push('| — | 0 | No cross-file selector overlaps detected |');
md.push('');

md.push('## Consolidation contract', '');
md.push('- Never reorder existing cascade positions during ownership migration.');
md.push('- Move a fragment only when its owner and any shared selectors are confirmed.');
md.push('- Keep the current runtime CSS generated from semantic source until cascade dependencies are explicitly removed.');
md.push('- Preserve Live Game dimensions, Throwpad tap targets, DMD bounds and all mode-specific selectors during consolidation.');
md.push('- Run PostCSS parse + byte/runtime verification + full UI regression after every material CSS slice.');
md.push('');

fs.mkdirSync(path.dirname(abs(OUT)), { recursive: true });
fs.writeFileSync(abs(OUT), `${md.join('\n')}\n`);
console.log(`PASS CSS ownership map: ${styles.length} styles, ${overlaps.length} cross-file selector overlaps -> ${OUT}`);
