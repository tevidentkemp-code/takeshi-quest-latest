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
  coreCompatScriptStart: '<script src="./src/legacy/scripts/inline-005.js"></script>',
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
  'coreCompatScriptStart',
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
const cloudStatusSlice = html.slice(offsets.cloudStatusStart, offsets.coreCompatScriptStart);
const coreCompatGap = html.slice(offsets.coreCompatScriptStart, offsets.pbgrStart);

verifyExactReconstruction(beforeServiceEntries, preServiceSlice, 'admin/data modal region before service gap');
verifyExactReconstruction(pbgrEntries, pbgrSlice, 'PB/GR admin modal');
assertNoCrossFragmentDuplicateIds(entries, 'admin/data modal');

assert(serviceGap.startsWith(markers.cloudStatusStart), 'Service gap must begin at Cloud Status marker');
assert(serviceGap.includes('id="cloudStatus"'), 'Service gap must retain #cloudStatus');
assert(serviceGap.includes('id="cloudStatusText"'), 'Service gap must retain #cloudStatusText');
assert(serviceGap.includes(markers.coreCompatScriptStart), 'Service gap must retain core compatibility script inline-005.js');
assert(!serviceGap.includes('id="pbgrAdminModal"'), 'Service gap must not consume PB/GR admin modal');

const statusEntry = writeCloudStatusSource(cloudStatusSlice);
assert(coreCompatGap.startsWith(markers.coreCompatScriptStart), 'Compatibility gap must begin with inline-005.js');
assert(!coreCompatGap.includes('id="cloudStatus"'), 'Compatibility gap must not duplicate #cloudStatus');
assert(!coreCompatGap.includes('id="cloudStatusText"'), 'Compatibility gap must not duplicate #cloudStatusText');
assert(cloudStatusSlice + coreCompatGap === serviceGap, 'Cloud Status source plus compatibility gap must reconstruct the original service gap exactly');

const serviceContract = verifyServiceSourceContract(statusEntry);

const manifest = {
  schemaVersion: 1,
  generatedBy: 'scripts/promote-admin-modal-sources.mjs',
  stage: 'source-promotion-only',
  runtimeChanged: false,
  indexChanged: false,
  protectedPreviousBoundary: markers.adminHubStart,
  protectedServiceBoundary: markers.cloudStatusStart,
  protectedServiceRuntimeBoundary: markers.coreCompatScriptStart,
  protectedResumeBoundary: markers.pbgrStart,
  protectedNextBoundary: markers.postPbgrScriptStart,
  serviceGapRetainedInShell: true,
  serviceGap: {
    bytes: Buffer.byteLength(serviceGap),
    sha256: sha256(serviceGap),
    protectedIds: ['cloudStatus','cloudStatusText'],
    cloudStatusSource: statusEntry.file,
    protectedRuntimeRef: './src/legacy/scripts/inline-005.js',
    compatibilityGapBytes: Buffer.byteLength(coreCompatGap),
    compatibilityGapSha256: sha256(coreCompatGap)
  },
  serviceContract: {
    file: 'src/services/supabase-contract.json',
    schemaVersion: serviceContract.schemaVersion,
    verifiedAt: serviceContract.verifiedAt,
    verificationMode: serviceContract.backend.verificationMode,
    runtimeChanged: false
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
console.log(`SC-031 admin/service source promotion PASS: ${entries.length} exact modal fragments + Cloud Status exact view; compatibility runtime retained`);

function writeCloudStatusSource(body) {
  assert(body, 'Empty Cloud Status source fragment');
  assert(!/<script\b|<link\b/i.test(body), 'Cloud Status view must not contain loader markup');
  const ids = extractIds(body);
  const duplicateIds = duplicates(ids);
  assert(duplicateIds.length === 0, `Duplicate id(s) inside Cloud Status view: ${duplicateIds.join(', ')}`);
  for (const id of ['cloudStatus','cloudStatusText']) {
    const count = ids.filter(value => value === id).length;
    assert(count === 1, `Protected id ${id} occurs ${count} times in Cloud Status view`);
  }

  const file = 'src/ui/status/cloud-status.html';
  const outPath = path.join(root, file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, 'utf8');
  const reread = fs.readFileSync(outPath, 'utf8');
  assert(reread === body, 'Cloud Status view does not reconstruct its protected source slice exactly');

  const entry = {
    key: 'cloud-status',
    file,
    rootId: 'cloudStatus',
    bytes: Buffer.byteLength(body),
    sha256: sha256(body),
    protectedIds: ['cloudStatus','cloudStatusText'],
    ids,
    startOffset: offsets.cloudStatusStart,
    endOffset: offsets.coreCompatScriptStart
  };

  writeJson(path.join(root, 'src', 'ui', 'status', 'html-source-manifest.json'), {
    schemaVersion: 1,
    generatedBy: 'scripts/promote-admin-modal-sources.mjs',
    stage: 'source-promotion-only',
    runtimeChanged: false,
    indexChanged: false,
    protectedPreviousBoundary: markers.cloudStatusStart,
    protectedNextBoundary: markers.coreCompatScriptStart,
    compatibilityRuntimeExcluded: true,
    compatibilityRuntimeRef: './src/legacy/scripts/inline-005.js',
    fragments: [entry]
  });

  return entry;
}

function verifyServiceSourceContract(statusEntry) {
  const contractPath = path.join(root, 'src', 'services', 'supabase-contract.json');
  assert(fs.existsSync(contractPath), 'Missing src/services/supabase-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert(contract.schemaVersion === 1, 'Supabase service contract schemaVersion must be 1');
  assert(contract.backend?.project === 'Shateki-Quest', 'Supabase service contract project mismatch');
  assert(contract.backend?.verificationMode === 'read-only', 'Supabase contract must record read-only verification');
  assert(contract.boundaries?.cloudStatusView === statusEntry.file, 'Cloud Status contract owner mismatch');
  assert(contract.boundaries?.statusOwner === 'src/app/state.js', 'Status owner contract mismatch');
  assert(contract.boundaries?.supabaseOwner === 'src/services/cloud.js', 'Supabase owner contract mismatch');
  assert(contract.boundaries?.constantsOwner === 'src/app/util.js', 'Supabase constants owner contract mismatch');
  assert(contract.boundaries?.compatibilityRuntime === 'src/legacy/scripts/inline-005.js', 'Compatibility runtime contract mismatch');

  const expectedBindings = {
    TABLE_GAMES: 'games',
    TABLE_MATCHES: 'matches',
    TABLE_PLAYER_GAMES: 'v_player_games_union_visible',
    TABLE_HS_LEAGUE: 'high_scores_sp',
    TABLE_HS_PRACTICE: 'high_scores',
    TABLE_PB_ROUNDS_CLEAN_APP: 'v_pb_by_player_round_clean_app',
    TABLE_WR_ROUNDS_CLEAN_APP: 'v_wr_by_round_clean_app'
  };
  for (const [key, value] of Object.entries(expectedBindings)) {
    assert(contract.activeBindings?.[key] === value, `Supabase active binding mismatch for ${key}`);
  }
  assert(contract.legacyOnly?.LEGACY_TABLE_PLAYER_GAMES === 'player_games_union', 'Legacy player-games binding mismatch');

  const stateSource = readRequired('src/app/state.js');
  const cloudSource = readRequired('src/services/cloud.js');
  const utilSource = readRequired('src/app/util.js');
  const statusSource = readRequired(statusEntry.file);

  assert(stateSource.includes("const cloudStatusEl     = byId('cloudStatus');"), 'state.js must own #cloudStatus reference');
  assert(stateSource.includes("const cloudStatusTextEl = byId('cloudStatusText');"), 'state.js must own #cloudStatusText reference');
  assert(stateSource.includes('function setCloudStatus(mode, text)'), 'state.js must own setCloudStatus');
  assert(cloudSource.includes('function ensureCloudInit()'), 'services/cloud.js must own ensureCloudInit');
  assert(cloudSource.includes('window.SQ_CLOUD_CONTRACT'), 'services/cloud.js must retain cloud contract probe');
  assert(statusSource.includes('id="cloudStatus"') && statusSource.includes('id="cloudStatusText"'), 'Cloud Status source IDs missing');
  assert(!/<script\b|<link\b/i.test(statusSource), 'Cloud Status source must remain presentation-only');

  const constantPatterns = {
    TABLE_GAMES: /const\s+TABLE_GAMES\s*=\s*["']games["'];/,
    TABLE_MATCHES: /const\s+TABLE_MATCHES\s*=\s*["']matches["'];/,
    TABLE_PLAYER_GAMES: /const\s+TABLE_PLAYER_GAMES\s*=\s*["']v_player_games_union_visible["'];/,
    LEGACY_TABLE_PLAYER_GAMES: /const\s+LEGACY_TABLE_PLAYER_GAMES\s*=\s*["']player_games_union["'];/,
    TABLE_HS_LEAGUE: /const\s+TABLE_HS_LEAGUE\s*=\s*["']high_scores_sp["'];/,
    TABLE_HS_PRACTICE: /const\s+TABLE_HS_PRACTICE\s*=\s*["']high_scores["'];/,
    TABLE_PB_ROUNDS_CLEAN_APP: /const\s+TABLE_PB_ROUNDS_CLEAN_APP\s*=\s*["']v_pb_by_player_round_clean_app["'];/,
    TABLE_WR_ROUNDS_CLEAN_APP: /const\s+TABLE_WR_ROUNDS_CLEAN_APP\s*=\s*["']v_wr_by_round_clean_app["'];/
  };
  for (const [name, pattern] of Object.entries(constantPatterns)) {
    assert(pattern.test(utilSource), `Current source binding missing for ${name}`);
  }

  const liveNames = new Set((contract.liveObjects || []).map(item => item.name));
  for (const name of [
    'games','matches','players','high_scores','high_scores_sp','v_player_games_union_visible',
    'v_pb_by_player_round_clean_app','v_wr_by_round_clean_app','v_round_high_scores_modal',
    'v_top50_scores_official','v_power_rankings_last56_official_clean'
  ]) {
    assert(liveNames.has(name), `Verified live Supabase object missing from contract: ${name}`);
  }
  assert((contract.routines || []).includes('sq_rank_score'), 'Verified sq_rank_score routine missing from contract');
  return contract;
}

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

function readRequired(relativePath) {
  const fullPath = path.join(root, relativePath);
  assert(fs.existsSync(fullPath), `Missing required source: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
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
  console.error(`SC-031 admin/service source promotion FAIL: ${message}`);
  process.exit(1);
}
