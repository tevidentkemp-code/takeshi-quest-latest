// Deterministic offline fixture for the League & Rankings dialogs.
// Stubs window.sb with per-view rows; EXPECTED documents what the arcade
// dialogs must render. Extended view-by-view as each dialog is redone.
const days = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

const FIXTURE = {
  // Official games for the Premier League table (all in the current month so
  // the default month filter shows them; Alex has 2 of the 3 needed to qualify).
  games: [
    { players: ['Jo R', 'Sam T'], totals: [140, 120], ts: days(1) },
    { players: ['Jo R', 'Sam T'], totals: [150, 130], ts: days(2) },
    { players: ['Jo R', 'Mia K'], totals: [130, 128], ts: days(3) },
    { players: ['Jo R', 'Mia K'], totals: [136, 122], ts: days(4) },
    { players: ['Mia K', 'Sam T'], totals: [132, 118], ts: days(5) },
    { players: ['Alex S', 'Sam T'], totals: [168, 110], ts: days(6) },
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
};

async function install(page) {
  await page.evaluate((FX) => {
    const mkQuery = (table) => {
      const q = {
        _t: table,
        select() { return q; }, eq() { return q; }, ilike() { return q; },
        or() { return q; }, order() { return q; }, limit() { return q; },
        then(res) {
          const rows = FX.views[q._t];
          if (rows === undefined) res({ data: null, error: { message: 'relation "' + q._t + '" does not exist' } });
          else res({ data: rows.map((r) => ({ ...r })), error: null });
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
