# 09 — Visual Inconsistencies

Severity: **Critical / High / Medium / Low**. Evidence tags as in `01-application-overview.md`.
Measurements come from live `getComputedStyle` capture at 390×844 (see `08-back-button-audit.csv`
and `07-component-inventory.csv` for full values).

## V-1 (High) — Back controls: 7+ distinct implementations of one concept
The same "go back one step" affordance ships as:

| Variant | Where | Shape | Size | Weight |
|---|---|---|---|---|
| `.ms2-back` "← BACK" bar | Match Card, Select Game Mode, Select Players, Match Length footer, Throw Order | 8px radius bar | ~280–300×52 | 700 **and** 800 (drifts within family) |
| `.np-back` "←" | New Player header | 12px radius square | 40×40 | 900, 18px glyph |
| `.ml-back` "←" | Match Length header | 12px radius square | 36×38 | 400, 13.3px glyph |
| `.icon-btn` "←"/"‹" | Admin Hub, Stats hub, League menu, Main Menu headers | 10px radius | 38×38 | 400 |
| `.sq132-back` "Back" | Power Rankings & league dialogs | **999px pill** | 92×39 | 700 |
| plain `.btn` "Back" | 6 admin modals | 12px radius | ~90×40 | 600, **12px font** |
| "Cancel" | legacy stats lookup | — | — | — |

Same-name-different-behaviour also occurs (see V-2). **[RUNTIME]**

## V-2 (High) — "Back" vs "Close" semantics are inconsistent
- On league dialogs (Power Rankings etc.): **Back → league menu**, **Close → exits everything to Home**. Good split. **[RUNTIME]**
- On Admin Hub and Stats hub: the header **← Back and ✕ Close do exactly the same thing** (both exit to Home). **[RUNTIME]**
- On New Player modal: **← Back and × Close are duplicates** (both just close). **[RUNTIME + CODE 9477/9482]**
- `#closeStartGameModalBtn` (a "close" id) renders as "← BACK"; `#cancelSelectPlayerBtn` (a "cancel" id) renders as "← BACK". **[CODE]**

## V-3 (High) — Two different "primary action" languages
Home's START GAME is a 16px-radius glossy gradient (`btn primary big`, fw800, 18.4px), while the
whole setup funnel (SELECT MATCH LENGTH / SET THROW ORDER / START GAME / CONFIRM PLAYERS) uses a flat
8px-radius orange family (`ms-primary` / `to-start practice-cta` / `sp2-confirm`, fw800, 16px) — four
class families for one visual role. The leaderboard then introduces a third language: fix170's green
"NEXT ROUND >" (14px radius, fw900). **[RUNTIME measurements]**

## V-4 (Medium) — Duplicate accent-class pair `navAmber` vs `navOrange`
Static HTML gives the League button `navAmber` (line 9264); the runtime rebuild assigns `navOrange`
(line 33918-region). Both classes exist in CSS with near-identical accents. **[CODE+RUNTIME]**

## V-5 (Medium) — Modal shells differ per dialog family
At least 7 visual shell variants: `sg-modal`, `np-modal`, `ml-modal`, `sp-modal`, `menu-modal`
(admin/stats/league/main-menu), `sq132` league bodies, `gc-arcade-shell` celebration, plus the
`compact` admin modals. Radius 12/14/16/18px, differing paddings, differing title styles (h3 vs
`.menu-modal-title-text` vs `.sg-title`). **[CODE+RUNTIME]**

## V-6 (Medium) — Tabs/chips: three different pill systems
Power Rankings tabs (999px pill, 11px/850), Top 50 tabs (fix97/fix168 variants), Select Player sort
chips (8px radius, 11px/800). Same interaction pattern, three implementations. **[RUNTIME]**

## V-7 (Medium) — Leaderboard static markup vs runtime skin
Static: top row (STATS, gear, hidden Start Screen/Restart) + "NEXT GAME ▶" / "HIGH SCORES".
Runtime (fix170 + 500 ms interval patcher): top row hidden, actions re-labelled "NEXT ROUND >",
"GAME SCORES", "END MATCH". The label "NEXT ROUND" is also semantically wrong — it starts the next
*game* of the match (rounds are the 15 in-game phases). **[RUNTIME]**

## V-8 (Medium) — GAME/MATCH COMPLETE overlay has no visible close control
The celebration carousel can only be dismissed by clicking the dimmed backdrop (discovered by
experiment; nothing on-screen indicates this). Buttons present: NEXT ▶, VIEW BREAKDOWN, advance.
**[RUNTIME]**

## V-9 (Medium) — Native `confirm()` amid styled dialogs
Main Menu → End Game uses `window.confirm('End game? …')` (line 50377) while Restart/End Match use
styled modal confirms (fix170's End Match confirm). Jarring visual break. **[CODE+RUNTIME]**

## V-10 (Low) — Header glyph drift
Back glyphs vary: `←` (np/ml/admin hub) vs `‹` (stats hub, league menu, main menu). Close glyphs:
`×` (24px, borderless, no aria-label in Main Menu) vs `✕` (13.3px bordered icon-btn) vs text
"Close". **[RUNTIME]**

## V-11 (Low) — Typeface drift on Home
Runtime home nav squares + ADMIN link use `ui-monospace` while every other control uses the default
sans (Arial fallback). Deliberate arcade styling, but undocumented and only applied on Home. **[RUNTIME]**

## V-12 (Low) — Cloud status indicator lost its label
Static markup has a chip with text "Checking cloud…" (`#cloudStatusText`); at runtime only a small
colored dot renders top-right, and the text node is absent — connectivity state is conveyed by
colour alone (also an a11y issue). **[RUNTIME]**

## V-13 (Low) — Admin keypad styled entirely inline in JS
`showAdminKeypad` sets ~40 style properties via `element.style.*` (lines 379–430), so it can drift
from the app stylesheet silently. **[CODE]**

## V-14 (Medium) — Loading state with no failure fallback
League dialogs show "Loading…" that persists forever if the Supabase fetch fails/never resolves
(verified with cloud blocked: Power Rankings stayed in "Loading…" indefinitely; code shows
missing-view messages only for specific error shapes). **[RUNTIME]**

## V-15 (Low) — Stats hub empty state contradiction
Hub shows both a working player-picker UI ("Player" select) and the banner "No saved players found."
while local cache players exist — cloud-only sourcing makes local/offline data invisible.
**[RUNTIME]**

## Accessibility notes (feeds recommendations §4)
- Only the static New Player modal declares `role="dialog"`/`aria-modal` — all ~30 dynamic dialogs
  are plain `div`s. **[CODE]**
- Main Menu `×` has no `aria-label`; league Back/Close text buttons rely on text (OK), but icon-only
  controls in ticker (`#v3SoundBtn`) and pads vary. **[CODE/RUNTIME]**
- Toasts are not `aria-live`. **[CODE]**
- Focus is not trapped in modals; Escape handling is per-dialog and lost when focus leaves the
  overlay element (bindings are on the overlay, not `document`, in several builders). **[CODE]**
- Colour-only cloud dot (V-12).
