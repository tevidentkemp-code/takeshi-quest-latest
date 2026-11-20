
(function(){
  if (window.__sqFix74TournamentSteppedFlow) return;
  window.__sqFix74TournamentSteppedFlow = true;

  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function playerName(p){ return String((p && (p.name || p.player || p.label)) || p || '').trim(); }
  function gameTs(g){ try{ return new Date(g.created_at || g.ts || g.completed_at || (g.raw && g.raw.created_at) || 0); }catch(_){ return new Date(0); } }
  function gamePlayers(g){ return Array.isArray(g && g.players) ? g.players : (Array.isArray(g && g.state && g.state.players) ? g.state.players : []); }
  function gameTotals(g){ return Array.isArray(g && g.totals) ? g.totals : (Array.isArray(g && g.state && g.state.totals) ? g.state.totals : []); }

  async function getTournamentPlayers(){
    try{ if (typeof cloudListPlayers === 'function'){ const rows = await cloudListPlayers(); if (Array.isArray(rows) && rows.length) return rows; } }catch(e){ console.warn('[SQ] tournament cloud players failed', e); }
    try{ if (typeof getSavedPlayers === 'function') return getSavedPlayers() || []; }catch(_){ }
    return [];
  }

  async function getMonthlyPremierRankMap(){
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let games = [];
    try{ if (typeof getGamesForMode === 'function') games = await getGamesForMode('official'); }catch(e){ console.warn('[SQ] tournament rank games failed', e); }
    const agg = new Map();
    (Array.isArray(games) ? games : []).forEach(function(g){
      const d = gameTs(g);
      if (!d || Number.isNaN(d.getTime()) || d.getFullYear() !== y || d.getMonth() !== m) return;
      const ps = gamePlayers(g), totals = gameTotals(g);
      if (!ps.length || !totals.length) return;
      ps.forEach(function(p, idx){
        const name = playerName(p); const key = norm(name); const score = Number(totals[idx] || 0);
        if (!key || !Number.isFinite(score)) return;
        const rec = agg.get(key) || { name:name, games:0, total:0, avg:0, rank:999 };
        rec.games += 1; rec.total += score; rec.avg = rec.total / rec.games;
        agg.set(key, rec);
      });
    });
    const sorted = Array.from(agg.values()).sort(function(a,b){ return (b.avg-a.avg) || (b.games-a.games) || a.name.localeCompare(b.name); });
    let rank = 0, lastAvg = null;
    sorted.forEach(function(r, idx){ if (lastAvg === null || Math.abs(r.avg-lastAvg) > 1e-9) rank = idx + 1; r.rank = rank; lastAvg = r.avg; });
    const map = new Map(); sorted.forEach(function(r){ map.set(norm(r.name), r); });
    return map;
  }

  function seedPairs(seedRows, size){
    const half = Math.floor(size / 2);
    const top = seedRows.slice(0, half);
    const bottom = seedRows.slice(half);
    for (let i = bottom.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = bottom[i]; bottom[i] = bottom[j]; bottom[j] = t; }
    return top.map(function(p, idx){ return [p, bottom[idx]]; }).filter(function(pair){ return pair[0] && pair[1]; });
  }

  function choiceButton(title, desc, active){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sg-tournament-pill' + (active ? ' active' : '');
    b.innerHTML = '<div class="sg-tournament-pill-title">'+esc(title)+'</div><div class="sg-tournament-pill-desc">'+esc(desc)+'</div>';
    return b;
  }

  function restoreStartGameOptions(){
    try{ if (typeof arrangeStartActions === 'function') arrangeStartActions(); }catch(e){ console.warn('[SQ] tournament main menu restore failed', e); }
    setTimeout(function(){ try{ bindTournamentButton(); }catch(_){} }, 0);
  }

  async function openTournamentSteppedSetup(){
    const body = document.getElementById('startGameModalBody');
    if (!body) return;
    const draft = {
      step: 0,
      type: null,
      size: null,
      selected: new Map(),
      players: await getTournamentPlayers(),
      ranks: await getMonthlyPremierRankMap(),
      drawKey: null,
      drawPairs: null
    };

    function selectedSeeded(){
      return Array.from(draft.selected.values()).sort(function(a,b){
        const ra = a.rankData ? a.rankData.rank : 999;
        const rb = b.rankData ? b.rankData.rank : 999;
        return (ra-rb) || a.name.localeCompare(b.name);
      }).map(function(x, idx){ return Object.assign({}, x, { seed: idx + 1 }); });
    }

    function shuffleTournamentDraw(list){
      const arr = (list || []).slice();
      for (let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    function tournamentDrawKey(seeded, size){
      return String(size) + '|' + (seeded || []).map(function(p){ return String(p.seed)+':' + norm(p.name || ''); }).join('|');
    }

    function stableRandomSeedPairs(seeded, size){
      const key = tournamentDrawKey(seeded, size);
      if (!draft.drawPairs || draft.drawKey !== key){
        const half = Math.floor(size / 2);
        const top = seeded.slice(0, half);
        const bottom = shuffleTournamentDraw(seeded.slice(half));
        draft.drawPairs = top.map(function(p, idx){
          return [Number(p.seed), Number(bottom[idx] && bottom[idx].seed)];
        }).filter(function(pair){ return pair[0] && pair[1]; });
        draft.drawKey = key;
      }
      const bySeed = new Map((seeded || []).map(function(p){ return [Number(p.seed), p]; }));
      return (draft.drawPairs || []).map(function(pair){ return [bySeed.get(Number(pair[0])), bySeed.get(Number(pair[1]))]; }).filter(function(pair){ return pair[0] && pair[1]; });
    }

    function currentRules(){
      return draft.type === 'turbo'
        ? { startRoundIndex:7, startTarget:'17', throwLimitSeconds:20, strictTimer:true }
        : { startRoundIndex:0, startTarget:'10', throwLimitSeconds:null, strictTimer:false };
    }

    function saveDraft(){
      if (!draft.type || !draft.size || draft.selected.size !== draft.size){ window.__sqTournamentDraft = null; return null; }
      const seeded = selectedSeeded();
      window.__sqTournamentDraft = {
        type: draft.type,
        size: draft.size,
        players: seeded.map(function(x){ return { name:x.name, seed:x.seed, rank:x.rankData ? x.rankData.rank : null, avg:x.rankData ? x.rankData.avg : null, games:x.rankData ? x.rankData.games : 0 }; }),
        rules: currentRules(),
        drawMode: 'random-top-half-vs-bottom-half',
        bracket: stableRandomSeedPairs(seeded, draft.size).map(function(pair, idx){ return { match: idx + 1, a: pair[0], b: pair[1] }; }),
        createdAt: new Date().toISOString()
      };
      return window.__sqTournamentDraft;
    }

    function setHead(title, sub){
      return '<div class="sg-tournament-intro"><div class="sg-tournament-title">'+esc(title)+'</div>' + (sub ? '<div class="sg-tournament-sub">'+esc(sub)+'</div>' : '') + '</div>';
    }

    function footer(nextEnabled, onBack, onNext, nextText){
      const ft = document.createElement('div');
      ft.className = 'modal-footer sg-practice-footer';
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'btn'; back.textContent = 'Back';
      back.onclick = function(e){ e.preventDefault(); onBack(); };
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'btn primary'; next.textContent = nextText || 'Next';
      next.disabled = !nextEnabled;
      next.title = nextEnabled ? '' : 'Complete this step first';
      next.onclick = function(e){ e.preventDefault(); if (!nextEnabled){ try{ toast('Complete this step first.'); }catch(_){} return; } onNext(); };
      ft.append(back, next);
      return ft;
    }

    // Back-only footer: single-select steps advance the instant a choice is
    // pushed (same as Match Play / Practice), so the only control is Back.
    function backFooter(onBack){
      const ft = document.createElement('div');
      ft.className = 'modal-footer sg-practice-footer';
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'btn ms2-back';
      back.innerHTML = '<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>';
      back.onclick = function(e){ e.preventDefault(); onBack(); };
      ft.append(back);
      return ft;
    }

    function renderType(){
      draft.step = 0;
      body.innerHTML = setHead('TOURNAMENT MODE');
      const wrap = document.createElement('div'); wrap.className = 'sg-tournament-controls sg-tournament-controls-with-rules';
      const classic = choiceButton('CLASSIC (BETA)', 'Standard Shateki Quest knockout tournament.', draft.type === 'classic');
      const turbo = choiceButton('TURBO (BETA)', 'Starts at round 8 / 17s. Strict 20 seconds per throw.', draft.type === 'turbo');
      classic.insertAdjacentHTML('beforeend', '<div class="sg-tournament-inline-rule"><b>Classic rules:</b><span>• Standard game</span><span>• Knockout format.</span></div>');
      turbo.insertAdjacentHTML('beforeend', '<div class="sg-tournament-inline-rule"><b>Turbo rules:</b><span>• Starts at 17s</span><span>• Strict 20 seconds per throw.</span></div>');
      classic.onclick = function(){ draft.type = 'classic'; renderSize(); };
      turbo.onclick = function(){ draft.type = 'turbo'; renderSize(); };
      wrap.append(classic, turbo);
      body.append(wrap);
      body.append(backFooter(restoreStartGameOptions));
    }

    function renderSize(){
      draft.step = 1;
      body.innerHTML = setHead('TOURNAMENT SIZE');
      const wrap = document.createElement('div'); wrap.className = 'sg-tournament-controls';
      const four = choiceButton('4 PLAYERS', 'Semi-final → Final.', draft.size === 4);
      const eight = choiceButton('8 PLAYERS', 'Quarter-final → Semi-final → Final.', draft.size === 8);
      four.onclick = function(){ draft.size = 4; while(draft.selected.size > 4){ draft.selected.delete(Array.from(draft.selected.keys()).pop()); } renderPlayers(); };
      eight.onclick = function(){ draft.size = 8; renderPlayers(); };
      wrap.append(four, eight);
      body.append(wrap, backFooter(renderType));
    }

    function renderPlayers(){
      draft.step = 2;
      body.innerHTML = setHead('SELECT PLAYERS', 'Select exactly '+draft.size+' players. Seeds use this month\'s Premier League position.');
      const count = document.createElement('div');
      count.className = 'sg-tournament-selected-count';
      const grid = document.createElement('div'); grid.className = 'sg-tournament-player-grid';
      const sorted = (draft.players || []).slice().sort(function(a,b){
        const an = playerName(a), bn = playerName(b);
        const ar = draft.ranks.get(norm(an)); const br = draft.ranks.get(norm(bn));
        const ra = ar ? ar.rank : 999; const rb = br ? br.rank : 999;
        return (ra-rb) || an.localeCompare(bn);
      });
      const ft = footer(draft.selected.size === draft.size, renderSize, renderTree);
      const nextBtn = ft.querySelector('button.primary');
      if (nextBtn){
        nextBtn.onclick = function(e){
          e.preventDefault();
          if (draft.selected.size !== draft.size){ try{ toast('Select exactly '+draft.size+' players.'); }catch(_){} return; }
          renderTree();
        };
      }
      function syncSelectionUi(){
        count.textContent = draft.selected.size + '/' + draft.size;
        if (nextBtn){
          const ok = draft.selected.size === draft.size;
          nextBtn.disabled = !ok;
          nextBtn.title = ok ? '' : 'Complete this step first';
        }
      }
      sorted.forEach(function(p){
        const name = playerName(p); if (!name) return;
        const key = norm(name); const r = draft.ranks.get(key); const on = draft.selected.has(key);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sg-tournament-player' + (on ? ' active' : '');
        b.innerHTML = '<div class="sg-tournament-player-name">'+esc(name)+'</div><div class="sg-tournament-player-meta">MONTHLY PL: '+(r ? '#'+r.rank+' · AVG '+r.avg.toFixed(1)+' · '+r.games+' games' : 'UNRANKED')+'</div>';
        b.onclick = function(e){
          try{ e.preventDefault(); }catch(_){}
          if (draft.selected.has(key)){
            draft.selected.delete(key);
            b.classList.remove('active');
          } else {
            if (draft.selected.size >= draft.size){ try{ toast('Tournament is full. Remove a player first.'); }catch(_){} return; }
            draft.selected.set(key, { raw:p, name:name, rankData:r || null });
            b.classList.add('active');
          }
          draft.drawKey = null; draft.drawPairs = null;
          syncSelectionUi();
        };
        grid.appendChild(b);
      });
      syncSelectionUi();
      body.append(count, grid, ft);
    }

    function tournamentRoundName(size, matchNo){
      if (size === 4) return matchNo <= 2 ? 'Semi-final' : 'Final';
      if (size === 8) return matchNo <= 4 ? 'Quarter-final' : (matchNo <= 6 ? 'Semi-final' : 'Final');
      return 'Tournament Match';
    }

    function playerForTournamentGame(seedPlayer){
      const name = String(seedPlayer && seedPlayer.name || '').trim();
      const raw = seedPlayer && seedPlayer.raw ? seedPlayer.raw : {};
      const parts = (typeof __sqNameParts === 'function') ? __sqNameParts(name) : { first:name, last:'' };
      const first = String(raw.first_name || raw.first || '').trim() || parts.first || name;
      const last  = String(raw.last_name || raw.last || '').trim() || parts.last || '';
      const nick  = String(raw.nickname || '').trim();
      const init  = (typeof __sqNormalizeInitials === 'function') ? __sqNormalizeInitials(raw.initials, name) : name.slice(0,2).toUpperCase();
      return {
        type: raw.type || 'registered',
        id: raw.id != null ? raw.id : null,
        name: name,
        first_name: first,
        last_name: last,
        nickname: nick,
        initials: init,
        color: null,
        tournamentSeed: seedPlayer && seedPlayer.seed ? seedPlayer.seed : null,
        tournamentRank: seedPlayer && seedPlayer.rankData ? seedPlayer.rankData.rank : null
      };
    }

    function startTournamentFirstMatch(){
      const saved = saveDraft();
      if (!saved || !Array.isArray(saved.bracket) || !saved.bracket.length){
        try{ toast('Tournament draft is not ready.'); }catch(_){}
        return;
      }
      const firstMatch = saved.bracket[0];
      if (!firstMatch || !firstMatch.a || !firstMatch.b){
        try{ toast('First tournament match is missing players.'); }catch(_){}
        return;
      }

      try{ window.__sqSelectedMode = 'official'; }catch(_){}

      state.players = [playerForTournamentGame(firstMatch.a), playerForTournamentGame(firstMatch.b)];
      try{ assignUniqueColors(state.players); }catch(_){}

      const matchId = (typeof genUuidV4 === 'function') ? genUuidV4() : ('tournament-' + Date.now());
      state.match = {
        id: matchId,
        mode: 'official',
        tournament: true,
        tournamentType: saved.type,
        tournamentSize: saved.size,
        tournamentRound: tournamentRoundName(saved.size, firstMatch.match),
        tournamentMatch: firstMatch.match,
        tournamentRules: saved.rules || {},
        forcePractice: false,
        practiceType: null,
        createdAtIso: (typeof _tsOverride !== 'undefined' && _tsOverride) ? _tsOverride : new Date().toISOString(),
        targetWins: 1,
        gameNumber: 1,
        wins: Array.from({ length: state.players.length }, () => 0),
        history: [],
        completedLogged: false
      };
      state.__sqTournamentDraft = saved;
      state.__sqTournamentActive = {
        tournamentId: matchId,
        type: saved.type,
        size: saved.size,
        currentMatch: firstMatch.match,
        currentRound: state.match.tournamentRound,
        bracket: saved.bracket
      };
      state.matchAgg = null;
      try{ ensureMatchAgg(); }catch(_){}

      try{
        const p = document.getElementById('liveV2Panel');
        if (p){ p.dataset.built = '0'; p.dataset.pcount = ''; p.innerHTML = ''; }
      }catch(_){}

      try{ if (typeof closeModal === 'function') closeModal('startGameModal'); }catch(_){}
      try{ startNewGame(false); }catch(e){ console.error('[SQ] Tournament start failed', e); try{ toast('Tournament start failed. Check console.'); }catch(_){} }
      try{ setupStartMenuButtons(); }catch(_){}
      try{ save(); }catch(_){}
    }

    function renderTree(){
      draft.step = 3;
      const saved = saveDraft();
      const seeded = selectedSeeded();
      const pairs = (saved && Array.isArray(saved.bracket)) ? saved.bracket.map(function(m){ return [m.a, m.b]; }) : stableRandomSeedPairs(seeded, draft.size);
      body.innerHTML = setHead('RANDOMISED KNOCKOUT TREE', 'Seeds are based on current month Premier League rank. Top half draw random opponents from the bottom half.');
      const br = document.createElement('div'); br.className = 'sg-tournament-bracket';
      br.innerHTML = '<div class="sg-tournament-bracket-title">'+esc((draft.type || '').toUpperCase())+' / '+draft.size+' PLAYERS</div><div class="sg-bracket-round">'+pairs.map(function(pair){
        return '<div class="sg-bracket-match">'+
          '<div class="sg-bracket-team"><span class="sg-bracket-seed">#'+esc(pair[0].seed)+'</span>'+esc(pair[0].name)+'</div>'+ 
          '<div class="sg-bracket-vs">VS</div>'+ 
          '<div class="sg-bracket-team"><span class="sg-bracket-seed">#'+esc(pair[1].seed)+'</span>'+esc(pair[1].name)+'</div>'+ 
        '</div>';
      }).join('')+'</div>';
      const treeFooter = footer(true, renderPlayers, startTournamentFirstMatch, 'START TOURNAMENT');
      treeFooter.classList.add('sg-tournament-start-footer');
      body.append(br, treeFooter);
    }

    renderType();
  }

  function bindTournamentButton(){
    const b = document.getElementById('tournamentBtn');
    if (!b) return;
    b.disabled = false;
    b.setAttribute('aria-disabled','false');
    b.classList.remove('disabled');
    b.title = 'Tournament setup';
    b.onclick = function(e){
      if (e){
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
        e.stopImmediatePropagation && e.stopImmediatePropagation();
      }
      if (typeof window.__sqOpenTournamentSteppedSetup === 'function') return window.__sqOpenTournamentSteppedSetup();
      return openTournamentSteppedSetup();
    };
    try{
      const soon = b.querySelector('.sg-opt-soon');
      if (soon) soon.textContent = 'LIVE';
      const desc = b.querySelector('.sg-opt-desc');
      if (desc) desc.textContent = 'CLASSIC / TURBO KNOCKOUT';
    }catch(_){ }
  }

  const oldArrange = window.arrangeStartActions;
  if (typeof oldArrange === 'function' && !oldArrange.__sqFix74Wrapped){
    window.arrangeStartActions = function(){
      const ret = oldArrange.apply(this, arguments);
      setTimeout(bindTournamentButton, 0);
      return ret;
    };
    window.arrangeStartActions.__sqFix74Wrapped = true;
    try{ arrangeStartActions = window.arrangeStartActions; }catch(_){ }
  }

  window.__sqOpenTournamentSteppedSetup = openTournamentSteppedSetup;
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(bindTournamentButton, 80); });
  setTimeout(bindTournamentButton, 80);
})();
