from pathlib import Path

p = Path('index.html')
s = p.read_text()


def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    s = s.replace(old, new, 1)
    print('patched', label)


def replace_count(old, new, count, label):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit(f'{label}: expected {count} matches, found {n}')
    s = s.replace(old, new)
    print('patched', label, n)

# One shared, truthful nonlinear radius transform for the base and comparison Spiders.
replace_once(
"""  function drawRadar(canvas, labels, valuesPct, opts){
""",
"""  function __sqSpiderRadiusNorm(valuePct){
    const p = Math.max(0, Math.min(100, Number(valuePct)||0));
    if (p <= 25) return (p / 25) * 0.5;
    if (p <= 75) return 0.5 + ((p - 25) / 50) * 0.25;
    return 0.75 + ((p - 75) / 25) * 0.25;
  }

  function drawRadar(canvas, labels, valuesPct, opts){
""",
'spider radius helper')

replace_once(
"""    // rings (outer ring brighter)
    for (let g=1; g<=4; g++){
      const r = (R*g)/4;
      ctx.beginPath();
      for (let i=0;i<N;i++){
        const x = cx + Math.cos(ang(i))*r, y = cy + Math.sin(ang(i))*r;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle = g===4 ? 'rgba(122,170,255,0.45)' : 'rgba(122,170,255,0.16)';
      ctx.lineWidth = g===4 ? 1.4 : 1;
      ctx.stroke();
    }
""",
"""    // percentage rings follow the same nonlinear radius scale as the data.
    const ringPcts = [25, 50, 75, 100];
    for (let g=1; g<=ringPcts.length; g++){
      const r = R * __sqSpiderRadiusNorm(ringPcts[g-1]);
      ctx.beginPath();
      for (let i=0;i<N;i++){
        const x = cx + Math.cos(ang(i))*r, y = cy + Math.sin(ang(i))*r;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle = g===ringPcts.length ? 'rgba(122,170,255,0.45)' : 'rgba(122,170,255,0.16)';
      ctx.lineWidth = g===ringPcts.length ? 1.4 : 1;
      ctx.stroke();
    }
""",
'spider scale rings')

replace_once(
"""    // value points
    const pts = labels.map((_,i)=>{
      const p = Math.max(0, Math.min(100, Number(valuesPct[i]||0)))/100;
      return { x: cx + Math.cos(ang(i))*R*p, y: cy + Math.sin(ang(i))*R*p, v: p*100 };
    });
""",
"""    // value points use the nonlinear display scale while retaining the real percentage.
    const pts = labels.map((_,i)=>{
      const pct = Math.max(0, Math.min(100, Number(valuesPct[i]||0)));
      const radius = __sqSpiderRadiusNorm(pct);
      return { x: cx + Math.cos(ang(i))*R*radius, y: cy + Math.sin(ang(i))*R*radius, v:pct };
    });
""",
'spider value points')

replace_once(
"""    // subtle ring scale marks
    ctx.fillStyle = 'rgba(160,190,235,0.5)';
    ctx.font = '700 9px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText('50', cx - 16, cy - R/2 - 4);
    ctx.fillText('100', cx - 18, cy - R + 10);
""",
"""    // subtle ring scale marks; positions reflect the nonlinear display scale.
    ctx.fillStyle = 'rgba(160,190,235,0.5)';
    ctx.font = '700 9px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    [25, 50, 75, 100].forEach(function(mark){
      const y = cy - R * __sqSpiderRadiusNorm(mark) + (mark === 100 ? 10 : -4);
      ctx.fillText(String(mark), cx - 18, y);
    });
""",
'spider scale labels')

replace_once(
"""    var v = Math.max(0, Math.min(100, raw)) / 100;
""",
"""    var v = __sqSpiderRadiusNorm(raw);
""",
'comparison overlay radius')

# Carry source_games through Hit rows so player-level ranking eligibility can be calculated.
replace_once(
"""    var sort = Number(r.target_sort);
    if (!Number.isFinite(sort)) sort = typeof __sqTargetPctOrder === 'function' ? __sqTargetPctOrder(key) : 999;
    return { key:key, playerKey:rankKey(r.player_key || r.player_name), playerName:String(r.player_name || r.player_key || ''), throwsN:throwsN, hits:hits, pct:pct, sort:sort };
""",
"""    var sort = Number(r.target_sort);
    if (!Number.isFinite(sort)) sort = typeof __sqTargetPctOrder === 'function' ? __sqTargetPctOrder(key) : 999;
    var sourceGames = Number((typeof __sqTargetPctValue === 'function' ? __sqTargetPctValue(r, ['source_games','games','game_count']) : r.source_games) || 0);
    return { key:key, playerKey:rankKey(r.player_key || r.player_name), playerName:String(r.player_name || r.player_key || ''), throwsN:throwsN, hits:hits, pct:pct, sourceGames:sourceGames, sort:sort };
""",
'hit source games')

replace_once(
"""  async function fetchTargetHitGlobalRanks(rows){
""",
"""  var __SQ_TARGET_MIN_GAMES = 10;
  function __sqFilterTargetEligiblePlayers(rows){
    var maxGamesByPlayer = new Map();
    (rows || []).forEach(function(r){
      var pk = String(r.playerKey || '').trim();
      if (!pk) return;
      var games = Math.max(0, Number(r.sourceGames) || 0);
      if (!maxGamesByPlayer.has(pk) || games > maxGamesByPlayer.get(pk)) maxGamesByPlayer.set(pk, games);
    });
    return (rows || []).filter(function(r){
      var pk = String(r.playerKey || '').trim();
      return pk && (maxGamesByPlayer.get(pk) || 0) >= __SQ_TARGET_MIN_GAMES;
    });
  }

  async function fetchTargetHitGlobalRanks(rows){
""",
'player eligibility helper')

replace_once(
"""        .select('player_key,player_name,target_key,target_label,target_sort,throws,hits,hit_pct')
""",
"""        .select('player_key,player_name,target_key,target_label,target_sort,throws,hits,hit_pct,source_games')
""",
'hit global rank source_games select')

replace_count(
"""        return !savedSet || savedSet.has(r.playerKey);
      });
      var byTarget = new Map();
""",
"""        return !savedSet || savedSet.has(r.playerKey);
      });
      allRows = __sqFilterTargetEligiblePlayers(allRows);
      var byTarget = new Map();
""",
2,
'eligibility applied to hit and points global ranks')

replace_once(
"""      head.textContent = 'Target ' + k + ' - all players';
""",
"""      head.textContent = 'Target ' + k + ' - 10+ games';
""",
'eligible ranking heading')

p.write_text(s)
print('SC-013 patch complete')
