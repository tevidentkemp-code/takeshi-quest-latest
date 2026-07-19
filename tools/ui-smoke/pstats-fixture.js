// Deterministic offline fixture for the Player Stats profile dialog.
// Stubs every cloud seam the dialog reads so it renders fully with known
// numbers; EXPECTED holds the values the UI must show for player "Alex S".
//
// Fixture story: Alex S has 5 official games vs Sam T (W3-L2).
//   2025-11-10  168 v 120   (board present: best round 19 = 114, S/D/T)
//   2025-12-05   77 v 140
//   2026-01-12  130 v 128
//   2026-02-02  115 v 150
//   2026-02-20  140 v  90
// XP 151 -> LV 2 ROOKIE, 33 XP to level 3 (matches the reference shot).

const FIXTURE = {
  players: [
    { name: 'Alex S', nickname: 'The Atomic' },
    { name: 'Sam T', nickname: 'The Hammer' },
    { name: 'Jo R', nickname: '' },
    { name: 'Mia K', nickname: '' },
  ],
  games: [
    { players: ['Alex S', 'Sam T'], totals: [168, 120], ts: '2025-11-10T20:00:00Z',
      board: [
        // Alex: 11 round cells (targets 10..20); round idx 9 = target 19 is the monster
        [null, null, null, null, null, null, null, null, null,
          [{ kind: 'treble', points: 57 }, { kind: 'single', points: 19 }, { kind: 'double', points: 38 }],
          null],
        [null, null, null, null, null, null, null, null, null, null, null],
      ] },
    { players: ['Alex S', 'Sam T'], totals: [77, 140], ts: '2025-12-05T20:00:00Z', board: null },
    { players: ['Alex S', 'Sam T'], totals: [130, 128], ts: '2026-01-12T20:00:00Z', board: null },
    { players: ['Alex S', 'Sam T'], totals: [115, 150], ts: '2026-02-02T20:00:00Z', board: null },
    { players: ['Alex S', 'Sam T'], totals: [140, 90], ts: '2026-02-20T20:00:00Z', board: null },
    // TURBO game (must be excluded): explicit flag + a score lower than 77.
    // If it leaked in, Lowest Score would drop to 40 and Games would show 6.
    { players: ['Alex S', 'Sam T'], totals: [40, 55], ts: '2026-03-01T20:00:00Z', board: null, gameVariant: 'turbo', mode: 'turbo' },
  ],
  views: {
    v_power_rankings_last56_official_clean: [
      { player: 'Jo R', player_key: 'jo r', rounds_used: 56, total_points: 532, avg_per_round: 9.5, last_played_at: null, rank_pos: 1 },
      { player: 'Mia K', player_key: 'mia k', rounds_used: 56, total_points: 510, avg_per_round: 9.1, last_played_at: null, rank_pos: 2 },
      { player: 'Alex S', player_key: 'alex s', rounds_used: 56, total_points: 490, avg_per_round: 8.75, last_played_at: null, rank_pos: 3 },
    ],
    v_player_best_official_ranked: [
      { player_name: 'Alex S', best_score: 168, best_score_pos: 38 },
    ],
    v_player_last30_targets: [
      { player_key: 'alex s', favorite_number: 19, favorite_pct: 61.1, worst_number: 12, worst_pct: 22.2 },
    ],
    v_player_last30_target_rates: [
      { player_key: 'alex s', target_n: 19, hit_pct: 61.1, throws: 45 },
      { player_key: 'alex s', target_n: 20, hit_pct: 55.0, throws: 40 },
      { player_key: 'alex s', target_n: 18, hit_pct: 48.3, throws: 38 },
      { player_key: 'alex s', target_n: 14, hit_pct: 30.1, throws: 36 },
      { player_key: 'alex s', target_n: 13, hit_pct: 25.0, throws: 31 },
      { player_key: 'alex s', target_n: 12, hit_pct: 22.2, throws: 33 },
    ],
    v_player_target_streaks: [
      { player_key: 'alex s', player_name: 'Alex S', mode_key: 'official', mode_label: 'Official', dart_streak: 4, round_streak: 2, source_games: 5, last_played_at: null },
    ],
    v_player_xp: [
      { player_id: 'p1', name: 'Alex S', total_xp: 151, points_scored: 630, games_played: 5, games_won: 3, matches_won: 1, milestones: 2, ach_xp: 20, badges: 2 },
      { player_id: 'p2', name: 'Sam T', total_xp: 300, points_scored: 900, games_played: 5, games_won: 2, matches_won: 0, milestones: 1, ach_xp: 0, badges: 0 },
    ],
    v_player_achievements: [
      { code: 'giant_slayer', cnt: 1, xp: 10 },
      { code: 'champion', cnt: 1, xp: 10 },
    ],
  },
};

// Values the STATS tab must render for Alex S given the fixture above.
const EXPECTED = {
  name: 'Alex S',
  nick: 'The Atomic',
  chip: /LV 2\s*ROOKIE/i,
  heroPowerRank: '8.75 (#3)',
  heroGames: '5',
  heroAvg: '126.0',
  xpLeft: '151 XP',
  xpRight: /33 to Level 3/i,
  quick: {
    'Highest Score': '168 (#38)',
    'Lowest Score': '77',
    'Highest Scoring Round': '19 · 114 (S/D/T)',
    'Dart Streak': '4',
    'Round Streak': '2',
  },
  quickPowerRank: '#3',
  premier: {
    'PL Average': '126.0',
    'PL Monthly Wins': '0',
    'Best Month': '168.0 (NOV 2025)',
    'Worst Month': '77.0 (DEC 2025)',
  },
  targetsFav: '1. 19 (61.1%)\n2. 20 (55.0%)\n3. 18 (48.3%)',
  targetsWeak: '1. 12 (22.2%)\n2. 13 (25.0%)\n3. 14 (30.1%)',
  rivalsNemesis: '1. Sam T (60.0%)',
  rivalsVictims: '1. Sam T (60.0%)',
};

// Install all stubs in the page. Run AFTER boot, BEFORE opening the dialog.
async function install(page) {
  await page.evaluate((FX) => {
    // 1) games (preferred seam inside __fetchOfficialGames)
    window.cloudFetchAllGamesAsLocal = async () => FX.games;
    // 2) saved players
    window.cloudListPlayers = async () => FX.players;
    window.cloudIsTableMissing = () => false;
    // 3) throws fetch used by the legacy local power-rank fallback
    window.__fetchThrowsForGames = async () => [];
    // 4) fake supabase client: chainable, thenable, resolves per-table rows
    const mkQuery = (table) => {
      const q = {
        _t: table,
        select() { return q; }, eq() { return q; }, ilike() { return q; },
        or() { return q; }, order() { return q; }, limit() { return q; },
        then(res) { res({ data: (FX.views[q._t] || []).map((r) => ({ ...r })), error: null }); },
        catch() { return q; },
      };
      return q;
    };
    const fakeSb = { from: (t) => mkQuery(t) };
    window.sb = fakeSb; window.__sb = fakeSb;
    // 5) bust XP cache so it re-reads through the stub
    if (window.SQ_XP) { window.SQ_XP._cache = null; window.SQ_XP._cacheAt = 0; }
    if (window.SQ_ACH) window.SQ_ACH._cache = {};
  }, FIXTURE);
}

module.exports = { FIXTURE, EXPECTED, install };
