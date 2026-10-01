import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

const modals = read('src/ui/modals.js');
const xp = read('src/live-game/xp-breakdown.mjs');
const migration = read('supabase/migrations/20261001213000_sc059_bounce_out_misfire.sql');
const rollback = read('supabase/rollbacks/sc059_bounce_out_misfire.sql');

assert.match(modals, /code:'bounce_out'.*name:'Bounce Out'.*penalty:-1/s, 'Player Stats Misfire catalogue must include Bounce Out at -1 XP');
assert.match(xp, /bounce_out:\s*\{\s*name:\s*'Bounce Out',\s*penalty:\s*-1\s*\}/, 'NEGATIVE XP metadata must include Bounce Out at -1 XP');
assert.match(xp, /dart\.bounceOut\s*===\s*true/, 'Current-game Bounce Out detection must require the explicit bounceOut marker');
assert.match(xp, /addCountedNormal\('bounce_out',\s*bounceOutCount\(rows\)\)/, 'Bounce Out must use the normal Misfire lane');
assert.doesNotMatch(xp, /addVolde\('bounce_out'/, 'Bounce Out must never use the stacking Volde lane');

assert.match(migration, /from public\.v_games_official_clean/, 'Historical Bounce Out backfill must use the clean Official\/Classic source');
assert.match(migration, /dart->>'bounceOut'/, 'Historical backfill must use the explicit saved bounceOut marker');
assert.match(migration, /'bounce_out'::text as code/, 'Historical helper must emit the canonical bounce_out code');
assert.match(migration, /\(-1\)::integer as penalty/, 'Bounce Out historical event must be -1 XP');
assert.match(migration, /event_at >= timestamptz '2026-09-05 20:13:15\+00'/, 'Bounce Out XP must respect the existing Misfire launch boundary');
assert.match(migration, /from private\.v_bounce_out_misfire_events[\s\S]*event_at >= timestamptz '2026-09-05 20:13:15\+00'/, 'Bounce Out must join the normal Misfire penalty pool only after the launch boundary');
assert.match(migration, /greatest\(-5, min\(e\.penalty\)\)/, 'Normal Misfire worst-only and -5 cap must remain intact');
assert.doesNotMatch(migration, /update\s+public\.games|delete\s+from\s+public\.games|insert\s+into\s+public\.games/i, 'Backfill must never mutate historical game rows');

assert.match(rollback, /drop view if exists private\.v_bounce_out_misfire_events/, 'Rollback must remove the internal Bounce Out history helper');
assert.doesNotMatch(rollback, /select player_id, code from private.v_bounce_out_misfire_events/, 'Rollback must restore pre-SC-059 Misfire aggregate');

console.log('SC-059 Bounce Out Misfire contract PASS');
