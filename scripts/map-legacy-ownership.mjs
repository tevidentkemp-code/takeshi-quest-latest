import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'legacy', 'migration-manifest.json');
const outPath = path.join(root, 'docs', 'architecture', 'CORE_SECTION_MAP.md');
const standaloneJsOutPath = path.join(root, 'src', 'legacy', 'standalone-js-ownership.json');
const CORE_JS_FILE = 'src/legacy/scripts/inline-005.js';

if (!fs.existsSync(manifestPath)) {
  throw new Error('SC-031 ownership map requires src/legacy/migration-manifest.json');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allEntries = [
  ...manifest.styles.map(entry => ({ ...entry, type: 'css' })),
  ...manifest.scripts.map(entry => ({ ...entry, type: 'js' }))
];

const rows = allEntries.map(entry => inspect(entry));
const coreJs = rows.find(row => row.file === CORE_JS_FILE);
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
writeStandaloneJsOwnership(rows);
console.log(`SC-031 ownership map written: ${path.relative(root, outPath)}`);
console.log(`SC-031 standalone JS ownership evidence written: ${path.relative(root, standaloneJsOutPath)}`);

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
    owner: suggestOwner(entry, body),
    body
  };
}

function writeStandaloneJsOwnership(allRows) {
  const jsRows = allRows.filter(row => row.type === 'js');
  const standalone = jsRows.filter(row => row.file !== CORE_JS_FILE);
  const analyses = standalone.map(row => analyseStandaloneScript(row));

  const providers = new Map();
  for (const item of analyses) {
    for (const symbol of item.windowExports) {
      if (!providers.has(symbol)) providers.set(symbol, []);
      providers.get(symbol).push(item.file);
    }
  }

  for (const item of analyses) {
    item.crossScriptWindowDependencies = item.windowReferences
      .filter(symbol => !item.windowExports.includes(symbol) && providers.has(symbol))
      .map(symbol => ({ symbol, providers: providers.get(symbol) }))
      .sort((a,b) => a.symbol.localeCompare(b.symbol));
    item.risk = classifyMigrationRisk(item);
  }

  const ownerTotals = {};
  for (const item of analyses) {
    const key = item.suggestedOwner;
    ownerTotals[key] ||= { files: 0, bytes: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 };
    ownerTotals[key].files += 1;
    ownerTotals[key].bytes += item.bytes;
    ownerTotals[key][`${item.risk.level}Risk`] += 1;
  }

  const artifact = {
    schemaVersion: 1,
    generatedBy: 'scripts/map-legacy-ownership.mjs',
    stage: 'analysis-only',
    runtimeChanged: false,
    sourceManifestSchema: manifest.schemaVersion,
    coreScriptExcluded: CORE_JS_FILE,
    standaloneScriptCount: analyses.length,
    analysisNotes: [
      'This is static migration evidence, not product authority.',
      'Risk/confidence is conservative and heuristic; no file may move solely because this manifest says low risk.',
      'Public/global names and current script order remain protected until a separate migration slice proves parity.',
      'Database/Supabase touches always require live schema/data-path verification before code movement that could alter behavior.'
    ],
    ownerTotals,
    scripts: analyses.map(stripAnalysisInternals)
  };

  fs.mkdirSync(path.dirname(standaloneJsOutPath), { recursive: true });
  fs.writeFileSync(standaloneJsOutPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
}

function analyseStandaloneScript(row) {
  const body = row.body;
  const windowExports = uniqueMatches(body, /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g);
  const windowReferences = uniqueMatches(body, /\bwindow\.([A-Za-z_$][\w$]*)\b/g);
  const declaredFunctions = uniqueMatches(body, /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g);
  const declaredClasses = uniqueMatches(body, /\bclass\s+([A-Za-z_$][\w$]*)\b/g);
  const lexicalDeclarations = uniqueMatches(body, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g);
  const tableSymbols = uniqueMatches(body, /\b(TABLE_[A-Z0-9_]+)\b/g);
  const supabaseRelations = uniqueMatches(body, /\.from\(\s*['"]([^'"]+)['"]\s*\)/g);
  const domIds = uniqueMatches(body, /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g);
  const knownRuntimeAnchors = [
    'show','save','buildPad','recordThrow','advance','renderGame','startGame',
    'openPlayerStatsDialog','openLeagueRankingsDialog','openHighScoreLeagueDialog',
    'computeMatchAverages','setCloudStatus','sqDmdShowZones','sqDmdShow','TABLE_GAMES','TABLE_MATCHES'
  ].filter(name => new RegExp(`\\b${escapeRegex(name)}\\b`).test(body));

  const eventListenerCount = countMatches(body, /\.addEventListener\s*\(/g);
  const intervalCount = countMatches(body, /\bsetInterval\s*\(/g);
  const timeoutCount = countMatches(body, /\bsetTimeout\s*\(/g);
  const mutationObserverCount = countMatches(body, /\bMutationObserver\b/g);
  const querySelectorCount = countMatches(body, /\bquerySelector(?:All)?\s*\(/g);
  const storageTouches = countMatches(body, /\b(?:localStorage|sessionStorage)\b/g);
  const networkTouches = countMatches(body, /\b(?:fetch|XMLHttpRequest)\s*\(/g);
  const supabaseTouches = countMatches(body, /\b(?:sb|SB|supabase)\b|\.from\s*\(/g);
  const iifeCount = countMatches(body, /\(\s*function\b|\(\s*\(.*?\)\s*=>/g);

  return {
    order: row.order,
    file: row.file,
    bytes: row.bytes,
    lines: row.lines,
    sha256: sha256(body),
    originalAttributes: row.originalAttributes || '',
    suggestedOwner: row.owner,
    sectionMarkers: row.sectionMarkers.map(marker => marker.text),
    declaredFunctions,
    declaredClasses,
    lexicalDeclarationsSample: lexicalDeclarations.slice(0, 50),
    windowExports,
    windowReferences,
    crossScriptWindowDependencies: [],
    tableSymbols,
    supabaseRelations,
    domIdsSample: domIds.slice(0, 40),
    knownRuntimeAnchors,
    signals: {
      eventListenerCount,
      intervalCount,
      timeoutCount,
      mutationObserverCount,
      querySelectorCount,
      storageTouches,
      networkTouches,
      supabaseTouches,
      iifeCount,
      documentReadyReference: /\bDOMContentLoaded\b/.test(body),
      directDocumentWrite: /\bdocument\.write\s*\(/.test(body),
      topLevelPatchMarker: /PATCH:|FIX\d+|sq-fix/i.test(`${row.originalAttributes}\n${body.slice(0, 1200)}`)
    },
    risk: null
  };
}

function classifyMigrationRisk(item) {
  const reasons = [];
  let score = 0;

  if (item.signals.supabaseTouches > 0 || item.supabaseRelations.length || item.tableSymbols.length) {
    score += 5;
    reasons.push('database/Supabase coupling');
  }
  if (item.knownRuntimeAnchors.some(name => ['recordThrow','buildPad','advance','renderGame','startGame','TABLE_GAMES','TABLE_MATCHES'].includes(name))) {
    score += 4;
    reasons.push('game/runtime anchor coupling');
  }
  if (item.crossScriptWindowDependencies.length) {
    score += Math.min(4, item.crossScriptWindowDependencies.length);
    reasons.push('cross-script window dependency');
  }
  if (item.signals.intervalCount || item.signals.mutationObserverCount) {
    score += 3;
    reasons.push('long-lived timer/observer side effect');
  }
  if (item.signals.eventListenerCount > 0 || item.signals.timeoutCount > 0) {
    score += 2;
    reasons.push('event/timer side effects');
  }
  if (item.bytes > 50000) {
    score += 3;
    reasons.push('large standalone script');
  } else if (item.bytes > 20000) {
    score += 2;
    reasons.push('medium-large standalone script');
  }
  if (!item.originalAttributes) {
    score += 1;
    reasons.push('no original script id/attribute marker');
  }

  const level = score >= 7 ? 'high' : score >= 3 ? 'medium' : 'low';
  return { level, score, reasons };
}

function stripAnalysisInternals(item) {
  return item;
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

function uniqueMatches(body, regex) {
  const values = [];
  const seen = new Set();
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(body)) !== null) {
    const value = match[1];
    if (value && !seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return values.sort((a,b) => a.localeCompare(b));
}

function countMatches(body, regex) {
  regex.lastIndex = 0;
  let count = 0;
  while (regex.exec(body) !== null) {
    count += 1;
    if (regex.lastIndex === 0) break;
  }
  return count;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
