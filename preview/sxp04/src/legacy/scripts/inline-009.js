
(function(){
  if (window.__sqH2HRollingGraphPatchV3) return;
  window.__sqH2HRollingGraphPatchV3 = true;

  function calcH2HDbProgression(rows){
    rows = Array.isArray(rows) ? rows : [];
    if (rows.length < 2) {
      return { enough:false, firstGames:rows.length, secondGames:0, firstWinPct:null, secondWinPct:null, winPctDelta:null, firstAvgDiff:null, secondAvgDiff:null, avgDiffDelta:null };
    }
    var split = Math.floor(rows.length / 2);
    var first = rows.slice(0, split);
    var second = rows.slice(split);
    function winPct(part){
      var wins = 0, losses = 0;
      part.forEach(function(r){
        var result = String(r && r.player_a_result || '').toLowerCase();
        if (result === 'win') wins += 1;
        else if (result === 'loss') losses += 1;
      });
      return (wins + losses) ? (wins / (wins + losses) * 100) : null;
    }
    function avgDiff(part){
      var total = 0, count = 0;
      part.forEach(function(r){
        var diff = Number(r && r.score_diff);
        if (Number.isFinite(diff)){ total += diff; count += 1; }
      });
      return count ? (total / count) : null;
    }
    var firstWinPct = winPct(first);
    var secondWinPct = winPct(second);
    var firstAvgDiff = avgDiff(first);
    var secondAvgDiff = avgDiff(second);
    return {
      enough:true,
      firstGames:first.length,
      secondGames:second.length,
      firstWinPct:firstWinPct,
      secondWinPct:secondWinPct,
      winPctDelta:(firstWinPct == null || secondWinPct == null) ? null : (secondWinPct - firstWinPct),
      firstAvgDiff:firstAvgDiff,
      secondAvgDiff:secondAvgDiff,
      avgDiffDelta:(firstAvgDiff == null || secondAvgDiff == null) ? null : (secondAvgDiff - firstAvgDiff)
    };
  }

  function buildH2HDbChartPoints(rows, graphMode){
    rows = Array.isArray(rows) ? rows : [];
    graphMode = String(graphMode || 'running').toLowerCase();
    function gameWinValue(r){
      var result = String(r && r.player_a_result || '').toLowerCase();
      if (result === 'win') return 100;
      if (result === 'loss') return 0;
      if (result === 'draw') return 50;
      return null;
    }
    function avg(values){
      var total = 0, count = 0;
      values.forEach(function(v){
        v = Number(v);
        if (Number.isFinite(v)){ total += v; count += 1; }
      });
      return count ? (total / count) : null;
    }
    if (graphMode === 'avg5' || graphMode === 'avg10' || graphMode === 'avg20'){
      var size = graphMode === 'avg20' ? 20 : (graphMode === 'avg10' ? 10 : 5);
      var points = [];
      for (var start = 0; start + size <= rows.length; start += size){
        var part = rows.slice(start, start + size);
        points.push({
          idx:start + size - 1,
          game:start + size,
          winPct:avg(part.map(gameWinValue)),
          diff:avg(part.map(function(r){ return Number(r && r.score_diff); })),
          result:'block'
        });
      }
      return points;
    }
    return rows.map(function(r, idx){
      return {
        idx:idx,
        game:idx + 1,
        winPct:Number(r && r.running_win_pct),
        diff:Number(r && r.running_avg_diff),
        result:String(r && r.player_a_result || '').toLowerCase()
      };
    }).filter(function(p){ return Number.isFinite(p.winPct); });
  }

  function drawH2HDbTimelineCanvas(canvas, rows, graphMode){
    if (!canvas) return;
    rows = Array.isArray(rows) ? rows : [];
    graphMode = String(graphMode || 'running').toLowerCase();
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var w = Math.max(320, Math.floor(rect.width || 720));
    var h = Math.max(220, Math.floor(rect.height || 280));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);

    var padL = 18, padR = 150, padT = 18, padB = 34;
    var x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
    var grid = 'rgba(255,255,255,.10)';
    var text = 'rgba(231,233,245,.72)';
    var winBlue = 'rgba(90,220,255,.96)';
    var progressBlue = 'rgba(55,135,255,.98)';
    var diffOrange = 'rgba(255,170,28,.95)';

    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.fillStyle = text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    [0,25,50,75,100].forEach(function(v){
      var y = y1 - ((v / 100) * (y1-y0));
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    });

    ctx.textAlign = 'center';
    var n = Math.max(1, rows.length);
    for (var i=1; i<=n; i++){
      if (n < 5) {
        // Label every game in very small ranges.
      } else if (i !== 1 && i % 5 !== 0) {
        continue;
      }
      var xTick = n === 1 ? x0 : x0 + ((i-1)/(n-1))*(x1-x0);
      ctx.beginPath(); ctx.moveTo(xTick, y0); ctx.lineTo(xTick, y1); ctx.stroke();
      ctx.fillText(String(i), xTick, y1 + 18);
    }
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText('Matches oldest to newest', (x0+x1)/2, h - 8);

    if (!rows.length){
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.font = '13px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('No H2H timeline data available.', (x0+x1)/2, (y0+y1)/2);
      return;
    }

    function px(idx){ return n === 1 ? x0 : x0 + (idx/(n-1))*(x1-x0); }
    function pyPct(v){ return y1 - ((Math.max(0, Math.min(100, Number(v) || 0)) / 100) * (y1-y0)); }
    var chartPoints = buildH2HDbChartPoints(rows, graphMode);
    var lowDataMsg = graphMode === 'avg5' && rows.length < 5 ? 'Not enough games for 5 Game Av.' : (graphMode === 'avg10' && rows.length < 10 ? 'Not enough games for 10 Game Av.' : (graphMode === 'avg20' && rows.length < 20 ? 'Not enough games for 20 Game Av.' : ''));
    if (lowDataMsg){
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.textAlign = 'center';
      ctx.font = '13px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(lowDataMsg, (x0+x1)/2, (y0+y1)/2);
      return;
    }

    var diffs = chartPoints.map(function(p){ return Number(p && p.diff); }).filter(function(v){ return Number.isFinite(v); });
    var maxAbsDiff = Math.max(1, diffs.reduce(function(m,v){ return Math.max(m, Math.abs(v)); }, 0));
    function pyDiff(v){
      var normalized = 50 + ((Number(v) || 0) / maxAbsDiff * 50);
      return pyPct(normalized);
    }

    ctx.save();
    ctx.strokeStyle = diffOrange;
    ctx.lineWidth = 2;
    ctx.setLineDash([5,4]);
    chartPoints.forEach(function(p, idx){
      var y = pyDiff(p.diff);
      var x = px(p.idx);
      if (idx === 0){ ctx.beginPath(); ctx.moveTo(x, y); }
      else { ctx.lineTo(x, y); }
    });
    if (chartPoints.length) ctx.stroke();
    ctx.restore();

    var progress = calcH2HDbProgression(rows);
    if (progress.enough && progress.firstWinPct != null && progress.secondWinPct != null){
      ctx.save();
      ctx.strokeStyle = progressBlue;
      ctx.fillStyle = progressBlue;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(55,135,255,.35)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x0, pyPct(progress.firstWinPct));
      ctx.lineTo(x1, pyPct(progress.secondWinPct));
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(x0, pyPct(progress.firstWinPct), 4.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x1, pyPct(progress.secondWinPct), 4.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = winBlue;
    ctx.fillStyle = winBlue;
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    chartPoints.forEach(function(p, idx){
      var x = px(p.idx), y = pyPct(p.winPct);
      if (idx === 0){ ctx.beginPath(); ctx.moveTo(x, y); }
      else { ctx.lineTo(x, y); }
    });
    if (chartPoints.length) ctx.stroke();
    chartPoints.forEach(function(p){
      var result = String(p && p.result || '').toLowerCase();
      ctx.beginPath();
      ctx.fillStyle = result === 'win' ? 'rgba(60,255,134,.96)' : (result === 'loss' ? 'rgba(255,95,95,.92)' : (result === 'draw' ? 'rgba(255,255,255,.78)' : winBlue));
      ctx.arc(px(p.idx), pyPct(p.winPct), 3.4, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.restore();

    var last = rows[rows.length - 1] || {};
    var lx = x1 + 22;
    var ly = y0 + 20;
    ctx.font = '12px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = progressBlue; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 18, ly); ctx.stroke();
    ctx.fillStyle = 'rgba(231,233,245,.86)';
    ctx.fillText('Progression', lx + 26, ly);
    ctx.fillStyle = 'rgba(231,233,245,.68)';
    var progressText = (!progress.enough || progress.firstWinPct == null || progress.secondWinPct == null)
      ? 'Not enough games'
      : (progress.firstWinPct.toFixed(1) + '% to ' + progress.secondWinPct.toFixed(1) + '%');
    ctx.fillText(progressText, lx + 26, ly + 17);

    ly += 48;
    ctx.save();
    ctx.strokeStyle = diffOrange; ctx.lineWidth = 2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 18, ly); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(231,233,245,.86)';
    ctx.fillText('Avg Points Diff', lx + 26, ly);
    ctx.fillStyle = 'rgba(231,233,245,.68)';
    var avg = Number(last.running_avg_diff);
    ctx.fillText(Number.isFinite(avg) ? ((avg >= 0 ? '+' : '') + avg.toFixed(1)) : '—', lx + 26, ly + 17);
  }

  function makeH2HDbRangeControls(activeRange, onSelect){
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'flex-start';
    wrap.style.gap = '12px';
    wrap.style.flexWrap = 'wrap';
    wrap.style.margin = '0 0 10px';
    function btn(label, active, disabled, title){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (active) b.className = 'active';
      if (disabled){
        b.disabled = true;
        b.title = title || 'DB source not available yet';
        b.style.opacity = '.42';
        b.style.cursor = 'not-allowed';
      } else {
        b.addEventListener('click', function(){
          if (typeof onSelect === 'function') onSelect(b.dataset.range);
        });
      }
      return b;
    }
    var ranges = document.createElement('div');
    ranges.className = 'sq-league-tabs';
    ranges.style.justifyContent = 'flex-start';
    ranges.style.marginLeft = '0';
    [
      { key:'all', label:'ALL TIME', title:'All DB-backed H2H timeline rows.' },
      { key:'last_6_months', label:'6 MONTHS', title:'Last 6 months from the DB-backed H2H timeline.' },
      { key:'last_1_month', label:'1 MONTH', title:'Last 1 month from the DB-backed H2H timeline.' },
      { key:'last_1_week', label:'1 WEEK', title:'Last 1 week from the DB-backed H2H timeline.' }
    ].forEach(function(r){
      var x = btn(r.label, activeRange === r.key, false, r.title);
      x.dataset.range = r.key;
      ranges.appendChild(x);
    });
    wrap.appendChild(ranges);
    return wrap;
  }

  function makeH2HDbAverageControls(activeGraphMode, onSelect){
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'flex-start';
    wrap.style.gap = '8px';
    wrap.style.flexWrap = 'wrap';
    wrap.style.margin = '-4px 0 10px';
    var tabs = document.createElement('div');
    tabs.className = 'sq-league-tabs';
    tabs.style.justifyContent = 'flex-start';
    tabs.style.marginLeft = '0';
    [
      { key:'running', label:'Running' },
      { key:'avg5', label:'5 Game Av' },
      { key:'avg10', label:'10 Game Av' },
      { key:'avg20', label:'20 Game Av' }
    ].forEach(function(m){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.dataset.graphMode = m.key;
      if (activeGraphMode === m.key) b.className = 'active';
      b.addEventListener('click', function(){
        if (typeof onSelect === 'function') onSelect(m.key);
      });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);
    return wrap;
  }

  function makeH2HDbYAxisPanel(){
    var axis = document.createElement('div');
    axis.style.flex = '0 0 54px';
    axis.style.position = 'sticky';
    axis.style.left = '0';
    axis.style.zIndex = '2';
    axis.style.height = '330px';
    axis.style.border = '1px solid rgba(255,255,255,.10)';
    axis.style.borderRight = '0';
    axis.style.borderRadius = '14px 0 0 14px';
    axis.style.background = 'rgba(7,9,16,.96)';
    axis.style.boxSizing = 'border-box';
    axis.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    axis.style.fontSize = '11px';
    axis.style.color = 'rgba(231,233,245,.72)';
    axis.style.overflow = 'hidden';
    var label = document.createElement('div');
    label.textContent = 'WIN %';
    label.style.position = 'absolute';
    label.style.left = '8px';
    label.style.top = '6px';
    label.style.fontSize = '9px';
    label.style.fontWeight = '900';
    label.style.letterSpacing = '.08em';
    label.style.color = 'rgba(231,233,245,.55)';
    axis.appendChild(label);
    [100,75,50,25,0].forEach(function(v){
      var row = document.createElement('div');
      row.textContent = String(v) + '%';
      row.style.position = 'absolute';
      row.style.right = '8px';
      row.style.transform = 'translateY(-50%)';
      row.style.top = String(18 + (((100 - v) / 100) * (330 - 18 - 34))) + 'px';
      axis.appendChild(row);
    });
    return axis;
  }

  function makeH2HDbModeControls(){
    var modes = group();
    modes.append(
      btn('CLASSIC', true, false, ''),
      btn('TURBO', false, true, 'Disabled: Turbo H2H DB views/RPCs are not available yet.')
    );
    function group(){
      var g = document.createElement('div');
      g.className = 'sq-league-tabs';
      g.style.justifyContent = 'flex-end';
      g.style.marginLeft = 'auto';
      return g;
    }
    function btn(label, active, disabled, title){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (active) b.className = 'active';
      if (disabled){
        b.disabled = true;
        b.title = title || 'DB source not available yet';
        b.style.opacity = '.42';
        b.style.cursor = 'not-allowed';
      }
      return b;
    }
    return modes;
  }

  async function openH2HOpponentGraph(playerName, row){
    var opponentName = String((row && row.name) || '').trim();
    var playerAKey = String((row && row.playerAKey) || '').trim().toLowerCase();
    var playerBKey = String((row && row.playerBKey) || '').trim().toLowerCase();
    var ov = document.createElement('div'); ov.className = 'modal-backdrop';
    var md = document.createElement('div'); md.className = 'modal sq-wide-modal';
    md.style.maxWidth = '860px';
    var head = document.createElement('div');
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.justifyContent = 'space-between';
    head.style.gap = '12px';
    head.style.marginBottom = '4px';
    var h = document.createElement('h3');
    h.textContent = playerName + ' vs ' + opponentName;
    h.style.margin = '0';
    head.append(h, makeH2HDbModeControls());
    var body = document.createElement('div'); body.className = 'modal-body';
    var loading = document.createElement('p');
    loading.className = 'muted';
    loading.textContent = 'Loading DB-backed H2H timeline...';
    body.appendChild(loading);
    var ft = document.createElement('div'); ft.className = 'modal-footer';
    var back = document.createElement('button'); back.className = 'btn'; back.textContent = 'Back';
    back.onclick = function(){ ov.remove(); };
    var close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
    close.onclick = function(){
      ov.remove();
      try{ document.querySelectorAll('.modal-backdrop').forEach(function(x){ x.remove(); }); }catch(_){ }
    };
    ft.append(back, close);
    md.append(head, body, ft); ov.appendChild(md); document.body.appendChild(ov);
    md.tabIndex = 0; md.focus();
    ov.addEventListener('click', function(e){ if(e.target === ov) ov.remove(); });
    ov.addEventListener('keydown', function(e){ if(e.key === 'Escape') ov.remove(); });

    var redraw = null;
    var oldRemove = ov.remove.bind(ov);
    ov.remove = function(){
      try{ if (redraw) window.removeEventListener('resize', redraw); }catch(_){ }
      oldRemove();
    };

    var activeRange = 'all';
    var activeGraphMode = 'running';
    var activeRows = [];
    function rangeLabel(rangeKey){
      if (rangeKey === 'last_6_months') return '6 Months';
      if (rangeKey === 'last_1_month') return '1 Month';
      if (rangeKey === 'last_1_week') return '1 Week';
      return 'All Time';
    }

    async function loadTimeline(rangeKey){
      activeRange = rangeKey || 'all';
      try{
        if (!playerAKey || !playerBKey) throw new Error('Missing H2H player keys');
        if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) throw new Error('Supabase client unavailable');
        var client = window.sb || window.__sb || (typeof sb !== 'undefined' ? sb : null) || window.supabaseClient || null;
        if (!client || typeof client.rpc !== 'function') throw new Error('Supabase RPC client unavailable');
        body.textContent = '';
        var loadMsg = document.createElement('p');
        loadMsg.className = 'muted';
        loadMsg.textContent = 'Loading DB-backed H2H timeline...';
        body.appendChild(loadMsg);
        var result = await client.rpc('rpc_h2h_official_pair_timeline', {
          p_player_a_key: playerAKey,
          p_player_b_key: playerBKey,
          p_range: activeRange
        });
        if (result && result.error) throw result.error;
        var rows = ((result && result.data) || []).slice().sort(function(a,b){
          return (Number(a && a.match_number || 0) - Number(b && b.match_number || 0));
        });
        renderTimeline(rows);
      }catch(e){
        try{ console.warn('[SQ] H2H timeline RPC unavailable', e); }catch(_){}
        body.textContent = '';
        body.appendChild(makeH2HDbRangeControls(activeRange, loadTimeline));
        var p = document.createElement('p');
        p.textContent = 'H2H timeline range data is not available for ' + rangeLabel(activeRange) + '. Required Supabase RPC range support is missing or returned an error.';
        body.appendChild(p);
      }
    }

    function setGraphMode(modeKey){
      activeGraphMode = modeKey || 'running';
      renderTimeline(activeRows);
    }

    function renderTimeline(rows){
      activeRows = Array.isArray(rows) ? rows : [];
      body.textContent = '';
      if (!activeRows.length){
        body.appendChild(makeH2HDbRangeControls(activeRange, loadTimeline));
        var empty = document.createElement('p');
        empty.textContent = 'No H2H timeline data available.';
        body.appendChild(empty);
        return;
      }
      var last = activeRows[activeRows.length - 1] || {};
      var progress = calcH2HDbProgression(activeRows);
      var summary = document.createElement('div');
      summary.style.display = 'grid';
      summary.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
      summary.style.gap = '10px';
      summary.style.margin = '0 0 10px';
      function card(label, value){
        var c = document.createElement('div');
        c.style.border = '1px solid rgba(255,255,255,.10)';
        c.style.borderRadius = '12px';
        c.style.background = 'rgba(255,255,255,.035)';
        c.style.padding = '9px 10px';
        var l = document.createElement('div');
        l.textContent = label;
        l.style.fontSize = '10px';
        l.style.letterSpacing = '.14em';
        l.style.textTransform = 'uppercase';
        l.style.color = 'rgba(231,233,245,.58)';
        l.style.fontWeight = '900';
        var v = document.createElement('div');
        v.textContent = value;
        v.style.marginTop = '4px';
        v.style.fontSize = '20px';
        v.style.fontWeight = '900';
        v.style.fontVariantNumeric = 'tabular-nums';
        c.append(l, v);
        return c;
      }
      var avg = Number(last.running_avg_diff);
      var combinedAvg = Number.isFinite(avg) ? ((avg >= 0 ? '+' : '') + avg.toFixed(1)) : '—';
      summary.append(
        card('Matches', String(rows.length)),
        card('Win % / Avg Diff', (Number(last.running_win_pct) || 0).toFixed(1) + '% / ' + combinedAvg),
        card('W-L-D', String(last.running_wins || 0) + '-' + String(last.running_losses || 0) + '-' + String(last.running_draws || 0))
      );

      var progression = document.createElement('div');
      progression.style.display = 'grid';
      progression.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
      progression.style.gap = '10px';
      progression.style.margin = '0 0 10px';
      function fmtPct(v){ return v == null ? '—' : v.toFixed(1) + '%'; }
      function fmtDiff(v){ return v == null ? '—' : ((v >= 0 ? '+' : '') + v.toFixed(1)); }
      if (progress.enough){
        progression.append(
          card('First 50%', fmtPct(progress.firstWinPct) + ' / ' + fmtDiff(progress.firstAvgDiff)),
          card('Second 50%', fmtPct(progress.secondWinPct) + ' / ' + fmtDiff(progress.secondAvgDiff)),
          card('Change', fmtPct(progress.winPctDelta) + ' / ' + fmtDiff(progress.avgDiffDelta))
        );
      } else {
        var pNote = document.createElement('div');
        pNote.className = 'muted';
        pNote.textContent = 'Not enough games for progression.';
        pNote.style.gridColumn = '1 / -1';
        progression.appendChild(pNote);
      }

      var wrap = document.createElement('div');
      wrap.style.border = '1px solid rgba(255,255,255,.10)';
      wrap.style.borderRadius = '0 14px 14px 0';
      wrap.style.borderLeft = '0';
      wrap.style.background = 'rgba(0,0,0,.16)';
      wrap.style.padding = '10px';
      wrap.style.height = '330px';
      wrap.style.flex = '1 1 auto';
      wrap.style.minWidth = '0';
      wrap.style.boxSizing = 'border-box';
      wrap.style.overflowX = 'auto';
      wrap.style.overflowY = 'hidden';
      wrap.style.webkitOverflowScrolling = 'touch';
      var canvas = document.createElement('canvas');
      canvas.style.width = Math.max(720, Math.min(1800, 360 + (activeRows.length * 5))) + 'px';
      canvas.style.maxWidth = 'none';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.setAttribute('aria-label', 'DB-backed rolling H2H win percentage graph');
      wrap.appendChild(canvas);

      var graphShell = document.createElement('div');
      graphShell.style.display = 'flex';
      graphShell.style.alignItems = 'stretch';
      graphShell.style.width = '100%';
      graphShell.style.minWidth = '0';
      graphShell.append(makeH2HDbYAxisPanel(), wrap);

      body.append(makeH2HDbRangeControls(activeRange, loadTimeline), makeH2HDbAverageControls(activeGraphMode, setGraphMode), summary, progression, graphShell);
      try{ if (redraw) window.removeEventListener('resize', redraw); }catch(_){ }
      setTimeout(function(){ drawH2HDbTimelineCanvas(canvas, activeRows, activeGraphMode); }, 30);
      redraw = function(){ drawH2HDbTimelineCanvas(canvas, activeRows, activeGraphMode); };
      window.addEventListener('resize', redraw, { passive:true });
    }

    loadTimeline('all');
  }

	  window.openPlayerH2HDialog = async function openPlayerH2HDialog(playerName){
	    var playerKey = String(playerName || '').trim().toLowerCase();
	    var rows = [];
	    var h2hUnavailable = false;
	
	    try{
	      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) throw new Error('Supabase client unavailable');
	      var client = window.sb || window.__sb || (typeof sb !== 'undefined' ? sb : null) || window.supabaseClient || null;
	      if (!client || typeof client.rpc !== 'function') throw new Error('Supabase RPC client unavailable');
	      var result = await client.rpc('rpc_h2h_official_summary', { p_range: 'all' });
	      if (result && result.error) throw result.error;
	      rows = ((result && result.data) || [])
	        .filter(function(r){ return String((r && r.player_a_key) || '').trim().toLowerCase() === playerKey; })
	        .map(function(r){
	          var gp = Number(r && r.games_played || 0);
	          var winPct = Number(r && r.player_a_win_pct);
	          var avgDiff = Number(r && r.avg_score_diff);
	          return {
	            playerAKey:String((r && r.player_a_key) || '').trim().toLowerCase(),
	            playerBKey:String((r && r.player_b_key) || '').trim().toLowerCase(),
	            name:String((r && r.player_b_name) || '').trim(),
	            gp:gp,
	            w:Number(r && r.player_a_wins || 0),
	            l:Number(r && r.player_b_wins || 0),
	            winPct:winPct,
	            hasWinPct:Number.isFinite(winPct),
	            avgDiff:avgDiff,
	            hasAvgDiff:Number.isFinite(avgDiff),
	            isEligible:gp >= 4
	          };
	        })
	        .filter(function(r){ return !!r.name; });
	    }catch(e){
	      h2hUnavailable = true;
	      rows = [];
	      try{ console.warn('[SQ] H2H League RPC unavailable', e); }catch(_){}
	    }
	
	    rows.sort(function(a,b){
	      /* @RANKING:H2H_DB_SORT_ORDER
	         Clean Official H2H League sort: eligible first, Win % asc, Avg Diff asc, GP desc, Name asc. */
	      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
	      var aw = a.hasWinPct ? a.winPct : Infinity;
	      var bw = b.hasWinPct ? b.winPct : Infinity;
	      var ad = a.hasAvgDiff ? a.avgDiff : Infinity;
	      var bd = b.hasAvgDiff ? b.avgDiff : Infinity;
	      return (aw-bw) ||
	        (ad-bd) ||
	        (b.gp-a.gp) ||
	        a.name.localeCompare(b.name);
	    });

    var overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
    var modal = document.createElement('div'); modal.className = 'modal sq-wide-modal';
    var title = document.createElement('h3'); title.textContent = 'Head-to-Head — ' + playerName;
    var body = document.createElement('div'); body.className = 'modal-body';

	    var hint = document.createElement('div');
	    hint.className = 'muted';
	    hint.style.margin = '0 0 10px';
	    hint.textContent = 'Clean official H2H League from Supabase. Click an opponent row for the DB-backed rolling graph.';
	    body.appendChild(hint);
	
	    if (h2hUnavailable){
	      var p = document.createElement('p'); p.textContent = 'H2H League data is not available yet. Required Supabase RPC/data source is missing.'; body.appendChild(p);
	    } else if (!rows.length){
	      var p = document.createElement('p'); p.textContent = 'No H2H records yet for this player.'; body.appendChild(p);
	    } else {
	      var table = document.createElement('table'); table.className = 'hs-table sq-h2h-table';
	      var thead = document.createElement('thead'); var trh = document.createElement('tr');
	      ['#','Name','Played','W','L','Win %','Avg Score Diff'].forEach(function(x){ var th=document.createElement('th'); th.textContent=x; trh.appendChild(th); });
	      thead.appendChild(trh); table.appendChild(thead);
	      var tbody = document.createElement('tbody');
	      var pos = 0;
	      rows.forEach(function(r){
	        var tr = document.createElement('tr');
	        if (!r.isEligible){
	          tr.className = 'sq-h2h-ineligible';
	          tr.style.opacity = '.52';
	        }
	        tr.title = r.isEligible ? 'Open DB-backed rolling graph' : 'Needs 4 games to qualify; click to inspect DB timeline';
	        tr.style.cursor = 'pointer';
	        tr.addEventListener('click', function(){ openH2HOpponentGraph(playerName, r); });
	        var td = function(t,c){ var x=document.createElement('td'); x.textContent=t; if(c) x.className=c; return x; };
	        var rankText = r.isEligible ? String(++pos) : '—';
	        tr.append(
          td(rankText,'num'),
	          td(r.name),
	          td(String(r.gp),'num'),
	          td(String(r.w),'num'),
	          td(String(r.l),'num'),
	          td(r.hasWinPct ? (r.winPct.toFixed(1)+'%') : '—','num'),
	          td(r.hasAvgDiff ? ((r.avgDiff>=0?'+':'')+r.avgDiff.toFixed(1)) : '—','num')
	        );
	        tbody.appendChild(tr);
	      });
      table.appendChild(tbody);
      body.appendChild(table);
    }

    var footer = document.createElement('div'); footer.className = 'modal-footer';
    var back = document.createElement('button'); back.className='btn'; back.textContent='Back';
    back.onclick = function(){
      overlay.remove();
      if (typeof openPlayerStatsModePicker === 'function') openPlayerStatsModePicker(playerName);
      else if (typeof openPlayerStatsLookupDialog === 'function') openPlayerStatsLookupDialog();
    };
    footer.append(back);
    modal.append(title, body, footer); overlay.appendChild(modal); document.body.appendChild(overlay);
    __sqStatsArcade(overlay, modal);
    modal.tabIndex=0; modal.focus();
    overlay.addEventListener('click', function(e){ if(e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', function(e){ if(e.key === 'Escape') overlay.remove(); });
  };
})();
