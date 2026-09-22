
(function(){
  if (window.__sqTrainingV1) return; window.__sqTrainingV1 = true;
  var TARGET_MIN = 10, TARGET_MAX = 20, LIVE_MISS_WEIGHT = 16;
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toastMsg(m){ try{ if (typeof window.toast === 'function') window.toast(m); }catch(_){ } }
  function getSb(){ try{ return window.sb || window.__sb || null; }catch(_){ return null; } }
  function norm(s){ return String(s==null?'':s).trim().toLowerCase(); }
  function el(tag, cls, html){ var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ---------------------------------------------------------------- SETUP
  async function openTrainingSetup(){
    var body = document.getElementById('startGameModalBody');
    if (!body) return;
    var draft = { player:null, mode:null, length:null, players:[] };
    try{ draft.players = (typeof __sqLoadPlayerStatsPlayers === 'function') ? (await __sqLoadPlayerStatsPlayers()) : []; }catch(_){ draft.players = []; }

    function head(title, sub){ return '<div class="sg-tournament-intro"><div class="sg-tournament-title">'+esc(title)+'</div>'+(sub?'<div class="sg-tournament-sub">'+esc(sub)+'</div>':'')+'</div>'; }
    function backFooter(onBack){
      var ft = el('div','modal-footer sg-practice-footer');
      var back = el('button','btn ms2-back','<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>');
      back.type = 'button'; back.onclick = function(e){ e.preventDefault(); onBack(); };
      ft.append(back); return ft;
    }
    function pill(title, desc, extraCls){
      var b = el('button', 'sg-tournament-pill' + (extraCls ? ' '+extraCls : ''));
      b.type = 'button';
      b.innerHTML = '<div class="sg-tournament-pill-title">'+title+'</div>' + (desc?'<div class="sg-tournament-pill-desc">'+esc(desc)+'</div>':'');
      return b;
    }

    function renderPlayer(){
      body.innerHTML = head('TRAINING', 'Solo practice — choose a player');
      var wrap = el('div','sg-tournament-controls');
      if (!draft.players.length){ wrap.append(el('div','sg-tournament-sub', 'No saved players found. Add a player first.')); }
      draft.players.forEach(function(p){
        var b = pill(esc(p.name), p.nickname || '');
        b.onclick = function(){ draft.player = p; renderMode(); };
        wrap.append(b);
      });
      body.append(wrap, backFooter(function(){ try{ if (typeof arrangeStartActions === 'function') arrangeStartActions(); }catch(_){ } }));
    }

    function renderMode(){
      body.innerHTML = head('TRAINING MODE', draft.player ? draft.player.name : '');
      var wrap = el('div','sg-tournament-controls');
      var modes = [
        ['select','SELECT','Pick up to 5 targets to chase — they appear at random.'],
        ['standard','STANDARD','Your most-missed numbers, a fresh one each go.'],
        ['tdb','TDB','Most-missed numbers — score trebles, doubles &amp; bull only.']
      ];
      modes.forEach(function(m){
        var b = pill(m[1], m[2]);
        b.onclick = function(){ draft.mode = m[0]; if (m[0] === 'select') renderSelectConfig(); else renderLength(); };
        wrap.append(b);
      });
      body.append(wrap, backFooter(renderPlayer));
    }

    // SELECT config: build up to 5 targets (number + section, or bull).
    function renderSelectConfig(){
      if (!draft.targets) draft.targets = [];
      var SECS = [['any','FULL'],['single','SINGLE'],['double','DOUBLE'],['treble','TREBLE']];
      var curSec = draft._selSec || 'any';
      body.innerHTML = head('SELECT TARGETS', 'Pick up to 5 — they appear at random');
      var box = el('div','tr-sel-config');

      // chosen chips
      var chosen = el('div','tr-sel-chosen');
      function targetLabel(t){ return t.kind === 'bull' ? 'BULL' : ((t.req === 'any' ? '' : (t.req === 'single' ? 'S' : t.req === 'double' ? 'D' : 'T') + ' ') + t.n); }
      function redrawChosen(){
        chosen.innerHTML = draft.targets.length ? '' : '<span class="tr-sel-hint">No targets yet — choose a section, then tap numbers below.</span>';
        draft.targets.forEach(function(t, i){
          var c = el('button','tr-sel-chip on', esc(targetLabel(t)) + ' <span aria-hidden="true">✕</span>');
          c.type = 'button'; c.onclick = function(){ draft.targets.splice(i, 1); redrawChosen(); syncStart(); };
          chosen.appendChild(c);
        });
      }

      // section selector
      var secRow = el('div','tr-sel-secs');
      SECS.forEach(function(s){
        var b = el('button','tr-sel-sec' + (s[0] === curSec ? ' active' : ''), s[1]);
        b.type = 'button';
        b.onclick = function(){ curSec = s[0]; draft._selSec = s[0]; secRow.querySelectorAll('.tr-sel-sec').forEach(function(x){ x.classList.remove('active'); }); b.classList.add('active'); };
        secRow.appendChild(b);
      });

      // number grid + bull
      var grid = el('div','tr-sel-grid');
      function addTarget(t){
        if (draft.targets.length >= 5){ toastMsg('Up to 5 targets.'); return; }
        var k = t.kind === 'bull' ? 'bull' : (t.req + ':' + t.n);
        if (draft.targets.some(function(x){ return (x.kind === 'bull' ? 'bull' : (x.req + ':' + x.n)) === k; })){ toastMsg('Already added.'); return; }
        draft.targets.push(t); redrawChosen(); syncStart();
      }
      for (var n = 10; n <= 20; n++){
        (function(num){
          var b = el('button','tr-sel-num', String(num));
          b.type = 'button'; b.onclick = function(){ addTarget({ kind:'number', n:num, req:curSec }); };
          grid.appendChild(b);
        })(n);
      }
      var bullBtn = el('button','tr-sel-num tr-sel-bull','BULL');
      bullBtn.type = 'button'; bullBtn.onclick = function(){ addTarget({ kind:'bull', req:'bull' }); };
      grid.appendChild(bullBtn);

      box.append(chosen, el('div','tr-sel-label','SECTION'), secRow, el('div','tr-sel-label','ADD NUMBER'), grid);
      body.append(box);

      // footer: Back + Start (needs >=1 target)
      var ft = el('div','modal-footer sg-practice-footer');
      var back = el('button','btn ms2-back','<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>');
      back.type = 'button'; back.onclick = function(e){ e.preventDefault(); renderMode(); };
      var next = el('button','btn primary','NEXT');
      next.type = 'button';
      function syncStart(){ next.disabled = draft.targets.length === 0; next.title = draft.targets.length ? '' : 'Add at least one target'; }
      next.onclick = function(e){ e.preventDefault(); if (!draft.targets.length){ toastMsg('Add at least one target.'); return; } renderLength(); };
      ft.append(back, next);
      body.append(ft);
      redrawChosen(); syncStart();
    }

    function renderLength(){
      body.innerHTML = head('SESSION LENGTH', 'How many goes this session?');
      var wrap = el('div','sg-tournament-controls');
      [['10 ROUNDS',10],['15 ROUNDS',15],['UNLIMITED',0]].forEach(function(l){
        var b = pill(l[0], '');
        b.onclick = function(){ draft.length = l[1]; startTraining({ player:draft.player, mode:draft.mode, length:draft.length, targets:(draft.targets || []).slice() }); };
        wrap.append(b);
      });
      body.append(wrap, backFooter(renderMode));
    }

    renderPlayer();
  }

  // ---------------------------------------------------------------- SCORING
  // A target is a descriptor: {kind:'number', n, req} or {kind:'bull'}.
  // req ∈ 'any' (Standard / Select full) | 'single' | 'double' | 'treble'
  //     | 'dt' (TDB: double or treble only).
  var SEC_LABEL = { single:'SINGLE', double:'DOUBLE', treble:'TREBLE' };
  function targetKey(t){ return t.kind === 'bull' ? 'bull' : ('n' + t.n + (t.req && t.req !== 'any' ? ':' + t.req : '')); }
  function targetBig(t){ return t.kind === 'bull' ? '◎' : String(t.n); }
  function targetCue(t){
    if (t.kind === 'bull') return 'HIT THE BULL';
    if (t.req === 'single') return 'SINGLE ' + t.n + ' ONLY';
    if (t.req === 'double') return 'DOUBLE ' + t.n;
    if (t.req === 'treble') return 'TREBLE ' + t.n;
    if (t.req === 'dt') return 'DOUBLE / TREBLE ' + t.n;
    return 'HIT THE ' + t.n;
  }
  // Pad buttons for the current target (MISS always first).
  function padSpec(t){
    var miss = { sec:'miss', label:'MISS' };
    if (t.kind === 'bull') return [miss, { sec:'b25', label:'25', pts:25 }, { sec:'bull', label:'BULL', pts:50 }];
    var n = t.n;
    var S = { sec:'single', label:'SINGLE', pts:n }, D = { sec:'double', label:'DOUBLE', pts:2*n }, T = { sec:'treble', label:'TREBLE', pts:3*n };
    if (t.req === 'single') return [miss, S];
    if (t.req === 'double') return [miss, D];
    if (t.req === 'treble') return [miss, T];
    if (t.req === 'dt') return [miss, D, T];
    return [miss, S, D, T];
  }
  function dartScore(t, sec){
    if (sec === 'miss') return { pts:0, hit:false };
    if (t.kind === 'bull') return sec === 'bull' ? { pts:50, hit:true } : sec === 'b25' ? { pts:25, hit:true } : { pts:0, hit:false };
    if (sec === 'single') return { pts:t.n, hit:true };
    if (sec === 'double') return { pts:2*t.n, hit:true };
    if (sec === 'treble') return { pts:3*t.n, hit:true };
    return { pts:0, hit:false };
  }
  function pipTag(sec, pts){
    if (sec === 'miss') return 'MISS';
    if (sec === 'b25') return '25';
    if (sec === 'bull') return 'BULL';
    return (sec === 'single' ? 'S' : sec === 'double' ? 'D' : 'T') + '·' + pts;
  }
  // Weighted pick of a most-missed number 10-20 (historical + live session).
  function weightedNumber(st){
    var nums = [], weights = [], total = 0;
    for (var n = TARGET_MIN; n <= TARGET_MAX; n++){
      var hist = (st.histWeight[n] != null) ? st.histWeight[n] : 50;
      var w = hist + LIVE_MISS_WEIGHT * (st.sessionMiss['n' + n] || 0) + LIVE_MISS_WEIGHT * (st.sessionMiss['n' + n + ':dt'] || 0);
      if (n === st.lastNumber) w *= 0.15; // avoid immediate repeats but keep them possible
      w = Math.max(1, w);
      nums.push(n); weights.push(w); total += w;
    }
    var r = Math.random() * total;
    for (var i = 0; i < nums.length; i++){ r -= weights[i]; if (r <= 0) return nums[i]; }
    return nums[nums.length - 1];
  }
  function pickTarget(st){
    if (st.cfg.mode === 'select'){
      var list = (st.cfg.targets && st.cfg.targets.length) ? st.cfg.targets : [{ kind:'number', n:20, req:'any' }];
      var pick = list[Math.floor(Math.random() * list.length)];
      if (list.length > 1 && targetKey(pick) === st.lastKey){ pick = list[(list.indexOf(pick) + 1) % list.length]; }
      return { kind:pick.kind, n:pick.n, req:pick.req || 'any' };
    }
    if (st.cfg.mode === 'tdb' && Math.random() < 0.12) return { kind:'bull', req:'bull' };
    var num = weightedNumber(st);
    return { kind:'number', n:num, req: st.cfg.mode === 'tdb' ? 'dt' : 'any' };
  }

  // ---------------------------------------------------------------- GAME
  async function startTraining(cfg){
    try{ if (typeof closeModal === 'function') closeModal('startGameModal'); }catch(_){ }
    var sb = getSb();
    var pkey = norm(cfg.player && cfg.player.name);
    var st = {
      cfg: cfg, target: null, lastKey: null, lastNumber: null, dartsThisGo: [], go: 0,
      totalPoints: 0, totalDarts: 0, totalHits: 0, bestGo: 0, results: [],
      histWeight: {}, sessionMiss: {}, avg: null, finished: false, el: {}
    };

    if (sb){
      try{
        var rr = await sb.from('v_player_last30_target_rates').select('target_n,hit_pct').eq('player_key', pkey);
        ((rr && rr.data) || []).forEach(function(row){
          var n = Number(row.target_n);
          if (n >= TARGET_MIN && n <= TARGET_MAX) st.histWeight[n] = Math.max(5, Math.min(100, 100 - Number(row.hit_pct || 0)));
        });
      }catch(_){ }
      try{
        var sm = await sb.from('v_training_player_summary').select('avg_points,avg_hit_pct,sessions').eq('player_key', pkey).eq('mode', cfg.mode);
        if (sm && sm.data && sm.data[0]) st.avg = sm.data[0];
      }catch(_){ }
    }

    buildGameScreen(st);
    nextGo(st);
  }

  function buildGameScreen(st){
    var ov = el('div','tr-overlay');
    var lenLabel = st.cfg.length > 0 ? ('<span>/'+st.cfg.length+'</span>') : '<span> ∞</span>';
    ov.innerHTML =
      '<div class="tr-head">' +
        '<button class="tr-quit" type="button" aria-label="Quit training">✕</button>' +
        '<div class="tr-mode">'+esc((st.cfg.mode||'').toUpperCase())+' TRAINING</div>' +
        '<div class="tr-round">GO <b class="tr-go">1</b>'+lenLabel+'</div>' +
      '</div>' +
      '<div class="tr-stats">' +
        '<div class="tr-stat tr-score"><span class="tr-stat-v tr-v-score">0</span><span class="tr-stat-l">Points</span></div>' +
        '<div class="tr-stat"><span class="tr-stat-v tr-v-hit">0%</span><span class="tr-stat-l">Hit Rate</span></div>' +
        '<div class="tr-stat"><span class="tr-stat-v tr-v-darts">0</span><span class="tr-stat-l">Darts</span></div>' +
        '<div class="tr-stat tr-avgbox"><span class="tr-stat-v tr-v-avg">—</span><span class="tr-stat-l">Your Avg</span></div>' +
      '</div>' +
      '<div class="tr-target">' +
        '<div class="tr-target-ring"><div class="tr-target-num">–</div></div>' +
        '<div class="tr-target-cue">GET READY</div>' +
        '<div class="tr-target-sub"></div>' +
      '</div>' +
      '<div class="tr-pips">' +
        '<div class="tr-pip" data-d="0">D1</div><div class="tr-pip" data-d="1">D2</div><div class="tr-pip" data-d="2">D3</div>' +
      '</div>' +
      '<div class="tr-pad"></div>' +
      '<div class="tr-actions">' +
        '<button class="tr-undo" type="button" disabled>UNDO</button>' +
        '<button class="tr-end" type="button">'+(st.cfg.length>0?'END EARLY':'END SESSION')+'</button>' +
      '</div>' +
      '<div class="tr-progress"></div>' +
      '<div class="tr-confirm"><div class="tr-confirm-q">Quit this session?</div><div class="tr-confirm-row">' +
        '<button class="tr-confirm-yes" type="button">QUIT</button><button class="tr-confirm-no" type="button">RESUME</button>' +
      '</div></div>';
    document.body.appendChild(ov);

    var q = function(sel){ return ov.querySelector(sel); };
    st.el = {
      ov: ov, go: q('.tr-go'), score: q('.tr-v-score'), hit: q('.tr-v-hit'), darts: q('.tr-v-darts'),
      avg: q('.tr-v-avg'), ring: q('.tr-target-ring'), num: q('.tr-target-num'), cue: q('.tr-target-cue'),
      sub: q('.tr-target-sub'), pips: ov.querySelectorAll('.tr-pip'), undo: q('.tr-undo'), progress: q('.tr-progress'),
      pad: q('.tr-pad'), confirm: q('.tr-confirm')
    };
    if (st.avg && st.avg.avg_points != null) st.el.avg.textContent = String(st.avg.avg_points);

    st.el.undo.onclick = function(){ undoDart(st); };
    q('.tr-end').onclick = function(){ if (!st.results.length && !st.dartsThisGo.length){ endSession(st); return; } endSession(st); };
    q('.tr-quit').onclick = function(){ if (!st.results.length && !st.dartsThisGo.length){ closeTraining(st); return; } st.el.confirm.classList.add('on'); };
    q('.tr-confirm-yes').onclick = function(){ closeTraining(st); };
    q('.tr-confirm-no').onclick = function(){ st.el.confirm.classList.remove('on'); };
    ov.tabIndex = -1;
    ov.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ e.stopPropagation(); q('.tr-quit').click(); } });
    setTimeout(function(){ try{ ov.focus(); }catch(_){ } }, 30);
  }

  function nextGo(st){
    if (st.finished) return;
    var t = pickTarget(st);
    st.target = t; st.lastKey = targetKey(t); if (t.kind === 'number') st.lastNumber = t.n;
    st.dartsThisGo = [];
    var e = st.el;
    e.go.textContent = String(st.go + 1);
    e.num.textContent = targetBig(t);
    if (t.kind === 'bull') e.num.style.fontSize = 'clamp(40px,12vw,68px)'; else e.num.style.fontSize = '';
    e.cue.textContent = targetCue(t);
    e.sub.textContent = st.cfg.mode === 'tdb' && t.kind === 'number' ? 'Trebles & doubles only' : '';
    // Build the pad for this target.
    var spec = padSpec(t);
    e.pad.style.gridTemplateColumns = 'repeat(' + spec.length + ', 1fr)';
    e.pad.innerHTML = spec.map(function(s){
      return '<button type="button" data-sec="' + s.sec + '">' + s.label + (s.pts != null ? '<small>' + s.pts + '</small>' : '') + '</button>';
    }).join('');
    e.pad.querySelectorAll('button').forEach(function(b){ b.onclick = function(){ recordDart(st, b.dataset.sec); }; });
    e.pips.forEach(function(p){ p.className = 'tr-pip'; p.textContent = 'D' + (Number(p.dataset.d) + 1); });
    e.undo.disabled = true;
  }

  function recordDart(st, section){
    if (st.finished || st.dartsThisGo.length >= 3) return;
    var sc = dartScore(st.target, section);
    st.dartsThisGo.push({ section: section, points: sc.pts, hit: sc.hit });
    st.totalDarts++; st.totalPoints += sc.pts;
    var key = targetKey(st.target);
    if (sc.hit){ st.totalHits++; } else { st.sessionMiss[key] = (st.sessionMiss[key] || 0) + 1; }
    paintDart(st, st.dartsThisGo.length - 1, section, sc.pts);
    updateLive(st);
    st.el.undo.disabled = false;
    if (sc.hit){ st.el.ring.classList.remove('tr-flash'); void st.el.ring.offsetWidth; st.el.ring.classList.add('tr-flash'); }
    if (st.dartsThisGo.length >= 3){ st.el.undo.disabled = true; setTimeout(function(){ finishGo(st); }, 480); }
  }

  function undoDart(st){
    if (st.finished || !st.dartsThisGo.length) return;
    var d = st.dartsThisGo.pop();
    st.totalDarts--; st.totalPoints -= d.points;
    var key = targetKey(st.target);
    if (d.hit){ st.totalHits--; } else { st.sessionMiss[key] = Math.max(0, (st.sessionMiss[key] || 0) - 1); }
    var idx = st.dartsThisGo.length;
    var pip = st.el.pips[idx]; if (pip){ pip.className = 'tr-pip'; pip.textContent = 'D' + (idx + 1); }
    updateLive(st);
    st.el.undo.disabled = st.dartsThisGo.length === 0;
  }

  function paintDart(st, idx, section, pts){
    var pip = st.el.pips[idx]; if (!pip) return;
    if (section === 'miss'){ pip.className = 'tr-pip tr-miss'; pip.textContent = 'MISS'; }
    else { pip.className = 'tr-pip tr-hit'; pip.textContent = pipTag(section, pts); }
  }

  function updateLive(st){
    st.el.score.textContent = String(st.totalPoints);
    st.el.darts.textContent = String(st.totalDarts);
    st.el.hit.textContent = (st.totalDarts ? Math.round((st.totalHits / st.totalDarts) * 100) : 0) + '%';
  }

  function finishGo(st){
    if (st.finished) return;
    var goPts = st.dartsThisGo.reduce(function(a, d){ return a + d.points; }, 0);
    var goHits = st.dartsThisGo.filter(function(d){ return d.hit; }).length;
    st.results.push({ target: st.target.kind === 'bull' ? 'bull' : st.target.n, req: st.target.req || 'any', darts: st.dartsThisGo.map(function(d){ return d.section; }), hits: goHits, points: goPts });
    if (goPts > st.bestGo) st.bestGo = goPts;
    st.go++;
    addBar(st.el.progress, goPts);
    if (st.cfg.length > 0 && st.go >= st.cfg.length){ endSession(st); return; }
    nextGo(st);
  }

  function addBar(container, pts, max){
    if (!container) return;
    var b = el('div','tr-bar');
    var h = Math.max(3, Math.min(34, (pts / (max || 60)) * 34));
    b.style.height = h + 'px';
    container.appendChild(b);
    container.scrollLeft = container.scrollWidth;
  }

  async function endSession(st){
    if (st.finished) return;
    st.finished = true;
    var hitPct = st.totalDarts ? Math.round((st.totalHits / st.totalDarts) * 1000) / 10 : 0;
    var saveResult = await saveSession(st, hitPct);
    showSummary(st, hitPct, saveResult);
  }

  async function saveSession(st, hitPct){
    var sb = getSb();
    if (!sb) return { saved: false, reason: 'offline' };
    if (!st.results.length) return { saved: false, reason: 'empty' };
    try{
      var payload = {
        player_name: st.cfg.player.name, mode: st.cfg.mode, length: st.cfg.length,
        rounds_played: st.go, config: st.cfg.mode === 'select' ? { targets: st.cfg.targets || [] } : {}, results: st.results,
        total_points: st.totalPoints, total_darts: st.totalDarts, total_hits: st.totalHits, hit_pct: hitPct
      };
      var res = await sb.from('training_sessions').insert(payload);
      if (res && res.error) throw res.error;
      return { saved: true };
    }catch(e){ try{ console.warn('[SQ] training save failed', e); }catch(_){ } return { saved: false, reason: 'error' }; }
  }

  function showSummary(st, hitPct, saveResult){
    var ov = st.el.ov;
    var avgPts = (st.avg && st.avg.avg_points != null) ? Number(st.avg.avg_points) : null;
    var deltaHtml = '', deltaCls = 'flat';
    if (avgPts == null){ deltaHtml = 'First session — this is your benchmark!'; }
    else { var d = st.totalPoints - avgPts; deltaCls = d > 0 ? 'up' : (d < 0 ? 'down' : 'flat');
      deltaHtml = (d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '± 0') + ' vs your average (' + avgPts + ')'; }
    var maxGo = st.results.reduce(function(m, r){ return Math.max(m, r.points); }, 0) || 60;
    var bars = st.results.map(function(r){ var h = Math.max(4, Math.min(62, (r.points / maxGo) * 62)); return '<div class="tr-bar" style="height:'+h+'px"></div>'; }).join('');
    var note = saveResult.saved ? 'Saved to your practice stats.' : (saveResult.reason === 'offline' ? 'Offline — session not saved.' : saveResult.reason === 'empty' ? '' : 'Could not save this session.');

    var inner = el('div','tr-sum-inner');
    inner.innerHTML =
      '<div class="tr-sum-title">SESSION COMPLETE</div>' +
      '<div class="tr-sum-hero"><div class="tr-sum-pts">'+st.totalPoints+'</div><div class="tr-sum-pts-l">TOTAL POINTS</div>' +
        '<div class="tr-sum-delta '+deltaCls+'">'+deltaHtml+'</div></div>' +
      '<div class="tr-sum-grid">' +
        '<div class="tr-sum-cell"><b>'+hitPct+'%</b><span>HIT RATE</span></div>' +
        '<div class="tr-sum-cell"><b>'+st.go+'</b><span>GOES</span></div>' +
        '<div class="tr-sum-cell"><b>'+st.bestGo+'</b><span>BEST GO</span></div>' +
      '</div>' +
      '<div class="tr-sum-prog">'+bars+'</div>' +
      '<div class="tr-sum-note">'+esc(note)+'</div>' +
      '<button class="tr-sum-stats" type="button">VIEW PRACTICE STATS ▸</button>' +
      '<div class="tr-sum-actions"><button class="tr-again" type="button">PLAY AGAIN</button><button class="tr-done" type="button">DONE</button></div>';
    ov.className = 'tr-overlay tr-summary';
    ov.innerHTML = '';
    ov.appendChild(inner);
    inner.querySelector('.tr-again').onclick = function(){ try{ ov.remove(); }catch(_){ } startTraining(st.cfg); };
    inner.querySelector('.tr-done').onclick = function(){ closeTraining(st); };
    inner.querySelector('.tr-sum-stats').onclick = function(){ try{ openTrainingStats(st.cfg.player.name); }catch(_){ } };
  }

  function closeTraining(st){
    try{ st.el.ov.remove(); }catch(_){ try{ document.querySelectorAll('.tr-overlay').forEach(function(x){ x.remove(); }); }catch(__){ } }
    try{ if (typeof show === 'function') show('details'); }catch(_){ }
  }

  // ---------------------------------------------------------------- STATS AREA
  async function openTrainingStats(playerName){
    var sb = getSb();
    var name = String(playerName || '').trim();
    var overlay = el('div','modal-backdrop');
    overlay.style.zIndex = '600000'; // sit above the training overlay (z 500000) when opened from the summary
    var modal = el('div','modal'); modal.style.cssText = 'max-width:560px;width:94vw;max-height:88vh;overflow:hidden;display:flex;flex-direction:column;';
    var body = el('div','modal-body'); body.style.cssText = 'overflow-y:auto;';
    body.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
    modal.appendChild(body); overlay.appendChild(modal); document.body.appendChild(overlay);
    try{ if (window.sqModal && window.sqModal.register) window.sqModal.register(overlay, modal, function(){ overlay.remove(); }); }catch(_){ }
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', function(e){ if (e.key === 'Escape') overlay.remove(); });
    modal.tabIndex = 0; modal.focus();

    if (!name){ body.innerHTML = '<p class="muted" style="padding:16px">Pick a player to see their practice stats.</p>'; return; }
    var pkey = norm(name);
    var summary = [], sessions = [];
    if (sb){
      try{ var s = await sb.from('v_training_player_summary').select('mode,sessions,avg_points,best_points,avg_hit_pct,avg_darts,last_played_at').eq('player_key', pkey); summary = (s && s.data) || []; }catch(_){ }
      try{ var r = await sb.from('training_sessions').select('mode,total_points,hit_pct,rounds_played,created_at').eq('player_key', pkey).order('created_at', { ascending: false }).limit(20); sessions = (r && r.data) || []; }catch(_){ }
    }
    var MODES = [['standard','STANDARD'],['tdb','TDB'],['select','SELECT']];
    var byMode = {}; summary.forEach(function(m){ byMode[m.mode] = m; });
    function fmtDate(v){ try{ var d = new Date(v); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day:'2-digit', month:'short' }); }catch(_){ return ''; } }
    var cards = MODES.map(function(m){
      var d = byMode[m[0]];
      if (!d) return '<div class="trs-card trs-empty-card"><div class="trs-card-h">'+m[1]+'</div><div class="trs-none">No sessions yet</div></div>';
      return '<div class="trs-card"><div class="trs-card-h">'+m[1]+'</div>' +
        '<div class="trs-mini"><b>'+d.sessions+'</b><span>SESS</span></div>' +
        '<div class="trs-mini"><b>'+d.avg_points+'</b><span>AVG</span></div>' +
        '<div class="trs-mini"><b>'+d.best_points+'</b><span>BEST</span></div>' +
        '<div class="trs-mini"><b>'+d.avg_hit_pct+'%</b><span>HIT</span></div></div>';
    }).join('');
    var recent = sessions.length ? sessions.map(function(x){
      return '<div class="trs-sess"><span class="trs-sess-mode trs-m-'+esc(x.mode)+'">'+esc((x.mode || '').toUpperCase())+'</span>' +
        '<span class="trs-sess-pts">'+x.total_points+'<small>pts</small></span>' +
        '<span class="trs-sess-hit">'+x.hit_pct+'%</span>' +
        '<span class="trs-sess-date">'+fmtDate(x.created_at)+'</span></div>';
    }).join('') : '<div class="trs-listempty">No practice sessions yet. Play a Training session to start your history.</div>';
    var offNote = sb ? '' : '<div class="trs-listempty">Offline — practice stats unavailable.</div>';
    body.innerHTML =
      '<div class="trs-head"><h3 style="margin:0">🎯 Practice Stats</h3><div class="trs-sub">'+esc(name)+' · training only, separate from game stats</div></div>' +
      '<div class="trs-cards">'+cards+'</div>' +
      '<div class="trs-list-h">RECENT SESSIONS</div><div class="trs-list">'+(offNote || recent)+'</div>';
  }
  window.__sqOpenTrainingStats = openTrainingStats;

  // ---------------------------------------------------------------- BUTTON
  function bindTrainingButton(){
    var b = document.getElementById('trainingBtn');
    if (!b) return;
    b.classList.remove('disabled'); b.disabled = false; b.setAttribute('aria-disabled', 'false');
    try{ var soon = b.querySelector('.sg-opt-soon'); if (soon){ soon.textContent = 'LIVE'; } }catch(_){ }
    try{ var desc = b.querySelector('.sg-opt-desc'); if (desc){ desc.textContent = 'SOLO PRACTICE — YOUR MOST-MISSED TARGETS'; } }catch(_){ }
    b.onclick = function(e){ if (e){ e.preventDefault && e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation(); } openTrainingSetup(); };
  }
  window.__sqOpenTrainingSetup = openTrainingSetup;

  var _arr = window.arrangeStartActions;
  if (typeof _arr === 'function' && !_arr.__sqTrainingWrapped){
    window.arrangeStartActions = function(){ var r = _arr.apply(this, arguments); setTimeout(bindTrainingButton, 0); return r; };
    window.arrangeStartActions.__sqTrainingWrapped = true;
    try{ arrangeStartActions = window.arrangeStartActions; }catch(_){ }
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(bindTrainingButton, 90); });
  setTimeout(bindTrainingButton, 90);
})();
