import fs from 'node:fs';
import assert from 'node:assert/strict';

const avatarJs = fs.readFileSync('src/features/player-avatars.js','utf8');
const avatarCss = fs.readFileSync('src/styles/player-avatars.css','utf8');
const util = fs.readFileSync('src/app/util.js','utf8');
const router = fs.readFileSync('src/app/router-ui.js','utf8');
const hub = fs.readFileSync('src/legacy/scripts/inline-008.js','utf8');
const postgame = fs.readFileSync('src/live-game/postgame-flow.mjs','utf8');
const modal = fs.readFileSync('src/ui/modals/setup/add-player-modal.html','utf8');
const template = fs.readFileSync('src/shell/index.template.html','utf8');
const migration = fs.readFileSync('supabase/migrations/20260920_sc040_player_avatar_key.sql','utf8');

assert.match(avatarJs, /const COUNT = 34;/);
assert.match(avatarJs, /assets\/player-avatars\/avatars\.webp/);
assert.match(avatarJs, /assets\/player-avatars\/celebrations\.webp/);
assert.match(avatarJs, /__sqMountAvatarPicker/);
assert.match(avatarJs, /__sqApplyWinnerCelebration/);
assert.match(avatarCss, /grid-template-columns:repeat\(5/);
assert.match(modal, /id="newPlayerAvatarPicker"/);
assert.match(template, /sq-player-avatars-css/);
assert.match(template, /sq-player-avatars-js/);

assert.match(util, /payload\.avatar_key/);
assert.match(util, /avatar_key, created_at, deleted_at/);
assert.match(router, /avatar_key: chosenAvatarKey/);
assert.match(router, /avatar_key: meta\.avatar_key/);
assert.match(router, /avatar_key: p\.avatar_key/);
assert.match(router, /sq-avatar-live/);
assert.match(hub, /avatar_key: avatarKey/);
assert.match(hub, /Change player avatar/);
assert.match(postgame, /__sqApplyWinnerCelebration\(modal, player\.avatar_key\)/);
assert.match(migration, /add column if not exists avatar_key text/);

const avatarBytes = fs.statSync('assets/player-avatars/avatars.webp').size;
const celebrationBytes = fs.statSync('assets/player-avatars/celebrations.webp').size;
assert.ok(avatarBytes > 20000 && avatarBytes < 200000, `avatar sprite size unexpected: ${avatarBytes}`);
assert.ok(celebrationBytes > 100000 && celebrationBytes < 600000, `celebration sprite size unexpected: ${celebrationBytes}`);

console.log('SC-040 avatar-system static checks PASS', { avatarBytes, celebrationBytes, count:34 });
