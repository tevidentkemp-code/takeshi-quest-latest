// ==== (3) Progression — per-game bar chart + avg overlay ==================
window.openPlayerProgressionDialog = async function openPlayerProgressionDialog(playerName){
  const name = String(playerName||'').trim();
  const overlay = document.createElement('div'); overlay.className='modal-backdrop';
  const modal   = document.createElement('div'); modal.className  ='modal';
  modal.style.maxWidth='980px'; modal.style.width='94vw';

  const modeToggle = document.createElement('div');
  modeToggle.className = 'segmented sq-progression-mode-toggle';
  modeToggle.style.display = 'flex';
  modeToggle.style.gap = '6px';
  modeToggle.style.marginLeft = 'auto';
  modeToggle.style.flexShrink = '0';

  const modeButtons = [];
  [
    { id:'official', label:'Official' },
    { id:'turbo',    label:'Turbo' }
  ].forEach(m=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small';
    b.textContent = m.label;
    b.dataset.progressionMode = m.id;
    b.style.minHeight = '40px';
    b.style.padding = '8px 11px';
    b.style.whiteSpace = 'nowrap';
    b.onclick = ()=>loadMode(m.id);
    modeButtons.push(b);
    modeToggle.appendChild(b);
  });

  const header  = __sqStatsHeader(`Progression — ${name}`, 'Scores over time', modeToggle);
  header.style.flexWrap = 'wrap';
  const body    = document.createElement('div'); body.className   ='modal-body';
  body.style.paddingTop='8px';
  const footer  = document.createElement('div'); footer.className ='modal-footer';
  modal.style.maxHeight='90vh'; modal.style.overflow='hidden';
  body.style.maxHeight='none'; body.style.overflowY='visible';

  let scores = [];
  let activeMode = 'official';
  let activeBlockSize = 20;
  let dataStatus = 'loading';
  let loadSeq = 0;

  function blockAvgPoints(arr, k){
    const pts = [];
    if (!arr.length || !k) return pts;
    const n = arr.length;
    const blocks = Math.ceil(n / k);
    for (let bi=0; bi<blocks; bi++){
      const s = bi*k;
      const e = Math.min((bi+1)*k, n);
      const slice = arr.slice(s, e);
      const mean = slice.reduce((a,b)=>a+b,0) / slice.length;
      const x = Math.min(bi*k, n-1);
      pts.push({ x, y: mean });
    }
    if (pts.length){
      const last = pts[pts.length-1];
      if (last.x !== n-1) pts.push({ x: n-1, y: last.y });
    }
    return pts;
  }

  const row = document.createElement('div');
  row.className = 'row';
  row.style.gap = '8px';
  row.style.marginBottom = '8px';

  const avgModes = [
    { id:'B5',  label:'5 Game AV',  k:5  },
    { id:'B10', label:'10 Game AV', k:10 },
    { id:'B20', label:'20 Game AV', k:20 },
  ];

  const buttons = [];
  avgModes.forEach(m=>{
    const b=document.createElement('button');
    b.type='button'; b.className='btn small'; b.textContent=m.label; b.dataset.mode=m.id;
    b.onclick=()=>{
      activeBlockSize = m.k;
      buttons.forEach(x=>x.classList.remove('primary'));
      b.classList.add('primary');
      draw();
    };
    buttons.push(b); row.appendChild(b);
  });
  (buttons[2]||buttons[0]||{}).classList.add('primary');

  const chartHost = document.createElement('div');
  chartHost.style.position='relative';
  chartHost.style.borderRadius='14px';
  chartHost.style.overflow='hidden';
  chartHost.style.padding='34px 6px 10px 6px';

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '280px';
  canvas.style.display='block';
  chartHost.appendChild(canvas);

  const legend = document.createElement('div');
  legend.className = 'prog-legend';
  legend.style.position = 'absolute';
  legend.style.top = '6px';
  legend.style.right = '10px';
  legend.style.display = 'flex';
  legend.style.flexDirection = 'column';
  legend.style.gap = '6px';
  legend.style.pointerEvents = 'none';
  legend.style.opacity = '0.92';
  legend.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,0.78)">
        <span style="display:inline-block;width:18px;height:0;border-top:2px dashed rgba(255,140,0,0.95)"></span>
        <span>All Time AVG</span>
      </div>
      <div data-prog-alltime style="padding-left:26px;font-size:11px;color:rgba(255,255,255,0.72)">—</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,0.78)">
        <span style="display:inline-block;width:18px;height:0;border-top:2px solid rgba(90,255,140,0.95)"></span>
        <span>Trajectory</span>
      </div>
      <div data-prog-trajectory style="padding-left:26px;font-size:11px;color:rgba(255,255,255,0.72)">—</div>
    </div>
  `;
  chartHost.appendChild(legend);
  const legendAll = legend.querySelector('[data-prog-alltime]');
  const legendTraj = legend.querySelector('[data-prog-trajectory]');

  const pillRow = document.createElement('div');
  pillRow.style.display = 'flex';
  pillRow.style.flexDirection = 'column';
  pillRow.style.alignItems = 'flex-end';
  pillRow.style.gap = '6px';
  pillRow.style.padding = '10px 6px 0 6px';

  const pillAll = document.createElement('div');
  pillAll.className = 'tag prog-stats';
  pillAll.style.opacity = '0.9';
  pillAll.style.pointerEvents = 'none';

  const pillAvg = document.createElement('div');
  pillAvg.className = 'tag prog-stats';
  pillAvg.style.opacity = '0.9';
  pillAvg.style.pointerEvents = 'none';

  pillRow.append(pillAll, pillAvg);
  chartHost.appendChild(pillRow);

  body.append(row, chartHost);

  const backBtn=document.createElement('button'); backBtn.className='btn sq-pill'; backBtn.textContent='Back';
  const close=()=>overlay.remove();
  backBtn.onclick=()=>{ overlay.remove(); __sqGoBackToStatsMain(); };
  footer.append(backBtn);

  modal.append(header, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  __sqStatsArcade(overlay, modal);

  function setModeUI(mode){
    modeButtons.forEach(b=>{
      const on = b.dataset.progressionMode === mode;
      b.classList.toggle('primary', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function updateLegend(){
    if (!scores.length){
      legendAll.textContent = '—';
      legendTraj.textContent = '—';
      return;
    }
    const allAvg = scores.reduce((s,v)=>s+v,0) / scores.length;
    const mid = Math.max(1, Math.floor(scores.length/2));
    const first = scores.slice(0, mid);
    const second = scores.slice(mid);
    const start = first.length ? first.reduce((s,v)=>s+v,0) / first.length : allAvg;
    const end = second.length ? second.reduce((s,v)=>s+v,0) / second.length : start;
    legendAll.textContent = String(Math.round(allAvg));
    legendTraj.textContent = `${Math.round(start)} → ${Math.round(end)}`;
  }

  async function fetchModeScores(mode){
    const client = window.sb || (typeof sb !== 'undefined' ? sb : null);
    if (!client || typeof client.from !== 'function') throw new Error('Supabase client unavailable');
    const view = mode === 'turbo'
      ? 'v_player_game_scores_turbo_clean'
      : 'v_player_game_scores_official_clean';
    const { data, error } = await client
      .from(view)
      .select('game_id,ts,player_name,score')
      .ilike('player_name', name)
      .order('ts', { ascending:true })
      .limit(5000);
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .map(r=>Number(r && r.score))
      .filter(v=>Number.isFinite(v) && v >= 0);
  }

  async function loadMode(mode){
    const nextMode = mode === 'turbo' ? 'turbo' : 'official';
    const seq = ++loadSeq;
    activeMode = nextMode;
    dataStatus = 'loading';
    scores = [];
    setModeUI(activeMode);
    updateLegend();
    draw();
    modeButtons.forEach(b=>{ b.disabled = true; });
    try{
      const nextScores = await fetchModeScores(activeMode);
      if (seq !== loadSeq) return;
      scores = nextScores;
      dataStatus = 'ready';
    }catch(e){
      if (seq !== loadSeq) return;
      scores = [];
      dataStatus = 'error';
      console.error(`Progression: ${activeMode} scores fetch failed`, e);
    }finally{
      if (seq === loadSeq) modeButtons.forEach(b=>{ b.disabled = false; });
    }
    if (seq !== loadSeq) return;
    updateLegend();
    draw();
  }

  function draw(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.max(320, Math.floor(rect.width));
    const H = 280;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.height = H+'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);

    const padL=42, padR=10, padT=8, padB=34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const n = scores.length;
    const avgAll = n ? (scores.reduce((s,v)=>s+v,0) / n) : 0;
    const yMaxRaw = n ? Math.max(...scores, avgAll) : 0;
    const Y_MAX = Math.max(25, Math.ceil(yMaxRaw / 25) * 25);

    ctx.fillStyle = 'rgba(10,12,18,0.25)';
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle='rgba(255,255,255,0.10)';
    ctx.lineWidth=1;
    for (let y=0; y<=Y_MAX; y+=50){
      const py = padT + plotH - (y/Y_MAX)*plotH;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL+plotW, py); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.55)';
      ctx.font='12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign='right'; ctx.textBaseline='middle';
      ctx.fillText(String(y), padL-6, py);
    }

    if (!n){
      ctx.fillStyle='rgba(255,255,255,0.65)';
      ctx.font='14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const modeLabel = activeMode === 'turbo' ? 'Turbo' : 'Official';
      const msg = dataStatus === 'loading'
        ? `Loading ${modeLabel} progression…`
        : (dataStatus === 'error' ? `Unable to load ${modeLabel} progression` : `No ${modeLabel} games found`);
      ctx.fillText(msg, W/2, H/2);
      pillAll.textContent='';
      pillAvg.textContent='';
      return;
    }

    const barGap = 1;
    for (let i=0;i<n;i++){
      const v = Math.max(0, Math.min(Y_MAX, scores[i]));
      const x = padL + i*(plotW/n);
      const h = (v/Y_MAX)*plotH;
      const y = padT + (plotH - h);
      ctx.fillStyle='rgba(255,255,255,0.70)';
      ctx.fillRect(x, y, Math.max(1, (plotW/n) - barGap), h);
    }

    const avgY = padT + plotH - (avgAll/Y_MAX)*plotH;
    ctx.strokeStyle = 'rgba(255,140,0,0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.beginPath();
    ctx.moveTo(padL, avgY);
    ctx.lineTo(padL+plotW, avgY);
    ctx.stroke();
    ctx.setLineDash([]);

    const mid = Math.max(1, Math.floor(n/2));
    const avg1 = scores.slice(0, mid).reduce((s,v)=>s+v,0) / Math.max(1, scores.slice(0, mid).length);
    const avg2 = scores.slice(mid).length ? (scores.slice(mid).reduce((s,v)=>s+v,0) / scores.slice(mid).length) : avg1;
    const y1 = padT + plotH - (avg1/Y_MAX)*plotH;
    const y2 = padT + plotH - (avg2/Y_MAX)*plotH;
    ctx.strokeStyle = 'rgba(90,255,140,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, y1);
    ctx.lineTo(padL+plotW, y2);
    ctx.stroke();

    const xForIndex = (idx)=>padL + (n > 1 ? (idx/(n-1)) : 0.5) * plotW;
    const pts = blockAvgPoints(scores, activeBlockSize);
    if (pts.length){
      ctx.strokeStyle='rgba(255,255,255,0.92)';
      ctx.lineWidth=2;
      ctx.beginPath();
      pts.forEach((p, idx)=>{
        const px = xForIndex(p.x);
        const py = padT + plotH - (p.y/Y_MAX)*plotH;
        if (idx===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.font='11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    for (let i=0;i<n;i+=10){
      ctx.fillText(String(i+1), xForIndex(i), padT+plotH+6);
    }

    const minV = Math.min(...scores);
    const maxV = Math.max(...scores);
    const blockMeans = [];
    for (let s=0; s<n; s+=activeBlockSize){
      const slice = scores.slice(s, Math.min(s+activeBlockSize, n));
      if (!slice.length) continue;
      blockMeans.push(slice.reduce((a,b)=>a+b,0) / slice.length);
    }
    const minAvg = blockMeans.length ? Math.min(...blockMeans) : avgAll;
    const maxAvg = blockMeans.length ? Math.max(...blockMeans) : avgAll;

    pillAll.textContent = `Avg ${avgAll.toFixed(1)} · Low ${minV} · High ${maxV}`;
    pillAvg.textContent = `Avg Low ${minAvg.toFixed(1)} · Avg High ${maxAvg.toFixed(1)}`;
  }

  const ro = new ResizeObserver(()=>draw());
  try { ro.observe(chartHost); } catch(_){}
  await loadMode('official');
}
;
