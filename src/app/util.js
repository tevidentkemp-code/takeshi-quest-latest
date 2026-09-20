// ===== @SEC:JS:UTIL =====
// ===== @JS:UTIL:UI_MUTATION_BUS =====
// Single DOM mutation observer + per-frame flush (replaces many per-feature MutationObservers)
(function(){
  if (window.__sqUIMutationBus) return;

  const listeners = new Set();
  let pending = false;
  /** @type {MutationRecord[]} */
  let buf = [];

  function flush(){
    pending = false;
    const muts = buf;
    buf = [];
    for (const fn of listeners){
      try { fn(muts); } catch(e){ try{ console.warn('sqUIMutationBus listener failed', e); }catch(_){ } }
    }
  }

  function schedule(){
    if (pending) return;
    pending = true;
    const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb)=>setTimeout(cb, 0);
    raf(flush);
  }

  const mo = new MutationObserver((muts)=>{
    if (muts && muts.length) {
      buf = buf.concat(muts);
      schedule();
    }
  });

  function start(){
    const root = document.body || document.documentElement;
    if (!root) return;
    try {
      mo.observe(root, { childList:true, subtree:true, characterData:true });
    } catch(_){}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }

  window.__sqUIMutationBus = {
    on(fn){
      if (typeof fn !== 'function') return ()=>{};
      listeners.add(fn);
      return ()=>{ try{ listeners.delete(fn); }catch(_){ } };
    },
    emit(){ try{ schedule(); }catch(_){ } }
  };
})();

// Global guard: some third‑party embeds reference a global `F`; define a harmless fallback
if (typeof window.F === 'undefined') {
  window.F = function(){ /* no-op */ };
}

// Compute the per-dart symbol for a given dart + round
function symbolForDart(d, rd){
  // No dart thrown yet
  if (!d || (typeof d.points === 'undefined' && !d.kind)) return { ch: '○', cls: '' };
  // Miss (no points registered)
  if (!d || Number(d.points || 0) === 0){
    // Bulls: if it's marked as a Bull hit, show 50 / 25 even if points weren’t recorded
    if (rd && rd.type === 'bull' && d && d.kind === 'B'){
      const isInner = (d.bull === 'Inner');
      return { ch: isInner ? '50' : '25', cls: '' };
    }
    return { ch: '✕', cls: 'miss' };
  }

  // Number rounds
  if (rd && rd.type === 'number'){
    const k = (d.kind || '').toUpperCase();
    if (k === 'TRIPLE' || k === 'T') return { ch: 'T', cls: '' };
    if (k === 'DOUBLE' || k === 'D') return { ch: 'D', cls: '' };
    return { ch: 'S', cls: '' };
  }

  // Doubles / Triples with explicit numbers
  if (rd && rd.type === 'doubles'){
    const pts = Number(d.points || 0);
    let n = pts ? pts / 2 : null;
    if (!Number.isInteger(n) || n < 1 || n > 20){
      const t = Number(d.target ?? d.num ?? d.number ?? NaN);
      if (Number.isInteger(t) && t >= 1 && t <= 20) n = t;
    }
    const label = Number.isInteger(n) ? `D${n}` : 'D?';
    return { ch: label, cls: '' };
  }
  if (rd && rd.type === 'triples'){
    const pts = Number(d.points || 0);
    let n = pts ? pts / 3 : null;
    if (!Number.isInteger(n) || n < 1 || n > 20){
      const t = Number(d.target ?? d.num ?? d.number ?? NaN);
      if (Number.isInteger(t) && t >= 1 && t <= 20) n = t;
    }
    const label = Number.isInteger(n) ? `T${n}` : 'T?';
    return { ch: label, cls: '' };
  }

  // Bull round – show 50/25
  if (rd && rd.type === 'bull'){
    if (d.kind === 'B'){
      const isInner = (d.bull === 'Inner');
      return { ch: isInner ? '50' : '25', cls: '' };
    }
    const pts = Number(d.points || 0);
    if (pts === 50 || pts === 25) return { ch: String(pts), cls: '' };
    return { ch: '✕', cls: 'miss' };
  }

  // Fallback
  return { ch: '○', cls: '' };
}

// Mark the highest bracketed value per round as green.
// Works on any score-sheet markup as long as the bracket text contains a number.
window.markRoundHighs = function markRoundHighs(root = document) {
  // cover 10..20 + D/T/B = 14 rows => indexes 0..13
  for (let r = 0; r <= 13; r++) {
    // try to find bracketed elements; prefer ones tagged with data-round if present
    const subs = Array.from(
      root.querySelectorAll(`.round-sub[data-round="${r}"], [data-round="${r}"] .round-sub`)
    );

    // fallback: just grab all .round-sub in the table section for this round
    const bucket = subs.length ? subs :
      Array.from(root.querySelectorAll(`.round-sub`))
        .filter(el => el.closest('[data-round-index]')?.getAttribute('data-round-index') == String(r));

    if (!bucket.length) continue;

    // read a numeric value from data-points if provided, else parse `(123)`
    const values = bucket.map(el => {
      const v = Number(el.dataset.points);
      if (Number.isFinite(v)) return v;
      const m = (el.textContent || '').match(/-?\d+(?:\.\d+)?/);
      return m ? Number(m[0]) : 0;
    });

    const max = Math.max(0, ...values);

    const iMax = (max > 0) ? values.indexOf(max) : -1;

    bucket.forEach((el, i) => {
      el.classList.toggle('is-round-high', i === iMax && iMax >= 0);
    });
}
};

// Fetch per-dart pattern for a specific game/player/round (e.g. "S/S/D" or "x/T/T")
async function fetchRoundPattern(gameId, playerName, ridx){
  if (!gameId || playerName == null || ridx == null) return '';

  // 1) Preferred: per-dart throws table (only if available)
  if (FEATURE_CLOUD_THROWS && !cloudIsTableMissing(TABLE_GAME_THROWS)){
    try{
      const { data, error } = await sb
        .from(TABLE_GAME_THROWS)
        .select('dart_index, points, kind, bull')
        .eq('game_id', gameId)
        .eq('player', playerName)
        .eq('round_index', ridx)
        .order('dart_index', { ascending: true });
      if (error) throw error;

      const rd = ROUNDS[ridx];
      const chars = [];
      for (let i = 0; i < 3; i++){
        const d = (data || []).find(r => Number(r.dart_index) === i) || null;
        const sym = symbolForDart(d, rd);
        let ch = sym && sym.ch ? sym.ch : 'x';
        if (ch === '✕') ch = 'x';
        chars.push(ch);
      }
      return chars.join('/');
    } catch(e){
      cloudMarkTableMissing(TABLE_GAME_THROWS, e);
    }
  }

  // 2) Fallback: games.state.board (if stored)
  try{
    const { data, error } = await sb.from(TABLE_GAMES).select('state').eq('id', gameId).single();
    if (error) throw error;
    const rd = ROUNDS[ridx];
    const players = (data?.state?.players || []).map(p => (typeof p === 'string' ? { name:p } : p));
    const pIdx = players.findIndex(p => eqName(p.name, playerName));
    const ent  = pIdx >= 0 ? (data?.state?.board?.[pIdx] || [])[ridx] : null;
    const chars = [];
    for (let i = 0; i < 3; i++){
      const d = ent && Array.isArray(ent.darts) ? ent.darts[i] : null;
      const sym = symbolForDart(d, rd);
      let ch = sym && sym.ch ? sym.ch : 'x';
      if (ch === '✕') ch = 'x';
      chars.push(ch);
    }
    return chars.join('/');
  }catch(_){
    return '';
  }
}
window.fetchRoundPattern = fetchRoundPattern;

// Fetch a game's timestamp from the cloud (with fallbacks)
async function fetchGameTS(gameId){
  try{
    const { data, error } = await sb
      .from(TABLE_GAMES)
      .select('ts, created_at, inserted_at')
      .eq('id', gameId)
      .single();
    if (error) throw error;
    return data?.ts || data?.created_at || data?.inserted_at || null;
  }catch(e){
    return null;
  }
}

// Earliest TS for a specific game/player/round (fallback for Date/Time column)
async function fetchRoundTS(gameId, playerName, ridx){
  if (!FEATURE_CLOUD_THROWS || cloudIsTableMissing(TABLE_GAME_THROWS)) return null;
  try{
    const { data, error } = await sb
      .from(TABLE_GAME_THROWS)
      .select('ts')
      .eq('game_id', gameId)
      .eq('player', playerName)
      .eq('round_index', ridx)
      .order('ts', { ascending: true })
      .limit(1);
    if (error) throw error;
    return (data && data[0] && data[0].ts) ? data[0].ts : null;
  }catch(_){
    return null;
  }
}

function setupRoundScoreObserver(){
  // PB/GR disabled on the scoreboard: scrub any tokens that might be rendered by legacy code
  const tbody = document.getElementById('tbody');
  if (!tbody) { setTimeout(setupRoundScoreObserver, 250); return; }

  function scrub(){
    const subs = tbody.querySelectorAll('.cell-sub');
    subs.forEach(sub => {
      // Flatten to plain text and strip (PB) / (GR) tokens, preserving the round score e.g. (30)
      const raw = (sub.textContent || '');
      const cleaned = raw
        .replace(/\s*\(PB\)\s*/gi, ' ')
        .replace(/\s*\(GR\)\s*/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (cleaned !== raw) sub.textContent = cleaned;

      // Remove any leftover elements used by older implementations
      sub.querySelectorAll('.pbgr, .pb-badge').forEach(n => {
        try {
          // If it wraps text like "(30) (PB) (GR)", keep the text but without tokens
          const txt = (n.textContent || '')
            .replace(/\s*\(PB\)\s*/gi, ' ')
            .replace(/\s*\(GR\)\s*/gi, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          n.replaceWith(document.createTextNode(txt));
        } catch(_) { try { n.remove(); } catch(_){} }
      });
    });
  }

  // Observe scoreboard updates and continuously scrub (via shared UI mutation bus)
  try {
    if (!tbody.dataset.sqScrubWired) {
      tbody.dataset.sqScrubWired = '1';
      window.__sqUIMutationBus?.on((muts) => {
        try{
          if (!tbody || !tbody.isConnected) return;
          for (const m of (muts || [])){
            const t = m.target;
            if (t && tbody.contains(t)) { scrub(); return; }
            for (const n of (m.addedNodes || [])){
              if (n && n.nodeType === 1 && tbody.contains(n)) { scrub(); return; }
            }
          }
        }catch(_){}
      });
    }
  } catch(_){}

  // Initial + delayed passes
  scrub();
  setTimeout(scrub, 300);
  setTimeout(scrub, 1000);
}
// --- Global high-score de-dup helpers ---
function _keyNameScore(row){
  const n = String(row?.name || '').trim().toLowerCase();
  const s = Number(row?.score || 0);
  return `${n}|${s}`;
}
function dedupeRowsByNameScoreKeepEarliest(rows){
  const map = new Map(); // key => row with earliest ts
  for (const r of (rows || [])){
    if (!r) continue;
    const key = _keyNameScore(r);
    const existing = map.get(key);
    const tNew = r?.ts ? Date.parse(r.ts) : Infinity;
    if (!existing){
      map.set(key, r);
    } else {
      const tOld = existing?.ts ? Date.parse(existing.ts) : Infinity;
      if (tNew < tOld) map.set(key, r); // keep the earliest/original
    }
  }
  return [...map.values()];
}
async function dedupeTableHighScores(table){
  const { data, error } = await sb
    .from(table)
    .select('name, score, ts, game_id')
    .order('ts', { ascending: true })
    .limit(10000);
  if (error) { markCloudError(error); throw error; }
  const groups = new Map();
  for (const r of (data || [])){
    const key = _keyNameScore(r);
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }
  let deleted = 0;
  for (const [, arr] of groups){
    if (arr.length <= 1) continue;
    arr.sort((a,b)=> (Date.parse(a.ts||'')||0) - (Date.parse(b.ts||'')||0));
    // keep earliest (index 0), delete the rest
    for (let i = 1; i < arr.length; i++){
      const row = arr[i];
      const { error: delErr } = await sb.from(table)
        .delete()
        .eq('name', row.name)
        .eq('score', row.score)
        .eq('ts', row.ts);
      if (!delErr) deleted++;
    }
  }
  markCloudOk();
  return deleted;
}
async function dedupeAllHighScores(){
  let total = 0;
  try { total += await dedupeTableHighScores(TABLE_HS_LEAGUE); } catch(e){ console.error(e); }
  try { total += await dedupeTableHighScores(TABLE_HS_PRACTICE); } catch(e){ console.error(e); }
  return total;
}
// ---- Admin Hub ----
// ===== @JS:UI:ADMIN =====
function openAdminHub(){
  const hub = document.getElementById('adminHubModal');
  try { window.__sqNavContext = 'admin'; } catch(_) {}
  if (!hub) return;
  // Close any admin sub-dialog still open so backdrops never stack when
  // switching tools quickly (audit N-5). Static admin modals are hidden;
  // stray dynamic (id-less) backdrops are removed.
  try {
    ['dataAdminModal','dataChartModal','allGamesModal','leagueLowsAdminModal','savedPlayersAdminModal','pbgrAdminModal']
      .forEach(function(id){ const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
    document.querySelectorAll('.modal-backdrop:not([id])').forEach(function(m){
      if (m !== hub && !m.classList.contains('hidden')) m.remove();
    });
  } catch(_) {}
  hub.classList.remove('hidden');

  // Buttons
  const btnAll   = document.getElementById('openAllGamesBtn');
  const btnScores= document.getElementById('openAllScoresBtn');
  const btnLHS   = document.getElementById('openHsLeagueAdmin');
  const btnPHS   = document.getElementById('openHsPracticeAdmin');
  const btnLLS   = document.getElementById('openLeagueLowsAdmin');
  const btnSave  = document.getElementById('openSavedPlayersAdminBtn');
  const btnClose = document.getElementById('closeAdminHubBtn');
  const btnCloseX = document.getElementById('closeAdminHubBtnX');
  const btnFix   = document.getElementById('fixDuplicatesBtn');
  const btnPBGR  = document.getElementById('openPBGRAdminBtn');

if (btnAll)  btnAll.onclick  = ()=>{ hub.classList.add('hidden'); openAllGamesDialog(); };
  if (btnScores) btnScores.onclick = ()=>{ hub.classList.add('hidden'); openAllScoresDialog(); };
if (btnLHS)  btnLHS.onclick  = ()=>{ hub.classList.add('hidden'); openHighScoresAdminDialog(false); };
if (btnPHS)  btnPHS.onclick  = ()=>{ hub.classList.add('hidden'); openHighScoresAdminDialog(true); };
if (btnLLS)  btnLLS.onclick  = () => {
  hub.classList.add('hidden');
  openLeagueLowsAdminDialog();
};
if (btnSave) btnSave.onclick = ()=>{ hub.classList.add('hidden'); openSavedPlayersAdminDialog(); };
  if (btnPBGR) btnPBGR.onclick = ()=>{ hub.classList.add('hidden'); openPBGRAdminDialog(); };

  if (btnFix) btnFix.onclick = async ()=>{
    hub.classList.add('hidden');
    try{
      const removed = await dedupeAllHighScores();
      toast(`Removed ${removed} duplicate row${removed===1?'':'s'}.`);
    }catch(e){
      console.error(e);
      toast('Dedupe failed');
    }
  };

  if (btnClose) btnClose.onclick = ()=>{ hub.classList.add('hidden'); try{ window.__sqNavContext = null; }catch(_){} };
  if (btnCloseX) btnCloseX.onclick = ()=>{ hub.classList.add('hidden'); try{ window.__sqNavContext = null; }catch(_){} };
}

// Export Admin Hub opener for any callers that use window.openAdminHub
try { window.openAdminHub = openAdminHub; } catch(_) {}

// === All Games modal (simple list) ===

// >>> PATCH:ADMIN_ALL_SCORES_V1 START
async function cloudRemovePlayerFromGame(gameId, playerId, playerName){
  await ensureCloudInit();
  if (!gameId || !playerId) throw new Error('cloudRemovePlayerFromGame: missing ids');

  // 1) Attempt to remove player from the game row (best-effort)
  try{
    const { data: gRows, error: gErr } = await sb.from(TABLE_GAMES)
      .select('id,state,stats,totals')
      .eq('id', gameId)
      .limit(1);

    if (!gErr && gRows && gRows[0]){
      const g = gRows[0];
      const state = (g.state && typeof g.state === 'object') ? JSON.parse(JSON.stringify(g.state)) : null;
      const stats = (g.stats && typeof g.stats === 'object') ? JSON.parse(JSON.stringify(g.stats)) : null;
      const totals = Array.isArray(g.totals) ? g.totals.slice() : null;

      // Determine player index from common patterns
      let idx = -1;

      const tryFindIdxInArray = (arr)=>{
        if (!Array.isArray(arr)) return -1;
        for (let i=0;i<arr.length;i++){
          const it = arr[i];
          if (it && typeof it === 'object'){
            if (it.id === playerId || it.player_id === playerId) return i;
            if (playerName && (it.name === playerName || it.player_name === playerName)) return i;
          } else {
            if (it === playerId) return i;
            if (playerName && it === playerName) return i;
          }
        }
        return -1;
      };

      if (state){
        idx = tryFindIdxInArray(state.players);
        if (idx<0) idx = tryFindIdxInArray(state.player_ids);
        if (idx<0) idx = tryFindIdxInArray(state.playerIds);
        if (idx<0) idx = tryFindIdxInArray(state.names);
      }
      if (idx<0 && stats){
        idx = tryFindIdxInArray(stats.players);
        if (idx<0) idx = tryFindIdxInArray(stats.player_ids);
        if (idx<0) idx = tryFindIdxInArray(stats.names);
      }

      const stripIdx = (obj, key)=>{
        if (!obj || !Array.isArray(obj[key]) || idx<0) return;
        obj[key].splice(idx,1);
      };

      if (idx>=0){
        // remove from known arrays
        stripIdx(state,'players'); stripIdx(state,'player_ids'); stripIdx(state,'playerIds'); stripIdx(state,'names');
        stripIdx(stats,'players'); stripIdx(stats,'player_ids'); stripIdx(stats,'playerIds'); stripIdx(stats,'names');

        if (totals) totals.splice(idx,1);

        // Also try nested common shapes
        if (state && state.match && Array.isArray(state.match.players)) state.match.players.splice(idx,1);
        if (stats && stats.perPlayer && Array.isArray(stats.perPlayer)) stats.perPlayer.splice(idx,1);

        await sb.from(TABLE_GAMES).update({
          state: state,
          stats: stats,
          totals: totals
        }).eq('id', gameId);
      } else {
        console.warn('[AllScores] Could not determine player index in game row; skipping game JSON edit.');
      }
    }
  }catch(e){
    console.warn('[AllScores] Game-row edit failed; continuing to purge HS rows only.', e);
  }

  // 2) Purge HS rows for this player+game
  try{ await sb.from(TABLE_HS_LEAGUE).delete().eq('game_id', gameId).eq('player_id', playerId); }catch(_){}
  try{ await sb.from(TABLE_HS_PRACTICE).delete().eq('game_id', gameId).eq('player_id', playerId); }catch(_){}

  return true;
}

async function openAllScoresDialog(){
  const overlay = document.createElement('div'); overlay.className='modal-backdrop';
  const modal   = document.createElement('div'); modal.className='modal';
  const title   = document.createElement('h3');  title.textContent='All Scores';
  const body    = document.createElement('div'); body.className='modal-body';
  const footer  = document.createElement('div'); footer.className='modal-footer';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:6px;';

  const officialBtn = document.createElement('button'); officialBtn.className='btn primary'; officialBtn.textContent='Official';
  const practiceBtn = document.createElement('button'); practiceBtn.className='btn'; practiceBtn.textContent='Practice';
  controls.append(officialBtn, practiceBtn);
  header.append(title, controls);

  const table = document.createElement('table'); table.className='table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:140px;">When</th>
        <th>Player</th>
        <th style="width:90px;text-align:right;">Score</th>
        <th style="width:110px;">Game</th>
        <th style="width:170px;text-align:right;">Action</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  const pad2 = (n)=>String(n).padStart(2,'0');
  const fmtWhen = (ts)=>{
    if(!ts) return '';
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return String(ts);
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const shortId = (id)=> id ? String(id).slice(0,8) : '';

  let filterMode = 'official';

  async function fetchRows(){
    await ensureCloudInit();
    const tname = (filterMode==='practice') ? TABLE_HS_PRACTICE : TABLE_HS_LEAGUE;
    const { data, error } = await sb
      .from(tname)
      .select('id,name,score,ts,player_id,game_id')
      .order('ts',{ascending:false})
      .limit(250);
    if (error) throw error;
    return data || [];
  }

  async function render(){
    tbody.innerHTML = '';
    let rows = [];
    try{
      rows = await fetchRows();
    }catch(e){
      console.error(e);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="opacity:.8;">Failed to load scores.</td>`;
      tbody.appendChild(tr);
      return;
    }

    if (!rows.length){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="opacity:.8;">No scores found.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const r of rows){
      const tr = document.createElement('tr');
      const when = fmtWhen(r.ts);
      const player = r.name || '—';
      const score = (r.score ?? 0);
      const gid = r.game_id;

      const btn = document.createElement('button');
      btn.className = 'btn danger';
      btn.textContent = 'Remove';
      btn.style.minWidth = '110px';

      btn.onclick = async ()=>{
        const msg = `REMOVE PLAYER FROM GAME\n\nThis removes this player's data from this game and updates visible records.\n\nType REMOVE to confirm:`;
        const ok = prompt(msg);
        if (String(ok||'').trim().toUpperCase() !== 'REMOVE') return;

        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = 'Working…';
        try{
          await cloudRemovePlayerFromGame(gid, r.player_id, r.name);
          toast('Removed.');
  // >>> PATCH:SQ_ALLSCORES_MOUNT_EARLY START
  // <<< PATCH:SQ_ALLSCORES_MOUNT_EARLY END

  await render();
        }catch(e){
          console.error(e);
          toast('Remove failed');
        }finally{
          btn.disabled = false;
          btn.textContent = old;
        }
      };

      tr.innerHTML = `
        <td>${when}</td>
        <td>${escapeHtml(player)}</td>
        <td style="text-align:right;">${score}</td>
        <td>${shortId(gid)}</td>
        <td style="text-align:right;"></td>
      `;
      tr.lastElementChild.appendChild(btn);
      tbody.appendChild(tr);
    }
  }

  const backBtn = document.createElement('button'); backBtn.className='btn'; backBtn.textContent='Back';
  const closeBtn= document.createElement('button'); closeBtn.className='btn'; closeBtn.textContent='Close';
  footer.append(backBtn, closeBtn);

  const close = ()=>{ overlay.remove(); modal.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e)=>{ if(e.key==='Escape'){ close(); } };

  backBtn.onclick = ()=>{ close(); openAdminHub(); };
  closeBtn.onclick= close;

  officialBtn.onclick = ()=>{ filterMode='official'; officialBtn.classList.add('primary'); practiceBtn.classList.remove('primary'); render(); };
  practiceBtn.onclick = ()=>{ filterMode='practice'; practiceBtn.classList.add('primary'); officialBtn.classList.remove('primary'); render(); };

  modal.append(header, body, footer);
  body.appendChild(table);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  overlay.onclick = close;
  document.addEventListener('keydown', esc);

  await render();
}
// <<< PATCH:ADMIN_ALL_SCORES_V1 END



// Player Stats — Select Player flow (uses the generic Select Player modal)
function openPlayerStatsSelectDialog(){
  try{ if (typeof __sqSetStatsOrigin==='function') __sqSetStatsOrigin('home'); }catch(_){ }
  try{ console.debug('[Popup]', window.__sqStatsDebugName || 'New Game Screen Stats'); }catch(_){ }
  // New: dedicated Player Stats select modal (menu/data-input style)
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal menu-modal';

  const header = document.createElement('div');
  header.className = 'menu-modal-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'icon-btn';
  backBtn.type = 'button';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'menu-modal-title';

  const icon = document.createElement('div');
  icon.className = 'menu-modal-icon';
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19V5"/><path d="M8 19V9"/><path d="M12 19V3"/><path d="M16 19v-6"/><path d="M20 19V7"/></svg>';

  const title = document.createElement('div');
  title.className = 'menu-modal-title-text';
  title.textContent = 'SELECT PLAYER';

  titleWrap.append(icon, title);

  header.append(backBtn, titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'menu-modal-body';

  const form = document.createElement('div');
  form.className = 'menu-modal-form';

  const label = document.createElement('label');
  label.textContent = 'Player Name';

  const sel = document.createElement('select');
  sel.innerHTML = '<option value="">Select a saved player...</option>';

  form.append(label, sel);
  body.appendChild(form);

  const actions = document.createElement('div');
  actions.className = 'menu-modal-actions';

  const cancel = document.createElement('button');
  cancel.className = 'btn';
  cancel.type = 'button';
  cancel.textContent = 'Cancel';

  const go = document.createElement('button');
  go.className = 'btn primary';
  go.type = 'button';
  go.textContent = 'View Stats';

  actions.append(cancel, go);

  modal.append(header, body, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => { try{ overlay.remove(); }catch(_){ overlay.parentNode && overlay.parentNode.removeChild(overlay); } };
  backBtn.onclick = close;
  closeBtn.onclick = close;
  cancel.onclick  = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Populate saved players
  (async () => {
    try{
      const items = await cloudListPlayers(); // [{name}]
      sel.innerHTML = '<option value="">Select a saved player...</option>' +
        (items || []).map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    }catch(e){
      console.error('Stats: load players failed', e);
      try{ if (typeof toast==='function') toast('Cloud offline'); }catch(_){}
    }
  })();

  const openStats = () => {
    const name = (sel.value || '').trim();
    if (!name){ try{ toast('Pick a player'); }catch(_){} return; }
    close();
    try{ if (typeof __sqSetStatsOrigin==='function') __sqSetStatsOrigin('home', name); }catch(_){ }
    try{
      if (typeof openPlayerStatsHub === 'function') {
        openPlayerStatsHub(name);
      } else if (typeof openPlayerStatsDialog === 'function') {
        openPlayerStatsDialog(name);
      } else {
        console.warn('No player stats dialog function found');
      }
    }catch(err){
      console.error('Open Player Stats failed', err);
    }
  };

  go.onclick = openStats;
  sel.addEventListener('change', () => {
    // Optional: enable only when selection is made (keeps UX tidy)
    go.disabled = !String(sel.value || '').trim();
  });
  go.disabled = true;
}

// Ensure the Start screen button opens the Stats select flow
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('playerStatsBtn');
  if (btn) btn.onclick = () => {
    if (typeof window.openPlayerStatsSelect === 'function') return window.openPlayerStatsSelect();
    if (typeof window.openPlayerStatsHub === 'function') return window.openPlayerStatsHub();
    return openPlayerStatsSelectDialog();
  };
});

// --- PB / GR Admin: open/close + minimal render ---
function openPBGRAdminDialog(){
  const modal = document.getElementById('pbgrAdminModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const back  = document.getElementById('pbgrBackBtn');
  const close = document.getElementById('pbgrCloseBtn');
  const sel   = document.getElementById('pbgrPlayerSelect');
  const ref   = document.getElementById('pbgrRefreshBtn');
  const inner = modal.querySelector('.modal');

  if (inner) inner.onclick = (e) => e.stopPropagation();
  modal.onclick = (e) => { if (e.target === modal) { modal.classList.add('hidden'); openAdminHub(); } };

  if (back)  back.onclick  = () => { modal.classList.add('hidden'); openAdminHub(); };
  if (close) close.onclick = () => { modal.classList.add('hidden'); try{ window.__sqNavContext = null; }catch(_){} };

  // Populate dropdown once per open
  (async () => {
    try{
      const items = await cloudListPlayers(); // [{name}]
      if (sel){
        sel.innerHTML = '<option value="">Select a saved player…</option>' +
          (items||[]).map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        if (!sel.value && items && items.length) sel.value = items[0].name || '';
        if (typeof renderPBGRPlayerTableInto === 'function') await renderPBGRPlayerTableInto('pbgrPlayer', sel.value);
      }
      if (typeof renderPBGRGlobalTable === 'function') await renderPBGRGlobalTable();
    }catch(e){ console.error(e); }
  })();

  if (sel) sel.onchange = async () => {
    try{ if (typeof renderPBGRPlayerTableInto === 'function') await renderPBGRPlayerTableInto('pbgrPlayer', sel.value); }
    catch(e){ console.error(e); }
  };

  if (ref) ref.onclick = async () => {
    try{
      if (typeof refreshPBGRCloud === 'function') await refreshPBGRCloud();
      if (typeof renderPBGRGlobalTable === 'function') await renderPBGRGlobalTable();
      if (sel && typeof renderPBGRPlayerTableInto === 'function') await renderPBGRPlayerTableInto('pbgrPlayer', sel.value);
    }catch(e){ console.error(e); }
  };

  const backfill = document.getElementById('pbgrBackfillBtn');
  if (backfill) backfill.onclick = async () => {
    backfill.disabled = true;
    const oldText = backfill.textContent;
    backfill.textContent = 'Refreshing…';
    try{
      if (typeof refreshPBGRCloud === 'function') await refreshPBGRCloud();
      if (typeof renderPBGRGlobalTable === 'function') await renderPBGRGlobalTable();
      if (sel && typeof renderPBGRPlayerTableInto === 'function') await renderPBGRPlayerTableInto('pbgrPlayer', sel.value);
    }catch(e){ console.error(e); }
    finally{ backfill.disabled = false; backfill.textContent = oldText; }
  };
}

// Saved Players Admin
async function openSavedPlayersAdminDialog(){
  const modal = document.getElementById('savedPlayersAdminModal');
  const body  = document.getElementById('savedPlayersAdminBody');
  const back  = document.getElementById('backSavedPlayersAdminBtn');
  const close = document.getElementById('closeSavedPlayersAdminBtn');
  if (!modal || !body) return;

  modal.classList.remove('hidden');
  if (back)  back.onclick  = () => { modal.classList.add('hidden'); openAdminHub(); };
  if (close) close.onclick = () => { modal.classList.add('hidden'); };

  await renderSavedPlayersAdmin();
}


// >>> PATCH:PBGR_ADMIN_VIEW_KEYS_V1 START
// PB/WR views store keys as N1..N11, D_ANY, T_ANY, BULL_ANY.
// Admin UI displays friendly keys as 10..20, D, T, B.
function __sqPBGRViewKey(displayKey){
  const k = String(displayKey ?? '').trim().toUpperCase();
  if (/^\d+$/.test(k)){
    const n = Number(k);
    if (n >= 10 && n <= 20) return 'N' + String(n - 9);
  }
  if (k === 'D') return 'D_ANY';
  if (k === 'T') return 'T_ANY';
  if (k === 'B') return 'BULL_ANY';
  return k;
}
function __sqPBGRMetaFor(mapLike, displayKey){
  if (!mapLike) return null;
  const friendly = String(displayKey ?? '').trim();
  const viewKey = __sqPBGRViewKey(displayKey);
  return mapLike[friendly] || mapLike[viewKey] || mapLike[String(viewKey).toUpperCase()] || null;
}
function __sqPBGRValFor(mapLike, displayKey){
  const m = __sqPBGRMetaFor(mapLike, displayKey);
  return Number(m?.val ?? m?.pb_points ?? m?.wr_points ?? 0) || 0;
}
async function renderPBGRPlayerTableInto(mountId, playerName){
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const nameKey = String(playerName || '').trim().toLowerCase();
  if (!nameKey){
    mount.innerHTML = '<p class="tag">Select a saved player to view PBs.</p>';
    return;
  }
  mount.innerHTML = '<p class="tag">Loading…</p>';
  try{
    const snap = await (typeof getPBGRSnapshot === 'function' ? getPBGRSnapshot() : Promise.resolve({ byPlayerMeta:new Map() }));
    const playerMeta = (snap.byPlayerMeta && typeof snap.byPlayerMeta.get === 'function') ? (snap.byPlayerMeta.get(nameKey) || {}) : {};
    const order = [...Array.from({length:11},(_,i)=>10+i), 'D','T','B'];

    const table = document.createElement('table'); table.className='hs-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Round','PB'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody'); table.appendChild(tbody);

    let any = false;
    for (const key of order){
      const val = __sqPBGRValFor(playerMeta, key);
      if (val > 0) any = true;
      const tr = document.createElement('tr');
      const tdR = document.createElement('td'); tdR.textContent = String(key);
      const tdV = document.createElement('td'); tdV.textContent = val ? String(val) : '—';
      tr.append(tdR, tdV);
      tbody.appendChild(tr);
    }

    mount.innerHTML = '';
    if (!any){
      const msg = document.createElement('p');
      msg.className = 'tag';
      msg.textContent = 'No PB rows found for this player in PB\/WR views or saved game history.';
      mount.appendChild(msg);
    }
    mount.appendChild(table);
  }catch(e){
    console.error('renderPBGRPlayerTableInto failed', e);
    mount.innerHTML = '<p>Unable to load Player PBs right now.</p>';
  }
}
// <<< PATCH:PBGR_ADMIN_VIEW_KEYS_V1 END

// Generic renderer that can write the PB/GR table into any mount id
async function renderPBGRTableInto(mountId){
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = '<p class="tag">Loading…</p>';
  try{
    const snap = await (typeof getPBGRSnapshot === 'function' ? getPBGRSnapshot() : Promise.resolve({ byTargetMeta: {} }));
    const order = [...Array.from({length:11},(_,i)=>10+i), 'D','T','B'];

    // Build table with Date / Time column included
    const table = document.createElement('table'); table.className='hs-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Round','WR','Darts','Date / Time','Holder'].forEach(h=>{
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const fmtDate = (ts) => {
      if (!ts) return '—';
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const pending = [];

    order.forEach(key=>{
      const meta = __sqPBGRMetaFor(snap.byTargetMeta, key) || { val:0, player:'', game_id:null, ridx:null, ts:null };
      const tr   = document.createElement('tr');

      const tdR  = document.createElement('td'); tdR.textContent = String(key);
      const tdV  = document.createElement('td'); tdV.textContent = String(meta.val || 0);
      const tdD  = document.createElement('td'); tdD.textContent = meta.darts ? String(meta.darts) : '—'; // async filled with S/D/T/x pattern where available
      const tdT  = document.createElement('td'); tdT.textContent = fmtDate(meta.ts);
      const tdN  = document.createElement('td');
        // Holder: if multiple saved players share the WR value for this round, show "Name +X"
        let holderText = meta.player ? String(meta.player) : '—';
        try{
          const bpm = snap.byPlayerMeta;
          const wrVal = Number(meta.val||0);
          if (bpm && typeof bpm.forEach === 'function' && wrVal > 0 && meta.player){
            let cnt = 0;
            bpm.forEach((m) => {
              const rec = m && m[String(key)];
              if (rec && Number(rec.val||0) === wrVal) cnt++;
            });
            if (cnt > 1) holderText = `${holderText} +${cnt-1}`;
          }
        }catch(_){}
        tdN.textContent = holderText || '—';

      tr.append(tdR, tdV, tdD, tdT, tdN);
      tbody.appendChild(tr);

      // Fetch the per-dart pattern (S/D/T etc.)
      if (meta && meta.game_id != null && meta.player && (meta.ridx || meta.ridx === 0)){
        pending.push(
          fetchRoundPattern(meta.game_id, meta.player, meta.ridx)
            .then(pat => { tdD.textContent = pat || '—'; })
            .catch(()=>{ tdD.textContent = '—'; })
        );
      }

      // Fill Date/Time if missing: try Games.ts -> earliest throw ts
      if (!meta?.ts && meta?.game_id){
        pending.push(
          (async ()=>{
            const gts = await fetchGameTS(meta.game_id);
            if (gts){
              tdT.textContent = fmtDate(gts);
              return;
            }
            if (meta.player && (meta.ridx || meta.ridx === 0)){
              const rts = await fetchRoundTS(meta.game_id, meta.player, meta.ridx);
              if (rts) tdT.textContent = fmtDate(rts);
            }
          })()
        );
      }
    });

    if (pending.length){ try{ await Promise.allSettled(pending); }catch(_){ /* ignore */ } }
    mount.innerHTML = '';
    mount.appendChild(table);
  }catch(e){
    console.error('renderPBGRTableInto failed', e);
    mount.innerHTML = '<p>Unable to load World Records right now.</p>';
  }
}

// LEGACY ROUND HIGH SCORES STATIC IMPLEMENTATION — QUARANTINED
// Current active path is Fix102 wrapper -> Fix97 dynamic modal.
// This block is tied to the old #roundHighScoresModal static markup.
// Do not patch this implementation for current League & Rankings behaviour.
// >>> PATCH:round_high_scores_use_wr_table START
async function renderRoundHighScoresInto(mountId){
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = '<p class="tag">Loading…</p>';

  const orderKey = (rk) => {
    const s = String(rk ?? '').trim().toUpperCase();
    if (/^\d+$/.test(s)) return parseInt(s,10);
    if (s === 'D') return 21;
    if (s === 'T') return 22;
    if (s === 'B') return 23;
    return 999;
  };

  const safeText = (v, fallback='—') => {
    const s = (v == null) ? '' : String(v).trim();
    return s ? s : fallback;
  };

  const makeTable = () => {
    const table = document.createElement('table'); table.className='hs-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Round','WR','Darts','Holder'].forEach(h=>{
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    return { table, tbody };
  };

  try{
    // Canonical source: Supabase view (backdated + ties)
    const { data, error } = await sb
      .from('v_round_high_scores_modal')
      .select('round_key,wr,darts,holder,tie_idx,holder_suffix')
      .limit(50000);

    if (error) throw error;

    const rows = Array.isArray(data) ? data.slice() : [];
    if (!rows.length){
      mount.innerHTML = '<p>No round high-score rows found in v_round_high_scores_modal.</p>';
      return;
    }

    rows.sort((a,b)=>{
      const ka = orderKey(a.round_key);
      const kb = orderKey(b.round_key);
      if (ka !== kb) return ka - kb;
      const ta = Number(a.tie_idx || 0);
      const tb = Number(b.tie_idx || 0);
      if (ta !== tb) return ta - tb;
      return String(a.holder||'').localeCompare(String(b.holder||''));
    });

    const { table, tbody } = makeTable();

    for (const r of rows){
      const tr = document.createElement('tr');

      const rk = String(r.round_key ?? '').toUpperCase();
      const roundLabel = rk; // already '10'..'20' or 'D'/'T'/'B'
      const wr = (r.wr == null) ? '—' : String(r.wr);
      const darts = safeText(r.darts, '—');
      const holder = safeText(r.holder, '—');
      const suf = safeText(r.holder_suffix, '');

      [roundLabel, wr, darts, holder, suf].forEach((v, idx)=>{
        const td = document.createElement('td');
        td.textContent = v;
        if (idx === 4) td.className = 'hs-suffix';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    }

    mount.innerHTML = '';
    mount.appendChild(table);

  }catch(err){
    const msg = (err && (err.message || err.error_description)) ? (err.message || err.error_description) : String(err||'');
    mount.innerHTML = '<p>Unable to load right now.</p><p class="tag">Error: '+ escapeHtml(msg) +'</p>';
  }
}

// >>> PATCH:round_high_scores_use_wr_table END
// Keep admin renderer for pb/gr admin modal
async function renderPBGRGlobalTable(){
  return renderPBGRTableInto('pbgrGlobal');
}

function _normName(s){ return String(s||'').trim(); }

// Initials helpers (cloud-first; name fallback)
function __sqComputeInitialsFromName(name){
  const s = String(name||'').trim();
  if (!s) return '';
  // Split on whitespace + hyphen; keep alphanumerics
  const parts = s.split(/\s+|-/g).map(x=>x.replace(/[^A-Za-z0-9]/g,'')).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1){
    const w = parts[0].toUpperCase();
    return w.slice(0, Math.min(2, w.length));
  }
  const a = parts[0].toUpperCase().slice(0,1);
  const b = parts[parts.length-1].toUpperCase().slice(0,1);
  return (a+b).trim();
}
function __sqComputeInitials(first, last){
  const f0 = String(first||'').trim();
  const l0 = String(last||'').trim();
  const f = f0.replace(/[^A-Za-z0-9]/g,'');
  const l = l0.replace(/[^A-Za-z0-9]/g,'');
  if (f && l){
    return (f[0] + l[0]).toUpperCase();
  }
  if (f){
    return f.toUpperCase().slice(0, Math.min(2, f.length));
  }
  return __sqComputeInitialsFromName((f0 + (l0 ? ' ' + l0 : '')).trim());
}
function __sqNormalizeInitials(init, nameFallback){
  const raw = String(init||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (raw) return raw.slice(0,3);
  return __sqComputeInitialsFromName(nameFallback);
}
function __sqFindSavedPlayerMetaByName(name){
  const key = String(name||'').trim().toLowerCase();
  if (!key) return null;
  try{
    const arr = getSavedPlayers() || [];
    return arr.find(p => p && String(p.name||'').trim().toLowerCase() === key) || null;
  }catch(_){ return null; }
}

function __sqNameParts(name){
  const s = String(name||'').trim();
  if (!s) return { first:'', last:'' };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || '', last: '' };
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

function __sqPlayerPretty(p){
  const nm = (p && p.name != null) ? String(p.name).trim() : '';
  const parts = __sqNameParts(nm);
  const first = String((p && p.first_name) || '').trim() || parts.first;
  const last  = String((p && p.last_name)  || '').trim() || parts.last;
  const nick  = String((p && p.nickname)   || '').trim();

  let out = first || nm || '';
  if (nick) out += ' "' + nick + '"';
  if (last) out += (out ? ' ' : '') + last;

  out = out.trim();
  return out || nm || '';
}

function __sqPlayerOptionLabel(p){
  const pretty = __sqPlayerPretty(p);
  const ini = __sqNormalizeInitials(p && p.initials, (p && p.name) || pretty);
  return ini ? (pretty + ' (' + ini + ')') : pretty;
}

function __sqHeaderLabelForPlayer(pl){
  try{
    if (typeof __sqVsShadowDisplayLabelForPlayer === 'function') {
      const shadowLabel = __sqVsShadowDisplayLabelForPlayer(pl);
      if (shadowLabel) return shadowLabel;
    }
  }catch(_){ }
  const nm = pl && pl.name ? String(pl.name) : '';
  const init = pl && pl.initials ? String(pl.initials) : '';
  return __sqNormalizeInitials(init, nm) || nm || '';
}

function __sqLoadPlayerAliases(){
  try { return JSON.parse(localStorage.getItem('SQ_PLAYER_ALIASES') || '{}') || {}; } catch(e){ return {}; }
}
function __sqSavePlayerAliases(map){
  try { localStorage.setItem('SQ_PLAYER_ALIASES', JSON.stringify(map || {})); } catch(e){}
}
function __sqRememberPlayerRename(oldName, newName){
  const o = _normName(oldName), n = _normName(newName);
  if (!o || !n || o === n) return;
  const map = __sqLoadPlayerAliases();

  // Collapse chains: if something already pointed to old, repoint to new
  try { Object.keys(map).forEach(k => { if (map[k] === o) map[k] = n; }); } catch(_){ }

  map[o] = n;
  __sqSavePlayerAliases(map);

  try { document.dispatchEvent(new CustomEvent('sq:player-alias-updated', { detail: { oldName:o, newName:n }})); } catch(_){ }
}
function __sqApplyPlayerAlias(name){
  let x = _normName(name);
  if (!x) return x;
  const map = __sqLoadPlayerAliases();
  const seen = new Set();
  while (map[x] && !seen.has(x)){
    seen.add(x);
    x = _normName(map[x]);
  }
  return x;
}
window.__sqApplyPlayerAlias = __sqApplyPlayerAlias;
window.__sqRememberPlayerRename = __sqRememberPlayerRename;

function renamePlayerInLocalState(oldName, newName){
  const o = _normName(oldName), n = _normName(newName);
  if (!o || !n || o === n) return;

  // Update in-memory current game
  let changed = false;
  try {
    (state.players||[]).forEach(pl=>{
      if (pl && _normName(pl.name) === o){ pl.name = n; changed = true; }
    });
  } catch(_) {}

  // Persist current state snapshot
  if (changed){
    try { save(); } catch(_) {}
    try { if (typeof buildScoreHeader==='function') buildScoreHeader(); } catch(_) {}
    try { if (typeof buildFloatingHeader==='function') buildFloatingHeader(); } catch(_) {}
    try { if (typeof buildMatchStatsHead==='function') buildMatchStatsHead(); } catch(_) {}
    try { if (typeof buildMatchStatsBody==='function') buildMatchStatsBody(); } catch(_) {}
    try { if (typeof updateMatchStats==='function') updateMatchStats(); } catch(_) {}
    try { if (typeof updateUI==='function') updateUI(); } catch(_) {}
  }

  // Update persisted state in localStorage (safety)
  try {
    const st = safeLoad(STORAGE_KEY);
    if (st && Array.isArray(st.players)){
      let ch = false;
      st.players.forEach(pl=>{
        if (pl && _normName(pl.name) === o){ pl.name = n; ch = true; }
      });
      if (ch) safeSave(STORAGE_KEY, st);
    }
  } catch(_) {}

  // Update saved players cache (offline fallback / quick UI refresh)
  try {
    const arr = getSavedPlayers();
    let ch = false;
    (arr||[]).forEach(x=>{
      if (x && _normName(x.name) === o){ x.name = n; ch = true; }
    });
    if (ch) setSavedPlayers(arr);
  } catch(_) {}
}

function removePlayerFromLocalCache(name){
  const n = _normName(name);
  if (!n) return;
  try {
    const arr = (getSavedPlayers()||[]).filter(x => _normName(x && x.name) !== n);
    setSavedPlayers(arr);
  } catch(_) {}
}

async function renderSavedPlayersAdmin(){
  const body = document.getElementById('savedPlayersAdminBody');
  if (!body) return;
  body.innerHTML = '<p class="tag">Loading players…</p>';

  let players = [];
  try { players = await cloudListPlayers(); }
  catch(e){ console.error(e); body.innerHTML = '<p>Failed to load players.</p>'; return; }

  if (!Array.isArray(players) || players.length === 0){
    body.innerHTML = '<p>No players found.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'hs-table';

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['First','Nickname','Last','Initials','Actions'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; hr.appendChild(th); });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  players.forEach(p=>{
    const tr = document.createElement('tr');
    const nmOld = String((p && p.name) ? p.name : '').trim();
    const pid = (p && p.id) ? p.id : null;

    const firstTd = document.createElement('td');
    const firstIn = document.createElement('input');
    firstIn.type='text';
    firstIn.value = String(p?.first_name || (nmOld.split(' ')[0]||'')).trim();
    firstIn.style.width='100%';
    firstTd.appendChild(firstIn);

    const nickTd = document.createElement('td');
    const nickIn = document.createElement('input');
    nickIn.type='text';
    nickIn.value = String(p?.nickname || '').trim();
    nickIn.style.width='100%';
    nickTd.appendChild(nickIn);

    const lastTd = document.createElement('td');
    const lastIn = document.createElement('input');
    lastIn.type='text';
    // Best-effort derive last name from existing full name if column missing
    const derivedLast = (()=>{
      const parts = nmOld.split(' ').filter(Boolean);
      if (parts.length <= 1) return '';
      return parts.slice(1).join(' ');
    })();
    lastIn.value = String(p?.last_name || derivedLast).trim();
    lastIn.style.width='100%';
    lastTd.appendChild(lastIn);

    const initTd = document.createElement('td');
    const initIn = document.createElement('input');
    initIn.type='text';
    initIn.value = __sqNormalizeInitials(p?.initials ? p.initials : '', nmOld);
    initIn.maxLength = 3;
    initIn.style.width = '70px';
    initIn.style.textTransform = 'uppercase';
    initTd.appendChild(initIn);

    const actTd = document.createElement('td');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn small';
    saveBtn.textContent = 'Save';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn small danger';
    delBtn.textContent = 'Delete';

    actTd.append(saveBtn, document.createTextNode(' '), delBtn);

    saveBtn.onclick = async ()=>{
      const first = String(firstIn.value||'').trim();
      const last  = String(lastIn.value||'').trim();
      const nick  = String(nickIn.value||'').trim();
      if (!first){ toast('First name required'); return; }

      // IMPORTANT: we do NOT rename `players.name` here.
      // Name is a legacy key used across games/history; changing it risks data integrity and can violate unique constraints.
      const init = __sqNormalizeInitials(initIn.value, __sqBuildFullName(first, last));

      try{
        let id = pid;
        if (!id && nmOld){
          const key = await cloudResolvePlayerKeyByName(nmOld);
          id = key && key.id ? key.id : null;
        }
        if (!id){
          toast('Save failed: missing player id');
          return;
        }

        // Cloud-first: update profile fields only
        await cloudUpdatePlayerProfile({ id, name: nmOld }, {
          first_name: first,
          last_name: last,
          nickname: nick,
          initials: init
        });

        // Ensure initials are set even on older deployments
        try { await cloudUpdatePlayerInitials({ id, name: nmOld }, init); } catch(_){}

        try { await syncSavedPlayersFromCloud(); } catch(_){}
        try { document.dispatchEvent(new Event('sq:savedPlayersUpdated')); } catch(_){}
        toast('Saved');
        await renderSavedPlayersAdmin();
      }catch(e){
        console.error(e);
        // Handle uniqueness conflict cleanly (e.g. if DB still enforces something unexpected)
        const msg = (e && (e.message || e.details)) ? String(e.message || e.details) : '';
        if (/duplicate key|unique/i.test(msg)) toast('Save failed: name already exists');
        else toast('Save failed');
      }
    };

    delBtn.onclick = async ()=>{
      if (!nmOld){ toast('Invalid player'); return; }

      // Safety: don’t delete a player who’s currently in an active game/match (would corrupt indices).
      const inCurrent = (state && Array.isArray(state.players)) ? state.players.some(pl => pl && _normName(pl.name) === _normName(nmOld)) : false;
      const gameStarted = !!(state && ((state.currentRound||0) > 0 || (state.history && state.history.length)));
      if (inCurrent && gameStarted){
        toast('Finish/reset the current game before deleting this player.');
        return;
      }

      if (!confirm(`Delete ${nmOld}?`)) return;
      try{
        await cloudDeletePlayer(pid ? { id: pid, name: nmOld } : nmOld);
        removePlayerFromLocalCache(nmOld);
        try { await syncSavedPlayersFromCloud(); } catch(_) {}
        try { document.dispatchEvent(new Event('sq:savedPlayersUpdated')); } catch(_) {}
        toast('Deleted');
        await renderSavedPlayersAdmin();
      }catch(e){
        console.error(e);
        toast('Delete failed');
      }
    };

    tr.append(firstTd, nickTd, lastTd, initTd, actTd);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.innerHTML = '';
  body.appendChild(table);
}

/* Premier League — TODAY chip wiring (no <script> tags) */
(function () {
  function todayRangeLocalTZ(){
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate()+1);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  document.addEventListener('click', async (ev) => {
    const btn = ev.target && ev.target.closest('button');
    if (!btn) return;
    if ((btn.textContent || '').trim().toUpperCase() !== 'TODAY') return;
    // New Premier League dialog uses data-filter-id buttons; don't intercept those.
    if (btn.dataset && btn.dataset.filterId) return;

    // Limit to the Premier League modal/panel
    const modal = btn.closest('.modal, #leaderboard');
    if (!modal) return;
    ev.preventDefault();

    const mount =
      modal.querySelector('#hsLeagueBody') ||
      modal.querySelector('.modal-body') ||
      modal;

    const { from, to } = todayRangeLocalTZ();

    try {
      if (typeof renderLeagueLeaderboardRange === 'function') {
        await renderLeagueLeaderboardRange(mount, { from, to, label: 'Today' });
        return;
      }
      if (typeof renderHsLeague === 'function') {
        await renderHsLeague({ mount, from, to, label: 'Today' });
        return;
      }
      if (typeof loadHsLeague === 'function') {
        await loadHsLeague(mount, { from, to, label: 'Today' });
        return;
      }
    } catch (e) {
      console.error('TODAY renderer error, falling back', e);
    }

    // --- Fallback: simple “today” table ---
    if (mount) mount.innerHTML = '<p class="tag">Loading today…</p>';

    try {
      const { data, error } = await sb
        .from(TABLE_PLAYER_GAMES)
        .select('player, score, is_practice, ts')
        .or('is_practice.is.null,is_practice.eq.false')
        .gte('ts', from)
        .lt('ts', to);

      if (error) throw error;

      const map = new Map();
      for (const r of (data || [])) {
        const m = map.get(r.player) || { player: r.player, games: 0, total: 0, best: 0 };
        m.games++; m.total += Number(r.score || 0); m.best = Math.max(m.best, Number(r.score || 0));
        map.set(r.player, m);
      }

      const rows = [...map.values()]
        .map(r => ({ ...r, avg: r.games ? r.total / r.games : 0 }))
        .sort((a,b) => b.avg - a.avg);

      mount.innerHTML = `
        <div class="table-wrap">
          <table class="hs-table hs-league-table">
            <thead>
              <tr><th>#</th><th>Player</th><th>Avg</th><th>Best</th><th>Games</th></tr>
            </thead>
            <tbody>
              ${rows.map((r,i)=>`
                <tr>
                  <td>${i+1}</td>
                  <td>${r.player || ''}</td>
                  <td class="num">${r.avg.toFixed(1)}</td>
                  <td class="num">${r.best}</td>
                  <td class="num">${r.games}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      console.error('League TODAY fallback failed', e);
      mount.innerHTML = '<p class="tag">Unable to load today’s scores.</p>';
    }
  });
})();

/* [MOVED] Premier League TODAY chip legacy patch moved to Legacy Quarantine (Stage 4A.1c) */;

// ===== @JS:UI:LIVE_UPDATES_VIDE =====
// === Final version: single-line psTicker vertical scroller ===
(function () {
  const IN_MS   = 800;   // time for the scroll animation (ms)
  const HOLD_MS = 3000;  // time each score stays fully visible (ms)

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function formatGameForTicker(g) {
    if (!g) return '';

    const alias = (typeof window !== 'undefined' && typeof window.__sqApplyPlayerAlias === 'function')
      ? window.__sqApplyPlayerAlias
      : (x)=>x;

    const players = (g.players || []).map(p => {
      const nm = (p && typeof p === 'object' && 'name' in p) ? p.name : String(p || '');
      return alias(nm);
    });
    const totals  = Array.isArray(g.totals) ? g.totals : [];

    const ordered = players
      .map((name, i) => ({ name, score: Number(totals[i] || 0) }))
      .filter(x => x.name)
      .sort((a, b) => b.score - a.score);

    let resultHtml = '—';
    if (ordered.length >= 2) {
      const winnerLabel = `${ordered[0].name} ${ordered[0].score}`;
      const losersLabel = ordered
        .slice(1)
        .map(o => `${o.name} ${o.score}`)
        .join(' ');

      // Winner name + score in bold, losers normal, with extra gap before bts
      resultHtml = `<strong>${winnerLabel}</strong>&nbsp;&nbsp;bts ${losersLabel}`;
    } else if (ordered.length === 1) {
      const winnerLabel = `${ordered[0].name} ${ordered[0].score}`;
      resultHtml = `<strong>${winnerLabel}</strong>`;
    }

    const tsVal =
      g.ts ||
      g.created_at ||
      g.inserted_at ||
      (g.meta && (g.meta.ts || g.meta.date)) ||
      null;

    let when = '';
    if (tsVal) {
      const d = new Date(tsVal);
      if (!Number.isNaN(d.getTime())) {
        when = d.toLocaleString('en-GB', {
          day:    '2-digit',
          month:  '2-digit',
          hour:   '2-digit',
          minute: '2-digit'
        }).replace(',', '');
      }
    }

    // Date/time in bold, followed by the formatted result with extra gap
    if (when) {
      return `<strong>${when}</strong>&nbsp;&nbsp;&nbsp;&nbsp;${resultHtml}`;
    }
    return resultHtml;
  }

  async function startPsTicker(container, items) {
    if (!container || !items || !items.length) return;

    // Prevent multiple ticker loops if init is ever called twice
    if (container.dataset.vtickerRunning === '1') return;
    container.dataset.vtickerRunning = '1';

    // Clear any legacy content and create two stacked lines
    container.innerHTML = '';
    const lineA = document.createElement('div');
    const lineB = document.createElement('div');
    lineA.className = 'track';
    lineB.className = 'track';
    container.appendChild(lineA);
    container.appendChild(lineB);

    const height = container.clientHeight || 32;

    let currentIdx = 0;
    let active = lineA;
    let next   = lineB;

    // Initial state: first score visible, second line parked just below
    active.innerHTML = items[currentIdx];
    active.style.transition = 'none';
    next.style.transition   = 'none';
    active.style.transform  = 'translateY(0)';
    next.style.transform    = `translateY(${height}px)`;
    // Force a reflow so the browser applies initial transforms
    void active.offsetHeight;

    while (container.isConnected && items.length) {
      // Hold the current score fully visible
      await sleep(HOLD_MS);

      const nextIdx = (currentIdx + 1) % items.length;
      next.innerHTML = items[nextIdx];

      // Reset start positions (active in centre, next just below)
      active.style.transition = 'none';
      next.style.transition   = 'none';
      active.style.transform  = 'translateY(0)';
      next.style.transform    = `translateY(${height}px)`;
      void active.offsetHeight; // reflow

      // Animate both lines upwards together
      const dur = IN_MS;
      active.style.transition = `transform ${dur}ms ease-in-out`;
      next.style.transition   = `transform ${dur}ms ease-in-out`;
      active.style.transform  = `translateY(-${height}px)`;
      next.style.transform    = 'translateY(0)';

      // Wait for the animation to finish
      await sleep(dur);

      // Swap roles: the line that just slid in becomes the new active line
      const tmp = active;
      active = next;
      next   = tmp;
      currentIdx = nextIdx;
    }
  }

  async function initSingleLinePsTicker() {
    const ticker = document.getElementById('psTicker');
    if (!ticker) return;

    // Fast-path: show last cached line instantly (cache-only; Supabase remains source of truth)
    try{
      const raw = localStorage.getItem('SQ_PSTICKER_CACHE_V1') || '';
      if (raw){
        const cached = JSON.parse(raw);
        const items = Array.isArray(cached?.items) ? cached.items : [];
        if (items.length){
          ticker.classList.remove('hidden');
          const track = ticker.querySelector('.track') || ticker;
          track.innerHTML = items[0]; // static first line, no animation yet
        }
      }
    }catch(_){}

    // Defer heavy fetch until after first paint
    if (typeof window.SQ === 'object' && SQ.boot && typeof SQ.boot.afterPaint === 'function'){
      await new Promise(r=>SQ.boot.afterPaint(r));
    } else {
      try{ await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0))); }catch(_){}
    }

    try {
      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) {
        ticker.classList.add('hidden');
        return;
      }
  // Expose a safe refresh hook (used after player renames)
  window.__sqRefreshRecentMatchesTicker = initSingleLinePsTicker;
    } catch (_) {}

    let games = [];
    try {
      // PERF: only fetch the most recent games needed for the ticker (Supabase remains source of truth).
      if (typeof cloudFetchLatestVisibleGamesAsLocal === 'function') {
        games = await cloudFetchLatestVisibleGamesAsLocal(50);
        if (Array.isArray(games)) games = games.slice().reverse(); // oldest→newest for scrolling
      } else if (typeof cloudFetchLatestGamesAsLocal === 'function') {
        games = await cloudFetchLatestGamesAsLocal(50);
        if (Array.isArray(games)) games = games.slice().reverse(); // oldest→newest for scrolling
      } else if (typeof cloudFetchAllGamesAsLocal === 'function') {
        games = await cloudFetchAllGamesAsLocal();
      }
    } catch (e) {
      console.error('psTicker: failed to fetch games', e);
    }

    
    // Hide archived games from ticker (truth mode: archived = invisible everywhere)
    try{
      games = (Array.isArray(games) ? games : []).filter(g => !(g && g.archived_at));
    }catch(_){}
if (!Array.isArray(games) || !games.length) {
      ticker.classList.add('hidden');
      return;
    }

    const toTS = (g) => {
      const t =
        g?.ts ||
        g?.created_at ||
        g?.inserted_at ||
        (g?.meta && (g.meta.ts || g.meta.date)) ||
        null;
      const n = t ? Date.parse(t) : NaN;
      return Number.isFinite(n) ? n : 0;
    };

    games = games
      .filter(Boolean)
      .sort((a, b) => toTS(b) - toTS(a))
      .slice(0, 25);

    // Phase 1 IDs: hide deleted players from the ticker.
    // We treat "active" players as those currently present in the players table.
    try {
      let activeSet = window.__sqActivePlayerNameSet;
      if (!(activeSet instanceof Set) && typeof cloudListPlayers === 'function') {
        const plist = await cloudListPlayers();
        activeSet = window.__sqActivePlayerNameSet;
      }
      const alias = (typeof window !== 'undefined' && typeof window.__sqApplyPlayerAlias === 'function')
        ? window.__sqApplyPlayerAlias
        : (x)=>x;

      if (activeSet instanceof Set && activeSet.size) {
        games = games.filter(g => {
          const names = (g?.players || []).map(p => (p && typeof p === 'object' && 'name' in p) ? p.name : String(p || ''));
          const mapped = names.map(n => String(alias(n) || '').trim().toLowerCase()).filter(Boolean);
          if (!mapped.length) return false;
          return mapped.every(n => activeSet.has(n));
        });
      }
    } catch (_) {}

    const items = games
      .map(formatGameForTicker)
      .filter(line => line && line.trim().length > 0);

    // Cache for next boot (cache only; do not use for stats)
    try{
      localStorage.setItem('SQ_PSTICKER_CACHE_V1', JSON.stringify({ t: Date.now(), items }));
    }catch(_){}

    
    // Track newest timestamp so we can poll deltas (network minimisation)
    try{
      const last = games && games.length ? games[games.length - 1] : null;
      const lastTs = last && (last.ts || last.created_at) ? String(last.ts || last.created_at) : '';
      if (lastTs) ticker.dataset.lastTs = lastTs;
      ticker.__sqTickerItems = items; // mutate-in-place for the running loop
    }catch(_){}

    // Poll only for new games (delta), do not refetch history
    try{
      if (window.SQ && SQ.boot && SQ.boot.poller && ticker.dataset.deltaPoller !== '1' && (!window.__sqPsTickerDeltaPollerActive || !(window.__sqPsTickerDeltaPollerTicker && window.__sqPsTickerDeltaPollerTicker.isConnected))){
        ticker.dataset.deltaPoller = '1';
        window.__sqPsTickerDeltaPollerActive = true;
        window.__sqPsTickerDeltaPollerTicker = ticker;
        SQ.boot.poller.register('psTicker.delta', async ()=>{
          if (!ticker.isConnected) return;
          if (document && document.hidden) return;

          // Ensure cloud ok
          try{
            if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return;
          }catch(_){ return; }

          const since = String(ticker.dataset.lastTs || '').trim();
          if (!since) return;

          let newer = [];
          try{
            if (typeof cloudFetchVisibleGamesSinceAsLocal === 'function') {
              newer = await cloudFetchVisibleGamesSinceAsLocal(since, 50);
            } else if (typeof cloudFetchGamesSinceAsLocal === 'function') {
              newer = await ((typeof cloudFetchVisibleGamesSinceAsLocal==='function')?cloudFetchVisibleGamesSinceAsLocal:cloudFetchGamesSinceAsLocal)(since, 50);
            }
          }catch(_){ return; }

          if (!Array.isArray(newer) || !newer.length) return;
          // Exclude archived games from ticker deltas
          try{
            newer = (Array.isArray(newer) ? newer : []).filter(g => !(g && g.archived_at));
          }catch(_){}
          if (!Array.isArray(newer) || !newer.length) return;

          // Update lastTs to newest row
          try{
            const newest = newer[newer.length - 1];
            const nt = newest && (newest.ts || newest.created_at) ? String(newest.ts || newest.created_at) : '';
            if (nt) ticker.dataset.lastTs = nt;
          }catch(_){}

          const lines = newer.map(formatGameForTicker).filter(s=>s && String(s).trim());
          if (!lines.length) return;

          const arr = (ticker.__sqTickerItems && Array.isArray(ticker.__sqTickerItems)) ? ticker.__sqTickerItems : items;
          // append newest lines, cap to last 50
          for (const ln of lines) arr.push(ln);
          while (arr.length > 50) arr.shift();

          // refresh cache
          try{ localStorage.setItem('SQ_PSTICKER_CACHE_V1', JSON.stringify({ t: Date.now(), items: arr })); }catch(_){}
        }, SQ_GAMES_VISIBLE_MIN_POLL_MS);
      }
    }catch(_){}
if (!items.length) {
      ticker.classList.add('hidden');
      return;
    }

    ticker.classList.remove('hidden');
    startPsTicker(ticker, items).catch(err => {
      console.error('psTicker loop error', err);
    });
  }

  // Remove any legacy ticker entry points so they can't interfere
  window.buildStartTicker = function () {};
  window.initVerticalGameTicker = function () {};

  document.addEventListener('DOMContentLoaded', function () {
    initSingleLinePsTicker().catch(function (err) {
      console.error('psTicker init failed', err);
    });
  });
})();

// Propagate a player rename to other cloud tables that store name strings.
// Best-effort only (ignore failures so we never break the app).
async function cloudPropagatePlayerRename(oldName, newName){
  // Keep this conservative: only touch tables that are known to exist in your current Supabase schema.
  const o = String(oldName||'').trim();
  const n = String(newName||'').trim();
  if (!o || !n || o === n) return;

  const tasks = [];
  try { tasks.push(sb.from(TABLE_HS_LEAGUE).update({ name: n }).eq('name', o)); } catch(_) {}
  try { tasks.push(sb.from(TABLE_HS_PRACTICE).update({ name: n }).eq('name', o)); } catch(_) {}

  // Best-effort only; never throw (avoid console red spam on missing tables/views)
  try { await Promise.allSettled(tasks); } catch(_) {}
}

// Best-effort: rename the player inside historical games.state JSON so stats/ranks stay unified.
// This updates state.players[].name (board is index-based so it stays valid).
async function cloudRenamePlayerInGamesState(oldName, newName, maxRows=500){
  const o = String(oldName||'').trim();
  const n = String(newName||'').trim();
  if (!o || !n || o === n) return { updated: 0 };
  let updated = 0;
  let offset = 0;
  const page = 100;

  while (updated < maxRows){
    const { data, error } = await sb
      .from(TABLE_GAMES)
      .select('id, state')
      .contains('state', { players: [{ name: o }] })
      .range(offset, offset + page - 1);

    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;

    for (const row of rows){
      if (updated >= maxRows) break;
      const st = row.state;
      if (!st || !Array.isArray(st.players)) continue;

      let changed = false;
      const players = st.players.map(pl => {
        if (pl && typeof pl === 'object' && String(pl.name||'').trim() === o){
          changed = true;
          return { ...pl, name: n };
        }
        return pl;
      });

      if (!changed) continue;

      const nextState = { ...st, players };
      const { error: uErr } = await sb.from(TABLE_GAMES).update({ state: nextState }).eq('id', row.id);
      if (uErr) throw uErr;
      updated += 1;
    }

    if (rows.length < page) break;
    offset += rows.length;
  }

  return { updated };
}

// Rename helper (updates `name` column)
async function cloudResolvePlayerKeyByName(name){
  const nm = String(name||'').trim();
  if (!nm) return null;
  // Use case-insensitive match to avoid "0 rows updated" silent failures
  try{
    const { data, error } = await sb
      .from(TABLE_PLAYERS)
      .select('id, name')
      .ilike('name', nm)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }catch(_){
    return null;
  }
}

// >>> PATCH:PLAYER_ID_SUPPORT START

// >>> PATCH:PLAYER_RENAME_RPC START
// Use Supabase RPC to merge rename across history (DB function: public.rename_player_merge(old_name, new_name)).
// This keeps legacy name-based data coherent while we gradually migrate UI to IDs.
async function cloudRenamePlayerMerge(oldName, newName){
  const o = String(oldName||'').trim();
  const n = String(newName||'').trim();
  if (!o || !n || o === n) return;

  const { error } = await sb.rpc('rename_player_merge', { old_name: o, new_name: n });
  if (error) { markCloudError(error); throw error; }
  markCloudOk();
  try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('rename_player_merge'); }catch(_){}
}
// <<< PATCH:PLAYER_RENAME_RPC END

// Player rename by UUID id (keeps name-based propagation for legacy tables)
async function cloudRenamePlayerById(playerId, oldName, newName){
  const id = String(playerId||'').trim();
  const fallbackOld = String(oldName||'').trim();
  const n  = String(newName||'').trim();
  if (!id || !n) return;

  // Prefer the authoritative current name for this id (protects against case/whitespace mismatches)
  let o = fallbackOld;
  try{
    const { data, error } = await sb
      .from(TABLE_PLAYERS)
      .select('name')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data && data.name) o = String(data.name).trim();
  }catch(_){ /* fall back */ }

  if (!o || o === n) return;

  // Server-side merge rename (players + match_players + matches JSON + highscores)
  await cloudRenamePlayerMerge(o, n);

  // Extra legacy cleanup: some views still parse games.state; keep those unified too.
  try { await cloudRenamePlayerInGamesState(o, n); } catch(_) {}
}
// <<< PATCH:PLAYER_ID_SUPPORT END

async function cloudRenamePlayer(oldName, newName){
  const o = String(oldName||'').trim();
  const n = String(newName||'').trim();
  if (!o || !n || o === n) return;

  // Server-side merge rename (players + match_players + matches JSON + highscores)
  await cloudRenamePlayerMerge(o, n);

  // Extra legacy cleanup: some views still parse games.state; keep those unified too.
  try { await cloudRenamePlayerInGamesState(o, n); } catch(_) {}
}

// Update player profile (first/last/region) while keeping `name` as the app-wide display key.
// Falls back to name-only update if profile columns do not exist.
// Update player profile (MOT2.2): rename-only shim.
// Your Supabase schema (players) appears to be name-only.
// Keeping this function prevents older UI code from breaking if it still calls it.


/* ===== SC-040 PLAYER AVATAR IDENTITY ===== */
const SQ_AVATAR_COUNT = 29;
const SQ_AVATAR_COLS = 6;
const SQ_AVATAR_ROWS = 5;

function __sqAvatarFallbackId(seed=''){
  const s = String(seed || '').trim().toLowerCase();
  if (!s) return 1;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h >>> 0) % SQ_AVATAR_COUNT) + 1;
}
function __sqNormalizeAvatarId(value, seed=''){
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 && n <= SQ_AVATAR_COUNT ? n : __sqAvatarFallbackId(seed);
}
function __sqAvatarSpritePosition(value){
  const id = __sqNormalizeAvatarId(value);
  const index = id - 1;
  const col = index % SQ_AVATAR_COLS;
  const row = Math.floor(index / SQ_AVATAR_COLS);
  return { id, col, row,
    x: SQ_AVATAR_COLS > 1 ? (col / (SQ_AVATAR_COLS - 1)) * 100 : 0,
    y: SQ_AVATAR_ROWS > 1 ? (row / (SQ_AVATAR_ROWS - 1)) * 100 : 0 };
}
function __sqAvatarIdForPlayer(playerOrName){
  if (playerOrName && typeof playerOrName === 'object'){
    return __sqNormalizeAvatarId(playerOrName.avatar_id, playerOrName.id || playerOrName.name || '');
  }
  return __sqNormalizeAvatarId(null, playerOrName);
}
function __sqApplyAvatarSprite(el, avatarId){
  if (!el) return el;
  const p = __sqAvatarSpritePosition(avatarId);
  el.dataset.avatarId = String(p.id);
  el.style.backgroundImage = 'url("./assets/avatars/avatar-sprite.webp")';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = '600% 500%';
  el.style.backgroundPosition = p.x.toFixed(4) + '% ' + p.y.toFixed(4) + '%';
  return el;
}
function __sqBuildAvatarPicker(selectedId, onChange){
  const root = document.createElement('div');
  root.className = 'sq-avatar-picker';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Choose player avatar');
  let selected = __sqNormalizeAvatarId(selectedId);
  const refresh = () => {
    root.querySelectorAll('.sq-avatar-choice').forEach(btn => {
      const active = Number(btn.dataset.avatarId) === selected;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
  };
  for (let id = 1; id <= SQ_AVATAR_COUNT; id++){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sq-avatar-choice';
    btn.dataset.avatarId = String(id);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', 'Avatar ' + id);
    __sqApplyAvatarSprite(btn, id);
    btn.onclick = () => {
      selected = id;
      refresh();
      if (typeof onChange === 'function') onChange(id);
    };
    root.appendChild(btn);
  }
  refresh();
  return root;
}
window.SQ_AVATAR_COUNT = SQ_AVATAR_COUNT;
window.__sqNormalizeAvatarId = __sqNormalizeAvatarId;
window.__sqAvatarSpritePosition = __sqAvatarSpritePosition;
window.__sqAvatarIdForPlayer = __sqAvatarIdForPlayer;
window.__sqApplyAvatarSprite = __sqApplyAvatarSprite;
window.__sqBuildAvatarPicker = __sqBuildAvatarPicker;
/* ===== /SC-040 PLAYER AVATAR IDENTITY ===== */

async function cloudUpdatePlayerProfile(playerOrName, profile){
  const obj = (playerOrName && typeof playerOrName === 'object') ? playerOrName : null;
  const keyName = String(obj ? (obj.name||'') : (playerOrName||'')).trim();
  const keyId   = String(obj ? (obj.id||'')   : '').trim();
  const p = (profile && typeof profile === 'object') ? profile : {};

  if (!keyName && !keyId) return null;

  // Build payload (only include defined keys)
  const payload = {};
  if (p.first_name != null) payload.first_name = String(p.first_name||'').trim();
  if (p.last_name  != null) payload.last_name  = String(p.last_name ||'').trim();
  if (p.nickname   != null) payload.nickname   = String(p.nickname  ||'').trim();
  if (p.initials   != null) payload.initials   = __sqNormalizeInitials(String(p.initials||''), (p.name||keyName));
  if (p.avatar_id  != null) payload.avatar_id  = __sqNormalizeAvatarId(p.avatar_id, keyId || keyName);

  // Optional name update (normally handled via rename RPC first)
  if (p.name != null){
    const nm = String(p.name||'').trim();
    if (nm) payload.name = nm;
  }

  if (!Object.keys(payload).length) return null;

  try{
    let q = sb.from(TABLE_PLAYERS).update(payload);
    if (keyId) q = q.eq('id', keyId);
    else q = q.eq('name', keyName);

    const { data, error } = await q.select('id,name,first_name,last_name,nickname,initials,avatar_id').maybeSingle();
    if (error) { markCloudError(error); throw error; }
    markCloudOk();
    await cloudRefreshPlayerDirectory(true);
    window.dispatchEvent(new CustomEvent('sq:players-changed'));
    return data || null;
  }catch(e){
    // If some columns don't exist on older deployments, fall back to safe minimal update.
    const msg  = String(e?.message || e || '');
    const code = String(e?.code || '');
    const missing = (code === '42703') || /column .* does not exist/i.test(msg);
    if (!missing) throw e;

    const fallback = {};
    if (payload.initials != null) fallback.initials = payload.initials;
    if (payload.name != null)     fallback.name     = payload.name;
    if (!Object.keys(fallback).length) return null;

    const q2 = keyId
      ? sb.from(TABLE_PLAYERS).update(fallback).eq('id', keyId)
      : sb.from(TABLE_PLAYERS).update(fallback).eq('name', keyName);
    const { data, error } = await q2.select('id,name,initials').maybeSingle();
    if (error) { markCloudError(error); throw error; }
    markCloudOk();
    try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('player_profile_fallback_update'); }catch(_){}
    return data || null;
  }
}

/* ===== @CLOUD:PLAYER_DIRECTORY (game-wide display + cache) ===== */
const TABLE_PLAYERS = 'players';
const TABLE_PLAYERS_ARCHIVE = 'players_archive'; // create this table in Supabase (see notes)

let _sqPlayerDir = { byId:{}, byName:{}, list:[], loadedAt:0 };

const SQ_PLAYERS_FETCH_TTL_MS = 60 * 1000;
window.__sqPlayersFetchInFlight = window.__sqPlayersFetchInFlight || null;
window.__sqPlayersFetchCache = Array.isArray(window.__sqPlayersFetchCache) ? window.__sqPlayersFetchCache : null;
window.__sqPlayersFetchAt = Number(window.__sqPlayersFetchAt || 0);
window.__sqPlayersFetchGeneration = Number(window.__sqPlayersFetchGeneration || 0);

function __sqClonePlayersRows(rows){
  return Array.isArray(rows) ? rows.map(p => Object.assign({}, p)) : [];
}

window.__sqInvalidatePlayersFetchCache = function(reason){
  window.__sqPlayersFetchGeneration = Number(window.__sqPlayersFetchGeneration || 0) + 1;
  window.__sqPlayersFetchInFlight = null;
  window.__sqPlayersFetchCache = null;
  window.__sqPlayersFetchAt = 0;
  try{ _sqPlayerDir.loadedAt = 0; }catch(_){}
  try{ console.debug && console.debug('[players] runtime fetch cache invalidated', reason || 'unspecified'); }catch(_){}
};

try{
  if(!window.__sqPlayersChangedCacheListenerInstalled){
    window.__sqPlayersChangedCacheListenerInstalled = true;
    window.addEventListener('sq:players-changed', function(){
      try{ window.__sqInvalidatePlayersFetchCache && window.__sqInvalidatePlayersFetchCache('sq:players-changed'); }catch(_){}
    });
  }
}catch(_){}

function sqIsUuidLike(v){
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

async function __sqFetchPlayersRows(force=false){
  if(!ensureCloudInit()) return [];
  const now = Date.now();
  if(!force && window.__sqPlayersFetchCache && (now - window.__sqPlayersFetchAt) < SQ_PLAYERS_FETCH_TTL_MS){
    return __sqClonePlayersRows(window.__sqPlayersFetchCache);
  }
  if(!force && window.__sqPlayersFetchInFlight){
    return __sqClonePlayersRows(await window.__sqPlayersFetchInFlight);
  }

  const generation = Number(window.__sqPlayersFetchGeneration || 0);
  const fetchPromise = (async function(){
    let data = [];
    try{
      const r1 = await sb
        .from(TABLE_PLAYERS)
        .select('id, name, initials, nickname, first_name, last_name, avatar_id, created_at, deleted_at')
        .is('deleted_at', null)
        .order('name');
      if(r1.error) throw r1.error;
      data = r1.data || [];
      markCloudOk();
    }catch(e1){
      const msg = String(e1?.message || e1 || '');
      const code = String(e1?.code || '');
      const isSchemaMismatch = (code === '42703') || /(initials|deleted_at|nickname|first_name|last_name|avatar_id)/i.test(msg);
      if(!isSchemaMismatch){
        markCloudError(e1);
        throw e1;
      }
      try{
        const r2 = await sb
          .from(TABLE_PLAYERS)
          .select('id, name, created_at')
          .order('name');
        if(r2.error) throw r2.error;
        data = (r2.data || []).map(p => ({ ...p, initials: __sqComputeInitialsFromName(p?.name) }));
        markCloudOk();
      }catch(e2){
        markCloudError(e2);
        throw e2;
      }
    }

    const rows = __sqClonePlayersRows(data);
    if(generation === Number(window.__sqPlayersFetchGeneration || 0)){
      window.__sqPlayersFetchCache = __sqClonePlayersRows(rows);
      window.__sqPlayersFetchAt = Date.now();
    }
    return rows;
  })();

  window.__sqPlayersFetchInFlight = fetchPromise;
  try{
    return __sqClonePlayersRows(await fetchPromise);
  }finally{
    if(window.__sqPlayersFetchInFlight === fetchPromise) window.__sqPlayersFetchInFlight = null;
  }
}

async function cloudRefreshPlayerDirectory(force=false){
  if (!ensureCloudInit()) return _sqPlayerDir;

  const now = Date.now();
  if (!force && _sqPlayerDir.loadedAt && (now - _sqPlayerDir.loadedAt) < SQ_PLAYERS_FETCH_TTL_MS && _sqPlayerDir.list?.length) return _sqPlayerDir;

  try{
    const list = await cloudListPlayers(!!force);
    const byId = {};
    const byName = {};
    for (const p of list){
      if (p?.id) byId[p.id] = p;
      if (p?.name) byName[String(p.name).trim().toLowerCase()] = p;
    }

    _sqPlayerDir = { byId, byName, list, loadedAt: Date.now() };
  }catch(e){
    console.warn('[SQ] player directory refresh failed:', e?.message || e);
  }

  return _sqPlayerDir;
}

function sqFormatPlayerLabelFromProfile(p){
  if (!p) return '';
  const first = (p.first_name || '').trim();
  const last  = (p.last_name || '').trim();
  const nick  = (p.nickname || '').trim();
  const baseName = (p.name || '').trim();

  // Prefer: First "Nickname" Last, else fallback to name
  if (first){
    if (nick && last) return `${first} "${nick}" ${last}`.trim();
    if (nick) return `${first} "${nick}"`.trim();
    if (last) return `${first} ${last}`.trim();
    return first;
  }

  if (baseName){
    if (nick) return `${baseName} "${nick}"`.trim();
    return baseName;
  }

  return '';
}

// Use anywhere UI needs a player label, even if history stores only `name`
function sqDisplayNameForPlayerField(nameOrId){
  if (nameOrId == null) return '';
  const raw = String(nameOrId);
  const t = raw.trim();
  if (!t) return '';

  const p =
    (_sqPlayerDir.byId && _sqPlayerDir.byId[t]) ||
    (_sqPlayerDir.byName && _sqPlayerDir.byName[t.toLowerCase()]);

  return p ? sqFormatPlayerLabelFromProfile(p) : raw;
}

function sqInitialsForPlayerField(nameOrId, fallback=''){
  if (nameOrId == null) return fallback;
  const raw = String(nameOrId).trim();
  if (!raw) return fallback;

  const p =
    (_sqPlayerDir.byId && _sqPlayerDir.byId[raw]) ||
    (_sqPlayerDir.byName && _sqPlayerDir.byName[raw.toLowerCase()]);

  return (p?.initials ? String(p.initials).trim() : fallback) || fallback;
}

async function cloudArchivePlayerSnapshot(playerRow, reason='admin_change'){
  if (!ensureCloudInit() || !playerRow?.id) return;
  try{
    const sb = window.sb;
    // best-effort archive (table may not exist yet)
    await sb.from(TABLE_PLAYERS_ARCHIVE).insert({
      player_id: playerRow.id,
      player_name: playerRow.name || null,
      reason,
      payload: playerRow,
      archived_at: new Date().toISOString(),
    });
  }catch(e){
    // ignore (archive table not present / RLS / etc.)
  }
}

// Game Complete modal hierarchy tweak (title + big result + smaller standings)

(function(){
  if (window.__gameCompleteModalPatch) return;
  window.__gameCompleteModalPatch = true;

  function patchGameCompleteModal(root){
    try{
      const modal = root.querySelector('.modal');
      if (!modal) return;

      const titleEl = modal.querySelector('h3');
      if (!titleEl) return;
      const titleText = (titleEl.textContent || '').trim();
      if (!/game complete/i.test(titleText)) return; // only touch the Game Complete popup

      // Tag modal + title for CSS
      modal.classList.add('game-complete');
      titleEl.classList.add('gc-title');

      const body = modal.querySelector('.modal-body') || modal;
      if (!body) return;

      // Find the existing winners line (WINNER: / JOINT WINNERS: ...)
      const children = Array.from(body.children || []);
      let resultEl = children.find(el => /winner/i.test((el.textContent || '')));

      // Fallback: first strong/heading that mentions winner
      if (!resultEl){
        const candidate = body.querySelector('strong, h1, h2, h3');
        if (candidate && /winner/i.test((candidate.textContent || ''))) {
          resultEl = candidate;
        }
      }

      if (resultEl){
        resultEl.classList.add('gc-result');
      }

      // Style the standings list (ordered or unordered list)
      const list = body.querySelector('ol, ul');
      if (list){
        list.classList.add('gc-standings');
      }
    } catch(e){
      console.error('patchGameCompleteModal error', e);
    }
  }

  // Watch for modals being added; when a Game Complete popup appears, patch it (via shared UI mutation bus)
  try {
    window.__sqUIMutationBus?.on((muts) => {
      for (const m of (muts || [])){
        for (const n of (m.addedNodes || [])){
          if (!(n instanceof HTMLElement)) continue;
          if (n.classList.contains('modal-backdrop')){
            // Let the modal render fully, then patch it
            setTimeout(() => patchGameCompleteModal(n), 0);
          }
        }
      }
    });
  } catch(_) {}
})();

// Patch Player Stats hub modal to inject a PROGRESSION button after STATS
(function () {
  if (window.__playerStatsProgressionPatch) return;
  window.__playerStatsProgressionPatch = true;

  function tryPatchPlayerStatsModal(root) {
    try {
      const modal = root.querySelector('.modal');
      if (!modal) return;

      const titleEl = modal.querySelector('h3');
      if (!titleEl) return;
      const titleText = (titleEl.textContent || '').trim();

      // Only touch Player Stats modals
      if (!/^Player Stats\s*[\u2013\u2014-]/i.test(titleText)) return;

      // Find GAMES and STATS buttons
      const buttons = Array.from(modal.querySelectorAll('button'));
      const gamesBtn = buttons.find(
        b => (b.textContent || '').trim().toUpperCase() === 'GAMES'
      );
      const statsBtn = buttons.find(
        b => (b.textContent || '').trim().toUpperCase() === 'STATS'
      );

      if (!gamesBtn || !statsBtn) return;

      // If PROGRESSION already exists, do nothing
      const existingProg = buttons.find(
        b => (b.textContent || '').trim().toUpperCase() === 'PROGRESSION'
      );
      if (existingProg) return;

      // Clone STATS style to keep look identical
      const progBtn = statsBtn.cloneNode(true);
      progBtn.textContent = 'PROGRESSION';
      if (progBtn.dataset) {
        progBtn.dataset.view = 'progression';
      }

      // Insert immediately after STATS
      if (statsBtn.parentNode) {
        statsBtn.parentNode.insertBefore(progBtn, statsBtn.nextSibling);
      }
    } catch (e) {
      console.error('Player Stats progression patch failed', e);
    }
  }

  try {
    window.__sqUIMutationBus?.on((muts) => {
      for (const m of (muts || [])) {
        for (const n of (m.addedNodes || [])) {
          if (!(n instanceof HTMLElement)) continue;

          // Modal added directly
          if (n.classList.contains('modal-backdrop')) {
            tryPatchPlayerStatsModal(n);
          } else if (n.querySelector) {
            // Or nested within some other added node
            const backdrop = n.querySelector('.modal-backdrop');
            if (backdrop) tryPatchPlayerStatsModal(backdrop);
          }
        }
      }
    });
  } catch (_) {}
})();

// Patch High Score League modal 'Back' button to return to League / Rankings
(function () {
  if (window.__hsLeagueBackPatch) return;
  window.__hsLeagueBackPatch = true;

  function tryPatchHsLeagueModal(root) {
    try {
      const modal = root.querySelector
        ? root.querySelector('.modal')
        : null;
      if (!modal) return;

      const titleEl = modal.querySelector('h3');
      if (!titleEl) return;

      const titleText = (titleEl.textContent || '').toLowerCase();
      // Only touch "High Scores" modals that look like the league/match view,
      // and skip anything clearly labeled as "Round High Scores".
      if (!titleText.includes('high') || !titleText.includes('score')) return;
      if (titleText.includes('round')) return;
      if (!titleText.includes('league') && !titleText.includes('match')) return;

      const buttons = Array.from(modal.querySelectorAll('button'));
      const backBtn = buttons.find(
        b => (b.textContent || '').trim().toLowerCase() === 'back'
      );
      if (!backBtn) return;

      backBtn.onclick = () => {
        let backdrop = root;
        if (!(backdrop instanceof HTMLElement) || !backdrop.classList.contains('modal-backdrop')) {
          backdrop = modal.closest('.modal-backdrop') || backdrop;
        }
        if (backdrop && backdrop.classList) {
          try { backdrop.classList.add('hidden'); } catch (_) {}
          try { backdrop.remove(); } catch (_) {}
        }
        // Return behaviour: if we're in admin context, go back to Admin Hub; otherwise League / Rankings
        if (window.__sqNavContext === 'admin' && typeof window.openAdminHub === 'function') {
          try { if (window.__sqLeagueOverlay && window.__sqLeagueOverlay.remove) window.__sqLeagueOverlay.remove(); } catch(_) {}
          try { window.openAdminHub(); } catch (_) {}
        } else if (typeof window.openLeagueRankingsDialog === 'function') {
          try { window.openLeagueRankingsDialog(); } catch (_) {}
        }
      };
    } catch (e) {
      try { console.error('HS League back patch failed', e); } catch (_) {}
    }
  }

  try {
    window.__sqUIMutationBus?.on((muts) => {
      for (const m of (muts || [])) {
        for (const n of (m.addedNodes || [])) {
          if (!(n instanceof HTMLElement)) continue;
          if (n.classList.contains('modal-backdrop')) {
            tryPatchHsLeagueModal(n);
          } else if (n.querySelector) {
            const backdrop = n.querySelector('.modal-backdrop');
            if (backdrop) tryPatchHsLeagueModal(backdrop);
          }
        }
      }
    });
  } catch (_) {}
})();

// >>> PATCH:power-league-rounds START — treat full game as 14 rounds
(function(){
  if (window.__powerLeagueRoundsPatch) return;
  window.__powerLeagueRoundsPatch = true;

  // Interpret recorded rounds (10–20 only) as part of a 14‑round game (10–20 + D + T + Bull)
  const RAW_ROUNDS_PER_GAME   = 11;
  const FULL_ROUNDS_PER_GAME  = 14;
  const SCALE = FULL_ROUNDS_PER_GAME / RAW_ROUNDS_PER_GAME;

  function rescaleRow(row){
    if (!row) return row;
    const raw = Number(row.rounds || 0);
    if (!raw || !Number.isFinite(raw)) return row;

    const scaled = Math.round(raw * SCALE);
    if (!scaled || !Number.isFinite(scaled)) return row;

    const next = Object.assign({}, row);

    // Try to preserve the original total by adjusting the average
    const avgKeys = ['avg_per_round','avgPerRound','avgRound','avg'];
    let totalScore = null;
    let avgKeyUsed = null;

    for (const k of avgKeys){
      if (!(k in next)) continue;
      const val = Number(next[k]);
      if (!Number.isFinite(val) || val <= 0) continue;
      totalScore = val * raw;
      avgKeyUsed = k;
      break;
    }

    next.rounds = scaled;
    if (avgKeyUsed && totalScore != null && scaled > 0){
      next[avgKeyUsed] = totalScore / scaled;
    }

    return next;
  }

  const orig = window.computePowerLeagueRows;
  if (typeof orig === 'function'){
    window.computePowerLeagueRows = async function(){
      const rows = await orig();
      if (!Array.isArray(rows)) return rows;
      return rows.map(rescaleRow);
    };
  }
})();
// >>> PATCH:power-league-rounds END

// [removed: openPlayerSummaryStatsDialog stub + openPlayerProgressionDialog dead def #1] audit P5.3 batch 2 — dead/shadowed definition, no live callers

// Player Stats overlay: wire the STATS tab via global click delegation
(function wirePlayerStatsStatsButton(){
  if (window.__playerStatsStatsWired) return;
  window.__playerStatsStatsWired = true;

  document.addEventListener('click', function(e){
    try {
      const btn = e.target.closest('button, .btn');
      if (!btn) return;
      const label = (btn.textContent || '').trim().toLowerCase();
      if (label !== 'stats') return;

      // Only act if this STATS control lives inside a Player Stats modal
      const modal = btn.closest('.modal');
      if (!modal) return;
      const h3 = modal.querySelector('h3');
      if (!h3 || !/player stats/i.test((h3.textContent || ''))) return;

      const titleText = h3.textContent || '';
      let playerName = '';

      // Extract the bit after "Player Stats –" / "Player Stats —" / "Player Stats -"
      const m = titleText.match(/player stats\s*[\u2013\u2014-]\s*(.+)$/i);
      if (m && m[1]) {
        playerName = m[1].trim();
      }

      // Fallback: strip the "Player Stats" prefix if present
      if (!playerName) {
        playerName = titleText.replace(/player stats/i, '').trim();
      }

      if (typeof window.openPlayerSummaryStatsDialog === 'function'){
        window.openPlayerSummaryStatsDialog(playerName || '');
      }
    } catch(err){
      console.error('wirePlayerStatsStatsButton error', err);
    }
  }, true); // capture so we see it before other handlers
})();

      console.log('SQ build: script wrapped OK');

// >>> PATCH:SQ_GLOBAL_ERROR_CAPTURE START
(function(){
  if (window.__sqErrCap) return;
  window.__sqErrCap = true;

  function stamp(kind, e){
    try{
      const msg = kind + ': ' + (e?.message || e?.reason?.message || e?.reason || e || '');
      console.error('[SQ]', msg, e);
      // non-blocking toast if available
      try{ if (typeof toast === 'function') toast('Error: ' + msg); }catch(_){ }
    }catch(_){ }
  }

  window.addEventListener('error', (e)=>stamp('error', e?.error || e), { capture:true });
  window.addEventListener('unhandledrejection', (e)=>stamp('promise', e), { capture:true });
})();
// <<< PATCH:SQ_GLOBAL_ERROR_CAPTURE END

// >>> PATCH:SQ_SHIM_getSavedMatchIdsSorted START
if (typeof window.getSavedMatchIdsSorted !== "function") {
  window.getSavedMatchIdsSorted = function getSavedMatchIdsSorted() {
    try {
      const raw = localStorage.getItem("sq_saved_match_ids") || "";
      const ids = raw.split(",").map(s=>s.trim()).filter(Boolean);
      return ids;
    } catch (e) {
      return [];
    }
  };
}
// >>> PATCH:SQ_SHIM_getSavedMatchIdsSorted END
if (!window.buildStartTicker) { window.buildStartTicker = async function(){}; }

// Start PB annotation on load (safe to call multiple times)
document.addEventListener('DOMContentLoaded', () => {
  try { setupRoundScoreObserver(); } catch(_) {}
  try { wireTopRowButtons(); } catch(_) {}
  try { initSetupSteppers(); } catch(_) {}
});

// --- Top row buttons: compatibility wiring for new + legacy IDs ---
function _showPageSafe(id){
  try { if (window.SQ_DIAG && typeof window.SQ_DIAG.mark === 'function') window.SQ_DIAG.mark('showPage', { id }); } catch(_){ }
  // Prefer existing app router, else do a minimal local switch
  if (typeof window.showPage === 'function') { try { window.showPage(id); return; } catch(_){ } }
  const sections = ['details','players','game','leaderboard'];
  sections.forEach(sid => {
    const sec = document.getElementById(sid);
    if (sec) {
      if (sid === id) sec.classList.remove('hidden');
      else sec.classList.add('hidden');
    }
  });
  try { document.body.dataset.page = id; } catch(_){}
}

function navigateToStartScreen(){
  _showPageSafe('details');
}

function restartGameSafe(){
  // Try known hooks if they exist, else reload as a last resort
  const candidates = ['restartGame', 'startNewGame', 'initMatch', 'beginNewGame'];
  for (const name of candidates){
    const fn = window[name];
    if (typeof fn === 'function'){
      try { fn(); return; } catch(_){}
    }
  }
  // Fallback: hard reset
  location.reload();
}

function openStatsHubSafe(){
  const candidates = ['openStatsHub', 'openStatsHubDialog', 'openStatsMenu', 'openStats', 'showStatsHub'];
  for (const name of candidates){
    const fn = window[name];
    if (typeof fn === 'function'){
      try { fn(); return; } catch(_){}
    }
  }
  if (typeof toast === 'function') toast('Stats panel not available on this build');
}
function wireTopRowButtons(){
  // Support both the new IDs and legacy IDs if they exist
  const startIds   = [
    'startScreenBtnFromGame',
    'startScreenBtnFromLB',
    'startScreenBtnLB',
    'startScreenBtnGame'
  ];
  const restartIds = [
    'restartGameBtnFromGame',
    'restartGameBtnFromLB',
    'restartGameBtnLB',
    'restartGameBtnGame'
  ];
  const statsIds   = [
    'statsHubBtnFromGame',
    'statsHubBtnFinal',
    'statsHubBtnLB',
    'statsHubBtnGame'
  ];

  startIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onclick = navigateToStartScreen;
  });
  restartIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onclick = restartGameSafe;
  });
  statsIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onclick = openStatsHubSafe;
  });
}

// --- Stepper bootstrap (must exist before any DOMContentLoaded references) ---
(function(){
  if (typeof window.initSetupSteppers === 'function') return;
  window.initSetupSteppers = function initSetupSteppers(){
    const steppers = document.querySelectorAll('.setup-stepper');
    steppers.forEach(stepper => {
      const selectId = stepper.getAttribute('data-select-id');
      const suffix   = stepper.getAttribute('data-suffix') || '';
      const select   = document.getElementById(selectId);
      const numEl    = stepper.querySelector('.stepper-number');
      const sufEl    = stepper.querySelector('.stepper-suffix');
      if (sufEl) sufEl.textContent = suffix;
      if (!select || !numEl) return;
      

/* === Admin → Button + Password Popup (final) === */
(function adminButton(){
  if (window.__sqAdminButtonInit) return;
  window.__sqAdminButtonInit = true;
  const expected = (window.ADMIN_PASSWORD || 'hownowbrowncow'); // change if needed

  // 1) Ensure we have a single Admin button
  const row = document.getElementById('adminCodeRow');
  let btn = document.getElementById('adminCodeBtn');

  function ensureButton() {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'adminCodeBtn';
      btn.className = 'btn';
      if (row) { row.innerHTML = ''; row.appendChild(btn); }
      else document.body.appendChild(btn); // fallback (shouldn’t be used)
    }
    btn.textContent = 'Admin';
    btn.title = 'Admin';
    btn.setAttribute('aria-label', 'Admin');
    btn.onclick = openAdminPasswordModal;
  }

  // 2) Remove any standalone "Admin Code" heading/label left in the markup
  function removeStandaloneLabel(){
    const candidates = Array.from(document.querySelectorAll(
      '#details h1, #details h2, #details h3, #details h4, #details .muted, #details label'
    ));
    candidates.forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^admin\s*code$/i.test(t)) el.remove();
    });
  }

  // 3) Password popup → on success open the standard Admin panel
  function openAdminPasswordModal(){
    if (window.__sqAdminModalOpen) return;
    window.__sqAdminModalOpen = true;
    const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
    const modal   = document.createElement('div'); modal.className = 'modal';

    const title = document.createElement('h3'); title.textContent = 'Admin Login';
    const body  = document.createElement('div'); body.className = 'modal-body';

    const label = document.createElement('label');
    label.textContent = 'Enter password:';
    label.className = 'muted';
    label.style.display = 'block';
    label.style.marginBottom = '6px';

    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'input';
    input.autocomplete = 'current-password';
    input.placeholder = 'Password';
    input.style.minWidth = '220px';

    body.append(label, input);

    const footer = document.createElement('div'); footer.className = 'modal-footer';
    const cancel = document.createElement('button'); cancel.className = 'btn';         cancel.textContent = 'Cancel';
    const enter  = document.createElement('button'); enter.className  = 'btn primary'; enter.textContent  = 'Enter';

    function close(){ try{ overlay.remove(); } finally { window.__sqAdminModalOpen = false; } }
    function deny(){
      if (typeof toast === 'function') toast('Incorrect password');
      else alert('Incorrect password');
      input.focus(); input.select();
    }
    function grant(){
      window.__sqAdminAuthed = true;
      close();
      // Call the ungated hub if available to avoid recursion
      if (typeof window.__openAdminHubUnsafe === 'function') window.__openAdminHubUnsafe();
      else if (typeof window.openAdminHub === 'function') window.openAdminHub();
      else if (typeof openAdminHub === 'function') openAdminHub();
    }
    function submit(){
      const v = (input.value || '').trim();
      if (!expected || v === expected) grant(); else deny();
    }

    cancel.onclick = close;
    enter.onclick  = submit;
    input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') submit(); });

    footer.append(cancel, enter);
    modal.append(title, body, footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.tabIndex = 0; modal.focus();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    setTimeout(()=> input.focus(), 0);
  }
    // Export for other wiring (e.g. start-screen Admin button)
    window.openAdminPasswordModal = openAdminPasswordModal;

// Ensure ALL admin entrypoints are password-gated (including any legacy buttons calling openAdminHub directly)
(function(){
  if (window.__sqAdminGateWrapped) return;
  window.__sqAdminGateWrapped = true;
  if (window.__sqAdminAuthed == null) window.__sqAdminAuthed = false;

  function tryWrap(){
    if (typeof window.openAdminPasswordModal !== 'function') return false;
    if (typeof window.openAdminHub !== 'function') return false;
    if (window.openAdminHub.__sqIsGated) return true;

    const unsafe = window.openAdminHub;
    window.__openAdminHubUnsafe = unsafe;

    window.openAdminHub = function(){
      if (window.__sqAdminAuthed) return unsafe();
      return window.openAdminPasswordModal();
    };
    window.openAdminHub.__sqIsGated = true;

    // Capture-click safety net (covers markup onclick + nested icons)
    document.addEventListener('click', (e)=>{
      const el = e.target && e.target.closest ? e.target.closest('#adminBtn,#adminCodeBtn,button,a') : null;
      if (!el) return;
      const id = (el.id||'').toLowerCase();
      const label = String(el.textContent||'').trim().toLowerCase();
      const isAdmin = (id==='adminbtn' || id==='admincodebtn' || label==='admin' || label==='admin hub' || label==='admin code');
      if (!isAdmin) return;
      if (!window.__sqAdminAuthed){
        e.preventDefault();
        e.stopPropagation();
        window.openAdminPasswordModal();
      }
    }, true);
    return true;
  }

  let tries = 0;
  const iv = setInterval(()=>{
    tries++;
    if (tryWrap() || tries > 30) clearInterval(iv);
  }, 200);
})();

  removeStandaloneLabel();
  ensureButton();
})();

// Start screen: simple High Scores hub (two choices)
function openHighScoresHubDialog(){
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
   const modal   = document.createElement('div'); modal.className   = 'modal sq-wide-modal';
  modal.style.maxWidth = '980px';
  modal.style.width = '94vw';
  modal.style.maxHeight = '90vh';
  modal.style.overflow = 'hidden';
  const title   = document.createElement('h3');  title.textContent = 'High Scores';
  const body    = document.createElement('div'); body.className = 'modal-body';
  const col     = document.createElement('div'); col.className = 'column'; col.style.gap = '8px';

  const btnMatch = document.createElement('button');
  btnMatch.className = 'btn big';
  btnMatch.textContent = 'High Scores (Match)';
  btnMatch.onclick = () => {
    try {
      if (typeof openHighScoresMenuDialog === 'function') openHighScoresMenuDialog(false);
      else if (typeof openHighScoresMenu === 'function') openHighScoresMenu(false);
      else if (typeof openHighScoresDialog === 'function') openHighScoresDialog(false);
      else if (typeof toast === 'function') toast('Match high scores not available');
      else alert('Match high scores not available');
    } finally { overlay.remove(); }
  };

  const btnRound = document.createElement('button');
  btnRound.className = 'btn big';
  btnRound.textContent = 'High Scores (Round)';
  btnRound.onclick = () => {
    try {
      if (typeof openRoundHighScoresDialog === 'function') openRoundHighScoresDialog();
      else if (typeof toast === 'function') toast('Round high scores not available');
      else alert('Round high scores not available');
    } finally { overlay.remove(); }
  };

  col.append(btnMatch, btnRound);
  body.appendChild(col);

  const footer = document.createElement('div'); footer.className = 'modal-footer';
  const close  = document.createElement('button'); close.className = 'btn'; close.textContent = 'Close';
  close.onclick = () => overlay.remove();
  footer.appendChild(close);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.tabIndex = 0; modal.focus();

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') overlay.remove(); });
}

      // Prevent duplicate bindings (which caused skipping: 1→3→5…)
      if (stepper.dataset.bound === '1') return;
      stepper.dataset.bound = '1';

      // Determine min/max from the select's option values
      const values = [...select.options].map(o => parseInt(o.value, 10)).filter(n => !Number.isNaN(n));
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      function syncFromSelect(){
        const val = parseInt(select.value, 10);
        if (!Number.isNaN(val)) {
          numEl.textContent = String(val);
        } else {
          const opt = select.options[select.selectedIndex];
          const txt = opt ? opt.textContent : '';
          const m = txt && txt.match(/\d+/);
          numEl.textContent = m ? m[0] : txt;
        }
      }

      function setTo(v){
        const targetIdx = [...select.options].findIndex(o => parseInt(o.value, 10) === v);
        if (targetIdx >= 0) {
          select.selectedIndex = targetIdx;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncFromSelect();
        }
      }

      // Bind buttons using `onclick` (overwrites any prior handlers)
      stepper.querySelectorAll('.stepper-btn').forEach(btn => {
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        btn.onclick = () => {
          const cur = parseInt(select.value, 10);
          const next = Math.min(maxVal, Math.max(minVal, cur + (delta > 0 ? 1 : -1)));
          setTo(next);
        };
      });

      select.addEventListener('change', syncFromSelect);
      syncFromSelect();
    });

    // Ensure initial player rows render to match default "players" count
    try { if (typeof drawPsRows === 'function') drawPsRows(); } catch(_) {}
  };
})();
/**********************
 * CONFIG: Supabase
 **********************/
const SUPABASE_URL = "https://vvfqumgtasuacpggdmxx.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnF1bWd0YXN1YWNwZ2dkbXh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTk0MDMsImV4cCI6MjA3ODUzNTQwM30.8NblWOwEsY1FP1hxvO6isQ908NyxkTgntnZZiXIFPHE";

// Dev-only Supabase read instrumentation.
// Enable with URL ?debug=1, localStorage.SQ_DEBUG='1', or localStorage.SQ_EGRESS_DEBUG='1'.
// When disabled, clients are returned unchanged so production behaviour and overhead stay the same.
(function(){
  const MAX_EGRESS_LOG_ENTRIES = 200;
  const CLIENT_WRAPS = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  const LABEL_STACK = [];
  let ACTIVE_NOTICE_SHOWN = false;

  function isEgressDebugEnabled(){
    try {
      if (window.SQ_DEBUG === true) return true;
      if (window.SQ_EGRESS_DEBUG === true || String(window.SQ_EGRESS_DEBUG || '') === '1') return true;
      if (window.localStorage) {
        if (localStorage.getItem('SQ_EGRESS_DEBUG') === '1') return true;
        if (localStorage.getItem('SQ_DEBUG') === '1') return true;
      }
      if (window.location && window.location.search) {
        const qs = new URLSearchParams(window.location.search);
        if (qs.get('debug') === '1' || qs.get('egress') === '1' || qs.get('egressDebug') === '1') return true;
      }
    } catch (_) {}
    return false;
  }

  function ensureLog(){
    if (!Array.isArray(window.__SQ_EGRESS_LOG)) window.__SQ_EGRESS_LOG = [];
    return window.__SQ_EGRESS_LOG;
  }
  ensureLog();

  function noteActive(){
    if (!isEgressDebugEnabled() || ACTIVE_NOTICE_SHOWN) return;
    ACTIVE_NOTICE_SHOWN = true;
    try { console.info('[SQ EGRESS] logger active'); } catch (_) {}
  }

  function nowMs(){
    try { return performance.now(); } catch (_) { return Date.now(); }
  }

  function approxJsonBytes(value){
    try {
      const json = JSON.stringify(value == null ? null : value);
      if (typeof Blob !== 'undefined') return new Blob([json]).size;
      return json ? json.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function safeStack(stack){
    try {
      return String(stack || '').split('\n').slice(1, 7).map(s => s.trim()).join(' | ');
    } catch (_) {
      return '';
    }
  }

  function inferLabel(stack){
    try {
      const lines = String(stack || '').split('\n').map(s => s.trim()).filter(Boolean);
      const hit = lines.find(line =>
        line !== 'Error' &&
        line.indexOf('__sq') < 0 &&
        line.indexOf('sqEgress') < 0 &&
        line.indexOf('Proxy') < 0 &&
        line.indexOf('instrument') < 0
      );
      return hit || '';
    } catch (_) {
      return '';
    }
  }

  function normaliseError(error){
    if (!error) return '';
    try {
      return String(error.message || error.details || error.code || error.status || error);
    } catch (_) {
      return 'unknown error';
    }
  }

  function responseRows(data){
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === 'object') return 1;
    if (data == null) return 0;
    return null;
  }

  function addCallHint(meta, method, args){
    const next = Object.assign({}, meta || {});
    const filters = Array.isArray(next.filters) ? next.filters.slice() : [];
    if (method === 'select') {
      next.operation = 'select';
      next.columns = String((args && args[0]) || '*');
      if (args && args[1] && typeof args[1] === 'object') {
        if (args[1].head) next.head = true;
        if (args[1].count) next.count = String(args[1].count);
      }
    } else if (method === 'limit') {
      next.limit = Number(args && args[0]);
    } else if (method === 'range') {
      next.range = String(args && args[0]) + '-' + String(args && args[1]);
    } else if (method === 'order') {
      filters.push('order(' + String(args && args[0]) + ')');
    } else if (method === 'single' || method === 'maybeSingle') {
      next.resultShape = method;
    } else if (method === 'insert' || method === 'update' || method === 'upsert' || method === 'delete') {
      next.mutation = method;
    } else if (
      method === 'eq' || method === 'neq' || method === 'gt' || method === 'gte' ||
      method === 'lt' || method === 'lte' || method === 'is' || method === 'like' ||
      method === 'ilike' || method === 'in' || method === 'contains' || method === 'overlaps'
    ) {
      filters.push(method + '(' + String(args && args[0]) + ')');
    } else if (method === 'or' || method === 'match' || method === 'filter') {
      filters.push(method + '(...)');
    }
    next.filters = filters.slice(-12);
    return next;
  }

  function pushEntry(meta, result, durationMs, stack){
    if (!isEgressDebugEnabled()) return;
    const data = result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
    const error = result && Object.prototype.hasOwnProperty.call(result, 'error') ? result.error : null;
    const bytes = approxJsonBytes(data);
    const entry = {
      timestamp: new Date().toISOString(),
      label: (LABEL_STACK.length ? LABEL_STACK[LABEL_STACK.length - 1] : '') || meta.label || inferLabel(meta.stack || stack),
      object: meta.object || '',
      kind: meta.kind || 'from',
      operation: meta.operation || (meta.kind === 'rpc' ? 'rpc' : ''),
      columns: meta.columns || '',
      filters: Array.isArray(meta.filters) ? meta.filters.slice() : [],
      limit: Number.isFinite(meta.limit) ? meta.limit : null,
      range: meta.range || '',
      count: meta.count || '',
      head: !!meta.head,
      mutation: meta.mutation || '',
      resultShape: meta.resultShape || '',
      rowCount: responseRows(data),
      bytes,
      kb: Math.round((bytes / 1024) * 10) / 10,
      durationMs: Math.round(durationMs),
      error: normaliseError(error),
      stack: safeStack(meta.stack || stack)
    };
    const log = ensureLog();
    log.push(entry);
    while (log.length > MAX_EGRESS_LOG_ENTRIES) log.shift();
    try { console.debug('[SQ EGRESS]', entry); } catch (_) {}
  }

  function shouldWrapBuilder(value){
    return !!(value && typeof value === 'object');
  }

  function wrapBuilder(builder, meta){
    if (!shouldWrapBuilder(builder)) return builder;
    let currentMeta = Object.assign({}, meta || {});
    let proxy = null;

    function execute(target, stack){
      const started = nowMs();
      let logged = false;
      function logOnce(result, error){
        if (logged) return;
        logged = true;
        pushEntry(currentMeta, error ? { data:null, error:error } : result, nowMs() - started, stack);
      }
      try {
        return target.then.call(target, function(result){
          logOnce(result, null);
          return result;
        }, function(error){
          logOnce(null, error);
          throw error;
        });
      } catch (error) {
        logOnce(null, error);
        return Promise.reject(error);
      }
    }

    proxy = new Proxy(builder, {
      get(target, prop, receiver){
        if (prop === '__sqEgressInstrumentedBuilder') return true;
        if (prop === 'then') {
          const thenFn = Reflect.get(target, prop, receiver);
          if (typeof thenFn !== 'function') return thenFn;
          return function(onFulfilled, onRejected){
            const stack = (new Error()).stack;
            return execute(target, stack).then(onFulfilled, onRejected);
          };
        }
        if (prop === 'catch') {
          if (typeof target.then === 'function') {
            return function(onRejected){
              const stack = (new Error()).stack;
              return execute(target, stack).catch(onRejected);
            };
          }
          const catchFn = Reflect.get(target, prop, receiver);
          return catchFn;
        }
        if (prop === 'finally') {
          if (typeof target.then === 'function') {
            return function(onFinally){
              const stack = (new Error()).stack;
              return execute(target, stack).finally(onFinally);
            };
          }
          const finallyFn = Reflect.get(target, prop, receiver);
          return finallyFn;
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return function(){
          const args = Array.prototype.slice.call(arguments);
          const nextMeta = addCallHint(currentMeta, String(prop), args);
          const next = value.apply(target, args);
          if (next === target) {
            currentMeta = nextMeta;
            return proxy;
          }
          return shouldWrapBuilder(next) ? wrapBuilder(next, nextMeta) : next;
        };
      }
    });
    return proxy;
  }

  function instrumentSupabaseClient(client){
    if (!client || typeof client.from !== 'function') return client;
    if (client.__sqEgressInstrumented) return client;
    if (!isEgressDebugEnabled()) return client;
    noteActive();
    if (CLIENT_WRAPS && CLIENT_WRAPS.has(client)) return CLIENT_WRAPS.get(client);

    const proxy = new Proxy(client, {
      get(target, prop, receiver){
        if (prop === '__sqEgressInstrumented') return true;
        if (prop === 'from') {
          return function(objectName){
            const sourceStack = (new Error()).stack;
            const builder = target.from.call(target, objectName);
            return wrapBuilder(builder, {
              kind: 'from',
              object: String(objectName || ''),
              stack: sourceStack
            });
          };
        }
        if (prop === 'rpc' && typeof target.rpc === 'function') {
          return function(fnName, args, options){
            const sourceStack = (new Error()).stack;
            const keys = args && typeof args === 'object' ? Object.keys(args) : [];
            const builder = target.rpc.call(target, fnName, args, options);
            return wrapBuilder(builder, {
              kind: 'rpc',
              object: String(fnName || ''),
              operation: 'rpc',
              columns: 'rpc',
              filters: keys.length ? ['args(' + keys.join(',') + ')'] : [],
              stack: sourceStack
            });
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });
    if (CLIENT_WRAPS) CLIENT_WRAPS.set(client, proxy);
    return proxy;
  }

  function installCreateClientHook(){
    if (!isEgressDebugEnabled()) return;
    const ns = window.supabase;
    if (!ns || typeof ns.createClient !== 'function') return;
    if (ns.createClient.__sqEgressCreateClientWrapped) {
      noteActive();
      return;
    }
    const originalCreateClient = ns.createClient;
    ns.createClient = function(){
      const client = originalCreateClient.apply(this, arguments);
      return instrumentSupabaseClient(client);
    };
    ns.createClient.__sqEgressCreateClientWrapped = true;
    ns.createClient.__sqOriginalCreateClient = originalCreateClient;
    noteActive();
  }

  function instrumentKnownSupabaseClients(){
    if (!isEgressDebugEnabled()) return;
    ['sb', '__sb', 'supabaseClient'].forEach(function(key){
      try {
        if (window[key] && typeof window[key].from === 'function') {
          window[key] = instrumentSupabaseClient(window[key]);
        }
      } catch (_) {}
    });
  }

  window.__sqInstrumentSupabaseClient = instrumentSupabaseClient;
  window.__sqInstallEgressCreateClientHook = installCreateClientHook;
  window.__sqInstrumentKnownSupabaseClients = instrumentKnownSupabaseClients;
  window.__SQ_WITH_EGRESS_LABEL = function(label, fn){
    LABEL_STACK.push(String(label || ''));
    try {
      const out = fn();
      if (out && typeof out.finally === 'function') {
        return out.finally(function(){ LABEL_STACK.pop(); });
      }
      LABEL_STACK.pop();
      return out;
    } catch (e) {
      LABEL_STACK.pop();
      throw e;
    }
  };
  window.__SQ_PRINT_EGRESS_LOG = function(){
    const log = ensureLog().slice();
    const totalBytes = log.reduce((sum, row) => sum + (Number(row.bytes) || 0), 0);
    const aggregate = function(key){
      const map = new Map();
      log.forEach(row => {
        const name = row[key] || '(unknown)';
        const rec = map.get(name) || { name, calls:0, bytes:0, kb:0, rows:0, errors:0, maxMs:0 };
        rec.calls += 1;
        rec.bytes += Number(row.bytes) || 0;
        rec.rows += Number(row.rowCount) || 0;
        rec.errors += row.error ? 1 : 0;
        rec.maxMs = Math.max(rec.maxMs, Number(row.durationMs) || 0);
        rec.kb = Math.round((rec.bytes / 1024) * 10) / 10;
        map.set(name, rec);
      });
      return Array.from(map.values()).sort((a,b) => b.bytes - a.bytes).slice(0, 12);
    };
    const slowest = log.slice().sort((a,b) => (b.durationMs || 0) - (a.durationMs || 0)).slice(0, 12);
    const biggest = log.slice().sort((a,b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 12);
    const summary = {
      totalCalls: log.length,
      totalBytes,
      totalKb: Math.round((totalBytes / 1024) * 10) / 10,
      topObjectsByBytes: aggregate('object'),
      topLabelsByBytes: aggregate('label'),
      slowestCalls: slowest,
      biggestResponses: biggest
    };
    try {
      console.group('[SQ EGRESS] Summary');
      console.log('total calls:', summary.totalCalls, 'total approx bytes:', summary.totalBytes, '(' + summary.totalKb + ' kB)');
      console.group('Top objects by bytes'); console.table(summary.topObjectsByBytes); console.groupEnd();
      console.group('Top labels/functions by bytes'); console.table(summary.topLabelsByBytes); console.groupEnd();
      console.group('Slowest calls'); console.table(summary.slowestCalls); console.groupEnd();
      console.group('Biggest single responses'); console.table(summary.biggestResponses); console.groupEnd();
      console.groupEnd();
    } catch (_) {}
    return summary;
  };
  installCreateClientHook();
  instrumentKnownSupabaseClients();
})();

// IMPORTANT: do NOT hard-crash the entire app if Supabase CDN is blocked (e.g., some online previewers).
// We initialise lazily in ensureCloudInit() instead.
let sb = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    if (window.__sqInstallEgressCreateClientHook) window.__sqInstallEgressCreateClientHook();
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    if (window.__sqInstrumentSupabaseClient) sb = window.__sqInstrumentSupabaseClient(sb);
    window.sb = sb;
    if (window.__sqInstrumentKnownSupabaseClients) window.__sqInstrumentKnownSupabaseClients();
  }
} catch (e) {
  console.warn('Supabase client init deferred/failed', e);
  sb = null;
}

// Keep table constants below
// View/table that lists every player's game across Official + Practice.
const TABLE_PLAYER_GAMES = 'v_player_games_union_visible';
const LEGACY_TABLE_PLAYER_GAMES = 'player_games_union';
const TABLE_HS_LEAGUE = "high_scores_sp";
const TABLE_HS_PRACTICE = "high_scores";
const TABLE_GAME_THROWS = "game_throws";

// Feature flag: the per-dart throws table/view (game_throws) is optional.
// If your Supabase schema doesn't include it, keep this false to avoid noisy 404s.
const FEATURE_CLOUD_THROWS = false;
// Force LIVE V2 gameplay layout across all platforms (2–6 players).
const FORCE_LIVEV2 = true;

// Legacy PB/WR storage (game_events-backed; retained only for legacy diagnostics/backfill context)
const TABLE_PB_ROUNDS = 'v_pb_by_player_round';    // columns: player, cat, val, game_id, ridx, ts
const TABLE_WR_ROUNDS = 'v_wr_by_round'; // columns: cat, val, player, game_id, ridx, ts
// Runtime PB/WR views used by the app. These expose the same client-facing shape without game_events dependency.
const TABLE_PB_ROUNDS_CLEAN_APP = 'v_pb_by_player_round_clean_app'; // columns: bucket_key, round_key, pb_points
const TABLE_WR_ROUNDS_CLEAN_APP = 'v_wr_by_round_clean_app'; // columns: round_key, wr_points

async function __sqGetPBWRCleanRowsFromSnapshot(){
  const snap = (typeof __sqEnsureV2PBWR === 'function') ? await __sqEnsureV2PBWR() : null;
  if (!snap || !snap.wrByRound || !snap.pbByBucket) return { wrRows:[], pbRows:[], error:'Clean PB/WR snapshot unavailable' };
  const wrRows = [];
  try{
    snap.wrByRound.forEach((wr_points, round_key) => wrRows.push({ round_key, wr_points }));
  }catch(_){}
  const pbRows = [];
  try{
    snap.pbByBucket.forEach((roundMap, bucket_key) => {
      if (!roundMap || typeof roundMap.forEach !== 'function') return;
      roundMap.forEach((pb_points, round_key) => pbRows.push({ bucket_key, round_key, pb_points }));
    });
  }catch(_){}
  return { wrRows, pbRows, error:'' };
}

// Extra tables used for cloud-backed stats
const TABLE_GAMES   = "games";
const TABLE_MATCHES = "matches";

/* >>> PATCH:CLOUD_TABLE_MISSING_GUARD START */
const CLOUD_TABLE_MISSING = Object.create(null);
const CLOUD_ONCE = Object.create(null);
// >>> PATCH:pre-mark-known-missing-supabase-objects START
// This Supabase project does not expose these legacy/optional objects.
// Pre-mark them missing so legacy callers short-circuit without network spam or UI impact.
try {
  [
    "game_throws",
    "league_low_scores",
    "high_score_league_official"
  ].forEach(name => { CLOUD_TABLE_MISSING[name] = true; });
} catch (_) {}
// >>> PATCH:pre-mark-known-missing-supabase-objects END
function cloudIsTableMissing(tableName){
  return !!(tableName && CLOUD_TABLE_MISSING[tableName]);
}
function cloudMarkTableMissing(tableName, err){
  if (!tableName) return false;
  if (CLOUD_TABLE_MISSING[tableName]) return true;
  const code = err && (err.code || err.error_code);
  const status = err && (err.status || err.statusCode);
  const msg = String((err && (err.message || err.error_description || err.details)) || '');
  const isMissing = code === 'PGRST205' || status === 404 || /\b404\b/.test(msg) || /does not exist/i.test(msg) || /not found/i.test(msg);
  if (!isMissing) return false;
  CLOUD_TABLE_MISSING[tableName] = true;
  const onceKey = 'missing:' + tableName;
  if (!CLOUD_ONCE[onceKey]){
    CLOUD_ONCE[onceKey] = true;
    console.warn('Cloud table missing/blocked; disabling related calls:', tableName, err);
  }
  return true;
}
/* <<< PATCH:CLOUD_TABLE_MISSING_GUARD END */

/**********************
 * SAFETY + TOAST
 **********************/
(function(){
  window.addEventListener('error', function(e){
    var b=document.getElementById('__err_banner')||document.createElement('div');
    b.id='__err_banner';
    b.style.cssText='position:fixed;left:0;right:0;top:0;background:#7a2e3f;color:#fff;padding:8px 12px;z-index:999999;font-weight:800';
    b.textContent='JS error: ' + (e.message||'(open console)');
    document.body.appendChild(b);
  });
  if(!window.toast){
    window.toast=function(msg){
      var d=document.createElement('div');
      d.textContent=msg;
      d.setAttribute('role','status');
      d.setAttribute('aria-live','polite');
      d.style.cssText='position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#121735;border:1px solid #2b3050;color:#e7e9f5;padding:8px 12px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:110000';
      document.body.appendChild(d); setTimeout(function(){d.remove();},1700);
    };
  }
})();

/*****************
 * CORE HELPERS
 *****************/
const byId = id => document.getElementById(id);
const STORAGE_KEY='shateki_quest_scorer_v6';
const HS_KEY='shateki_quest_highscores_v1';       // kept for backward-compat local
const HS_KEY_SP='shateki_quest_highscores_sp_v1'; // kept for backward-compat local
// Long-term history logs (not cleared when a match ends)
const GAMES_LOG_KEY   = 'shateki_quest_games_log_v1';
const MATCHES_LOG_KEY = 'shateki_quest_matches_log_v1';
function __sqIsRecoverableGameStateForLocalCache(o){
  try{
    if(!o || typeof o !== 'object') return false;
    const players = Array.isArray(o.players) ? o.players : [];
    if(!players.length) return false;
    if (typeof __sqSavedStateIsVsShadow === 'function' && __sqSavedStateIsVsShadow(o)) return false;
    if(o.gameAwarded === true || o.finished === true || o.__sqCompleted === true || o.__sqGameCompleteOpen === true) return false;
    return true;
  }catch(_){ return false; }
}
const safeSave=(k,o)=>{try{
  if(k===STORAGE_KEY && !__sqIsRecoverableGameStateForLocalCache(o)){
    localStorage.removeItem(k);
    return;
  }
  localStorage.setItem(k,JSON.stringify(o));
}catch(e){}};
const safeLoad=k=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch(e){return null;}};
const safeClear=k=>{try{localStorage.removeItem(k);}catch(e){}};

function syncStartTitleWidth(){
  const t = document.getElementById('appTitle');
  if (!t) return;
  const w = Math.ceil(t.getBoundingClientRect().width);
  document.documentElement.style.setProperty('--title-w', w + 'px');
  
}

// Return matches for official mode, merging local + cloud
async function getMatchesOfficial(){
  const localMatches = getMatchLog() || [];
  let cloudMatches = [];
  try { cloudMatches = await cloudFetchAllMatchesAsLocal(); } catch(_) {}

  const map = new Map();
  const stableKey = (m) => {
    const players = (m.players || [])
      .map(p => (p && p.name) ? String(p.name).trim().toLowerCase() : '')
      .join(',');
    return [m.ts || '', players].join('|');
  };
  [...cloudMatches, ...localMatches].forEach(m => {
    if (!m) return;
    const key = stableKey(m);
    if (!map.has(key)) map.set(key, m);
  });
  return [...map.values()];
}

// Build per-target counters for one player
function accumulateTargetCounters(playerName, games){
  const keys = {};
  // init keys 10..20, 'D','T','B'
  for (let n=10;n<=20;n++) keys[String(n)] = { thrown:0, hits:0, dHits:0, tHits:0 };
  keys.D = { thrown:0, hits:0 };
  keys.T = { thrown:0, hits:0 };
  keys.B = { thrown:0, hits:0, inner:0, outer:0 };

  games.forEach(g=>{
    if (!g || !Array.isArray(g.players) || !g.board) return;
    const pIdx = g.players.findIndex(p=>p && eqName(p.name, playerName));
    if (pIdx === -1) return;
    const board = g.board[pIdx]; if (!board) return;

    for (let r=0; r<MAX_ROUNDS; r++){
      const rd  = ROUNDS[r];
      const ent = board[r]; if (!ent || !ent.darts) continue;
      const darts = ent.darts;

      if (rd.type === 'number'){
        const key = String(rd.target);
        darts.forEach(d=>{
          if (!d) return;
          keys[key].thrown++;
          if ((d.points||0) > 0) keys[key].hits++;
          if (d.kind==='Double' || d.kind==='D') keys[key].dHits++;
          if (d.kind==='Triple' || d.kind==='T') keys[key].tHits++;
        });
      } else if (rd.type === 'doubles'){
        darts.forEach(d=>{
          if (!d) return;
          keys.D.thrown++;
          if ((d.points||0) > 0) keys.D.hits++;
        });
      } else if (rd.type === 'triples'){
        darts.forEach(d=>{
          if (!d) return;
          keys.T.thrown++;
          if ((d.points||0) > 0) keys.T.hits++;
        });
      } else if (rd.type === 'bull'){
        darts.forEach(d=>{
          if (!d) return;
          keys.B.thrown++;
          if (d.kind==='B'){
            keys.B.hits++;
            if (d.bull==='Inner') keys.B.inner++;
            else keys.B.outer++;
          }
        });
      }
    }
  });

  return keys;
}

// >>> PATCH:target-hit-from-throws START
// Accumulate Target Hit counters from normalized throw rows (Supabase-derived)
function accumulateTargetCountersFromThrows(playerName, throws){
  const nameLC = safeLower(playerName);
  const keys = {};
  for (let n=10;n<=20;n++) keys[String(n)] = { thrown:0, hits:0, dHits:0, tHits:0 };
  keys.D = { thrown:0, hits:0 };
  keys.T = { thrown:0, hits:0 };
  keys.B = { thrown:0, hits:0, inner:0, outer:0 };
  (throws||[]).forEach(t=>{
    if (!t || safeLower(t.player) !== nameLC) return;
    const ri = t.round_index;
    if (typeof ri !== 'number') return;
    if (ri >= 0 && ri <= 10){
      const key = String(10 + ri);
      keys[key].thrown++;
      if (t.hit) keys[key].hits++;
      if (t.kind==='d') keys[key].dHits++;
      if (t.kind==='t') keys[key].tHits++;
    } else if (ri === 11){
      keys.D.thrown++;
      if (t.hit) keys.D.hits++;
    } else if (ri === 12){
      keys.T.thrown++;
      if (t.hit) keys.T.hits++;
    } else if (ri === 13){
      keys.B.thrown++;
      if (t.hit) {
        keys.B.hits++;
        if (t.kind==='ib') keys.B.inner++;
        else if (t.kind==='ob') keys.B.outer++;
      }
    }
  });
  return keys;
}
// >>> PATCH:target-hit-from-throws END
// Put this at top-level (outside any function)
function openScoreSheetFromHistory(gIndex){
  const game = state.match.history[gIndex];
  if (!game || !game.board) { toast('No score sheet for that game.'); return; }
  const players = (typeof __sqIsVsShadowRuntime === 'function' && __sqIsVsShadowRuntime() && typeof __sqRealPlayersOnly === 'function')
    ? __sqRealPlayersOnly(state.players || [])
    : (state.players || []);
  const local = { ts: null, players: players.map(p=>({name:p.name})), board: game.board };
  openSingleGameScoreSheet(local, -1);
}

/* ===== PB / GR from Supabase (Saved Players + official games only; 10–20 + D/T/B) ===== */
(function(){
  const PBGR = {
    ready:false, fetching:false, fetchedAt:0,
    byPlayer:new Map(),           // player(lower) -> { [key]: best }
    byPlayerMeta:new Map(),       // player(lower) -> { [key]: {val, game_id, ridx, ts} }
    byTarget:{},                  // key -> best value (global)
    byTargetMeta:{}               // key -> { val, player, game_id, ridx, ts }
  };

  (function initGlobals(){
    for (let n=10;n<=20;n++) { PBGR.byTarget[n]=0; PBGR.byTargetMeta[n]={val:0,player:'',game_id:null,ridx:null,ts:null}; }
    ['D','T','B'].forEach(k=>{ PBGR.byTarget[k]=0; PBGR.byTargetMeta[k]={val:0,player:'',game_id:null,ridx:null,ts:null}; });
  })();

  const toNameKey = n => String(n||'').trim().toLowerCase();
  const toTarget  = t => {
    if (t==null) return null;
    if (typeof t === 'number') return t;
    const m = String(t).match(/\d+/);
    return m ? parseInt(m[0],10) : null;
  };

  async function fetchSavedPlayerNames(){
    try{
      const { data, error } = await sb.from(TABLE_PLAYERS).select('name').order('name');
      if (error) throw error;
      return (data||[]).map(r => String(r.name)).filter(Boolean);
    }catch(e){
      console.error('Saved players fetch failed', e);
      return [];
    }
  }
  async function findOfficialGameIds(){
    try{
      const { data, error } = await sb
        .from(TABLE_GAMES)
        .select('id, state')
        .limit(100000);
      if (error) throw error;

      const ids = new Set();
      for (const g of (data||[])){
        if (!g || !g.id) continue;
        let st = g.state;
        if (typeof st === 'string'){
          try { st = JSON.parse(st); } catch(_) {}
        }
        const players = st && Array.isArray(st.players) ? st.players : null;
        const n = players ? players.length : 0;
        if (n >= 2) ids.add(g.id);
      }
      return ids;
    }catch(e){
      console.warn('Could not read official game IDs from GAMES; will try is_practice on throws', e);
      return null;
    }
  }

  async function fetchPBGRFromCloud(limit = 100000){
    if (PBGR.fetching) return;
    PBGR.fetching = true;

    // >>> PATCH:pbwr-disable-legacy-game-throws START
    // Legacy PB/GR cloud fetch used game_throws, which is not present in this project.
    // Hard-disable to prevent unhandled rejections affecting gameplay render.
    PBGR.ready = true;
    PBGR.fetchedAt = Date.now();
    PBGR.fetching = false;
    return;
    // >>> PATCH:pbwr-disable-legacy-game-throws END

    // PB/GR cloud fetch depends on a per-dart throws table/view (game_throws).
    // Keep disabled unless your Supabase project provides that schema.
    if (!FEATURE_CLOUD_THROWS) {
      PBGR.ready = true;
      PBGR.fetchedAt = Date.now();
      PBGR.fetching = false;
      return;
    }

    // If the per-dart throws table/view is not available in this Supabase project,
    // disable PB/GR cloud fetch silently so gameplay is unaffected.
    if (cloudIsTableMissing(TABLE_GAME_THROWS)) {
      PBGR.ready = true;
      PBGR.fetchedAt = Date.now();
      PBGR.fetching = false;
      return;
    }

    try{
      const savedNames = await fetchSavedPlayerNames();
      if (!savedNames.length){
        PBGR.byPlayer = new Map();
        PBGR.byPlayerMeta = new Map();
        PBGR.ready = true;
        PBGR.fetchedAt = Date.now();
        return;
      }

      const officialIds = await findOfficialGameIds();
      let rows = [];
      try{
        let q = sb.from(TABLE_GAME_THROWS)
          .select('player, game_id, round_index, target, points, round_total, ts, is_practice')
          .in('player', savedNames)
          .limit(limit);

        if (officialIds && officialIds.size){
          q = q.in('game_id', Array.from(officialIds));
        } else {
          q = q.or('is_practice.is.null,is_practice.eq.false');
        }

        const { data, error } = await q;
        if (error) throw error;
        rows = data || [];
      }catch(e1){
        console.error('Primary throws fetch failed; falling back to saved players only', e1);
        if (cloudMarkTableMissing(TABLE_GAME_THROWS, e1)) {
          PBGR.ready = true;
          PBGR.fetchedAt = Date.now();
          PBGR.fetching = false;
          return;
        }
        if (cloudIsTableMissing(TABLE_GAME_THROWS)) {
          PBGR.ready = true;
          PBGR.fetchedAt = Date.now();
          PBGR.fetching = false;
          return;
        }
        const { data } = await sb.from(TABLE_GAME_THROWS)
          .select('player, game_id, round_index, target, points, round_total, ts')
          .in('player', savedNames)
          .limit(limit);
        rows = data || [];
      }

      const bestPerPlayerVal  = new Map();  // key: name|key -> val
      const bestPerPlayerMeta = new Map();  // key: name|key -> {val, game_id, ridx, ts}
      const bestGlobalVal     = { ...PBGR.byTarget };
      const bestGlobalMeta    = JSON.parse(JSON.stringify(PBGR.byTargetMeta));

      const bucket = new Map(); // key: game|name|ridx -> { ridx, target, total, ts }

      for (const row of (rows||[])){
        const nameKey = toNameKey(row.player || row.name);
        if (!nameKey) continue;

        const ridx = (typeof row.round_index === 'number') ? row.round_index : (row.round_index!=null ? Number(row.round_index) : null);
        const tNum = toTarget(row.target);
        const rt   = (row.round_total != null) ? Number(row.round_total) : null;
        const ts   = row.ts || null;

        function catFrom(ridxLocal, tLocal){
          if (tLocal!=null && tLocal>=10 && tLocal<=20) return tLocal;
          if (ridxLocal==null) return null;
          if (ridxLocal === 11) return 'D';
          if (ridxLocal === 12) return 'T';
          if (ridxLocal === 13) return 'B';
          if (ridxLocal>=0 && ridxLocal<=10) return 10 + ridxLocal;
          return null;
        }

        if (rt != null){
          const key = catFrom(ridx, tNum);
          if (key==null) continue;
          const val = rt;
          const pKey = `${nameKey}|${key}`;

          if (val > (bestPerPlayerVal.get(pKey) || 0)){
            bestPerPlayerVal.set(pKey, val);
            bestPerPlayerMeta.set(pKey, { val, game_id: row.game_id || null, ridx, ts });
          }
          if (val > (bestGlobalVal[key] || 0)){
            bestGlobalVal[key] = val;
            bestGlobalMeta[key] = { val, player: nameKey, game_id: row.game_id || null, ridx, ts };
          }
        } else {
          const gId = row.game_id || row.game || '';
          if (!gId || ridx==null) continue;
          const k = `${gId}|${nameKey}|${ridx}`;
          const cur = bucket.get(k) || { ridx, target: (tNum!=null ? tNum : null), total: 0, ts: ts };
          cur.total += Number(row.points || 0);
          if (cur.target==null && tNum!=null) cur.target = tNum;
          if (!cur.ts && ts) cur.ts = ts;
          bucket.set(k, cur);
        }
      }

      for (const [k, obj] of bucket){
        const [gId, nameKey, ridxStr] = k.split('|');
        const ridx = Number(ridxStr);
        const key  = (obj.target!=null && obj.target>=10 && obj.target<=20)
          ? obj.target
          : (ridx===11 ? 'D' : ridx===12 ? 'T' : ridx===13 ? 'B' : (ridx>=0 && ridx<=10 ? 10+ridx : null));
        if (key==null) continue;
        const val  = Number(obj.total || 0);
        const ts   = obj.ts || null;
        const pKey = `${nameKey}|${key}`;

        if (val > (bestPerPlayerVal.get(pKey) || 0)){
          bestPerPlayerVal.set(pKey, val);
          bestPerPlayerMeta.set(pKey, { val, game_id: gId, ridx, ts });
        }
        if (val > (bestGlobalVal[key] || 0)){
          bestGlobalVal[key] = val;
          bestGlobalMeta[key] = { val, player: nameKey, game_id: gId, ridx, ts };
        }
      }

      const byPlayer = new Map();
      const byPlayerMeta = new Map();
      for (const [key, v] of bestPerPlayerVal){
        const idx = key.lastIndexOf('|');
        const pKey = key.slice(0, idx);
        const cat  = key.slice(idx+1);
        const isNum = /^\d+$/.test(cat);
        const normKey = isNum ? parseInt(cat,10) : cat;
        if (!byPlayer.has(pKey)) byPlayer.set(pKey, {});
        if (!byPlayerMeta.has(pKey)) byPlayerMeta.set(pKey, {});
        byPlayer.get(pKey)[normKey] = v;
        byPlayerMeta.get(pKey)[normKey] = bestPerPlayerMeta.get(key);
      }

      PBGR.byPlayer     = byPlayer;
      PBGR.byPlayerMeta = byPlayerMeta;
      PBGR.byTarget     = bestGlobalVal;
      PBGR.byTargetMeta = bestGlobalMeta;
      PBGR.ready        = true;
      PBGR.fetchedAt    = Date.now();
    }catch(e){
      console.error('PBGR cloud build failed', e);
      PBGR.ready = false;
    }finally{
      PBGR.fetching = false;
    }
  }

  async function ensurePBGRCache(){
    if (PBGR.ready && Date.now() - PBGR.fetchedAt < 5*60*1000) return;
    await fetchPBGRFromCloud();
  }

  window.updatePBGRBadges = async function updatePBGRBadges(){
    if (document.body.getAttribute('data-page') !== 'game') return;
    await ensurePBGRCache();
    if (!PBGR.ready) return;
    try{
      for (let p=0; p<(state.players||[]).length; p++){
        const nameKey = toNameKey(state.players[p]?.name);
        const rounds  = state.score?.[p] || [];
        const pbMap   = PBGR.byPlayer.get(nameKey) || {};
        for (let r=0; r<Math.min(rounds.length, MAX_ROUNDS); r++){
          const rdDef = ROUNDS[r];
          if (!rdDef) continue;
          let key = null;
          if (rdDef.type === 'number')  key = rdDef.target;
          if (rdDef.type === 'doubles') key = 'D';
          if (rdDef.type === 'triples') key = 'T';
          if (rdDef.type === 'bull')    key = 'B';
          if (key==null) continue;
          const rt = Number(rounds[r]?.roundTotal||0);
          if (!rt) continue;
          const priorPB = Number(pbMap[key] || 0);
          const priorGR = Number(PBGR.byTarget[key] || 0);
          const isPB = rt > priorPB;
          const isGR = rt > priorGR;
          const tbody = document.getElementById('tbody'); if (!tbody) continue;
          const tr = tbody.rows?.[r]; if (!tr) continue;
          const td = tr.children?.[p+1]; if (!td) continue;
          const sub = td.querySelector('.cell-sub') || td;
          sub.querySelectorAll('.pbgr').forEach(n => n.remove());
          if (isPB){
            const b = document.createElement('span');
            b.className = 'pbgr pb'; b.textContent = ' (PB)'; sub.appendChild(b);
          }
          if (isGR){
            const g = document.createElement('span');
            g.className = 'pbgr gr'; g.textContent = ' (GR)'; sub.appendChild(g);
          }
        }
      }
    }catch(_){}
  };

  window.refreshPBGRCloud = async function(){
    PBGR.ready=false;
    await ensurePBGRCache();
    await window.updatePBGRBadges();
  };

  // Expose a read-only snapshot for admin UI
  window.getPBGRSnapshot = async function(){
    await ensurePBGRCache();
    return {
      byTarget: Object.assign({}, PBGR.byTarget),
      byTargetMeta: JSON.parse(JSON.stringify(PBGR.byTargetMeta)),
      byPlayer: new Map(PBGR.byPlayer),
      byPlayerMeta: new Map(PBGR.byPlayerMeta)
    };
  };
})();

// Percent helper
function pctStr(num, den){
  if (!den) return '—';
  return Math.round((num/den)*100) + '%';
}

function isOfficialGame(g){
  try {
    if (typeof window.__sqGameModeKey === 'function') return window.__sqGameModeKey(g) === 'official';
  } catch(_) {}
  if (!g) return false;

  // Explicit flags always win
  if (g.mode === 'practice' || g.is_practice === true || g.isPractice === true) return false;

  // Cloud truth: games table uses match_id = null for practice, non-null for official
  const hasMatch = !!(g.matchId || g.match_id);
  if (hasMatch) return Array.isArray(g.players) && g.players.length >= 2;

  // If explicitly marked official, accept
  if (g.mode === 'official' || g.is_practice === false) return Array.isArray(g.players) && g.players.length >= 2;

  // Otherwise: treat unknown/no match_id as NOT official (prevents swapping)
  return false;
}
function isPracticeGame(g){
  try {
    if (typeof window.__sqGameModeKey === 'function') return window.__sqGameModeKey(g) === 'practice';
  } catch(_) {}
  if (!g) return false;

  // Explicit flags
  if (g.mode === 'practice' || g.is_practice === true || g.isPractice === true) return true;

  const hasMatch = !!(g.matchId || g.match_id);
  if (hasMatch) return false;

  // Explicit official flag blocks practice
  if (g.mode === 'official' || g.is_practice === false) return false;

  // Fallback: no match_id means practice (covers guest games + old rows)
  const players = Array.isArray(g.players) ? g.players : [];
  return players.length >= 1;
}
function filterByMode(games, matches, mode){
  const gm = (games || []).filter(mode === 'official' ? isOfficialGame : isPracticeGame);
  const mm = (mode === 'official') ? (matches || []) : []; // practice ignores matches
  return { games: gm, matches: mm };
}

// Case/whitespace-insensitive player name compare
function eqName(a, b){
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

// Legacy log keys (fallback/migration)
const LEGACY_GAME_KEYS  = ['shateki_quest_games_log', 'shateki_quest_games_log_v0'];
const LEGACY_MATCH_KEYS = ['shateki_quest_matches_log', 'shateki_quest_matches_log_v0'];

// UUID v4 for Supabase match IDs (uuid column)
function genUuidV4() {
  const a = crypto.getRandomValues(new Uint8Array(16));
  a[6] = (a[6] & 0x0f) | 0x40;  // version
  a[8] = (a[8] & 0x3f) | 0x80;  // variant
  const h = [...a].map(b => b.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// Backdate (applies to the NEXT cloud save only)
let _tsOverride = null;

function setBackdateInteractive() {
  const v = prompt('Enter local date/time for *next* cloud save (YYYY-MM-DD HH:MM)');
  if (!v) return;
  const m = v.trim().replace(' ', 'T');
  const dt = new Date(m);
  if (isNaN(dt.getTime())) { toast('Bad date/time'); return; }
  _tsOverride = dt.toISOString();
  toast('Backdate set for next save');
}
function clearBackdate(){ _tsOverride = null; }

// ---------- CORE STATE ----------
const baseState = {
  players: [],
  score: [],
  currentRound: 0,
  currentPlayer: 0,
  currentDart: 0,
  history: [],
  finished: false,
  suddenDeath: { active: false, participants: [], turnIndex: 0, throws: [], round: 1 },
  match: {
    id: null,
    targetWins: 4,      // default "first to 4 wins" – overwritten when you start a match
    gameNumber: 1,
    wins: [],
    history: [],
    completedLogged: false
  },
  matchAgg: null,
  gameAwarded: false
};

