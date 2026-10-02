# SC-063: Stats source performance repair

This is a SQL-gated draft. The database changes have not been applied. The previous frontend repair in PR120 has been removed from its diff because current main already supplies it.

## Confirmed failure and scope

At 390px, fresh anonymous production reads returned HTTP 500 / PostgreSQL 57014 after about 3.1s:

- Power Rank: v_player_game_scores_official_clean, select game_id,ts,player_name,score, order ts.desc,game_id.desc, limit1000 offset0.
- XP: v_player_xp, select*, name filter, limit1.
- Misfires: v_player_misfires, select code,cnt, player_id filter.

All requested fields exist. The deployed helper uses that paged rank source. The UI retains Games 525 / PL AVG 312.4 while Rank correctly shows Unavailable and Retry. The anon role's existing 3s statement timeout explains the cancellations; the browser's 10s deadline is not their cause. Diagnosis allowed only GET/HEAD/OPTIONS browser traffic. No keys or raw player rows were logged.

This candidate replaces only two established objects:

1. public.sq_game_is_legacy_turbo_board: add RETURN false after each of its three existing early_played=true assignments. Its existing final result is late_played AND NOT early_played, so an early played witness already fixes the result as false. Every other body line, return type, STABLE/search_path/default parallel-unsafe/invoker attributes and exception-to-false behaviour is captured unchanged.
2. private.v_bounce_out_misfire_events: retain PR120's precise Boolean/string explicit Bounce Out prefilter before dart expansion. Its original final marker predicate, eligibility, name resolver, output, penalty and private permissions remain unchanged.

No public view definitions, columns, grants, RLS, role timeouts, formulas, history cutoffs, player limits, indexes or materialized truth are changed. In particular, historical six-player eligibility is preserved.

## Evidence and limits

Read-only catalog/plan evidence on 2026-10-02: 957 games, all player-major, including 3 historical six-player records.934/957 already have a played first-player first round. An EXPLAIN ANALYZE of that existing immutable witness predicate across all 957 games took 36.88ms; this is a small witness probe, not a measured candidate rank/XP/Misfire request.

The rank source presently classifies all game JSON, expands player rows and sorts before returning its first page. XP's filtered plan has 586 nodes / estimated cost 213201 / 36 sequential scans; Misfire has 142 nodes / estimated cost 180533 / 14 sequential scans. Costs are estimates, not durations. The original private-prefilter-only read-only receipt reported 16 unchanged Bounce events and 188 unchanged Misfire count rows; preserve that prior receipt and freshly recheck the approved combined candidate.

The classifier change addresses rank's source chain, which a Bounce-only prefilter cannot repair. XP/Misfires still contain normal-event, Volde, achievement, streak and name-resolution work. This candidate does not promise those residual chains will meet 3s until anonymously verified after approved application. Keep truthful unavailable/retry states if they fail. Do not trim history, calculate persistent truth in the browser or raise role timeouts to force success.

## Verification before application

Run the non-mutating structural contract:
```sh
node tools/ui-smoke/verify-sc063-backend-performance.mjs
```

It proves that stripping the three added returns reproduces the exact captured helper, and removing the single JSONPath prefilter reproduces the exact captured private view. It also rejects data/grant/security/extra-object changes. Normal source authority, production build, source/dist UI and release CI still run. These checks do not claim the unapplied SQL was compiled or timed in production.

Read-only semantic witness query (returns counts only):
```sql
select count(*) as games,
  count(*) filter (
    where public.sq_round_json_played(
      coalesce(state->'board',state->'score','[]'::jsonb)->0->0
    )
  ) as first_player_first_round_played
from public.games;
```

The current production classifier also passed a read-only synthetic matrix: 42 cases, zero expected-output mismatches, 12 legacy-Turbo positives. It exercises all three layout branches, recorded zero-point early Miss, score fallback, SQL/JSON null, malformed/short inputs, invalid numeric values, ignored round 15, multiple players and historical six-player shapes. This validates the captured original behaviour; the unapplied candidate has not been compiled or timed in PostgreSQL.

Independent source review must preserve every original shape/exception branch. The equivalence matrix covers player-major; round-major array entries and scalar rounds; board/score fallback; null, malformed and short boards; all early empty and late played; no played rounds; scored or zero-point recorded early Miss; multiple players; early plus late; explicit Turbo/Practice precedence; and historical six-player rows. Finding any early played round makes the original final expression false; the new return therefore cannot change any later success or exception outcome. Inputs without that witness follow every original path unchanged.

Captured security baseline (2026-10-02): classifier owner postgres, invoker (prosecdef=false), STABLE, parallel unsafe, leakproof=false, Boolean return, search_path pg_catalog/public; existing EXECUTE ACL is PUBLIC/postgres/anon/authenticated/service_role. The private view owner and only ACL recipient are postgres, with no reloptions. The classified games, clean player scores and XP views retain security_invoker=true; the other inspected views retain their existing null reloptions. CREATE OR REPLACE must retain those owners/ACLs/options. No new grants or security settings are proposed.

## Controlled application and acceptance

Root must obtain the one concrete combined backend approval before any migration is executed. Independently re-read both live object definitions/owners/ACL/security options and reject drift from the captured rollback. Capture full input/output fingerprints under a stable snapshot, without ordinary-log player dumps.

After authorized application, require complete old/new classifier output equality, including mode_key/classification_reason; full Bounce event multiset equality with EXCEPT ALL both directions; complete Misfire counts and every authoritative XP field; unchanged clean score rows; and unchanged paged rank results under fixed timestamps/cutoff. Do not compare only a single player's visible score.

The exact anonymous request shapes above must return valid 200 results repeatedly with clear headroom below 3s. Check selected-player and full 49-player XP/directory reads, Misfires, all rank pages, historical-six eligibility, refresh, Retry, Back and Close. Run the existing security access checks and verify private direct access remains denied, with every existing view security_invoker/RLS/grant setting unchanged. Record source/DDL hashes and live readback. Representative use is required before claiming STABLE.

If an output/security mismatch appears, abort/roll back; never compensate through client calculations or security relaxation.

## Recovery

The rollback file contains the exact pre-candidate private helper and classifier body captured from production. Restore those two existing objects transactionally, preserving their ownership/ACL/options. This is the SC063 rollback, not the SC059 rollback: SC059's established Bounce Out history and XP rules must remain present. No data restoration is needed because this repair writes no data rows.

Public metadata 0.10.2 is provisional against exact main cbe0928 (v0.10.1). Root must reconcile its public version and full release history if main advances before final approval/release.
