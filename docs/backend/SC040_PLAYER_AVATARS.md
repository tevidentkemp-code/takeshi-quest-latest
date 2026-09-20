# SC-040 — persistent player avatars (released; physical iPhone acceptance pending)

## Release closeout — 20 September 2026

- Exact verified candidate: `fa3e1a327baad249d2f0ceb9276a3af1d50c1fd6`.
- PR #57 squash-merged to production `main` as `918bb63bea56a903df6b56b2904fb68529ee60b0`.
- GitHub Pages build/deployment run `35525044431` completed successfully from that production commit.
- Hosted exact-head gates all passed: SC-040 Player Avatars, Setup regression, SC-032 DMD ownership, SC-033 release candidate, SC-034/036 release candidate, SC-042 record integrity, SC-031 cloud-failure resilience and SC-045 DMD arcade.
- Production Supabase now has `public.players.avatar_id smallint NULL` with `players_avatar_id_range` enforcing NULL or 1–29. Existing RLS/policies/grants were preserved.
- Released UI contract: avatar selectable when saving a new player; editable in Player Hub; visible on Select Player, Set Up Your Game and Throw Order; paired celebration artwork appears only after Game Complete for the actual winner, including a resolved shootout.
- Automatic avatar assignment/fallback is restricted to catalogue IDs 1–20, the original AI-generated portrait pool. IDs 21–29 are the later photo-derived portraits and are manual-selection only; existing explicit selections remain valid.
- No scoring, rankings, XP, achievement eligibility, game limits or game rules changed.
- Remaining manual gate: physical iPhone Safari hard-refresh/visual acceptance. This cannot be truthfully self-declared from automated tooling.
- Migration history contains two entries with the same idempotent SC-040 DDL; live schema has one column and one range constraint. History was intentionally not rewritten.

## Pre-release authority and verified baseline — 20 September 2026

- Repository: `tevidentkemp-code/takeshi-quest-latest`, branch `sc040-player-avatars`; existing draft PR #57.
- Production `main` and merge base: `d4a2835d46706a3dbb2d56bf71330e566629e4c1`.
- Continued existing candidate `7c921bfea55a52244adcdfbdb37dc0e2e06983c0`; retained both approved assets byte-for-byte.
- Fresh-read canonical Source Map, Working Rules, CLAUDE.md, Game Rules, Theme Direction, Coding HANDOVER and family Pipeline HANDOVER. The controls still described the earlier 20-avatar proposal; the user's subsequent approval and existing PR approve the 29-pair catalogue delivered here. No game-rule conflict or scoring change.
- Live read-only `information_schema.columns` inspection of Supabase `vvfqumgtasuacpggdmxx.public.players`: `name`, `created_at`, `id`, `initials`, `first_name`, `last_name`, `nickname`, `deleted_at`. **No avatar_id exists in production. No production DDL/data/RLS changes performed.**

## Implementation and protected behavior

`src/app/util.js` owns the 29-ID catalogue, UUID-first deterministic fallback, paired sprite coordinates, accessible picker, direct Player Hub helper, and profile persistence/read path. `src/app/router-ui.js` owns creation, saved-player selection/cache and setup-to-match identity transport. `src/live-game/postgame-flow.mjs` uses the actual game winner and only accepts a resolved decider for the current game token. A synthetic Shadow uses the same deterministic presentation fallback; it does not acquire a persisted player identity.

Small portraits use `assets/avatars/avatar-sprite.webp` (1536×1280, 565216 bytes); celebrations use `celebration-sprite.webp` (2880×3000, 1694058 bytes). Both grids are 6×5, IDs 1–29 in matching row-major order; the final blank cell is excluded. The celebration tile is 4:5. Never reorder existing IDs: they are persistent identity values. Source photos are not committed.

Fixed confirmed defects in the inherited candidate:

- The late cloud-cache normalizer discarded avatar_id. It now preserves the canonical nullable value; fallback art is a rendering decision, not a fabricated database value.
- Missing avatar columns could trigger a successful partial save. Avatar creation/edit failures now surface an error, preserve the form, and never issue the fallback write. Zero-row profile updates cannot report success.
- Selecting an absent avatar column could fall back to a minimal unfiltered player list. The verified players read now selects the row and retains the existing deleted_at filter before and after migration.
- Player Hub scraped DOM text and observed all page mutations. Its existing editor now calls the owned helper with the actual record and sends avatar_id explicitly. This also prevents an unrelated profile update from adopting another open editor's avatar.
- Hub Back pointed to a removed gate. Gate hiding plus explicit Back/Close retains usable navigation. Picker uses roving radio focus with arrows/Home/End, visible selection and 44px targets.
- Late join transport now retains avatar_id. Selection and Hub re-fetch canonical records; a successful empty cloud response cannot resurrect stale cached selections.

Quarantined compatibility owners `inline-008.js` (Hub), `inline-011.js` (cache) and `inline-030.js` (late join) have bounded patches declared with original/current hashes in `src/legacy/intentional-patches.json`. Generated `inline-005.js`, `inline-002.css` and index are produced only by `npm run materialize`. No scoring, rank, XP, achievement eligibility, game limits, security policy or historical name-key changes. Existing local Hub password behavior is preserved; it is not a new authorization system.

## How to use after approved release

1. Match Setup → Save New Player → choose a portrait, enter profile details and Save. The portrait appears on the match card.
2. Player Hub → choose player → existing password gate → choose another portrait → Save. Back returns to the gate; Close exits the Hub. Failed saves retain the editor.
3. Select saved players on another device to fetch their canonical identities. The completed game's actual winner receives the paired celebration artwork, including a resolved shootout winner.
4. Existing NULL/invalid avatars render a deterministic fallback seeded by UUID (name for guests), restricted to AI-generated IDs 1–20. Photo-derived IDs 21–29 are never chosen automatically. No backfill is required.

Before migration, reads remain compatible. Avatar saves deliberately fail visibly. **Apply and verify the approved database migration before releasing this client.**

## Verification evidence

All browser tests use the existing harness, which blocks production Supabase traffic. The new test intercepts only the player API with an isolated in-memory fixture; a separate browser context reads the shared fixture to model cross-device persistence. This is not a claim of production round-trip verification.

| Check | Result |
| --- | --- |
| Materialization, syntax/ownership and Vite dist verification | PASS, repository Node 24.21.0; relative base and all classic/module assets verified |
| `verify-sc040-player-avatars.mjs` | PASS: strict IDs, UUID fallback, 29 unique paired positions, blank excluded |
| `verify-sc040-migration.mjs` | PASS in PGlite 0.5.8: apply/reapply, NULL legacy, 1/29 accepted, 0/30/−1 rejected, RLS unchanged, rollback preserves player row, reapply |
| `verify-sc040-runtime.js`, source and built dist | PASS: creation, missing-column failure/no fallback write, Hub edit, denied/zero-row updates, Back/Close, separate device, saved-player selection/setup/match transport, winner and resolved shootout art, no uncaught errors |
| Mobile/desktop | PASS at 320/390/430/1280×844; Hub bounds and 44px targets; screenshots inspected at 320 and winner at 390 |
| `smoke.js` | **86/86 PASS**, scoring/undo/skip, full three-game match, rotation, completion, leaderboard, End Match/Home and League |
| `verify-progression-modes.js` | **24/24 PASS**, Official/Turbo data-source isolation |
| `verify-training-modes.js` | ALL PASS, Bull/TDB/Select and Practice Stats |
| `verify-sc033-throw-order.js` | PASS |
| `verify-sc034-add-player.js` | PASS |
| `verify-sc036-skip-go.js` | PASS |
| `verify-sc038-ui.js` | PASS, result → scorecard → XP → match leaderboard |
| SC-038 helpers + XP; SC-042 record-integrity contracts | PASS |
| `git diff --check` | PASS |

Browser/contract runners used local Node 24.15.0; deterministic production build used repository-pinned 24.21.0. CI runs all with the pin. The updated SC-040 workflow includes source/dist integration, migration and affected-flow regression; hosted results must be checked on the eventual pushed SHA.

Local evidence: `output/playwright/sc040/evidence/`, `output/playwright/sc040/`, and `output/playwright/sc040-dist/`. These are generated local artifacts, not source. Physical iPhone Safari acceptance and a live Supabase persistence round-trip remain release gates. Dedicated Vs Shadow avatar art is not introduced; existing mode behavior is unchanged.

Reproduce after installing the pinned Node version:

```sh
npm ci --ignore-scripts
npm ci --prefix scripts --ignore-scripts
npm ci --prefix tools/ui-smoke --ignore-scripts
npx --prefix tools/ui-smoke playwright install chromium
npm run build
npm run verify:dist
node tools/ui-smoke/verify-sc040-player-avatars.mjs
node tools/ui-smoke/verify-sc040-migration.mjs
# Serve source on 8123 and dist on 8124 in separate terminals.
node tools/ui-smoke/verify-sc040-runtime.js
SQ_APP_URL=http://127.0.0.1:8124/index.html node tools/ui-smoke/verify-sc040-runtime.js
```

## Migration, validation and rollback

Review `supabase/migrations/20260920162000_sc040_player_avatar_identity.sql`. It adds nullable `smallint avatar_id`, range 1–29, no default/backfill, no grants/policies. Transaction + 5-second lock timeout avoid partial DDL and prolonged waiting. Existing migration filename is preserved from the inherited branch.

Read-only validation after separately approved application:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='players' and column_name='avatar_id';
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid='public.players'::regclass
and conname='players_avatar_id_range';
select count(*) filter (where avatar_id is not null and avatar_id not between 1 and 29) as invalid
from public.players;
```

Before any release: review exact candidate/CI, explicitly approve the migration, apply it, read back the field/constraint, then verify an authorized test player's create/edit/reload from a second device. Obtain separate release approval and physical iPhone acceptance. Do not deploy this client first.

Rollback now: production is untouched; leave draft PR unmerged. Local continuation can be abandoned by checking out the baseline in a separate checkout without deleting this branch.

Rollback after a later approved release: revert the SC-040 release commit and verify the previous client (`d4a2835…` baseline). The additive nullable column can safely remain while assessing. If explicitly approved for removal, export `id, avatar_id` first, then run `supabase/rollbacks/sc040_player_avatar_identity.sql`. It uses no CASCADE; unexpected dependencies abort removal. Dropping the column discards selected avatar values, so schema reversibility alone does not restore those choices. No score/history rollback is required.

Exact next action: hard-refresh production on a physical iPhone and visually accept the six released surfaces. If green, mark SC-040 CLOSED and promote the next queued item. If not, reopen only the failing SC-040 surface and use the documented client-first rollback route.
