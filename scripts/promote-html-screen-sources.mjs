import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function promoteHtmlScreenSources({ root = process.cwd() } = {}) {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error('SC-031 HTML source promotion requires index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  const screenBoundaries = {
    homeStart: '    <!-- PAGE 1: GAME DETAILS -->',
    setupStart: '<!-- PAGE 2: PLAYER SELECT -->',
    gameStart: '   <!--PAGE3: GAME -->',
    leaderboardStart: '<section id="leaderboard" class="card section hidden">',
    wrapEnd: '  </div><!-- /.wrap -->'
  };

  const modalBoundaries = {
    addPlayerStart: '    <!-- Add Player Modal -->',
    selectPlayerStart: '<!-- Select Player Modal -->',
    startGameStart: '<!-- Start Game Modal (Home > START GAME >) -->',
    matchLengthStart: '<!-- Match Length Modal (Players > Start Match) -->',
    adminHubStart: '<!-- Admin Hub Modal -->'
  };

  for (const [name, marker] of Object.entries({ ...screenBoundaries, ...modalBoundaries })) {
    assertUnique(html, marker, name);
  }

  const homeStart = html.indexOf(screenBoundaries.homeStart);
  const setupStart = html.indexOf(screenBoundaries.setupStart);
  const gameStart = html.indexOf(screenBoundaries.gameStart);
  const leaderboardStart = html.indexOf(screenBoundaries.leaderboardStart);
  const wrapEnd = html.indexOf(screenBoundaries.wrapEnd);
  if (!(homeStart < setupStart && setupStart < gameStart && gameStart < leaderboardStart && leaderboardStart < wrapEnd)) {
    throw new Error(`SC-031 HTML boundary order invalid: home=${homeStart}, setup=${setupStart}, game=${gameStart}, leaderboard=${leaderboardStart}, wrap=${wrapEnd}`);
  }

  const addPlayerStart = html.indexOf(modalBoundaries.addPlayerStart);
  const selectPlayerStart = html.indexOf(modalBoundaries.selectPlayerStart);
  const startGameStart = html.indexOf(modalBoundaries.startGameStart);
  const matchLengthStart = html.indexOf(modalBoundaries.matchLengthStart);
  const adminHubStart = html.indexOf(modalBoundaries.adminHubStart);
  if (!(wrapEnd < addPlayerStart && addPlayerStart < selectPlayerStart && selectPlayerStart < startGameStart && startGameStart < matchLengthStart && matchLengthStart < adminHubStart)) {
    throw new Error(`SC-031 setup-modal boundary order invalid: wrap=${wrapEnd}, add=${addPlayerStart}, select=${selectPlayerStart}, startGame=${startGameStart}, matchLength=${matchLengthStart}, admin=${adminHubStart}`);
  }

  const screenSpecs = [
    {
      key: 'home',
      file: 'src/ui/screens/home/home.html',
      start: homeStart,
      end: setupStart,
      rootId: 'details',
      protectedIds: ['details','appTitle','questBtn','tournamentBtn','resumeBtn','latestScoresBtn','playerStatsBtn','leagueRankingsBtn','adminCodeRow','adminCodeBtn','psTickerTop','psTicker']
    },
    {
      key: 'match-setup',
      file: 'src/ui/screens/match-setup/match-setup.html',
      start: setupStart,
      end: gameStart,
      rootId: 'players',
      protectedIds: ['players','msModeLabel','msAddRegisteredBtn','msAddGuestBtn','msRegisterPlayerBtn','msRosterCount','msPlayersList','msMinHint','startMatchBtn','startScreenBtn']
    },
    {
      key: 'leaderboard',
      file: 'src/ui/screens/leaderboard/leaderboard.html',
      start: leaderboardStart,
      end: wrapEnd,
      rootId: 'leaderboard',
      protectedIds: ['leaderboard','leaderboardTopRow','statsHubBtnFinal','settingsBtnLB','lbTable','gameScoresBtn','highScoresMenuBtnLB','nextGameBtn','newMatchBtn']
    }
  ];

  const modalSpecs = [
    {
      key: 'add-player-modal',
      file: 'src/ui/modals/setup/add-player-modal.html',
      start: addPlayerStart,
      end: selectPlayerStart,
      rootId: 'addPlayerModal',
      protectedIds: ['addPlayerModal','npTitle','npCloseBtn','savePlayerBtn']
    },
    {
      key: 'select-player-modal',
      file: 'src/ui/modals/setup/select-player-modal.html',
      start: selectPlayerStart,
      end: startGameStart,
      rootId: 'selectPlayerModal',
      protectedIds: ['selectPlayerModal','confirmSelectPlayerBtn','cancelSelectPlayerBtn']
    },
    {
      key: 'start-game-modal',
      file: 'src/ui/modals/setup/start-game-modal.html',
      start: startGameStart,
      end: matchLengthStart,
      rootId: 'startGameModal',
      protectedIds: ['startGameModal','startGameModalBody','closeStartGameModalBtn']
    },
    {
      key: 'match-length-modal',
      file: 'src/ui/modals/setup/match-length-modal.html',
      start: matchLengthStart,
      end: adminHubStart,
      rootId: 'matchLengthModal',
      protectedIds: ['matchLengthModal','mlHintText','mlFooterBackBtn','mlStartBtn']
    }
  ];

  const screenEntries = writeFragments(html, screenSpecs, root);
  const modalEntries = writeFragments(html, modalSpecs, root);
  const homeSetupEntries = screenEntries.filter(entry => entry.key === 'home' || entry.key === 'match-setup');
  const leaderboardEntries = screenEntries.filter(entry => entry.key === 'leaderboard');
  const homeSetupSlice = html.slice(homeStart, gameStart);
  const leaderboardSlice = html.slice(leaderboardStart, wrapEnd);

  verifyExactReconstruction({
    root,
    entries: homeSetupEntries,
    expected: homeSetupSlice,
    label: 'Home + Match Setup'
  });

  verifyExactReconstruction({
    root,
    entries: leaderboardEntries,
    expected: leaderboardSlice,
    label: 'Leaderboard'
  });

  verifyExactReconstruction({
    root,
    entries: modalEntries,
    expected: html.slice(addPlayerStart, adminHubStart),
    label: 'setup modal bank'
  });

  assertNoCrossFragmentDuplicateIds(screenEntries, 'screen');
  assertNoCrossFragmentDuplicateIds(modalEntries, 'setup modal');

  const screenManifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/promote-html-screen-sources.mjs',
    stage: 'source-promotion-only',
    runtimeChanged: false,
    indexChanged: false,
    protectedNextBoundary: screenBoundaries.gameStart,
    combinedBytes: Buffer.byteLength(homeSetupSlice),
    combinedSha256: sha256(homeSetupSlice),
    additionalSlices: [
      {
        key: 'leaderboard',
        protectedPreviousBoundary: screenBoundaries.leaderboardStart,
        protectedNextBoundary: screenBoundaries.wrapEnd,
        bytes: Buffer.byteLength(leaderboardSlice),
        sha256: sha256(leaderboardSlice)
      }
    ],
    fragments: screenEntries
  };
  writeJson(path.join(root, 'src', 'ui', 'screens', 'html-source-manifest.json'), screenManifest);

  const modalSlice = html.slice(addPlayerStart, adminHubStart);
  const modalManifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/promote-html-screen-sources.mjs',
    stage: 'source-promotion-only',
    runtimeChanged: false,
    indexChanged: false,
    protectedPreviousBoundary: modalBoundaries.addPlayerStart,
    protectedNextBoundary: modalBoundaries.adminHubStart,
    combinedBytes: Buffer.byteLength(modalSlice),
    combinedSha256: sha256(modalSlice),
    fragments: modalEntries
  };
  writeJson(path.join(root, 'src', 'ui', 'modals', 'setup', 'html-source-manifest.json'), modalManifest);

  console.log(`SC-031 HTML source promotion PASS: ${screenEntries.length} screen fragments + ${modalEntries.length} setup modal fragments`);
  return { screens: screenManifest, setupModals: modalManifest };
}

function writeFragments(html, specs, root) {
  return specs.map(spec => {
    const body = html.slice(spec.start, spec.end);
    if (!body) throw new Error(`Empty HTML source fragment: ${spec.file}`);
    if (/<script\b|<link\b/i.test(body)) throw new Error(`Loader markup crossed into ${spec.file}`);

    const allIds = extractIds(body);
    const duplicateIds = duplicates(allIds);
    if (duplicateIds.length) throw new Error(`Duplicate id(s) inside ${spec.file}: ${duplicateIds.join(', ')}`);

    for (const id of spec.protectedIds) {
      const occurrences = allIds.filter(value => value === id).length;
      if (occurrences !== 1) throw new Error(`Protected id ${id} occurs ${occurrences} times in ${spec.file}`);
    }
    if (!allIds.includes(spec.rootId)) throw new Error(`Root id ${spec.rootId} missing from ${spec.file}`);

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
      ids: allIds,
      startOffset: spec.start,
      endOffset: spec.end
    };
  });
}

function verifyExactReconstruction({ root, entries, expected, label }) {
  const combined = entries.map(entry => fs.readFileSync(path.join(root, entry.file), 'utf8')).join('');
  if (combined !== expected) throw new Error(`${label} fragments do not reconstruct their protected source slice exactly`);
}

function assertNoCrossFragmentDuplicateIds(entries, label) {
  const owners = new Map();
  for (const entry of entries) {
    for (const id of entry.ids) {
      if (owners.has(id)) {
        throw new Error(`${label} id ${id} is duplicated across ${owners.get(id)} and ${entry.file}`);
      }
      owners.set(id, entry.file);
    }
  }
}

function assertUnique(body, marker, name) {
  const first = body.indexOf(marker);
  const last = body.lastIndexOf(marker);
  if (first < 0 || first !== last) throw new Error(`SC-031 HTML marker ${name} must occur exactly once`);
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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  promoteHtmlScreenSources();
}
