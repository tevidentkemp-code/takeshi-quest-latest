import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function promoteHtmlScreenSources({ root = process.cwd() } = {}) {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error('SC-031 HTML source promotion requires index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  const boundaries = {
    homeStart: '    <!-- PAGE 1: GAME DETAILS -->',
    setupStart: '<!-- PAGE 2: PLAYER SELECT -->',
    gameStart: '   <!--PAGE3: GAME -->'
  };

  for (const [name, marker] of Object.entries(boundaries)) assertUnique(html, marker, name);

  const homeStart = html.indexOf(boundaries.homeStart);
  const setupStart = html.indexOf(boundaries.setupStart);
  const gameStart = html.indexOf(boundaries.gameStart);
  if (!(homeStart < setupStart && setupStart < gameStart)) {
    throw new Error(`SC-031 HTML boundary order invalid: home=${homeStart}, setup=${setupStart}, game=${gameStart}`);
  }

  const specs = [
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
    }
  ];

  const entries = specs.map(spec => {
    const body = html.slice(spec.start, spec.end);
    if (!body) throw new Error(`Empty HTML source fragment: ${spec.file}`);
    if (/<script\b|<link\b/i.test(body)) throw new Error(`Loader markup crossed into ${spec.file}`);
    for (const id of spec.protectedIds) {
      const occurrences = countId(body, id);
      if (occurrences !== 1) throw new Error(`Protected id ${id} occurs ${occurrences} times in ${spec.file}`);
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
      startOffset: spec.start,
      endOffset: spec.end
    };
  });

  const combined = entries.map(entry => fs.readFileSync(path.join(root, entry.file), 'utf8')).join('');
  const protectedSlice = html.slice(homeStart, gameStart);
  if (combined !== protectedSlice) throw new Error('Home + Match Setup fragments do not reconstruct the protected pre-Game screen slice exactly');

  const manifest = {
    schemaVersion: 1,
    generatedBy: 'scripts/promote-html-screen-sources.mjs',
    stage: 'source-promotion-only',
    runtimeChanged: false,
    indexChanged: false,
    protectedNextBoundary: boundaries.gameStart,
    combinedBytes: Buffer.byteLength(protectedSlice),
    combinedSha256: sha256(protectedSlice),
    fragments: entries
  };
  const manifestPath = path.join(root, 'src', 'ui', 'screens', 'html-source-manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`SC-031 HTML source promotion PASS: ${entries.length} exact fragments / ${manifest.combinedBytes} bytes`);
  return manifest;
}

function assertUnique(body, marker, name) {
  const first = body.indexOf(marker);
  const last = body.lastIndexOf(marker);
  if (first < 0 || first !== last) throw new Error(`SC-031 HTML marker ${name} must occur exactly once`);
}

function countId(body, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (body.match(new RegExp(`\\bid=["']${escaped}["']`, 'g')) || []).length;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
