from pathlib import Path

INDEX = Path('index.html')
VERIFY = Path('tools/ui-smoke/verify-classic-visual-fit.js')

text = INDEX.read_text(encoding='utf-8')


def swap_once(region, old, new, label):
    count = region.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return region.replace(old, new, 1)

# Patch only the final live V2 race model closure and final arcade renderer.
renderer_start = text.rfind('function __sqDrawArcadeRace(canvas, packet, st, now){')
if renderer_start < 0:
    raise SystemExit('final __sqDrawArcadeRace not found')
model_start = text.rfind('  function buildLiveSeries(){', 0, renderer_start)
if model_start < 0:
    raise SystemExit('final buildLiveSeries not found')
model_region = text[model_start:renderer_start]

model_region = swap_once(
    model_region,
    """      let running = 0;\n      const data = [];\n      let startedAny = false;""",
    """      let running = 0;\n      let throwRunning = 0;\n      const data = [];\n      const throwData = [0];\n      let startedAny = false;""",
    'add throw-progress state'
)
model_region = swap_once(
    model_region,
    """        const started = !!entry && (darts.length > 0 || Number(entry?.roundTotal || 0) > 0);\n        const done = (r < cr) || darts.length >= 3;\n""",
    """        const started = !!entry && (darts.length > 0 || Number(entry?.roundTotal || 0) > 0);\n        const done = (r < cr) || darts.length >= 3;\n        // SC-021: retain canonical round totals, but expose a read-only per-throw\n        // cumulative path for Classic race motion. Misses append the same Y value\n        // while still advancing one X step.\n        for (const dart of darts){\n          const pts = (typeof __sqV2DartPoints === 'function')\n            ? __sqV2DartPoints(dart)\n            : Number(dart && (dart.points ?? dart.score ?? dart.value ?? dart.total)) || 0;\n          throwRunning += Number.isFinite(Number(pts)) ? Number(pts) : 0;\n          throwData.push(throwRunning);\n        }\n""",
    'append per-throw cumulative points'
)
model_region = swap_once(
    model_region,
    """        data: trimmed,\n        dotted: false""",
    """        data: trimmed,\n        throwData,\n        dotted: false""",
    'attach throwData to series'
)
model_region = swap_once(
    model_region,
    """    const arr = series.map(s => s.data.join(',')).join('|') + '||' + recSig;""",
    """    const arr = series.map(s => s.data.join(',') + '>' + (Array.isArray(s.throwData) ? s.throwData.join(',') : '')).join('|') + '||' + recSig;""",
    'include misses in race signature'
)
model_region = swap_once(
    model_region,
    """    const __turboRace = (typeof __sqIsTurboRaceRuntimeState === 'function') ? __sqIsTurboRaceRuntimeState(state) : (()=>{ try{ const m = state?.match || {}; const draft = window.__sqTournamentDraft || state?.__sqTournamentDraft || null; const type = String(m.tournamentType || m.type || draft?.type || state?.tournamentType || '').toLowerCase(); return !!(type === 'turbo' || m.strictTimer === true || m.throwLimitSeconds === 20 || state?.strictTimer === true || state?.throwLimitSeconds === 20); }catch(_){ return false; } })();\n    const __turboStartIdx""",
    """    const __turboRace = (typeof __sqIsTurboRaceRuntimeState === 'function') ? __sqIsTurboRaceRuntimeState(state) : (()=>{ try{ const m = state?.match || {}; const draft = window.__sqTournamentDraft || state?.__sqTournamentDraft || null; const type = String(m.tournamentType || m.type || draft?.type || state?.tournamentType || '').toLowerCase(); return !!(type === 'turbo' || m.strictTimer === true || m.throwLimitSeconds === 20 || state?.strictTimer === true || state?.throwLimitSeconds === 20); }catch(_){ return false; } })();\n    const __raceModeKey = String(state?.mode || state?.gameMode || state?.game_mode || '').toLowerCase();\n    const __practiceRace = ['practice','unofficial','solo'].includes(__raceModeKey) || state?.isPractice === true || state?.is_practice === true || state?.practice === true || state?.match?.forcePractice === true;\n    const __shadowRace = (typeof __sqIsVsShadow === 'function') ? __sqIsVsShadow() : !!(state?.practiceVsShadow || state?.vsShadow || state?.vs_shadow || __raceModeKey === 'vsshadow');\n    const __classicThrowRace = live.length >= 2 && !__turboRace && !__practiceRace && !__shadowRace;\n    const __turboStartIdx""",
    'add explicit Classic mode isolation'
)
model_region = swap_once(
    model_region,
    """    drawRace(canvas, {series:live, record:null, records:null, labels, offset});""",
    """    drawRace(canvas, {series:live, record:null, records:null, labels, offset, classicThrowRace:__classicThrowRace});""",
    'flag initial Classic packet'
)
model_region = swap_once(
    model_region,
    """    drawRace(canvas, {series:live, record:rec, records, labels, offset});""",
    """    drawRace(canvas, {series:live, record:rec, records, labels, offset, classicThrowRace:__classicThrowRace});""",
    'flag final Classic packet'
)
text = text[:model_start] + model_region + text[renderer_start:]

# Re-find renderer after model length changed.
renderer_start = text.rfind('function __sqDrawArcadeRace(canvas, packet, st, now){')
renderer_end = text.find('\nasync function __sqV3EnsureLevels', renderer_start)
if renderer_end < 0:
    raise SystemExit('renderer end anchor not found')
render = text[renderer_start:renderer_end]

render = swap_once(
    render,
    """    const NP = packet ? packet.series.length : (state.players || []).length || 2;\n    const series = packet ? packet.series.map(s => s.data) : __sqV3RaceSeries();\n    const lens = series.map(p => { let n = 0; for (let i = 0; i < p.length; i++) if (p[i] != null) n = i + 1; return n; });""",
    """    const NP = packet ? packet.series.length : (state.players || []).length || 2;\n    const classicThrowRace = !!(packet && packet.classicThrowRace);\n    const series = packet ? packet.series.map(s => {\n      const src = classicThrowRace && Array.isArray(s.throwData) ? s.throwData : s.data;\n      return Array.isArray(src) ? src : [];\n    }) : __sqV3RaceSeries();\n    const lens = series.map(p => { let n = 0; for (let i = 0; i < p.length; i++) if (p[i] != null) n = i + 1; return n; });""",
    'select per-throw Classic series'
)
render = swap_once(
    render,
    """          if (w >= 6.5) st.combo[p] = { start: now, dur: 720, w: w };""",
    """          if (!classicThrowRace && w >= 6.5) st.combo[p] = { start: now, dur: 720, w: w };""",
    'keep Classic motion fluid'
)
render = swap_once(
    render,
    """    const playedTo = Math.max(1, ...lens);\n    const flat = series.flat().filter(v => v != null);""",
    """    const maxSeriesLen = Math.max(1, ...lens);\n    const playedTo = classicThrowRace ? Math.max(1, Math.ceil(Math.max(0, maxSeriesLen - 1) / 3)) : maxSeriesLen;\n    const flat = series.flat().filter(v => v != null);""",
    'keep local scale in round units'
)
render = swap_once(
    render,
    """      for (const s of packet.series) {\n        const label = String(s.name || '').replace(/^Record:/i,'HS').slice(0,12);\n        ctx.fillStyle = s.color || '#7bdcff'; ctx.fillText(label, keyX, 3);\n        keyX += ctx.measureText(label).width + 12;\n      }\n    }\n    const padL = 26, padR = 12, padT = packet ? 19 : 8, padB = 18, W = cssW - padL - padR, H = cssH - padT - padB;\n    const X = i => padL + (rc <= 1 ? 0 : (i / (rc - 1)) * W);\n    const Y = v => padT + H - (v / maxV) * H;""",
    """      for (const s of packet.series) {\n        const label = String(s.name || '').replace(/^Record:/i,'HS').slice(0,12);\n        ctx.fillStyle = s.color || '#7bdcff'; ctx.fillText(label, keyX, 3);\n        keyX += ctx.measureText(label).width + 12;\n      }\n      if (classicThrowRace && records.length){\n        ctx.save();\n        ctx.setLineDash([5,4]); ctx.strokeStyle = records[0].color || 'rgba(255,214,110,.9)'; ctx.lineWidth = 1.5;\n        ctx.beginPath(); ctx.moveTo(26, 15); ctx.lineTo(44, 15); ctx.stroke();\n        ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,224,150,.88)'; ctx.fillText('High Score', 49, 10);\n        ctx.restore();\n      }\n    }\n    const padL = 26, padR = 12, padT = classicThrowRace ? 25 : (packet ? 19 : 8), padB = 18, W = cssW - padL - padR, H = cssH - padT - padB;\n    const throwSteps = Math.max(1, rc * 3);\n    const XStep = step => padL + (Math.max(0, Math.min(throwSteps, Number(step) || 0)) / throwSteps) * W;\n    const X = i => classicThrowRace ? XStep((i + 1) * 3) : padL + (rc <= 1 ? 0 : (i / (rc - 1)) * W);\n    const Y = v => padT + H - (v / maxV) * H;""",
    'add High Score legend and throw coordinates'
)
render = swap_once(
    render,
    """    // vertical round grid + labels — every round labelled across the bottom.\n    ctx.textAlign = 'center'; ctx.textBaseline = 'top';\n    const cr = Number(state.currentRound || 0) - offset;\n    for (let i = 0; i < rc; i++){\n      const xx = X(i), isCur = i === cr;\n      ctx.strokeStyle = isCur ? 'rgba(255,138,20,.4)' : 'rgba(150,170,210,.07)'; ctx.lineWidth = isCur ? 1.5 : 1;\n      ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + H); ctx.stroke();\n      ctx.fillStyle = isCur ? 'rgba(255,190,90,.95)' : 'rgba(160,178,208,.5)'; ctx.fillText(packet ? packet.labels[i] : __sqV3RoundLabel(i), xx, padT + H + 4);\n    }""",
    """    // vertical round grid + labels. Classic starts at START and divides every\n    // round into three equal throw steps; other modes retain the existing grid.\n    ctx.textAlign = 'center'; ctx.textBaseline = 'top';\n    const cr = Number(state.currentRound || 0) - offset;\n    if (classicThrowRace){\n      const sx = XStep(0);\n      ctx.strokeStyle = 'rgba(150,170,210,.11)'; ctx.lineWidth = 1;\n      ctx.beginPath(); ctx.moveTo(sx, padT); ctx.lineTo(sx, padT + H); ctx.stroke();\n      ctx.font = '800 7px system-ui,sans-serif'; ctx.fillStyle = 'rgba(160,178,208,.58)'; ctx.textAlign = 'left'; ctx.fillText('START', sx, padT + H + 4);\n      ctx.font = '800 8px system-ui,sans-serif'; ctx.textAlign = 'center';\n      for (let i = 0; i < rc; i++){\n        for (let d = 1; d <= 2; d++){\n          const subX = XStep(i * 3 + d);\n          ctx.strokeStyle = 'rgba(150,170,210,.035)'; ctx.lineWidth = 1;\n          ctx.beginPath(); ctx.moveTo(subX, padT); ctx.lineTo(subX, padT + H); ctx.stroke();\n        }\n        const xx = X(i), isCur = i === cr;\n        ctx.strokeStyle = isCur ? 'rgba(255,138,20,.4)' : 'rgba(150,170,210,.08)'; ctx.lineWidth = isCur ? 1.5 : 1;\n        ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + H); ctx.stroke();\n        ctx.fillStyle = isCur ? 'rgba(255,190,90,.95)' : 'rgba(160,178,208,.5)'; ctx.fillText(packet ? packet.labels[i] : __sqV3RoundLabel(i), xx, padT + H + 4);\n      }\n    } else {\n      for (let i = 0; i < rc; i++){\n        const xx = X(i), isCur = i === cr;\n        ctx.strokeStyle = isCur ? 'rgba(255,138,20,.4)' : 'rgba(150,170,210,.07)'; ctx.lineWidth = isCur ? 1.5 : 1;\n        ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + H); ctx.stroke();\n        ctx.fillStyle = isCur ? 'rgba(255,190,90,.95)' : 'rgba(160,178,208,.5)'; ctx.fillText(packet ? packet.labels[i] : __sqV3RoundLabel(i), xx, padT + H + 4);\n      }\n    }""",
    'draw START and throw subdivisions'
)
render = swap_once(
    render,
    """      const RP = [];\n      for (let i = 0; i < recTo; i++){""",
    """      const RP = classicThrowRace ? [[XStep(0), Y(0)]] : [];\n      for (let i = 0; i < recTo; i++){""",
    'start record from origin'
)
render = swap_once(
    render,
    """        const tip = RP[RP.length - 1];\n        ctx.fillStyle = 'rgba(255,224,150,.95)'; ctx.font = '900 8px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';\n        ctx.fillText(String(record.label || 'HS'), Math.min(tip[0] + 3, cssW - 16), tip[1] - 2);""",
    """        if (!classicThrowRace){\n          const tip = RP[RP.length - 1];\n          ctx.fillStyle = 'rgba(255,224,150,.95)'; ctx.font = '900 8px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';\n          ctx.fillText(String(record.label || 'HS'), Math.min(tip[0] + 3, cssW - 16), tip[1] - 2);\n        }""",
    'remove in-chart Classic HS tip'
)
render = swap_once(
    render,
    """      const P = []; for (let i = 0; i < pts.length; i++) if (pts[i] != null) P.push([X(i), Y(pts[i])]);""",
    """      const P = []; for (let i = 0; i < pts.length; i++) if (pts[i] != null) P.push([classicThrowRace ? XStep(i) : X(i), Y(pts[i])]);""",
    'place player trajectory per throw'
)
render = swap_once(
    render,
    """      ctx.setLineDash(packet && packet.series[pi].dotted ? [5,4] : []);\n      ctx.strokeStyle = colors[pi]; ctx.lineWidth = 2.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';\n      ctx.shadowColor = colors[pi]; ctx.shadowBlur = 10;""",
    """      ctx.setLineDash(classicThrowRace ? [1.5,3.5] : (packet && packet.series[pi].dotted ? [5,4] : []));\n      ctx.strokeStyle = colors[pi]; ctx.lineWidth = classicThrowRace ? 1.7 : 2.7; ctx.lineJoin = 'round'; ctx.lineCap = 'round';\n      ctx.globalAlpha = classicThrowRace ? 0.58 : 1;\n      ctx.shadowColor = colors[pi]; ctx.shadowBlur = classicThrowRace ? 4 : 10;""",
    'make Classic trajectories faint dotted'
)
render = swap_once(
    render,
    """      ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;""",
    """      ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.globalAlpha = 1;""",
    'restore alpha after trajectory'
)
text = text[:renderer_start] + render + text[renderer_end:]
INDEX.write_text(text, encoding='utf-8')

# Add permanent geometry/semantics coverage to the existing Classic visual suite.
v = VERIFY.read_text(encoding='utf-8')
anchor = """    console.log('PASS local graph scale with clipped high-score reference');\n    await page.setViewportSize({width:390,height:844});"""
insert = r"""    console.log('PASS local graph scale with clipped high-score reference');

    const sc021 = await page.evaluate(() => {
      function inspect(classicThrowRace){
        const c=document.createElement('canvas'); const host=document.createElement('div');
        host.style.cssText='width:390px;height:180px';host.append(c);document.body.append(host);
        const ctx=c.getContext('2d'), texts=[], strokes=[]; let dash=[], path=[];
        const setDash=ctx.setLineDash.bind(ctx), begin=ctx.beginPath.bind(ctx), move=ctx.moveTo.bind(ctx), line=ctx.lineTo.bind(ctx), stroke=ctx.stroke.bind(ctx), fillText=ctx.fillText.bind(ctx);
        ctx.setLineDash=(v)=>{dash=Array.from(v||[]);return setDash(v);};
        ctx.beginPath=()=>{path=[];return begin();};
        ctx.moveTo=(x,y)=>{path.push([x,y]);return move(x,y);};
        ctx.lineTo=(x,y)=>{path.push([x,y]);return line(x,y);};
        ctx.stroke=()=>{strokes.push({dash:dash.slice(),path:path.slice(),style:String(ctx.strokeStyle)});return stroke();};
        ctx.fillText=(t,x,y,...rest)=>{texts.push({text:String(t),x,y});return fillText(t,x,y,...rest);};
        const labels=['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
        const motion={grow:[],combo:[],burst:[],lastLen:[classicThrowRace?4:1],lastFull:[0],maxV:0};
        __sqDrawArcadeRace(c,{
          labels,offset:0,classicThrowRace,
          series:[{name:'QA',color:'#7bdcff',data:[30,...Array(13).fill(null)],throwData:[0,10,10,30],dotted:false}],
          record:{label:'HS',color:'rgba(255,214,110,.92)',data:Array.from({length:14},(_,i)=>(i+1)*50)}
        },motion,performance.now()+1000);
        const player=strokes.filter(s=>s.dash.join(',')==='1.5,3.5').sort((a,b)=>b.path.length-a.path.length)[0]||{path:[]};
        const record=strokes.filter(s=>s.dash.join(',')==='5,4'&&s.path.length>2).sort((a,b)=>b.path.length-a.path.length)[0]||{path:[]};
        const start=texts.find(t=>t.text==='START'), ten=texts.find(t=>t.text==='10');
        const out={
          texts:texts.map(t=>t.text),start,ten,player:player.path,record:record.path,
          topHits:record.path.filter(p=>Math.abs(p[1]-(classicThrowRace?25:19))<.75).length,
          dotted:strokes.some(s=>s.dash.join(',')==='1.5,3.5')
        };
        host.remove(); return out;
      }
      return {classic:inspect(true),legacy:inspect(false)};
    });
    assert(sc021.classic.texts.includes('START'),'Classic race labels START origin');
    assert(sc021.classic.texts.includes('High Score'),'Classic race moves High Score into legend');
    assert(!sc021.classic.texts.includes('HS'),'Classic race removes in-chart HS tip');
    assert(sc021.classic.start && sc021.classic.ten && sc021.classic.start.x < sc021.classic.ten.x,'10 is first target notch after START');
    assert(sc021.classic.dotted,'Classic player trajectory is faint dotted');
    assert.equal(sc021.classic.player.length,4,'START plus three throw positions are plotted');
    const dx1=sc021.classic.player[1][0]-sc021.classic.player[0][0], dx2=sc021.classic.player[2][0]-sc021.classic.player[1][0], dx3=sc021.classic.player[3][0]-sc021.classic.player[2][0];
    assert(Math.max(dx1,dx2,dx3)-Math.min(dx1,dx2,dx3)<0.75,'three throw steps are evenly spaced');
    assert(Math.abs(sc021.classic.player[2][1]-sc021.classic.player[1][1])<0.75,'miss advances horizontally without changing Y');
    assert(sc021.classic.player[3][1] < sc021.classic.player[2][1],'scoring dart advances horizontally and upward');
    assert.equal(sc021.classic.topHits,1,'Classic high-score reference still terminates once at chart ceiling');
    assert(!sc021.legacy.texts.includes('START') && !sc021.legacy.texts.includes('High Score') && !sc021.legacy.dotted,'non-Classic renderer path stays unchanged');
    console.log('PASS SC-021 START / per-throw motion / dotted trajectory / HS legend isolation');

    await page.setViewportSize({width:390,height:844});"""
if v.count(anchor) != 1:
    raise SystemExit(f'verify insertion anchor: expected 1 match, found {v.count(anchor)}')
v = v.replace(anchor, insert, 1)
VERIFY.write_text(v, encoding='utf-8')

print('SC-021 bounded patch applied')
