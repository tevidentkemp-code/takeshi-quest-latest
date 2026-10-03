SC-004 requires one permanent Supabase Auth principal enrolled by the project owner. The initial production capture contained zero Auth users; the owner has since supplied the intended UUID, and a fresh read verified that principal is permanent, confirmed and active, with no current session. Its enrollment and intended-owner browser sign-in remain release gates. A controller capability, old PIN, player password, browser flag, JWT metadata, and ordinary signed-in account cannot enroll or act as admin.

The project owner should create the intended administrator through the Supabase Dashboard Authentication Users page, using the administrator's email and a private password chosen through the owner-controlled flow. The account must be permanent and its email confirmed. Do not put the password, access token, refresh token, or service-role key in chat, repository files, screenshots, test output, or control-sheet evidence. No public registration UI is introduced.

After the additive migration exists, copy the verified Auth user's UUID from that owner-controlled page. Replace the single UUID literal below. Run this transaction with the trusted database owner, not through a browser command or public RPC. It aborts for an absent, anonymous, unconfirmed, or deleted user.

```sql
BEGIN;
DO $enroll$
DECLARE intended uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id=intended AND is_anonymous IS FALSE
      AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The intended permanent confirmed Auth user does not exist';
  END IF;
  INSERT INTO private.sc004_admins(user_id,enabled,revoked_at)
    VALUES(intended,true,NULL)
    ON CONFLICT(user_id) DO UPDATE SET enabled=true,revoked_at=NULL;
END $enroll$;
COMMIT;
```

Keep writes held until the full release acceptance and cutover conditions pass. Sign in using Admin in the updated browser. Sign-in uses a separate Supabase SDK client from anonymous gameplay, verifies the user through Auth, then calls authenticated `admin_action` with operation `status`. The server verifies the permanent confirmed user, the current matching Auth session, and the private allowlist on every operation. Status works during a safe hold; mutations return `writes_held`. The UI's `__sqAdminAuthed` flag only changes presentation.

Revocation is immediate for the privileged SQL boundary, including replayed request receipts:

```sql
UPDATE private.sc004_admins
SET enabled=false,revoked_at=clock_timestamp()
WHERE user_id='00000000-0000-0000-0000-000000000000';
```

Revoking an Auth session through the owner Auth administration also denies that session's subsequent admin commands. A new sign-in is still subject to the live allowlist. Use Sign out in the Admin Hub to leave the browser admin session.

Validation must use the actual account's sign-in, Auth verification, Edge command, and SQL boundary. The in-memory schema tests only exercise the SQL checks against minimal synthetic Auth columns and do not satisfy that acceptance gate. Local platform tests create synthetic permanent users through the real isolated Auth admin API; those accounts are never production principals.

Admin rename preserves the player UUID unless the owner explicitly merges into a different existing saved profile. Merge rejects participants sharing a saved game. The source profile is archived and soft-deleted, and structural JSON, linked scores, aliases, and player history use the target identity. Rename, soft delete, and historical archive/purge/player removal revoke affected match controllers; the server retains accepted controller receipts unchanged. Affected browsers must start a new match. This is deliberate: an admin edit cannot leave stale browser authority active.

Historical imports create new records or return an identical existing record. They reject conflicting match identity and never upsert browser cache over saved truth. Historical score repair derives mode, identity, positive totals, and timestamp from accepted saved games. Ordinary completion derives high scores atomically; leaderboard reads do not trigger maintenance writes. Exact score deletion uses its row ID or a full identity including game or timestamp, without a time-window fallback.

Legacy session recovery is an explicit owner-authenticated `recover_legacy` admin operation. It locks an existing saved match, verifies a contiguous accepted game sequence against saved history, retains the saved history/wins/roster, creates historical immutable slots, and reserves the next pending game. The server issues a capability through the private HMAC issuance key after verifying Auth. Raw authority is cached separately from public state by the browser transport. A new request cannot replace an existing registry controller; an exact retry checks the same issuance hash and live registry, so a changed issuance key, expiry, or revocation cannot return a misleading usable secret.

The old match writer saved name-only rosters and did not populate `target_wins` or mode/rules. The enrolled owner must confirm a first-to setting (1, 3, or 5) when the database field is absent; existing non-null settings cannot change. The owner must also confirm `match_format` as series or single: a first-to-one series must retain win accounting. Single-game recovery requires no accepted history and a first-to setting of one. Before any accepted game, the owner must also confirm pending mode/rules. After accepted history, the server uses saved latest-game provenance and rejects conflicting settings. The server compares each history totals array with the actual game at the same game number before issuance. The browser compares ordered history totals and count, roster and wins with its cached match, retaining cache-only board/game-token presentation fields. The unfinished board is retained for that new pending game; it never supplies or overwrites accepted history.

Recovery fails closed for an absent or already controlled match, archived/unfinished saved game rows, gaps between saved game sequence and history, completed first-to wins, invalid or ambiguous saved roster, and unavailable provenance/settings. Those conditions require owner repair or a separately reviewed recovery plan; they are never resolved by restoring anonymous grants. Historical six-player matches remain readable and are outside new 1–5 player recovery.

The schema tests cover registered name-only legacy Game1 with unfinished Game2, guest Practice recovery, immutable history/wins, mismatched ordered history rejection, first-to-one series completion, exact recovery retry, changed-key conflict, unknown scope denial, and revoked receipt denial. Exact counts are recorded in `admin-schema-results.json`. Actual local API/Auth/browser recovery acceptance is recorded by the parent platform suite separately.

Real local API testing exposed PostgreSQL safeupdate SQLSTATE21000 in the first rename implementation. The final structural rename updates include precise `IS DISTINCT FROM` predicates for matches and opponent JSON. Admin/platform timestamp identity fixtures now use a unique timestamp per run; ambiguous timestamps continue to fail closed.
