import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const root = process.cwd();
const manifestPath = path.join(root, 'src', 'styles', 'domain-manifest.json');

const promotions = [
  { order: 13, source: 'src/legacy/styles/inline-013.css', destination: 'src/styles/live-game/classic-stage1.css', owner: 'live-game', sourceId: 'sq-live-classic-stage1-css' },
  { order: 15, source: 'src/legacy/styles/inline-015.css', destination: 'src/styles/tournament/shared.css', owner: 'tournament', sourceId: 'sq-fix85-tournament-shared-styles' },
  { order: 18, source: 'src/legacy/styles/inline-018.css', destination: 'src/styles/tournament/bracket.css', owner: 'tournament', sourceId: 'sq-fix83-tournament-bracket-css' },
  { order: 24, source: 'src/legacy/styles/inline-024.css', destination: 'src/styles/tournament/ui.css', owner: 'tournament', sourceId: 'sq-fix90-tournament-ui-css' },
  { order: 25, source: 'src/legacy/styles/inline-025.css', destination: 'src/styles/live-game/throwpad-missx3.css', owner: 'throwpad', sourceId: 'sq-fix95-missx3-css' },
  { order: 45, source: 'src/legacy/styles/inline-045.css', destination: 'src/styles/tournament/leaderboard-bracket.css', owner: 'tournament', sourceId: 'sq-fix171-leaderboard-bracket-visual-css' },
  { order: 46, source: 'src/legacy/styles/inline-046.css', destination: 'src/styles/tournament/mode-card.css', owner: 'tournament', sourceId: 'sq-fix172-tournament-mode-card-css' },
  { order: 47, source: 'src/legacy/styles/inline-047.css', destination: 'src/styles/home/start-hero.css', owner: 'home-setup', sourceId: 'sq-home-arcade-start-hero-css' },
  { order: 48, source: 'src/legacy/styles/inline-048.css', destination: 'src/styles/modals/game-complete.css', owner: 'modal-ui', sourceId: 'sq-game-complete-arcade-css' },
  { order: 49, source: 'src/legacy/styles/inline-049.css', destination: 'src/styles/training/training.css', owner: 'training', sourceId: 'sq-training-css' }
];

const entries = promotions.map((entry) => {
  const sourcePath = safePath(entry.source, 'src/legacy/styles/');
  const destinationPath = safePath(entry.destination, 'src/styles/');
  if (!fs.existsSync(sourcePath)) fail(`Missing source stylesheet: ${entry.source}`);

  const source = fs.readFileSync(sourcePath);
  postcss.parse(source.toString('utf8'), { from: entry.source });

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.writeFileSync(destinationPath, source);

  const promoted = fs.readFileSync(destinationPath);
  if (!source.equals(promoted)) fail(`Byte mismatch after promotion: ${entry.destination}`);

  return {
    order: entry.order,
    owner: entry.owner,
    sourceId: entry.sourceId,
    source: entry.source,
    destination: entry.destination,
    bytes: source.byteLength,
    sha256: sha256(source)
  };
});

const manifest = {
  schemaVersion: 1,
  generatedBy: 'scripts/promote-css-domains.mjs',
  stage: 'source-ownership-only',
  runtimeChanged: false,
  protectedCascadeOrder: true,
  entries
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`SC-031 CSS domain promotion PASS: ${entries.length} byte-identical semantic source files created; runtime references unchanged.`);

function safePath(relativePath, prefix) {
  if (!relativePath.startsWith(prefix)) fail(`Unexpected path outside ${prefix}: ${relativePath}`);
  const absolute = path.resolve(root, relativePath);
  const allowed = path.resolve(root, prefix);
  if (!absolute.startsWith(`${allowed}${path.sep}`)) fail(`Path escapes ${prefix}: ${relativePath}`);
  return absolute;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fail(message) {
  console.error(`SC-031 CSS domain promotion FAIL: ${message}`);
  process.exit(1);
}
