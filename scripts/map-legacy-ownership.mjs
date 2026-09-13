import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'legacy', 'migration-manifest.json');
const outPath = path.join(root, 'docs', 'architecture', 'CORE_SECTION_MAP.md');

if (!fs.existsSync(manifestPath)) {
  throw new Error('SC-031 ownership map requires src/legacy/migration-manifest.json');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allEntries = [
  ...manifest.styles.map(entry => ({ ...entry, type: 'css' })),
  ...manifest.scripts.map(entry => ({ ...entry, type: 'js' }))
];

const rows = allEntries.map(entry => inspect(entry));
const coreJs = rows.find(row => row.file === 'src/legacy/scripts/inline-005.js');
const coreCss = rows.find(row => row.file === 'src/legacy/styles/inline-002.css');

const output = [];
output.push('# SC-031 Core Section & Ownership Map', '');
output.push('> Generated deterministically from the verified Phase 1 split. This is an engineering map, not product authority. Suggested ownership is heuristic and must be reviewed before moving code.', '');
output.push(`Generated from manifest schema ${manifest.schemaVersion}; ${manifest.extractedScriptBlocks} JS blocks and ${manifest.extractedStyleBlocks} CSS blocks.`, '');

output.push('## Largest extracted assets', '');
output.push('| File | Type | Bytes | Lines | Suggested owner | Original marker/id |');
output.push('|---|---:|---:|---:|---|---|');
for (const row of [...rows].sort((a,b) => b.bytes - a.bytes).slice(0, 20)) {
  output.push(`| \`${row.file}\` | ${row.type.toUpperCase()} | ${row.bytes} | ${row.lines} | ${row.owner} | ${escapePipe(row.originalAttributes || '—')} |`);
}
output.push('');

if (coreJs) {
  output.push('## Core JavaScript (`inline-005.js`)', '');
  output.push(`Size: **${coreJs.bytes.toLocaleString('en-GB')} bytes**, **${coreJs.lines.toLocaleString('en-GB')} lines**.`, '');
  output.push('### Section markers', '');
  if (coreJs.sectionMarkers.length) {
    output.push('| Line | Marker |', '|---:|---|');
    for (const marker of coreJs.sectionMarkers) output.push(`| ${marker.line} | \`${marker.text}\` |`);
  } else {
    output.push('_No @SEC markers found._');
  }
  output.push('', '### Critical runtime anchors', '');
  output.push('| Line | Anchor |', '|---:|---|');
  for (const anchor of coreJs.anchors) output.push(`| ${anchor.line} | \`${escapePipe(anchor.text)}\` |`);
  output.push('');
}

if (coreCss) {
  output.push('## Core CSS (`inline-002.css`)', '');
  output.push(`Size: **${coreCss.bytes.toLocaleString('en-GB')} bytes**, **${coreCss.lines.toLocaleString('en-GB')} lines**.`, '');
  output.push('### Section markers', '');
  if (coreCss.sectionMarkers.length) {
    output.push('| Line | Marker |', '|---:|---|');
    for (const marker of coreCss.sectionMarkers) output.push(`| ${marker.line} | \`${marker.text}\` |`);
  } else {
    output.push('_No @SEC markers found._');
  }
  output.push('');
}

output.push('## Extracted JavaScript ownership inventory', '');
output.push('| Order | File | Bytes | Lines | Suggested owner | Original marker/id | @SEC markers |');
output.push('|---:|---|---:|---:|---|---|---|');
for (const row of rows.filter(row => row.type === 'js').sort((a,b) => a.order - b.order)) {
  output.push(`| ${row.order} | \`${row.file}\` | ${row.bytes} | ${row.lines} | ${row.owner} | ${escapePipe(row.originalAttributes || '—')} | ${escapePipe(row.sectionMarkers.map(x => x.text).join(', ') || '—')} |`);
}
output.push('');

output.push('## Extracted CSS ownership inventory', '');
output.push('| Order | File | Bytes | Lines | Suggested owner | Original marker/id | @SEC markers |');
output.push('|---:|---|---:|---:|---|---|---|');
for (const row of rows.filter(row => row.type === 'css').sort((a,b) => a.order - b.order)) {
  output.push(`| ${row.order} | \`${row.file}\` | ${row.bytes} | ${row.lines} | ${row.owner} | ${escapePipe(row.originalAttributes || '—')} | ${escapePipe(row.sectionMarkers.map(x => x.text).join(', ') || '—')} |`);
}
output.push('');

output.push('## Phase 2 rules derived from this map', '');
output.push('- Preserve current document/script order until an explicit module boundary has regression proof.');
output.push('- Do not merge unrelated patch fragments merely because their suggested owner matches.');
output.push('- Split the two core assets only at verified section boundaries; inspect cross-boundary globals before each move.');
output.push('- Keep current public/global function names and DOM/CSS hooks until all callers have migrated.');
output.push('- Run the full applicable smoke/regression gate after every material domain slice.');
output.push('- The target is semantic ownership with a small number of durable files, not one file per historic hotfix.');
output.push('');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${output.join('\n')}\n`, 'utf8');
console.log(`SC-031 ownership map written: ${path.relative(root, outPath)}`);

function inspect(entry) {
  const abs = path.join(root, entry.file);
  const body = fs.readFileSync(abs, 'utf8');
  const lines = body.split(/\r?\n/);
  const sectionMarkers = [];
  const anchors = [];

  const secRegex = /@SEC:[A-Z0-9:_-]+/g;
  const anchorPatterns = [
    /\bfunction\s+show\s*\(/,
    /\bfunction\s+save\s*\(/,
    /\bfunction\s+buildPad\s*\(/,
    /\bfunction\s+recordThrow\s*\(/,
    /\bfunction\s+advance\s*\(/,
    /\bfunction\s+renderGame\s*\(/,
    /\bfunction\s+startGame\s*\(/,
    /\bfunction\s+openPlayerProfile\s*\(/,
    /\bwindow\.sqDmd(?:Show|SetIdle|Stop|ShowZones|SetPlayerMeta)\b/,
    /\bconst\s+SB\b|\blet\s+SB\b|\bvar\s+SB\b/,
    /\bcreateClient\s*\(/,
    /\bTABLE_GAMES\b/,
    /\bTABLE_MATCHES\b/
  ];

  lines.forEach((line, idx) => {
    const matches = line.match(secRegex) || [];
    for (const text of matches) {
      if (!sectionMarkers.some(existing => existing.text === text && existing.line === idx + 1)) {
        sectionMarkers.push({ line: idx + 1, text });
      }
    }
    if (entry.type === 'js') {
      for (const pattern of anchorPatterns) {
        if (pattern.test(line)) {
          anchors.push({ line: idx + 1, text: line.trim().slice(0, 180) });
          break;
        }
      }
    }
  });

  return {
    ...entry,
    bytes: Buffer.byteLength(body),
    lines: lines.length,
    sectionMarkers,
    anchors: dedupeAnchors(anchors),
    owner: suggestOwner(entry, body)
  };
}

function suggestOwner(entry, body) {
  const haystack = `${entry.originalAttributes || ''}\n${entry.file}\n${body.slice(0, 8000)}`.toLowerCase();
  const tests = [
    ['live-game', /(live[-_ ]?game|livev2|throwpad|dmd|dot matrix|race[-_ ]?chart|game[-_ ]?race|b3|padfx|missx3|turbo[-_ ]?(timer|race|hs)|gameplay[-_ ]?perf)/],
    ['tournament', /(tournament|decider)/],
    ['player-stats', /(player[-_ ]?stats|progression|achievement|trophy|misfire|target[-_ ]?(hit|points)|xp[-_ ]?reactor)/],
    ['league', /(league|rankings|top50|top 50|power[-_ ]?rank|premier[-_ ]?league|high[-_ ]?score|streak[-_ ]?league)/],
    ['practice', /practice/],
    ['setup', /(player[-_ ]?select|match[-_ ]?card|setup|guest)/],
    ['ui', /(modal|menu|home|navigation|viewport|splash|toast)/],
    ['app-core', /(@sec:js:(util|state|cloud|ui:router|boot)|@sec:css:tokens)/]
  ];
  for (const [owner, pattern] of tests) if (pattern.test(haystack)) return owner;
  return 'review-required';
}

function dedupeAnchors(anchors) {
  const seen = new Set();
  return anchors.filter(anchor => {
    const key = `${anchor.line}:${anchor.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapePipe(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
