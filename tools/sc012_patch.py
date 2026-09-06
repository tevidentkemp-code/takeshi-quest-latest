from pathlib import Path

p = Path('index.html')
s = p.read_text()

def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s = s.replace(old, new, 1)

rep(
"return { key:key, playerKey:rankKey(r.player_key || r.player_name), throwsN:throwsN, hits:hits, pct:pct, sort:sort };",
"return { key:key, playerKey:rankKey(r.player_key || r.player_name), playerName:String(r.player_name || r.player_key || ''), throwsN:throwsN, hits:hits, pct:pct, sort:sort };",
'hit normalized player name')

rep(
"""        list.forEach(function(r, i){
          var sig = [Number(r.pct || 0).toFixed(8), Number(r.hits || 0), Number(r.throwsN || 0), String(r.playerKey || '')].join('|');
          if (sig !== prev){ rank = i + 1; prev = sig; }
          ranks.set(targetKey + '|' + r.playerKey, rank);
        });
      });
      console.debug('[SQ] Target Hit % global rank source used', { source:'v_player_target_hit_pct', rows:allRows.length, saved_players_only:!!savedSet });
      return ranks;""",
"""        list.forEach(function(r, i){
          var sig = [Number(r.pct || 0).toFixed(8), Number(r.hits || 0), Number(r.throwsN || 0), String(r.playerKey || '')].join('|');
          if (sig !== prev){ rank = i + 1; prev = sig; }
          r.gRank = rank;
          ranks.set(targetKey + '|' + r.playerKey, rank);
        });
      });
      ranks.__sqByTarget = byTarget;
      ranks.__sqAllRows = allRows;
      console.debug('[SQ] Target Hit % global rank source used', { source:'v_player_target_hit_pct', rows:allRows.length, saved_players_only:!!savedSet });
      return ranks;""",
'hit global rank rows')

rep(
"""        list.forEach(function(r, i){
          var sig = [Number(r.pct || 0).toFixed(8), Number(r.actual || 0), Number(r.sourceGames || 0), String(r.playerName || r.playerKey || '')].join('|');
          if (sig !== prev){ rank = i + 1; prev = sig; }
          ranks.set(targetKey + '|' + r.playerKey, rank);
        });
      });
      console.debug('[SQ] Target Points % global rank source used', { source:'v_player_target_points_pct', rows:allRows.length, saved_players_only:!!savedSet });
      return ranks;""",
"""        list.forEach(function(r, i){
          var sig = [Number(r.pct || 0).toFixed(8), Number(r.actual || 0), Number(r.sourceGames || 0), String(r.playerName || r.playerKey || '')].join('|');
          if (sig !== prev){ rank = i + 1; prev = sig; }
          r.gRank = rank;
          ranks.set(targetKey + '|' + r.playerKey, rank);
        });
      });
      ranks.__sqByTarget = byTarget;
      ranks.__sqAllRows = allRows;
      console.debug('[SQ] Target Points % global rank source used', { source:'v_player_target_points_pct', rows:allRows.length, saved_players_only:!!savedSet });
      return ranks;""",
'points global rank rows')

rep(
"""  // @CANONICAL:PLAYER_TARGET_HIT_HEATMAP
  window.openPlayerTargetHitDialog = async function openPlayerTargetHitDialog(playerName){""",
"""  function __sqBuildTargetComparePlayers(globalRanks, labels){
    var allRows = globalRanks && Array.isArray(globalRanks.__sqAllRows) ? globalRanks.__sqAllRows : [];
    var byPlayer = new Map();
    allRows.forEach(function(r){
      var pk = String(r.playerKey || '').trim();
      if (!pk) return;
      if (!byPlayer.has(pk)) byPlayer.set(pk, { key:pk, name:String(r.playerName || r.playerKey || pk), rows:new Map() });
      byPlayer.get(pk).rows.set(String(r.key || '').toUpperCase(), Number(r.pct));
    });
    return Array.from(byPlayer.values()).map(function(pl){
      return {
        key:pl.key,
        name:pl.name,
        pct:(labels || []).map(function(k){
          var v = pl.rows.get(String(k || '').toUpperCase());
          return Number.isFinite(v) ? v : null;
        })
      };
    }).sort(function(a,b){ return String(a.name || '').localeCompare(String(b.name || '')); });
  }

  // @CANONICAL:PLAYER_TARGET_HIT_HEATMAP
  window.openPlayerTargetHitDialog = async function openPlayerTargetHitDialog(playerName){""",
'compare player helper')

rep(
"window.__lastTargetHitPctSpiderData = { labels: rows.map(function(r){ return String(r.key); }), pct: rows.map(function(r){ return Number(r.pct || 0); }) };",
"""var spiderLabels = rows.map(function(r){ return String(r.key); });
    window.__lastTargetHitPctSpiderData = {
      labels:spiderLabels,
      pct:rows.map(function(r){ return Number(r.pct || 0); }),
      comparePlayers:__sqBuildTargetComparePlayers(globalRanks, spiderLabels)
    };""",
'hit spider compare data')

rep(
"window.__lastPointsPctSpiderData = { labels: rows.map(function(r){ return String(r.key); }), pct: rows.map(function(r){ return Number(r.pct || 0); }) };",
"""var spiderLabels = rows.map(function(r){ return String(r.key); });
    window.__lastPointsPctSpiderData = {
      labels:spiderLabels,
      pct:rows.map(function(r){ return Number(r.pct || 0); }),
      comparePlayers:__sqBuildTargetComparePlayers(globalRanks, spiderLabels)
    };""",
'points spider compare data')

rep(
"function __sqWireBoardInspect(heatPanel, tablePanel, rows, mode){",
"function __sqWireBoardInspect(heatPanel, tablePanel, rows, mode, globalRanks, currentPlayerName){",
'board inspect signature')

rep(
"""    spot.append(spotKey, spotPct, spotSub);
    heatPanel.appendChild(spot);
    var selected = null;""",
"""    spot.append(spotKey, spotPct, spotSub);
    heatPanel.appendChild(spot);

    var rankPanel = document.createElement('div');
    rankPanel.className = 'sq-target-global-ranking';
    rankPanel.style.cssText = 'position:absolute;top:76px;left:10px;display:none;width:min(310px,calc(100% - 20px));max-height:158px;overflow-y:auto;overflow-x:hidden;'
      + 'background:rgba(9,15,29,.97);border:1px solid rgba(125,211,252,.55);border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,.52);z-index:4;overscroll-behavior:contain;';
    heatPanel.appendChild(rankPanel);

    var selected = null;""",
'board inspect rank panel')

rep(
"""    var rowFor = function(k){ return (rows || []).find(function(r){ return String(r.key).toUpperCase() === k; }) || null; };
    var highlightTableRow = function(k){""",
"""    var rowFor = function(k){ return (rows || []).find(function(r){ return String(r.key).toUpperCase() === k; }) || null; };
    var renderGlobalRanking = function(k){
      var byTarget = globalRanks && globalRanks.__sqByTarget;
      var list = byTarget && typeof byTarget.get === 'function' ? (byTarget.get(String(k || '').toUpperCase()) || []) : [];
      rankPanel.innerHTML = '';
      if (!list.length){ rankPanel.style.display = 'none'; return; }
      rankPanel.style.display = 'block';
      var head = document.createElement('div');
      head.className = 'sq-target-global-ranking-head';
      head.style.cssText = 'position:sticky;top:0;z-index:1;padding:7px 9px;background:rgba(12,20,38,.98);border-bottom:1px solid rgba(125,211,252,.28);font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#d9ecff;';
      head.textContent = 'Target ' + k + ' - all players';
      rankPanel.appendChild(head);
      var tbl = document.createElement('table');
      tbl.className = 'sq-table hs-table';
      tbl.style.cssText = 'width:100%;font-size:10px;table-layout:fixed;';
      tbl.innerHTML = '<colgroup><col style="width:18%"><col style="width:50%"><col style="width:32%"></colgroup><thead><tr><th>#</th><th>Player</th><th>' + (mode === 'points' ? '% Score' : 'Hit %') + '</th></tr></thead><tbody></tbody>';
      var tbody = tbl.querySelector('tbody');
      var currentKey = rankKey(currentPlayerName);
      list.forEach(function(r, i){
        var tr = document.createElement('tr');
        if (String(r.playerKey || '') === currentKey){
          tr.dataset.currentPlayer = '1';
          tr.style.background = 'rgba(255,122,0,.14)';
          tr.style.boxShadow = 'inset 3px 0 0 rgba(255,164,64,.9)';
        }
        var rankTd = document.createElement('td'); rankTd.textContent = '#' + String(r.gRank || (i + 1));
        var playerTd = document.createElement('td');
        var nm = document.createElement('div'); nm.textContent = String(r.playerName || r.playerKey || ''); nm.style.fontWeight = '850';
        var sub = document.createElement('div'); sub.className = 'muted'; sub.style.fontSize = '8px';
        sub.textContent = mode === 'points' ? (fmtAvgScore(r.avgScore) + ' avg') : ((r.hits || 0) + '/' + (r.throwsN || 0) + ' hits');
        playerTd.append(nm, sub);
        var metricTd = document.createElement('td'); metricTd.textContent = pctFmt(r.pct);
        tr.append(rankTd, playerTd, metricTd); tbody.appendChild(tr);
      });
      rankPanel.appendChild(tbl);
    };
    var highlightTableRow = function(k){""",
'board ranking renderer')

rep(
"if (selected == null){ spot.style.display = 'none'; highlightTableRow('\\0'); return; }",
"if (selected == null){ spot.style.display = 'none'; rankPanel.style.display = 'none'; highlightTableRow('\\0'); return; }",
'board deselect ranking')

rep(
"""      cancelAnimationFrame(countRaf);
      var target = Number(r.pct || 0);""",
"""      renderGlobalRanking(selected);
      cancelAnimationFrame(countRaf);
      var target = Number(r.pct || 0);""",
'board selected ranking render')

rep(
"__sqWireBoardInspect(heatPanel, tablePanel, rows, 'hit');",
"__sqWireBoardInspect(heatPanel, tablePanel, rows, 'hit', globalRanks, name);",
'hit wire global rankings')
rep(
"__sqWireBoardInspect(heatPanel, tablePanel, rows, 'points');",
"__sqWireBoardInspect(heatPanel, tablePanel, rows, 'points', globalRanks, name);",
'points wire global rankings')

rep(
"""  window.openPlayerSpiderDialog = async function openPlayerSpiderDialog(playerName, opts){""",
"""  function __sqDrawSpiderComparisonOverlay(canvas, labels, valuesPct, opts){
    if (!canvas || !Array.isArray(labels) || !labels.length || !Array.isArray(valuesPct)) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.355;
    var N = labels.length, t = Math.max(0, Math.min(1, Number(opts && opts.t == null ? 1 : opts.t)));
    var pts = [];
    for (var i=0;i<N;i++){
      var raw = Number(valuesPct[i]);
      if (!Number.isFinite(raw)){ pts.push(null); continue; }
      var v = Math.max(0, Math.min(100, raw)) / 100;
      var a = -Math.PI / 2 + (i * Math.PI * 2 / N);
      pts.push({ x:cx + Math.cos(a) * R * v * t, y:cy + Math.sin(a) * R * v * t });
    }
    ctx.save();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([8,5]);
    ctx.shadowColor = 'rgba(125,211,252,.7)';
    ctx.shadowBlur = 8;
    var complete = pts.every(function(p){ return !!p; });
    if (complete){
      ctx.beginPath();
      pts.forEach(function(p,i){ if (i === 0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.closePath(); ctx.stroke();
    } else {
      var drawing = false;
      pts.forEach(function(p){
        if (!p){ if (drawing){ ctx.stroke(); drawing = false; } return; }
        if (!drawing){ ctx.beginPath(); ctx.moveTo(p.x,p.y); drawing = true; }
        else ctx.lineTo(p.x,p.y);
      });
      if (drawing) ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    pts.forEach(function(p){
      if (!p) return;
      ctx.fillStyle = '#08111f';
      ctx.strokeStyle = '#e9fbff';
      ctx.lineWidth = 1.5;
      ctx.fillRect(p.x - 3.5, p.y - 3.5, 7, 7);
      ctx.strokeRect(p.x - 3.5, p.y - 3.5, 7, 7);
    });
    ctx.restore();
  }

  window.openPlayerSpiderDialog = async function openPlayerSpiderDialog(playerName, opts){""",
'spider comparison draw helper')

rep(
"""    const note = document.createElement('div');
    note.className='muted';
    note.style.cssText='display:flex;justify-content:center;gap:10px;flex-wrap:wrap;min-height:30px;align-items:center;';
    note.textContent='Loading…';""",
"""    const note = document.createElement('div');
    note.className='muted';
    note.style.cssText='display:flex;justify-content:center;gap:10px;flex-wrap:wrap;min-height:30px;align-items:center;';
    note.textContent='Loading…';

    const compareRows = opts && opts.data && Array.isArray(opts.data.comparePlayers) ? opts.data.comparePlayers : [];
    const compareBar = document.createElement('div');
    compareBar.className = 'sq-spider-compare-bar';
    compareBar.style.cssText = 'width:100%;display:flex;justify-content:flex-end;align-items:center;gap:8px;';
    const compareLabel = document.createElement('label'); compareLabel.textContent = 'Compare';
    compareLabel.style.cssText = 'font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(190,215,245,.82);';
    const compareSelect = document.createElement('select');
    compareSelect.className = 'sq-spider-compare-select';
    compareSelect.setAttribute('aria-label', 'Compare player');
    compareSelect.style.cssText = 'max-width:min(220px,58vw);background:#0d1424;color:#eaf5ff;border:1px solid rgba(125,211,252,.52);border-radius:9px;padding:7px 9px;font-weight:800;';
    var compareNone = document.createElement('option'); compareNone.value = ''; compareNone.textContent = 'Choose player...'; compareSelect.appendChild(compareNone);
    compareRows.forEach(function(pl, i){ var op = document.createElement('option'); op.value = String(i); op.textContent = String(pl.name || pl.key || ''); compareSelect.appendChild(op); });
    compareBar.append(compareLabel, compareSelect);
    if (!compareRows.length) compareBar.style.display = 'none';
    const compareLegend = document.createElement('div');
    compareLegend.className = 'sq-spider-compare-legend';
    compareLegend.style.cssText = 'display:none;width:100%;justify-content:center;gap:14px;flex-wrap:wrap;font-size:10px;font-weight:850;color:#dcecff;';
    let activeCompare = null;
    const renderCompareLegend = () => {
      compareLegend.innerHTML = '';
      if (!activeCompare){ compareLegend.style.display = 'none'; return; }
      compareLegend.style.display = 'flex';
      const mk = (label, dashed) => { const el = document.createElement('span'); el.style.cssText='display:inline-flex;align-items:center;gap:6px;'; const sw=document.createElement('i'); sw.style.cssText='display:inline-block;width:24px;border-top:3px ' + (dashed ? 'dashed #7dd3fc' : 'solid #ffa440') + ';'; const tx=document.createElement('span'); tx.textContent=label; el.append(sw,tx); return el; };
      compareLegend.append(mk(name, false), mk(String(activeCompare.name || activeCompare.key || ''), true));
    };""",
'spider compare controls')

rep(
"""    const showRadar = (labels, pct) => {
      canvas.__sqSpider = { labels, pct, sel:null };
      cancelAnimationFrame(spiderRaf);""",
"""    const paintRadar = (labels, pct, sel, t) => {
      drawRadar(canvas, labels, pct, { t:t, sel:sel });
      if (activeCompare && Array.isArray(activeCompare.pct)) __sqDrawSpiderComparisonOverlay(canvas, labels, activeCompare.pct, { t:t });
      canvas.dataset.sqCompare = activeCompare ? String(activeCompare.name || activeCompare.key || '') : '';
    };
    const showRadar = (labels, pct) => {
      canvas.__sqSpider = { labels, pct, sel:null, compare:activeCompare };
      cancelAnimationFrame(spiderRaf);""",
'spider paint wrapper')

rep(
"drawRadar(canvas, labels, pct, { t:raw, sel:null });",
"paintRadar(labels, pct, null, raw);",
'spider animated compare paint')
rep(
"drawRadar(canvas, s.labels, s.pct, { t:1, sel:s.sel });",
"paintRadar(s.labels, s.pct, s.sel, 1);",
'spider click compare paint')

rep(
"""    wrap.append(canvas, note);
    body.appendChild(wrap);""",
"""    compareSelect.onchange = () => {
      activeCompare = compareSelect.value === '' ? null : (compareRows[Number(compareSelect.value)] || null);
      const s = canvas.__sqSpider;
      if (s){ s.compare = activeCompare; paintRadar(s.labels, s.pct, s.sel, 1); }
      renderCompareLegend();
    };

    wrap.append(compareBar, canvas, compareLegend, note);
    body.appendChild(wrap);""",
'spider compare placement')

p.write_text(s)
print('SC-012 patch applied')
