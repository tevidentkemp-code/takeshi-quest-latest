import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) fail('SC-031 admin HTML source promotion requires index.html');

const html = fs.readFileSync(indexPath, 'utf8');

const markers = {
  adminHubStart: '<!-- Admin Hub Modal -->',
  dataAdminStart: '<!-- Data Modal -->',
  dataChartStart: '<!-- Data Chart Modal -->',
  allGamesStart: '<!-- All Games Modal -->',
  leagueLowsStart: '<!-- League Low Scores Admin Modal -->',
  savedPlayersStart: '    <!-- Saved Players Admin Modal -->',
  cloudStatusStart: '    <!-- Cloud Status -->',
  pbgrStart: '<!-- PB / GR Admin Modal -->',
  postPbgrScriptStart: '<script src="./src/legacy/scripts/inline-006.js"></script>'
};

for (const [name, marker] of Object.entries(markers)) assertUnique(html, marker, name);

const offsets = Object.fromEntries(
  Object.entries(markers).map(([name, marker]) => [name, html.indexOf(marker)])
);

const ordered = [
  'adminHubStart',
  'dataAdminStart',
  'dataChartStart',
  'allGamesStart',
  'leagueLowsStart',
  'savedPlayersStart',
  'cloudStatusStart',
  'pbgrStart',
  'postPbgrScriptStart'
];
for (let i = 1; i < ordered.length; i += 1) {
  const prev = ordered[i - 1];
  const current = ordered[i];
  assert(offsets[prev] < offsets[current], `Admin HTML boundary order invalid: ${prev}=${offsets[prev]}, ${current}=${offsets[current]}`);
}

const specs = [
  {
    key: 'admin-hub',
    file: 'src/ui/modals/admin/admin-hub.html',
    start: offsets.adminHubStart,
    end: offsets.dataAdminStart,
    rootId: 'adminHubModal',
    protectedIds: [
      'adminHubModal','closeAdminHubBtnX','openAllGamesBtn','openAllScoresBtn','openHsLeagueAdmin',
      'openHsPracticeAdmin','openLeagueLowsAdmin','openSavedPlayersAdminBtn','openPBGRAdminBtn',
      'openDataAdminBtn','fixDuplicatesBtn'
    ]
  },
  {
    key: 'data-admin',
    file: 'src/ui/modals/admin/data-admin.html',
    start: offsets.dataAdminStart,
    end: offsets.dataChartStart,
    rootId: 'dataAdminModal',
    protectedIds: [
      'dataAdminModal','dataPlayersCount','dataNewPlayers7','dataDailyGamesBtn','dataUniqueLogonsBtn',
      'dataAdminBackBtn','dataAdminCloseBtn'
    ]
  },
  {
    key: 'data-chart',
    file: 'src/ui/modals/admin/data-chart.html',
    start: offsets.dataChartStart,
    end: offsets.allGamesStart,
    rootId: 'dataChartModal',
    protectedIds: [
      'dataChartModal','dataChartTitle','dataChartRangeDaily','dataChartRangeWeekly','dataChartRangeMonthly',
      'dataChartRangeYearly','dataChartCanvas','dataChartHint','dataChartBackBtn','dataChartCloseBtn'
    ]
  },
  {
    key: 'all-games',
    file: 'src/ui/modals/admin/all-games.html',
    start: offsets.allGamesStart,
    end: offsets.leagueLowsStart,
    rootId: 'allGamesModal',
    protectedIds: ['allGamesModal','allGamesBody','allGamesTableWrap','allGamesBackBtn','allGamesCloseBtn']
  },
  {
    key: 'league-low-scores',
    file: 'src/ui/modals/admin/league-low-scores.html',
    start: offsets.leagueLowsStart,
    end: offsets.savedPlayersStart,
    rootId: 'leagueLowsAdminModal',
    protectedIds: ['leagueLowsAdminModal','leagueLowsAdminBody','leagueLowsBackBtn','leagueLowsCloseBtn']
  },
  {
    key: 'saved-players-admin',
    file: 'src/ui/modals/admin/saved-players-admin.html',
    start: offsets.savedPlayersStart,
    end: offsets.cloudStatusStart,
    rootId: 'savedPlayersAdminModal',
    protectedIds: ['savedPlayersAdminModal','savedPlayersAdminBody','backSavedPlayersAdminBtn','closeSavedPlayersAdminBtn']
  },
  {
    key: 'pbgr-admin',
    file: 'src/ui/modals/admin/pbgr-admin.html',
    start: offsets.pbgrStart,
    end: offsets.postPbgrScriptStart,
    rootId: 'pbgrAdminModal',
    protectedIds: [
      'pbgrAdminModal','pbgrTitle','pbgrGlobal','pbgrPlayerSelect','pbgrBackfillRow','pbgrBackfillBtn',
      'pbgrPlayer','pbgrBackBtn','pbgrRefreshBtn','pbgrCloseBtn'
    ]
  }
];

const entries = writeFragments(specs);
const beforeServiceEntries = entries.filter(entry => entry.key !== 'pbgr-admin');
const pbgrEntries = entries.filter(entry => entry.key === 'pbgr-admin');
const preServiceSlice = html.slice(offsets.adminHubStart, offsets.cloudStatusStart);
const pbgrSlice = html.slice(offsets.pbgrStart, offsets.postPbgrScriptStart);
const serviceGap = html.slice(offsets.cloudStatusStart, offsets.pbgrStart);

verifyExactReconstruction(beforeServiceEntries, preServiceSlice, 'admin/data modal region before service gap');
verifyExactReconstruction(pbgrEntries, pbgrSlice, 'PB/GR admin modal');
assertNoCrossFragmentDuplicateIds(entries, 'admin/data modal');

assert(serviceGap.startsWith(markers.cloudStatusStart), 'Service gap must begin at Cloud Status marker');
assert(serviceGap.includes('id="cloudStatus"'), 'Service gap must retain #cloudStatus');
assert(serviceGap.includes('id="cloudStatusText"'), 'Service gap must retain #cloudStatusText');
assert(serviceGap.includes('<script src="./src/legacy/scripts/inline-005.js"></script>'), 'Service gap must retain core compatibility script inline-005.js');
assert(!serviceGap.includes('id="pbgrAdminModal"'), 'Service gap must not consume PB/GR admin modal');

const manifest = {
  schemaVersion: 1,
  generatedBy: 'scripts/promote-admin-modal-sources.mjs',
  stage: 'source-promotion-only',
  runtimeChanged: false,
  indexChanged: false,
  protectedPreviousBoundary: markers.adminHubStart,
  protectedServiceBoundary: markers.cloudStatusStart,
  protectedResumeBoundary: markers.pbgrStart,
  protectedNextBoundary: markers.postPbgrScriptStart,
  serviceGapRetainedInShell: true,
  serviceGap: {
    bytes: Buffer.byteLength(serviceGap),
    sha256: sha256(serviceGap),
    protectedIds: ['cloudStatus','cloudStatusText'],
    protectedRuntimeRef: './src/legacy/scripts/inline-005.js'
  },
  slices: [
    {
      key: 'pre-service-admin-region',
      bytes: Buffer.byteLength(preServiceSlice),
      sha256: sha256(preServiceSlice)
    },
    {
      key: 'pbgr-admin',
      bytes: Buffer.byteLength(pbgrSlice),
      sha256: sha256(pbgrSlice)
    }
  ],
  fragments: entries
};

writeJson(path.join(root, 'src', 'ui', 'modals', 'admin', 'html-source-manifest.json'), manifest);
console.log(`SC-031 admin HTML source promotion PASS: ${entries.length} exact modal fragments; Cloud Status/service gap retained in shell`);

function writeFragments(specList) {
  return specList.map(spec => {
    const body = html.slice(spec.start, spec.end);
    assert(body, `Empty admin HTML source fragment: ${spec.file}`);
    assert(!/<script\b|<link\b/i.test(body), `Loader markup crossed into ${spec.file}`);

    const ids = extractIds(body);
    const duplicateIds = duplicates(ids);
    assert(duplicateIds.length === 0, `Duplicate id(s) inside ${spec.file}: ${duplicateIds.join(', ')}`);
    assert(ids.includes(spec.rootId), `Root id ${spec.rootId} missing from ${spec.file}`);
    for (const id of spec.protectedIds) {
      const count = ids.filter(value => value === id).length;
      assert(count === 1, `Protected id ${id} occurs ${count} times in ${spec.file}`);
    }

    const outPath = path.join(root, spec.file);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, body, 'utf8');
    return {
      key: spec.key,
      file: spec.file,
      rootId: spec.rootId,
      bytes: Buffer.byteLength(body),
      sha256: sha256(body),
      protectedIds: spec.protectedIds,
      ids,
      startOffset: spec.start,
      endOffset: spec.end
    };
  });
}

function verifyExactReconstruction(fragmentEntries, expected, label) {
  const combined = fragmentEntries
    .map(entry => fs.readFileSync(path.join(root, entry.file), 'utf8'))
    .join('');
  assert(combined === expected, `${label} fragments do not reconstruct their protected source slice exactly`);
}

function assertNoCrossFragmentDuplicateIds(fragmentEntries, label) {
  const owners = new Map();
  for (const entry of fragmentEntries) {
    for (const id of entry.ids) {
      assert(!owners.has(id), `${label} id ${id} is duplicated across ${owners.get(id)} and ${entry.file}`);
      owners.set(id, entry.file);
    }
  }
}

function assertUnique(body, marker, name) {
  const first = body.indexOf(marker);
  const last = body.lastIndexOf(marker);
  assert(first >= 0 && first === last, `SC-031 admin HTML marker ${name} must occur exactly once`);
}

function extractIds(body) {
  const ids = [];
  const pattern = /\bid=["']([^"']+)["']/g;
  for (const match of body.matchAll(pattern)) ids.push(match[1]);
  return ids;
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

function writeJson(outPath, value) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`SC-031 admin HTML source promotion FAIL: ${message}`);
  process.exit(1);
}
