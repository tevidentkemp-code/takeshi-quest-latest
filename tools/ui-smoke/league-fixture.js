// Deterministic offline fixture for the League & Rankings dialogs.
// Stubs window.sb with per-view rows; EXPECTED documents what the arcade
// dialogs must render. Extended view-by-view as each dialog is redone.
const days = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

const FIXTURE = {
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
  }, FIXTURE);
}

module.exports = { FIXTURE, EXPECTED, install };
