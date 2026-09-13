
// >>> PATCH:rankings-turbo-routing-fix START
(function(){
  'use strict';
  if (window.__sqRankingsTurboRoutingFix) return;
  window.__sqRankingsTurboRoutingFix = true;

  function warn(name){
    try { console.warn('[SQ] Rankings route unavailable:', name); } catch(_) {}
  }
  function modeKey(mode){
    var m = String(mode || 'official').trim().toLowerCase();
    if (m === 'classic') return 'practice';
    return (m === 'turbo' || m === 'practice') ? m : 'official';
  }
  function playerKey(s){
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  function parseTs(ts){
    try{
      if (typeof window.__sqParsePowerRankTs === 'function') return window.__sqParsePowerRankTs(ts);
      var n = Date.parse(ts || '');
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }
  async function classifiedModeMapForRoundRows(rows){
    var ids = Array.from(new Set((rows || []).map(function(r){ return String(r && r.game_id || '').trim(); }).filter(Boolean)));
    var map = new Map();
    if (!ids.length) return map;
    if (typeof window.sb === 'undefined' || !window.sb || typeof window.sb.from !== 'function') return map;
    for (var i = 0; i < ids.length; i += 80) {
      var chunk = ids.slice(i, i + 80);
      var q = await window.sb
        .from('v_games_mode_classified')
        .select('id,mode_key')
        .in('id', chunk);
      if (q && q.error) throw q.error;
      (q.data || []).forEach(function(r){
        var id = String(r.id || '').trim();
        if (id) map.set(id, modeKey(r.mode_key));
      });
    }
    return map;
  }
  function rowMatchesCleanMode(row, mode, modeMap){
    var id = String(row && row.game_id || '').trim();
    var classified = id ? modeMap.get(id) : '';
    // @MODE:ROUND_SCORE_MODE_CLASSIFICATION_GUARD
    // Do not trust v_player_round_scores_mode_clean.mode_key by itself for Official rows:
    // legacy Turbo-shaped games must be excluded through v_games_mode_classified.
    if (!classified) return false;
    return classified === modeKey(mode);
  }
  window.__sqFetchPowerRowsFromCleanRoundScores = async function(mode){
    var m = modeKey(mode);
    if (typeof window.sb === 'undefined' || !window.sb || typeof window.sb.from !== 'function') return [];
    var q = await window.sb
      .from('mv_player_round_scores_mode_clean_app')
      .select('mode_key,player,player_key,game_id,created_at,round_index,round_score')
      .order('created_at', { ascending:false })
      .limit(5000);
    if (q.error) throw q.error;
    var modeMap = await classifiedModeMapForRoundRows(q.data || []);
    var cleanRows = (q.data || []).filter(function(r){ return rowMatchesCleanMode(r, m, modeMap); });
    var grouped = new Map();
    cleanRows.forEach(function(r){
      var name = String(r.player || '').trim();
      var key = playerKey(r.player_key || name);
      if (!name || !key) return;
      var bucket = grouped.get(key);
      if (!bucket) {
        bucket = { player:name, playerKey:key, items:[] };
        grouped.set(key, bucket);
      }
      bucket.items.push({
        score: Number(r.round_score || 0),
        ts: r.created_at || '',
        gameId: String(r.game_id || ''),
        roundIndex: Number(r.round_index || 0)
      });
    });
    var rows = Array.from(grouped.values()).map(function(g){
      g.items.sort(function(a,b){
        return (parseTs(b.ts) - parseTs(a.ts)) ||
          String(b.gameId).localeCompare(String(a.gameId)) ||
          (Number(b.roundIndex || 0) - Number(a.roundIndex || 0));
      });
      var latest = g.items.slice(0, 56);
      var total = latest.reduce(function(sum, item){ return sum + (Number(item.score) || 0); }, 0);
      var rounds = latest.length;
      var lastMs = latest.length ? parseTs(latest[0].ts) : 0;
      var avg = rounds ? (total / rounds) : 0;
      return {
        player:g.player,
        playerKey:g.playerKey,
        rounds:rounds,
        powerRank:avg,
        avgRound:avg,
        rankPos:null,
        qualified:true,
        active:true,
        lastPlayedMs:lastMs,
        source:'mv_player_round_scores_mode_clean_app'
      };
    }).filter(function(r){ return r.player && Number.isFinite(r.powerRank) && r.powerRank > 0; });
    rows.sort(function(a,b){
      return (b.powerRank - a.powerRank) ||
        (b.rounds - a.rounds) ||
        String(a.player).localeCompare(String(b.player));
    });
    var rank = 0;
    rows.forEach(function(r){
      rank += 1;
      r.rankPos = rank;
    });
    return rows;
  };
  window.__sqFetchPlayerGameScoresFromCleanRoundScores = async function(mode){
    var m = modeKey(mode);
    if (typeof window.sb === 'undefined' || !window.sb || typeof window.sb.from !== 'function') return [];
    var q = await window.sb
      .from('mv_player_round_scores_mode_clean_app')
      .select('mode_key,player,player_key,game_id,created_at,round_index,round_score')
      .order('created_at', { ascending:false })
      .limit(5000);
    if (q.error) throw q.error;
    var modeMap = await classifiedModeMapForRoundRows(q.data || []);
    var cleanRows = (q.data || []).filter(function(r){ return rowMatchesCleanMode(r, m, modeMap); });
    var byGamePlayer = new Map();
    cleanRows.forEach(function(r){
      var name = String(r.player || '').trim();
      var key = playerKey(r.player_key || name);
      var gameId = String(r.game_id || '');
      if (!name || !key || !gameId) return;
      var id = gameId + '::' + key;
      var row = byGamePlayer.get(id);
      if (!row) {
        row = { player:name, playerKey:key, gameId:gameId, score:0, rounds:0, ts:r.created_at || '' };
        byGamePlayer.set(id, row);
      }
      row.score += Number(r.round_score || 0);
      row.rounds += 1;
      if (parseTs(r.created_at) > parseTs(row.ts)) row.ts = r.created_at || row.ts;
    });
    return Array.from(byGamePlayer.values()).filter(function(r){ return r.score > 0; }).map(function(r){
      var denom = r.rounds > 0 ? r.rounds : (m === 'turbo' ? 7 : 14);
      return {
        player:r.player,
        playerKey:r.playerKey,
        score:r.score,
        avg:r.score / denom,
        avg_round:r.score / denom,
        rounds:denom,
        ts:r.ts,
        game_id:r.gameId
      };
    }).sort(function(a,b){
      return (b.score - a.score) ||
        (parseTs(b.ts) - parseTs(a.ts)) ||
        String(a.player).localeCompare(String(b.player));
    });
  };
  function textOf(el){
    return String((el && (el.textContent || el.innerText)) || '').replace(/\s+/g, ' ').trim();
  }
  function closeLeagueMenu(btn){
    try{
      var bd = btn && btn.closest && btn.closest('.sq-league-rankings-backdrop');
      if (bd) bd.remove();
    }catch(_){}
  }
  function claim(e){
    try{
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }catch(_){}
  }

  window.__sqOpenCanonicalPowerRankings = function(mode){
    var m = modeKey(mode);
    if (typeof window.openPowerRankingsDialog === 'function') return window.openPowerRankingsDialog(m);
    if (typeof window.openPowerLeagueDialog === 'function') return window.openPowerLeagueDialog(m);
    warn('Power Rankings');
  };

  window.__sqOpenCanonicalTurboLeagueScores = function(kind){
    var k = String(kind || '').toLowerCase();
    if (/top\s*50|top50/.test(k)) {
      if (typeof window.openTop50ScoresDialog === 'function') return window.openTop50ScoresDialog('turbo');
      warn('Turbo Top 50 Scores');
      return;
    }
    if (/latest/.test(k)) {
      if (typeof window.openLatestScoresDialog === 'function') return window.openLatestScoresDialog('turbo');
      warn('Turbo Latest Scores');
      return;
    }
    if (/high\s*score|hsl/.test(k)) {
      if (typeof window.openHighScoreLeagueDialog === 'function') return window.openHighScoreLeagueDialog('turbo');
      warn('Turbo High Score League');
      return;
    }
    return window.__sqOpenCanonicalPowerRankings('turbo');
  };

  function wireLeagueMenu(root){
    try{
      var scope = root || document;
      var power = scope.querySelector && scope.querySelector('#powerRankingsBtn, #leaguePowerRankingsBtn');
      if (power && !power.__sqRankingsTurboRoutingFix){
        power.__sqRankingsTurboRoutingFix = true;
        power.addEventListener('click', function(e){
          claim(e);
          closeLeagueMenu(power);
          window.__sqOpenCanonicalPowerRankings('official');
        }, true);
      }
      Array.prototype.slice.call(scope.querySelectorAll ? scope.querySelectorAll('button, [role="button"], [data-action]') : []).forEach(function(btn){
        if (btn.__sqTurboLeagueRoutingFix) return;
        var label = textOf(btn);
        var action = String(btn.getAttribute('data-action') || '');
        var id = String(btn.id || '');
        var hay = (id + ' ' + action + ' ' + label).toLowerCase();
        // START GAME > TOURNAMENT contains the word TURBO in its description, but it is
        // not a League & Rankings Turbo button. Exclude the Start Game modal from this catch-all.
        if (id === 'tournamentBtn' || (btn.closest && btn.closest('#startGameModal, .sg-options'))) return;
        if (hay.indexOf('turbo') < 0) return;
        if (btn.closest && btn.closest('.sq132-tabs, .sq-fix100-top50, .sq-top50-backdrop, .sq-latest-scores, .sq-streak-controls')) return;
        btn.__sqTurboLeagueRoutingFix = true;
        btn.addEventListener('click', function(e){
          claim(e);
          closeLeagueMenu(btn);
          window.__sqOpenCanonicalTurboLeagueScores(hay);
        }, true);
      });
    }catch(e){ try{ console.warn('[SQ] League rankings routing wire failed', e); }catch(_){} }
  }

  var oldLeague = window.openLeagueRankingsDialog;
  if (typeof oldLeague === 'function' && !oldLeague.__sqRankingsTurboRoutingFix){
    window.openLeagueRankingsDialog = function(){
      var result = oldLeague.apply(this, arguments);
      setTimeout(function(){ wireLeagueMenu(document); }, 0);
      setTimeout(function(){ wireLeagueMenu(document); }, 80);
      return result;
    };
    window.openLeagueRankingsDialog.__sqRankingsTurboRoutingFix = true;
    try { openLeagueRankingsDialog = window.openLeagueRankingsDialog; } catch(_) {}
  }

  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('button, [role="button"], [data-action], .home-mini-printer') : null;
    if (!btn) return;
    if (btn.closest && btn.closest('.sq132-tabs, .sq-fix100-top50, .sq-top50-backdrop, .sq-latest-scores, .sq-streak-controls')) return;
    var label = textOf(btn);
    var action = String(btn.getAttribute && btn.getAttribute('data-action') || '');
    var id = String(btn.id || '');
    var aria = String(btn.getAttribute && btn.getAttribute('aria-label') || '');
    var hay = (id + ' ' + action + ' ' + aria + ' ' + label).toLowerCase();

    // Do not let League/Power routing claim Start Game modal options.
    if (id === 'tournamentBtn' || (btn.closest && btn.closest('#startGameModal, .sg-options'))) return;

    if (id === 'powerRankingsBtn' || id === 'leaguePowerRankingsBtn' || /\bpower rankin(?:g|s|gs)\b/.test(hay)) {
      if (btn.closest && btn.closest('.sq-league-rankings-backdrop, #details, .home-mini-printer')) {
        claim(e);
        closeLeagueMenu(btn);
        window.__sqOpenCanonicalPowerRankings('official');
      }
      return;
    }

    if (btn.closest && btn.closest('.sq-league-rankings-backdrop') && hay.indexOf('turbo') >= 0) {
      claim(e);
      closeLeagueMenu(btn);
      window.__sqOpenCanonicalTurboLeagueScores(hay);
    }
  }, true);

  function bootWire(){ wireLeagueMenu(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootWire, { once:true });
  else bootWire();
  setTimeout(bootWire, 120);
  setTimeout(bootWire, 500);
})();
// >>> PATCH:rankings-turbo-routing-fix END
