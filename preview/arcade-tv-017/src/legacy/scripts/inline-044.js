
// >>> PATCH:FIX169_POWER_RANKINGS_CURRENT_CLEAN_SOURCE START
(function(){
  'use strict';
  if (window.__sqFix169PowerRankingsCurrentCleanSource) return;
  window.__sqFix169PowerRankingsCurrentCleanSource = true;

  var OFFICIAL_VIEW = 'v_power_rankings_official_current_clean';
  var TURBO_VIEW = 'v_power_rankings_last56_turbo_clean';
  var PRACTICE_VIEW = 'v_power_rankings_last56_practice_clean';
  var ACTIVE_DAYS = 14;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function key(s){ return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,''); }
  function parseTs(ts){
    try{
      if (!ts) return 0;
      if (typeof window.__sqParsePowerRankTs === 'function') {
        var n0 = Number(window.__sqParsePowerRankTs(ts));
        if (Number.isFinite(n0) && n0 > 0) return n0;
      }
      var s = String(ts).trim();
      if (/^\d{4}-\d{2}-\d{2}\s/.test(s) && s.indexOf('T') < 0) s = s.replace(' ', 'T');
      if (/[+-]\d{2}$/.test(s)) s += ':00';
      var n = Date.parse(s);
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }
  function isActive(ms){ return Number.isFinite(ms) && ms >= (Date.now() - ACTIVE_DAYS*24*60*60*1000); }
  function modeView(mode){
    var m = String(mode || 'official').toLowerCase();
    if (m === 'turbo') return TURBO_VIEW;
    if (m === 'practice' || m === 'classic') return PRACTICE_VIEW;
    return OFFICIAL_VIEW;
  }
  window.__sqPowerRankingCleanViewForMode = modeView;

  function mapPowerRow(row, mode, index){
    var m = String(mode || 'official').toLowerCase();
    var name = String(row.player || row.player_name || row.name || '').trim();
    var playerKey = key(row.player_key || name);
    var rounds = Number(row.rounds_used ?? row.rounds ?? 0);
    var total = Number(row.total_points ?? row.totalPoints ?? 0);
    var avg = Number(row.avg_per_round ?? row.power_rank ?? row.powerRank ?? row.avgRound ?? row.avg ?? NaN);
    if (!Number.isFinite(avg) && Number.isFinite(total) && rounds > 0) avg = total / rounds;
    var lastMs = parseTs(row.last_played_at || row.lastPlayedAt || row.best_ts || row.ts || row.created_at);
    var rankPos = Number(row.rank_pos ?? row.rankPos ?? 0) || (index + 1);
    return {
      player: name,
      playerKey: playerKey,
      gamesUsed: Number(row.games_used ?? row.source_games ?? 0) || null,
      rounds: Number.isFinite(rounds) ? rounds : 0,
      totalPoints: Number.isFinite(total) ? total : 0,
      powerRank: Number.isFinite(avg) ? avg : 0,
      avgRound: Number.isFinite(avg) ? avg : 0,
      avg_per_round: Number.isFinite(avg) ? avg : 0,
      rankPos: rankPos,
      qualified: m === 'official' ? (Number(rounds) >= 28) : (Number(rounds) > 0),
      active: m === 'official' ? isActive(lastMs) : true,
      lastPlayedMs: lastMs,
      recentMs: lastMs,
      latestScores: row.latest_scores || row.latestScores || null,
      sourceGameIds: row.source_game_ids || row.sourceGameIds || null,
      source: modeView(m)
    };
  }

	  async function ensureClient(){
	    try{ if (typeof window.ensureCloudInit === 'function') window.ensureCloudInit(); }catch(_){ }
	    return window.sb || (typeof sb !== 'undefined' ? sb : null);
	  }

	  var POWER_OFFICIAL_FETCH_TTL_MS = 60 * 1000;
	  window.__sqPowerOfficialFetchInFlight = window.__sqPowerOfficialFetchInFlight || null;
	  window.__sqPowerOfficialFetchCache = Array.isArray(window.__sqPowerOfficialFetchCache) ? window.__sqPowerOfficialFetchCache : null;
	  window.__sqPowerOfficialFetchAt = Number(window.__sqPowerOfficialFetchAt || 0);
	  window.__sqPowerOfficialFetchGeneration = Number(window.__sqPowerOfficialFetchGeneration || 0);

	  function clonePowerRows(rows){
	    return Array.isArray(rows) ? rows.map(function(r){ return Object.assign({}, r); }) : [];
	  }

	  window.__sqInvalidatePowerOfficialFetchCache = function(reason){
	    window.__sqPowerOfficialFetchGeneration = Number(window.__sqPowerOfficialFetchGeneration || 0) + 1;
	    window.__sqPowerOfficialFetchInFlight = null;
	    window.__sqPowerOfficialFetchCache = null;
	    window.__sqPowerOfficialFetchAt = 0;
	    try{ console.debug && console.debug('[power] official runtime fetch cache invalidated', reason || 'unspecified'); }catch(_){}
	  };

	  async function fetchPowerRowsUncached(mode){
	    var m = String(mode || 'official').toLowerCase();
	    var client = await ensureClient();
	    if (!client || typeof client.from !== 'function') return [];
    var view = modeView(m);
    // @MODE:POWER_RANKINGS_CURRENT_CLEAN_SOURCE
    // Official Power Rankings use latest 4 clean official games / 56 via v_power_rankings_official_current_clean.
    // Do not call v_power_rankings_last56_official_clean or round-score fallbacks for Official display.
    var q = await client.from(view)
      .select('player_key,player,games_used,rounds_used,total_points,avg_per_round,last_played_at,latest_scores,source_game_ids,rank_pos')
      .limit(500);
    if (q.error) {
      // Turbo/Practice legacy clean views do not have games_used/latest_scores. Retry with common columns.
      q = await client.from(view)
        .select('player,player_key,rounds_used,total_points,avg_per_round,last_played_at,rank_pos,source_games,source_game_ids')
        .limit(500);
    }
    if (q.error) throw q.error;
    var rows = (q.data || []).map(function(r,i){ return mapPowerRow(r,m,i); })
      .filter(function(r){ return r.player && Number.isFinite(r.powerRank) && r.powerRank > 0; });
    rows.sort(function(a,b){
      return (Number(a.rankPos||9999) - Number(b.rankPos||9999)) ||
        (b.powerRank - a.powerRank) ||
        (b.rounds - a.rounds) ||
        String(a.player).localeCompare(String(b.player));
    });
	    rows.forEach(function(r,i){ if (!r.rankPos) r.rankPos = i + 1; });
	    return rows;
	  }

	  async function fetchPowerRows(mode){
	    var m = String(mode || 'official').toLowerCase();
	    if (m !== 'official') return fetchPowerRowsUncached(mode);

	    var now = Date.now();
	    if (window.__sqPowerOfficialFetchCache && (now - window.__sqPowerOfficialFetchAt) < POWER_OFFICIAL_FETCH_TTL_MS){
	      return clonePowerRows(window.__sqPowerOfficialFetchCache);
	    }
	    if (window.__sqPowerOfficialFetchInFlight){
	      return clonePowerRows(await window.__sqPowerOfficialFetchInFlight);
	    }

	    var generation = Number(window.__sqPowerOfficialFetchGeneration || 0);
	    var fetchPromise = fetchPowerRowsUncached(mode).then(function(rows){
	      var cleanRows = clonePowerRows(rows);
	      if (generation === Number(window.__sqPowerOfficialFetchGeneration || 0)){
	        window.__sqPowerOfficialFetchCache = clonePowerRows(cleanRows);
	        window.__sqPowerOfficialFetchAt = Date.now();
	      }
	      return cleanRows;
	    }, function(err){
	      throw err;
	    });

	    window.__sqPowerOfficialFetchInFlight = fetchPromise;
	    try{
	      return clonePowerRows(await fetchPromise);
	    }finally{
	      if (window.__sqPowerOfficialFetchInFlight === fetchPromise) window.__sqPowerOfficialFetchInFlight = null;
	    }
	  }

	  window.__sqPowerRankingRowsFromCleanView = fetchPowerRows;

  window.getOfficialPowerRows = async function getOfficialPowerRows(){
    try{
      var rows = await fetchPowerRows('official');
      return rows.map(function(r){
        return {
          player:r.player,
          playerKey:r.playerKey,
          rounds:r.rounds,
          avgRound:r.powerRank,
          powerRank:r.powerRank,
          recentMs:r.lastPlayedMs,
          lastPlayedMs:r.lastPlayedMs,
          rankPos:r.rankPos,
          qualifiesRounds:r.qualified,
          qualifiesRecent:r.active,
          active:r.active,
          source:r.source
        };
      });
    }catch(e){
      try{ console.warn('[SQ] Official Power Rankings current clean source unavailable', e); }catch(_){ }
      return [];
    }
  };

  function note(mode){
    if (mode === 'turbo') return 'Turbo Power Rank = DB-derived Turbo rows only. Turbo never appears in Official.';
    if (mode === 'practice') return 'Practice Power Rank = DB-derived Practice rows only.';
    return 'Official Power Rank = saved players only; latest 4 clean official games divided by 56. Inactive players are greyed out at the bottom.';
  }

  function __sqOpenPowerRankingsCurrentClean(initialMode){
    var mode = ['official','turbo','practice'].indexOf(String(initialMode||'').toLowerCase()) >= 0 ? String(initialMode).toLowerCase() : 'official';
    try{if(typeof window.__sqCleanupLeagueRankingsOverlays==='function')window.__sqCleanupLeagueRankingsOverlays();}catch(_){}
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop sq132-bd';
    var modal = document.createElement('div');
    modal.className = 'modal sq132-modal';
    bd.appendChild(modal);
    modal.innerHTML = '<div class="sq132-head"><div class="sq132-title"><h3>Power Rankings</h3><div class="sq132-sub">Recent form by round average.</div></div><div class="sq132-tabs"><button type="button" data-mode="official">Official</button><button type="button" data-mode="turbo">Turbo</button><button type="button" data-mode="practice">Practice</button></div></div><div class="sq132-body"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div><div class="sq132-footer"><button type="button" class="btn sq132-back">Back</button><button type="button" class="btn sq132-close">Close</button></div>';
    document.body.appendChild(bd);
    try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(bd,modal,function(){bd.remove();});}catch(_){}
    var body = modal.querySelector('.sq132-body');
    var tabs = modal.querySelector('.sq132-tabs');
    function syncTabs(){ Array.prototype.forEach.call(tabs.querySelectorAll('button'), function(b){ b.classList.toggle('active', b.dataset.mode === mode); }); }
    var reduced = false;
    try{ reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ }
    function pwCount(el, target, dec, dur){
      if (reduced || !Number.isFinite(target)){ el.textContent = Number(target||0).toFixed(dec); return; }
      var t0 = performance.now();
      (function step(t){
        var p = Math.min(1, (t - t0) / dur);
        el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    function parseLatest(ls){
      try{
        if (!ls) return [];
        var a = Array.isArray(ls) ? ls : (typeof ls === 'string' ? (ls.trim().charAt(0) === '[' ? JSON.parse(ls) : ls.split(/[,;\/]/)) : []);
        return a.map(Number).filter(Number.isFinite).slice(0, 4);
      }catch(_){ return []; }
    }
    async function render(){
      syncTabs();
      body.innerHTML = '<div class="sq132-note">'+esc(note(mode))+'</div><div class="pw-arena"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div>';
      var arena = body.querySelector('.pw-arena');
      var rows = [];
      try{ rows = await fetchPowerRows(mode); }catch(e){ try{ console.warn('[SQ] Power Rankings modal source unavailable', mode, e); }catch(_){ } rows = []; }
      if (!rows.length){
        arena.innerHTML = '<p class="tag">Power Rankings data is not available yet for '+esc(mode)+'. Required clean Supabase view/data source is missing or empty.</p>';
        return;
      }
      var display = rows.slice().sort(function(a,b){
        return ((b.active !== false) - (a.active !== false)) ||
          ((b.qualified ? 1 : 0) - (a.qualified ? 1 : 0)) ||
          (Number(a.rankPos||9999) - Number(b.rankPos||9999)) ||
          (b.powerRank - a.powerRank) ||
          String(a.player).localeCompare(String(b.player));
      });
      var ranked = display.filter(function(r){ return r.active !== false && r.qualified !== false; });
      var benched = display.filter(function(r){ return !(r.active !== false && r.qualified !== false); });
      var maxAvg = ranked.concat(benched).reduce(function(m,r){ return Math.max(m, Number(r.powerRank)||0); }, 0) || 1;
      arena.innerHTML = '';

      // Podium: 2nd | 1st | 3rd, medal blocks rising with a sheen; crown on #1.
      var podium = ranked.slice(0, 3);
      if (podium.length >= 2){
        var pod = document.createElement('div'); pod.className = 'pw-podium';
        var order = podium.length >= 3 ? [1, 0, 2] : [1, 0];
        order.forEach(function(ix){
          var r = podium[ix]; if (!r) return;
          var col = document.createElement('div'); col.className = 'pw-pod p' + (ix + 1);
          if (ix === 0){ var crown = document.createElement('div'); crown.className = 'pw-pod-crown'; crown.textContent = '👑'; col.appendChild(crown); }
          var nm = document.createElement('div'); nm.className = 'pw-pod-name'; nm.textContent = r.player;
          var av = document.createElement('div'); av.className = 'pw-pod-avg';
          pwCount(av, Number(r.powerRank)||0, 2, 900 + ix * 150);
          var blk = document.createElement('div'); blk.className = 'pw-pod-block';
          var rk = document.createElement('div'); rk.className = 'pw-pod-rank'; rk.textContent = String(r.rankPos || (ix + 1));
          blk.appendChild(rk);
          col.append(nm, av, blk);
          pod.appendChild(col);
        });
        arena.appendChild(pod);
      }

      // Full ranked list (podium included so the table stays complete), then
      // inactive/unranked dimmed at the bottom.
      var list = document.createElement('div'); list.className = 'pw-list';
      var rowIx = 0;
      function addRow(r, i, isBenched){
        var pos = r.rankPos || (i + 1);
        var row = document.createElement('div');
        row.className = 'pw-row' + (!isBenched && pos <= 3 ? ' top3' : '') + (isBenched ? ' benched' : '');
        row.style.animationDelay = Math.min(700, rowIx * 45) + 'ms';
        var rank = document.createElement('div'); rank.className = 'pw-rank' + (!isBenched && pos <= 3 ? ' g' + pos : '');
        rank.textContent = '#' + pos;
        var main = document.createElement('div'); main.className = 'pw-row-main';
        var top = document.createElement('div'); top.className = 'pw-row-top';
        var nm = document.createElement('div'); nm.className = 'pw-row-name'; nm.textContent = r.player;
        top.appendChild(nm);
        var latest = parseLatest(r.latestScores);
        if (latest.length){
          var chips = document.createElement('div'); chips.className = 'pw-chips';
          latest.forEach(function(s){ var c = document.createElement('span'); c.className = 'pw-chip'; c.textContent = String(Math.round(s)); chips.appendChild(c); });
          top.appendChild(chips);
        }
        if (isBenched){
          var tag = document.createElement('span'); tag.className = 'pw-tag';
          tag.textContent = (r.qualified === false) ? 'Unranked' : 'Inactive';
          top.appendChild(tag);
        }
        var bar = document.createElement('div'); bar.className = 'pw-bar';
        var fill = document.createElement('span'); bar.appendChild(fill);
        var w = Math.max(3, Math.min(100, (Number(r.powerRank)||0) / maxAvg * 100)) + '%';
        if (reduced) fill.style.width = w;
        else requestAnimationFrame(function(){ requestAnimationFrame(function(){ fill.style.width = w; }); });
        main.append(top, bar);
        if (r.gamesUsed || r.rounds){
          var sub = document.createElement('div'); sub.className = 'pw-row-sub';
          sub.textContent = (r.gamesUsed ? r.gamesUsed + (r.gamesUsed === 1 ? ' game' : ' games') : '') + (r.gamesUsed && r.rounds ? ' · ' : '') + (r.rounds ? r.rounds + (r.rounds === 1 ? ' round' : ' rounds') : '');
          main.appendChild(sub);
        }
        var av = document.createElement('div'); av.className = 'pw-avg';
        pwCount(av, Number(r.powerRank)||0, 2, 750);
        row.append(rank, main, av);
        list.appendChild(row);
        rowIx++;
      }
      ranked.forEach(function(r, i){ addRow(r, i, false); });
      benched.forEach(function(r, i){ addRow(r, ranked.length + i, true); });
      arena.appendChild(list);
    }
    tabs.onclick = function(e){ var b = e.target.closest && e.target.closest('button[data-mode]'); if (!b) return; mode = b.dataset.mode; render(); };
    modal.querySelector('.sq132-back').onclick = function(){ bd.remove(); try{ if (typeof window.openLeagueRankingsDialog === 'function') window.openLeagueRankingsDialog(); }catch(_){ } };
    modal.querySelector('.sq132-close').onclick = function(){ bd.remove(); };
    bd.addEventListener('click', function(e){ if (e.target === bd) bd.remove(); });
    render();
  };
  window.openPowerLeagueDialog = __sqOpenPowerRankingsCurrentClean;
  window.openPowerRankingsDialog = __sqOpenPowerRankingsCurrentClean;
  try{ openPowerLeagueDialog = window.openPowerLeagueDialog; }catch(_){ }
  try{ openPowerRankingsDialog = window.openPowerRankingsDialog; }catch(_){ }
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('#leaguePowerRankingsBtn,[data-action="power-rankings"],[data-open="power-rankings"]') : null;
    if (!b) return;
    try{ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); }catch(_){ }
    window.openPowerRankingsDialog('official');
  }, true);

  window.__sqDebugPowerRankings = async function __sqDebugPowerRankings(){
    var out = {};
    for (var i=0;i<['official','turbo','practice'].length;i++){
      var m = ['official','turbo','practice'][i];
      try{
        var rows = await fetchPowerRows(m);
        out[m] = { view: modeView(m), count: rows.length, top5: rows.slice(0,5) };
      }catch(e){ out[m] = { view: modeView(m), error: String(e && (e.message || e) || e) }; }
    }
    return out;
  };
})();
// <<< PATCH:FIX169_POWER_RANKINGS_CURRENT_CLEAN_SOURCE END
