// Deterministic offline fixture for the League & Rankings dialogs.
// Stubs window.sb with per-view rows; EXPECTED documents what the arcade
// dialogs must render. Extended view-by-view as each dialog is redone.
const days = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

// Dart + board helpers for the Round-target leaderboard fixture. Board shape A:
// board[playerIdx][roundIndex] = array of dart objects. Round index 0..10 =
// targets 10..20; 11 = Doubles round; 12 = Trebles; 13 = Bull.
const S = (n) => ({ kind: 'single', target: n, points: n });
const D = (n) => ({ kind: 'double', target: n, points: n * 2 });
const T = (n) => ({ kind: 'treble', target: n, points: n * 3 });
const MISS = { kind: 'miss', points: 0 };
const mkBoard = (map) => { const b = new Array(14).fill(null); Object.keys(map).forEach((k) => { b[+k] = map[k]; }); return b; };

const FIXTURE = {
  // Official games for the Premier League table (all in the current month so
  // the default month filter shows them; Alex has 2 of the 3 needed to qualify).
  // Two games carry board data to drive the per-target leaderboard:
  //  - target 14 (round idx 4): Alex T14×3 (3 hits,126), Sam T14+2 miss (1,42),
  //    Jo S14×3 (3 hits,42) — proves 3 singles beat 1 treble + 2 misses.
  //  - D round (round idx 11): Alex D10/D11/D12 — proves per-double detail.
  games: [
    { players: ['Jo R', 'Sam T'], totals: [140, 120], ts: days(1), board: [mkBoard({ 4: [S(14), S(14), S(14)] }), mkBoard({})] },
    { players: ['Jo R', 'Sam T'], totals: [150, 130], ts: days(2) },
    { players: ['Jo R', 'Mia K'], totals: [130, 128], ts: days(3) },
    { players: ['Jo R', 'Mia K'], totals: [136, 122], ts: days(4) },
    { players: ['Mia K', 'Sam T'], totals: [132, 118], ts: days(5) },
    { players: ['Alex S', 'Sam T'], totals: [168, 110], ts: days(6), board: [mkBoard({ 4: [T(14), T(14), T(14)], 11: [D(10), D(11), D(12)] }), mkBoard({ 4: [T(14), MISS, MISS] })] },
    { players: ['Alex S', 'Sam T'], totals: [96, 140], ts: days(7) },
  ],
  players: [{ name: 'Jo R' }, { name: 'Mia K' }, { name: 'Alex S' }, { name: 'Sam T' }],
  views: {
    v_power_rankings_official_current_clean: [
      { player: 'Jo R', player_key: 'jo r', games_used: 4, rounds_used: 56, total_points: 532, avg_per_round: 9.5, last_played_at: days(2), latest_scores: [142, 128, 135, 127], rank_pos: 1 },
      { player: 'Mia K', player_key: 'mia k', games_used: 4, rounds_used: 56, total_points: 510, avg_per_round: 9.1, last_played_at: days(3), latest_scores: [130, 131, 120, 129], rank_pos: 2 },
      { player: 'Alex S', player_key: 'alex s', games_used: 4, rounds_used: 56, total_points: 490, avg_per_round: 8.75, last_played_at: days(1), latest_scores: [168, 77, 130, 115], rank_pos: 3 },
      { player: 'Sam T', player_key: 'sam t', games_used: 4, rounds_used: 56, total_points: 460, avg_per_round: 8.2, last_played_at: days(5), latest_scores: [120, 140, 128, 150], rank_pos: 4 },
      // inactive: last played 60 days ago
      { player: 'Old Guy', player_key: 'old guy', games_used: 4, rounds_used: 56, total_points: 392, avg_per_round: 7.0, last_played_at: days(60), latest_scores: [90, 100, 98, 104], rank_pos: 5 },
      // unqualified: only 14 rounds
      { player: 'Newbie', player_key: 'newbie', games_used: 1, rounds_used: 14, total_points: 139, avg_per_round: 9.9, last_played_at: days(1), latest_scores: [139], rank_pos: 6 },
    ],
    v_power_rankings_last56_turbo_clean: [],
    v_power_rankings_last56_practice_clean: [],
    v_high_score_league_official_from_games_clean: [
      { player: 'Alex S', best_score: 168, best_ts: days(6), game_id: 'g6', avg_round: 12.0, rounds: 14 },
      { player: 'Jo R', best_score: 150, best_ts: days(2), game_id: 'g2', avg_round: 9.9, rounds: 14 },
      { player: 'Sam T', best_score: 140, best_ts: days(7), game_id: 'g7', avg_round: 8.8, rounds: 14 },
      { player: 'Mia K', best_score: 132, best_ts: days(5), game_id: 'g5', avg_round: 9.4, rounds: 14 },
    ],
    v_high_score_league_turbo_from_games_clean: [],
    v_top50_scores_official: [
      { player_name: 'Alex S', score: 168, rounds: 14, avg_round: 12.0, ts: days(6), game_id: 'g6' },
      { player_name: 'Jo R', score: 150, rounds: 14, avg_round: 10.7, ts: days(2), game_id: 'g2' },
      { player_name: 'Sam T', score: 140, rounds: 14, avg_round: 10.0, ts: days(7), game_id: 'g7' },
      { player_name: 'Jo R', score: 138, rounds: 14, avg_round: 9.9, ts: days(9), game_id: 'g8' },
      { player_name: 'Mia K', score: 132, rounds: 14, avg_round: 9.4, ts: days(5), game_id: 'g5' },
      { player_name: 'Jo R', score: 130, rounds: 14, avg_round: 9.3, ts: days(3), game_id: 'g3' },
      { player_name: 'Alex S', score: 130, rounds: 14, avg_round: 9.3, ts: days(12), game_id: 'g9' },
      { player_name: 'Sam T', score: 128, rounds: 14, avg_round: 9.1, ts: days(13), game_id: 'g10' },
      { player_name: 'Mia K', score: 126, rounds: 14, avg_round: 9.0, ts: days(14), game_id: 'g11' },
      { player_name: 'Sam T', score: 122, rounds: 14, avg_round: 8.7, ts: days(15), game_id: 'g12' },
      { player_name: 'Jo R', score: 120, rounds: 14, avg_round: 8.6, ts: days(16), game_id: 'g13' },
      { player_name: 'Mia K', score: 118, rounds: 14, avg_round: 8.4, ts: days(17), game_id: 'g14' },
    ],
    v_top50_scores_turbo_clean: [],
    v_round_high_scores_official_clean_app: [
      { mode: 'official', round_key: '14', round_label: '14', target_sort: 5, wr_points: 126, darts: 'T/T/T', holder: 'Alex S', holders: ['Alex S'], tie_count: 1 },
      { mode: 'official', round_key: '19', round_label: '19', target_sort: 10, wr_points: 114, darts: 'T/S/D', holder: 'Jo R', holders: ['Jo R'], tie_count: 1 },
      { mode: 'official', round_key: '20', round_label: '20', target_sort: 11, wr_points: 100, darts: 'T/D/X', holder: 'Sam T', holders: ['Sam T', 'Mia K'], tie_count: 2 },
      { mode: 'official', round_key: 'B', round_label: 'Bull', target_sort: 14, wr_points: 125, darts: 'B/B/S', holder: 'Mia K', holders: ['Mia K'], tie_count: 1 },
    ],
    v_round_high_scores_turbo_clean_app: [],
    v_player_game_scores_official_clean: [
      { game_id: 'g1', ts: days(1), player_index: 0, player_name: 'Jo R', score: 140 },
      { game_id: 'g1', ts: days(1), player_index: 1, player_name: 'Sam T', score: 120 },
      { game_id: 'g5', ts: days(5), player_index: 0, player_name: 'Mia K', score: 132 },
      { game_id: 'g5', ts: days(5), player_index: 1, player_name: 'Sam T', score: 118 },
      { game_id: 'g6', ts: days(6), player_index: 0, player_name: 'Alex S', score: 168 },
      { game_id: 'g6', ts: days(6), player_index: 1, player_name: 'Sam T', score: 110 },
    ],
    v_latest_scores_turbo_clean: [],
    v_player_target_streaks: [
      { player_key: 'jo r', player_name: 'Jo R', mode_key: 'official', mode_label: 'Official', dart_streak: 9, round_streak: 4, source_games: 12, last_played_at: days(2) },
      { player_key: 'alex s', player_name: 'Alex S', mode_key: 'official', mode_label: 'Official', dart_streak: 7, round_streak: 6, source_games: 10, last_played_at: days(1) },
      { player_key: 'mia k', player_name: 'Mia K', mode_key: 'official', mode_label: 'Official', dart_streak: 5, round_streak: 3, source_games: 8, last_played_at: days(5) },
      { player_key: 'sam t', player_name: 'Sam T', mode_key: 'official', mode_label: 'Official', dart_streak: 3, round_streak: 5, source_games: 11, last_played_at: days(4) },
    ],
  },
};

const EXPECTED = {
  power: {
    podiumWinner: 'Jo R',
    podiumCount: 3,
    rankedNames: ['Jo R', 'Mia K', 'Alex S', 'Sam T'],
    // active-but-unranked sorts above inactive (existing display precedence)
    benched: [{ name: 'Newbie', tag: 'Unranked' }, { name: 'Old Guy', tag: 'Inactive' }],
    firstAvg: '9.50',
    alexChips: ['168', '77', '130', '115'],
    totalRows: 6,
  },
  premier: {
    // this-month aggregates from FIXTURE.games (min 3 games to qualify)
    ranked: [
      { name: 'Jo R', avg: '139.0', best: 'BEST 150', games: '4 games' },
      { name: 'Mia K', avg: '127.3', best: 'BEST 132', games: '3 games' },
      { name: 'Sam T', avg: '123.6', best: 'BEST 140', games: '5 games' },
    ],
    unqualified: { name: 'Alex S', avg: '132.0', dotsOn: 2, dotsTotal: 3, label: '2/3 games to qualify' },
    medals: { 'BEST 168': '🥇', 'BEST 150': '🥈', 'BEST 140': '🥉' },
  },
  hs: {
    record: { score: '168', holder: 'Alex S' },
    order: ['Alex S', 'Jo R', 'Sam T', 'Mia K'],
    scores: ['168', '150', '140', '132'],
    avgs: ['AVG 12.0', 'AVG 9.9', 'AVG 8.8', 'AVG 9.4'],
    turboEmpty: /Turbo High Score League data is not available yet/i,
  },
  top50: {
    total: 12,
    bands: ['Podium', 'Elite Ten', 'The Pack'],
    first: { name: 'Alex S', score: '168', avg: 'AVG 12.0' },
    // first occurrence of each player in rank order gets the PB chip
    pbRanks: [1, 2, 3, 5],
    packStart: 11, // rank #11 is the first row after THE PACK band
    turboEmpty: /Top 50 Scores data is not available yet/i,
  },
  rhs: {
    tiles: 14, // 10..20 + D/T/B
    filled: { 14: '126', 19: '114', 20: '100', B: '125' },
    bestKey: '14',
    holders: { 14: 'Alex S', 20: 'Sam T / Mia K' },
    pips14: ['t', 't', 't'],
    turboEmpty: /No Turbo round high scores found/i,
    // Per-target leaderboard for target 14 (from board data above)
    t14board: {
      order: ['Alex S', 'Jo R', 'Sam T'],
      pts: ['126', '42', '42'],
      hits: ['3 hits', '3 hits', '1 hit'],
      alexCombo: ['T14', 'T14', 'T14'],
      joCombo: ['S14', 'S14', 'S14'],
      samCombo: ['T14', '✕', '✕'],
    },
    // D round leaderboard proves per-double detail
    dBoard: { player: 'Alex S', combo: ['D10', 'D11', 'D12'], pts: '66' },
  },
  streak: {
    dartOrder: ['Jo R', 'Alex S', 'Mia K', 'Sam T'],
    dartTop: '9',
    roundOrder: ['Alex S', 'Sam T', 'Jo R', 'Mia K'],
    roundTop: '6',
    turboEmpty: /Turbo Streak League is not available yet/i,
  },
  latest: {
    cards: 3,
    first: { winner: 'Jo R', winScore: '140', loser: 'Sam T', loseScore: '120' },
    order: ['Jo R', 'Mia K', 'Alex S'],
  },
};

async function install(page) {
  await page.evaluate((FX) => {
    const mkQuery = (table) => {
      const q = {
        _t: table, _eq: [],
        select() { return q; }, eq(col, val) { q._eq.push([col, val]); return q; }, ilike() { return q; },
        or() { return q; }, order() { return q; }, limit() { return q; },
        then(res) {
          let rows = FX.views[q._t];
          if (rows === undefined) { res({ data: null, error: { message: 'relation "' + q._t + '" does not exist' } }); return; }
          q._eq.forEach(([col, val]) => { rows = rows.filter((r) => String(r[col]) === String(val)); });
          res({ data: rows.map((r) => ({ ...r })), error: null });
        },
        catch() { return q; },
      };
      return q;
    };
    const fakeSb = { from: (t) => mkQuery(t) };
    window.sb = fakeSb; window.__sb = fakeSb;
    // bust the power-rows cache so the stub is always consulted
    if (typeof window.__sqInvalidatePowerOfficialFetchCache === 'function') window.__sqInvalidatePowerOfficialFetchCache('fixture');
    // Premier League / medal sources
    window.getGamesForMode = async () => FX.games.map((g) => ({ ...g }));
    window.cloudFetchAllGamesAsLocal = async () => FX.games.map((g) => ({ ...g }));
    window.__sqGetAllGamesNormalized = undefined;
    window.cloudListPlayers = async () => FX.players.map((p) => ({ ...p }));
  }, FIXTURE);
}

module.exports = { FIXTURE, EXPECTED, install };
