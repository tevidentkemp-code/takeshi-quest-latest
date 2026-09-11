from pathlib import Path

index = Path('index.html')
text = index.read_text()
start = text.find('async function fetchTurboHighScoreLeagueClean(){')
end_marker = '\n\n  window.openHighScoreLeagueDialog = async function(initialMode){'
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('SC-019 Turbo helper target not found')
new_helper = """async function fetchTurboHighScoreLeagueClean(){
    var client=null;
    try{ if(typeof ensureCloudInit==='function') ensureCloudInit(); }catch(_){}
    try{ client=window.sb||(typeof sb!=='undefined'?sb:null); }catch(_){ client=null; }
    if(!client||typeof client.from!=='function') throw new Error('Supabase client unavailable');
    // @MODE:HIGH_SCORE_LEAGUE_TURBO_MATERIALIZED_SOURCE
    // The direct per-player Turbo ranking view currently exceeds the client-role DB timeout.
    // Use the existing clean, materialized Turbo game-score feed and select each saved player's PB
    // from those canonical Supabase rows. Do not fall back to Official or local browser storage.
    var res=await client.from('v_latest_scores_turbo_clean')
      .select('game_id,created_at,player_scores')
      .order('created_at',{ascending:false})
      .limit(5000);
    if(res&&res.error) throw res.error;
    var saved=await savedPlayerKeys();
    var best=new Map();
    (Array.isArray(res&&res.data)?res.data:[]).forEach(function(g){
      var scores=g&&g.player_scores;
      if(typeof scores==='string'){ try{ scores=JSON.parse(scores); }catch(_){ scores=[]; } }
      if(!Array.isArray(scores)) return;
      scores.forEach(function(r){
        var player=String((r&&r.player_name)||'').trim();
        var playerKey=norm((r&&r.player_key)||player);
        var score=Number(r&&r.score||0);
        if(!player||!playerKey||!Number.isFinite(score)||score<=0||(!saved.size||saved.has(playerKey))===false) return;
        var hasAvg=r&&r.avg_round!==null&&r.avg_round!==undefined&&r.avg_round!=='';
        var hasRounds=r&&r.rounds!==null&&r.rounds!==undefined&&r.rounds!=='';
        var avg=hasAvg?Number(r.avg_round):NaN, rounds=hasRounds?Number(r.rounds):NaN;
        if(!Number.isFinite(avg)&&Number.isFinite(rounds)&&rounds>0) avg=score/rounds;
        var row={player:player,playerKey:playerKey,score:score,avg:Number.isFinite(avg)?avg:null,ts:(g&&g.created_at)||'',game_id:(g&&g.game_id)||''};
        var prev=best.get(playerKey);
        if(!prev||row.score>prev.score||(row.score===prev.score&&parseMs(row.ts)>parseMs(prev.ts))||(row.score===prev.score&&parseMs(row.ts)===parseMs(prev.ts)&&String(row.game_id)>String(prev.game_id))) best.set(playerKey,row);
      });
    });
    return Array.from(best.values()).sort(function(a,b){return (b.score-a.score)||(parseMs(b.ts)-parseMs(a.ts))||String(a.player).localeCompare(String(b.player));});
  }"""
text = text[:start] + new_helper + text[end:]
text = text.replace('Turbo High Score League data is not available yet.', 'No Turbo high scores found.')
index.write_text(text)

fixture = Path('tools/ui-smoke/league-fixture.js')
f = fixture.read_text()
old_view = "    v_high_score_league_turbo_from_games_clean: [],"
new_view = """    v_high_score_league_turbo_from_games_clean: [],
    v_latest_scores_turbo_clean: [
      { game_id: 'tg1', created_at: days(1), player_scores: [
        { player_key: 'alex s', player_name: 'Alex S', score: 220, rounds: 7, avg_round: 31.4 },
        { player_key: 'sam t', player_name: 'Sam T', score: 205, rounds: 7, avg_round: 29.3 },
        { player_key: 'mia k', player_name: 'Mia K', score: 190, rounds: 7, avg_round: 27.1 },
        { player_key: 'jo r', player_name: 'Jo R', score: 175, rounds: 7, avg_round: 25.0 },
      ] },
      { game_id: 'tg0', created_at: days(8), player_scores: [
        { player_key: 'alex s', player_name: 'Alex S', score: 180, rounds: 7, avg_round: 25.7 },
        { player_key: 'sam t', player_name: 'Sam T', score: 160, rounds: 7, avg_round: 22.9 },
      ] },
    ],"""
if old_view not in f:
    raise SystemExit('SC-019 fixture Turbo view target not found')
f = f.replace(old_view, new_view, 1)
old_expected = """  hs: {
    record: { score: '168', holder: 'Alex S' },
    order: ['Alex S', 'Jo R', 'Sam T', 'Mia K'],
    scores: ['168', '150', '140', '132'],
    avgs: ['AVG 12.0', 'AVG 9.9', 'AVG 8.8', 'AVG 9.4'],
    turboEmpty: /Turbo High Score League data is not available yet/i,
  },"""
new_expected = """  hs: {
    record: { score: '168', holder: 'Alex S' },
    order: ['Alex S', 'Jo R', 'Sam T', 'Mia K'],
    scores: ['168', '150', '140', '132'],
    avgs: ['AVG 12.0', 'AVG 9.9', 'AVG 8.8', 'AVG 9.4'],
    turbo: {
      record: { score: '220', holder: 'Alex S' },
      order: ['Alex S', 'Sam T', 'Mia K', 'Jo R'],
      scores: ['220', '205', '190', '175'],
      avgs: ['AVG 31.4', 'AVG 29.3', 'AVG 27.1', 'AVG 25.0'],
    },
  },"""
if old_expected not in f:
    raise SystemExit('SC-019 fixture HS expectation target not found')
f = f.replace(old_expected, new_expected, 1)
fixture.write_text(f)

verify = Path('tools/ui-smoke/verify-league-arcade.js')
v = verify.read_text()
old_test = """  // Turbo tab -> empty state wording preserved
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sq-fix100-backdrop button[data-mode]')).find((x) => x.dataset.mode === 'turbo');
    if (b) b.click();
  });
  await page.waitForTimeout(700);
  const hsTurbo = await page.evaluate(() => ((document.querySelector('.hs-arena') || {}).textContent) || '');
  check('HS League: turbo empty state preserved', E.hs.turboEmpty.test(hsTurbo), JSON.stringify(hsTurbo.slice(0, 80)));
"""
new_test = """  // Turbo tab -> real isolated Turbo PB ladder
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sq-fix100-backdrop button[data-mode]')).find((x) => x.dataset.mode === 'turbo');
    if (b) b.click();
  });
  await page.waitForTimeout(900);
  const hsTurbo = await page.evaluate(() => {
    const arena = document.querySelector('.hs-arena');
    if (!arena) return null;
    const rows = Array.from(arena.querySelectorAll('.hs-row'));
    return {
      recordScore: (arena.querySelector('.hs-record-score') || {}).textContent,
      recordHolder: (arena.querySelector('.hs-record-holder') || {}).textContent,
      eyebrow: (arena.querySelector('.hs-record-eyebrow') || {}).textContent,
      names: rows.map((r) => (r.querySelector('.hs-name') || {}).textContent),
      scores: rows.map((r) => (r.querySelector('.hs-score') || {}).textContent),
      avgs: rows.map((r) => (r.querySelector('.hs-avgchip') || {}).textContent),
    };
  });
  check('HS League: Turbo record banner uses Turbo data only', !!hsTurbo && hsTurbo.recordScore === E.hs.turbo.record.score && hsTurbo.recordHolder === E.hs.turbo.record.holder && /All-Time Record — Turbo/i.test(hsTurbo.eyebrow || ''), JSON.stringify(hsTurbo));
  check('HS League: Turbo ladder order', !!hsTurbo && JSON.stringify(hsTurbo.names) === JSON.stringify(E.hs.turbo.order), JSON.stringify(hsTurbo && hsTurbo.names));
  check('HS League: Turbo scores', !!hsTurbo && JSON.stringify(hsTurbo.scores) === JSON.stringify(E.hs.turbo.scores), JSON.stringify(hsTurbo && hsTurbo.scores));
  check('HS League: Turbo AVG chips', !!hsTurbo && JSON.stringify(hsTurbo.avgs) === JSON.stringify(E.hs.turbo.avgs), JSON.stringify(hsTurbo && hsTurbo.avgs));
  check('HS League: Official values do not leak into Turbo', !!hsTurbo && !hsTurbo.scores.includes(E.hs.record.score), JSON.stringify(hsTurbo && hsTurbo.scores));

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sq-fix100-backdrop button[data-mode]')).find((x) => x.dataset.mode === 'official');
    if (b) b.click();
  });
  await page.waitForTimeout(900);
  const hsOfficialAgain = await page.evaluate(() => ({
    score: (document.querySelector('.hs-record-score') || {}).textContent,
    holder: (document.querySelector('.hs-record-holder') || {}).textContent,
    eyebrow: (document.querySelector('.hs-record-eyebrow') || {}).textContent,
  }));
  check('HS League: switching back restores Official source', hsOfficialAgain.score === E.hs.record.score && hsOfficialAgain.holder === E.hs.record.holder && /All-Time Record — Official/i.test(hsOfficialAgain.eyebrow || ''), JSON.stringify(hsOfficialAgain));
"""
if old_test not in v:
    raise SystemExit('SC-019 league regression target not found')
v = v.replace(old_test, new_test, 1)
verify.write_text(v)
