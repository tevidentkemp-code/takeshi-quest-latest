// SC-063 proposal contract. Does not connect to or modify a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261002120000_sc063_achievement_history_performance.sql','utf8');
const rollback=fs.readFileSync('supabase/rollbacks/sc063_achievement_history_performance.sql','utf8');
const functionBody=text=>{
  const matches=[...text.matchAll(/CREATE OR REPLACE FUNCTION public\.sq_game_is_legacy_turbo_board\(p_state jsonb\)[\s\S]*?\$function\$;/g)];
  assert.equal(matches.length,1,'Exactly one existing classifier replacement');
  return matches[0][0];
};
const before=functionBody(rollback),after=functionBody(migration);
const added=/^([ \t]*)early_played := true;\n\1return false;/gm;
assert.equal([...after.matchAll(added)].length,3,'All three existing layout branches short-circuit');
assert.equal(after.replace(added,'$1early_played := true;'),before,'Classifier signature, attributes and every other body line must remain captured-original');
assert.match(after,/LANGUAGE plpgsql\n STABLE\n SET search_path TO 'pg_catalog', 'public'/);
assert.match(after,/return late_played and not early_played;/);
assert.match(after,/exception when others then\n  return false;/);
const viewBody=text=>{
  const match=text.match(/create or replace view private\.v_bounce_out_misfire_events as[\s\S]*?\n  WHERE \(dart ->> 'bounceOut'::text\) = 'true'::text;/i);
  assert(match,'Captured private view and final exact marker predicate must remain');
  return match[0].replace(/\s+/g,' ').trim();
};
const prefilter=` AND g.state @? '$.board[*][*].darts[*] ? (@.bounceOut == true || @.bounceOut == "true")'::jsonpath`;
const oldView=viewBody(rollback),newView=viewBody(migration);
assert.equal(newView.split(prefilter).length,2,'One explicit-marker prefilter only');
assert.equal(newView.replace(prefilter,''),oldView,'No private output/eligibility/name/penalty change');
const sql=migration.replace(/^\s*--.*$/gm,'');
assert.equal((sql.match(/create or replace (?:view|function)/gi)||[]).length,2,'Only two established objects replaced');
assert.doesNotMatch(sql,/\b(?:grant|revoke|alter|drop|insert|update|delete|truncate)\b|materialized\s+view|security\s+definer/i,'No data/security/architecture mutations in candidate');
console.log('SC-063 backend proposal contract PASS: only classifier short-circuits and private marker prefilter; exact rollback, no database connection/application');
