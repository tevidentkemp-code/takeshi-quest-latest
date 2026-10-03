# SC-063: Stats source performance repair

This is an authorised bounded release candidate. Thomas's explicit “Approved” reply in the accessible chat “XP Misfires Status Update” on 2026-10-03 at 10:46:47 UTC authorises the combined two-object backend repair; the programme's later release grant also covers its normal verification and release chain. Fresh live inspection found the exact SQL already recorded as migration `20261003105825 / sc063_stats_source_performance`. Its stored statements byte-match this migration, and both live definitions match its intended change. This chat has applied no database SQL and will not reapply or overwrite that work. Complete output/security/performance validation and final current-main exact-head QA remain required before closure.

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

The captured pre-repair rank plan classified all game JSON, expanded player rows and sorted before returning its first page. The captured XP filtered plan had 586 nodes / estimated cost 213201 / 36 sequential scans; Misfire had 142 nodes / estimated cost 180533 / 14 sequential scans. Costs are estimates, not durations. The original private-prefilter-only read-only receipt reported 16 unchanged Bounce events and 188 unchanged Misfire count rows; preserve that prior receipt and freshly recheck the approved combined candidate.

The classifier change addresses rank's source chain, which a Bounce-only prefilter cannot repair. XP/Misfires still contain normal-event, Volde, achievement, streak and name-resolution work. This candidate does not promise those residual chains will meet 3s until anonymously verified after approved application. Keep truthful unavailable/retry states if they fail. Do not trim history, calculate persistent truth in the browser or raise role timeouts to force success.

## Verification before application

Run the non-mutating structural contract:
```sh
node tools/ui-smoke/verify-sc063-backend-performance.mjs
```

It proves that stripping the three added returns reproduces the exact captured helper, and removing the single JSONPath prefilter reproduces the exact captured private view. It also rejects data/grant/security/extra-object changes. Normal source authority, production build, source/dist UI and release CI still run. Structural checks alone do not establish production timings or complete equivalent outputs.

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

The captured original production classifier passed a read-only synthetic matrix: 42 cases, zero expected-output mismatches, 12 legacy-Turbo positives. It exercises all three layout branches, recorded zero-point early Miss, score fallback, SQL/JSON null, malformed/short inputs, invalid numeric values, ignored round 15, multiple players and historical six-player shapes. Preserve this original evidence and repeat the comparison against the exact current live implementation.

Independent source review must preserve every original shape/exception branch. The equivalence matrix covers player-major; round-major array entries and scalar rounds; board/score fallback; null, malformed and short boards; all early empty and late played; no played rounds; scored or zero-point recorded early Miss; multiple players; early plus late; explicit Turbo/Practice precedence; and historical six-player rows. Finding any early played round makes the original final expression false; the new return therefore cannot change any later success or exception outcome. Inputs without that witness follow every original path unchanged.

Captured security baseline (2026-10-02): classifier owner postgres, invoker (prosecdef=false), STABLE, parallel unsafe, leakproof=false, Boolean return, search_path pg_catalog/public; existing EXECUTE ACL is PUBLIC/postgres/anon/authenticated/service_role. The private view owner and only ACL recipient are postgres, with no reloptions. The classified games, clean player scores and XP views retain security_invoker=true; the other inspected views retain their existing null reloptions. CREATE OR REPLACE must retain those owners/ACLs/options. No new grants or security settings are proposed.

## Controlled application and acceptance

Human authority is already granted. Independently re-read both live object definitions/owners/ACL/security options and compare them with the exact approved migration and captured rollback. The observed existing migration must be reconciled before any further application or rollback; do not replace another chat's work on the assumption that the earlier draft is still unapplied. Capture full input/output fingerprints under a stable snapshot, without ordinary-log player dumps. This remains an engineering evidence gate, not another generic DDL permission request.

After authorized application, require complete old/new classifier output equality, including mode_key/classification_reason; full Bounce event multiset equality with EXCEPT ALL both directions; complete Misfire counts and every authoritative XP field; unchanged clean score rows; and unchanged paged rank results under fixed timestamps/cutoff. Do not compare only a single player's visible score.

The exact anonymous request shapes above must return valid 200 results repeatedly with clear headroom below 3s. Check selected-player and full 49-player XP/directory reads, Misfires, all rank pages, historical-six eligibility, refresh, Retry, Back and Close. Run the existing security access checks and verify private direct access remains denied, with every existing view security_invoker/RLS/grant setting unchanged. Record source/DDL hashes and live readback. Representative use is required before claiming STABLE.

If an output/security mismatch appears, abort/roll back; never compensate through client calculations or security relaxation.

## Recovery

The rollback file contains the exact pre-candidate private helper and classifier body captured from production. Restore those two existing objects transactionally, preserving their ownership/ACL/options. This is the SC063 rollback, not the SC059 rollback: SC059's established Bounce Out history and XP rules must remain present. No data restoration is needed because this repair writes no data rows.

Public metadata 0.11.6 is provisional against released main `083c02b144fd7832ee8a4d5afecfdafe14fa1a76` (v0.11.5). All 61 actual predecessor release objects and their raw suffix are preserved; no v0.11.1 release is invented. Root must allocate the final version from actual main and repeat exact-head QA after intervening releases.

## Post-approval hosted-runtime finding (2026-10-03)

The other approved chat's candidate records unchanged captured output/security fingerprints and improved isolated anonymous reads, followed by intermittent hosted HTTP 500 / PostgreSQL 57014 during an automatic profile-hydration burst. It prepared the client changes below at `9f1082af03f07bd2eee40190447416cbb2de5005`, with all 13 checks passing against its then-current main. This chat has retrieved and preserved that exact work. Its account supports a request-contention diagnosis; independent fresh production output, timing and hosted readback must substantiate the final acceptance.

The bounded client remediation:
- reuses a fresh successful `v_player_xp` directory snapshot for the selected player instead of immediately recomputing the same view;
- resolves selected-player history through the already loaded canonical saved-player id when available;
- stages automatic secondary profile analytics until the critical XP and achievement/Misfire history reads have settled;
- preserves explicit Retry as a forced fresh source read;
- does not change XP weights, levels, Misfire criteria/penalties, achievement criteria, rank formulas, data rows, grants, RLS, role timeouts or public database contracts.

Regression coverage must prove that cached XP reuse removes the duplicate read and that hung XP/Misfire sources prevent automatic target-analytics fan-out. Hosted production readback remains required before closure.

## Fresh independent acceptance (2026-10-03)

Read-only catalog and migration-history reconciliation confirms the stored forward SQL byte-for-byte (SHA-256 `bb3ed55107a20df0aee885c04c7083552c7d07ad68990556c8dd0a9987d7e95a`). This chat has not reapplied it. A stable-snapshot comparison at 15:29:28 UTC covers all 966 persisted classifier inputs and eight complete old/live output multisets: zero differences in either `EXCEPT ALL` direction for classified games, clean games (836), clean player scores (2,339), Bounce events (16), Misfire counts (188), Misfire XP (7), XP (37) and official Power Rank (45). All three historical six-player inputs remain present. The query-local original classifier is a full-scan SQL model of the preserved formula; it is not a recompilation of the old PL/pgSQL function or a proof for every hypothetical exceptional input. The preserved actual 42-case classifier fixture also passes against current live code, with zero mismatches and 12 legacy-Turbo positives.

The saved-player table has 49 total rows: 37 active and 12 deleted. All 37 active players have authoritative XP rows. Fresh comparisons of 25 objects' owners, ACLs, columns, RLS/policies and view options, plus three helper definitions/attributes, report no security drift. Effective anon and authenticated direct access to the private Bounce source remains denied. No role timeout or privilege was changed.

Actual public anonymous GETs repeated three times return 200 for selected XP (one row), the full XP directory (37 rows), selected Misfires (nine rows), and all three clean-score pages (1,000 / 1,000 / 339). The 18 response fingerprints are stable; durations are 824–2,436ms, leaving at least 564ms against the unchanged three-second database limit. These serial requests do not establish immunity to arbitrary concurrent analytics load.

The candidate connected to real production reads shows Thom's 131,050 XP, Level 54 / Legend, Power Rank 23.07 (#7), Games 525 and PL AVG 312.4; achievements and Misfires return 200. Back/Close, containment and strict errors pass with zero attempted cloud writes. This is candidate readback, not a public deployment claim. Optional target favourites/hit rates still report unavailable explicitly; this bounded repair makes critical progression/history/navigation usable without fabricating those optional results. Final public readback remains required.

The reused directory XP row now keeps its original cache timestamp, preventing a near-expiry row from gaining a second minute of freshness. A service regression proves reuse at 59 seconds, a source read after the original 60-second boundary, and a forced Retry read; the controlled test clock is restored in `finally`.
