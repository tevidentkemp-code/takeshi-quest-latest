// ===== @SEC:JS:MODALS =====
// ===== @JS:MODAL:HIGH_SCORE_LEAGUE =====
// [removed: openHighScoreLeagueDialog base def] audit P5.3 batch 3 — shadowed by later canonical definition

// ---- one-time error banner (shows first JS crash) ----
(function attachFirstErrorBanner(){
  if (window.__errorBannerAttached) return;
  window.__errorBannerAttached = true;
  window.addEventListener('error', function(ev){
    try {
      if (document.getElementById('firstErrorBanner')) return;
      const b = document.createElement('div');
      b.id = 'firstErrorBanner';
      b.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99999;padding:8px 10px;border-radius:6px;background:#400;color:#fff;font:12px/1.4 system-ui';
      b.textContent = 'JS error: ' + (ev.message || 'unknown') + (ev.filename?(' @ '+ev.filename+':'+ev.lineno):'');
      document.body.appendChild(b);
      setTimeout(()=>{ if(b && b.parentNode) b.parentNode.removeChild(b); }, 6000);
    } catch(_) {}
  });
})();

// League / Rankings popup (Power Rankings + High Score League)
// ===== @JS:MODAL:LEAGUE_RANKINGS =====
// @CANONICAL:LEAGUE_RANKINGS_MENU
window.openLeagueRankingsDialog = async function openLeagueRankingsDialog(){
  try{ if (typeof window.__sqCleanupLeagueRankingsOverlays === 'function') window.__sqCleanupLeagueRankingsOverlays(); }catch(_){}
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-league-rankings-backdrop';
  try { window.__sqLeagueOverlay = overlay; } catch(_) {}

  const modal = document.createElement('div');
  modal.className = 'modal menu-modal';

  // Header (Back + Title + Close)
  const header = document.createElement('div');
  header.className = 'menu-modal-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'icon-btn';
  backBtn.type = 'button';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'menu-modal-title';

  const icon = document.createElement('div');
  icon.className = 'menu-modal-icon';
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5h8v3a4 4 0 0 1-8 0V5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M6 6H4v1a4 4 0 0 0 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 6h2v1a4 4 0 0 1-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 14h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 14v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 19h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const title = document.createElement('div');
  title.className = 'menu-modal-title-text';
  title.textContent = 'LEAGUE / RANKINGS';

  titleWrap.append(icon, title);
  header.append(backBtn, titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body menu-modal-body';

  const list = document.createElement('div');
  list.className = 'menu-list';

  const makeRow = ({ id, label, desc, accent, svg }) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'menu-row';
    btn.type = 'button';
    if (accent) btn.style.setProperty('--accent', accent);

    const left = document.createElement('div');
    left.className = 'menu-row-left';

    const ic = document.createElement('div');
    ic.className = 'menu-row-icon';
    ic.innerHTML = svg;

    const txt = document.createElement('div');
    txt.className = 'menu-row-text';

    const t = document.createElement('div');
    t.className = 'menu-row-label';
    t.textContent = label;
    txt.appendChild(t);

    if (desc){
      const d = document.createElement('div');
      d.className = 'menu-row-desc';
      d.textContent = desc;
      txt.appendChild(d);
    }

    left.append(ic, txt);

    const right = document.createElement('div');
    right.className = 'menu-row-right';
    right.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    btn.append(left, right);
    return btn;
  };

  const icons = {
    chart: "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M4 19V5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M4 19h16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M7 14l4-4 3 3 5-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
    trophy: "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M8 5h8v3a4 4 0 0 1-8 0V5z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M6 6H4v1a4 4 0 0 0 4 4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M18 6h2v1a4 4 0 0 1-4 4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 14h4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M12 14v5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M9 19h6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
    list: "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M8 6h13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M8 12h13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M8 18h13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M3 6h.01M3 12h.01M3 18h.01\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
    clock: "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M12 8v5l3 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>",
    medal: "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\"><path d=\"M8 2l4 7 4-7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>"
  };

  // Rows (names already in use)
  list.appendChild(makeRow({
    id:'powerRankingsBtn',
    label:'Power Rankings',
    desc:'Form Guide',
    accent:'#41d3ff',
    svg:icons.chart
  }));

  list.appendChild(makeRow({
    id:'premierLeagueBtn',
    label:'Premier League',
    desc:'Monthly Highest Average League',
    accent:'#f6c453',
    svg:icons.trophy
  }));

  list.appendChild(makeRow({
    id:'highScoreLeagueBtn',
    label:'High Score League',
    desc:'Each Players PBs',
    accent:'#f6c453',
    svg:icons.medal
  }));

  list.appendChild(makeRow({
    id:'streakLeagueBtn',
    label:'Streak League',
    desc:'Dart and round target-hit streaks',
    accent:'#43ff8b',
    svg:icons.chart
  }));

  list.appendChild(makeRow({
    id:'leagueRoundHighScoresBtn',
    label:'Round High Scores',
    desc:'Best single-round scores',
    accent:'#41d3ff',
    svg:icons.list
  }));

  list.appendChild(makeRow({
    id:'leagueTop50ScoresBtn',
    label:'Top 50 Scores',
    desc:'Best match scores',
    accent:'#41d3ff',
    svg:icons.list
  }));

  list.appendChild(makeRow({
    id:'leagueLatestScoresBtn',
    label:'Latest Scores',
    desc:'Last 10 results',
    accent:'#41d3ff',
    svg:icons.clock
  }));

  body.appendChild(list);
  modal.append(header, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  const remove = () => overlay.remove();

  // Decider shootout (only when draw + not yet resolved)
  modal.querySelector('[data-action="startDecider"]')?.addEventListener('click', () => {
    try {
      openDeciderShootoutDialog(winnerIdx, totals);
      // hide this modal while decider runs
      overlay.remove();
    } catch (e) {
      console.error(e);
      toast('Could not start decider (see console)');
    }
  });

  backBtn.onclick = remove;
  closeBtn.onclick = remove;

  overlay.addEventListener('click', e => { /* no overlay-close during decider */ });
  overlay.addEventListener('keydown', e => { /* no ESC-close during decider */ });

  modal.tabIndex = 0;
  modal.focus();

  // Wire buttons to dialogs (keep existing semantics)
  document.getElementById('powerRankingsBtn')?.addEventListener('click', () => {
    remove();
    if (typeof window.openPowerLeagueDialog === 'function') return window.openPowerLeagueDialog();
    if (typeof window.openPowerRankingsDialog === 'function') return window.openPowerRankingsDialog();
  });

  document.getElementById('premierLeagueBtn')?.addEventListener('click', () => {
    remove();
    if (typeof window.openPremierLeagueDialog === 'function') return window.openPremierLeagueDialog();
    if (typeof window.openPremierLeaguePopup === 'function') return window.openPremierLeaguePopup();
    try { toast('Premier League not available'); } catch(_) {}
  });

  document.getElementById('highScoreLeagueBtn')?.addEventListener('click', () => {
    remove();
    try {
      if (typeof window.openHighScoreLeagueDialog === 'function') return window.openHighScoreLeagueDialog();
      if (typeof openHighScoreLeagueDialog === 'function') return openHighScoreLeagueDialog();
    } catch(_) {}
    try { toast('High Score League not available'); } catch(_) {}
  });

  document.getElementById('streakLeagueBtn')?.addEventListener('click', () => {
    remove();
    try {
      if (typeof window.openStreakLeagueDialog === 'function') return window.openStreakLeagueDialog();
      if (typeof openStreakLeagueDialog === 'function') return openStreakLeagueDialog();
    } catch(_) {}
    try { toast('Streak League not available'); } catch(_) {}
  });

  document.getElementById('leagueRoundHighScoresBtn')?.addEventListener('click', () => {
    remove();
    try {
      if (typeof window.openRoundHighScoresDialog === 'function') return window.openRoundHighScoresDialog();
      if (typeof openRoundHighScoresDialog === 'function') return openRoundHighScoresDialog();
    } catch(_) {}
    try { toast('Round High Scores not available'); } catch(_) {}
  });

  document.getElementById('leagueTop50ScoresBtn')?.addEventListener('click', () => {
    remove();
    try {
      if (typeof window.openTop50ScoresDialog === 'function') return window.openTop50ScoresDialog();
      if (typeof openTop50ScoresDialog === 'function') return openTop50ScoresDialog();
    } catch(_) {}
    try { toast('Top 50 Scores not available'); } catch(_) {}
  });

  document.getElementById('leagueLatestScoresBtn')?.addEventListener('click', () => {
    remove();
    try {
      if (typeof window.openLatestScoresDialog === 'function') return window.openLatestScoresDialog();
      if (typeof openLatestScoresDialog === 'function') return openLatestScoresDialog();
    } catch(_) {}
    try { toast('Latest Scores not available'); } catch(_) {}
  });

};

// @CANONICAL:STREAK_LEAGUE_POPUP
window.openStreakLeagueDialog = async function openStreakLeagueDialog(initialMetric, initialMode){
  const SB = (typeof window !== 'undefined') ? (window.sb || window.__sb || window.supabase || window.supabaseClient || null) : null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = ts => {
    try{
      const d = new Date(ts || 0);
      if (!Number.isFinite(d.getTime())) return '—';
      return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }).replace(',', '');
    }catch(_){ return '—'; }
  };
  const metricModes = [{key:'dart', label:'Dart Streak'}, {key:'round', label:'Round Streak'}];
  const modeModes = [{key:'official', label:'Official'}, {key:'turbo', label:'Turbo'}, {key:'classic', label:'Practice'}];
  let metric = metricModes.some(m => m.key === String(initialMetric || '').toLowerCase()) ? String(initialMetric).toLowerCase() : 'dart';
  let mode = modeModes.some(m => m.key === String(initialMode || '').toLowerCase()) ? String(initialMode).toLowerCase() : 'official';

  if (!document.getElementById('sq-streak-league-css')){
    const st = document.createElement('style');
    st.id = 'sq-streak-league-css';
    st.textContent = `
      .sq-streak-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .sq-streak-title h3{margin:0;font-size:20px;line-height:1.1;font-weight:900}
      .sq-streak-sub{font-size:11px;color:rgba(231,233,245,.66);margin-top:4px}
      .sq-streak-controls{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:4px 0 10px}
      .sq-streak-tabs{display:flex;gap:7px;flex-wrap:wrap}
      .sq-streak-tabs button{border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(10,12,24,.58);color:rgba(245,247,255,.86);font-weight:850;font-size:12px;padding:8px 11px;cursor:pointer}
      .sq-streak-tabs button.active{border-color:rgba(255,123,26,.92);background:rgba(255,123,26,.14);box-shadow:0 0 0 2px rgba(255,123,26,.12) inset;color:#fff}
      .sq-streak-tabs button:disabled{opacity:.45;cursor:not-allowed}
      .sq-streak-note{border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:9px 11px;color:rgba(231,233,245,.76);font-size:12px;margin:4px 0 10px;background:rgba(255,255,255,.035)}
      .sq-streak-table{width:100%;border-collapse:collapse;table-layout:fixed}
      .sq-streak-table th{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:rgba(220,224,240,.72);padding:12px 10px;background:rgba(255,255,255,.035);text-align:left}
      .sq-streak-table td{font-size:14px;padding:12px 10px;border-top:1px solid rgba(255,255,255,.08);font-variant-numeric:tabular-nums}
      .sq-streak-table .rank-cell{color:#ff8a00;font-weight:900}
      .sq-streak-table .streak-cell{font-weight:900;text-align:center}
      @media(max-width:620px){.sq-streak-head{display:block}.sq-streak-controls{display:block}.sq-streak-tabs{margin-bottom:8px}.sq-streak-table th,.sq-streak-table td{font-size:12px;padding:10px 7px}.sq-streak-table col:nth-child(5){width:0!important}.sq-streak-table th:nth-child(5),.sq-streak-table td:nth-child(5){display:none}}
    `;
    document.head.appendChild(st);
  }

  try{ if (typeof window.__sqCleanupLeagueRankingsOverlays === 'function') window.__sqCleanupLeagueRankingsOverlays(); }catch(_){}
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-streak-league-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal sq-wide-modal';
  modal.style.maxWidth = '980px';
  modal.style.width = '94vw';
  modal.style.maxHeight = '90vh';
  modal.style.overflow = 'hidden';

  const head = document.createElement('div');
  head.className = 'sq-streak-head';
  head.innerHTML = '<div class="sq-streak-title"><h3>Streak League</h3><div class="sq-streak-sub">Supabase target-hit streak rankings by mode.</div></div>';

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.overflowY = 'auto';
  body.style.maxHeight = '64vh';
  const controls = document.createElement('div');
  controls.className = 'sq-streak-controls';
  const metricTabs = document.createElement('div');
  metricTabs.className = 'sq-streak-tabs';
  metricModes.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.metric = m.key;
    b.textContent = m.label;
    metricTabs.appendChild(b);
  });
  const modeTabs = document.createElement('div');
  modeTabs.className = 'sq-streak-tabs';
  modeModes.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mode = m.key;
    b.textContent = m.label;
    modeTabs.appendChild(b);
  });
  controls.append(metricTabs, modeTabs);
  body.innerHTML = '<div class="sq-streak-note"></div><div class="sk-list"><div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div></div>';
  body.prepend(controls);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.style.justifyContent = 'flex-start';
  const back = document.createElement('button');
  back.className = 'btn sq-pill';
  back.textContent = 'Back';
  const close = document.createElement('button');
  close.className = 'btn sq-pill';
  close.textContent = 'Close';
  footer.append(back, close);
  modal.append(head, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  const note = body.querySelector('.sq-streak-note');
  const list = body.querySelector('.sk-list');
  const reduced = (() => { try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; } })();
  const skCount = (el, target, dur) => {
    if (reduced || !Number.isFinite(target)){ el.textContent = String(Math.round(target || 0)); return; }
    const t0 = performance.now();
    (function step(t){
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  };
  function labelFor(list, key){ const row = list.find(x => x.key === key); return row ? row.label : key; }
  function setActive(){
    metricTabs.querySelectorAll('button[data-metric]').forEach(b => b.classList.toggle('active', b.dataset.metric === metric));
    modeTabs.querySelectorAll('button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  }
  async function fetchRows(){
    if (!SB || typeof SB.from !== 'function') throw new Error('Supabase client is not available');
    const streakCol = metric === 'round' ? 'round_streak' : 'dart_streak';
    const q = await SB.from('v_player_target_streaks')
      .select('player_key,player_name,mode_key,mode_label,dart_streak,round_streak,source_games,last_played_at')
      .eq('mode_key', mode)
      .order(streakCol, { ascending:false, nullsFirst:false })
      .order('source_games', { ascending:false, nullsFirst:false })
      .order('last_played_at', { ascending:false, nullsFirst:false })
      .order('player_name', { ascending:true })
      .limit(250);
    if (q && q.error) throw q.error;
    return Array.isArray(q && q.data) ? q.data : [];
  }
  async function render(){
    setActive();
    note.textContent = labelFor(metricModes, metric) + ' · ' + labelFor(modeModes, mode);
    list.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
    try{
      const streakCol = metric === 'round' ? 'round_streak' : 'dart_streak';
      let rows = await window.__sqWithCloudTimeout(fetchRows(), 12000, 'streak-league');
      rows.sort((a,b) => (Number(b[streakCol] || 0) - Number(a[streakCol] || 0)) || (Number(b.source_games || 0) - Number(a.source_games || 0)) || (Date.parse(b.last_played_at || '') - Date.parse(a.last_played_at || '')) || String(a.player_name || '').localeCompare(String(b.player_name || '')));
      const nonZero = rows.filter(r => Number(r[streakCol] || 0) > 0);
      rows = nonZero.length ? nonZero : rows;
      if (!rows.length){
        var msg = mode === 'turbo'
          ? 'Turbo Streak League is not available yet because the streak source has no Turbo target-hit rows.'
          : 'Streak League data is not available yet. Required Supabase view/data source is missing or empty.';
        list.innerHTML = '<p class="tag">'+esc(msg)+'</p>';
        return;
      }
      // Combo chains: segmented streak meter per player, white-hot tip,
      // pulsing leader row, count-up streak values.
      list.innerHTML = '';
      const maxStreak = rows.reduce((m, r) => Math.max(m, Number(r[streakCol] || 0)), 1);
      const SEGS = 12;
      rows.forEach((r, i) => {
        const streak = Number(r[streakCol] || 0);
        const row = document.createElement('div');
        row.className = 'sk-row' + (i === 0 && streak > 0 ? ' hot' : '');
        row.style.animationDelay = Math.min(700, i * 45) + 'ms';
        const rank = document.createElement('div');
        rank.className = 'sk-rank' + (i < 3 ? ' g' + (i + 1) : '');
        rank.textContent = '#' + (i + 1);
        const main = document.createElement('div'); main.className = 'sk-main';
        const nm = document.createElement('div'); nm.className = 'sk-name'; nm.textContent = r.player_name || r.player_key || '—';
        const chain = document.createElement('div'); chain.className = 'sk-chain';
        const lit = streak > 0 ? Math.max(1, Math.round(streak / maxStreak * SEGS)) : 0;
        for (let sIx = 0; sIx < SEGS; sIx++){
          const seg = document.createElement('span');
          seg.className = 'sk-seg' + (sIx < lit ? (sIx === lit - 1 ? ' on tip' : ' on') : '');
          chain.appendChild(seg);
        }
        const sub = document.createElement('div'); sub.className = 'sk-sub';
        const games = Number(r.source_games || 0);
        sub.textContent = games + (games === 1 ? ' game' : ' games') + ' · ' + fmtDate(r.last_played_at);
        main.append(nm, chain, sub);
        const val = document.createElement('div'); val.className = 'sk-val';
        if (i === 0 && streak >= 3) val.classList.add('pp-hot');
        skCount(val, streak, 700);
        row.append(rank, main, val);
        list.appendChild(row);
      });
    }catch(e){
      console.warn('[SQ] Streak League dependency missing or failed', e);
      list.innerHTML = '<p class="tag">Streak League data is not available yet. Required Supabase view/data source is missing or empty.</p>';
      controls.querySelectorAll('button').forEach(b => { b.disabled = true; });
    }
  }

  metricTabs.onclick = e => {
    const b = e.target && e.target.closest ? e.target.closest('button[data-metric]') : null;
    if (!b || b.disabled) return;
    metric = b.dataset.metric;
    render();
  };
  modeTabs.onclick = e => {
    const b = e.target && e.target.closest ? e.target.closest('button[data-mode]') : null;
    if (!b || b.disabled) return;
    mode = b.dataset.mode;
    render();
  };
  back.onclick = () => { overlay.remove(); try{ if (typeof window.openLeagueRankingsDialog === 'function') window.openLeagueRankingsDialog(); }catch(_){} };
  close.onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  modal.tabIndex = 0;
  modal.focus();
  await render();
};

// === Power Rankings — official only (hard cap + min sample; grey-out unqualified) ===
window.openPowerLeagueDialog = async function openPowerLeagueDialog(){
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal   = document.createElement('div'); modal.className   = 'modal sq-wide-modal';
  modal.style.maxWidth = '980px';
  modal.style.width = '94vw';
  modal.style.maxHeight = '90vh';
  modal.style.overflow = 'hidden';

  // Config
  const LIMIT = 56;                 // 4 games (14 rounds each)
  const MIN_ROUNDS_CURRENT = 28;    // threshold for "qualified" status (Current)
  const DAYS_ACTIVE = 14;           // player removed if no official rounds in last N days (Current)
  const MIN_ROUNDS_ALLTIME = LIMIT; // All Time ranks require a full 56-round window

  let view = 'current';

  const head = document.createElement('div'); head.className = 'modal-header';
  head.style.display='flex'; head.style.alignItems='center'; head.style.justifyContent='space-between'; head.style.gap='12px';
  const titleWrap = document.createElement('div'); titleWrap.className = 'pr-modal-titlewrap';
  const title = document.createElement('h3'); title.textContent = 'Power Rankings — Last ' + LIMIT + ' Rounds (Official)';
  titleWrap.appendChild(title);

  const tog = document.createElement('div'); tog.className = 'segmented';
  tog.style.display='flex'; tog.style.gap='8px';
  const btnCur = document.createElement('button'); btnCur.type='button'; btnCur.textContent='Current';
  const btnAll = document.createElement('button'); btnAll.type='button'; btnAll.textContent='All Time';
  tog.append(btnCur, btnAll);

  // Segmented styling (matches Latest Scores)
  [btnCur, btnAll].forEach(b=>{
    b.className = 'seg-btn';
    b.style.padding='8px 12px';
    b.style.borderRadius='999px';
    b.style.border='1px solid rgba(255,255,255,.14)';
    b.style.background='rgba(10,12,24,.55)';
    b.style.color='rgba(255,255,255,.85)';
    b.style.fontWeight='800';
  });

  head.append(titleWrap, tog);

  const body    = document.createElement('div'); body.className    = 'modal-body';
  const footer  = document.createElement('div'); footer.className  = 'modal-footer';

  // Footer buttons
  const backBtn  = document.createElement('button');
  backBtn.className  = 'btn sq-pill';
  backBtn.textContent  = 'Back';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn sq-pill';
  closeBtn.textContent = 'Close';

  backBtn.onclick  = () => {
    overlay.remove();
    if (typeof window.openLeagueRankingsDialog === 'function') {
      window.openLeagueRankingsDialog();
    }
  };
  closeBtn.onclick = () => overlay.remove();
  footer.append(backBtn, closeBtn);

  modal.append(head, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0;
  modal.focus();

  function setView(v){
    view = v;
    btnCur.classList.toggle('active', view==='current');
    btnAll.classList.toggle('active', view==='alltime');

    // Active pill styling (orange edge)
    const activeBorder = '1px solid rgba(255,138,0,.85)';
    const activeBg = 'rgba(255,138,0,.14)';
    const inactiveBorder = '1px solid rgba(255,255,255,.14)';
    const inactiveBg = 'rgba(10,12,24,.55)';
    btnCur.style.border = (view==='current') ? activeBorder : inactiveBorder;
    btnCur.style.background = (view==='current') ? activeBg : inactiveBg;
    btnCur.style.color = (view==='current') ? '#ff8a00' : 'rgba(255,255,255,.85)';
    btnAll.style.border = (view==='alltime') ? activeBorder : inactiveBorder;
    btnAll.style.background = (view==='alltime') ? activeBg : inactiveBg;
    btnAll.style.color = (view==='alltime') ? '#ff8a00' : 'rgba(255,255,255,.85)';
    title.textContent = (view==='current')
      ? ('Power Rankings — Last ' + LIMIT + ' Rounds (Official)')
      : ('Power Rankings — All Time Best ' + LIMIT + ' (Official)');
  }

  btnCur.onclick = () => { setView('current'); render(); };
  btnAll.onclick = () => { setView('alltime'); render(); };

async function computePowerLeagueRows(which){
  which = which || 'current';
  // Guard cloud
  try { if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) throw new Error('Cloud not initialised'); } catch(_) {}

if (typeof sb === 'undefined'
    || typeof TABLE_GAMES === 'undefined'
    || typeof TABLE_GAME_THROWS === 'undefined'
    || typeof TABLE_PLAYER_GAMES === 'undefined') {
  throw new Error('Cloud tables not configured');
}

  // === DB truth path (fixes 11-round undercount): use clean official Power Rankings view ===
  if (which === 'current') {
    const VIEW = 'v_power_rankings_last56_official_clean';
    // Saved players (case-insensitive). If empty, return [] (UI will say none).
    let saved = [];
    try { if (typeof cloudListPlayers === 'function') saved = await cloudListPlayers(); } catch(_){}
    const savedSet = new Set((saved||[]).map(p=>String(p?.name||'').trim().toLowerCase()).filter(Boolean));
    const canonical = new Map((saved||[]).map(p=>[String(p?.name||'').trim().toLowerCase(), String(p?.name||'')]));

    // If we have a saved list, filter to it. If not, still show nothing (per your app rules).
    if (!savedSet.size) return [];

    const { data, error } = await sb
      .from(VIEW)
      .select('player, rounds_used, total_points, avg_per_round, last_played_at')
      .order('avg_per_round', { ascending: false })
      .limit(500);

    if (error) throw error;

    // Use the same timestamp parser as elsewhere if available
    const _parseMs = (ts) => {
      try { return (typeof window.parseMs === 'function') ? window.parseMs(ts) : Date.parse(String(ts)); } catch(_) { return 0; }
    };

    const nowMs = Date.now();
    const inactiveMs = DAYS_ACTIVE * 24 * 60 * 60 * 1000;

    const rows = (data||[])
      .map(r=>{
        const lc = String(r.player||'').trim().toLowerCase();
        if (!savedSet.has(lc)) return null;

        const name = canonical.get(lc) || String(r.player||'').trim();
        const rounds = Math.max(0, Math.min(LIMIT, Number(r.rounds_used||0)));

        const tp = Number(r.total_points ?? NaN);
        const avg = (Number.isFinite(tp) && rounds>0) ? (tp / rounds) : Number(r.avg_per_round||0);

        const recentMs = r.last_played_at ? _parseMs(r.last_played_at) : 0;
        const qualifies = (rounds >= MIN_ROUNDS_CURRENT) && (!recentMs || recentMs >= (nowMs - inactiveMs));
        const inactive = (rounds >= MIN_ROUNDS_CURRENT) && (!!recentMs) && (recentMs < (nowMs - inactiveMs));

        return { name, rounds, avg, qualifies, inactive };
      })
      .filter(Boolean)
      .sort((a,b)=>
        (b.avg - a.avg) ||
        (b.rounds - a.rounds) ||
        String(a.name).localeCompare(String(b.name))
      );

    return rows;
  }

  // Robust timestamp parsing (Safari is strict; Supabase often returns: "YYYY-MM-DD HH:MM:SS.sss+00")
  const parseMs = (ts) => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    let s = String(ts).trim();
    // "2026-01-18 13:53:52.437+00" -> "2026-01-18T13:53:52.437+00:00"
    if (/^\d{4}-\d{2}-\d{2}\s/.test(s) && !s.includes('T')) s = s.replace(' ', 'T');
    // Add missing minutes in offset: "+00" -> "+00:00", "-05" -> "-05:00"
    if (/[+-]\d{2}$/.test(s)) s = s + ':00';
    // Insert colon in offset: "+0000" -> "+00:00"
    if (/[+-]\d{4}$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    let ms = Date.parse(s);
    if (!Number.isFinite(ms)) {
      // Last-ditch: treat as UTC if it looks like an ISO datetime without zone.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) ms = Date.parse(s + 'Z');
    }
    return Number.isFinite(ms) ? ms : 0;
  };

  // Saved players (case-insensitive)
  let saved = [];
  try { if (typeof cloudListPlayers === 'function') saved = await cloudListPlayers(); } catch(_){}
  const savedSet = new Set(
    (saved || []).map(p => (p && p.name ? String(p.name).trim().toLowerCase() : '')).filter(Boolean)
  );
  const canonical = new Map((saved || []).map(p => [String(p.name).trim().toLowerCase(), String(p.name)]));

  // 1) Fetch OFFICIAL games (2+ players), oldest → newest
  let gameRows = [];
  try{
    const { data, error } = await sb
      .from(TABLE_GAMES)
      .select('id, created_at, state')
      .order('created_at', { ascending: true })
      .limit(5000);
    if (error) throw error;
    gameRows = (data || []).filter(g => Array.isArray(g?.state?.players) && g.state.players.length >= 2);
  } catch(e){
    console.error('Power Rankings: fetch games failed', e);
    throw new Error('Failed to fetch games for Power League');
  }

  if (!gameRows.length) return [];

  const gameMeta = new Map(); // id -> { ts, players:[{name}] }
  const officialIds = [];
  for (const g of gameRows){
    if (g?.id == null) continue;
    officialIds.push(g.id);
    const players = (g?.state?.players || []).map(p => (typeof p === 'string' ? { name: p } : p));
    gameMeta.set(g.id, { ts: g.created_at || null, players });
  }

// 2) Build ROUNDS list, prefer THROWS; fallback to PLAYER_GAMES

// Helper: fetch throws in small chunks to avoid URL length / IN() limits
async function fetchThrowsForGamesChunked(ids, chunkSize = 200){
  if (!FEATURE_CLOUD_THROWS || cloudIsTableMissing(TABLE_GAME_THROWS)) return [];
  const all = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data, error } = await sb
      .from(TABLE_GAME_THROWS)
      .select('game_id, player, round_index, dart_index, points, kind')
      .in('game_id', slice)
      .order('game_id',   { ascending: true })
      .order('round_index',{ ascending: true })
      .order('dart_index',{ ascending: true });
    if (error) throw error;
    all.push(...(data || []));
  }
  return all;
}

let roundsList = [];

// Try THROWS first
try {
  const throwsRows = await fetchThrowsForGamesChunked(officialIds);

  if (throwsRows.length) {
    // Group throws → rounds
    const byRoundKey = new Map();
    for (const t of throwsRows){
      const plc = String(t?.player || '').trim().toLowerCase();
      if (savedSet.size && !savedSet.has(plc)) continue;

      const ridx = (typeof t.round_index === 'number') ? t.round_index : null;
      if (ridx == null || ridx < 0 || ridx > 13) continue; // 10..20, D, T, B

      const key = `${t.game_id}|${plc}|${ridx}`;
      let rec = byRoundKey.get(key);
      if (!rec){
        const gm = gameMeta.get(t.game_id) || {};
        const proper = canonical.get(plc) || t.player || '';
        rec = { gid: t.game_id, ts: gm.ts || null, name: proper, playerLC: plc, ridx, total: 0 };
        byRoundKey.set(key, rec);
      }
      rec.total += Number(t.points || 0); // includes D/T/B naturally
    }

    roundsList = Array.from(byRoundKey.values());
  }
} catch (e) {
  console.error('Power Rankings: throws fetch failed (will fallback)', e);
}

// Fallback: build approximate rounds from player_games if no throws
if (!roundsList.length) {
  try {
    const { data, error } = await sb
      .from(TABLE_PLAYER_GAMES)
      .select('player, score, rounds, ts, is_practice')
      .or('is_practice.is.null,is_practice.eq.false')
      .order('ts', { ascending: true })
      .limit(20000);
    if (error) throw error;

    const pgRows = data || [];
    for (const r of pgRows){
      const name = String(r.player || '').trim();
      if (!name) continue;
      const plc = name.toLowerCase();
      if (savedSet.size && !savedSet.has(plc)) continue;

      let rounds = Number(r.rounds || 0);
      const score = Number(r.score || 0);
      if (!Number.isFinite(score)) continue;

      // Treat a full game as 14 rounds (11 + D + T + B)
      if (rounds >= 11) rounds = Math.min(14, rounds + 3);
      if (rounds <= 0) continue;

      const perRound = score / rounds;
      for (let i = 0; i < rounds; i++){
        roundsList.push({
          gid: null,
          ts: r.ts || null,
          name,
          playerLC: plc,
          ridx: i,
          total: perRound
        });
      }
    }
  } catch (e) {
    console.error('Power Rankings: fallback player_games fetch failed', e);
    // keep roundsList empty → UI will show the "No official games..." message later
  }
}

if (!roundsList.length) return []; // nothing to compute

 // 4) Chronologically order rounds (oldest → newest)
roundsList.sort((a, b) => {
  const ta = a.ts ? parseMs(a.ts) : 0;
  const tb = b.ts ? parseMs(b.ts) : 0;
  if (ta !== tb) return ta - tb;
  if (a.gid !== b.gid) return (a.gid < b.gid ? -1 : 1);
  return a.ridx - b.ridx;
});

  // 5) Build per-player rolling window of LAST 50 ROUNDS
  const byPlayer = new Map(); // nameLC -> { name, buf:number[], lastTs }
  for (const r of roundsList){
    const key = r.playerLC;
    let rec = byPlayer.get(key);
    if (!rec){
      rec = { name: r.name, all: [], tsAll: [], lastTs: null };
      byPlayer.set(key, rec);
    }
    rec.all.push(Number(r.total || 0));
    rec.tsAll.push(r.ts || null);
    if (r.ts) rec.lastTs = r.ts;
  }

  // 6) Compute outputs
  const out = [];
  const cutoffMs = Date.now() - (DAYS_ACTIVE * 24 * 60 * 60 * 1000);
  
  // Helper: best (max) average over any contiguous window of size win (or best available if fewer rounds)
  const bestWindow = (arr, tsArr, win) => {
    const n = arr.length;
    if (!n) return { avg: 0, used: 0, ts: null };
    const w = Math.max(1, Math.min(win, n));
    if (n <= w){
      const s = arr.reduce((a,b)=>a+b,0);
      return { avg: s / n, used: n, ts: (tsArr && tsArr.length) ? (tsArr[n-1] || null) : null };
    }
    let sum = 0;
    for (let i=0;i<w;i++) sum += arr[i];
    let bestSum = sum;
    let bestEnd = w-1;
    for (let i=w;i<n;i++){
      sum += arr[i] - arr[i-w];
      if (sum > bestSum){
        bestSum = sum;
        bestEnd = i;
      }
    }
    const bestTs = (tsArr && tsArr.length) ? (tsArr[bestEnd] || null) : null;
    return { avg: bestSum / w, used: w, ts: bestTs };
  };

for (const [key, rec] of byPlayer){
    const all = rec.all || [];
    const tsAll = rec.tsAll || [];
    if (!all.length) continue;

    const lastTs = rec.lastTs || null;
    const lastMs = lastTs ? parseMs(lastTs) : 0;

    if (which === 'current'){
      const recent = all.slice(-LIMIT);
      const count = recent.length;
      if (count <= 0) continue;

      const total = recent.reduce((s,v)=>s+v,0);
      const avg   = total / count;

      const inactive = (!lastMs) || (lastMs < cutoffMs);
      const qualifiesBase = count >= MIN_ROUNDS_CURRENT;
      const qualifies = qualifiesBase && !inactive;

      const name = canonical.get(key) || rec.name || '—';
      out.push({ name, rounds: count, avg, ts: lastTs, qualifies, inactive, qualifiesBase });
    } else {
      const bw = bestWindow(all, tsAll, LIMIT);
      const inactive = false;
      const qualifiesBase = all.length >= MIN_ROUNDS_ALLTIME;
      const qualifies = qualifiesBase;

      const name = canonical.get(key) || rec.name || '—';
      out.push({ name, rounds: bw.used, avg: bw.avg, ts: bw.ts || lastTs, qualifies, inactive, qualifiesBase, totalRounds: all.length });
    }
  }

  // 7) Sort: qualified first (ranked), then unqualified (grey/unranked)
  out.sort((a, b) => {
    if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
    if (b.avg !== a.avg) return b.avg - a.avg;
    if ((b.rounds || 0) !== (a.rounds || 0)) return (b.rounds || 0) - (a.rounds || 0);
    const ta = a.ts ? parseMs(a.ts) : 0;
    const tb = b.ts ? parseMs(b.ts) : 0;
    if (tb !== ta) return tb - ta;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return out;
}

async function render(){
    body.innerHTML = '<p class="tag">Loading Power Rankings…</p>';

    let rows = [];
    try {
      rows = await computePowerLeagueRows(view);
    } catch (e) {
      console.error(e);
      body.innerHTML = `<p>${(e && e.message) ? e.message : 'Failed to load Power League.'}</p>`;
      return;
    }

    if (!rows.length) {
      body.innerHTML = '<p>No official games found for any saved players yet.</p>';
      return;
    }

    const note = document.createElement('p');
    note.className = 'tag';
    if (rows.some(r => !r.qualifies)) {
      note.textContent = (view==='current')
        ? `Current uses the last ${LIMIT} official rounds (≈4 games). Players with fewer than ${MIN_ROUNDS_CURRENT} rounds (2 games), or no official rounds in the last ${DAYS_ACTIVE} days, are greyed out and unranked.`
        : `All Time shows each player's best ${LIMIT}-round average (official). Players with fewer than ${MIN_ROUNDS_ALLTIME} rounds are greyed out and unranked.`;
      body.innerHTML = '';
      body.appendChild(note);
    } else {
      body.innerHTML = '';
    }

    const table = document.createElement('table');
    table.className = 'hs-table';

    const thead = document.createElement('thead');
    const trh   = document.createElement('tr');
    ['#','Player',(view==='current'?`Rounds (up to ${LIMIT})`:`Best Window (${LIMIT})`),'Avg / Round'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    
    // -- rank change arrows: visual-only memory snapshot, never localStorage authority --
const LS_KEY = (view==='current') ? 'powerRankings.current.lastRanks' : 'powerRankings.allTime.lastRanks'; // legacy key name retained only for labels
window.__sqPowerRankVisualSnapshots = window.__sqPowerRankVisualSnapshots || {};
let prevRanks = new Map();
try {
  const snap = window.__sqPowerRankVisualSnapshots[view];
  if (snap && snap.ranks && typeof snap.ranks === 'object') {
    prevRanks = new Map(Object.entries(snap.ranks)); // nameLC -> rank (1-based)
  }
} catch (_) {}

    const tbody = document.createElement('tbody');

// rank only qualified rows
let rankCounter = 0;
const currRanksObj = {}; // nameLC -> rank

rows.forEach((row) => {
  const tr = document.createElement('tr');

  // Grey-out (and unrank) unqualified rows
  const unq = !row.qualifies;
  if (unq) {
    tr.classList.add('muted');
    tr.style.opacity = '0.6';
    const need = (view==='current')
    ? Math.max(0, MIN_ROUNDS_CURRENT - (row.rounds || 0))
    : Math.max(0, MIN_ROUNDS_ALLTIME - (row.totalRounds || 0));
    if (row.inactive) {
      tr.title = need
        ? `Inactive (no official rounds in last 14 days) • Needs ${need} more round${need===1?'':'s'} to qualify`
        : 'Inactive (no official rounds in last 14 days)';
    } else {
      tr.title = need ? `Needs ${need} more round${need===1?'':'s'} to qualify` : (view==='current' ? `Below ${MIN_ROUNDS_CURRENT} rounds` : `Below ${MIN_ROUNDS_ALLTIME} rounds`);
    }
  }

  // Determine current rank (qualified only)
  const currentRank = unq ? null : (++rankCounter);

  const tdRank   = document.createElement('td');
  tdRank.textContent = unq ? '—' : String(currentRank);
  if (!unq) tdRank.style.color = '#ff8a00';
  tdRank.style.fontWeight='800';

  const tdName   = document.createElement('td');
  tdName.textContent = row.name || '—';

  // Append green/red arrow if rank changed since last snapshot
  const keyLC = String(row.name || '').trim().toLowerCase();
  if (!unq && keyLC) {
    const prev = prevRanks.get(keyLC);
    if (typeof prev === 'number' && Number.isFinite(prev) && prev !== currentRank) {
      const up = prev > currentRank; // improved if current rank number is smaller
      const arrow = document.createElement('span');
      arrow.textContent = up ? '▲' : '▼';
      arrow.style.marginLeft = '6px';
      arrow.style.color = up ? '#7fffd4' : '#ff6b6b';
      arrow.title = up ? `Up ${prev - currentRank}` : `Down ${currentRank - prev}`;
      tdName.appendChild(arrow);
    }
    // record current rank for persistence
    currRanksObj[keyLC] = currentRank;
  }

  const tdRounds = document.createElement('td'); tdRounds.textContent = String(row.rounds); // capped count
  const tdAvg    = document.createElement('td'); tdAvg.textContent    = (Number(row.avg)||0).toFixed(2);

  tr.append(tdRank, tdName, tdRounds, tdAvg);
  tbody.appendChild(tr);
});

    table.appendChild(tbody);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);

// Persist current ranks snapshot in memory only for next comparison while this app session is open.
try {
  window.__sqPowerRankVisualSnapshots = window.__sqPowerRankVisualSnapshots || {};
  window.__sqPowerRankVisualSnapshots[view] = {
    ts: new Date().toISOString(),
    ranks: currRanksObj
  };
} catch (_) {}

    body.appendChild(wrap);
  }

  setView('current');
  render();
};

// Premier League popup – average match total per player, with month filters
// ===== @JS:MODAL:PREMIER_LEAGUE =====
window.openPremierLeagueDialog = async function openPremierLeagueDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal sq-wide-modal';

  const title = document.createElement('h3');
  title.textContent = 'Premier League';

  const body = document.createElement('div');
  body.className = 'modal-body';
  
  // Lock outer modal — let only the inner table scroll
modal.style.maxHeight = '90vh';
modal.style.overflow = 'hidden';
body.style.maxHeight = 'none';
body.style.overflowY = 'visible';

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  // Filter rows + table mount
  const filterWrap = document.createElement('div');
  filterWrap.className = 'pl-filters';
  filterWrap.style.display = 'flex';
  filterWrap.style.flexDirection = 'column';
  filterWrap.style.gap = '6px';
  filterWrap.style.marginBottom = '8px';

  const filterRowRecords = document.createElement('div');
  const filterRowToday   = document.createElement('div');
  const filterRowMonths  = document.createElement('div');
  const filterRowAllYrs  = document.createElement('div');

  [filterRowRecords, filterRowToday, filterRowMonths, filterRowAllYrs].forEach(r => {
    r.className = 'row';
    r.style.display = 'flex';
    r.style.flexWrap = 'wrap';
    r.style.gap = '8px';
    r.style.alignItems = 'center';
  });

  filterWrap.appendChild(filterRowRecords); // Line 1: RECORDS
  filterWrap.appendChild(filterRowToday);   // Line 2: TODAY
  filterWrap.appendChild(filterRowMonths);  // Line 3: Months
  filterWrap.appendChild(filterRowAllYrs);  // Line 4: ALL TIME + Years

  const tableMount = document.createElement('div');
  tableMount.className = 'table-wrap';

  body.appendChild(filterWrap);
  body.appendChild(tableMount);

  // Footer buttons
  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn sq-pill';
  closeBtn.textContent = 'Close';

  backBtn.onclick = () => {
    overlay.remove();
    if (typeof window.openLeagueRankingsDialog === 'function') {
      window.openLeagueRankingsDialog();
    }
  };

  closeBtn.onclick = () => {
    overlay.remove();
  };

  footer.append(backBtn, closeBtn);

  modal.append(title, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  });

  modal.tabIndex = 0;
  modal.focus();

  // --- Data helpers ---

  // Request sequencing prevents stale responses from overwriting the table (e.g., rapid pill taps)
  let __plReqSeq = 0;

  // Local helpers (avoid reliance on global util ordering)
  function __plEsc(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function __plWithTimeout(p, ms){
    const toMs = Math.max(0, Number(ms) || 0);
    if (!toMs) return Promise.resolve(p);
    return Promise.race([
      Promise.resolve(p),
      new Promise((_, rej)=> setTimeout(()=> rej(new Error('Timeout after ' + toMs + 'ms')), toMs))
    ]);
  }

  const __plCanonicalRowsCache = {
    rows: null,
    promise: null
  };

  function __plSafeLower(v){
    return String(v ?? '').trim().toLowerCase();
  }

  function __plTsMs(v){
    const ms = parseMs(v);
    return Number.isFinite(ms) ? ms : Date.parse(v || '');
  }

  async function __plListSavedPlayerSet(){
    let savedSet = null;
    try {
      if (typeof cloudListPlayers === 'function') {
        const saved = await cloudListPlayers();
        savedSet = new Set((saved || [])
          .map(p => __plSafeLower(p && p.name ? p.name : ''))
          .filter(Boolean)
        );
      }
    } catch (_) {}
    window.__llsSavedSet = savedSet;
    return savedSet;
  }

  function __plRowsFromGames(games){
    const out = [];
    (games || []).forEach(g => {
      const ng = (typeof __normalizeGame === 'function') ? __normalizeGame(g) : g;
      const players = Array.isArray(ng?.players) ? ng.players : [];
      const totals  = Array.isArray(ng?.totals)  ? ng.totals  : [];
      const ts = ng?.ts || __gameTs(ng?.raw || ng) || null;
      const totalPlayers = players.length;
      if (!totalPlayers || totalPlayers < 2) return;
      players.forEach((player, idx) => {
        const name = String(player || '').trim();
        const score = Number(totals[idx] || 0);
        if (!name || !Number.isFinite(score)) return;
        out.push({
          player: name,
          score,
          ts,
          is_practice: false,
          total_players: totalPlayers
        });
      });
    });
    return out;
  }

  async function __plLoadCanonicalRows(forceRefresh){
    if (!forceRefresh && Array.isArray(__plCanonicalRowsCache.rows)) return __plCanonicalRowsCache.rows;
    if (!forceRefresh && __plCanonicalRowsCache.promise) return __plCanonicalRowsCache.promise;

    __plCanonicalRowsCache.promise = (async () => {
      const merged = [];
      const tableName =
        (typeof TABLE_PLAYER_GAMES !== 'undefined' && TABLE_PLAYER_GAMES)
          ? TABLE_PLAYER_GAMES
          : 'player_games_union';

      try {
        const { data, error } = await sb
          .from(tableName)
          .select('player, score, ts, is_practice, total_players')
          .order('ts', { ascending: true })
          .limit(50000);
        if (error) throw error;
        merged.push(...(data || []));
      } catch (e) {
        console.warn('Premier League: player_games_union load failed, falling back to games-derived rows.', e);
      }

      try {
        const games = (typeof __fetchOfficialGames === 'function') ? await __fetchOfficialGames(50000) : [];
        merged.push(...__plRowsFromGames(games));
      } catch (e) {
        console.warn('Premier League: official games fallback load failed.', e);
      }

      const seen = new Map();
      merged.forEach(r => {
        if (!r) return;
        const name = String(r.player || '').trim();
        const score = Number(r.score || 0);
        if (!name || !Number.isFinite(score)) return;
        if (r.is_practice === true) return;
        const tp = Number(r.total_players || 0);
        if (Number.isFinite(tp) && tp > 0 && tp < 2) return;

        const ms = __plTsMs(r.ts);
        const key = `${__plSafeLower(name)}|${score}|${Number.isFinite(ms) ? ms : String(r.ts || '')}`;
        const prev = seen.get(key);
        if (!prev) {
          seen.set(key, {
            player: name,
            score,
            ts: r.ts || null,
            is_practice: false,
            total_players: Number.isFinite(tp) ? tp : null
          });
          return;
        }

        if (!prev.ts && r.ts) prev.ts = r.ts;
        const prevTp = Number(prev.total_players || 0);
        if ((!prevTp || prevTp < 2) && Number.isFinite(tp) && tp >= 2) prev.total_players = tp;
      });

      const out = Array.from(seen.values()).sort((a,b) => (__plTsMs(a.ts) || 0) - (__plTsMs(b.ts) || 0));
      __plCanonicalRowsCache.rows = out;
      __plCanonicalRowsCache.promise = null;
      return out;
    })();

    try {
      return await __plCanonicalRowsCache.promise;
    } catch (e) {
      __plCanonicalRowsCache.promise = null;
      throw e;
    }
  }

  async function fetchRows(activeFilter) {
    try {
      if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) {
        tableMount.innerHTML = '<p>Cloud not initialised.</p>';
        return [];
      }
    } catch (_) {}

    tableMount.innerHTML = '<p class="tag">Loading Premier League…</p>';

    try {
      const [allRows, savedSet] = await Promise.all([
        __plLoadCanonicalRows(false),
        __plListSavedPlayerSet()
      ]);

      if (!savedSet || savedSet.size === 0) {
        tableMount.innerHTML = '<p>No saved players found. Add players in Player Hub first.</p>';
        return [];
      }

      let rows = (allRows || []).filter(r => {
        if (!r || !r.player) return false;
        const nameLC = __plSafeLower(r.player);
        if (!nameLC || !savedSet.has(nameLC)) return false;
        if (r.is_practice === true) return false;
        const tp = Number(r.total_players || 0);
        if (Number.isFinite(tp) && tp > 0 && tp < 2) return false;
        return true;
      });

      if (activeFilter && activeFilter.id && activeFilter.id !== 'ALL' && activeFilter.id !== 'RECORDS' && typeof activeFilter.match === 'function') {
        rows = rows.filter(r => {
          try { return !!activeFilter.match(r.ts); } catch (_) { return false; }
        });
      }

      return rows;
    } catch (e) {
      console.error('Premier League fetch failed', e);
      tableMount.innerHTML = '<p class="tag">Failed to load Premier League.</p><pre style="white-space:pre-wrap;opacity:.7;font-size:.75rem;margin-top:8px;">'+ (e && (e.message||e.details||e.hint) ? (e.message||e.details||e.hint) : '') +'</pre>';
      return [];
    }
  }

  function buildFilters() {
    const filters = [];

    const now = new Date();

    // RECORDS
    filters.push({
      id: 'RECORDS',
      label: 'RECORDS',
      match: () => true
    });

    // TODAY (local timezone)
    filters.push({
      id: 'TODAY',
      label: 'TODAY',
      match: (ts) => {
        const ms = parseMs(ts);
        if (!Number.isFinite(ms)) return false;
        const dt = new Date(ms);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return dt >= start && dt < end;
      }
    });

    // YESTERDAY (local timezone)
    filters.push({
      id: 'YESTERDAY',
      label: 'YESTERDAY',
      match: (ts) => {
        const ms = parseMs(ts);
        if (!Number.isFinite(ms)) return false;
        const dt = new Date(ms);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return dt >= start && dt < end;
      }
    });

    // THIS WEEK (Mon 00:00 → next Mon 00:00, local timezone)
    filters.push({
      id: 'THIS_WEEK',
      label: 'THIS WEEK',
      match: (ts) => {
        const ms = parseMs(ts);
        if (!Number.isFinite(ms)) return false;
        const dt = new Date(ms);
        const dow = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return dt >= start && dt < end;
      }
    });

    // Recent months (most recent first)
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString('en-GB', { month: 'short' }).toUpperCase();

      filters.push({
        id: `M${year}-${String(month + 1).padStart(2,'0')}`,
        label,
        match: (ts) => {
          const ms = parseMs(ts);
          if (!Number.isFinite(ms)) return false;
          const dt = new Date(ms);
          return dt.getFullYear() === year && dt.getMonth() === month;
        }
      });
    }

    // Line 4: ALL TIME + explicit year buttons (newest first)
    filters.push({
      id: 'ALL',
      label: 'ALL',
      match: () => true
    });

    // Years (explicit)
    [2026, 2025].forEach(y => {
      filters.push({
        id: `Y${y}`,
        label: String(y),
        match: (ts) => {
          const ms = parseMs(ts);
          if (!Number.isFinite(ms)) return false;
          const dt = new Date(ms);
          return dt.getFullYear() === y;
        }
      });
    });

    return filters;
  }

  function renderFilters(filters, onChange) {

    // Clear each line
    [filterRowRecords, filterRowToday, filterRowMonths, filterRowAllYrs].forEach(r => r.innerHTML = '');

    const buttons = [];

    const hostFor = (f) => {
      if (f.id === 'RECORDS') return filterRowRecords;              // Line 1
      if (f.id === 'TODAY' || f.id === 'YESTERDAY' || f.id === 'THIS_WEEK')   return filterRowToday;                // Line 2
      if (f.id === 'ALL')     return filterRowAllYrs;                // Line 4
      if (/^Y\d{4}$/.test(f.id)) return filterRowAllYrs;            // Line 4 (years)
      return filterRowMonths;                                        // Line 3 (months)
    };

    filters.forEach((f) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn small';
      btn.textContent = (f.id === 'ALL') ? 'ALL' : f.label;
      btn.dataset.filterId = f.id;
      if (f.id !== 'RECORDS') { btn.style.minWidth = '92px'; btn.style.textAlign = 'center'; }

      hostFor(f).appendChild(btn);
      buttons.push(btn);

      btn.onclick = () => {
                buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(f);
      };
    });

    // Default highlight: ALL TIME
    const allBtn = buttons.find(b => b.dataset.filterId === 'ALL');
    if (allBtn) allBtn.classList.add('active');
  }

function renderRecords(rows){
  // Clear host
  tableMount.innerHTML = '';

// Records thresholds (RECORDS only)
const MIN_MONTHLY_GAMES = 3;
const MIN_ALLTIME_GAMES = 15; // Highest All Time Averages require 15+ games
const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  // small helper
  const monthLabel = (ts)=>{
    const ms = parseMs(ts);
    const d = Number.isFinite(ms) ? new Date(ms) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { month:'short', year:'numeric' }).toUpperCase();
  };

  // ---------- Highest Score (top 3 distinct) ----------
  const topBest = (() => {
    const ordered = (rows || [])
      .map(r => ({ name: String(r.player||'').trim(), score: Number(r.score||0), ts: r.ts }))
      .filter(x => x.name && Number.isFinite(x.score))
      .sort((a,b) => (b.score - a.score) || ((parseMs(a.ts) || 0) - (parseMs(b.ts) || 0)));
    const seen = new Set(); const out = [];
    for (const r of ordered){
      if (!seen.has(r.score)) { seen.add(r.score); out.push(r); }
      if (out.length === 3) break;
    }
    return out;
  })();

  // ---------- Highest Monthly Average (top 3 distinct) ----------
  const topMonthlyAvg = (() => {
    const agg = new Map(); // key: name|YYYY-M -> {total,games,tsAny}
    rows.forEach(r=>{
      const name = String(r.player||'').trim();
      const d = r.ts ? new Date(r.ts) : null;
      if (!name || !d || Number.isNaN(d.getTime())) return;
      const key = `${name}|${d.getFullYear()}-${d.getMonth()}`;
      const a = agg.get(key) || { total:0, games:0, ts:r.ts };
      a.total += Number(r.score||0); a.games += 1; if (!a.ts) a.ts = r.ts;
      agg.set(key, a);
    });
  let rowsM = [];
  agg.forEach((v, key)=>{
    const [name, ym] = key.split('|');
    const avg = v.games ? v.total / v.games : 0;
    rowsM.push({ name, avg, ts: v.ts, ym, games: v.games });
  });

  // Require at least 3 games in that month
  rowsM = rowsM.filter(r => (r.games || 0) >= MIN_MONTHLY_GAMES);

  rowsM.sort((a,b)=> (b.avg - a.avg) || ((parseMs(a.ts) || 0) - (parseMs(b.ts) || 0)));
  const seen = new Set(); const out = [];
  for (const r of rowsM){
    const k = r.avg.toFixed(3);
    if (!seen.has(k)) { seen.add(k); out.push(r); }
    if (out.length === 3) break;
  }
  return out;
})();
  
// ---------- Highest All Time Averages (top 3 distinct) ----------
const topCareerAvg = (() => {
  const agg = new Map(); // name -> { total, games, ts }

  (rows || []).forEach(r => {
    const name = String(r.player || '').trim();
    const sc = Number(r.score || 0);
    if (!name || !Number.isFinite(sc)) return;

    const ts = r.ts || r.created_at || r.inserted_at || null;
    const a = agg.get(name) || { total: 0, games: 0, firstTs: null, lastTs: null };

    a.total += sc;
    a.games += 1;

    if (!a.firstTs || (ts && new Date(ts) < new Date(a.firstTs))) a.firstTs = ts;
    if (!a.lastTs  || (ts && new Date(ts) > new Date(a.lastTs)))  a.lastTs  = ts;

    agg.set(name, a);
  });

 let list = [];
   agg.forEach((v, name) => {
    const avg = v.games ? v.total / v.games : 0;
      list.push({ name, avg, ts: v.lastTs, games: v.games });

  });
  // Require at least 5 career games
  list = list.filter(r => (r.games || 0) >= MIN_ALLTIME_GAMES);

  // Sort by avg desc, then by earliest ts (stable)
  list.sort((a, b) => (b.avg - a.avg) || ((parseMs(a.ts) || 0) - (parseMs(b.ts) || 0)));

  // Take top 3 distinct averages (treat near-equals as same)
  const seen = new Set(); const out = [];
  for (const r of list) {
    const k = r.avg.toFixed(3);
    if (!seen.has(k)) { seen.add(k); out.push(r); }
    if (out.length === 3) break;
  }
  return out;
})();

function section(title, rows, valueFmt, showMonth, noteText){
  const h = document.createElement('h4');
  h.textContent = title;
  h.style.margin = '8px 0 6px';
  wrap.appendChild(h);
  if (noteText) {
      const p = document.createElement('p');
      p.className = 'tag';
      p.textContent = noteText;
      p.style.marginTop = '0';
      p.style.marginBottom = '6px';
      wrap.appendChild(p);
    }

    const table = document.createElement('table');
    table.className = 'hs-table';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['#','Player','Score','Month'].forEach((t,i)=>{
      const th = document.createElement('th'); th.textContent = t;
      trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');

    rows.forEach((r, i)=>{
      const tr = document.createElement('tr');
      const tdRank  = document.createElement('td'); tdRank.textContent  = String(i+1);
      const tdName  = document.createElement('td'); tdName.textContent  = r.name;
      const tdScore = document.createElement('td'); tdScore.textContent = valueFmt(r);
      const tdMonth = document.createElement('td'); tdMonth.textContent = showMonth ? monthLabel(r.ts) : '';
      tr.append(tdRank, tdName, tdScore, tdMonth);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  section('Highest Score',
    topBest,
    r => String(r.score),
    true
  );

  section('Highest Monthly Average',
    topMonthlyAvg,
    r => (Number(r.avg)||0).toFixed(1),
    true
  );

section('Highest All Time Averages',
  topCareerAvg,
  r => (Number(r.avg)||0).toFixed(1),
  true,
  'Minimum 15 Games played'
);
  
    // Scroll only inside records list
  const scroll = document.createElement('div');
  scroll.style.maxHeight = '56vh';
  scroll.style.overflowY = 'auto';
  scroll.style.borderRadius = '8px';
  scroll.appendChild(wrap);
  tableMount.appendChild(scroll);

}

  
  // >>> PATCH:PL_BADGES_TRUE_PB_WR START
  // Goal:
  // - For MONTH filters (Jan/Feb/etc): show PB only when this month hits the player's TRUE all-time PB.
  // - Show WR only for the current all-time record holder (once).
  // Notes:
  // - Do NOT derive PB/WR from the filtered month rows (that makes everyone "PB" every month).
  // - Use high_scores for WR (cheap + authoritative), and player_games_union for per-player PB/monthly-avg PB.
  const __plBadgeCache = {
    // per-player: all-time best single-game score
    bestGameAll: new Map(),
    // per-player: best monthly average across all time
    bestMonthlyAvgAll: new Map(),
    // WR record: { name, score, ts }
    wr: null,
    _wrLoaded: false,
    // keep per-player rows fetched (so we don't refetch constantly)
    _playersFetched: new Set()
  };

  function __plNormName(x) {
    return String(x ?? '').trim();
  }

  async function __plEnsureWRHistory() {
    if (__plBadgeCache._wrLoaded) return;
    __plBadgeCache._wrLoaded = true;

    try {
      const rows = await __plLoadCanonicalRows(false);
      let wr = null;
      (rows || []).forEach(r => {
        const name = __plNormName(r.player);
        const score = Number(r.score || 0);
        if (!name || !Number.isFinite(score)) return;
        if (!wr || score > wr.score || (score === wr.score && (__plTsMs(r.ts) || Infinity) < (__plTsMs(wr.ts) || Infinity))) {
          wr = { name, score, ts: r.ts || null };
        }
      });
      __plBadgeCache.wr = wr;
    } catch (e) {
      console.warn('PL WR history load failed (non-fatal)', e);
    }
  }

  async function __plEnsureAllTimeForPlayers(players) {
    const wanted = (players || []).map(__plNormName).filter(Boolean);
    const toFetch = wanted.filter(n => !__plBadgeCache._playersFetched.has(n));
    if (!toFetch.length) return;

    try {
      const rows = await __plLoadCanonicalRows(false);
      const wantedSet = new Set(toFetch.map(__plNormName));
      const monthAgg = new Map(); // key `${player}|${monthId}` -> {total,games}

      (rows || []).forEach(r => {
        const name = __plNormName(r.player);
        if (!name || !wantedSet.has(name)) return;

        const sc = Number(r.score || 0);
        if (!Number.isFinite(sc)) return;

        const cur = __plBadgeCache.bestGameAll.get(name) ?? -Infinity;
        if (sc > cur) __plBadgeCache.bestGameAll.set(name, sc);

        const mId = monthKey(r.ts);
        if (mId) {
          const k = `${name}|${mId}`;
          const acc = monthAgg.get(k) || { total: 0, games: 0 };
          acc.total += sc;
          acc.games += 1;
          monthAgg.set(k, acc);
        }
      });

      monthAgg.forEach((v, k) => {
        const name = k.split('|')[0];
        const avg = v.games ? (v.total / v.games) : 0;
        const cur = __plBadgeCache.bestMonthlyAvgAll.get(name) ?? -Infinity;
        if (avg > cur) __plBadgeCache.bestMonthlyAvgAll.set(name, avg);
      });

      toFetch.forEach(n => __plBadgeCache._playersFetched.add(n));
    } catch (e) {
      console.warn('PL all-time per-player badge data load failed (non-fatal)', e);
      toFetch.forEach(n => __plBadgeCache._playersFetched.add(n));
    }
  }
  
  // Expose badge cache + loaders for other UI modules
  window.__plBadgeCache = __plBadgeCache;
  window.__plEnsureWRHistory = __plEnsureWRHistory;
  window.__plEnsureAllTimeForPlayers = __plEnsureAllTimeForPlayers;
// >>> PATCH:PL_BADGES_TRUE_PB_WR END

async function renderTable(rows, filter, prevFilter) {
    // Qualification thresholds
const MIN_MONTHLY_GAMES = 3;
const MIN_DAYWEEK_GAMES = 2;
const MIN_YEAR_GAMES = 10;
const MIN_ALLTIME_GAMES = 15;
    const filtered = rows.filter(r => {
      if (!r || !r.player) return false;
      const score = Number(r.score || 0);
      if (!Number.isFinite(score)) return false;
      if (!filter || filter.id === 'ALL') return true;
      return filter.match(r.ts);
    });

    if (!filtered.length) {
      tableMount.innerHTML = '<p>No games found for this period.</p>';
      return;
    }

    const byPlayer = new Map();

    filtered.forEach(r => {
      const name = String(r.player || '').trim();
      if (!name) return;
      const score = Number(r.score || 0);
      if (!Number.isFinite(score)) return;

      const existing = byPlayer.get(name) || {
        player: name,
        games: 0,
        total: 0,
        best: 0
      };

      existing.games += 1;
      existing.total += score;
      if (score > existing.best) existing.best = score;

      byPlayer.set(name, existing);
    });
    
// Determine qualification threshold by filter:
// - TODAY / YESTERDAY / THIS WEEK: 2 games
// - Monthly: 5 games
// - Year: 10 games
// - ALL: 10 games
const threshold = (() => {
  if (filter && (filter.id === 'TODAY' || filter.id === 'YESTERDAY' || filter.id === 'THIS_WEEK')) return MIN_DAYWEEK_GAMES;
  if (filter && /^M\d{4}-\d{2}$/.test(filter.id)) return MIN_MONTHLY_GAMES;
  if (filter && /^Y\d{4}$/.test(filter.id)) return MIN_YEAR_GAMES;
  return MIN_ALLTIME_GAMES;
})()

// Update minimum-games note
try { if (minNote) minNote.textContent = `${threshold} Games Minimum`; } catch(_) {}
;

const rowsOut = Array.from(byPlayer.values())
  .map(p => {
    const avg = p.games ? (p.total / p.games) : 0;
    return {
      player: p.player,
      games: p.games,
      avg,
      best: p.best,
      qualifies: p.games >= threshold
    };
  })
  .sort((a, b) => {
    // Qualified first
    if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
    // Then by Avg desc
    if (b.avg !== a.avg) return b.avg - a.avg;
    // Then by Games desc
    if (b.games !== a.games) return b.games - a.games;
    // Then by name asc
    return String(a.player||'').localeCompare(String(b.player||''));
  });
      
      // ALL TIME medals (based on BEST): precompute top 3 distinct best scores
let bestTop3 = null;
if (!filter || filter.id === 'ALL') {
  const uniques = Array.from(
    new Set(rowsOut.filter(p=>p.qualifies).map(p => Number(p.best || 0)).filter(v => Number.isFinite(v) && v > 0))
  ).sort((a, b) => b - a);
  bestTop3 = uniques.slice(0, 3); // [gold, silver, bronze]
}
      
      // --- Helpers to detect "NEW this month" ---
const monthKey = (ts) => {
  const ms = parseMs(ts);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}`; // matches buildFilters id
};

// Earliest official game timestamp per player (from ALL rows)
const earliestByPlayer = new Map();
rows.forEach(r => {
  const name = String(r.player || '').trim();
  if (!name || !r.ts) return;
  const cur = earliestByPlayer.get(name);
  const ms = parseMs(r.ts);
  if (!Number.isFinite(ms)) return;
  const curMs = parseMs(cur);
  if (!cur || !Number.isFinite(curMs) || ms < curMs) {
    earliestByPlayer.set(name, r.ts);
  }
});

// Current month id for ALL TIME "NEW" badge logic
const _now = new Date();
const currentMonthId = `${_now.getFullYear()}-${_now.getMonth()}`;

// --- PB / WR precompute (all-time) ---

// All-time single-game PB per player + global WR (best game)
const bestGameAllByPlayer = new Map();
let globalBestGameWR = -Infinity;

rows.forEach(r => {
  const name = String(r.player || '').trim();
  if (!name) return;
  const sc = Number(r.score || 0);
  if (!Number.isFinite(sc)) return;

  const cur = bestGameAllByPlayer.get(name) || -Infinity;
  if (sc > cur) bestGameAllByPlayer.set(name, sc);
  if (sc > globalBestGameWR) globalBestGameWR = sc;
});

// Monthly average records (per player PB, and global WR)
const monthlyAgg = new Map(); // key: `${name}|${monthId}` -> { total, games }
rows.forEach(r => {
  const name = String(r.player || '').trim();
  const mId  = monthKey(r.ts);
  const sc   = Number(r.score || 0);
  if (!name || !mId || !Number.isFinite(sc)) return;

  const key = `${name}|${mId}`;
  const acc = monthlyAgg.get(key) || { total: 0, games: 0 };
  acc.total += sc; acc.games += 1;
  monthlyAgg.set(key, acc);
});

const maxMonthlyAvgByPlayer = new Map();
let globalMonthlyAvgWR = -Infinity;
monthlyAgg.forEach((v, key) => {
  const [name] = key.split('|');
  const avg = v.games ? (v.total / v.games) : 0;
  const cur = maxMonthlyAvgByPlayer.get(name) ?? -Infinity;
  if (avg > cur) maxMonthlyAvgByPlayer.set(name, avg);
  if (avg > globalMonthlyAvgWR) globalMonthlyAvgWR = avg;
});

    
    // >>> PATCH:PL_PRELOAD_BADGES START
    const __isAllFilter = !filter || filter.id === 'ALL';
    if (!__isAllFilter) {
      try {
        await __plEnsureWRHistory();
        await __plEnsureAllTimeForPlayers(rowsOut.map(p => p.player));
      } catch (_) {}
    }
    // >>> PATCH:PL_PRELOAD_BADGES END

// --- Build previous-month aggregates (avg, best, rank) if prevFilter is provided ---
    let prevMap = null;
    let prevRankMap = null;

    if (prevFilter && filter && filter.id !== 'ALL') {
      try {
        // IMPORTANT: previous-month arrows must be computed from the PREVIOUS filter window,
        // not from the current filtered rows (otherwise it will always be empty).
        const prevRows = await fetchRows(prevFilter);

        if (prevRows && prevRows.length) {
          const prevByPlayer = new Map();

          prevRows.forEach(r => {
            if (!r || !r.player) return;
            const name = String(r.player || '').trim();
            if (!name) return;

            const __k = String(name).trim().toLowerCase();
            const __savedSet = (typeof __llsSavedSet !== "undefined" ? __llsSavedSet : (window.__llsSavedSet || null));
            if (__savedSet && !__savedSet.has(__k)) return;

            // Treat NULL as official; only exclude explicit practice=true
            if (r.is_practice === true) return;

            const score = Number(r.score || 0);
            if (!Number.isFinite(score)) return;

            const existing = prevByPlayer.get(name) || { player: name, games: 0, total: 0, best: 0 };
            existing.games += 1;
            existing.total += score;
            if (score > existing.best) existing.best = score;
            prevByPlayer.set(name, existing);
          });

          const prevRowsOut = Array.from(prevByPlayer.values())
            .map(p => ({
              player: p.player,
              games: p.games,
              avg: p.games ? p.total / p.games : 0,
              best: p.best
            }))
            .sort((a, b) => b.avg - a.avg);

          prevMap = new Map();
          prevRankMap = new Map();
          prevRowsOut.forEach((p, idx) => {
            prevMap.set(p.player, p);
            prevRankMap.set(p.player, idx + 1);
          });
        }
      } catch (e) {
        console.warn('PL prev-period fetch failed (non-fatal)', e);
      }
    }

function addRankArrow(td, prevRank, currRank) {
      if (!prevRank || !currRank || prevRank === currRank) return;
      const improved = currRank < prevRank; // lower rank number = better
      const span = document.createElement('span');
      span.textContent = improved ? '▲' : '▼';
      span.style.marginLeft = '4px';
      span.style.color = improved ? '#7fffd4' : '#ff6b6b'; // green up, red down
      td.appendChild(span);
    }
    
    function addBadge(td, text, colour, title){
  const badge = document.createElement('span');
  badge.textContent = ' ' + text;
  badge.style.marginLeft = '6px';
  badge.style.color = colour;
  if (title) badge.title = title;
  td.appendChild(badge);
}

    function addMetricArrow(td, curr, prev) {
      if (prev == null || !Number.isFinite(prev)) return;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.01) return; // ignore tiny noise
      const up = diff > 0;
      const span = document.createElement('span');
      span.textContent = up ? '▲' : '▼';
      span.style.marginLeft = '4px';
      span.style.color = up ? '#7fffd4' : '#ff6b6b';
      td.appendChild(span);
    }

    const table = document.createElement('table');
    table.className = 'hs-table';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['#', 'Player', 'Games', 'Avg', 'Best'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    
    // Keep the table header fixed while tbody scrolls
Array.from(trh.children).forEach(th => {
  th.style.position = 'sticky';
  th.style.top = '0';
  th.style.zIndex = '2';
  th.style.background = 'rgba(0,0,0,0.4)'; // subtle backdrop
});

    const tbody = document.createElement('tbody');

let rankCounter = 0; // rank only qualified players

rowsOut.forEach((p) => {
  const tr = document.createElement('tr');

  const qualifies = !!p.qualifies;
  const rank = qualifies ? (++rankCounter) : null;

  // Grey-out styling for unqualified rows
  if (!qualifies) {
    tr.classList.add('muted');
    tr.style.opacity = '0.6';
    const need = Math.max(0, threshold - (p.games || 0));
    tr.title = need
      ? `Needs ${need} more game${need===1?'':'s'} to qualify (min ${threshold})`
      : `Unqualified (min ${threshold})`;
  }

  const tdRank = document.createElement('td');
  tdRank.textContent = qualifies ? String(rank) : '—';

  const tdName  = document.createElement('td'); tdName.textContent  = p.player;
  const tdGames = document.createElement('td'); tdGames.textContent = String(p.games);
  const tdAvg   = document.createElement('td'); tdAvg.textContent   = p.avg.toFixed(1);
  const tdBest  = document.createElement('td'); tdBest.textContent  = String(p.best);

  // Add arrows for month-on-month changes when we have previous stats (qualified only)
  if (qualifies && prevMap && prevRankMap) {
    const prevRow  = prevMap.get(p.player);
    const prevRank = prevRankMap.get(p.player);
    addRankArrow(tdRank, prevRank, rank);
    if (prevRow) {
      addMetricArrow(tdAvg, p.avg, prevRow.avg);
      addMetricArrow(tdBest, p.best, prevRow.best);
    }
  }

  // Medals on ALL TIME: 🥇🥈🥉 for top 3 distinct BEST scores
  if (!filter || filter.id === 'ALL') {
    const b = Number(p.best || 0);
    if (bestTop3 && b > 0) {
      let medalText = null, colour = null;
      if (bestTop3[0] != null && b === bestTop3[0]) { medalText = ' 🥇'; colour = '#ffcc66'; }
      else if (bestTop3[1] != null && b === bestTop3[1]) { medalText = ' 🥈'; colour = '#c0c0c0'; }
      else if (bestTop3[2] != null && b === bestTop3[2]) { medalText = ' 🥉'; colour = '#cd7f32'; }
      if (medalText) {
        const m = document.createElement('span');
        m.textContent = medalText;
        m.style.marginLeft = '6px';
        m.style.color = colour;
        m.title = 'Top 3 all-time best score';
        tdBest.appendChild(m);
      }
    }
  }

  // "NEW" badge (unchanged): still shows even if unranked
  {
    const firstTs  = earliestByPlayer.get(p.player);
    const firstId  = firstTs ? monthKey(firstTs) : null;
    const isAll    = !filter || filter.id === 'ALL';
    const _now = new Date(); const currentMonthId = `${_now.getFullYear()}-${_now.getMonth()}`;
    const showNew  = firstId && (
      (!isAll && firstId === filter.id) ||
      (isAll && firstId === currentMonthId)
    );
    if (showNew) {
      const badge = document.createElement('span');
      badge.textContent = ' NEW';
      badge.style.marginLeft = '6px';
      badge.style.color = '#ffcc66';
      tdRank.appendChild(badge);
    }
  }

  // >>> PATCH:PL_BADGES_TRUE_PB_WR_APPLY START
  // For month filters only:
  // - BEST: WR (current holder only) else PB only if this month equals the player's all-time PB
  // - AVG: PB only if this month equals the player's best monthly average across all time
  {
    const isAll = !filter || filter.id === 'ALL';
    if (!isAll) {
      const nm = __plNormName(p.player);

      // ---- BEST column badges ----
      const allPBGame = __plBadgeCache.bestGameAll.get(nm) ?? -Infinity;

      const wr = __plBadgeCache.wr;
      const isWRBest = (wr && nm && nm === wr.name && Number.isFinite(wr.score) && p.best > 0 && p.best === wr.score);

      if (isWRBest) {
        addBadge(tdBest, 'WR 🥇', '#ffcc66', 'World record game score');      } else {
        // PB only when this month's best equals true all-time PB
        const isPBBest = (p.best > 0 && p.best === allPBGame);
        if (isPBBest) addBadge(tdBest, 'PB', '#7fffd4', 'Personal best game score');
      }

      // ---- AVG column badges (PB only) ----
      const pbMonthlyAvg = __plBadgeCache.bestMonthlyAvgAll.get(nm) ?? -Infinity;
      const isPBAvg = (p.avg > 0 && Number.isFinite(pbMonthlyAvg) && Math.abs(p.avg - pbMonthlyAvg) < 0.01);
      if (isPBAvg) addBadge(tdAvg, 'PB', '#7fffd4', 'Personal best monthly average');
    }
  }
  // >>> PATCH:PL_BADGES_TRUE_PB_WR_APPLY END

  tr.append(tdRank, tdName, tdGames, tdAvg, tdBest);
  tbody.appendChild(tr);
});

    table.appendChild(tbody);
// Clear and add minimum-games note + table (only rows scroll)
tableMount.innerHTML = '';
const _isAll = !filter || filter.id === 'ALL';
const minNote = document.createElement('p');
minNote.className = 'tag';
minNote.textContent = '';

// Scrolling area for the table body only
const scroll = document.createElement('div');
scroll.style.maxHeight = '56vh';     // keeps everything inside the modal
scroll.style.overflowY = 'auto';
scroll.style.borderRadius = '8px';

// Put the table inside the scroll area
scroll.appendChild(table);

// Mount: note stays fixed, header is sticky inside the scroll area
tableMount.appendChild(minNote);
tableMount.appendChild(scroll);

  }

  // Kick it all off
  (async () => {
const filters = buildFilters();
// Default to ALL TIME even though RECORDS is the first button
let currentFilter = filters.find(f => f.id === 'ALL') || filters[0];

// Fetch only what we need for the active filter (prevents LIMIT truncation hiding tail players).
let rows = await fetchRows(currentFilter);
if (!rows.length) {
  tableMount.innerHTML = `<p class="tag">No official games found yet for ${currentFilter.label || currentFilter.id}.</p>`;
  // Still render the filters so the user can switch windows.
}

function getPrevFilter(f) {
  if (!f || f.id === 'ALL' || f.id === 'RECORDS') return null;

  // TODAY compares to YESTERDAY
  if (f.id === 'TODAY') return filters.find(x => x.id === 'YESTERDAY') || null;

  // YESTERDAY and THIS WEEK: no previous comparator
  if (f.id === 'YESTERDAY' || f.id === 'THIS_WEEK') return null;

  // Months: compare to previous month button (next in list)
  const idx = filters.indexOf(f);
  if (idx < 0) return null;
  const nextIdx = idx + 1;
  if (nextIdx >= filters.length) return null;
  const prev = filters[nextIdx];
  if (!prev || prev.id === 'ALL' || prev.id === 'RECORDS' || prev.id === 'TODAY' || prev.id === 'YESTERDAY' || prev.id === 'THIS_WEEK') return null;
  return prev;
}

renderFilters(filters, async f => {
  currentFilter = f;

  const reqId = ++__plReqSeq;
  const label = (f && (f.label || f.id)) ? (f.label || f.id) : 'FILTER';

  try {
    rows = await __plWithTimeout(fetchRows(currentFilter), 8000);
    if (reqId !== __plReqSeq) return;

    if (!rows || !rows.length) {
      tableMount.innerHTML = `<p class="tag">No games found for ${label}.</p>`;
      return;
    }

    if (f.id === 'RECORDS') {
      renderRecords(rows);
    } else {
      const prev = getPrevFilter(currentFilter);
      await renderTable(rows, currentFilter, prev);
    }
  } catch (e) {
    if (reqId !== __plReqSeq) return;
    const msg = (e && (e.message || e.details || e.hint)) ? (e.message || e.details || e.hint) : String(e || '');
    tableMount.innerHTML = `<p class="tag">Premier League failed to load for ${label}.</p><pre style="white-space:pre-wrap;opacity:.7;font-size:.75rem;margin-top:8px;">${__plEsc(msg).slice(0, 900)}</pre>`;
  }
});

// Initial render = ALL TIME table
const initialPrev = getPrevFilter(currentFilter);
if (rows.length) {
  await renderTable(rows, currentFilter, initialPrev);
}
  })();
};

// >>> PATCH:LATEST_SCORES_GAMES_TRUTH_V1 START
// Latest Scores uses games history/cloud rows directly. Missing match_id must not demote 2+ player games to practice.
// Latest Scores modal: overlay with # | Result | Date/Time + Official/Practice toggle + chart
// ===== @JS:MODAL:LATEST_SCORES =====
// [removed: openLatestScoresDialog base def] audit P5.3 batch 3 — shadowed by later canonical definition

// [removed: openLatestScoresDialog base export] audit P5.3 batch 3 — shadowed by later canonical definition
// <<< PATCH:LATEST_SCORES_GAMES_TRUTH_V1 END
/* >>> PATCH:PHASE1_FIX57_LATEST_SCORES_CLOUD_TRUTH START
   Latest Scores now uses getGamesForMode(mode) as the authoritative source.
   Local completed-game cache is fallback-only and is not merged with cloud rows.
   This prevents the same newly saved practice game appearing twice.
<<< PATCH:PHASE1_FIX57_LATEST_SCORES_CLOUD_TRUTH END */

/* =====================================================================
   SQ XP — player experience & levels (source of truth: Supabase view
   v_player_xp, which derives XP from all match/game history).
   IMPORTANT: the weights in SQ_XP.W MUST match the v_player_xp SQL view
   (points x0.25, game +30, game win +50, match win +150, milestone +40).
   Level curve is owned here: level = floor(sqrt(xp / DIV)) + 1.
   Scope: CLASSIC games only. The SQL views (v_ach_rounds / v_player_base_xp)
   map board players by NAME via v_name_resolver (players + aliases) so EVERY
   Classic game counts — not just those with match_players rows — and exclude
   turbo/practice modes and guest/test names. Keep detectGame's per-game rules
   in sync with v_ach_base.
   No XP is earned outside ranked play:
     - practice/turbo games are filtered out of v_player_base_xp AND v_ach_rounds
       by mode, so they award neither base XP nor trophy XP;
     - the milestones term counts high_scores_sp (LEAGUE) only — note the client
       constants are inverted, TABLE_HS_PRACTICE = 'high_scores';
     - Training never writes to `games`; it lives in training_sessions and has
       its own summary screen.
   __sqUnrankedXpMode() mirrors this on the client so the end-of-game screen
   never promises XP the views will not award. */
const SQ_XP = {
  W: { point: 0.25, game: 30, gameWin: 50, matchWin: 150, milestone: 40 },
  DIV: 46,          // level-curve divisor (re-tuned after full Classic-game coverage)
  MAXLVL: 60,
  levelForXp(xp){ xp = Math.max(0, Number(xp) || 0); return Math.min(this.MAXLVL, Math.floor(Math.sqrt(xp / this.DIV)) + 1); },
  xpForLevel(l){ l = Math.max(1, l); return Math.round((l - 1) * (l - 1) * this.DIV); }, // cumulative XP to reach level l
  titleForLevel(l){
    if (l >= 60) return 'Immortal';
    if (l >= 50) return 'Legend';
    if (l >= 43) return 'Grandmaster';
    if (l >= 35) return 'Master';
    if (l >= 28) return 'Ace';
    if (l >= 22) return 'Sniper';
    if (l >= 15) return 'Sharpshooter';
    if (l >= 10) return 'Marksman';
    if (l >= 5)  return 'Amateur';
    return 'Rookie';
  },
  progress(xp){
    xp = Math.max(0, Number(xp) || 0);
    const level = this.levelForXp(xp);
    const cur = this.xpForLevel(level), next = this.xpForLevel(level + 1);
    const into = Math.max(0, xp - cur), span = Math.max(1, next - cur);
    return { xp, level, title: this.titleForLevel(level), into, span,
             pct: Math.max(0, Math.min(1, into / span)),
             toNext: Math.max(0, next - xp), atMax: level >= this.MAXLVL };
  },
  // Projected XP for a single finished game (for the live "+XP" preview).
  gameXp({ points = 0, gameWon = false, matchWon = false, milestones = 0 } = {}){
    return Math.round((Number(points) || 0) * this.W.point)
      + this.W.game
      + (gameWon ? this.W.gameWin : 0)
      + (matchWon ? this.W.matchWin : 0)
      + (Number(milestones) || 0) * this.W.milestone;
  },
  _cache: null, _cacheAt: 0, _inflight: null,
  async all(force){
    const now = Date.now();
    if (!force && this._cache && (now - this._cacheAt) < 60000) return this._cache;
    if (!force && this._inflight) return this._inflight;
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return this._cache || [];
    const run = (async () => {
      try{
        const { data, error } = await SB.from('v_player_xp').select('*');
        if (error || !Array.isArray(data)) return this._cache || [];
        this._cache = data; this._cacheAt = Date.now();
        return data;
      }catch(_){ return this._cache || []; }
    })();
    if (!force) this._inflight = run;
    try{ return await run; }
    finally{
      if (!force && this._inflight === run) this._inflight = null;
    }
  },
  async forName(name){
    const rows = await this.all();
    const n = String(name || '').trim().toLowerCase();
    return rows.find(r => String(r.name || '').trim().toLowerCase() === n) || null;
  },
  fmt(n){ return (Number(n) || 0).toLocaleString(); }
};
window.SQ_XP = SQ_XP;

// A reusable "LV n · TITLE" chip (inline-styled to match the stats hero).
function __sqXpChip(prog){
  const chip = document.createElement('span');
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;'
    + 'background:linear-gradient(135deg,rgba(255,183,64,.28),rgba(255,122,24,.18));'
    + 'border:1px solid rgba(255,183,64,.5);font-weight:900;font-size:12px;letter-spacing:.06em;'
    + 'color:#ffe1b0;white-space:nowrap;';
  const lv = document.createElement('b'); lv.textContent = 'LV ' + prog.level; lv.style.color = '#fff';
  const ti = document.createElement('span'); ti.textContent = prog.title.toUpperCase(); ti.style.opacity = '.92';
  chip.append(lv, ti);
  return chip;
}

// A reusable XP progress bar with "x XP · y to Level n+1" caption.
function __sqXpBar(prog){
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:12px;';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;font-size:11px;'
    + 'text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;';
  const l = document.createElement('span'); l.className = 'muted'; l.textContent = SQ_XP.fmt(prog.xp) + ' XP';
  const r = document.createElement('span'); r.className = 'muted';
  r.textContent = prog.atMax ? 'MAX LEVEL' : (SQ_XP.fmt(prog.toNext) + ' to Level ' + (prog.level + 1));
  top.append(l, r);
  const track = document.createElement('div');
  track.style.cssText = 'height:9px;border-radius:999px;background:rgba(0,0,0,.32);'
    + 'border:1px solid rgba(255,255,255,.08);overflow:hidden;';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0;border-radius:999px;transition:width .7s cubic-bezier(.2,.8,.25,1);'
    + 'background:linear-gradient(90deg,#ff7a18,#ffb14a);box-shadow:0 0 10px rgba(255,150,60,.6);';
  track.appendChild(fill);
  wrap.append(top, track);
  requestAnimationFrame(() => { fill.style.width = Math.round(prog.pct * 100) + '%'; });
  return wrap;
}

/* =====================================================================
   SQ ACH — trophies / achievements catalogue + trophy case.
   Counts & XP are the single source of truth in Supabase view
   v_player_achievements (derived from all game history — auto-backfilled
   and auto-updated as games are saved). This module holds the display
   metadata and the live per-game detector (for celebratory toasts).
   The detector rules MUST mirror the SQL in v_player_achievements /
   v_ach_rounds. XP values here are for the toast only; the authoritative
   XP is summed by the view.
===================================================================== */
const SQ_ACH = {
  // Ordered best-first. tier drives colour; xp is per-earn (mirrors the view).
  CATALOG: [
    { code:'the_180',        name:'The 180',            icon:'🎯', tier:'legendary', xp:100, desc:'Score a perfect 180 in one round' },
    { code:'untouchable',    name:'Untouchable',        icon:'👑', tier:'legendary', xp:200, desc:'Win a game without ever being behind after any completed round' },
    { code:'special_forces', name:'Special Forces',     icon:'🪖', tier:'legendary', xp:180, desc:'Earn Double D’s, Maxi and Bull Run in one game' },
    { code:'reverse_sweep',  name:'Reverse Sweep',      icon:'↩️', tier:'legendary', xp:150, desc:'Win a five-game match after losing the first two games' },
    { code:'clean_sweep',    name:'Clean Sweep',        icon:'🧼', tier:'gold',      xp:80,  desc:'Win every game in a three- or five-game match' },
    { code:'last_gasp',      name:'Last Gasp',          icon:'⏳', tier:'gold',      xp:50,  desc:'Be behind after round 12, then win' },
    { code:'pb_smasher',     name:'PB Smasher',         icon:'🔨', tier:'silver',    xp:50,  desc:'Beat your previous game PB by 100+ points' },
    { code:'century_streak', name:'Century Streak',     icon:'💯', tier:'silver',    xp:40,  desc:'Score 100+ in two consecutive rounds' },
    { code:'runaway',        name:'Runaway',            icon:'💨', tier:'silver',    xp:30,  desc:'Win a game by 200+ points' },
    { code:'steady_eddie',   name:'Steady Eddie',       icon:'📏', tier:'silver',    xp:25,  desc:'Score in 10 consecutive rounds in one game' },
    { code:'photo_finish',   name:'Photo Finish',       icon:'🏁', tier:'silver',    xp:20,  desc:'Win a game by 1–10 points' },
    { code:'flawless_game',  name:'Sharpshooter’s Game',icon:'✨', tier:'legendary', xp:120, desc:'No non-scoring darts for the entire game' },
    { code:'treble_sweep',   name:'Treble Sweep',       icon:'🔺', tier:'legendary', xp:250, desc:'Land a treble on every number 10–20' },
    { code:'inferno',        name:'Inferno',            icon:'🌋', tier:'gold',      xp:60,  desc:'Five full houses in a row' },
    { code:'whitewash',      name:'Whitewash',          icon:'🧹', tier:'gold',      xp:80,  desc:'Win every round of a game' },
    { code:'giant_slayer',   name:'Giant Slayer',       icon:'🗡️', tier:'gold',      xp:0,   desc:'Beat a higher-level player (bonus scales with the gap)' },
    { code:'david_and_goliath',name:'David & Goliath',   icon:'🪨', tier:'gold',      xp:100, desc:'Win when your pre-game 10-game average is at least 200 points lower than an opponent’s' },
    { code:'champion',       name:'Champion',           icon:'🏆', tier:'gold',      xp:60,  desc:'Win a best-of-five (or longer) match' },
    { code:'nemesis',        name:'Nemesis',            icon:'😈', tier:'gold',      xp:80,  desc:'Beat the same rival five times' },
    { code:'double_sweep',   name:'Double Sweep',       icon:'🔷', tier:'gold',      xp:200, desc:'Land a double on every number 10–20' },
    { code:'bull_club',      name:'Bull Club',          icon:'🐂', tier:'gold',      xp:150, desc:'Hit 30 career bulls' },
    { code:'comeback_kid',   name:'Comeback Kid',       icon:'🔄', tier:'gold',      xp:60,  desc:'Win after trailing at halfway' },
    { code:'ton_machine',    name:'Ton Machine',        icon:'💠', tier:'gold',      xp:40,  desc:'Three century rounds in one game' },
    { code:'maximum',        name:'Maximum',            icon:'💥', tier:'gold',      xp:60,  desc:'Max out a round' },
    { code:'treble_trouble', name:'Mini Maxi',     icon:'🔱', tier:'gold',      xp:40,  desc:'Three trebles in a number round 10–20 only' },
    { code:'clutch',         name:'Clutch',             icon:'⏱️', tier:'gold',      xp:40,  desc:'Full house on the final round to win' },
    { code:'iceman',         name:'Iceman',             icon:'🧊', tier:'gold',      xp:50,  desc:'Win a tiebreak game' },
    { code:'shanghai',       name:'Shanghai',           icon:'🏮', tier:'gold',      xp:50,  desc:'Single, double AND treble of one number in a round' },
    { code:'desmond',        name:'Desmond',            icon:'👓', tier:'silver',    xp:18,  desc:'Two singles and a double in one round' },
    { code:'robin_hood',     name:'Robin Hood',         icon:'🏹', tier:'silver',    xp:20,  desc:'Two or more trebles of the same number in a round' },
    { code:'double_down',    name:'Mini D’s',        icon:'♊', tier:'silver',    xp:25,  desc:'Three doubles in a number round 10–20 only' },
    { code:'hot_streak',     name:'Hot Streak',         icon:'🔥', tier:'silver',    xp:25,  desc:'Three full houses in a row' },
    { code:'full_board',     name:'Full Board',         icon:'🧩', tier:'silver',    xp:30,  desc:'Score on all 14 rounds of a game' },
    { code:'century',        name:'Century',            icon:'💯', tier:'silver',    xp:15,  desc:'Score 100+ in one round' },
    { code:'unstoppable',    name:'Unstoppable',        icon:'🌟', tier:'legendary', xp:140, desc:'Win five games in a row' },
    { code:'kingslayer',     name:'Kingslayer',         icon:'💀', tier:'legendary', xp:60,  desc:'Beat the current #1 ranked player in a game' },
    { code:'hot_hand',       name:'Hot Hand',           icon:'🖐️', tier:'gold',      xp:70,  desc:'Win three games in a row' },
    { code:'decider',        name:'Decider',            icon:'⚔️', tier:'gold',      xp:80,  desc:'Win the deciding game of a match' },
    { code:'first_blood',    name:'First Blood',        icon:'🩸', tier:'silver',    xp:20,  desc:'Win the opening game of a series' },
    { code:'score_700',      name:'The 700 Club',       icon:'7️⃣', tier:'legendary', xp:700, desc:'Score 700+ in a single game' },
    { code:'score_600',      name:'The 600 Club',       icon:'6️⃣', tier:'legendary', xp:480, desc:'Score 600+ in a single game' },
    { code:'score_500',      name:'The 500 Club',       icon:'5️⃣', tier:'gold',      xp:320, desc:'Score 500+ in a single game' },
    { code:'score_400',      name:'The 400 Club',       icon:'4️⃣', tier:'gold',      xp:200, desc:'Score 400+ in a single game' },
    { code:'score_300',      name:'Triple Ton',         icon:'🌠', tier:'silver',    xp:120, desc:'Score 300+ in a single game' },
    { code:'score_200',      name:'Double Ton',         icon:'⭐', tier:'silver',    xp:60,  desc:'Score 200+ in a single game' },
    { code:'score_100',      name:'Ton Up',             icon:'💯', tier:'bronze',    xp:30,  desc:'Score 100+ in a single game' },
    { code:'centurion',      name:'Centurion',          icon:'🏛️', tier:'legendary', xp:400, desc:'Play 250 games' },
    { code:'trophy_hunter',  name:'Trophy Hunter',      icon:'🗃️', tier:'legendary', xp:350, desc:'Unlock 20 different trophies' },
    { code:'triple_threat',  name:'Maxi',      icon:'⚡', tier:'gold',      xp:60,  desc:'Three trebles in the Trebles round only' },
    { code:'bull_run',       name:'Bull Run',           icon:'🐮', tier:'gold',      xp:60,  desc:'Three bulls in the Bull round' },
    { code:'double_trouble', name:'Double D’s',     icon:'🎲', tier:'gold',      xp:45,  desc:'Three doubles in the Doubles round only' },
    { code:'veteran',        name:'Veteran',            icon:'🎖️', tier:'gold',      xp:200, desc:'Play 100 games' },
    { code:'collector',      name:'Collector',          icon:'🧰', tier:'gold',      xp:150, desc:'Unlock 10 different trophies' },
    { code:'strong_finish',  name:'Strong Finish',      icon:'🏁', tier:'silver',    xp:40,  desc:'Score 100+ on the Bull round' },
    { code:'regular',        name:'Regular',            icon:'📅', tier:'silver',    xp:100, desc:'Play 50 games' },
    { code:'full_house',     name:'Full House',         icon:'🏠', tier:'bronze',    xp:12,  desc:'All three darts on target in a round' },
    { code:'perfect_start',  name:'Perfect Start',      icon:'🚀', tier:'bronze',    xp:20,  desc:'Full house on the opening 10s round' },
    { code:'dead_centre',    name:'Dead Centre',        icon:'🔴', tier:'bronze',    xp:5,   desc:'Hit the 50 bull' }
  ],
  meta(code){ return this.CATALOG.find(a => a.code === code) || { code, name: code, icon:'🎖️', tier:'bronze', desc:'' }; },
  tierStyle(tier){
    switch(tier){
      case 'legendary': return { c:'#e9c6ff', b:'rgba(180,123,255,.6)', g:'linear-gradient(135deg,rgba(180,123,255,.30),rgba(120,60,200,.16))' };
      case 'gold':      return { c:'#ffe1a6', b:'rgba(255,196,74,.55)', g:'linear-gradient(135deg,rgba(255,196,74,.26),rgba(255,140,40,.14))' };
      case 'silver':    return { c:'#e4ecf7', b:'rgba(200,214,235,.5)', g:'linear-gradient(135deg,rgba(200,214,235,.20),rgba(150,170,200,.10))' };
      default:          return { c:'#f0c9a6', b:'rgba(208,139,90,.5)', g:'linear-gradient(135deg,rgba(208,139,90,.20),rgba(160,100,60,.10))' };
    }
  },
  _cache:{},
  async forPlayerId(playerId){
    try{
      if (!playerId) return { available:false, map:{} };
      const SB = window.sb || window.__sb || null;
      if (!SB || typeof SB.from !== 'function') return { available:false, map:{} };
      const { data, error } = await SB.from('v_player_achievements').select('code,cnt,xp').eq('player_id', playerId);
      if (error || !Array.isArray(data)) return { available:false, map:{} };
      const map = {}; data.forEach(r => { map[r.code] = { cnt: Number(r.cnt) || 0, xp: Number(r.xp) || 0 }; });
      return { available:true, map };
    }catch(_){ return { available:false, map:{} }; }
  },
  async forName(name){
    try{
      const xr = await SQ_XP.forName(name); if (!xr) return {};
      const state = await this.forPlayerId(xr.player_id);
      const map = state.map || {};
      try{ Object.defineProperty(map, '__available', { value:!!state.available, enumerable:false, configurable:true }); }catch(_){ }
      return map;
    }catch(_){
      const map = {};
      try{ Object.defineProperty(map, '__available', { value:false, enumerable:false, configurable:true }); }catch(__){ }
      return map;
    }
  }
};
window.SQ_ACH = SQ_ACH;

/* =====================================================================
   SQ MISFIRE — historical visibility + launch-forward XP presentation.
   Historical occurrence counts come only from Supabase v_player_misfires.
   The XP total comes from v_player_xp.misfire_xp; the browser never derives
   or backdates penalties from game history.
===================================================================== */
const SQ_MISFIRE = {
  CATALOG: [
    { code:'cold_start',              name:'Cold Start',              icon:'🥶', penalty:-1, desc:'Score zero in each of the first three rounds' },
    { code:'ghost_town',              name:'Ghost Town',              icon:'👻', penalty:-2, desc:'Score zero in three consecutive rounds' },
    { code:'deep_freeze',             name:'Deep Freeze',             icon:'🧊', penalty:-3, desc:'Score zero in five consecutive rounds' },
    { code:'sub_ton',                 name:'Sub Ton',                 icon:'📉', penalty:-2, desc:'Finish a game below 100 points' },
    { code:'special_delivery_failed', name:'Special Delivery Failed', icon:'📦', penalty:-2, desc:'Score zero in the Doubles, Triples and Bull rounds' },
    { code:'bull_blind',              name:'Bull Blind',              icon:'🙈', penalty:-1, desc:'Score zero in the Bull round' },
    { code:'volde_deux',               name:'Volde-D’eux',             icon:'🎯', penalty:-2, stackPerDart:true, desc:'Hit D1–D5 in the Doubles round' },
    { code:'volde_trois',              name:'Volde-Trois',             icon:'🎯', penalty:-2, stackPerDart:true, desc:'Hit T1–T5 in the Trebles round' },
    { code:'century_drought',         name:'Century Drought',         icon:'🏜️', penalty:-2, desc:'Finish below 100 in five consecutive games' },
    { code:'wooden_spoon',            name:'Wooden Spoon',            icon:'🥄', penalty:-3, desc:'Finish sole last in five consecutive games' }
  ],
  async forPlayerId(playerId){
    try{
      if (!playerId) return { available:false, map:{} };
      const SB = window.sb || window.__sb || null;
      if (!SB || typeof SB.from !== 'function') return { available:false, map:{} };
      const { data, error } = await SB.from('v_player_misfires').select('code,cnt').eq('player_id', playerId);
      if (error || !Array.isArray(data)) return { available:false, map:{} };
      const map = {}; data.forEach(r => { map[r.code] = { cnt:Number(r.cnt) || 0 }; });
      return { available:true, map };
    }catch(_){ return { available:false, map:{} }; }
  },
  async forName(name){
    try{
      const xr = await SQ_XP.forName(name); if (!xr) return { available:false, map:{} };
      return await this.forPlayerId(xr.player_id);
    }catch(_){ return { available:false, map:{} }; }
  }
};

// Everyone who has recorded a given Misfire, ranked by historical occurrence
// count. This is display/read parity with positive trophy leaderboards only:
// XP penalties remain authoritative in v_player_xp and are never derived here.
SQ_MISFIRE.forCode = async function(code){
  try{
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return { available:false, rows:[] };
    const [res, names] = await Promise.all([
      SB.from('v_player_misfires').select('player_id,cnt').eq('code', code),
      SQ_XP.all()
    ]);
    if (!res || res.error || !Array.isArray(res.data)) return { available:false, rows:[] };
    const nameMap = {}, gamesMap = {};
    (names || []).forEach(n => {
      nameMap[n.player_id] = n.name;
      gamesMap[n.player_id] = Math.max(0, Number(n.games_played) || 0);
    });
    const rows = res.data.map(r => ({
      player_id: r.player_id,
      name: nameMap[r.player_id] || '—',
      cnt: Number(r.cnt) || 0,
      games_played: gamesMap[r.player_id] || 0
    })).filter(r => r.cnt > 0)
      .sort((a, b) => (b.cnt - a.cnt)
        || String(a.name || '').localeCompare(String(b.name || ''))
        || String(a.player_id || '').localeCompare(String(b.player_id || '')));
    return { available:true, rows };
  }catch(_){ return { available:false, rows:[] }; }
};
window.SQ_MISFIRE = SQ_MISFIRE;

// Milestones are one-time unlocks (score PBs, career collections, volume,
// meta); everything else is a repeatable Trophy you can stack.
SQ_ACH.MILESTONES = new Set(['score_100','score_200','score_300','score_400','score_500','score_600','score_700','treble_sweep','double_sweep','bull_club','regular','veteran','centurion','collector','trophy_hunter']);
SQ_ACH.isMilestone = function(code){ return SQ_ACH.MILESTONES.has(code); };

// Everyone who has earned a given trophy, ranked by count (for the per-award
// leaderboard shown when you tap a trophy).
SQ_ACH.forCode = async function(code){
  try{
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return [];
    const [res, names] = await Promise.all([
      SB.from('v_player_achievements').select('player_id,cnt,xp').eq('code', code),
      SQ_XP.all()
    ]);
    const rows = (res && res.data) || [];
    const nameMap = {}, gamesMap = {};
    (names || []).forEach(n => {
      nameMap[n.player_id] = n.name;
      gamesMap[n.player_id] = Math.max(0, Number(n.games_played) || 0);
    });
    return rows.map(r => ({
      player_id: r.player_id,
      name: nameMap[r.player_id] || '—',
      cnt: Number(r.cnt) || 0,
      xp: Number(r.xp) || 0,
      games_played: gamesMap[r.player_id] || 0
    }))
      .filter(r => r.cnt > 0)
      .sort((a, b) => (b.cnt - a.cnt) || (b.xp - a.xp));
  }catch(_){ return []; }
};

// SC-027 — percentage average boards with a six-game minimum sample.
// Every player remains visible, but only players with more than five eligible
// Official/Classic games are actively ranked in AVERAGE mode.
function __sqLeagueAverageEligible(row){
  return Math.max(0, Number(row && row.games_played) || 0) > 5;
}
function __sqLeagueAverageValue(row){
  const games = Math.max(0, Number(row && row.games_played) || 0);
  const cnt = Math.max(0, Number(row && row.cnt) || 0);
  return games > 0 ? (cnt / games) : null;
}
function __sqLeagueAverageRows(rows){
  return (rows || []).slice().sort((a, b) => {
    const ae = __sqLeagueAverageEligible(a), be = __sqLeagueAverageEligible(b);
    if (ae !== be) return ae ? -1 : 1;
    const av = __sqLeagueAverageValue(a), bv = __sqLeagueAverageValue(b);
    if (ae && be){
      if (av == null && bv != null) return 1;
      if (av != null && bv == null) return -1;
      if (av != null && bv != null && Math.abs(bv - av) > 1e-12) return bv - av;
    } else {
      const byGames = (Number(b && b.games_played) || 0) - (Number(a && a.games_played) || 0);
      if (byGames) return byGames;
    }
    const byCount = (Number(b && b.cnt) || 0) - (Number(a && a.cnt) || 0);
    if (byCount) return byCount;
    const byName = String((a && a.name) || '').localeCompare(String((b && b.name) || ''));
    if (byName) return byName;
    return String((a && a.player_id) || '').localeCompare(String((b && b.player_id) || ''));
  });
}
function __sqLeagueAverageText(row){
  const avg = __sqLeagueAverageValue(row);
  return avg == null ? '—' : ((avg * 100).toFixed(1) + '%');
}
function __sqLeagueModeBar(titleText, activeColor, activeBg){
  const head = document.createElement('div');
  head.className = 'pp-league-mode-bar';
  head.style.cssText = 'display:flex;align-items:center;gap:6px;margin:6px 2px 6px;min-width:0;';
  const title = document.createElement('div');
  title.className = 'pp-league-title';
  title.textContent = titleText;
  title.style.cssText = 'flex:1 1 auto;min-width:0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6;line-height:1.2;';
  const controls = document.createElement('div');
  controls.className = 'pp-league-mode-switch';
  controls.style.cssText = 'margin-left:auto;display:flex;gap:4px;flex:0 0 auto;';
  const make = (mode, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pp-league-mode-btn'; b.dataset.leagueMode = mode; b.textContent = label;
    b.style.cssText = 'min-height:44px;min-width:58px;padding:0 7px;border-radius:9px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:var(--v3-muted,#a7b0c8);font-size:9px;font-weight:900;letter-spacing:.04em;white-space:nowrap;';
    controls.appendChild(b); return b;
  };
  const allBtn = make('all', 'ALL TIME');
  const avgBtn = make('average', 'AVERAGE');
  const setActive = mode => {
    [allBtn, avgBtn].forEach(b => {
      const on = b.dataset.leagueMode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.color = on ? activeColor : 'var(--v3-muted,#a7b0c8)';
      b.style.borderColor = on ? activeColor : 'rgba(255,255,255,.13)';
      b.style.background = on ? activeBg : 'rgba(255,255,255,.035)';
    });
  };
  head.append(title, controls); setActive('all');
  return { el:head, title, controls, allBtn, avgBtn, setActive };
}

// SC-026 — split positive achievement reads + lightweight award directory.
// Positive Trophy Vault history no longer depends on v_player_achievements / v_player_xp.
// Canonical occurrence sources remain v_ach_base + v_ach_david_goliath; Collector
// and Trophy Hunter are derived with the same 10/20 distinct-code thresholds as the DB view.
SQ_ACH._playerDirectoryCache = null;
SQ_ACH._playerDirectoryCacheAt = 0;
SQ_ACH._playerDirectoryInflight = null;
SQ_ACH.playerDirectory = async function(force){
  const now = Date.now();
  if (!force && this._playerDirectoryCache && (now - this._playerDirectoryCacheAt) < 60000) return this._playerDirectoryCache;
  if (!force && this._playerDirectoryInflight) return this._playerDirectoryInflight;
  const SB = window.sb || window.__sb || null;
  if (!SB || typeof SB.from !== 'function') return this._playerDirectoryCache || [];
  const run = (async () => {
    try{
      const { data, error } = await SB.from('v_player_base_xp').select('player_id,name,games_played');
      if (error || !Array.isArray(data)) return this._playerDirectoryCache || [];
      const rows = data.map(r => ({
        player_id: r.player_id,
        name: String(r.name || '').trim(),
        games_played: Math.max(0, Number(r.games_played) || 0)
      })).filter(r => r.player_id && r.games_played > 0);
      this._playerDirectoryCache = rows;
      this._playerDirectoryCacheAt = Date.now();
      return rows;
    }catch(_){ return this._playerDirectoryCache || []; }
  })();
  if (!force) this._playerDirectoryInflight = run;
  try{ return await run; }
  finally{ if (!force && this._playerDirectoryInflight === run) this._playerDirectoryInflight = null; }
};
SQ_ACH.playerForName = async function(name){
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  const rows = await this.playerDirectory();
  return rows.find(r => String(r.name || '').trim().toLowerCase() === key) || null;
};
SQ_ACH._mergeSourceRows = function(rows){
  const by = new Map();
  (rows || []).forEach(r => {
    const playerId = r && r.player_id;
    const code = String((r && r.code) || '').trim();
    if (!playerId || !code) return;
    const key = String(playerId) + '|' + code;
    const prev = by.get(key) || { player_id:playerId, code, cnt:0, xp:0 };
    prev.cnt += Math.max(0, Number(r.cnt) || 0);
    prev.xp += Number(r.xp) || 0;
    by.set(key, prev);
  });
  return Array.from(by.values());
};
SQ_ACH._sourceRows = async function(opts){
  opts = opts || {};
  try{
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return { available:false, rows:[] };
    const meta = opts.code === 'collector' || opts.code === 'trophy_hunter';
    let baseQ = SB.from('v_ach_base').select('player_id,code,cnt,xp');
    let dgQ = SB.from('v_ach_david_goliath').select('player_id,code,cnt,xp');
    if (opts.playerId){ baseQ = baseQ.eq('player_id', opts.playerId); dgQ = dgQ.eq('player_id', opts.playerId); }
    if (opts.code && !meta){ baseQ = baseQ.eq('code', opts.code); dgQ = dgQ.eq('code', opts.code); }
    const [base, dg] = await Promise.all([baseQ, dgQ]);
    if (!base || base.error || !Array.isArray(base.data) || !dg || dg.error || !Array.isArray(dg.data)) return { available:false, rows:[] };
    return { available:true, rows:this._mergeSourceRows(base.data.concat(dg.data)) };
  }catch(_){ return { available:false, rows:[] }; }
};
SQ_ACH._metaForRows = function(rows, playerId){
  const source = (rows || []).filter(r => !playerId || String(r.player_id) === String(playerId));
  const codes = new Set(source.filter(r => Number(r.cnt) > 0 && r.code !== 'collector' && r.code !== 'trophy_hunter').map(r => r.code));
  const out = [];
  if (codes.size >= 10) out.push({ player_id:playerId, code:'collector', cnt:1, xp:150 });
  if (codes.size >= 20) out.push({ player_id:playerId, code:'trophy_hunter', cnt:1, xp:350 });
  return out;
};
SQ_ACH.forPlayerId = async function(playerId){
  try{
    if (!playerId) return { available:false, map:{} };
    const state = await this._sourceRows({ playerId });
    if (!state.available) return { available:false, map:{} };
    const rows = this._mergeSourceRows(state.rows.concat(this._metaForRows(state.rows, playerId)));
    const map = {};
    rows.forEach(r => { if (Number(r.cnt) > 0) map[r.code] = { cnt:Number(r.cnt)||0, xp:Number(r.xp)||0 }; });
    return { available:true, map };
  }catch(_){ return { available:false, map:{} }; }
};
SQ_ACH.forName = async function(name){
  try{
    const player = await this.playerForName(name);
    if (!player) return {};
    const state = await this.forPlayerId(player.player_id);
    const map = state.map || {};
    try{ Object.defineProperty(map, '__available', { value:!!state.available, enumerable:false, configurable:true }); }catch(_){ }
    return map;
  }catch(_){
    const map = {};
    try{ Object.defineProperty(map, '__available', { value:false, enumerable:false, configurable:true }); }catch(__){ }
    return map;
  }
};
SQ_ACH.forCode = async function(code){
  try{
    const [state, directory] = await Promise.all([this._sourceRows({ code }), this.playerDirectory()]);
    if (!state.available) return [];
    let rows;
    if (code === 'collector' || code === 'trophy_hunter'){
      const ids = Array.from(new Set(state.rows.map(r => r.player_id).filter(Boolean)));
      rows = ids.flatMap(id => this._metaForRows(state.rows, id)).filter(r => r.code === code);
    } else {
      rows = state.rows.filter(r => r.code === code);
    }
    const byPlayer = new Map((directory || []).map(r => [String(r.player_id), r]));
    return rows.map(r => {
      const p = byPlayer.get(String(r.player_id));
      return {
        player_id:r.player_id,
        name:(p && p.name) || '—',
        cnt:Number(r.cnt)||0,
        xp:Number(r.xp)||0,
        games_played:(p && Math.max(0, Number(p.games_played)||0)) || 0
      };
    }).filter(r => r.cnt > 0)
      .sort((a,b) => (b.cnt-a.cnt) || (b.xp-a.xp) || String(a.name||'').localeCompare(String(b.name||'')) || String(a.player_id||'').localeCompare(String(b.player_id||'')));
  }catch(_){ return []; }
};
SQ_ACH.forMilestones = async function(){
  try{
    const [state, directory] = await Promise.all([this._sourceRows({}), this.playerDirectory()]);
    if (!state.available) return [];
    const milestoneCodes = new Map();
    const addMilestone = r => {
      const playerId = r && r.player_id;
      const code = String((r && r.code) || '').trim();
      if (!playerId || !code || Number(r.cnt) <= 0 || !this.isMilestone(code)) return;
      const key = String(playerId);
      if (!milestoneCodes.has(key)) milestoneCodes.set(key, new Set());
      milestoneCodes.get(key).add(code);
    };
    (state.rows || []).forEach(addMilestone);
    const sourceByPlayer = new Map();
    (state.rows || []).forEach(r => {
      const key = String((r && r.player_id) || '');
      if (!key) return;
      if (!sourceByPlayer.has(key)) sourceByPlayer.set(key, []);
      sourceByPlayer.get(key).push(r);
    });
    (directory || []).forEach(p => {
      const key = String(p.player_id || '');
      this._metaForRows(sourceByPlayer.get(key) || [], p.player_id).forEach(addMilestone);
    });
    return (directory || []).map(p => ({
      player_id:p.player_id,
      name:p.name || '—',
      cnt:(milestoneCodes.get(String(p.player_id)) || new Set()).size,
      games_played:Math.max(0, Number(p.games_played) || 0)
    })).sort((a,b) => (b.cnt-a.cnt)
      || String(a.name||'').localeCompare(String(b.name||''))
      || String(a.player_id||'').localeCompare(String(b.player_id||'')));
  }catch(_){ return []; }
};

SQ_MISFIRE.forName = async function(name){
  try{
    const player = await SQ_ACH.playerForName(name);
    if (!player) return { available:false, map:{} };
    return await this.forPlayerId(player.player_id);
  }catch(_){ return { available:false, map:{} }; }
};
SQ_MISFIRE.forCode = async function(code){
  try{
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return { available:false, rows:[] };
    const [res, directory] = await Promise.all([
      SB.from('v_player_misfires').select('player_id,cnt').eq('code', code),
      SQ_ACH.playerDirectory()
    ]);
    if (!res || res.error || !Array.isArray(res.data)) return { available:false, rows:[] };
    const byPlayer = new Map((directory || []).map(r => [String(r.player_id), r]));
    const rows = res.data.map(r => {
      const p = byPlayer.get(String(r.player_id));
      return {
        player_id:r.player_id,
        name:(p && p.name) || '—',
        cnt:Number(r.cnt)||0,
        games_played:(p && Math.max(0, Number(p.games_played)||0)) || 0
      };
    }).filter(r => r.cnt > 0)
      .sort((a,b) => (b.cnt-a.cnt) || String(a.name||'').localeCompare(String(b.name||'')) || String(a.player_id||'').localeCompare(String(b.player_id||'')));
    return { available:true, rows };
  }catch(_){ return { available:false, rows:[] }; }
};

SQ_ACH.scoreMilestoneThreshold = function(code){
  const m = String(code || '').match(/^score_(100|200|300|400|500|600|700)$/);
  return m ? Number(m[1]) : 0;
};
SQ_ACH.forScoreMilestone = async function(code){
  const threshold = this.scoreMilestoneThreshold(code);
  if (!threshold) return [];
  const SB = window.sb || window.__sb || null;
  if (!SB || typeof SB.from !== 'function') return [];
  try{
    const directory = await this.playerDirectory();
    const byId = new Map((directory || []).map(p => [String(p.player_id || ''), p]));
    const byName = new Map((directory || []).map(p => [String(p.name || '').trim().toLowerCase(), p]));
    const counts = new Map();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize){
      const to = from + pageSize - 1;
      const { data, error } = await SB.from('v_player_game_scores_official_clean')
        .select('game_id,ts,player_id,player_id_alt,player_name,score')
        .gte('score', threshold)
        .order('ts', { ascending:true })
        .range(from, to);
      if (error) return [];
      const rows = Array.isArray(data) ? data : [];
      rows.forEach(r => {
        const ids = [r && r.player_id, r && r.player_id_alt].map(v => String(v || '').trim()).filter(Boolean);
        let p = null;
        for (const id of ids){ if (byId.has(id)){ p = byId.get(id); break; } }
        if (!p) p = byName.get(String((r && r.player_name) || '').trim().toLowerCase()) || null;
        if (!p) return;
        const key = String(p.player_id);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      if (rows.length < pageSize) break;
    }
    return (directory || []).map(p => ({
      player_id:p.player_id,
      name:p.name || '—',
      cnt:counts.get(String(p.player_id)) || 0,
      games_played:Math.max(0, Number(p.games_played) || 0)
    })).filter(r => r.cnt > 0)
      .sort((a,b) => (b.cnt-a.cnt) || String(a.name||'').localeCompare(String(b.name||'')) || String(a.player_id||'').localeCompare(String(b.player_id||'')));
  }catch(_){ return []; }
};

// Trophy detail popup: how to earn it + a leaderboard of everyone who has it.
async function __sqTrophyDetail(code, earnedMap){
  const a = SQ_ACH.meta(code); const s = SQ_ACH.tierStyle(a.tier);
  const got = (earnedMap && earnedMap[code]) || { cnt: 0 };
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal pp-trophy-detail';
  modal.style.cssText = 'max-width:460px;width:92vw;max-height:86vh;overflow:hidden;';
  const body = document.createElement('div'); body.className = 'modal-body'; body.style.cssText = 'overflow-y:auto;max-height:82vh;';
  const milestone = SQ_ACH.isMilestone(code);
  const tierName = (a.tier || 'bronze').toUpperCase() + (milestone ? ' · MILESTONE' : '');
  const xpText = code === 'giant_slayer' ? 'Scales with the level gap' : ('+' + (a.xp || 0) + ' XP' + (milestone ? ' (one-time)' : ' each'));
  const yours = milestone ? (got.cnt > 0 ? 'Unlocked ✓' : 'Not yet unlocked') : (got.cnt > 0 ? ('You’ve earned this ' + got.cnt + '×') : 'You haven’t earned this yet');
  body.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:' + s.g + ';border:1px solid ' + s.b + ';">'
    + '<div style="font-size:40px;line-height:1">' + a.icon + '</div>'
    + '<div style="min-width:0"><div style="font-weight:900;font-size:20px;color:#fff">' + a.name + '</div>'
    + '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:' + s.c + '">' + tierName + ' · ' + xpText + '</div></div></div>'
    + '<div style="margin:14px 2px 4px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">How to earn</div>'
    + '<div style="font-size:15px;font-weight:600;margin:0 2px 10px">' + a.desc + '.</div>'
    + '<div style="font-size:12px;font-weight:800;margin:0 2px 12px;color:' + (got.cnt>0 ? '#7be0a0' : 'var(--v3-muted,#98a2b8)') + '">' + yours + '</div>';

  const modeBar = __sqLeagueModeBar(milestone ? 'Milestone leaderboard' : 'Trophy leaderboard', s.c, 'rgba(255,177,74,.12)');
  modeBar.title.classList.add('pp-trophy-leaderboard-title');
  const loading = document.createElement('p'); loading.className = 'muted'; loading.id = 'trophyLbLoading'; loading.style.fontSize = '13px'; loading.textContent = 'Loading…';
  const mount = document.createElement('div'); mount.className = 'pp-trophy-lb-mount';
  body.append(modeBar.el, loading, mount);
  modal.append(body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();

  const scoreThreshold = SQ_ACH.scoreMilestoneThreshold(code);
  const rows = scoreThreshold
    ? await SQ_ACH.forScoreMilestone(code)
    : (milestone ? await SQ_ACH.forMilestones() : await SQ_ACH.forCode(code));
  if (!overlay.isConnected) return;
  loading.remove();
  const medal = i => i === 0 ? '#ffd24a' : i === 1 ? '#cbd5e1' : i === 2 ? '#d08b5a' : 'var(--v3-muted,#98a2b8)';
  const render = mode => {
    modeBar.setActive(mode); mount.innerHTML = '';
    const ordered = mode === 'average' ? __sqLeagueAverageRows(rows) : (rows || []).slice();
    if (!ordered.length){
      const p = document.createElement('p'); p.className = 'muted pp-trophy-lb-empty'; p.style.fontSize = '13px'; p.textContent = 'No one has earned this yet — be the first!'; mount.appendChild(p); return;
    }
    const list = document.createElement('div'); list.className = 'pp-trophy-lb'; list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    let rankedIndex = 0;
    ordered.forEach((r, i) => {
      const eligible = mode !== 'average' || __sqLeagueAverageEligible(r);
      const rankIndex = mode === 'average' ? (eligible ? rankedIndex++ : -1) : i;
      const row = document.createElement('div'); row.className = 'pp-trophy-lb-row'; row.dataset.games = String(Math.max(0, Number(r.games_played) || 0));
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);';
      if (mode === 'average' && !eligible){ row.classList.add('is-average-ineligible'); row.style.opacity = '.38'; row.title = 'Minimum 6 eligible games required to rank'; }
      const rk = document.createElement('span'); rk.className = 'pp-trophy-lb-rank'; rk.textContent = rankIndex >= 0 ? ('#' + (rankIndex + 1)) : '—'; rk.style.cssText = 'font-weight:900;min-width:30px;color:' + (rankIndex >= 0 ? medal(rankIndex) : 'var(--v3-muted,#98a2b8)');
      const nm = document.createElement('span'); nm.className = 'pp-trophy-lb-name'; nm.textContent = r.name; nm.style.cssText = 'flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const val = document.createElement('span'); val.className = 'pp-trophy-lb-value';
      val.textContent = mode === 'average' ? __sqLeagueAverageText(r) : (milestone ? String(Number(r.cnt)||0) : ('×' + r.cnt));
      val.title = mode === 'average'
        ? ((Number(r.cnt)||0) + ' occurrence(s) over ' + (Number(r.games_played)||0) + ' eligible games' + (eligible ? '' : ' · Not ranked until 6 eligible games'))
        : (scoreThreshold ? (scoreThreshold + '+ game scores') : (milestone ? 'Milestones achieved' : ''));
      val.style.cssText = 'font-weight:900;color:' + (mode === 'average' ? s.c : (milestone ? '#2fd06b' : '#ffb14a')) + ';white-space:nowrap;';
      row.append(rk, nm, val); list.appendChild(row);
    });
    mount.appendChild(list);
  };
  modeBar.allBtn.onclick = () => render('all'); modeBar.avgBtn.onclick = () => render('average'); render('all');
  const foot = document.createElement('div'); foot.style.cssText = 'margin-top:14px;text-align:center;';
  const cb = document.createElement('button'); cb.className = 'btn sq-pill'; cb.textContent = 'Close'; cb.onclick = () => overlay.remove(); foot.appendChild(cb); body.appendChild(foot);
}

// Per-game trophy detector for live celebration toasts. Mirrors the SQL rules
// in v_ach_rounds / v_player_achievements (per-round, per-game, streak, 2p feats).
// Career/match feats (sweeps, giant_slayer, champion, nemesis) are cross-game and
// surface via the trophy case, not here. board = array[player] of array[round] of
// { darts:[{kind,points}], roundTotal }.  opts: { players, is_tiebreak }.
SQ_ACH.detectGame = function(board, opts){
  opts = opts || {};
  const players = opts.players || [];
  const norm = d => {
    const k = (d && d.kind) || 'Miss';
    if (k === 'S') return 'single';
    if (k === 'D' || k === 'Double') return 'double';
    if (k === 'T' || k === 'Triple') return 'treble';
    if (k === 'B' || k === 'Bull') return 'bull';
    return 'miss';
  };
  if (!Array.isArray(board) || !board.length) return [];
  const totals = board.map(rs => (rs || []).reduce((s, r) => s + (Number(r && r.roundTotal) || 0), 0));
  const maxTotal = Math.max.apply(null, totals.concat([0]));
  const out = [];
  for (let p = 0; p < board.length; p++){
    const rounds = board[p] || [];
    const earned = {}; const add = (c, n) => { earned[c] = (earned[c] || 0) + (n || 1); };
    let totMiss = 0, totDarts = 0, centuryRounds = 0, scoredRounds = 0, best = 0, run = 0;
    let finalFh = false;
    for (let ri = 0; ri < rounds.length; ri++){
      const r = rounds[ri] || {}; const darts = r.darts || [];
      let tre = 0, dou = 0, sin = 0, b50 = 0, bany = 0;
      darts.forEach(d => { const nk = norm(d); if (nk === 'treble') tre++; else if (nk === 'double') dou++; else if (nk === 'single') sin++; else if (nk === 'bull'){ bany++; if ((Number(d.points) || 0) === 50) b50++; } });
      const mis = darts.filter(d => norm(d) === 'miss' || (Number(d && d.points) || 0) === 0).length;
      const rtot = Number(r.roundTotal) || 0;
      const target = ri <= 10 ? 10 + ri : null;
      const rmax = ri <= 10 ? 9 * (10 + ri) : (ri === 11 ? 120 : ri === 12 ? 180 : 150);
      totMiss += mis; totDarts += darts.length;
      if (rtot > 0) scoredRounds++;
      const fh = (mis === 0 && darts.length === 3);
      run = fh ? run + 1 : 0; if (run > best) best = run;
      if (ri === 13) finalFh = fh;
      if (rtot === 180) add('the_180');
      else if (rtot === rmax && darts.length === 3) add('maximum');
      if (ri <= 10 && tre === 3) add('treble_trouble');
      if (ri <= 10 && dou === 3) add('double_down');
      if (fh) add('full_house');
      if (rtot >= 100 && rtot < 180){ add('century'); centuryRounds++; }
      if (target != null && sin === 1 && dou === 1 && tre === 1) add('shanghai');
      if (target != null && sin === 2 && dou === 1 && tre === 0 && mis === 0) add('desmond');
      if (target != null && tre >= 2) add('robin_hood');
      if (b50 > 0) add('dead_centre', b50);
      if (ri === 12 && tre === 3) add('triple_threat');
      if (ri === 11 && dou === 3) add('double_trouble');
      if (ri === 13 && bany === 3) add('bull_run');
      if (ri === 0 && fh) add('perfect_start');
      if (ri === 13 && rtot >= 100) add('strong_finish');
    }
    // Score milestones are one-time (shown in the profile), not per-game trophies.
    const won = totals[p] === maxTotal && maxTotal > 0;
    if (totMiss === 0 && totDarts > 0) add('flawless_game');
    if (scoredRounds >= 14) add('full_board');
    if (centuryRounds >= 3) add('ton_machine');
    if (best >= 5) add('inferno'); else if (best >= 3) add('hot_streak');
    if (!opts.is_tiebreak && board.length >= 2 && uniqueWon && neverBehind) add('untouchable');
    if (opts.is_tiebreak && won) add('iceman');
    if (won && finalFh) add('clutch');
    if (board.length === 2){
      const opp = 1 - p, oppRounds = board[opp] || [];
      let wonEvery = true, ca = 0, cb = 0, n = Math.max(rounds.length, oppRounds.length);
      for (let ri = 0; ri < n; ri++){
        const a = Number((rounds[ri] || {}).roundTotal) || 0, b = Number((oppRounds[ri] || {}).roundTotal) || 0;
        if (!(a > b)) wonEvery = false;
        if (ri <= 6){ ca += a; cb += b; }
      }
      if (won && wonEvery) add('whitewash');
      if (won && ca < cb) add('comeback_kid');
    }
    const list = Object.keys(earned).map(c => ({ code: c, count: earned[c] }))
      .sort((a, b) => (SQ_ACH.meta(b.code).xp || 0) - (SQ_ACH.meta(a.code).xp || 0));
    if (list.length) out.push({ player: p, name: (players[p] && (players[p].name || players[p])) || ('Player ' + (p + 1)), earned: list });
  }
  return out;
};

// Celebratory toast stack shown at game-complete for trophies earned this game.
function __sqAchToast(results){
  try{
    if (!Array.isArray(results) || !results.length) return;
    let layer = document.getElementById('sqAchToastLayer');
    if (!layer){
      layer = document.createElement('div'); layer.id = 'sqAchToastLayer';
      layer.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:100000;'
        + 'display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(92vw,420px);';
      document.body.appendChild(layer);
    }
    const flat = [];
    results.forEach(r => r.earned.forEach(e => flat.push({ name: r.name, code: e.code, count: e.count })));
    // Headline the rarest first, cap the stack.
    flat.slice(0, 6).forEach((item, i) => {
      const a = SQ_ACH.meta(item.code); const s = SQ_ACH.tierStyle(a.tier);
      const el = document.createElement('div');
      el.style.cssText = 'pointer-events:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;'
        + 'background:' + s.g + ';border:1px solid ' + s.b + ';box-shadow:0 10px 26px rgba(0,0,0,.45);'
        + 'color:' + s.c + ';font-weight:800;opacity:0;transform:translateY(-10px) scale(.96);'
        + 'transition:opacity .3s ease,transform .3s cubic-bezier(.2,.9,.25,1);max-width:100%;';
      el.innerHTML = '<span style="font-size:24px;line-height:1">' + a.icon + '</span>'
        + '<span style="display:flex;flex-direction:column;min-width:0">'
        + '<b style="color:#fff;font-size:14px;letter-spacing:.02em">' + a.name + (item.count > 1 ? ' ×' + item.count : '') + '</b>'
        + '<span style="font-size:11px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (item.name || '') + ' · +' + ((a.xp || 0) * item.count) + ' XP</span>'
        + '</span>';
      layer.appendChild(el);
      setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)'; }, 80 + i * 140);
      setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px) scale(.96)'; setTimeout(() => { try{ el.remove(); if (!layer.childElementCount) layer.remove(); }catch(_){ } }, 350); }, 4200 + i * 140);
    });
    try{ if (typeof __sqV3SndGame === 'function') __sqV3SndGame(); }catch(_){ }
  }catch(_){ }
}

// Detect + celebrate trophies for the just-finished game (uses live state).
window.__sqAchCelebrate = function(){
  try{
    const board = (state && state.score) ? state.score : null;
    if (!board) return;
    const results = SQ_ACH.detectGame(board, {
      players: (state.players || []).map(p => ({ name: (typeof __sqPlayerPretty === 'function' ? __sqPlayerPretty(p) : (p && p.name)) || (p && p.name) || '' })),
      is_tiebreak: !!(state.is_tiebreak || state.currentGameIsTiebreak)
    });
    __sqAchToast(results);
    // Freshen caches so the next Player Stats / leaderboard read reflects the new game.
    try{ if (window.SQ_XP) { SQ_XP._cache = null; SQ_ACH._cache = {}; } }catch(_){ }
  }catch(_){ }
};

// Render the trophy case: earned badges bright (with counts), locked badges dim.
function __sqTrophyCase(earnedMap, available = true){
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  const badge = (a) => {
    const got = earnedMap[a.code] || { cnt:0 };
    const earned = got.cnt > 0;
    const milestone = SQ_ACH.isMilestone(a.code);
    const s = SQ_ACH.tierStyle(a.tier);
    const b = document.createElement('div');
    b.title = a.desc + (earned && !milestone && got.cnt > 1 ? `  (earned ${got.cnt}×)` : '');
    b.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;cursor:pointer;'
      + 'padding:10px 6px;border-radius:12px;'
      + (earned ? ('background:' + s.g + ';border:1px solid ' + s.b + ';')
                : 'background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.12);opacity:.42;filter:grayscale(1);');
    const ic = document.createElement('div'); ic.textContent = a.icon; ic.style.cssText = 'font-size:26px;line-height:1;';
    const nm = document.createElement('div'); nm.textContent = a.name; nm.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:.01em;color:' + (earned ? s.c : 'var(--v3-muted,#98a2b8)') + ';line-height:1.15;';
    b.append(ic, nm);
    if (available) b.onclick = () => { try{ __sqTrophyDetail(a.code, earnedMap); }catch(_){ } };
    else { b.style.cursor = 'default'; b.title = 'Achievement history is unavailable right now.'; }
    // Repeatable trophies show a ×count; milestones show a ✓ tick when unlocked.
    if (earned && !milestone && got.cnt > 1){
      const bc = document.createElement('div'); bc.textContent = '×' + got.cnt;
      bc.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ff7a18;color:#160b03;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);';
      b.appendChild(bc);
    } else if (earned && milestone){
      const tk = document.createElement('div'); tk.textContent = '✓';
      tk.style.cssText = 'position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:999px;background:#2fd06b;color:#05230f;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);';
      b.appendChild(tk);
    }
    return b;
  };
  const section = (title, icon, codes) => {
    const codeList = SQ_ACH.CATALOG.filter(a => codes.has(a.code));
    const earnedN = codeList.filter(a => (earnedMap[a.code]||{}).cnt > 0).length;
    const card = document.createElement('div'); card.className = 'tag';
    card.dataset.achievementSection = title;
    card.style.cssText = 'padding:14px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;';
    const ttl = document.createElement('strong'); ttl.innerHTML = icon + ' ' + title; ttl.style.fontSize = '15px';
    const cnt = document.createElement('span'); cnt.className = 'muted'; cnt.style.cssText = 'font-weight:800;font-size:12px;';
    cnt.textContent = available ? (earnedN + ' / ' + codeList.length + ' unlocked') : ('— / ' + codeList.length + ' unlocked');
    head.append(ttl, cnt);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;';
    codeList.forEach(a => { if ((earnedMap[a.code]||{}).cnt > 0) grid.appendChild(badge(a)); });
    codeList.forEach(a => { if (!((earnedMap[a.code]||{}).cnt > 0)) grid.appendChild(badge(a)); });
    card.append(head, grid);
    return card;
  };
  const mset = new Set(SQ_ACH.CATALOG.filter(a => SQ_ACH.isMilestone(a.code)).map(a => a.code));
  const tset = new Set(SQ_ACH.CATALOG.filter(a => !SQ_ACH.isMilestone(a.code)).map(a => a.code));
  wrap.append(section('Milestones', '🎖️', mset), section('Trophies / Awards', '🏆', tset));
  return wrap;
}


async function __sqMisfireDetail(code, misfireMap){
  const m = (SQ_MISFIRE.CATALOG || []).find(x => x.code === code);
  if (!m) return;
  const got = (misfireMap && misfireMap[code]) || { cnt:0 };
  const cnt = Math.max(0, Number(got.cnt) || 0);
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal pp-misfire-detail';
  modal.style.cssText = 'max-width:460px;width:92vw;max-height:86vh;overflow:hidden;';
  const body = document.createElement('div'); body.className = 'modal-body'; body.style.cssText = 'overflow-y:auto;max-height:82vh;';
  body.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(127,29,29,.52),rgba(69,10,10,.82));border:1px solid rgba(248,113,113,.42);">'
    + '<div style="font-size:40px;line-height:1">' + m.icon + '</div>'
    + '<div style="min-width:0"><div style="font-weight:900;font-size:20px;color:#fff">' + m.name + '</div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#fecaca">MISFIRE · ' + (m.stackPerDart ? (m.penalty + ' XP / DART') : (m.penalty + ' XP')) + '</div></div></div>'
    + '<div style="margin:14px 2px 4px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">How it happens</div>'
    + '<div style="font-size:15px;font-weight:600;margin:0 2px 10px">' + m.desc + '.</div>'
    + '<div class="pp-misfire-detail-count" style="font-size:12px;font-weight:800;margin:0 2px 12px;color:' + (cnt > 0 ? '#fecaca' : 'var(--v3-muted,#98a2b8)') + '">' + (cnt > 0 ? ('Recorded ×' + cnt + ' historically') : 'Not recorded yet') + '</div>';
  const modeBar = __sqLeagueModeBar('Misfire leaderboard', '#fca5a5', 'rgba(248,113,113,.13)'); modeBar.title.classList.add('pp-misfire-leaderboard-title');
  const loading = document.createElement('p'); loading.className = 'muted'; loading.id = 'misfireLbLoading'; loading.style.fontSize = '13px'; loading.textContent = 'Loading…';
  const mount = document.createElement('div'); mount.className = 'pp-misfire-lb-mount';
  const rule = document.createElement('div'); rule.className = 'muted pp-misfire-detail-rule'; rule.style.cssText = 'font-size:10px;line-height:1.4;margin:12px 2px 0';
  rule.textContent = m.stackPerDart
    ? 'Historical counts can include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. Each qualifying dart is −2 XP and stacks independently. Volde penalties are exempt from the ordinary worst-Misfire-only rule and the −5 XP per-game cap.'
    : 'Historical counts can include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. For ordinary Misfires, only the worst penalty applies and the ordinary deduction is capped at 5 XP per game. Volde-D’eux and Volde-Trois are excluded from that cap.';
  body.append(modeBar.el, loading, mount, rule);
  modal.append(body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); }); overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); }); modal.tabIndex = 0; modal.focus();
  const lbState = await SQ_MISFIRE.forCode(code);
  if (!overlay.isConnected) return;
  loading.remove();
  const medal = i => i === 0 ? '#ffd24a' : i === 1 ? '#cbd5e1' : i === 2 ? '#d08b5a' : 'var(--v3-muted,#98a2b8)';
  const render = mode => {
    modeBar.setActive(mode); mount.innerHTML = '';
    if (!lbState || !lbState.available){ const p=document.createElement('p'); p.className='muted pp-misfire-lb-unavailable'; p.style.fontSize='13px'; p.textContent='Misfire leaderboard is unavailable right now.'; mount.appendChild(p); return; }
    const ordered = mode === 'average' ? __sqLeagueAverageRows(lbState.rows) : (lbState.rows || []).slice();
    if (!ordered.length){ const p=document.createElement('p'); p.className='muted pp-misfire-lb-empty'; p.style.fontSize='13px'; p.textContent='No one has recorded this Misfire yet.'; mount.appendChild(p); return; }
    const list=document.createElement('div'); list.className='pp-misfire-lb'; list.style.cssText='display:flex;flex-direction:column;gap:6px;';
    let rankedIndex=0;
    ordered.forEach((r,i)=>{
      const eligible=mode!=='average'||__sqLeagueAverageEligible(r);
      const rankIndex=mode==='average'?(eligible?rankedIndex++:-1):i;
      const row=document.createElement('div'); row.className='pp-misfire-lb-row'; row.dataset.games=String(Math.max(0,Number(r.games_played)||0)); row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(127,29,29,.16);border:1px solid rgba(248,113,113,.16);';
      if(mode==='average'&&!eligible){row.classList.add('is-average-ineligible');row.style.opacity='.38';row.title='Minimum 6 eligible games required to rank';}
      const rk=document.createElement('span'); rk.className='pp-misfire-lb-rank'; rk.textContent=rankIndex>=0?('#'+(rankIndex+1)):'—'; rk.style.cssText='font-weight:900;min-width:30px;color:'+(rankIndex>=0?medal(rankIndex):'var(--v3-muted,#98a2b8)');
      const nm=document.createElement('span'); nm.className='pp-misfire-lb-name'; nm.textContent=r.name; nm.style.cssText='flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const val=document.createElement('span'); val.className='pp-misfire-lb-count'; val.textContent=mode==='average'?__sqLeagueAverageText(r):('×'+r.cnt); val.title=mode==='average'?((Number(r.cnt)||0)+' occurrence(s) over '+(Number(r.games_played)||0)+' eligible games'+(eligible?'':' · Not ranked until 6 eligible games')):''; val.style.cssText='font-weight:900;color:#fca5a5;white-space:nowrap;';
      row.append(rk,nm,val); list.appendChild(row);
    }); mount.appendChild(list);
  };
  modeBar.allBtn.onclick=()=>render('all'); modeBar.avgBtn.onclick=()=>render('average'); render('all');
  const foot=document.createElement('div'); foot.style.cssText='margin-top:14px;text-align:center;'; const cb=document.createElement('button'); cb.className='btn sq-pill'; cb.textContent='Close'; cb.onclick=()=>overlay.remove(); foot.appendChild(cb); body.appendChild(foot);
}

function __sqMisfireCase(misfireState, xpRow){
  const map = (misfireState && misfireState.map) || {};
  const card = document.createElement('div');
  card.className = 'tag pp-misfires';
  card.dataset.achievementSection = 'Misfires';
  card.style.cssText = 'padding:14px;border-radius:16px;background:rgba(239,68,68,.055);border:1px solid rgba(248,113,113,.22);';
  const head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;';
  const titleWrap = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = '⚠️ Misfires'; title.style.cssText = 'font-size:15px;color:#fecaca;';
  const sub = document.createElement('div'); sub.className = 'muted'; sub.style.cssText = 'font-size:11px;margin-top:2px;'; sub.textContent = 'Historical record · XP penalties are launch-forward only';
  titleWrap.append(title, sub);
  const status = document.createElement('div'); status.style.cssText = 'text-align:right;white-space:nowrap;';
  const unlocked = document.createElement('div'); unlocked.className = 'muted pp-misfire-unlocked'; unlocked.style.cssText = 'font-weight:800;font-size:12px;';
  const xp = document.createElement('div'); xp.className = 'pp-misfire-xp'; xp.style.cssText = 'font-weight:900;font-size:11px;margin-top:2px;color:#fecaca;';
  const xpKnown = !!(xpRow && Number.isFinite(Number(xpRow.misfire_xp)));
  const xpValue = xpKnown ? Number(xpRow.misfire_xp) : null;
  xp.textContent = xpKnown ? ((xpValue > 0 ? '+' : '') + String(xpValue) + ' XP') : 'XP —';
  status.append(unlocked, xp); head.append(titleWrap, status); card.appendChild(head);
  if (!misfireState || !misfireState.available){
    unlocked.textContent = '— / ' + SQ_MISFIRE.CATALOG.length + ' unlocked';
    const unavailable = document.createElement('div'); unavailable.className = 'muted'; unavailable.style.fontSize = '12px';
    unavailable.textContent = 'Misfire history is unavailable right now.'; card.appendChild(unavailable);
  } else {
    const total = SQ_MISFIRE.CATALOG.reduce((sum, x) => sum + Number((map[x.code] || {}).cnt || 0), 0);
    const earnedN = SQ_MISFIRE.CATALOG.filter(x => Number((map[x.code] || {}).cnt || 0) > 0).length;
    unlocked.textContent = earnedN + ' / ' + SQ_MISFIRE.CATALOG.length + ' unlocked';
    const totalLine = document.createElement('div'); totalLine.className = 'pp-misfire-total muted'; totalLine.style.cssText = 'font-size:11px;font-weight:800;margin:-3px 0 9px;';
    totalLine.textContent = total + ' historical occurrence' + (total === 1 ? '' : 's'); card.appendChild(totalLine);
    const grid = document.createElement('div'); grid.className = 'pp-misfire-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;';
    const badge = m => {
      const cnt = Number((map[m.code] || {}).cnt || 0); const earned = cnt > 0;
      const b = document.createElement('div'); b.className = 'pp-misfire-card'; b.dataset.code = m.code; b.dataset.count = String(cnt);
      b.title = m.desc + (cnt > 1 ? ('  (recorded ' + cnt + '×)') : '');
      b.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;cursor:pointer;padding:10px 6px;border-radius:12px;'
        + (earned ? 'background:linear-gradient(135deg,rgba(127,29,29,.48),rgba(69,10,10,.52));border:1px solid rgba(248,113,113,.45);'
                  : 'background:rgba(255,255,255,.03);border:1px dashed rgba(248,113,113,.18);opacity:.42;filter:grayscale(1);');
      const ic = document.createElement('div'); ic.textContent = m.icon; ic.style.cssText = 'font-size:26px;line-height:1;';
      const nm = document.createElement('div'); nm.className = 'pp-misfire-name'; nm.textContent = m.name; nm.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:.01em;color:' + (earned ? '#fecaca' : 'var(--v3-muted,#98a2b8)') + ';line-height:1.15;';
      const pen = document.createElement('div'); pen.className = 'pp-misfire-penalty'; pen.textContent = m.penalty + (m.stackPerDart ? ' XP / dart' : ' XP'); pen.style.cssText = 'font-size:9px;font-weight:900;color:#fca5a5;';
      b.append(ic, nm, pen); b.onclick = () => { try{ __sqMisfireDetail(m.code, map); }catch(_){ } };
      if (earned && cnt > 1){
        const bc = document.createElement('div'); bc.className = 'pp-misfire-count'; bc.textContent = '×' + cnt;
        bc.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff5f5;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);';
        b.appendChild(bc);
      }
      return b;
    };
    SQ_MISFIRE.CATALOG.forEach(m => { if (Number((map[m.code] || {}).cnt || 0) > 0) grid.appendChild(badge(m)); });
    SQ_MISFIRE.CATALOG.forEach(m => { if (!(Number((map[m.code] || {}).cnt || 0) > 0)) grid.appendChild(badge(m)); });
    card.appendChild(grid);
  }
  const foot = document.createElement('div'); foot.className = 'muted pp-misfire-foot'; foot.style.cssText = 'font-size:10px;line-height:1.35;margin-top:10px;';
  foot.textContent = 'Historical counts include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. For ordinary Misfires, only the worst penalty applies and the ordinary deduction is capped at 5 XP per game. Volde-D’eux and Volde-Trois stack at −2 XP per qualifying dart and are excluded from that cap.';
  card.appendChild(foot);
  return card;
}

// === Player Stats — one renderer shared by the hub and its content views ===
window.openPlayerStatsDialog = async function openPlayerStatsDialog(playerName, options){
  const name = String(playerName || '').trim();
  if (!name) { try{ toast('Pick a player'); }catch(_){ } return; }
  const opts = options || {};
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal sq-player-stats-content';
  modal.style.cssText = 'max-width:980px;width:94vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;';
  const body = document.createElement('div'); body.className = 'modal-body pp-anim';
  body.style.cssText = 'padding-top:8px;flex:1 1 auto;min-height:0;overflow-y:auto;';
  const footer = document.createElement('div'); footer.className = 'modal-footer';
  footer.style.cssText = 'justify-content:flex-start;gap:10px;flex-shrink:0;';
  let returned = false;
  const returnToHub = () => {
    if (returned) return;
    returned = true;
    overlay.remove();
    if (typeof opts.onReturn === 'function') opts.onReturn();
    else __sqGoBackToStatsMain(name);
  };
  const backBtn = document.createElement('button'); backBtn.className = 'btn sq-pill'; backBtn.textContent = 'Back';
  backBtn.onclick = returnToHub;
  footer.appendChild(backBtn);
  body.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
  modal.append(body, footer); overlay.appendChild(modal); document.body.appendChild(overlay);
  __sqStatsArcade(overlay, modal);
  // SC-028: both child controls return to the profile hub; hub Close exits.
  const closeBtn = document.createElement('button'); closeBtn.className = 'btn sq-pill'; closeBtn.textContent = 'Close';
  closeBtn.onclick = returnToHub; footer.appendChild(closeBtn);
  try{ if (window.sqModal && window.sqModal.register) window.sqModal.register(overlay, modal, returnToHub); }catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) returnToHub(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') returnToHub(); });
  modal.tabIndex = 0; modal.focus();
  try{
    const view = opts.view || await __sqBuildPlayerStatsProfile(name);
    if (returned || !overlay.isConnected) return;
    view.showTab(body, Number(opts.tab) || 0);
  }catch(e){
    if (returned || !overlay.isConnected) return;
    body.textContent = 'Player stats could not be loaded. Return to the hub to try again.';
    console.warn('[SQ] Player stats load failed', e);
  }
};

// Keep the existing markup, active states and panel animations in one place.
function __sqPlayerStatsView(profile, panels){
  const tabBar = document.createElement('div'); tabBar.className = 'pp-tabs';
  const tabs = ['Stats', 'XP', 'Achievements'].map((label, idx) => {
    const t = document.createElement('button'); t.type = 'button'; t.textContent = label;
    t.className = 'pp-tab' + (idx === 0 ? ' active' : '');
    tabBar.appendChild(t); return t;
  });
  profile.appendChild(tabBar);
  return { profile, tabs, showTab(host, idx){
    const panel = panels[idx] || panels[0];
    host.replaceChildren(panel);
    tabs.forEach((b, i) => b.classList.toggle('active', i === idx));
    try{ if (typeof panel.__ppReplay === 'function') requestAnimationFrame(panel.__ppReplay); }catch(_){}
  } };
}

// @CANONICAL:PLAYER_STATS_PROFILE_CARDS
async function __sqBuildPlayerStatsProfile(name){
  // Supabase client and all calculations below retain their existing sources.
  const SB = (typeof window !== 'undefined') ? (window.sb || window.__sb || window.supabase || window.supabaseClient || null) : null;

  // Helpers
  const monthKey = d => {
    const x = (d instanceof Date) ? d : (d ? new Date(d) : null);
    return x && !Number.isNaN(x.getTime()) ? `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}` : '';
  };
  const monthLabel = k => {
    if (!k) return '—';
    const [y,m] = k.split('-').map(Number);
    return new Date(y, m-1, 1).toLocaleString(undefined,{ month:'short', year:'numeric' }).toUpperCase();
  };

  // 1) All official games — fetched ONCE and reused for both the player's
  // slice and the local power-rank fallback (this used to be two full fetches).
  // Turbo games are excluded here so the whole profile is Standard-Official
  // only ("official" fetch alone doesn't strip Turbo).
  const __allGamesNorm = (await __fetchOfficialGames(50000)).map(__normalizeGame)
    .filter(g => !__sqGameLooksTurbo(g.raw));
  const games = __allGamesNorm
    .filter(g => Array.isArray(g.players) && g.players.some(p => String(p||'').trim().toLowerCase()===name.toLowerCase()))
    .sort((a,b)=> (new Date(a.ts) - new Date(b.ts)));

  // Preserve the existing empty state without inventing profile values.
  if (!games.length){
    const profile = document.createElement('div');
    const p = document.createElement('p'); p.className = 'muted';
    p.textContent = 'No official games found for this player.';
    profile.appendChild(p);
    return __sqPlayerStatsView(profile, [p.cloneNode(true), p.cloneNode(true), p.cloneNode(true)]);
  }

  // Index for this player and raw scores
  const idxOf = g => g.players.findIndex(p => String(p||'').trim().toLowerCase()===name.toLowerCase());
  const scores = games.map(g => Number(g.totals[idxOf(g)] || 0));

  // 2) Basic aggregates
  const GAMES = scores.length;
  const TOTAL = scores.reduce((s,v)=>s+v,0);
  const AVG   = GAMES ? (TOTAL / GAMES) : 0;
  const PB    = GAMES ? Math.max(...scores) : 0;
  const LOW   = GAMES ? Math.min(...scores) : 0;

  // 2.1) Canonical ranks / windows from DB views
  // - Power Rank: exact last-56 Official ranking rebuilt from the lightweight DB-derived
  //   v_player_game_scores_official_clean source, then filtered to the same active 14-day Current rule
  // - Highest Score place: v_player_best_official_ranked
  // - Favorite/Worst: v_player_last30_targets (throw-universe)
  let dbPower = null;
  let dbBest  = null;
  let dbFav   = null;
  let dbStreak = null;
  let dbRates = null;
  let savedPlayersRows = [];
  if (SB && typeof SB.from === 'function'){
    // All lookups are independent — run them in parallel (this used to be six
    // sequential round-trips and dominated the dialog's load time).
    const fkey = name.toLowerCase();
    const safeQ = q => Promise.resolve(q).catch(e => ({ error: e }));
    // The canonical last-56 view currently times out in the browser. This lighter DB-derived
    // source is equivalent for completed Official games: four games x 14 rounds = 56 rounds.
    // Keep the exact canonical ordering/rank semantics; do not substitute a different ranking view.
    const __sqFetchPlayerStatsPowerRows = async () => {
      const pageSize = 1000;
      const sourceRows = [];
      for (let from = 0, pageNo = 0; ; from += pageSize, pageNo++){
        if (pageNo >= 100) throw new Error('Player Stats Power Rank source exceeded safe page limit');
        const res = await SB.from('v_player_game_scores_official_clean')
          .select('game_id,ts,player_name,score')
          .order('ts', { ascending:false })
          .order('game_id', { ascending:false })
          .range(from, from + pageSize - 1);
        if (res && res.error) throw res.error;
        const page = (res && Array.isArray(res.data)) ? res.data : [];
        sourceRows.push(...page);
        if (page.length < pageSize) break;
      }
      const sourceKey = value => String(value || '').trim().toLowerCase();
      const sourceMs = value => { const n = Date.parse(String(value || '')); return Number.isFinite(n) ? n : 0; };
      const byPlayer = new Map();
      sourceRows.forEach(row => {
        const player = String((row && row.player_name) || '').trim();
        const score = Number(row && row.score);
        const key = sourceKey(player);
        if (!key || !Number.isFinite(score) || score <= 0) return;
        const list = byPlayer.get(key) || []; list.push(row); byPlayer.set(key, list);
      });
      const ranked = [];
      byPlayer.forEach((list, playerKey) => {
        list.sort((a,b) => (sourceMs(b.ts) - sourceMs(a.ts)) || String(b.game_id || '').localeCompare(String(a.game_id || '')));
        const latest = list.slice(0, 4); if (!latest.length) return;
        const total = latest.reduce((sum, row) => sum + Number(row.score || 0), 0);
        const rounds = latest.length * 14; const newest = latest[0];
        ranked.push({ player:String(newest.player_name || '').trim(), player_key:playerKey, rounds_used:rounds, total_points:total, avg_per_round:rounds ? Number((total / rounds).toFixed(2)) : 0, last_played_at:newest.ts || null, rank_pos:null });
      });
      ranked.sort((a,b) => (Number(b.avg_per_round) - Number(a.avg_per_round)) || (Number(b.rounds_used) - Number(a.rounds_used)) || (sourceMs(b.last_played_at) - sourceMs(a.last_played_at)) || String(a.player).localeCompare(String(b.player)));
      ranked.forEach((row, idx) => { row.rank_pos = idx + 1; });
      return { data: ranked, error: null };
    };
    const [savedRows, pr, bs, fv, tr, st] = await Promise.all([
      (async () => {
        let rows = [];
        try{
          if (typeof cloudListPlayers === 'function') rows = await cloudListPlayers();
        }catch(_){ rows = []; }
        if ((!rows || !rows.length) && typeof getSavedPlayers === 'function'){
          try{ rows = getSavedPlayers() || []; }catch(_){ rows = []; }
        }
        return rows || [];
      })(),
      safeQ(__sqFetchPlayerStatsPowerRows()),
      safeQ(SB.from('v_player_best_official_ranked')
        .select('player_name,best_score,best_score_pos')
        .ilike('player_name', name)
        .limit(1)),
      safeQ(SB.from('v_player_last30_targets')
        .select('player_key,favorite_number,favorite_pct,worst_number,worst_pct')
        .eq('player_key', fkey)
        .limit(1)),
      (typeof cloudIsTableMissing !== 'function' || !cloudIsTableMissing('v_player_last30_target_rates'))
        ? safeQ(SB.from('v_player_last30_target_rates')
            .select('player_key,target_n,hit_pct,throws')
            .eq('player_key', fkey)
            .order('hit_pct', { ascending: false }))
        : Promise.resolve(null),
      safeQ(SB.from('v_player_target_streaks')
        .select('player_key,player_name,mode_key,mode_label,dart_streak,round_streak,source_games,last_played_at')
        .eq('player_key', fkey.trim())
        .eq('mode_key', 'official')
        .limit(1))
    ]);

    savedPlayersRows = savedRows || [];
    try{
      const powerKey = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const savedMap = new Map((savedRows || []).map(p => {
        const n = String((p && (p.name || p.player_name || p.player || p.display_name)) || '').trim();
        return n ? [powerKey(n), n] : null;
      }).filter(Boolean));
      const parsePowerMs = ts => {
        try{
          if (!ts) return 0;
          let s = String(ts).trim();
          if (/^\d{4}-\d{2}-\d{2}\s/.test(s) && !s.includes('T')) s = s.replace(' ', 'T');
          if (/[+-]\d{2}$/.test(s)) s += ':00';
          const n = Date.parse(s);
          return Number.isFinite(n) ? n : 0;
        }catch(_){ return 0; }
      };
      if (pr && pr.error) throw pr.error;
      const nowMs = Date.now();
      const activeCutoff = nowMs - (14 * 24 * 60 * 60 * 1000);
      const rows = ((pr && pr.data) || []).map(r => {
        const k = powerKey(r.player_key || r.player);
        if (savedMap.size && !savedMap.has(k)) return null;
        const rounds = Math.max(0, Math.min(56, Number(r.rounds_used || 0)));
        const total = Number(r.total_points);
        const viewAvg = Number(r.avg_per_round);
        const avg = Number.isFinite(viewAvg) ? viewAvg : ((Number.isFinite(total) && rounds > 0) ? (total / rounds) : 0);
        const lastMs = parsePowerMs(r.last_played_at);
        const active = !lastMs || lastMs >= activeCutoff;
        return { player: savedMap.get(k) || String(r.player || '').trim(), playerKey: k, rounds, avg, lastMs, active, rankPos:Number(r.rank_pos || 0) || null };
      }).filter(r => r && r.player && r.rounds >= 28 && r.active && Number.isFinite(r.avg) && r.avg > 0)
        .sort((a,b) => (b.avg - a.avg) || (b.rounds - a.rounds) || (b.lastMs - a.lastMs) || String(a.player).localeCompare(String(b.player)));
      const mine = rows.find(r => r.playerKey === powerKey(name));
      dbPower = mine ? { player: mine.player, power_rank: mine.avg, power_rank_pos: mine.rankPos || (rows.indexOf(mine) + 1), last_played_at: mine.lastMs || null } : null;
    }catch(e){ try{ if(window.SQ_DEBUG) console.warn('[SQ] power rank view read failed', e); }catch(_){} }

    if (bs && bs.error) console.warn('[SQ] best score rank view read failed', bs.error);
    dbBest = (bs && !bs.error && bs.data && bs.data[0]) ? bs.data[0] : null;

    if (fv && fv.error) console.warn('[SQ] last30 targets view read failed', fv.error);
    dbFav = (fv && !fv.error && fv.data && fv.data[0]) ? fv.data[0] : null;

    // Top/bottom 3 target rates (last 30 games) for Targets section
    dbRates = (tr && !tr.error && Array.isArray(tr.data)) ? tr.data : null;

    if (st && st.error) {
      console.warn('[SQ] target streaks view is missing required mode columns', st.error);
    } else {
      dbStreak = (st && !st.error && st.data && st.data[0]) ? st.data[0] : null;
    }
  }

  // Per-game ranks (1st place detection) and per-month buckets
  const monthly = new Map(); // key -> { sum, n, wins }
  games.forEach((g,i)=>{
    const meI = idxOf(g);
    const meS = Number(g.totals[meI] || 0);
    const max = Math.max(...(g.totals||[]).map(Number));
    const win = meS === max ? 1 : 0;

    const k = monthKey(g.ts);
    const rec = monthly.get(k) || { sum:0, n:0, wins:0 };
    rec.sum += meS; rec.n += 1; rec.wins += win;
    monthly.set(k, rec);
  });

  // Highest/lowest monthly averages
  const monthlyRows = Array.from(monthly.entries()).map(([k,rec])=>({ k, avg: rec.n ? rec.sum/rec.n : 0, wins: rec.wins }));
  monthlyRows.sort((a,b)=> a.k.localeCompare(b.k));
  const bestMonth = monthlyRows.length ? monthlyRows.reduce((m,r)=> r.avg>m.avg?r:m, monthlyRows[0]) : null;
  const worstMonth= monthlyRows.length ? monthlyRows.reduce((m,r)=> r.avg<m.avg?r:m, monthlyRows[0]) : null;

  // PL Average (career) & PL Monthly Wins (current month)
const nowK = monthKey(new Date());

// Premier League "Monthly Wins":
// # of months this player finished 1st by monthly average (min 3 games)
function computePLMonthlyWinsTop(games, minGames = 3, me = name){
  const byMonthPlayer = new Map(); // `${month}|${player}` -> { sum, n }

  games.forEach(g=>{
    const mk = monthKey(g.ts);
    (g.players||[]).forEach((p,i)=>{
      const key = `${mk}|${p}`;
      const rec = byMonthPlayer.get(key) || { sum:0, n:0 };
      rec.sum += Number(g.totals[i] || 0);
      rec.n   += 1;
      byMonthPlayer.set(key, rec);
    });
  });

  const months = new Set(Array.from(byMonthPlayer.keys()).map(k=>k.split('|')[0]));
  let wins = 0;

  months.forEach(mk=>{
    const contenders = [];
    byMonthPlayer.forEach((rec,key)=>{
      const [k,p] = key.split('|');
      if (k !== mk) return;
      if (rec.n >= minGames) contenders.push({ player:p, avg: rec.sum/rec.n });
    });
    if (!contenders.length) return;
    contenders.sort((a,b)=> b.avg - a.avg);
    if (contenders[0].player.toLowerCase() === me.toLowerCase()) wins += 1;
  });

  return wins;
}
const plMonthlyWins = computePLMonthlyWinsTop(games, 3, name);

 // 3) Highest Scoring Round (10→20 only) with S/D/T breakdown — robust via boards
function bestRoundFromBoards(playerName, games){
  const nameLC = String(playerName||'').trim().toLowerCase();
  let best = null;

  games.forEach(g=>{
    const pIdx = (g.players||[]).findIndex(p => String(p||'').trim().toLowerCase()===nameLC);
    if (pIdx < 0) return;
    const b = g.board; if (!b) return;

    const looksA = Array.isArray(b[pIdx]);
    const looksB = Array.isArray(b[0]) && Array.isArray(b[0][pIdx]);
    const rounds = looksA ? b[pIdx] : (looksB ? b.map(r => r ? r[pIdx] : null) : []);

    for (let r = 0; r < Math.min(14, rounds.length || 0); r++){
      if (r > 10) break; // 10..20 only
      const cell = rounds[r]; if (!cell) continue;

      const list = Array.isArray(cell)
        ? cell
        : (Array.isArray(cell.throws) ? cell.throws : (Array.isArray(cell.darts) ? cell.darts : []));

      let sum = 0, s = 0, d = 0, t = 0;
      const target = 10 + r;

      list.forEach(tw=>{
        const ringRaw = (tw?.kind || tw?.type || tw?.segment || tw?.ring || '').toString().toLowerCase();
        let mult = Number(tw?.mult ?? tw?.multiplier);
        if (!mult || !Number.isFinite(mult)) {
          // infer multiplier from points if needed
          const pts = Number(tw?.points ?? tw?.score ?? 0);
          const ratio = target ? (pts/target) : 0;
          if (ratio >= 2.5) mult = 3;
          else if (ratio >= 1.5) mult = 2;
          else mult = pts>0 ? 1 : 0;
        }
        const pts = Number.isFinite(Number(tw?.points ?? tw?.score))
          ? Number(tw?.points ?? tw?.score)
          : (target * mult);

        sum += pts;
        if (mult === 3 || ringRaw.includes('treb')) t++;
        else if (mult === 2 || ringRaw.includes('doub')) d++;
        else if (mult === 1) s++;
      });

      if (!best || sum > best.sum) best = { round: 10+r, sum, s, d, t };
    }
  });

  return best;
}
const bestRound = bestRoundFromBoards(name, games) || null;

  // 4) H2H for Nemesis/BFF (>=10 games vs opponent)
  const vs = new Map();
  games.forEach(g=>{
    const meI = idxOf(g), meS = Number(g.totals[meI]||0);
    g.players.forEach((op,j)=>{
      if (j===meI) return;
      const opp = String(op||'').trim();
      const theirs = Number(g.totals[j]||0);
      const rec = vs.get(opp) || { opp, W:0, L:0, n:0 };
      if (meS > theirs) rec.W++; else if (meS < theirs) rec.L++;
      rec.n++; vs.set(opp, rec);
    });
  });
const qualifiedOpp = Array.from(vs.values()).filter(r=> r.n >= 5).map(r=>({ ...r, pct: (r.W+r.L) ? (100*r.W/(r.W+r.L)) : 0 }));  const bff = qualifiedOpp.length ? qualifiedOpp.reduce((m,r)=> r.pct>m.pct?r:m, qualifiedOpp[0]) : null;
  const nem = qualifiedOpp.length ? qualifiedOpp.reduce((m,r)=> r.pct<m.pct?r:m, qualifiedOpp[0]) : null;

  // lifetime, from the games we already loaded at the top of this function
const myThrowsFromBoards = __throwsFromGamesForPlayer(name, games);
let onlyTargetRounds = [];
if (Array.isArray(myThrowsFromBoards) && myThrowsFromBoards.length) {
  onlyTargetRounds = myThrowsFromBoards.filter(
    t => typeof t.round_index === 'number' && t.round_index >= 0 && t.round_index <= 10 // 10..20 only
  );
}

  // Reuse same hits model: “marks per dart” (single=1, double=2, treble=3)
  const markUnits = (t, target) => {
    const k = String(t.kind||'').toLowerCase();
    if (k.includes('treble') || k.includes('triple')) return 3;
    if (k.includes('double')) return 2;
    if (k.includes('single')) return Number(t.points||0)>0 ? 1 : 0;
    const ratio = Number(t.points||0) / target; // fallback
    if (ratio >= 2.5) return 3; if (ratio >= 1.5) return 2; if (ratio >= 0.5) return 1; return 0;
  };
  const favRows = [];
  for (let r=0; r<=10; r++){
    const target = 10 + r;
    const shots  = onlyTargetRounds.filter(t => t.round_index === r);
    const throwsN = shots.length;
    const hitsUnits = shots.reduce((s,t)=> s + markUnits(t,target), 0);
    const pct = throwsN ? (100 * hitsUnits / (3*throwsN)) : 0; // units ÷ (3 per throw)
    favRows.push({ target, throwsN, pct });
  }
  // require a small sample to avoid noise
  const MIN_THROWS_PER_TARGET = 30;
  const favCandidates = favRows.filter(r => r.throwsN >= MIN_THROWS_PER_TARGET);
  const fav = favCandidates.length ? favCandidates.reduce((m,r)=> r.pct>m.pct?r:m, favCandidates[0]) : null;
  const worst = favCandidates.length ? favCandidates.reduce((m,r)=> r.pct<m.pct?r:m, favCandidates[0]) : null;

// 6) Current Power Rank — the DB view (dbPower) is the single source of
// truth; this local recomputation runs ONLY when the view is unavailable,
// so the Quick Stats row can never disagree with the hero tile.
let myPower = null, myPowerPos = null;
if (!dbPower){
const MIN_ROUNDS_QUALIFY = 28;   // 2 games (28 rounds)
const WINDOW_ROUNDS      = 56;   // last 56 rounds

// All official games (reused from the single fetch at the top)
const allGames = __allGamesNorm;

// Map game_id -> timestamp (for ordering rounds)
const gameTs = new Map();
allGames.forEach(g => {
  const gid = (g.raw && (g.raw.id || g.raw.game_id)) || g.id || g.game_id;
  if (gid) gameTs.set(gid, g.ts || null);
});

// Fetch throws for all those games; fallback to reconstruct from boards
let allThrows = [];
try {
  const allIds = allGames
    .map(g => (g.raw && (g.raw.id || g.raw.game_id)) || g.id || g.game_id)
    .filter(Boolean);
  allThrows = await __fetchThrowsForGames(allIds);
} catch (_) {}

if (!allThrows.length) {
  // fallback: synthesize from boards
  allGames.forEach(g => {
    (g.players || []).forEach(p => {
      const rows = __throwsFromGamesForPlayer(p, [g]);
      if (rows && rows.length) allThrows.push(...rows);
    });
  });
}

// Keep only real round rows and finite points
allThrows = allThrows.filter(t =>
  typeof t.round_index === 'number' &&
  t.round_index >= 0 && t.round_index <= 13 &&
  Number.isFinite(Number(t.points))
);

// Aggregate to per-player round totals, ordered by (game ts, round index)
const roundsByPlayer = new Map(); // player -> [{ts, ri, pts}, ...]
allThrows.forEach(t => {
  const player = String(t.player || '').trim();
  if (!player) return;
  const gid = t.game_id;
  const ts  = gameTs.get(gid) || null;
  const ri  = Number(t.round_index || 0);
  const pts = Number(t.points || 0);

  // key per game+round so multiple darts sum to that round
  const bucketKey = `${gid}|${ri}`;
  let list = roundsByPlayer.get(player);
  if (!list) { list = []; roundsByPlayer.set(player, list); }

  // find or create that round entry
  let entry = list.find(e => e.key === bucketKey);
  if (!entry) {
    entry = { key: bucketKey, ts, ri, sum: 0 };
    list.push(entry);
  }
  entry.sum += pts;
});

// Build power rows: last 56 rounds -> avg per round; qualify if >= 28 rounds (2 games)
const powerRows = Array.from(roundsByPlayer.entries()).map(([player, list]) => {
  // order by time then round index
  list.sort((a, b) => {
    const at = a.ts ? new Date(a.ts).getTime() : 0;
    const bt = b.ts ? new Date(b.ts).getTime() : 0;
    return (at - bt) || (a.ri - b.ri);
  });

  const last     = list.slice(-WINDOW_ROUNDS);
  const n        = last.length;
  const pts      = last.reduce((s, r) => s + Number(r.sum || 0), 0);
  const avgRound = n ? (pts / n) : 0;
  const recentTs = last.length ? (last[last.length - 1].ts || 0) : 0;
  const qualifies = n >= MIN_ROUNDS_QUALIFY;

  return { player, rounds: n, avgRound, recentTs, qualifies };
});

// Sort using the same tie-breakers as the Power Rankings table:
// 1) avg/round ↓, 2) rounds ↓, 3) most-recent ts ↓, 4) player name ↑
const qualified = powerRows
  .filter(r => r.qualifies)
  .sort((a, b) =>
    (b.avgRound - a.avgRound) ||
    (b.rounds   - a.rounds)   ||
    (b.recentTs - a.recentTs) ||
    String(a.player).localeCompare(String(b.player))
  );

// My row + absolute position among qualified
myPower = qualified.find(
  r => r.player.toLowerCase() === name.toLowerCase()
) || null;

myPowerPos = myPower ? (qualified.indexOf(myPower) + 1) : null;
}

  // Single-sourced Power Rank position (view first, local fallback)
  const powerPosValue = (dbPower && Number.isFinite(Number(dbPower.power_rank_pos)))
    ? `#${Number(dbPower.power_rank_pos)}`
    : (myPowerPos ? `#${myPowerPos}` : '—');

  // Best-score leaderboard rank (use each player's PB across all games)
  const bestByPlayer = new Map();
  games.forEach(g=>{
    (g.players||[]).forEach((p,i)=>{
      const s = Number(g.totals[i]||0);
      const prev = bestByPlayer.get(p) || 0;
      if (s > prev) bestByPlayer.set(p, s);
    });
  });
  const bestList = Array.from(bestByPlayer.entries()).map(([p,b])=>({p,b})).sort((a,b)=> b.b - a.b);
  const myPB = PB;
  const myPBPos = myPB ? (bestList.findIndex(x => x.p.toLowerCase()===name.toLowerCase()) + 1 || null) : null;

  // ---- Render as a mobile-first player profile screen ----------------------
  const fmtValue = v => (v == null || v === '' || v === '—') ? '—' : String(v);
  const rankValue = (dbPower && Number.isFinite(Number(dbPower.power_rank)) && Number.isFinite(Number(dbPower.power_rank_pos)))
    ? `${Number(dbPower.power_rank).toFixed(2)} (#${Number(dbPower.power_rank_pos)})`
    : '—';
  // Rank falls back to the locally computed PB leaderboard position when the
  // view is unreachable, and drops the "(#—)" noise when neither is known.
  const pbRank = (dbBest && dbBest.best_score_pos) ? dbBest.best_score_pos : myPBPos;
  const highestScoreValue = PB ? (pbRank ? `${PB} (#${pbRank})` : String(PB)) : '—';
  const bestMonthValue = bestMonth ? `${bestMonth.avg.toFixed(1)} (${monthLabel(bestMonth.k)})` : '—';
  const worstMonthValue = worstMonth ? `${worstMonth.avg.toFixed(1)} (${monthLabel(worstMonth.k)})` : '—';
  function lettersFromCounts(s,d,t){
    return `${'S'.repeat(s).split('').join('/')}${s&& (d||t)?'/':''}${'D'.repeat(d).split('').join('/')}${d&&t?'/':''}${'T'.repeat(t).split('').join('/')}`.replace(/^\/|\/$/g,'') || '—';
  }
  const brTxt = bestRound ? `${bestRound.round} · ${bestRound.sum} (${lettersFromCounts(bestRound.s, bestRound.d, bestRound.t)})` : '—';
  const topNem = qualifiedOpp.slice().sort((a,b)=> a.pct-b.pct || (b.n-a.n) || a.opp.localeCompare(b.opp)).slice(0,3);
  const topBff = qualifiedOpp.slice().sort((a,b)=> b.pct-a.pct || (b.n-a.n) || a.opp.localeCompare(b.opp)).slice(0,3);
  const fmtOpp = arr => arr.length ? arr.map((r,i)=> `${i+1}. ${r.opp} (${r.pct.toFixed(1)}%)`).join('\n') : '—';

  const MIN_THROWS_PER_TARGET_LOCAL = 30;
  let top3Arr = null, bot3Arr = null;
  if (typeof dbRates !== 'undefined' && Array.isArray(dbRates) && dbRates.length){
    const cand = dbRates.filter(r => Number(r.throws||0) >= MIN_THROWS_PER_TARGET_LOCAL);
    if (cand.length){
      top3Arr = cand.slice().sort((a,b)=> (Number(b.hit_pct)-Number(a.hit_pct)) || (Number(b.throws)-Number(a.throws)) || (Number(a.target_n)-Number(b.target_n))).slice(0,3);
      bot3Arr = cand.slice().sort((a,b)=> (Number(a.hit_pct)-Number(b.hit_pct)) || (Number(b.throws)-Number(a.throws)) || (Number(a.target_n)-Number(b.target_n))).slice(0,3);
    }
  }
  // Plain-text fallbacks when the rates view has no qualifying sample
  const favValue = dbFav ? `${dbFav.favorite_number} (${Number(dbFav.favorite_pct).toFixed(1)}%)` : (fav ? `${fav.target} (${fav.pct.toFixed(1)}%)` : '—');
  const weakValue = dbFav ? `${dbFav.worst_number} (${Number(dbFav.worst_pct).toFixed(1)}%)` : (worst ? `${worst.target} (${worst.pct.toFixed(1)}%)` : '—');
  // Nickname: picker cache first, then the saved-players rows we already
  // fetched — so direct opens (leaderboard links etc.) still show it.
  let nick = (typeof __sqPlayerStatsNickname === 'function') ? __sqPlayerStatsNickname(name, window.__sqPlayerStatsPlayers || []) : '';
  if (!nick && savedPlayersRows.length){
    const nk = name.trim().toLowerCase();
    const row = savedPlayersRows.find(p => String((p && (p.name || p.player_name || p.player || p.display_name)) || '').trim().toLowerCase() === nk);
    nick = String((row && (row.nickname || row.nick || row.alias)) || '').trim();
  }
  const streakValue = v => Number.isFinite(Number(v)) ? String(Math.max(0, Math.trunc(Number(v)))) : '—';
  const dartStreakValue = dbStreak ? streakValue(dbStreak.dart_streak) : '—';
  const roundStreakValue = dbStreak ? streakValue(dbStreak.round_streak) : '—';

  const profile = document.createElement('div');
  profile.className = 'pp-anim';
  profile.style.display = 'flex';
  profile.style.flexDirection = 'column';
  profile.style.gap = '12px';

  // Count a numeric value up from 0 (skipped under prefers-reduced-motion)
  const __ppReduced = (() => { try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; } })();
  const countUp = (el, txt, dur=650) => {
    const m = String(txt).match(/^([\d,]+(?:\.\d+)?)([\s\S]*)$/);
    if (__ppReduced || !m){ el.textContent = txt; return; }
    const numStr = m[1].replace(/,/g, '');
    const target = parseFloat(numStr); const rest = m[2] || '';
    const dec = (numStr.split('.')[1] || '').length;
    const hadComma = m[1].indexOf(',') >= 0;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = target * eased;
      el.textContent = (hadComma ? Number(cur.toFixed(dec)).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) : cur.toFixed(dec)) + rest;
      if (p < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  };

  const hero = document.createElement('div');
  hero.className = 'tag pp-hero';
  const heroName = document.createElement('div');
  heroName.textContent = name;
  heroName.className = 'pp-hero-name';
  const heroNick = document.createElement('div');
  heroNick.textContent = nick || 'Player profile';
  heroNick.className = 'muted pp-hero-nick';
  const heroTiles = document.createElement('div');
  heroTiles.className = 'pp-tiles';
  const tile = (label, value) => {
    const t = document.createElement('div');
    t.className = 'pp-tile';
    const l = document.createElement('div'); l.className = 'muted pp-tile-label'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'pp-tile-value';
    countUp(v, fmtValue(value));
    t.append(l, v);
    return t;
  };
  heroTiles.append(tile('Power Rank', rankValue), tile('Games', GAMES), tile('PL AVG', AVG.toFixed(1)));

  // XP / level: a "LV n · TITLE" chip beside the name and a progress bar.
  let xpProg = null, xpRow = null, achState = { available:false, map:{} }, misfireState = { available:false, map:{} };
  try{
    const xr = await SQ_XP.forName(name).catch(()=>null);
    xpRow = xr || null;
    if (xpRow){
      xpProg = SQ_XP.progress(xpRow.total_xp);
      const [as, mf] = await Promise.all([
        SQ_ACH.forPlayerId(xpRow.player_id).catch(()=>({ available:false, map:{} })),
        SQ_MISFIRE.forPlayerId(xpRow.player_id).catch(()=>({ available:false, map:{} }))
      ]);
      achState = as || { available:false, map:{} };
      misfireState = mf || { available:false, map:{} };
    }
  }catch(_){ }
  const achMap = achState.map || {};
  const misfireMap = misfireState.map || {};
  if (xpProg){
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;flex-wrap:nowrap;justify-content:space-between;';
    const levelChip = __sqXpChip(xpProg);
    levelChip.style.marginLeft = 'auto';
    levelChip.style.flex = '0 0 auto';
    nameRow.append(heroName, levelChip);
    hero.append(nameRow, heroNick, heroTiles, __sqXpBar(xpProg));
  } else {
    hero.append(heroName, heroNick, heroTiles);
  }
  profile.appendChild(hero);

  const cards = document.createElement('div');
  cards.className = 'pp-cards';

  const iconSvg = {
    quick:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>',
    league:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v3a5 5 0 0 1-10 0V4z"/></svg>',
    tournament:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M6 6v5a6 6 0 0 0 12 0V6"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
    turbo:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 10-13h-7l0-7z"/></svg>',
    target:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    rivals:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l16 16"/><path d="M7 7h.01"/><path d="M17 17h.01"/></svg>',
    achievements:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v3a5 5 0 0 1-10 0V4z"/><path d="M5 5H3v2a4 4 0 0 0 4 4"/><path d="M19 5h2v2a4 4 0 0 1-4 4"/></svg>'
  };
  // Value may be a string OR a prebuilt node (rank chips, target bars, …).
  const statRow = (label, value, muted) => {
    const row = document.createElement('div');
    row.className = 'pp-row' + (muted ? ' muted' : '');
    const l = document.createElement('span'); l.className = 'pp-row-label' + (muted ? ' muted' : ''); l.textContent = label;
    const v = document.createElement('span'); v.className = 'pp-row-value' + (muted ? ' muted' : '');
    if (value instanceof Node) v.appendChild(value); else v.textContent = fmtValue(value);
    row.append(l, v);
    return row;
  };
  const statCard = (titleTxt, icon, rows, opts={}) => {
    const c = document.createElement('div');
    c.className = 'tag pp-card';
    if (opts.muted) { c.style.borderStyle = 'dashed'; c.style.opacity = '.84'; }
    const head = document.createElement('div');
    head.className = 'pp-card-head';
    const ico = document.createElement('span'); ico.className = 'pp-ico'; ico.innerHTML = icon || '';
    const ttl = document.createElement('strong'); ttl.textContent = titleTxt;
    head.append(ico, ttl); c.appendChild(head);
    rows.forEach(r => c.appendChild(statRow(r[0], r[1], opts.muted || r[2])));
    if (opts.footer){ const f = document.createElement('p'); f.className = 'muted'; f.style.margin = '8px 0 0'; f.style.fontSize = '12px'; f.textContent = opts.footer; c.appendChild(f); }
    return c;
  };
  // "168 (#38)" with the rank chip coloured (gold/silver/bronze on the podium)
  const withRank = (mainTxt, pos) => {
    const wrap = document.createElement('span');
    const main = document.createElement('span'); countUp(main, mainTxt);
    wrap.appendChild(main);
    const p = Number(pos);
    if (Number.isFinite(p) && p > 0){
      const chip = document.createElement('span');
      chip.className = 'pp-pos' + (p <= 3 ? ' g' + p : '');
      chip.textContent = `(#${p})`;
      wrap.appendChild(chip);
    }
    return wrap;
  };
  // streak value with a flame once it starts getting spicy
  const streakNode = (txt) => {
    const s = document.createElement('span');
    countUp(s, txt);
    if (Number(txt) >= 3) s.classList.add('pp-hot');
    return s;
  };
  // "1. 19 (61.1%)" lines with a mini hit-rate bar under each
  const targetListNode = (arr, cold) => {
    const box = document.createElement('span');
    box.style.display = 'inline-block'; box.style.minWidth = '150px';
    arr.forEach((r, i) => {
      const line = document.createElement('span'); line.className = 'pp-tline';
      line.textContent = `${i + 1}. ${r.target_n} (${Number(r.hit_pct).toFixed(1)}%)`;
      const bar = document.createElement('span'); bar.className = 'pp-bar' + (cold ? ' cold' : '');
      bar.style.display = 'block';
      const fill = document.createElement('span');
      const w = Math.max(2, Math.min(100, Number(r.hit_pct) || 0)) + '%';
      // set after mount so the CSS width transition plays the grow-in
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = w; }));
      bar.appendChild(fill);
      box.append(line, bar);
    });
    return box;
  };

  // XP & Level card (lives in the XP tab)
  const xpCard = statCard('XP & Level', iconSvg.achievements, xpRow ? [
      ['Level', `${xpProg.level} · ${xpProg.title}`],
      ['Total XP', SQ_XP.fmt(xpProg.xp)],
      ['From Points', SQ_XP.fmt(Math.round((xpRow.points_scored||0) * SQ_XP.W.point)) + ` (${SQ_XP.fmt(xpRow.points_scored)} pts)`],
      ['From Games', SQ_XP.fmt((xpRow.games_played||0) * SQ_XP.W.game) + ` (${xpRow.games_played})`],
      ['From Wins', SQ_XP.fmt((xpRow.games_won||0) * SQ_XP.W.gameWin + (xpRow.matches_won||0) * SQ_XP.W.matchWin) + ` (${xpRow.games_won}G / ${xpRow.matches_won}M)`],
      ['From Milestones', SQ_XP.fmt((xpRow.milestones||0) * SQ_XP.W.milestone) + ` (${xpRow.milestones})`],
      ['From Trophies', SQ_XP.fmt(xpRow.ach_xp||0) + ` (${xpRow.badges||0} badges)`]
    ] : [
      ['Level', 'No ranked games yet', true]
    ], xpRow ? { footer: xpProg.atMax ? 'Max level reached — Legend.' : `${SQ_XP.fmt(xpProg.toNext)} XP to Level ${xpProg.level + 1}.` } : { muted: true });

  const highestScoreNode = PB
    ? (pbRank ? withRank(`${PB} `, pbRank) : String(PB))
    : '—';
  const powerPosNode = (powerPosValue !== '—')
    ? (() => { const s = document.createElement('span'); const p = Number(powerPosValue.slice(1)); s.className = 'pp-pos' + (p <= 3 ? ' g' + p : ''); s.textContent = powerPosValue; return s; })()
    : '—';
  cards.append(
    statCard('Quick Stats', iconSvg.quick, [
      ['Highest Score', highestScoreNode],
      ['Lowest Score', GAMES ? String(LOW) : '—'],
      ['Current Power Rank', powerPosNode],
      ['Highest Scoring Round', brTxt],
      ['Dart Streak', dbStreak ? streakNode(dartStreakValue) : dartStreakValue, !dbStreak],
      ['Round Streak', dbStreak ? streakNode(roundStreakValue) : roundStreakValue, !dbStreak]
    ]),
    statCard('Premier League', iconSvg.league, [
      ['PL Average', AVG.toFixed(1)],
      ['PL Monthly Wins', String(plMonthlyWins)],
      ['Best Month', bestMonthValue],
      ['Worst Month', worstMonthValue]
    ]),
    statCard('Targets', iconSvg.target, [
      ['Favourite Numbers', top3Arr ? targetListNode(top3Arr, false) : favValue],
      ['Weakest Numbers', bot3Arr ? targetListNode(bot3Arr, true) : weakValue]
    ]),
    statCard('Rivals', iconSvg.rivals, [
      ['Nemesis', fmtOpp(topNem)],
      ['Favourite Victims', fmtOpp(topBff)]
    ]),
    statCard('Rivalry', iconSvg.rivals, [
      ['Giant Slayer', (achMap.giant_slayer ? `${achMap.giant_slayer.cnt} upset${achMap.giant_slayer.cnt>1?'s':''}` : '—'), !achMap.giant_slayer],
      ['Nemesis wins', (achMap.nemesis ? `${achMap.nemesis.cnt}` : '—'), !achMap.nemesis],
      ['Champion', (achMap.champion ? `${achMap.champion.cnt}` : '—'), !achMap.champion]
    ])
  );
  // Tournament + Turbo tracking isn't live yet — one slim teaser strip instead
  // of two dead cards full of "Tracking soon" rows.
  {
    const soon = document.createElement('div');
    soon.className = 'tag pp-soon';
    const ic = document.createElement('span'); ic.className = 'pp-ico'; ic.innerHTML = iconSvg.tournament;
    const tx = document.createElement('span'); tx.className = 'muted pp-soon-txt';
    tx.textContent = 'Tournament & Turbo stats — coming soon';
    soon.append(ic, tx);
    cards.appendChild(soon);
  }

  // ---- FORM panel: win-rate gauge + verdict stamp + recent-games strip ----
  // Mirrors the Target Progress "form arena" (reuses __sqDrawFormGauge).
  {
    const winFlags = games.map(g => {
      const i = idxOf(g); const s = Number(g.totals[i] || 0);
      return s === Math.max(...(g.totals || []).map(Number)) ? 1 : 0;
    });
    const W = winFlags.reduce((a, b) => a + b, 0);
    const winRate = GAMES ? (100 * W / GAMES) : 0;
    const recent = scores.slice(-5);
    const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const dPct = AVG ? ((recentAvg - AVG) / AVG) * 100 : 0;
    const v = dPct >= 5   ? { label:'ON FIRE',  color:'#ffa440', glow:'rgba(255,140,40,.45)', arrow:'↑' }
      :       dPct >= 1.5 ? { label:'CLIMBING', color:'#73f07e', glow:'rgba(115,240,126,.4)', arrow:'↑' }
      :       dPct > -1.5 ? { label:'STEADY',   color:'#4aa3ff', glow:'rgba(74,163,255,.4)', arrow:'→' }
      :                     { label:'COOLING',  color:'#7cc0ff', glow:'rgba(124,192,255,.35)', arrow:'↓' };

    const panel = document.createElement('div');
    panel.className = 'pp-form';
    const gaugeCanvas = document.createElement('canvas');
    gaugeCanvas.style.cssText = 'width:170px;height:104px;flex:0 0 auto;';
    const info = document.createElement('div'); info.className = 'pp-form-info';
    const val = document.createElement('div'); val.className = 'pp-form-value';
    const stamp = document.createElement('span'); stamp.className = 'pp-verdict';
    stamp.style.color = v.color; stamp.style.border = '1px solid ' + v.color;
    stamp.style.boxShadow = '0 0 14px ' + v.glow + ', inset 0 0 10px ' + v.glow;
    stamp.textContent = v.arrow + ' ' + v.label;
    const sub = document.createElement('div'); sub.className = 'pp-form-sub';
    sub.textContent = 'Win rate — official (' + W + 'W / ' + (GAMES - W) + 'L)';
    info.append(val, stamp, sub);
    panel.append(gaugeCanvas, info);

    // hot/cold strip: one cell per recent game, height scaled by score vs PB
    const stripWrap = document.createElement('div'); stripWrap.className = 'pp-strip-wrap';
    const stripLabel = document.createElement('div'); stripLabel.className = 'pp-strip-label';
    const lastGames = games.slice(-14);
    stripLabel.textContent = 'Last ' + lastGames.length + ' games';
    const strip = document.createElement('div'); strip.className = 'pp-strip';
    lastGames.forEach((g, i) => {
      const gi = games.length - lastGames.length + i;
      const s = scores[gi] || 0;
      const cell = document.createElement('span');
      cell.className = 'pp-strip-cell' + (winFlags[gi] ? ' win' : '');
      const h = Math.round(8 + 24 * (PB ? Math.max(0, Math.min(1, s / PB)) : 0));
      cell.style.height = __ppReduced ? h + 'px' : '8px';
      if (!__ppReduced) requestAnimationFrame(() => requestAnimationFrame(() => { cell.style.height = h + 'px'; }));
      try{
        const d = g.ts ? new Date(g.ts) : null;
        cell.title = s + ' pts' + (d && !Number.isNaN(d.getTime()) ? ' · ' + d.toLocaleDateString() : '');
      }catch(_){ }
      strip.appendChild(cell);
    });
    stripWrap.append(stripLabel, strip);
    panel.appendChild(stripWrap);

    // needle sweep + value count-up
    const finalTxt = winRate.toFixed(0) + '%';
    if (typeof __sqDrawFormGauge === 'function'){
      if (__ppReduced){ __sqDrawFormGauge(gaugeCanvas, winRate, 50, 1); val.textContent = finalTxt; }
      else {
        countUp(val, finalTxt, 900);
        const t0 = performance.now();
        const sweep = (t) => {
          const p = Math.min(1, (t - t0) / 900);
          __sqDrawFormGauge(gaugeCanvas, winRate, 50, 1 - Math.pow(1 - p, 3));
          if (p < 1) requestAnimationFrame(sweep);
        };
        requestAnimationFrame(sweep);
      }
    } else { gaugeCanvas.remove(); val.textContent = finalTxt; }
    cards.prepend(panel);
  }

  // staggered entrance: hero leads, cards follow one by one
  Array.prototype.forEach.call(cards.children, (c, i) => { c.style.animationDelay = (80 + i * 70) + 'ms'; });
  // ---- Tabbed content: Stats / XP / Achievements ----
  const statsPanel = cards;
  const xpPanel = document.createElement('div');
  xpPanel.className = 'pp-cards';

  // ---- XP tab hero: "XP CORE" reactor (unique to the XP tab) ----
  {
    const prog = xpProg || { level:1, title:'Rookie', pct:0, xp:0, toNext:0, atMax:false };
    const orb = document.createElement('div'); orb.className = 'pp-xporb';
    const stage = document.createElement('div'); stage.className = 'pp-orb-stage';
    const canvas = document.createElement('canvas');
    const center = document.createElement('div'); center.className = 'pp-orb-center';
    const lvtag = document.createElement('div'); lvtag.className = 'pp-orb-lvtag'; lvtag.textContent = 'Level';
    const lvnum = document.createElement('div'); lvnum.className = 'pp-orb-level'; lvnum.textContent = String(prog.level);
    const lvttl = document.createElement('div'); lvttl.className = 'pp-orb-title'; lvttl.textContent = prog.title;
    center.append(lvtag, lvnum, lvttl); stage.append(canvas, center);
    const info = document.createElement('div'); info.className = 'pp-orb-info';
    const ohead = document.createElement('div'); ohead.className = 'pp-orb-head'; ohead.textContent = 'XP Core';
    const oxp = document.createElement('div'); oxp.className = 'pp-orb-xp'; oxp.textContent = SQ_XP.fmt(prog.xp);
    const oseg = document.createElement('div'); oseg.className = 'pp-orb-seg';
    const SEGN = 12, onN = Math.round(prog.pct * SEGN);
    for (let i = 0; i < SEGN; i++){ const s = document.createElement('i'); if (i < onN) s.className = 'on'; oseg.appendChild(s); }
    const onext = document.createElement('div'); onext.className = 'pp-orb-next';
    onext.textContent = prog.atMax ? 'Max level — Legend' : (SQ_XP.fmt(prog.toNext) + ' XP to Level ' + (prog.level + 1));
    info.append(ohead, oxp, oseg, onext); orb.append(stage, info);
    xpPanel.appendChild(orb);
    let raf = 0;
    xpPanel.__ppReplay = () => {
      cancelAnimationFrame(raf);
      if (__ppReduced){ __sqDrawXpReactor(canvas, prog.pct, 1, 0); lvnum.textContent = String(prog.level); oxp.textContent = SQ_XP.fmt(prog.xp); return; }
      countUp(lvnum, String(prog.level), 850);
      countUp(oxp, SQ_XP.fmt(prog.xp), 950);
      const dur = 1400, t0 = performance.now();
      const loop = (now) => {
        const el = now - t0, tt = Math.min(1, el / dur);
        __sqDrawXpReactor(canvas, prog.pct, 1 - Math.pow(1 - tt, 3), el);
        if (el < 3200) raf = requestAnimationFrame(loop);
        else __sqDrawXpReactor(canvas, prog.pct, 1, el);
      };
      raf = requestAnimationFrame(loop);
    };
  }

  xpPanel.appendChild(xpCard);
  {
    const ladderCard = document.createElement('div'); ladderCard.className = 'tag';
    ladderCard.style.cssText = 'padding:12px;border-radius:14px;background:rgba(255,255,255,.052);border:1px solid rgba(255,255,255,.09);display:flex;flex-direction:column;gap:10px;';
    ladderCard.innerHTML = '<strong style="font-size:15px;color:#f59e0b">🏅 Level Ladder</strong><p class="muted" style="margin:0;font-size:12px">See how you rank against everyone by XP.</p>';
    const lb = document.createElement('button'); lb.className = 'btn sq-pill'; lb.textContent = 'Open Level Ladder';
    lb.onclick = () => { try{ if (typeof openXpLeaderboard === 'function') openXpLeaderboard(); }catch(_){ } };
    ladderCard.appendChild(lb); xpPanel.appendChild(ladderCard);
  }

  // ---- Achievements tab hero: "TROPHY VAULT" (unique to the Achievements tab) ----
  const achPanel = document.createElement('div');
  achPanel.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  {
    const achAvailable = !!(achState && achState.available);
    const catalog = (window.SQ_ACH && Array.isArray(SQ_ACH.CATALOG)) ? SQ_ACH.CATALOG : [];
    const total = catalog.length;
    const earnedCodes = catalog.filter(a => (achMap[a.code] || {}).cnt > 0);
    const earnedN = earnedCodes.length;
    const pctDone = total ? earnedN / total : 0;
    const shelf = earnedCodes.slice().sort((a, b) => (SQ_ACH.meta(b.code).xp || 0) - (SQ_ACH.meta(a.code).xp || 0));
    const MAXSHELF = 8;

    const vault = document.createElement('div'); vault.className = 'pp-vault';
    const meter = document.createElement('div'); meter.className = 'pp-vault-meter';
    const vhead = document.createElement('div'); vhead.className = 'pp-vault-head'; vhead.textContent = 'Trophy Vault';
    const vcount = document.createElement('div'); vcount.className = 'pp-vault-count';
    const vcB = document.createElement('b'); vcB.textContent = achAvailable ? String(earnedN) : '—';
    const vcS = document.createElement('small'); vcS.textContent = ' / ' + total;
    vcount.append(vcB, vcS);
    const vbar = document.createElement('div'); vbar.className = 'pp-vault-bar';
    const vfill = document.createElement('span'); vbar.appendChild(vfill);
    const vsub = document.createElement('div'); vsub.className = 'pp-vault-sub'; vsub.textContent = achAvailable ? ('Trophies unlocked · ' + Math.round(pctDone * 100) + '%') : 'Achievement history unavailable';
    meter.append(vhead, vcount, vbar, vsub);

    const shelfEl = document.createElement('div'); shelfEl.className = 'pp-vault-shelf';
    const chips = [];
    shelf.slice(0, MAXSHELF).forEach(a => {
      const meta = SQ_ACH.meta(a.code); const s = SQ_ACH.tierStyle(meta.tier);
      const chip = document.createElement('div'); chip.className = 'pp-vault-badge';
      chip.style.background = s.g; chip.style.border = '1px solid ' + s.b; chip.textContent = meta.icon;
      chip.title = meta.name + ((achMap[a.code].cnt > 1) ? (' ×' + achMap[a.code].cnt) : '');
      shelfEl.appendChild(chip); chips.push(chip);
    });
    if (shelf.length > MAXSHELF){ const more = document.createElement('div'); more.className = 'pp-vault-more'; more.textContent = '+' + (shelf.length - MAXSHELF) + ' more'; shelfEl.appendChild(more); }
    if (!shelf.length){ const none = document.createElement('div'); none.className = 'pp-vault-more'; none.textContent = achAvailable ? 'No trophies yet — go earn some!' : 'Achievement history is unavailable right now.'; shelfEl.appendChild(none); }
    vault.append(meter, shelfEl);
    achPanel.appendChild(vault);
    achPanel.appendChild(__sqTrophyCase(achMap, achAvailable));

    // Misfires are deliberately separate from the positive Trophy Vault.
    // Counts are historical; XP impact is the launch-forward value already
    // included in v_player_xp, so the client never retroactively deducts XP.
    const mfCard = __sqMisfireCase(misfireState, xpRow);
    achPanel.appendChild(mfCard);

    let timers = [];
    achPanel.__ppReplay = () => {
      timers.forEach(clearTimeout); timers = [];
      if (!achAvailable){ vcB.textContent = '—'; vfill.style.width = '0%'; chips.forEach(c => c.classList.remove('in', 'shine')); return; }
      if (__ppReduced){ vcB.textContent = String(earnedN); vfill.style.width = Math.round(pctDone * 100) + '%'; chips.forEach(c => c.classList.add('in')); return; }
      vcB.textContent = '0'; vfill.style.width = '0%';
      chips.forEach(c => c.classList.remove('in', 'shine'));
      countUp(vcB, String(earnedN), 1000);
      requestAnimationFrame(() => requestAnimationFrame(() => { vfill.style.width = Math.round(pctDone * 100) + '%'; }));
      chips.forEach((c, i) => { timers.push(setTimeout(() => { c.classList.add('in', 'shine'); }, 120 + i * 90)); });
    };
  }

  return __sqPlayerStatsView(profile, [statsPanel, xpPanel, achPanel]);
}

// [removed: openPlayerDTBDialog alias (orphaned)] audit P5.3 batch 2 — dead/shadowed definition, no live callers

window.__sqPlayerStatsSelectedName = window.__sqPlayerStatsSelectedName || '';

function __sqPlayerStatsKey(name){
  return String(name || '').trim().toLowerCase();
}
function __sqPlayerStatsNameOf(p){
  if (p == null) return '';
  if (typeof p === 'string') return String(p).trim();
  return String(p.name || p.player_name || p.player || p.display_name || '').trim();
}
function __sqPlayerStatsActiveName(){
  try{
    const players = Array.isArray(window.state && state.players) ? state.players : [];
    const idx = Number(state && state.currentPlayer);
    const p = players[Number.isFinite(idx) ? idx : 0] || players[0];
    return __sqPlayerStatsNameOf(p);
  }catch(_){ return ''; }
}
function __sqSetPlayerStatsSelectedName(name){
  const n = String(name || '').trim();
  if (!n) return '';
  window.__sqPlayerStatsSelectedName = n;
  window.__sqStatsReturnPlayer = n;
  try{ if (typeof __sqSetStatsOrigin === 'function') __sqSetStatsOrigin('home', n); }catch(_){}
  return n;
}
async function __sqLoadPlayerStatsPlayers(){
  let items = [];
  try{
    if (typeof cloudListPlayers === 'function') items = await cloudListPlayers();
  }catch(e){
    console.warn('[SQ] Player Stats player list load failed', e);
  }
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(p => ({ raw:p, name:__sqPlayerStatsNameOf(p), nickname:String((p && (p.nickname || p.nick || p.alias)) || '').trim() }))
    .filter(p => {
      const key = __sqPlayerStatsKey(p.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a,b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity:'base' }));
}
function __sqPlayerStatsNickname(name, players){
  const key = __sqPlayerStatsKey(name);
  const p = (players || []).find(x => __sqPlayerStatsKey(x.name) === key);
  return String((p && p.nickname) || '').trim();
}

// === Player Hub — Latest Matches / High Scores / Progression / Target % / D T B % / H2H ===
// XP / Level ladder — ranks every player by total XP (base + trophies).
window.openXpLeaderboard = async function openXpLeaderboard(){
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal';
  modal.style.cssText = 'max-width:560px;width:94vw;max-height:88vh;overflow:hidden;';
  const body = document.createElement('div'); body.className = 'modal-body';
  body.style.cssText = 'overflow-y:auto;max-height:84vh;';
  body.innerHTML = '<h3 style="margin:0 0 4px">🏅 Level Ladder</h3>'
    + '<p class="muted" style="margin:0 0 12px;font-size:12px">Ranked by XP — score points, win games and collect trophies to climb.</p>'
    + '<p class="muted" id="xplbLoading">Loading…</p>';
  modal.append(body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();
  let rows = [];
  try{ rows = await SQ_XP.all(true); }catch(_){ }
  rows = (rows || []).filter(r => Number(r.total_xp) > 0).sort((a, b) => Number(b.total_xp) - Number(a.total_xp));
  const loading = body.querySelector('#xplbLoading'); if (loading) loading.remove();
  if (!rows.length){
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No ranked players yet — play some games.'; body.appendChild(p);
    const ef = document.createElement('div'); ef.className = 'modal-footer';
    const eb = document.createElement('button'); eb.className = 'btn sq-pill'; eb.textContent = 'Back';
    eb.onclick = () => { overlay.remove(); __sqGoBackToStatsMain(); };
    ef.appendChild(eb); body.appendChild(ef);
    __sqStatsArcade(overlay, modal);
    return;
  }
  const listEl = document.createElement('div'); listEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  const medal = i => i === 0 ? '#ffd24a' : i === 1 ? '#cbd5e1' : i === 2 ? '#d08b5a' : 'var(--v3-muted,#98a2b8)';
  rows.forEach((r, idx) => {
    const prog = SQ_XP.progress(r.total_xp);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;'
      + 'background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);'
      + (idx < 3 ? 'box-shadow:inset 3px 0 0 ' + medal(idx) + ';' : '');
    const rank = document.createElement('div'); rank.textContent = '#' + (idx + 1);
    rank.style.cssText = 'font-weight:900;font-size:14px;min-width:34px;color:' + medal(idx) + ';';
    const mid = document.createElement('div'); mid.style.cssText = 'flex:1;min-width:0;';
    const nmeRow = document.createElement('div'); nmeRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
    const nm = document.createElement('b'); nm.textContent = r.name;
    nm.style.cssText = 'font-size:15px;';
    nmeRow.append(nm, __sqXpChip(prog));
    const sub = document.createElement('div'); sub.className = 'muted';
    sub.style.cssText = 'font-size:11px;margin-top:2px;';
    sub.textContent = SQ_XP.fmt(r.total_xp) + ' XP · ' + (r.badges || 0) + ' trophies';
    mid.append(nmeRow, sub);
    const go = document.createElement('button'); go.className = 'icon-btn'; go.type = 'button'; go.setAttribute('aria-label', 'Open ' + r.name);
    go.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>';
    go.onclick = () => { overlay.remove(); try{ if (typeof openPlayerStatsDialog === 'function') openPlayerStatsDialog(r.name); }catch(_){ } };
    row.append(rank, mid, go); listEl.appendChild(row);
  });
  body.appendChild(listEl);
  const foot = document.createElement('div'); foot.className = 'modal-footer'; foot.style.cssText = 'margin-top:14px;';
  const cb = document.createElement('button'); cb.className = 'btn sq-pill'; cb.textContent = 'Back';
  cb.onclick = () => { overlay.remove(); __sqGoBackToStatsMain(); };
  foot.appendChild(cb); body.appendChild(foot);
  __sqStatsArcade(overlay, modal);
};

// Step 1 of Player Stats: a clean player-name picker. The user chooses WHO
// first, then openPlayerStatsHub(name) opens the stat-views menu for them.
window.openPlayerStatsSelect = function openPlayerStatsSelect(){
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  // Warm the caches so the hub + profile open instantly after a name is picked.
  try{ if (typeof cloudListPlayers === 'function') cloudListPlayers().catch?.(function(){}); }catch(_){ }
  try{ if (typeof cloudFetchAllGamesAsLocal === 'function') cloudFetchAllGamesAsLocal().catch(function(){}); }catch(_){ }

  var overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  var modal = document.createElement('div'); modal.className = 'modal menu-modal';
  var header = document.createElement('div'); header.className = 'menu-modal-header';
  var backBtn = document.createElement('button'); backBtn.className = 'icon-btn'; backBtn.type = 'button'; backBtn.setAttribute('aria-label', 'Back');
  backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  var closeBtn = document.createElement('button'); closeBtn.className = 'icon-btn'; closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var titleWrap = document.createElement('div'); titleWrap.className = 'menu-modal-title';
  var icon = document.createElement('div'); icon.className = 'menu-modal-icon';
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>';
  var title = document.createElement('div'); title.className = 'menu-modal-title-text'; title.textContent = 'PLAYER STATS';
  var sub = document.createElement('div'); sub.className = 'menu-modal-title-sub2'; sub.textContent = 'Choose a player';
  titleWrap.append(icon, title, sub);
  header.append(backBtn, titleWrap, closeBtn);
  var body = document.createElement('div'); body.className = 'menu-modal-body';
  var list = document.createElement('div'); list.className = 'menu-list';
  list.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
  body.appendChild(list);
  modal.append(header, body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{ if (window.sqModal && window.sqModal.register) window.sqModal.register(overlay, modal, function(){ overlay.remove(); }); }catch(_){ }
  var close = function(){ try{ overlay.remove(); }catch(_){ overlay.parentNode && overlay.parentNode.removeChild(overlay); } };
  backBtn.onclick = close; closeBtn.onclick = close;
  overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
  modal.tabIndex = 0; modal.focus();

  // Favourites persist in localStorage (keyed by lowercased name).
  var FAV_KEY = 'sq_stats_fav_players_v1';
  function loadFavs(){ try{ return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }catch(_){ return new Set(); } }
  function saveFavs(set){ try{ localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set))); }catch(_){ } }
  var favs = loadFavs();

  (async function(){
    var players = [];
    try{ players = await __sqLoadPlayerStatsPlayers(); }catch(_){ players = []; }
    if (!players.length){
      list.innerHTML = '';
      var p = document.createElement('p'); p.className = 'tag muted'; p.style.padding = '14px'; p.textContent = 'No saved players found.';
      list.appendChild(p); return;
    }
    window.__sqPlayerStatsPlayers = players;

    // XP map drives the TOP sort + level chips (best-effort; ok if absent).
    var xpByName = {};
    try{
      var xrows = (typeof SQ_XP !== 'undefined' && SQ_XP.all) ? await SQ_XP.all() : [];
      (xrows || []).forEach(function(r){ xpByName[String(r.name || '').trim().toLowerCase()] = Number(r.total_xp) || 0; });
    }catch(_){ }
    var xpOf = function(pl){ return xpByName[String(pl.name || '').trim().toLowerCase()] || 0; };

    var av = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>';
    var chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>';

    // ---- controls: search + ALL / FAVOURITES / TOP ----
    body.innerHTML = '';
    var controls = document.createElement('div'); controls.className = 'ps-pick-controls';
    var search = document.createElement('input'); search.type = 'search'; search.className = 'ps-pick-search';
    search.placeholder = 'Search players…'; search.setAttribute('aria-label', 'Search players');
    var chips = document.createElement('div'); chips.className = 'ps-pick-chips';
    var filter = 'all';
    var chipDefs = [['all', 'All'], ['fav', '★ Favourites'], ['top', 'Top']];
    var chipEls = {};
    chipDefs.forEach(function(c){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ps-pick-chip' + (c[0] === 'all' ? ' active' : '');
      b.textContent = c[1]; b.dataset.f = c[0];
      b.onclick = function(){ filter = c[0]; Object.keys(chipEls).forEach(function(k){ chipEls[k].classList.toggle('active', k === filter); }); render(); };
      chipEls[c[0]] = b; chips.appendChild(b);
    });
    controls.append(search, chips);
    body.appendChild(controls);
    var listWrap = document.createElement('div'); listWrap.className = 'menu-list'; body.appendChild(listWrap);
    search.addEventListener('input', function(){ render(); });

    function render(){
      var q = String(search.value || '').trim().toLowerCase();
      var arr = players.slice();
      if (filter === 'fav') arr = arr.filter(function(pl){ return favs.has(String(pl.name || '').trim().toLowerCase()); });
      if (q) arr = arr.filter(function(pl){ return (String(pl.name || '') + ' ' + String(pl.nickname || '')).toLowerCase().indexOf(q) >= 0; });
      if (filter === 'top') arr.sort(function(a, b){ return (xpOf(b) - xpOf(a)) || String(a.name).localeCompare(String(b.name)); });
      else arr.sort(function(a, b){ return String(a.name).localeCompare(String(b.name)); });

      listWrap.innerHTML = '';
      if (!arr.length){
        var e = document.createElement('div'); e.className = 'ps-pick-empty';
        e.textContent = filter === 'fav' ? 'No favourites yet — tap a ☆ to add one.' : 'No players match.';
        listWrap.appendChild(e); return;
      }
      arr.forEach(function(pl){
        var nk = String(pl.name || '').trim().toLowerCase();
        var row = document.createElement('div'); row.className = 'menu-row'; row.setAttribute('role', 'button'); row.tabIndex = 0;
        var lvl = xpOf(pl) > 0 && typeof SQ_XP !== 'undefined' && SQ_XP.progress ? SQ_XP.progress(xpOf(pl)).level : 0;
        row.innerHTML = '<span class="menu-row-icon">' + av + '</span>'
          + '<span class="menu-row-text"><span class="menu-row-title">' + esc(pl.name) + (filter === 'top' && lvl ? '<span class="ps-pick-lvl">LV ' + lvl + '</span>' : '') + '</span>'
          + (pl.nickname ? '<span class="menu-row-sub">' + esc(pl.nickname) + '</span>' : '')
          + '</span>'
          + '<button type="button" class="ps-pick-star' + (favs.has(nk) ? ' on' : '') + '" aria-label="Favourite">' + (favs.has(nk) ? '★' : '☆') + '</button>'
          + '<span class="menu-row-chev">' + chev + '</span>';
        var star = row.querySelector('.ps-pick-star');
        star.onclick = function(ev){
          ev.stopPropagation();
          if (favs.has(nk)) favs.delete(nk); else favs.add(nk);
          saveFavs(favs);
          star.classList.toggle('on', favs.has(nk)); star.textContent = favs.has(nk) ? '★' : '☆';
          if (filter === 'fav') render();
        };
        row.onclick = function(ev){
          if (ev.target && ev.target.closest && ev.target.closest('.ps-pick-star')) return;
          close();
          try{ if (typeof __sqSetPlayerStatsSelectedName === 'function') __sqSetPlayerStatsSelectedName(pl.name); }catch(_){ }
          try{ if (typeof window.openPlayerStatsHub === 'function') window.openPlayerStatsHub(pl.name); }catch(e){ console.error('open hub failed', e); }
        };
        listWrap.appendChild(row);
      });
    }
    render();
  })();
};

window.openPlayerStatsHub = function openPlayerStatsHub(playerName){
  var __fromPicker = !!String(playerName || '').trim();
  try{ if (typeof __sqSetStatsOrigin==='function') __sqSetStatsOrigin('home', playerName); }catch(_){ }
  try{ console.debug('[Popup]', window.__sqStatsDebugName || 'New Game Screen Stats'); }catch(_){ }
  let currentName = String(playerName || window.__sqPlayerStatsSelectedName || window.__sqStatsReturnPlayer || __sqPlayerStatsActiveName() || '').trim();
  if (currentName) __sqSetPlayerStatsSelectedName(currentName);

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal menu-modal sq-player-stats-hub';

  // Header
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
  title.textContent = 'PLAYER STATS';

  let hubPlayers = [];
  const playerLine = document.createElement('label');
  playerLine.className = 'menu-modal-title-sub sq-player-stats-picker';
  const playerLabel = document.createElement('span');
  playerLabel.textContent = 'Player';
  const playerSelect = document.createElement('select');
  playerSelect.setAttribute('aria-label', 'Player');
  playerSelect.innerHTML = '<option value="">Loading players...</option>';
  playerLine.append(playerLabel, playerSelect);

  // Identity, nickname and level now live in the canonical profile below.
  // Keep the selector for callers that enter without a chosen player.
  if (__fromPicker) playerLine.style.display = 'none';
  titleWrap.append(icon, title, playerLine);
  header.append(backBtn, titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'menu-modal-body';
  const profileHost = document.createElement('div');
  profileHost.className = 'sq-player-stats-profile';
  body.appendChild(profileHost);

  const list = document.createElement('div');
  list.className = 'menu-list';

  const mkRow = (label, sublabel, svg, onClick) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'menu-row';
    row.innerHTML = `
      <span class="menu-row-icon">${svg || ''}</span>
      <span class="menu-row-text">
        <span class="menu-row-title">${label}</span>
        <span class="menu-row-sub">${sublabel || ''}</span>
      </span>
      <span class="menu-row-chev">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </span>`;
    row.onclick = () => { try{ onClick && onClick(); }catch(e){ console.error('Player stats row failed', e); } };
    return row;
  };

  let profileRequest = 0;
  const syncPlayerHeader = async () => {
    const n = String(currentName || playerSelect.value || '').trim();
    if (n && playerSelect.value !== n) playerSelect.value = n;
    const request = ++profileRequest;
    profileHost.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
    try{
      const view = await __sqBuildPlayerStatsProfile(n);
      if (request !== profileRequest || !overlay.isConnected) return;
      profileHost.replaceChildren(view.profile);
      view.tabs.forEach((button, tab) => {
        button.onclick = () => {
          overlay.remove();
          openPlayerStatsDialog(n, { view, tab, onReturn: () => {
            document.body.appendChild(overlay);
            modal.focus();
            button.focus();
          } });
        };
      });
    }catch(e){
      if (request !== profileRequest || !overlay.isConnected) return;
      profileHost.textContent = 'Player profile could not be loaded.';
      const retry = document.createElement('button'); retry.className = 'btn sq-pill'; retry.textContent = 'Retry';
      retry.onclick = syncPlayerHeader; profileHost.appendChild(retry);
      console.warn('[SQ] Player profile load failed', e);
    }
  };
  const selectedName = () => String(currentName || playerSelect.value || '').trim();
  const openForSelected = (fnName, fallbackMessage, extraArgs) => {
    const n = selectedName();
    if (!n){ try{ if (typeof toast === 'function') toast('Pick a player'); }catch(_){} return; }
    currentName = __sqSetPlayerStatsSelectedName(n);
    try{ overlay && overlay.remove(); }catch(e){}
    const fn = window[fnName];
    if (typeof fn === 'function') return fn.apply(window, [n].concat(extraArgs || []));
    if (typeof toast === 'function') toast(fallbackMessage);
  };

  const svgClock = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>';
  const svgTrophy= '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v3a5 5 0 0 1-10 0V4z"/><path d="M5 5H3v2a4 4 0 0 0 4 4"/><path d="M19 5h2v2a4 4 0 0 1-4 4"/></svg>';
  const svgTrend = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/></svg>';
  const svgTarget= '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>';
  const svgVs    = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l16 16"/><path d="M7 7h.01"/><path d="M17 17h.01"/></svg>';

  const svgLadder = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3v18M18 3v18M6 7h12M6 12h12M6 17h12"/></svg>';

  list.append(
    mkRow('Level Ladder', 'XP & LEVELS LEADERBOARD', svgLadder, () => {
      try{ overlay && overlay.remove(); }catch(e){}
      try{ openXpLeaderboard(); }catch(_){ if (typeof toast==='function') toast('Ladder not available'); }
    }),

    mkRow('Latest Matches', 'POS / POINTS / AVG', svgClock, () => {
      return openForSelected('openPlayerLatestMatchesDialog', 'Latest Matches not available', ['official']);
    }),

    mkRow('Player High Scores', 'FULL GAME HISTORY', svgTrophy, () => {
      return openForSelected('openPlayerHighScoresDialog', 'High Scores not available');
    }),

    mkRow('Progression', 'PLAYER SCORES OVER TIME', svgTrend, () => {
      return openForSelected('openPlayerProgressionDialog', 'Progression not available');
    }),

    mkRow('Practice Stats', 'TRAINING SESSIONS & AVERAGES', svgTarget, () => {
      return openForSelected('__sqOpenTrainingStats', 'Practice stats not available');
    }),

    mkRow('Target Hit %', 'TARGET HITS PER ROUND', svgTarget, () => {
      return openForSelected('openPlayerTargetHitDialog', 'Target Hit % not available');
    }),

    mkRow('Target Points %', 'AVAILABLE POINTS HIT PER ROUND', svgTarget, () => {
      return openForSelected('openPlayerTargetPointsDialog', 'Target Points % not available');
    }),

    mkRow('Player H2H', 'RECORD VS OTHER PLAYERS', svgVs, () => {
      return openForSelected('openPlayerH2HDialog', 'H2H not available');
    }),

    (() => {
      const r = mkRow('H2H Matchups (Coming Soon)', 'HEAD TO HEAD MATCHUPS', svgVs, () => {
        try{ overlay && overlay.remove(); }catch(e){}
        if (typeof toast==='function') toast('Coming Soon');
      });
      r.classList.add('is-disabled');
      return r;
    })()
  );

  body.appendChild(list);
  modal.append(header, body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  playerSelect.onchange = () => {
    const n = String(playerSelect.value || '').trim();
    if (!n) return;
    currentName = __sqSetPlayerStatsSelectedName(n);
    syncPlayerHeader();
  };

  (async () => {
    hubPlayers = await __sqLoadPlayerStatsPlayers();
    if (!hubPlayers.length){
      playerSelect.innerHTML = '<option value="">No saved players</option>';
      playerSelect.disabled = true;
      currentName = '';
      profileHost.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'tag muted';
      empty.textContent = 'No saved players found.';
      body.insertBefore(empty, list);
      return;
    }
    playerSelect.innerHTML = '';
    hubPlayers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      playerSelect.appendChild(opt);
    });
    const activeName = __sqPlayerStatsActiveName();
    const preferred = [currentName, window.__sqPlayerStatsSelectedName, window.__sqStatsReturnPlayer, activeName]
      .map(x => String(x || '').trim())
      .find(x => hubPlayers.some(p => __sqPlayerStatsKey(p.name) === __sqPlayerStatsKey(x)));
    window.__sqPlayerStatsPlayers = hubPlayers;
    currentName = __sqSetPlayerStatsSelectedName(preferred || hubPlayers[0].name);
    syncPlayerHeader();
  })();

  const close = () => { try{ overlay.remove(); }catch(_){ overlay.parentNode && overlay.parentNode.removeChild(overlay); } };
  // From the picker, Back returns to the name list so you can switch player.
  backBtn.onclick = __fromPicker
    ? () => { close(); try{ if (typeof window.openPlayerStatsSelect === 'function') window.openPlayerStatsSelect(); }catch(_){ } }
    : close;
  closeBtn.onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
modal.tabIndex = 0; modal.focus();
};

// ==== Player-Stats helpers ====================================================
async function __fetchOfficialGames(limit=5000){
  try{
    // Prefer local fetch if available (already normalized in your app)
    if (typeof cloudFetchAllGamesAsLocal === 'function') {
      const all = await cloudFetchAllGamesAsLocal();
      return (all||[]).filter(g => Array.isArray(g?.players) && g.players.length >= 2);
    }
    if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return [];
    const table = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');
    const { data, error } = await sb.from(table).select('*').order('created_at',{ascending:false}).limit(limit);
    if (error) throw error;
    return (data||[]).filter(g => Array.isArray(g?.state?.players) && g.state.players.length >= 2);
  }catch(e){ console.error('__fetchOfficialGames failed', e); return []; }
}
function __gameTs(g){
  return g?.ts || g?.created_at || g?.inserted_at || (g?.meta && (g.meta.ts || g.meta.date)) || null;
}
function __isSameLocalDay(a, b){
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth()    === db.getMonth() &&
    da.getDate()     === db.getDate()
  );
}
// Turbo classifier for the Player Stats profile (scoped — does not touch the
// shared official fetch/rank paths). Mirrors @MODE:CLASSIFICATION_RULES:
// explicit turbo flags in the game/state/match/rules, OR the legacy board
// shape where targets 10-16 are unplayed but 17-20/D/T/B contain play.
function __sqGameLooksTurbo(raw){
  try{
    if (!raw) return false;
    const st = raw.state || raw || {};
    const m  = st.match || raw.match || {};
    const rules = st.tournamentRules || m.tournamentRules || st.rules || m.rules || {};
    const low = v => String(v == null ? '' : v).toLowerCase();
    const modeStrings = [
      raw.mode, raw.gameMode, raw.game_mode, raw.type, raw.gameVariant, raw.game_variant,
      st.mode, st.gameMode, st.game_mode, st.type, st.gameVariant, st.game_variant,
      m.mode, m.gameMode, m.game_mode, m.type, m.gameVariant,
      st.tournamentType, st.tournament_type, m.tournamentType, m.tournament_type
    ].map(low);
    if (modeStrings.some(s => s.indexOf('turbo') >= 0)) return true;
    const strict = o => !!o && (o.strictTimer === true || Number(o.throwLimitSeconds || 0) === 20 || String(o.startTarget || '') === '17');
    if (strict(st) || strict(m) || strict(rules)) return true;
    // Board-shape fallback: play only in the late (turbo) rounds.
    const board = raw.board || st.board || null;
    if (Array.isArray(board) && board.length){
      const players = Array.isArray(st.players) ? st.players : (raw.players || []);
      const pn = Math.max(1, players.length || 0);
      const cellHasPlay = cell => {
        if (!cell) return false;
        const list = Array.isArray(cell) ? cell : (Array.isArray(cell.throws) ? cell.throws : (Array.isArray(cell.darts) ? cell.darts : []));
        return !!(list && list.length);
      };
      const roundsForPlayer = pIdx => {
        if (Array.isArray(board[pIdx])) return board[pIdx];
        if (Array.isArray(board[0]) && board[0] && typeof board[0][pIdx] !== 'undefined') return board.map(r => r ? r[pIdx] : null);
        return [];
      };
      // Strict: turbo-shaped only when NO early round (targets 10-16) is
      // played anywhere AND every late round 17-20 (indices 7-10) is played
      // by some player. This matches a real "start at 17" board and never
      // fires on sparse/partial official boards.
      let earlyPlay = false;
      const lateHit = { 7:false, 8:false, 9:false, 10:false };
      for (let p = 0; p < pn; p++){
        const rounds = roundsForPlayer(p) || [];
        for (let r = 0; r < rounds.length; r++){
          if (!cellHasPlay(rounds[r])) continue;
          if (r <= 6) earlyPlay = true;
          else if (r <= 10) lateHit[r] = true;
        }
      }
      if (!earlyPlay && lateHit[7] && lateHit[8] && lateHit[9] && lateHit[10]) return true;
    }
    return false;
  }catch(_){ return false; }
}
function __normalizeGame(g){
  const players = Array.isArray(g.players)
    ? g.players.map(p => (p && p.name) ? p.name : String(p||''))
    : (Array.isArray(g?.state?.players) ? g.state.players.map(p => (p && p.name) ? p.name : String(p||'')) : []);
  const totals = Array.isArray(g.totals) ? g.totals : (Array.isArray(g?.state?.totals) ? g.state.totals : []);
// prefer top-level board if present, else state.board
const board  = Array.isArray(g.board) ? g.board : (g?.state?.board || null);
  const ts     = __gameTs(g);
  return { players, totals, board, ts, raw: g };
}
// Filter helper for Premier League tabs (supports: ALL TIME, TODAY, and month codes like DEC/NOV/…)
function __filterGamesByPLTab(mode, games){
  const m = String(mode || '').trim().toUpperCase();
  if (!Array.isArray(games)) return [];

  if (m === 'ALL TIME' || m === 'ALL' || m === 'ALLTIME') return games;

  if (m === 'TODAY') {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return games.filter(g => {
      const t = __gameTs(g.raw || g);
      if (!t) return false;
      const dt = new Date(t);
      return dt >= start && dt < end;
    });
  }

  // Month filters: JAN..DEC (3-letter uppercase codes)
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const mi = MONTHS.indexOf(m);
  if (mi >= 0) {
    return games.filter(g => {
      const t = __gameTs(g.raw || g);
      return t && new Date(t).getMonth() === mi;
    });
  }

  // Fallback = no filter
  return games;
}
function __roundCountFor(g, idx){
  if (g.board && Array.isArray(g.board[idx])) return Math.min(14, g.board[idx].length||0);
  return 14; // fallback
}
function __roundLabels(){
  return ['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
}

// Build throw rows for a player from normalized games' boards.
// Supports two shapes:
//   A) board[playerIndex][round][throw]
//   B) board[round][playerIndex][throw]
// Returns rows like: { game_id, player, round_index, dart_index, points, kind }
function __throwsFromGamesForPlayer(playerName, games){
  const nameLC = String(playerName||'').trim().toLowerCase();
  const out = [];

  (games||[]).forEach(g=>{
    const pIdx = (g.players||[]).findIndex(p => String(p||'').trim().toLowerCase()===nameLC);
    if (pIdx < 0) return;

    const b = g.board;
    if (!Array.isArray(b) || !b.length) return;

    // Detect shape
    // Shape A: b[pIdx] exists and is array of rounds
    const looksLikeA = Array.isArray(b[pIdx]) && (b[pIdx].length > 0);
    // Shape B: b[0][pIdx] exists => array of rounds where each round has array for this player
    const looksLikeB = Array.isArray(b[0]) && Array.isArray(b[0][pIdx]);

    // Build a per-player "rounds list" no matter the shape
    let rounds = [];
    if (looksLikeA) {
      rounds = b[pIdx]; // [round][throw]
    } else if (looksLikeB) {
      rounds = b.map(r => r ? r[pIdx] : null); // [round][throw]
    } else {
      // Unknown layout — give up on this game
      return;
    }

    for (let r = 0; r < Math.min(14, rounds.length || 0); r++){
      const cell = rounds[r];
      if (!cell) continue;

      // Each cell can be:
      //  - array of throws
      //  - object with { throws: [...] } or { darts: [...] }
      const list = Array.isArray(cell) ? cell
                  : (Array.isArray(cell.throws) ? cell.throws
                     : (Array.isArray(cell.darts) ? cell.darts : []));

      list.forEach((t, di)=>{
        const ringRaw = (t?.kind || t?.type || t?.segment || t?.ring || '').toString().toLowerCase();
        const mult  = Number(
          t?.mult ?? t?.multiplier ??
          (ringRaw==='double' ? 2 : (ringRaw==='treble'||ringRaw==='triple' ? 3 : 1))
        ) || 1;

        // value/number: for rounds 0..10 use 10+r fallback; D/T/B rows (11..13) have no number
        const baseVal = Number(t?.value ?? t?.number ?? t?.n ?? (r<=10 ? (10+r) : NaN));
        let points  = Number(t?.points ?? t?.pts ?? t?.score);
        if (!Number.isFinite(points)) {
          points = (Number.isFinite(baseVal) ? baseVal : 0) * mult;
        }

        let kind = ringRaw;
        if (!kind){
          if (mult===2) kind = 'double';
          else if (mult===3) kind = 'treble';
          else if (r===13)   kind = 'bull';
          else               kind = 'single';
        }

        out.push({
          game_id: g.raw?.id || g.raw?.game_id || null,
          player: g.players[pIdx],
          round_index: r,
          dart_index: di,
          points: Number.isFinite(points) ? points : 0,
          kind
        });
      });
    }
  });

  return out;
}

// Fetch throws for a set of game IDs; returns rows normalized to:
// { game_id, player, round_index, dart_index, points, kind }
async function __fetchThrowsForGames(gameIds){
  const ids = Array.isArray(gameIds) ? gameIds.filter(Boolean) : [];
  if (!ids.length) return [];

  // Candidate tables to try (put your real table first if you know it)
  const tableCandidates = [
    // Prefer the canonical backdated view if it exists
    'throw_events_v', 'throw_events',
    (typeof TABLE_GAME_THROWS !== 'undefined') ? TABLE_GAME_THROWS : 'game_throws',
    'throws', 'shots', 'game_shots', 'game_darts'
  ].filter(table => table && !(typeof cloudIsTableMissing === 'function' && cloudIsTableMissing(table)));
  // Candidate game-id columns to try
  const idCols = ['game_id','game','gid','match_id','gameId','gameID'];

  // Map raw row -> normalized row
  const norm = (r) => {
    const gid =
      r.game_id ?? r.game ?? r.gid ?? r.match_id ?? r.gameId ?? r.gameID ?? null;
    const player =
      r.player ?? r.name ?? r.player_name ?? r.playerName ?? r.p ?? null;

    // round index: prefer 0..13; otherwise derive from number/ring if present
    let ri = r.round_index ?? r.round ?? r.roundIdx ?? r.ri ?? null;
    if (ri == null) {
      const target = r.target ?? r.number ?? r.n ?? null; // 10..20
      const ring   = (r.ring ?? r.segment ?? r.kind ?? r.type ?? '').toString().toUpperCase();
      if (typeof target === 'number' && target >= 10 && target <= 20) ri = target - 10;
      else if (ring === 'D') ri = 11;
      else if (ring === 'T' || ring === 'TRIPLE' || ring === 'TREBLE') ri = 12;
      else if (ring === 'B' || ring === 'BULL') ri = 13;
    }

    let di = r.dart_index ?? r.throw_index ?? r.dart ?? r.d ?? r.index ?? r.di ?? null;

    // points
    let pts = Number(r.points ?? r.pts ?? r.score ?? NaN);
    if (!Number.isFinite(pts)) {
      const val = Number(r.value ?? r.number ?? NaN);
      const mul = Number(r.mult ?? r.multiplier ?? NaN);
      if (Number.isFinite(val) && Number.isFinite(mul)) pts = val * mul;
    }

    // kind
    let kind = r.kind ?? r.type ?? r.segment ?? r.ring ?? '';
    if (!kind) {
      const mul = Number(r.mult ?? r.multiplier ?? NaN);
      if (mul === 2) kind = 'double';
      else if (mul === 3) kind = 'treble';
      else if (mul === 1) kind = 'single';
    }      const ts = r.ts ?? r.created_at ?? r.inserted_at ?? r.time ?? null;

      // ---- Canonical hit + points for Target Hit % (do not trust upstream semantics) ----
      const ringRaw = String((r.ring ?? r.segment ?? r.kind ?? r.type ?? '') || '').trim();
      const ringU = ringRaw.toUpperCase();

      const ringType = (() => {
        if (!ringU) return '';
        // Bulls
        if (ringU === 'IB' || ringU === 'INNER' || ringU === 'DB' || ringU === 'DOUBLEBULL') return 'IB';
        if (ringU === 'OB' || ringU === 'OUTER' || ringU === 'SB' || ringU === 'SINGLEBULL') return 'OB';
        if (ringU === 'B' || ringU === 'BULL') return 'B';

        // S/D/T (allow prefixes like S20 / D16 / T14)
        if (ringU[0] === 'S') return 'S';
        if (ringU[0] === 'D') return 'D';
        if (ringU[0] === 'T') return 'T';

        if (ringU.startsWith('SINGLE')) return 'S';
        if (ringU.startsWith('DOUBLE')) return 'D';
        if (ringU.startsWith('TRIPLE') || ringU.startsWith('TREBLE')) return 'T';
        return '';
      })();

      const kindNorm =
        (ringType === 'D')  ? 'd'  :
        (ringType === 'T')  ? 't'  :
        (ringType === 'IB') ? 'ib' :
        (ringType === 'OB') ? 'ob' :
        (ringType === 'B')  ? 'b'  :
        's';

      const hit =
        (typeof ri === 'number' && ri >= 0 && ri <= 10) ? (ringType === 'S' || ringType === 'D' || ringType === 'T') :
        (ri === 11) ? (ringType === 'D') :
        (ri === 12) ? (ringType === 'T') :
        (ri === 13) ? (ringType === 'IB' || ringType === 'OB' || ringType === 'B') :
        false;

      // Compute deterministic points (used by other screens too); if upstream provides pts, we still prefer our computed value.
      const targetN = Number(r.target ?? r.number ?? r.n ?? NaN);
      let ptsDet = 0;
      if (hit) {
        if (typeof ri === 'number' && ri >= 0 && ri <= 10) {
          const base = 10 + ri;
          ptsDet = (ringType === 'D') ? base * 2 : (ringType === 'T') ? base * 3 : base;
        } else if (ri === 11) {
          ptsDet = Number.isFinite(targetN) ? targetN * 2 : 0;
        } else if (ri === 12) {
          ptsDet = Number.isFinite(targetN) ? targetN * 3 : 0;
        } else if (ri === 13) {
          ptsDet = (ringType === 'IB') ? 50 : (ringType === 'OB') ? 25 : ((targetN === 25) ? 25 : 50);
        }
      }

      return {
        game_id: gid, player, round_index: ri, dart_index: di,
        points: (ptsDet || 0),
        kind: kindNorm,
        hit,
        ts
      };
  };

  const out = [];
  const CHUNK = 200;

  for (const table of tableCandidates) {
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);

        // try each id column until one works
        let data = null, errLast = null;
        for (const col of idCols) {
          try {
            const { data: d, error } = await sb
              .from(table)
              .select('*')
              .in(col, slice)
              .order(col, { ascending: true })
              .limit(2000);
            if (!error && Array.isArray(d)) { data = d; break; }
            errLast = error;
          } catch (e) { errLast = e; }
        }
        if (data && data.length) out.push(...data.map(norm));
      }
      if (out.length) {
        console.info('[throws] using table:', table, 'rows:', out.length);
        break; // found a working table
      }
    } catch (e) {
      console.warn('[throws] failed table', table, e);
    }
  }

  if (!out.length) {
    console.warn('[throws] no throw rows found for supplied game ids:', ids.slice(0,10), '…');
  }
  return out;
}

// ---- Latest Matches data loader (cloud-first, safe fallbacks) ----
// Returns rows: [{ position, points, round_avg, when, sheet_id }]
window.fetchLatestMatchesRows = async function fetchLatestMatchesRows(playerName, mode='official', limit=50){
  const name = String(playerName||'').trim();
  if (!name) return [];
  const isPractice = (String(mode).toLowerCase()==='practice');
  const lim = Math.max(1, Math.min(200, Number(limit)||50));

  const fmt = (ts)=>{
    try{
      if (!ts) return '';
      if (typeof window.fmtWhen === 'function') return window.fmtWhen(ts);
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime()) && typeof window.fmtDdMmYyAtTime === 'function') return window.fmtDdMmYyAtTime(d);
      return !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(ts);
    }catch(_){ return String(ts||''); }
  };

  // 1) Preferred: player_games_union (TABLE_PLAYER_GAMES)
  try{
    if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) throw new Error('cloud not ready');
    const tableName = (typeof TABLE_PLAYER_GAMES !== 'undefined' && TABLE_PLAYER_GAMES) ? TABLE_PLAYER_GAMES : 'player_games_union';

    let q = sb
      .from(tableName)
      .select('sheet_id, player, score, position, rounds, ts, is_practice')
      .ilike('player', name)
      .order('ts', { ascending:false })
      .limit(lim);

    // Important: some historic rows have is_practice NULL; treat as official.
    if (isPractice) q = q.eq('is_practice', true);
    else q = q.or('is_practice.is.null,is_practice.eq.false');

    const { data, error } = await q;
    if (error) throw error;

    let rows = (data||[]).filter(Boolean).map(r=>{
      const score = Number(r.score||0);
      const rounds = 14; // Fixed game length (10–20 + D/T/B)
      const avg = (rounds ? (score/rounds) : null);
      return {
        sheet_id: r.sheet_id || null,
        position: (r.position ?? ''),
        points: (r.score ?? ''),
        round_avg: avg,
        when: fmt(r.ts),
        ts: r.ts
      };
    });

// Enrich with total players (single bulk lookup against games)
try{
  const ids = rows.map(x=>x.sheet_id).filter(Boolean);
  if (ids.length){
    const gTable = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');
    const { data: gRows, error: gErr } = await sb.from(gTable).select('id,archived_at,state,created_at,mode,is_practice').in('id', ids);
    if (!gErr && Array.isArray(gRows)){
      const map = new Map();
      const archived = new Set();
      for (const gr of gRows){
        if (gr && gr.archived_at) archived.add(String(gr.id));
        try{
          const ng = (typeof __normalizeGame==='function') ? __normalizeGame(gr) : null;
          const cnt = ng && Array.isArray(ng.players) ? ng.players.length : (gr?.state?.players?.length || null);
          if (gr?.id) map.set(String(gr.id), cnt);
        }catch(_){ }
      }
      rows = rows.filter(r => !archived.has(String(r.sheet_id||'')));
      rows.forEach(r=>{ const k=String(r.sheet_id||''); if (map.has(k)) r.players_count = map.get(k); });
    }
  }
}catch(_){ }
    if (rows.length) return rows;
  }catch(e){
    // keep going to fallback (do not spam console in UI path)
    console.warn('[LatestMatches] player_games_union query failed or empty; falling back.', e?.message || e);
  }

  // 2) Fallback: derive from games table (TABLE_GAMES) so UI still works during migrations.
  try{
    if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) return [];
    const table = (typeof TABLE_GAMES !== 'undefined' ? TABLE_GAMES : 'games');

    // Pull a wider window so we can filter down to the last N games for this player.
    const fetchN = Math.max(500, lim * 80);
    const { data, error } = await sb.from(table).select('*').is('archived_at', null).order('created_at',{ascending:false}).limit(fetchN);
    if (error) throw error;

    const norm = (g)=>{
      const ng = (typeof __normalizeGame === 'function') ? __normalizeGame(g) : { players:[], totals:[], board:null, ts:(g.created_at||null), raw:g };
      const matchId = (g?.match_id || g?.matchId || g?.state?.match_id || g?.state?.match?.id || null);
      const playersCount = (ng.players||[]).length;
      const modeRaw = String((g?.mode || g?.state?.mode || '')).toLowerCase();
      const isPracticeDerived = (
        g?.is_practice === true ||
        g?.state?.is_practice === true ||
        modeRaw === 'practice' ||
        playersCount === 1
      );
      const modeNorm = isPracticeDerived ? 'practice' : 'official';
      return {
        players: ng.players || [],
        totals: ng.totals || [],
        board: ng.board || null,
        ts: ng.ts || g.created_at || null,
        mode: modeNorm,
        is_practice: isPracticeDerived,
        match_id: matchId,
        raw: g
      };
    };

    let sourceRows = (data || []).slice();
    try {
      const recentGames = (typeof window.__sqGetRecentCompletedGamesCache === 'function') ? window.__sqGetRecentCompletedGamesCache() : [];
      if (Array.isArray(recentGames) && recentGames.length) sourceRows = sourceRows.concat(recentGames);
    } catch(_) {}

    const games = sourceRows.map(norm)
      .filter(g => (isPractice ? (typeof isPracticeGame==='function'? isPracticeGame(g): (g.is_practice===true)) : (typeof isOfficialGame==='function'? isOfficialGame(g): (g.is_practice!==true && (g.players||[]).length>=2))))
      .filter(g => (g.players||[]).some(p => (typeof eqName==='function'? eqName(p,name) : String(p||'').trim().toLowerCase()===name.toLowerCase())));

    const rows = [];
    for (const g of games){
      const i = (g.players||[]).findIndex(p => (typeof eqName==='function'? eqName(p,name) : String(p||'').trim().toLowerCase()===name.toLowerCase()));
      if (i < 0) continue;
      const score = Number((g.totals||[])[i] || 0);
      // Position: dense rank by score (desc), tie-break by original index.
      const ord = (g.totals||[]).map((s, idx)=>({ idx, s:Number(s||0) }))
        .sort((a,b)=> (b.s - a.s) || (a.idx - b.idx));
      const uniq = [];
      ord.forEach(o=>{ if (!uniq.includes(o.s)) uniq.push(o.s); });
      const pos = (uniq.indexOf(score) >= 0) ? (uniq.indexOf(score)+1) : '';

      let rounds = 14;
      try{
        if (typeof __roundCountFor==='function') rounds = __roundCountFor(g, i);
        else if (g.board && Array.isArray(g.board[i])) rounds = Math.min(14, g.board[i].length||0) || 14;
      }catch(_){}
      const avg = rounds ? (score/rounds) : null;

      rows.push({
        sheet_id: g.raw?.id || null,
        players_count: (g.players||[]).length,
        position: pos,
        points: score,
        round_avg: avg,
        when: fmt(g.ts),
        ts: g.ts
      });
      if (rows.length >= lim) break;
    }
    return rows;
  }catch(e){
    console.error('[LatestMatches] fallback failed', e);
    return [];
  }
};

// ==== (1) Latest Matches ======================================================
// ===== @JS:MODAL:PLAYER_LATEST_MATCHES =====
window.openPlayerLatestMatchesDialog = async function openPlayerLatestMatchesDialog(playerName, initialMode){
  try {
    if (!playerName) return;

    const escapeHtml = (s) => {
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, (c) => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c] || c));
    };

    // Close any existing Latest Matches modal to avoid stacking duplicates
    document.querySelectorAll('.sq-latest-matches-backdrop').forEach(n => n.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop sq-latest-matches-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '980px';
    modal.style.width = '94vw';

    const safeName = escapeHtml(playerName);

    modal.innerHTML = `
      <div class="modal-header" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div>
            <div style="font-size:18px; font-weight:800; letter-spacing:.02em;">Latest Matches — ${safeName}</div>
            <div style="font-size:11px; opacity:.65; margin-top:2px;">Pos / Points / Avg</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          <div class="segmented" style="display:flex; gap:8px;">
            <button class="seg-btn" data-mode="official">Official</button>
            <button class="seg-btn" data-mode="practice">Practice</button>
          </div>
        </div>
      </div>

      <div class="modal-body" style="padding-top:8px;">
        <div class="latest-matches-table-wrap" style="border:1px solid rgba(255,255,255,.08); border-radius:14px; overflow:auto; max-height:56vh;">
          <table class="sq-table latest-matches" style="width:100%; border-collapse:collapse; table-layout:fixed;">
            <colgroup>
              <col style="width:7%">
              <col style="width:18%">
              <col style="width:18%">
              <col style="width:18%">
              <col style="width:39%">
            </colgroup>
            <thead>
              <tr>
                <th style="text-align:left; padding-left:14px;">#</th>
                <th style="text-align:center;">Pos</th>
                <th style="text-align:center;">Points</th>
                <th style="text-align:center;">Avg</th>
                <th style="text-align:right; padding-right:14px;">When</th>
              </tr>
            </thead>
            <tbody data-role="rows"></tbody>
          </table>
        </div>

        <div class="modal-footer" style="margin-top:14px;">
          <button class="btn small sq-pill" data-action="back">Back</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    __sqStatsArcade(overlay, modal);

    // Styling hooks (reuses existing theme)
    const segBtns = modal.querySelectorAll('.seg-btn');
    segBtns.forEach(b=>{
      b.style.padding = '8px 12px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid rgba(255,255,255,.14)';
      b.style.background = 'rgba(10,12,24,.55)';
      b.style.color = 'rgba(255,255,255,.85)';
      b.style.fontWeight = '700';
      b.style.letterSpacing = '.02em';
      b.style.cursor = 'pointer';
      b.style.userSelect = 'none';
    });

    const rowsEl = modal.querySelector('[data-role="rows"]');

    const setActiveModeUI = (mode) => {
      segBtns.forEach(btn=>{
        const on = btn.dataset.mode === mode;
        btn.style.borderColor = on ? 'rgba(255,123,26,.85)' : 'rgba(255,255,255,.14)';
        btn.style.boxShadow = on ? '0 0 0 2px rgba(255,123,26,.15) inset' : 'none';
        btn.style.color = on ? '#fff' : 'rgba(255,255,255,.85)';
        btn.style.background = on ? 'rgba(255,123,26,.12)' : 'rgba(10,12,24,.55)';
      });
    };

    const renderRows = (rows) => {
      const safeRows = Array.isArray(rows) ? rows : [];
      rowsEl.innerHTML = safeRows.map((r, idx) => {
        const posRaw = (r.position != null) ? r.position : '';
        const pc = (r.players_count ?? r.playersCount ?? r.total_players ?? r.player_count ?? '');
        const pos = (String(posRaw||'').includes('/') || !pc) ? posRaw : (String(posRaw||'') ? String(posRaw) + '/' + String(pc) : '');
        const pts = (r.points != null) ? r.points : '';
        const av  = (r.round_avg != null) ? Number(r.round_avg).toFixed(1) : (r.roundAvg != null ? Number(r.roundAvg).toFixed(1) : '');
        const when = escapeHtml(r.when || r.created_at || r.played_at || '');
        return `
          <tr>
            <td style="text-align:left; padding-left:14px; color:rgba(255,123,26,.95); font-weight:800;">${idx+1}</td>
            <td style="text-align:center;">${escapeHtml(pos)}</td>
            <td style="text-align:center;">${escapeHtml(pts)}</td>
            <td style="text-align:center;">${escapeHtml(av)}</td>
            <td style="text-align:right; padding-right:14px; opacity:.9;">${when}</td>
          </tr>
        `;
      }).join('');
    };

    const load = async (mode) => {
      setActiveModeUI(mode);
      rowsEl.innerHTML = `<tr><td colspan="5" style="padding:18px; opacity:.7;">Loading…</td></tr>`;
      let rows = [];
      try {
        if (typeof fetchLatestMatchesRows === 'function') {
          rows = await fetchLatestMatchesRows(playerName, mode, 50);
        } else if (typeof window.fetchLatestMatchesRows === 'function') {
          rows = await window.fetchLatestMatchesRows(playerName, mode, 50);
        }
      } catch(e){
        rows = [];
      }
      if (!rows || !rows.length) {
        rowsEl.innerHTML = `<tr><td colspan="5" style="padding:18px; opacity:.7;">No ${mode} matches found.</td></tr>`;
        return;
      }
      renderRows(rows);
    };

    let mode = (initialMode === 'practice' || initialMode === 'official') ? initialMode : 'official';
    load(mode);

    segBtns.forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        mode = btn.dataset.mode;
        await load(mode);
      });
    });

    const close = () => overlay.remove();
    const goBack = () => {
      overlay.remove();
      __sqGoBackToStatsMain();
    };

    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });
    modal.addEventListener('click', (e)=>{
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const a = t.dataset.action;
      if (a === 'close') close();
      if (a === 'back') goBack();
    });

    window.addEventListener('keydown', function escHandler(ev){
      if (ev.key === 'Escape') {
        window.removeEventListener('keydown', escHandler);
        close();
      }
    });

    // Accessibility focus
    modal.tabIndex = 0;
    modal.focus();
  } catch (err) {
    console.error('[LatestMatches] failed', err);
  }
};

// ---- Stats modal theming helpers (match Latest Matches look) ----
function __sqStatsHeader(titleText, subtitleText, rightNode){
  const header = document.createElement('div');
  header.className = 'modal-header';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';

  const left = document.createElement('div');
  const t = document.createElement('div');
  t.style.fontSize = '18px';
  t.style.fontWeight = '800';
  t.style.letterSpacing = '.02em';
  t.textContent = String(titleText || '');
  left.appendChild(t);

  if (subtitleText){
    const s = document.createElement('div');
    s.style.fontSize = '11px';
    s.style.opacity = '.65';
    s.style.marginTop = '2px';
    s.textContent = String(subtitleText);
    left.appendChild(s);
  }

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.alignItems = 'center';
  right.style.gap = '10px';
  if (rightNode) right.appendChild(rightNode);

  header.append(left, right);
  return header;
}

// Style a scroll/table wrapper to match Latest Matches table chrome
function __sqStyleStatsTableWrap(wrap){
  if (!wrap || !wrap.style) return;
  wrap.style.border = '1px solid rgba(255,255,255,.08)';
  wrap.style.borderRadius = '14px';
  wrap.style.overflow = 'auto';
  if (!wrap.style.maxHeight) wrap.style.maxHeight = '56vh';
}

// ---- Stats navigation helpers ----
// We have TWO "Stats main menus":
//  - Home/Start Menu: per-player stats hub (Latest Matches, H2H, etc.)
//  - In-Game: game/match stats hub (Game Stats, Match Stats, etc.)
window.__sqStatsOrigin = window.__sqStatsOrigin || 'home';   // 'home' | 'ingame'
window.__sqStatsReturnPlayer = window.__sqStatsReturnPlayer || '';
window.__sqStatsDebugName = window.__sqStatsDebugName || 'New Game Screen Stats';

function __sqSetStatsOrigin(origin, playerName){
  window.__sqStatsOrigin = (origin === 'ingame') ? 'ingame' : 'home';
  window.__sqStatsDebugName = (window.__sqStatsOrigin === 'ingame') ? 'In Game Player Stats' : 'New Game Screen Stats';
  if (playerName != null) window.__sqStatsReturnPlayer = String(playerName || '').trim();
}

function __sqGoBackToStatsMain(playerName){
  try{
    const origin = window.__sqStatsOrigin || 'home';
    const name = String(playerName || window.__sqStatsReturnPlayer || window.__sqSelectedPlayerName || '').trim();

    if (origin === 'home'){
      // Home stats now return to the per-player hub; the hub owns player selection.
      if (typeof window.openPlayerStatsHub === 'function') return window.openPlayerStatsHub(name);
      if (typeof window.openPlayerStatsSelectDialog === 'function') return window.openPlayerStatsSelectDialog();
      return;
    }

    // In-game stats hub
    if (typeof window.openStatsHubDialog === 'function') return window.openStatsHubDialog();
    if (typeof openStatsHubDialog === 'function') return openStatsHubDialog();
  }catch(_){ }
}

// Arcade skin for all Player-Stats sub-dialogs: opaque ambient backdrop +
// neon card edge (via CSS classes), and one standardized BACK pill per
// footer (Close buttons removed — Back always steps back one screen).
function __sqStatsArcade(overlay, modal){
  try{ overlay && overlay.classList.add('sq-stats-bd'); }catch(_){ }
  try{ modal && modal.classList.add('sq-stats-modal'); }catch(_){ }
  try{
    (modal || overlay).querySelectorAll('.modal-footer').forEach(f => {
      f.classList.add('sq-stats-foot');
      f.querySelectorAll('button, .btn').forEach(b => {
        const t = String(b.textContent || '').trim().toLowerCase();
        if (t === 'close'){ b.remove(); return; }
        if (t === 'back' || t === '← back'){
          b.classList.add('ms2-back');
          b.classList.remove('sq-pill');
          b.innerHTML = '<span class="ms2-back-ar" aria-hidden="true">&#8592;</span><span class="ms2-back-txt">BACK</span>';
        }
      });
    });
  }catch(_){ }
}

// ==== (2) High Scores — per-player (Top 50 scores, official) ==================
window.openPlayerHighScoresDialog = async function openPlayerHighScoresDialog(playerName){
  const name = String(playerName||'').trim();
  if (!name) return;

  const overlay = document.createElement('div'); overlay.className='modal-backdrop';
  const modal   = document.createElement('div'); modal.className  ='modal';
  modal.style.maxWidth='980px'; modal.style.width='94vw';
  modal.style.maxHeight='90vh'; modal.style.overflow='hidden';

  const header  = __sqStatsHeader(`High Scores — ${name}`, 'Score / Avg per Round');
  const body    = document.createElement('div'); body.className   ='modal-body';
  body.style.paddingTop='8px';
  const footer  = document.createElement('div'); footer.className ='modal-footer';
  footer.style.justifyContent='flex-start';
  footer.style.gap='10px';

  // Data (prefer union; fall back to official games scan)
  const fmt = (ts)=>{
    try{
      if (!ts) return '';
      if (typeof window.fmtWhen === 'function') return window.fmtWhen(ts);
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime()) && typeof window.fmtDdMmYyAtTime === 'function') return window.fmtDdMmYyAtTime(d);
      return !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(ts);
    }catch(_){ return String(ts||''); }
  };

  let rows = [];
  try{
    if (typeof ensureCloudInit === 'function' && !ensureCloudInit()) throw new Error('cloud not ready');
    const tableName = (typeof TABLE_PLAYER_GAMES !== 'undefined' && TABLE_PLAYER_GAMES) ? TABLE_PLAYER_GAMES : 'player_games_union';
    const q = sb
      .from(tableName)
      .select('sheet_id, player, score, rounds, ts, is_practice')
      .ilike('player', name)
      .or('is_practice.is.null,is_practice.eq.false')
      .order('score', { ascending:false })
      .order('ts', { ascending:false })
      .limit(50);
    const { data, error } = await q;
    if (error) throw error;

    rows = (data||[]).filter(Boolean).map(r=>{
      const score = Number(r.score||0);
      const rounds = 14; // fixed: Avg is always Score / 14 (10–20 + D/T/B)
      return {
        sheet_id: r.sheet_id || null,
        score,
        avg: (score/rounds),
        when: fmt(r.ts),
        ts: r.ts
      };
    });
  }
  catch(e){
    console.warn('[HighScores] player_games_union query failed; showing empty.', e?.message||e);
  }

  // Fallback: derive Top 50 from official games if union is empty/mismatched (migration-safe)
  if (!rows.length){
    try{
      const gamesAll = (await __fetchOfficialGames(50000)).map(__normalizeGame)
        .filter(g => (g.players||[]).some(p => String(p||'').trim().toLowerCase()===name.toLowerCase()));
      const tmp = [];
      for (const g of gamesAll){
        const i = (g.players||[]).findIndex(p => String(p||'').trim().toLowerCase()===name.toLowerCase());
        if (i < 0) continue;
        const score = Number((g.totals||[])[i] || 0);
        let rounds = 14;
        try{
          if (typeof __roundCountFor==='function') rounds = __roundCountFor(g, i);
          else if (g.board && Array.isArray(g.board[i])) rounds = Math.min(14, g.board[i].length||0) || 14;
        }catch(_){}
        tmp.push({
          sheet_id: (g.raw && (g.raw.id || g.raw.game_id)) || null,
          score,
          avg: rounds ? (score/rounds) : 0,
          when: fmt(g.ts),
          ts: g.ts
        });
      }
      tmp.sort((a,b)=> (b.score-a.score) || (new Date(b.ts||0)-new Date(a.ts||0)));
      rows = tmp.slice(0, 50);
    }catch(e){
      console.warn('[HighScores] fallback scan failed.', e?.message||e);
    }
  }

  if (!rows.length){
    body.innerHTML = '<div class="muted" style="padding:18px; opacity:.75;">No high scores found.</div>';
  } else {
    // ensure sorted high->low
    rows.sort((a,b)=> (b.score-a.score) || (new Date(b.ts||0)-new Date(a.ts||0)));

    const table=document.createElement('table'); table.className='sq-table hs-table';
    const thead=document.createElement('thead'); const trh=document.createElement('tr');
    ['#','Score','Avg','When'].forEach((h,idx)=>{
      const th=document.createElement('th');
      th.textContent=h;
      if (idx===0) th.style.paddingLeft='14px';
      if (h==='When') th.style.textAlign='right';
      else if (h!=='#') th.style.textAlign='center';
      trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);

    const tbody=document.createElement('tbody');
    rows.slice(0,50).forEach((r,idx)=>{
      const tr=document.createElement('tr');
      const tdI=document.createElement('td'); tdI.textContent=String(idx+1); tdI.style.paddingLeft='14px'; tdI.className='sq-rank-cell';
      const tdS=document.createElement('td'); tdS.textContent=String(r.score); tdS.style.textAlign='center';
      const tdA=document.createElement('td'); tdA.textContent=Number(r.avg||0).toFixed(1); tdA.style.textAlign='center';
      const tdW=document.createElement('td'); tdW.textContent=String(r.when||''); tdW.style.textAlign='right'; tdW.style.paddingRight='14px';
      tr.append(tdI,tdS,tdA,tdW);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const wrap=document.createElement('div');
    wrap.style.maxHeight='56vh'; wrap.style.overflowY='auto';
    __sqStyleStatsTableWrap(wrap);
    wrap.appendChild(table);
    body.appendChild(wrap);
  }

  const backBtn=document.createElement('button'); backBtn.className='btn sq-pill'; backBtn.textContent='Back';
  backBtn.onclick=()=>{ overlay.remove(); __sqGoBackToStatsMain(); };
  footer.append(backBtn);

  modal.append(header, body, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  __sqStatsArcade(overlay, modal);

  const close=()=>overlay.remove();
  overlay.addEventListener('click',e=>{ if(e.target===overlay) close(); });
  overlay.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  modal.tabIndex=0; modal.focus();
};

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
    b.style.minHeight = '44px';
    b.style.padding = '8px 8px';
    b.style.fontSize = '11px';
    b.style.letterSpacing = '.04em';
    b.style.whiteSpace = 'nowrap';
    b.onclick = ()=>loadMode(m.id);
    modeButtons.push(b);
    modeToggle.appendChild(b);
  });

  const header  = __sqStatsHeader(`Progression — ${name}`, 'Scores over time', modeToggle);
  header.style.flexWrap = 'nowrap';
  const headerLeft = header.firstElementChild;
  const headerRight = header.lastElementChild;
  if (headerLeft){ headerLeft.style.minWidth='0'; headerLeft.style.flex='1 1 auto'; }
  if (headerRight){ headerRight.style.marginLeft='auto'; headerRight.style.flex='0 0 auto'; }
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
    const n = arr.length;
    if (!Number.isFinite(k) || k <= 0 || n < k) return pts;
    let sum = 0;
    for (let i=0; i<n; i++){
      sum += Number(arr[i]) || 0;
      if (i >= k) sum -= Number(arr[i-k]) || 0;
      if (i >= k-1) pts.push({ x:i, y:sum/k });
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

    if (mode === 'turbo'){
      const { data, error } = await client
        .from('v_games_turbo_clean')
        .select('id,created_at,state,totals')
        .order('created_at', { ascending:true })
        .limit(5000);
      if (error) throw error;

      const wanted = String(name || '').trim().toLowerCase();
      return (Array.isArray(data) ? data : [])
        .map(g=>{
          const state = g && g.state && typeof g.state === 'object' ? g.state : {};
          const players = Array.isArray(state.players) ? state.players : [];
          const idx = players.findIndex(p=>{
            const playerName = (p && typeof p === 'object') ? p.name : p;
            return String(playerName || '').trim().toLowerCase() === wanted;
          });
          if (idx < 0) return NaN;
          const totals = Array.isArray(g && g.totals) ? g.totals : [];
          return Number(totals[idx]);
        })
        .filter(v=>Number.isFinite(v) && v >= 0);
    }

    const { data, error } = await client
      .from('v_player_game_scores_official_clean')
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
    pillAll.textContent = `Avg ${avgAll.toFixed(1)} · Low ${minV} · High ${maxV}`;
    const rollingMeans = blockAvgPoints(scores, activeBlockSize).map(p=>p.y);
    if (!rollingMeans.length){
      pillAvg.textContent = `${activeBlockSize} Game AV needs ${activeBlockSize} games`;
      return;
    }
    const minAvg = Math.min(...rollingMeans);
    const maxAvg = Math.max(...rollingMeans);
    pillAvg.textContent = `Avg Low ${minAvg.toFixed(1)} · Avg High ${maxAvg.toFixed(1)}`;
  }

  const ro = new ResizeObserver(()=>draw());
  try { ro.observe(chartHost); } catch(_){}
  await loadMode('official');
}
;

// ==== (4) Target Hit % / Target Points % — canonical Supabase-view loaders =====
function __sqTargetPctClient(){
  try{ if (typeof ensureCloudInit === 'function') ensureCloudInit(); }catch(_){}
  return window.sb || (typeof sb !== 'undefined' ? sb : null);
}
function __sqTargetPctValue(row, keys){
  for (const k of keys){
    if (row && row[k] != null && row[k] !== '') return row[k];
  }
  return null;
}
function __sqTargetPctKey(row){
  const raw = __sqTargetPctValue(row, ['target_key','target_label','round_key','bucket_key','target_number','target_n','target']);
  if (raw == null) return '';
  const s = String(raw).trim().toUpperCase();
  if (s === 'DOUBLES' || s === 'DOUBLE') return 'D';
  if (s === 'TREBLES' || s === 'TRIPLES' || s === 'TREBLE' || s === 'TRIPLE') return 'T';
  if (s === 'BULL' || s === 'BULLS') return 'B';
  return s;
}
function __sqTargetPctOrder(k){
  if (/^\d+$/.test(String(k))) return Number(k);
  if (k === 'D') return 21;
  if (k === 'T') return 22;
  if (k === 'B') return 23;
  return 999;
}
async function __sqFetchPlayerTargetPctView(viewName, playerName){
  const client = __sqTargetPctClient();
  if (!client || typeof client.from !== 'function') {
    return { rows:[], source:viewName, missing:'Supabase client missing' };
  }
  const name = String(playerName || '').trim();
  const nameLC = name.toLowerCase();
  const attempts = [
    { col:'player_key', op:'eq', value:nameLC },
    { col:'player_name', op:'ilike', value:name },
    { col:'player', op:'ilike', value:name },
    { col:'name', op:'ilike', value:name },
    { col:'player_id', op:'eq', value:nameLC }
  ];
  let lastError = null;
  let emptySource = null;
  let hadSuccessfulFilter = false;
  for (const a of attempts){
    try{
      let q = client.from(viewName).select('*').limit(1000);
      q = a.op === 'ilike' ? q.ilike(a.col, a.value) : q.eq(a.col, a.value);
      const { data, error } = await q;
      if (!error) {
        const rows = Array.isArray(data) ? data : [];
        hadSuccessfulFilter = true;
        emptySource = emptySource || `${viewName}.${a.col}`;
        if (rows.length) return { rows, source:`${viewName}.${a.col}` };
        continue;
      }
      lastError = error;
      if (error && error.code === 'PGRST205') break;
    }catch(e){
      lastError = e;
    }
  }
  if (hadSuccessfulFilter) return { rows:[], source:emptySource || viewName };
  const msg = (lastError && (lastError.message || lastError.details || lastError.code)) || 'unknown error';
  return { rows:[], source:viewName, missing:msg, error:lastError };
}
async function __sqFetchPlayerTargetHitPctRows(playerName){
  const viewName = 'v_player_target_hit_pct';
  const client = __sqTargetPctClient();
  if (!client || typeof client.from !== 'function') {
    return { rows:[], source:viewName, missing:'Supabase client missing' };
  }
  const name = String(playerName || '').trim();
  const playerKey = name.toLowerCase();
  try{
    const { data, error } = await client
      .from(viewName)
      .select('player_key,player_name,target_key,target_label,target_sort,throws,hits,hit_pct,source_games,first_played_at,last_played_at')
      .eq('player_key', playerKey)
      .order('target_sort', { ascending:true })
      .limit(20);
    if (error) throw error;
    return { rows:Array.isArray(data) ? data : [], source:`${viewName}.player_key` };
  }catch(e){
    const msg = (e && (e.message || e.details || e.code)) || 'unknown error';
    return { rows:[], source:viewName, missing:msg, error:e };
  }
}
async function __sqFetchPlayerTargetPointsPctRows(playerName){
  const viewName = 'v_player_target_points_pct';
  const client = __sqTargetPctClient();
  if (!client || typeof client.from !== 'function') {
    return { rows:[], source:viewName, missing:'Supabase client missing' };
  }
  const name = String(playerName || '').trim();
  const playerKey = name.toLowerCase();
  try{
    const { data, error } = await client
      .from(viewName)
      .select('player_key,player_name,target_number,target_label,throws,actual_points,max_points,points_pct,source_games,first_played_at,last_played_at')
      .eq('player_key', playerKey)
      .limit(40);
    if (error) throw error;
    return { rows:Array.isArray(data) ? data : [], source:`${viewName}.player_key` };
  }catch(e){
    const msg = (e && (e.message || e.details || e.code)) || 'unknown error';
    return { rows:[], source:viewName, missing:msg, error:e };
  }
}
function __sqSetTargetPctActionsEnabled(body, enabled, reason){
  try{
    const modal = body && body.closest ? body.closest('.modal') : null;
    const buttons = modal ? modal.querySelectorAll('[data-target-pct-action]') : [];
    buttons.forEach(btn => {
      btn.disabled = !enabled;
      btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      btn.title = enabled ? '' : String(reason || 'Unavailable until required Supabase data is available.');
      btn.style.opacity = enabled ? '' : '.45';
      btn.style.cursor = enabled ? '' : 'not-allowed';
    });
  }catch(_){}
}
function __sqShowTargetPctUnavailable(body, message, formula, dependency){
  __sqSetTargetPctActionsEnabled(body, false, dependency);
  body.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = message;
  const f = document.createElement('p');
  f.className = 'tag muted';
  f.style.marginTop = '10px';
  f.textContent = formula;
  const d = document.createElement('p');
  d.className = 'tag muted';
  d.style.marginTop = '8px';
  d.textContent = dependency;
  body.append(p, f, d);
}

function __sqPctFmt(v, digits){
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits == null ? 1 : digits) + '%' : '0.0%';
}
function __sqCompletedWindowAveragePoints(values, windowSize){
  const n = Math.max(1, Number(windowSize || 5));
  const out = [];
  for (let end = n; end <= values.length; end += n){
    const slice = values.slice(end - n, end).filter(v => Number.isFinite(Number(v)));
    if (slice.length !== n) continue;
    out.push({ idx:end - 1, pct:slice.reduce((a,b) => a + Number(b), 0) / n });
  }
  return out;
}
function __sqProgressScaleMax(values){
  const maxRaw = Math.max(0, ...values.map(v => Number(v)).filter(v => Number.isFinite(v)));
  const withHeadroom = Math.min(100, Math.max(25, maxRaw * 1.08));
  const steps = [25,30,40,50,60,75,100];
  return steps.find(step => withHeadroom <= step) || 100;
}
function __sqProgressYAxisLabels(scaleMax){
  const max = Math.max(25, Math.min(100, Number(scaleMax) || 100));
  const step = max <= 25 ? 5 : (max <= 60 ? 10 : 25);
  const labels = [];
  for (let v = 0; v < max; v += step) labels.push(v);
  if (labels[labels.length - 1] !== max) labels.push(max);
  return labels;
}
function __sqPointsWeightedNorm(v){
  const n = Math.max(0, Math.min(100, Number(v) || 0));
  if (n <= 25) return (n / 25) * 0.66;
  if (n <= 75) return 0.66 + ((n - 25) / 50) * 0.22;
  return 0.88 + ((n - 75) / 25) * 0.12;
}
function __sqProgressBarGrey(i){
  return i % 2 ? 'rgba(180,190,210,0.34)' : 'rgba(180,190,210,0.22)';
}
function __sqProgressTargetButtons(mode, grouped){
  const keys = ['10','11','12','13','14','15','16','17','18','19','20','D','T','B'];
  return keys.map(k => {
    const hasRows = grouped && grouped.has(k) && grouped.get(k).length;
    return {
      key:k,
      label:k,
      disabled:!hasRows,
      reason:hasRows ? '' : `No ${mode === 'points' ? 'Target Points %' : 'Target Hit %'} Progress rows are available for ${k}.`
    };
  });
}
function __sqProgressAvg(rows, key){
  const vals = rows.map(r => Number(r && r[key])).filter(v => Number.isFinite(v));
  return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : null;
}
function __sqProgressPtsFmt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return 'n/a';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
function __sqProgressColor(key){
  const colors = {
    '10':'#38bdf8','11':'#a78bfa','12':'#fb7185','13':'#f59e0b','14':'#22c55e',
    '15':'#f472b6','16':'#2dd4bf','17':'#eab308','18':'#60a5fa','19':'#c084fc',
    '20':'#f97316','D':'#84cc16','T':'#06b6d4','B':'#ef4444'
  };
  return colors[String(key)] || '#f8fafc';
}
function __sqProgressSeriesStats(rows, windowSize){
  const values = rows.map(r => Number(r.pct || 0));
  const allAvg = values.length ? values.reduce((a,b) => a + b, 0) / values.length : 0;
  const half = Math.ceil(values.length / 2);
  const firstVals = values.slice(0, half);
  const secondVals = values.slice(half);
  const firstAvg = firstVals.length ? firstVals.reduce((a,b)=>a+b,0) / firstVals.length : allAvg;
  const secondAvg = secondVals.length ? secondVals.reduce((a,b)=>a+b,0) / secondVals.length : firstAvg;
  const avgPoints = __sqCompletedWindowAveragePoints(values, windowSize);
  return { values, allAvg, half, firstAvg, secondAvg, avgPoints };
}
function __sqProgressSessionScale(grouped, enabledKeys){
  const vals = [];
  (enabledKeys || []).forEach(k => {
    const rows = (grouped.get(k) || []).slice();
    if (!rows.length) return;
    const pctVals = rows.map(r => Number(r.pct || 0));
    vals.push(...pctVals);
    [5,10,20].forEach(win => {
      const stats = __sqProgressSeriesStats(rows, win);
      vals.push(stats.allAvg, stats.firstAvg, stats.secondAvg, ...stats.avgPoints.map(p => p.pct));
    });
  });
  return __sqProgressScaleMax(vals);
}
function __sqRenderProgressPills(host, items, seriesList){
  if (!host) return;
  host.innerHTML = '';
  host.style.marginTop = '12px';
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(190px, 1fr))';
  grid.style.gap = '10px';
  grid.style.alignItems = 'stretch';

  const makePill = (labelText) => {
    const pill = document.createElement('div');
    pill.className = 'tag';
    pill.style.cssText = 'padding:10px 14px;min-height:58px;display:flex;flex-direction:column;justify-content:center;gap:5px;'
      + 'background:#101827;border:1px solid rgba(35,164,255,.3);border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.25);';
    const label = document.createElement('span');
    label.className = 'muted';
    label.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;color:rgba(150,185,230,.85);';
    label.textContent = labelText;
    pill.appendChild(label);
    return pill;
  };

  items.forEach(item => {
    const pill = makePill(item.label);
    const value = document.createElement('strong');
    value.style.cssText = 'font-size:16px;line-height:1.3;white-space:pre-line;color:#ffd9b0;letter-spacing:.02em;';
    value.textContent = item.value;
    pill.appendChild(value);
    grid.appendChild(pill);
  });

  if (!(seriesList && seriesList.length) && !items.length){ return; }
  if (!(seriesList && seriesList.length)){ host.appendChild(grid); return; }
  const selected = makePill('Selected Targets');
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '7px';
  (seriesList || []).forEach(series => {
    const tag = document.createElement('span');
    tag.style.display = 'inline-flex';
    tag.style.alignItems = 'center';
    tag.style.gap = '4px';
    tag.style.fontWeight = '700';
    tag.style.fontSize = '12px';
    const dot = document.createElement('span');
    dot.style.width = '8px'; dot.style.height = '8px'; dot.style.borderRadius = '999px'; dot.style.background = series.color;
    tag.append(dot, document.createTextNode(series.key));
    wrap.appendChild(tag);
  });
  selected.appendChild(wrap);
  grid.appendChild(selected);
  host.appendChild(grid);
}
async function __sqFetchTargetProgressRows(mode, playerName){
  const client = __sqTargetPctClient();
  const viewName = mode === 'points' ? 'v_player_target_points_progress' : 'v_player_target_hit_progress';
  if (!client || typeof client.from !== 'function') {
    return { rows:[], source:viewName, missing:'Supabase client missing' };
  }
  const playerKey = String(playerName || '').trim().toLowerCase();
  const selectCols = mode === 'points'
    ? 'player_key,player_name,game_id,created_at,target_key,target_label,target_sort,target_number,round_score,max_round_score,round_pct'
    : 'player_key,player_name,game_id,created_at,target_key,target_label,target_sort,throws,hits,hit_pct';
  try{
    const rows = [];
    const pageSize = 1000;
    for (let from = 0; from < 60000; from += pageSize){
      const { data, error } = await client
        .from(viewName)
        .select(selectCols)
        .eq('player_key', playerKey)
        .order('target_sort', { ascending:true })
        .order('created_at', { ascending:true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = Array.isArray(data) ? data : [];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return { rows, source:`${viewName}.player_key` };
  }catch(e){
    const msg = (e && (e.message || e.details || e.code)) || 'unknown error';
    return { rows:[], source:viewName, missing:msg, error:e };
  }
}
function __sqNormalizeTargetProgressRows(mode, rows){
  return (Array.isArray(rows) ? rows : []).map((r, idx) => {
    const key = __sqTargetPctKey(r);
    const pctRaw = mode === 'points' ? __sqTargetPctValue(r, ['round_pct','pct','percentage']) : __sqTargetPctValue(r, ['hit_pct','pct','percentage']);
    const pct = Math.max(0, Math.min(100, Number(pctRaw || 0)));
    return {
      key,
      label:String(__sqTargetPctValue(r, ['target_label','target_key','target_number']) || key),
      sort:Number(__sqTargetPctValue(r, ['target_sort','target_number']) || __sqTargetPctOrder(key)),
      pct:Number.isFinite(pct) ? pct : 0,
      roundScore:Number(__sqTargetPctValue(r, ['round_score','actual_points','points']) || 0),
      maxRoundScore:Number(__sqTargetPctValue(r, ['max_round_score','max_points']) || 0),
      created_at:String(r.created_at || ''),
      game_id:String(r.game_id || ''),
      idx
    };
  }).filter(r => r.key).sort((a,b) => {
    const ta = Date.parse(a.created_at || '') || 0;
    const tb = Date.parse(b.created_at || '') || 0;
    if (ta !== tb) return ta - tb;
    if (a.game_id !== b.game_id) return a.game_id < b.game_id ? -1 : 1;
    return a.idx - b.idx;
  });
}
function __sqDrawTargetProgressCanvas(canvas, seriesList, windowSize, statsEl, emptyEl, mode, primaryKey, scaleMax, opts){
  if (!canvas) return;
  const o = opts || {};
  const t = Math.max(0, Math.min(1, Number.isFinite(o.t) ? o.t : 1));
  const scrubIdx = Number.isFinite(o.scrubIdx) ? o.scrubIdx : null;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width || 720));
  const height = Math.max(280, Math.floor(rect.height || 340));
  canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  // Arcade panel: vertical navy gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#15203a');
  bgGrad.addColorStop(0.55, '#0d1424');
  bgGrad.addColorStop(1, '#0a0f1c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const pad = { left:50, right:18, top:22, bottom:34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const isPoints = mode === 'points';
  const labels = isPoints ? [0,25,50,75,100] : __sqProgressYAxisLabels(scaleMax);
  const yFor = v => {
    if (isPoints) return pad.top + (1 - __sqPointsWeightedNorm(v)) * plotH;
    return pad.top + (scaleMax - Math.max(0, Math.min(scaleMax, Number(v) || 0))) / scaleMax * plotH;
  };
  const xFor = (rows, i) => pad.left + (rows.length <= 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const activeSeries = (seriesList || []).filter(s => s && s.rows && s.rows.length);

  ctx.strokeStyle = 'rgba(122,170,255,.12)'; ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(150,185,230,.85)'; ctx.font = '700 10px system-ui, -apple-system, Segoe UI, sans-serif';
  labels.forEach(v => {
    const y = yFor(v);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillText(String(v) + '%', 10, y + 3);
  });
  ctx.strokeStyle = 'rgba(122,170,255,.30)';
  ctx.beginPath(); ctx.moveTo(pad.left, height - pad.bottom); ctx.lineTo(width - pad.right, height - pad.bottom); ctx.stroke();

  canvas.__sqHitMap = null;
  if (!activeSeries.length){
    if (emptyEl) emptyEl.textContent = 'No progress data yet for this target.';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.textContent = '';

  const multi = activeSeries.length > 1;
  const baseY = yFor(0);
  const ease = 1 - Math.pow(1 - t, 3);

  // Per-game bars: cool blue gradient columns; they "grow" in with a stagger.
  const barGrad = ctx.createLinearGradient(0, pad.top, 0, baseY);
  barGrad.addColorStop(0, 'rgba(74,163,255,.34)');
  barGrad.addColorStop(1, 'rgba(74,163,255,.05)');
  activeSeries.forEach((series, seriesIdx) => {
    const rows = series.rows;
    const stats = __sqProgressSeriesStats(rows, windowSize);
    const values = stats.values;
    const barW = multi ? 1.3 : Math.max(2.5, Math.min(12, plotW / Math.max(1, rows.length) * .55));
    const offset = multi ? (seriesIdx - (activeSeries.length - 1) / 2) * Math.min(3, Math.max(1.2, plotW / Math.max(1, rows.length) * .08)) : 0;
    values.forEach((v, i) => {
      const x = xFor(rows, i) + offset;
      // staggered grow-in: later bars start later
      const local = multi ? 1 : Math.max(0, Math.min(1, (ease - (i / Math.max(1, values.length)) * .55) / .45));
      if (local <= 0) return;
      const y = baseY - (baseY - yFor(v)) * local;
      if (multi){
        ctx.strokeStyle = series.color; ctx.globalAlpha = .28; ctx.lineWidth = barW;
        ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        const hot = scrubIdx === i;
        ctx.fillStyle = hot ? 'rgba(255,164,64,.85)' : barGrad;
        const h = Math.max(0, baseY - y);
        if (h < .5) return;
        if (typeof ctx.roundRect === 'function'){
          ctx.beginPath(); ctx.roundRect(x - barW / 2, y, barW, h, [2.5, 2.5, 0, 0]); ctx.fill();
        } else {
          ctx.fillRect(x - barW / 2, y, barW, h);
        }
      }
    });
  });

  // Reference lines: dashed all-time average + green trajectory
  activeSeries.forEach(series => {
    const rows = series.rows;
    const stats = __sqProgressSeriesStats(rows, windowSize);
    ctx.save();
    ctx.setLineDash([5,5]);
    ctx.strokeStyle = 'rgba(220,235,255,.4)'; ctx.globalAlpha = (multi ? .35 : .9) * ease; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.left, yFor(stats.allAvg)); ctx.lineTo(pad.left + plotW * ease, yFor(stats.allAvg)); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(115,240,126,.9)'; ctx.globalAlpha = (multi ? .35 : .85) * ease; ctx.lineWidth = multi ? 1.4 : 2;
    ctx.shadowColor = 'rgba(115,240,126,.5)'; ctx.shadowBlur = multi ? 0 : 6;
    const trajY0 = yFor(stats.firstAvg), trajY1 = yFor(stats.secondAvg);
    ctx.beginPath(); ctx.moveTo(pad.left, trajY0);
    ctx.lineTo(pad.left + plotW * ease, trajY0 + (trajY1 - trajY0) * ease);
    ctx.stroke();
    ctx.restore();
  });

  // Hero moving-average line (clipped by animation progress: it "draws in")
  activeSeries.forEach(series => {
    const rows = series.rows;
    const stats = __sqProgressSeriesStats(rows, windowSize);
    if (!stats.avgPoints.length) return;
    const lineColor = multi ? series.color : '#ffa440';
    const pts = stats.avgPoints.map(p => ({ x:xFor(rows, p.idx), y:yFor(p.pct), pct:p.pct, idx:p.idx }));

    // Partial polyline up to fraction `ease` (interpolating the last segment)
    const seg = (pts.length - 1) * ease;
    const full = Math.floor(seg);
    const frac = seg - full;
    const drawPts = pts.slice(0, full + 1);
    if (frac > 0 && full < pts.length - 1){
      const a = pts[full], b = pts[full + 1];
      drawPts.push({ x:a.x + (b.x - a.x) * frac, y:a.y + (b.y - a.y) * frac, pct:a.pct + (b.pct - a.pct) * frac });
    }
    if (drawPts.length < 1) return;

    if (!multi && drawPts.length > 1){
      const area = ctx.createLinearGradient(0, pad.top, 0, baseY);
      area.addColorStop(0, 'rgba(255,122,0,.24)');
      area.addColorStop(1, 'rgba(255,122,0,0)');
      ctx.beginPath();
      drawPts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.lineTo(drawPts[drawPts.length - 1].x, baseY);
      ctx.lineTo(drawPts[0].x, baseY);
      ctx.closePath();
      ctx.fillStyle = area; ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = multi ? series.color : 'rgba(255,140,40,.8)';
    ctx.shadowBlur = multi ? 6 : 11;
    ctx.strokeStyle = lineColor; ctx.lineWidth = multi ? 2.2 : 3;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    drawPts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = lineColor;
    drawPts.forEach((p, i) => { if (i < drawPts.length - (frac > 0 ? 1 : 0)) { ctx.beginPath(); ctx.arc(p.x, p.y, multi ? 2 : 2.6, 0, Math.PI * 2); ctx.fill(); } });

    // Comet head while animating
    const tip = drawPts[drawPts.length - 1];
    if (t < 1){
      ctx.save();
      ctx.shadowColor = 'rgba(255,180,80,1)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (!multi && t >= 1){
      // PEAK marker
      let pk = 0; pts.forEach((p, i) => { if (p.pct > pts[pk].pct) pk = i; });
      if (pts.length > 2 && pk !== pts.length - 1){
        const p = pts[pk];
        ctx.save();
        ctx.shadowColor = 'rgba(115,240,126,.9)'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#73f07e';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(115,240,126,.95)';
        ctx.font = '800 9px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PEAK', p.x, Math.max(pad.top + 8, p.y - 11));
        ctx.textAlign = 'left';
      }
      // Live end dot + value badge
      const lp = pts[pts.length - 1];
      ctx.save();
      ctx.shadowColor = 'rgba(255,140,40,.95)'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(lp.x, lp.y, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = lineColor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lp.x, lp.y, 4.4, 0, Math.PI * 2); ctx.stroke();
      if (scrubIdx == null){
        const txt = Math.round(lp.pct) + '%';
        ctx.font = '800 12px system-ui, -apple-system, Segoe UI, sans-serif';
        const tw = ctx.measureText(txt).width;
        const bw = tw + 16, bh = 22;
        let bx = Math.min(width - pad.right - bw, lp.x + 10);
        let by = Math.max(pad.top, Math.min(baseY - bh, lp.y - bh - 8));
        ctx.fillStyle = '#101827';
        ctx.strokeStyle = 'rgba(255,164,64,.85)'; ctx.lineWidth = 1.2;
        if (typeof ctx.roundRect === 'function'){
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 7); ctx.fill(); ctx.stroke();
        } else { ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh); }
        ctx.fillStyle = '#ffd9b0';
        ctx.fillText(txt, bx + 8, by + 15);
      }
    }
  });

  // Hit map for scrubbing (single-series only)
  if (!multi){
    const series = activeSeries[0];
    const rows = series.rows;
    const stats = __sqProgressSeriesStats(rows, windowSize);
    canvas.__sqHitMap = {
      xs: rows.map((r, i) => xFor(rows, i)),
      rows,
      values: stats.values,
      maAt: (i) => {
        let best = null;
        stats.avgPoints.forEach(p => { if (p.idx <= i && (best == null || p.idx > best.idx)) best = p; });
        return best ? best.pct : null;
      }
    };
    // Scrub crosshair + info card
    if (scrubIdx != null && rows[scrubIdx]){
      const x = xFor(rows, scrubIdx);
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
      ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, baseY); ctx.stroke();
      ctx.setLineDash([]);
      const v = stats.values[scrubIdx];
      const ma = canvas.__sqHitMap.maAt(scrubIdx);
      const d = new Date(rows[scrubIdx].created_at || '');
      const when = Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { day:'numeric', month:'short' }).toUpperCase() : '';
      const l1 = 'GAME ' + (scrubIdx + 1) + (when ? ' · ' + when : '');
      const l2 = 'ROUND ' + Math.round(v) + '%' + (ma != null ? ('   AV ' + Math.round(ma) + '%') : '');
      ctx.font = '800 10px system-ui, -apple-system, Segoe UI, sans-serif';
      const w1 = ctx.measureText(l1).width;
      ctx.font = '800 12px system-ui, -apple-system, Segoe UI, sans-serif';
      const w2 = ctx.measureText(l2).width;
      const bw = Math.max(w1, w2) + 20, bh = 42;
      let bx = x + 12; if (bx + bw > width - pad.right) bx = x - bw - 12;
      bx = Math.max(pad.left, Math.min(width - pad.right - bw, bx));
      const by = pad.top + 6;
      ctx.fillStyle = 'rgba(16,24,39,.96)';
      ctx.strokeStyle = 'rgba(35,164,255,.55)'; ctx.lineWidth = 1.2;
      if (typeof ctx.roundRect === 'function'){
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill(); ctx.stroke();
      } else { ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh); }
      ctx.fillStyle = 'rgba(150,185,230,.9)';
      ctx.font = '800 10px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(l1, bx + 10, by + 16);
      ctx.fillStyle = '#ffd9b0';
      ctx.font = '800 12px system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(l2, bx + 10, by + 33);
      // marker dot on the game bar top
      ctx.save();
      ctx.shadowColor = 'rgba(255,164,64,.9)'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(x, yFor(v), 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  ctx.fillStyle = 'rgba(150,185,230,.7)';
  ctx.font = '800 9px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('OLDEST', pad.left, height - 10);
  const newest = 'LATEST';
  ctx.fillText(newest, width - pad.right - ctx.measureText(newest).width, height - 10);

  // Stat pills: gauge + verdict carry the headline numbers now, so keep this
  // row lean — points extras for points mode, legend chips when comparing.
  const primary = activeSeries.find(s => s.key === primaryKey) || activeSeries[activeSeries.length - 1];
  if (statsEl && primary) {
    const rows = primary.rows;
    const stats = __sqProgressSeriesStats(rows, windowSize);
    const items = [];
    if (isPoints){
      const allPts = __sqProgressAvg(rows, 'roundScore');
      items.push({ label:'Round score — ' + primary.key, value: __sqProgressPtsFmt(allPts) + ' pts avg' });
    }
    __sqRenderProgressPills(statsEl, items, multi ? activeSeries : []);
  }
}

// FORM gauge: arc dial with heat zones, a glowing needle for current form
// (latest moving average) and a notch marking the all-time average.
function __sqDrawFormGauge(canvas, value, avg, t){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(150, Math.floor(rect.width || 170));
  const height = Math.max(96, Math.floor(rect.height || 104));
  canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2, cy = height - 14, R = Math.min(width / 2 - 10, height - 26);
  const angFor = v => Math.PI + (Math.max(0, Math.min(100, v)) / 100) * Math.PI;
  const zones = [
    [0, 35, 'rgba(58,110,190,.85)'],
    [35, 48, 'rgba(199,139,43,.9)'],
    [48, 60, 'rgba(249,118,24,.95)'],
    [60, 100, 'rgba(115,240,126,.95)']
  ];
  zones.forEach(z => {
    ctx.beginPath();
    ctx.arc(cx, cy, R, angFor(z[0]), angFor(z[1]));
    ctx.strokeStyle = z[2]; ctx.lineWidth = 7; ctx.lineCap = 'butt';
    ctx.stroke();
  });
  // inner track
  ctx.beginPath(); ctx.arc(cx, cy, R - 9, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(122,170,255,.14)'; ctx.lineWidth = 1; ctx.stroke();
  // all-time average notch
  if (Number.isFinite(avg)){
    const a = angFor(avg);
    ctx.save();
    ctx.strokeStyle = 'rgba(235,245,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    ctx.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    ctx.stroke();
    ctx.restore();
  }
  // needle (animated)
  const shown = (Number.isFinite(value) ? value : 0) * Math.max(0, Math.min(1, t));
  const na = angFor(shown);
  ctx.save();
  ctx.shadowColor = 'rgba(255,140,40,.9)'; ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ffa440'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * (R - 14), cy + Math.sin(na) * (R - 14));
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#101827';
  ctx.strokeStyle = 'rgba(255,164,64,.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// XP CORE reactor: a full 360° energy ring filling to level-progress, a glowing
// tip, orbiting sparks and a pulsing core. (level number is a DOM overlay so it
// stays crisp for the count-up). Unique to the XP tab — not a gauge/needle.
function __sqDrawXpReactor(canvas, pct, fill, clockMs){
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(120, Math.floor(rect.width || 130));
  const H = Math.max(120, Math.floor(rect.height || 130));
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 11;
  const start = -Math.PI / 2;
  const p = Math.max(0, Math.min(1, pct)) * Math.max(0, Math.min(1, fill));
  const ms = clockMs || 0;
  // core glow (pulsing)
  const pulse = 0.14 + 0.07 * Math.sin(ms / 360);
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.85);
  cg.addColorStop(0, 'rgba(255,150,60,' + pulse.toFixed(3) + ')');
  cg.addColorStop(1, 'transparent');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2); ctx.fill();
  // track ring
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(122,170,255,.14)'; ctx.lineWidth = 8; ctx.stroke();
  // progress arc
  const grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  grad.addColorStop(0, '#ff7a18'); grad.addColorStop(1, '#ffd264');
  ctx.save(); ctx.shadowColor = 'rgba(255,150,60,.7)'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(cx, cy, R, start, start + p * Math.PI * 2);
  ctx.strokeStyle = grad; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
  // tip dot
  const tipA = start + p * Math.PI * 2;
  ctx.save(); ctx.shadowColor = 'rgba(255,205,95,1)'; ctx.shadowBlur = 14; ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx + Math.cos(tipA) * R, cy + Math.sin(tipA) * R, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // orbiting sparks
  for (let i = 0; i < 3; i++){
    const a = ms / 1000 * 1.5 + i * (Math.PI * 2 / 3);
    ctx.save(); ctx.shadowColor = 'rgba(255,180,80,.9)'; ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,206,120,.95)';
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3), 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function __sqOpenTargetProgressDialog(mode, playerName, opts){
  const name = String(playerName || '').trim();
  const parentOverlay = opts && opts.parentOverlay;
  const title = mode === 'points' ? `Target Points % Progress — ${name}` : `Target Hit % Progress — ${name}`;
  const subtitle = mode === 'points' ? 'Round score percentage by target' : 'Round hit percentage by target';
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal';
  modal.style.maxWidth = '1020px'; modal.style.width = '94vw'; modal.style.maxHeight = '92vh'; modal.style.overflow = 'hidden';
  const header = __sqStatsHeader(title, subtitle);
  const body = document.createElement('div'); body.className = 'modal-body'; body.style.paddingTop = '8px'; body.style.overflowY = 'auto';
  const footer = document.createElement('div'); footer.className = 'modal-footer';
  const backBtn = document.createElement('button'); backBtn.className = 'btn sq-pill'; backBtn.textContent = 'Back';
  backBtn.onclick = () => { overlay.remove(); if (parentOverlay) { parentOverlay.style.display = ''; try{ parentOverlay.querySelector('.modal').focus(); }catch(_){} } else { __sqGoBackToStatsMain(name); } };
  footer.append(backBtn); modal.append(header, body, footer); overlay.appendChild(modal); document.body.appendChild(overlay);
  __sqStatsArcade(overlay, modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) backBtn.click(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') backBtn.click(); });
  modal.tabIndex = 0; modal.focus();

  body.innerHTML = '<div class="sq-modal-loading"><div class="sq-loadbar"><span class="sq-loadbar-fill"></span></div></div>';
  (async () => {
    const result = await __sqFetchTargetProgressRows(mode, name);
    if (result.missing || !result.rows.length){
      console.warn('[SQ] Target progress dependency missing or empty', {
        required_view: mode === 'points' ? 'v_player_target_points_progress' : 'v_player_target_hit_progress',
        metric:mode,
        player:name,
        detail:result.missing || 'zero rows'
      });
      body.innerHTML = '';
      const msg = document.createElement('p'); msg.className = 'muted';
      msg.textContent = 'No progress data yet — play more games to build the trend.';
      body.append(msg);
      return;
    }

    console.debug('[SQ] Target progress source used', { source:result.source, metric:mode, rows:result.rows.length });
    const normalized = __sqNormalizeTargetProgressRows(mode, result.rows);
    const grouped = new Map();
    normalized.forEach(r => { if (!grouped.has(r.key)) grouped.set(r.key, []); grouped.get(r.key).push(r); });

    body.innerHTML = '';
    const targetRow = document.createElement('div'); targetRow.className = 'sq-controls-row'; targetRow.style.display = 'flex'; targetRow.style.flexWrap = 'wrap'; targetRow.style.gap = '6px'; targetRow.style.marginBottom = '10px';
    const avgRow = document.createElement('div'); avgRow.className = 'sq-controls-row'; avgRow.style.display = 'flex'; avgRow.style.flexWrap = 'wrap'; avgRow.style.gap = '6px'; avgRow.style.marginBottom = '10px';

    // FORM strip: gauge + verdict stamp
    const formRow = document.createElement('div');
    formRow.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:10px;padding:10px 14px;'
      + 'background:#101827;border:1px solid rgba(35,164,255,.3);border-radius:14px;box-shadow:0 6px 16px rgba(0,0,0,.3);';
    const gaugeCanvas = document.createElement('canvas');
    gaugeCanvas.style.cssText = 'width:170px;height:104px;flex:0 0 auto;';
    const formInfo = document.createElement('div');
    formInfo.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start;';
    const formValue = document.createElement('div');
    formValue.style.cssText = 'font-size:30px;font-weight:900;color:#ffd9b0;line-height:1;letter-spacing:.02em;';
    const verdict = document.createElement('span');
    verdict.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:99px;font-weight:900;font-size:12px;letter-spacing:.1em;';
    const formSub = document.createElement('div');
    formSub.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;color:rgba(150,185,230,.85);';
    formInfo.append(formValue, verdict, formSub);
    formRow.append(gaugeCanvas, formInfo);

    const canvasWrap = document.createElement('div'); canvasWrap.style.cssText = 'width:100%;height:340px;border:1px solid rgba(35,164,255,.25);border-radius:14px;overflow:hidden;background:#0d1424;box-shadow:0 10px 26px rgba(0,0,0,.4), 0 0 24px rgba(47,134,255,.08);';
    const canvas = document.createElement('canvas'); canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.touchAction = 'pan-y'; canvasWrap.appendChild(canvas);

    // Hot/cold streak strip: one cell per recent game, tap to inspect
    const stripWrap = document.createElement('div');
    stripWrap.style.cssText = 'margin-top:10px;';
    const stripLabel = document.createElement('div');
    stripLabel.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:rgba(150,185,230,.85);margin-bottom:6px;';
    stripLabel.textContent = 'Recent games — tap to inspect';
    const strip = document.createElement('div');
    strip.style.cssText = 'display:flex;gap:3px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;';
    stripWrap.append(stripLabel, strip);

    const stats = document.createElement('div'); stats.className = 'sq-progress-pills';
    const empty = document.createElement('p'); empty.className = 'muted'; empty.style.marginTop = '8px';

    const targetConfigs = __sqProgressTargetButtons(mode, grouped);
    const enabledKeys = targetConfigs.filter(t => !t.disabled).map(t => t.key);
    const stableScaleMax = __sqProgressSessionScale(grouped, enabledKeys);
    let selectedTargets = [enabledKeys[0] || '10'];
    let primaryTarget = selectedTargets[0];
    let windowSize = 5;
    let scrubIdx = null;
    let animRaf = 0;
    const rowsForKey = key => (grouped.get(key) || []).slice().sort((a,b) => {
      const ta = Date.parse(a.created_at || '') || 0;
      const tb = Date.parse(b.created_at || '') || 0;
      if (ta !== tb) return ta - tb;
      return a.idx - b.idx;
    });
    const currentSeries = () => selectedTargets.map(key => ({ key, color:__sqProgressColor(key), rows:rowsForKey(key) })).filter(s => s.rows.length);

    const verdictFor = (stats) => {
      const d = stats.secondAvg - stats.firstAvg;
      if (d >= 5)   return { label:'ON FIRE', color:'#ffa440', glow:'rgba(255,140,40,.45)', arrow:'↑' };
      if (d >= 1.5) return { label:'CLIMBING', color:'#73f07e', glow:'rgba(115,240,126,.4)', arrow:'↑' };
      if (d > -1.5) return { label:'STEADY', color:'#4aa3ff', glow:'rgba(74,163,255,.4)', arrow:'→' };
      return { label:'COOLING', color:'#7cc0ff', glow:'rgba(124,192,255,.35)', arrow:'↓' };
    };

    let gaugeFrom = 0; // needle rolls from the previous target's value
    const paintForm = (series, tv) => {
      const isSingle = series.length === 1;
      formRow.style.display = isSingle ? 'flex' : 'none';
      stripWrap.style.display = isSingle ? '' : 'none';
      if (!isSingle || !series[0]) return;
      const st = __sqProgressSeriesStats(series[0].rows, windowSize);
      const cur = st.avgPoints.length ? st.avgPoints[st.avgPoints.length - 1].pct : st.allAvg;
      const e = 1 - Math.pow(1 - Math.max(0, Math.min(1, tv)), 3);
      const shown = gaugeFrom + (cur - gaugeFrom) * e;
      __sqDrawFormGauge(gaugeCanvas, shown, st.allAvg, 1);
      formValue.textContent = Math.round(shown) + '%';
      if (tv >= 1) gaugeFrom = cur;
      const v = verdictFor(st);
      verdict.textContent = v.arrow + ' ' + v.label;
      verdict.style.background = '#0d1424';
      verdict.style.border = '1px solid ' + v.color;
      verdict.style.color = v.color;
      verdict.style.boxShadow = '0 0 16px ' + v.glow;
      formSub.textContent = 'Form ' + windowSize + '-game av · all-time ' + Math.round(st.allAvg) + '% (notch)';
    };

    const buildStrip = (series) => {
      strip.innerHTML = '';
      if (series.length !== 1) return;
      const rows = series[0].rows;
      const st = __sqProgressSeriesStats(rows, windowSize);
      const startIdx = Math.max(0, rows.length - 40);
      for (let i = startIdx; i < rows.length; i++){
        const v = st.values[i];
        const hot = v >= st.allAvg;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.setAttribute('aria-label', 'Game ' + (i + 1) + ': ' + Math.round(v) + '%');
        const idx = i;
        const active = scrubIdx === i;
        cell.style.cssText = 'flex:0 0 auto;width:12px;height:20px;border-radius:4px;padding:0;cursor:pointer;'
          + 'background:' + (hot ? 'linear-gradient(180deg,#ffb347,#f97618)' : 'rgba(74,163,255,.16)') + ';'
          + 'border:1px solid ' + (active ? '#fff' : (hot ? 'rgba(255,190,110,.7)' : 'rgba(74,163,255,.25)')) + ';'
          + (hot ? 'box-shadow:0 0 8px rgba(255,140,40,.35);' : '');
        cell.onclick = () => { scrubIdx = (scrubIdx === idx) ? null : idx; drawStatic(); };
        strip.appendChild(cell);
      }
    };

    const paint = (tv) => {
      const series = currentSeries();
      __sqDrawTargetProgressCanvas(canvas, series, windowSize, stats, empty, mode, primaryTarget, stableScaleMax, { t:tv, scrubIdx });
      paintForm(series, tv);
    };
    const syncChips = () => {
      Array.from(targetRow.querySelectorAll('button')).forEach(b => {
        const selected = selectedTargets.includes(b.dataset.target);
        b.classList.toggle('primary', selected);
        b.style.borderColor = selected ? __sqProgressColor(b.dataset.target) : '';
      });
      Array.from(avgRow.querySelectorAll('button')).forEach(b => b.classList.toggle('primary', Number(b.dataset.window) === windowSize));
    };
    const drawStatic = () => { syncChips(); paint(1); buildStrip(currentSeries()); };
    const draw = () => {
      syncChips();
      scrubIdx = null;
      cancelAnimationFrame(animRaf);
      let reduce = false;
      try{ reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ }
      const dur = reduce ? 0 : 850;
      const start = performance.now();
      const step = now => {
        const raw = dur ? Math.min(1, (now - start) / dur) : 1;
        paint(raw);
        if (raw < 1) animRaf = requestAnimationFrame(step);
        else buildStrip(currentSeries());
      };
      animRaf = requestAnimationFrame(step);
    };

    // Scrub-to-inspect: drag or move across the chart
    let scrubbing = false;
    const scrubTo = clientX => {
      const hit = canvas.__sqHitMap;
      if (!hit || !hit.xs.length) return;
      const r = canvas.getBoundingClientRect();
      const x = clientX - r.left;
      let best = 0, bd = Infinity;
      hit.xs.forEach((hx, i) => { const d = Math.abs(hx - x); if (d < bd){ bd = d; best = i; } });
      if (scrubIdx !== best){ scrubIdx = best; paint(1); buildStrip(currentSeries()); }
    };
    canvas.addEventListener('pointerdown', e => { if (!canvas.__sqHitMap) return; scrubbing = true; scrubTo(e.clientX); });
    canvas.addEventListener('pointermove', e => { if (scrubbing || e.pointerType === 'mouse') scrubTo(e.clientX); });
    window.addEventListener('pointerup', () => { scrubbing = false; });
    canvas.addEventListener('pointerleave', () => { if (!scrubbing && scrubIdx != null){ scrubIdx = null; paint(1); buildStrip(currentSeries()); } });

    targetConfigs.forEach(t => {
      const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = t.label; btn.dataset.target = t.key;
      if (t.disabled){ btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); btn.title = t.reason; btn.style.opacity = '.45'; btn.style.cursor = 'not-allowed'; }
      btn.onclick = () => {
        if (t.disabled) return;
        // Single-select: tapping a new target rolls the whole view (line,
        // gauge needle, verdict, strip) over to that target.
        if (selectedTargets.length === 1 && selectedTargets[0] === t.key) return;
        selectedTargets = [t.key];
        primaryTarget = t.key;
        draw();
      };
      targetRow.appendChild(btn);
    });
    [5,10,20].forEach(n => {
      const btn = document.createElement('button'); btn.className = 'btn small'; btn.textContent = `${n} Round AV`; btn.dataset.window = String(n);
      btn.onclick = () => { windowSize = n; draw(); };
      avgRow.appendChild(btn);
    });
    body.append(targetRow, avgRow, formRow, canvasWrap, stripWrap, stats, empty);
    draw();
    try{ new ResizeObserver(() => drawStatic()).observe(canvasWrap); }catch(_){ window.addEventListener('resize', () => drawStatic(), { passive:true }); }
  })();
  return overlay;
}
window.openPlayerTargetPointsProgressDialog = function openPlayerTargetPointsProgressDialog(playerName, opts){ return __sqOpenTargetProgressDialog('points', playerName, opts || {}); };
window.openPlayerTargetHitProgressDialog = function openPlayerTargetHitProgressDialog(playerName, opts){ return __sqOpenTargetProgressDialog('hit', playerName, opts || {}); };

function __sqBuildTargetPctShell(title, subtitle, playerName, metricMode){
  const name = String(playerName || '').trim();
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal';
  modal.style.maxWidth = '980px'; modal.style.width = '94vw';
  modal.style.maxHeight = '90vh'; modal.style.overflow = 'hidden';
  const header = __sqStatsHeader(title, subtitle);
  const body = document.createElement('div'); body.className = 'modal-body';
  body.style.paddingTop = '8px'; body.style.maxHeight = 'none'; body.style.overflowY = 'visible';
  const footer = document.createElement('div'); footer.className = 'modal-footer';
  const backBtn = document.createElement('button'); backBtn.className = 'btn sq-pill'; backBtn.textContent = 'Back';
  const spacer = document.createElement('div'); spacer.style.flex = '1';
  const spiderBtn = document.createElement('button'); spiderBtn.className = 'btn small'; spiderBtn.textContent = 'SPIDER'; spiderBtn.dataset.targetPctAction = 'spider';
  const progBtn = document.createElement('button'); progBtn.className = 'btn small'; progBtn.textContent = 'PROGRESS'; progBtn.dataset.targetPctAction = 'progress';
  spiderBtn.disabled = true; spiderBtn.setAttribute('aria-disabled', 'true'); spiderBtn.title = 'Available after target percentage data loads.'; spiderBtn.style.opacity = '.45'; spiderBtn.style.cursor = 'not-allowed';
  progBtn.disabled = true; progBtn.setAttribute('aria-disabled', 'true'); progBtn.title = 'Progress requires a Supabase target percentage progression view.'; progBtn.style.opacity = '.45'; progBtn.style.cursor = 'not-allowed';
  backBtn.onclick = () => { overlay.remove(); __sqGoBackToStatsMain(name); };
  spiderBtn.onclick = () => {
    const mode = String(metricMode || 'hit').toLowerCase();
    const data = mode === 'points' ? window.__lastPointsPctSpiderData : window.__lastTargetHitPctSpiderData;
    if (data && typeof window.openPlayerSpiderDialog === 'function') {
      overlay.style.display = 'none';
      window.openPlayerSpiderDialog(name, { parentOverlay:overlay, mode, data });
      return;
    }
    try{ if (typeof toast === 'function') toast('SPIDER not available until target percentage data is loaded'); }catch(_){}
  };
  progBtn.onclick = () => {
    const mode = String(metricMode || 'hit').toLowerCase();
    const fn = mode === 'points' ? window.openPlayerTargetPointsProgressDialog : window.openPlayerTargetHitProgressDialog;
    if (typeof fn === 'function') {
      overlay.style.display = 'none';
      fn(name, { parentOverlay:overlay });
      return;
    }
    try{ if (typeof toast === 'function') toast('PROGRESS is not available until a Supabase target percentage progression view exists'); }catch(_){}
  };
  footer.append(backBtn, spacer, spiderBtn, progBtn);
  modal.append(header, body, footer); overlay.appendChild(modal); document.body.appendChild(overlay);
  __sqStatsArcade(overlay, modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();
  return { overlay, body };
}

window.openPlayerTargetHitDialog = async function openPlayerTargetHitDialog(playerName){
  const name = String(playerName || '').trim();
  if (!name) return;
  const ui = __sqBuildTargetPctShell(`Target Hit % — ${name}`, 'Throws / Hits / %', name, 'hit');
  const body = ui.body;
  body.innerHTML = '<p class="muted">Loading…</p>';

  const result = await __sqFetchPlayerTargetHitPctRows(name);
  if (result.missing || !result.rows.length){
    console.warn('[SQ] Target Hit % dependency missing or empty', {
      required_view:'v_player_target_hit_pct',
      player:name,
      source:result.source,
      detail:result.missing || 'zero rows'
    });
    __sqShowTargetPctUnavailable(
      body,
      'Target Hit % is not available yet. Accurate hit-rate data requires throw-level segment data or a Supabase view that records correct target hits.',
      'Formula: Target Hit % = successful target hits / throws at that target. Number rounds require actual segment number truth; points alone are not used.',
      'Missing dependency: v_player_target_hit_pct (player_id/player_key/player_name, target_key/target_label, throws, hits, hit_pct).'
    );
    return;
  }

  console.debug('[SQ] Target Hit % source used', { source:result.source, rows:result.rows.length });
  __sqSetTargetPctActionsEnabled(body, true);
  const rows = result.rows.map(r => {
    const throwsN = Number(__sqTargetPctValue(r, ['throws','throw_count','thrown']) || 0);
    const hits = Number(__sqTargetPctValue(r, ['hits','successful_hits','hit_count']) || 0);
    const pctRaw = __sqTargetPctValue(r, ['hit_pct','pct','percentage']);
    const pct = Number.isFinite(Number(pctRaw)) ? Number(pctRaw) : (throwsN ? hits * 100 / throwsN : 0);
    return {
      key:__sqTargetPctKey(r),
      throwsN,
      hits,
      pct,
      games:__sqTargetPctValue(r, ['source_games','games','game_count'])
    };
  }).filter(r => r.key).sort((a,b) => __sqTargetPctOrder(a.key) - __sqTargetPctOrder(b.key));

  const table = document.createElement('table'); table.className = 'sq-table hs-table';
  const thead = document.createElement('thead'); const trh = document.createElement('tr');
  ['Target','Throws','Hits','%'].forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    [r.key, r.throwsN, r.hits, (Number(r.pct)||0).toFixed(2)+'%'].forEach(v => {
      const td = document.createElement('td'); td.textContent = String(v); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const scroll = document.createElement('div'); scroll.style.maxHeight = '56vh'; scroll.style.overflowY = 'auto';
  __sqStyleStatsTableWrap(scroll); scroll.appendChild(table);
  const info = document.createElement('p'); info.className = 'tag muted'; info.style.marginTop = '8px';
  info.textContent = 'Target Hit % = successful target hits / throws at that target.';
  window.__lastTargetHitPctSpiderData = {
    labels: rows.map(r => String(r.key)),
    pct: rows.map(r => Number(r.pct || 0))
  };
  body.innerHTML = ''; body.append(scroll, info);
};

// @LEGACY:PLAYER_TARGET_POINTS_PCT (superseded by the final @CANONICAL:PLAYER_TARGET_POINTS_PCT heatmap opener in Fix166)
window.openPlayerTargetPointsDialog = function openPlayerTargetPointsDialog(){
  if (window.__sqCanonicalPlayerTargetPointsDialog && window.__sqCanonicalPlayerTargetPointsDialog !== window.openPlayerTargetPointsDialog) {
    return window.__sqCanonicalPlayerTargetPointsDialog.apply(window, arguments);
  }
  try{ if (typeof toast === 'function') toast('Target Points % is still loading'); }catch(_){}
};

window.openPlayerTargetPctDialog = window.openPlayerTargetHitDialog;
window.openTargetPctDialog = window.openPlayerTargetHitDialog;
window.openPlayerTargetPointsPctDialog = window.openPlayerTargetPointsDialog;
// [removed: openPlayerDTBPctDialog (orphaned)] audit P5.3 batch 2 — dead/shadowed definition, no live callers

// [removed: openPlayerDTBCombinedPctDialog (orphaned)] audit P5.3 batch 2 — dead/shadowed definition, no live callers

// === Player Stats — shim so the Select Player modal can open stats (always hub) ===
window.openPlayerStatsModePicker = function openPlayerStatsModePicker(name) {
  const n = String(name || '').trim();
  if (!n) { if (typeof toast==='function') toast('Pick a player'); return; }
  if (typeof window.openPlayerStatsHub === 'function') return window.openPlayerStatsHub(n);
  // Fallback: open the detail dialog if hub is somehow missing
  if (typeof window.openPlayerStatsDialog === 'function') return window.openPlayerStatsDialog(n);
  if (typeof toast==='function') toast('Stats view not available in this build');
};

// ---- ensure "New Game" button always works ----
document.addEventListener('DOMContentLoaded', function(){
  const btn = document.getElementById('newGameBtn') || document.getElementById('startNewGameBtn');
  if (!btn) return;
  btn.onclick = function(){
    try {
      if (typeof window.openSelectPlayersDialog === 'function') {
        window.openSelectPlayersDialog();
      } else if (typeof window.startNewGame === 'function') {
        window.startNewGame();
      } else if (typeof window.openPlayerSelectDialog === 'function') {
        window.openPlayerSelectDialog();
      } else {
        console.warn('No New Game opener found');
      }
      

    } catch(e){
      console.error('New Game failed', e);
      try { if (typeof toast==='function') toast('Failed to open New Game'); } catch(_) {}
    }
  };
});

// === End Game (Leaderboard only): insert "PREMIER LEAGUE" below HIGH SCORES ===
(function plBtnLeaderboardOnly(){
  function onLeaderboard(){
    return (document.body && (document.body.dataset.page || '').toLowerCase()) === 'leaderboard';
  }
  function findLeaderboardHighScoresButton(){
    // search only within the leaderboard page
    const root = document.querySelector('[data-page="leaderboard"]') || document.body;
    return Array.from(root.querySelectorAll('button,.btn,[role="button"]'))
      .find(el => /^\s*high\s*scores\s*$/i.test((el.textContent || '')));
  }
  function ensureOpener(){
    // use existing opener if defined; otherwise click any visible UI that opens PL
    return async function openPL(){
      if (typeof window.openPremierLeagueDialog === 'function') { try { window.openPremierLeagueDialog(); return; } catch(_){} }
      if (typeof window.openPremierLeaguePopup === 'function') { try { window.openPremierLeaguePopup(); return; } catch(_){} }
      const trigger = Array.from(document.querySelectorAll('button,.btn,a,[role="button"]'))
        .find(el => /premier\s*league|records/i.test((el.textContent||'')) && el.offsetParent);
      if (trigger) trigger.click();
    };
  }
  function ensureBtn(){
    if (!onLeaderboard()) return;
    const hs = findLeaderboardHighScoresButton();
    if (!hs) return;
    if (document.getElementById('btnPremierLeague')) return;

    const btn = document.createElement('button');
    btn.id = 'btnPremierLeague';
    btn.className = hs.className || 'btn';
    btn.type = 'button';
    btn.textContent = 'PREMIER LEAGUE';
    const openPL = ensureOpener();
    btn.addEventListener('click', (e)=>{ e.preventDefault(); openPL(); });

    // place directly under the High Scores button on the leaderboard screen
    hs.insertAdjacentElement('afterend', btn);
  }
  function tick(){ ensureBtn(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  try { window.__sqUIMutationBus?.on(()=>tick()); } catch(_) {}
})();

// === Premier League — TODAY (clone a month pill; no min-games rule) =========
/* [MOVED] Premier League TODAY clone-month legacy patch moved to Legacy Quarantine (Stage 4A.1c) */;

// === High Score League — rewritten: NEW + movement + even widths ============
(function highScoreLeagueRewritten(){
  const TITLE_RX = /high\s*score\s*league/i;
  const STORAGE_KEY = 'hsLeaguePositions.v2'; // retired localStorage key; kept only as a legacy label
  const NEW_LIMIT_DAYS = 14;

  // ---- utilities ------------------------------------------------------------
  const daysBetween = (a,b) => Math.floor((a - b) / 86400000);
  const visible = el => !!(el && el.offsetParent !== null);

  function findHSModal(){
    const mods = document.querySelectorAll('.modal,[role="dialog"]');
    for (const m of mods){
      const ok = Array.from(m.querySelectorAll('h1,h2,h3'))
        .some(h => TITLE_RX.test(h.textContent || ''));
      if (ok) return m;
    }
    return null;
  }

  function getTable(modal){
    if (!modal) return null;
    const table = modal.querySelector('table.hs-table');
    if (!table) return null;
    const ths = Array.from(table.querySelectorAll('thead th'));
    if (!ths.length) return null;

    // Expected headers: "# | Player | High Score | When"
    const idxPos    = 0; // "#"
    const idxPlayer = ths.findIndex(th => /player/i.test(th.textContent||''));
    const idxHigh   = ths.findIndex(th => /high\s*score/i.test(th.textContent||''));
    const idxWhen   = ths.findIndex(th => /when/i.test(th.textContent||''));
    if (idxPlayer < 0 || idxHigh < 0 || idxWhen < 0) return null;
    return { table, ths, idxPos, idxPlayer, idxHigh, idxWhen };
  }

  async function earliestMap(){
    if (window.__hsEarliestMap_v2) return window.__hsEarliestMap_v2;
    let games = [];
    try { games = (await __fetchOfficialGames(50000)).map(__normalizeGame); } catch(_){}
    const map = new Map(); // nameLC -> earliest Date
    games.forEach(g=>{
      const t = __gameTs(g.raw || g); if (!t) return;
      const d = new Date(t);
      (g.players||[]).forEach(p=>{
        const k = String(p||'').trim().toLowerCase(); if (!k) return;
        const cur = map.get(k);
        if (!cur || d < cur) map.set(k, d);
      });
    });
    window.__hsEarliestMap_v2 = map;
    return map;
  }

  function arrowHTML(delta){
    if (delta > 0) return `<span title="+${delta}" style="color:#22c55e;font-weight:700">▲</span>`;
    if (delta < 0) return `<span title="${delta}" style="color:#ef4444;font-weight:700">▼</span>`;
    return `<span style="opacity:.5">–</span>`;
  }

  // ---- main apply -----------------------------------------------------------
  async function apply(modal){
    const refs = getTable(modal); if (!refs) return;
    const { table, ths, idxPos, idxPlayer, idxHigh, idxWhen } = refs;

    // 1) Insert movement header AFTER "#"
    let thMove = table.querySelector('thead th[data-move-col="1"]');
    if (!thMove){
      thMove = document.createElement('th');
      thMove.dataset.moveCol = '1';
      thMove.style.textAlign = 'center';
      thMove.style.width     = '26px';
      thMove.style.minWidth  = '24px';
      thMove.style.maxWidth  = '36px';
      ths[idxPos].insertAdjacentElement('afterend', thMove);
    }

    // 2) Even spacing for Player / High Score / When
    const headNow = Array.from(table.querySelectorAll('thead th'));
    const idxMove = headNow.findIndex(th => th.dataset && th.dataset.moveCol === '1');

    table.style.tableLayout = 'fixed';
    table.style.width = '100%';
    if (headNow[0]) {
      headNow[0].style.width    = '36px';
      headNow[0].style.minWidth = '32px';
      headNow[0].style.maxWidth = '42px';
    }
    if (idxMove >= 0 && headNow[idxMove]) {
      headNow[idxMove].style.width     = '26px';
      headNow[idxMove].style.minWidth  = '24px';
      headNow[idxMove].style.maxWidth  = '34px';
      headNow[idxMove].style.textAlign = 'center';
    }
    // recompute indexes by text (header DOM may have shifted)
    const idxPlayerNow = headNow.findIndex(th => /player/i.test(th.textContent||''));
    const idxHighNow   = headNow.findIndex(th => /high\s*score/i.test(th.textContent||''));
    const idxWhenNow   = headNow.findIndex(th => /when/i.test(th.textContent||''));

    const fixedPx = 36 + (idxMove >= 0 ? 26 : 0);
    const EVEN = `calc((100% - ${fixedPx}px) / 3)`;
    [idxPlayerNow, idxHighNow, idxWhenNow].forEach(i => {
      if (i >= 0 && headNow[i]) headNow[i].style.width = EVEN;
    });

    // 3) Per-row: add movement cell; add NEW tag if first-game ≤ 14 days
    window.__sqHSLeagueVisualSnapshot = window.__sqHSLeagueVisualSnapshot || {};
    const prevMap = window.__sqHSLeagueVisualSnapshot.positions || {}; // nameLC -> previous position, memory-only
    const now = new Date();
    const firstMap = await earliestMap();

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const seenPB = new Set(); // nameLC -> already tagged PB (show once)
    const curMap = {}; // nameLC -> current position

    rows.forEach((tr, i) => {
      const pos = i + 1;
      const tds = Array.from(tr.children);
      const tdPos    = tds[idxPos];
      // movement cell sits AFTER position; if not there, create
      let tdMove = tds[idxMove];
      if (!tdMove || tdMove === tdPos || tdMove.dataset.moveCell !== '1') {
        tdMove = document.createElement('td');
        tdMove.dataset.moveCell = '1';
        tdMove.style.textAlign = 'center';
        tdPos.insertAdjacentElement('afterend', tdMove);
      }

      // After inserting a new td, refresh children and resolve Player cell
      const tds2 = Array.from(tr.children);
      // Player column shifts by +1 if movement col was inserted before it
      const tdPlayerCell = tds2[(idxPlayerNow >= 0 ? idxPlayerNow : idxPlayer) + (idxMove >= 0 ? 1 : 0)];
      if (!tdPlayerCell) return;

      // Player name (strip any existing "NEW")
      const nameText = (tdPlayerCell.textContent || '').replace(/\bNEW\b/gi,'').trim();
      const nameLC = nameText.toLowerCase();
      curMap[nameLC] = pos;

      // Movement arrow against previous snapshot
      let html = '<span style="opacity:.5">–</span>';
      const prevPos = prevMap[nameLC];
      if (typeof prevPos === 'number') {
        const delta = prevPos - pos; // positive = moved UP (better)
        html = arrowHTML(delta);
      }
      tdMove.innerHTML = html;

      // NEW tag (first official game within the last 14 days)
      if (nameLC && firstMap.has(nameLC)) {
        const first = firstMap.get(nameLC);
        const isNew = daysBetween(now, first) <= NEW_LIMIT_DAYS && daysBetween(now, first) >= 0;
        if (isNew && !/\bNEW\b/i.test(tdPlayerCell.innerHTML)) {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = 'NEW';
          tag.style.marginLeft = '6px';
          tdPlayerCell.appendChild(tag);
        }
      }
    });

    // 4) Save snapshot for next comparison in memory only; rankings remain Supabase/history-derived.
    try { window.__sqHSLeagueVisualSnapshot = { ts: new Date().toISOString(), positions: curMap }; } catch(_) {}
  }

  // Debounced observer to apply when the league modal appears/updates
  let scheduled = false;
  function tick(){
    const m = findHSModal();
    if (!m || !visible(m)) return;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async ()=>{ scheduled = false; try { await apply(m); } catch(e){ console.error(e); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  try { window.__sqUIMutationBus?.on(()=>tick()); } catch(_) {}
})();

// === High Scores (Match) — v4: movement ▲/▼ (7d), NEW(7d), PB, date fmt =====
(function enhanceHighScoresMatch_v4(){
  const TITLE_RX = /^\s*high\s*scores\s*$/i;
  // Expected header: "# | Player | Score | Avg / Round | When"
  const COLS_RX  = [/^#$/i, /player/i, /^score$/i, /avg\s*\/\s*round/i, /when/i];
  const NEW_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days
  const POS_KEY  = 'hsMatchEntryPositions.v1'; // entryKey -> {pos, delta, tISO}

  // ---------- helpers ----------
  function findModalAndTable(){
    const mods = document.querySelectorAll('.modal,[role="dialog"]');
    for (const m of mods){
      const ok = Array.from(m.querySelectorAll('h1,h2,h3'))
        .some(h => TITLE_RX.test(h.textContent||''));
      if (!ok) continue;
      const table = m.querySelector('table.hs-table'); if (!table) continue;
      const ths = Array.from(table.querySelectorAll('thead th'));
      if (ths.length < 5) continue;
      const matches = COLS_RX.every((rx, idx)=> rx.test((ths[idx].textContent||'').trim()));
      if (matches) return { modal: m, table, ths };
    }
    return null;
  }

  // "20 Nov 25 at 20:35" | "20 Nov 25 @ 20:35" → "20/11/25 @ 20:35"
  function fmt_DDMMYY_HHMM(text){
    if (!text) return text;
    const m = text.match(/^\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})(?:\s+at|\s*@)\s+(\d{2}):(\d{2})\s*$/);
    if (!m) return text;
    const [, d, mon, yy, hh, mm] = m;
    const MONTH = {JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
    const mmNum = MONTH[mon.toUpperCase()];
    if (!mmNum) return text;
    const dd = String(d).padStart(2,'0');
    return `${dd}/${mmNum}/${yy} @ ${hh}:${mm}`;
  }

  function yellowNEW(){
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = 'NEW';
    span.style.color = '#facc15';
    span.style.borderColor = 'rgba(250,204,21,.35)';
    span.style.background = 'rgba(250,204,21,.08)';
    return span;
  }

  function arrowHTML(delta){
    if (delta > 0) return `<span title="+${delta}" style="color:#22c55e;font-weight:700">▲</span>`;
    if (delta < 0) return `<span title="${delta}" style="color:#ef4444;font-weight:700">▼</span>`;
    return `<span style="opacity:.5">–</span>`;
  }

  // Build PB map + (player|score)→latest timestamp
  async function buildMaps(){
    if (window.__hsMatchMaps_v4) return window.__hsMatchMaps_v4;

    let games = [];
    try { games = (await __fetchOfficialGames(50000)).map(__normalizeGame); } catch(_) {}

    const pb = new Map();      // nameLC -> max score
    const keyTs = new Map();   // `${nameLC}|${score}` -> latest Date
    let globalMax = 0;

    games.forEach(g=>{
      const ts = __gameTs(g.raw || g);
      const d  = ts ? new Date(ts) : null;
      (g.players||[]).forEach((p,i)=>{
        const name = String(p||'').trim(); if (!name) return;
        const k = name.toLowerCase();
        const score = Number(g.totals?.[i] || 0);
        if (!Number.isFinite(score)) return;
        if (score > (pb.get(k) || 0)) pb.set(k, score);
        if (score > globalMax) globalMax = score;
        if (d) {
          const key = `${k}|${score}`;
          const prev = keyTs.get(key);
          if (!prev || d > prev) keyTs.set(key, d);
        }
      });
    });

    window.__hsMatchMaps_v4 = { pb, keyTs, globalMax };
    return window.__hsMatchMaps_v4;
  }

  function loadPos(){ try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}'); } catch(_) { return {}; } }
  function savePos(m){ try { localStorage.setItem(POS_KEY, JSON.stringify(m)); } catch(_){} }

  async function apply(){
    const found = findModalAndTable(); if (!found) return;
    const { table, ths } = found;

    // Insert movement header AFTER "#"
    let thMove = table.querySelector('thead th[data-move-col="1"]');
    if (!thMove){
      thMove = document.createElement('th');
      thMove.dataset.moveCol = '1';
      thMove.style.textAlign = 'center';
      thMove.style.width     = '26px';
      thMove.style.minWidth  = '22px';
      thMove.style.maxWidth  = '34px';
      ths[0].insertAdjacentElement('afterend', thMove);
    }

    // Insert NEW header AFTER movement
    let headNow = Array.from(table.querySelectorAll('thead th'));
    let idxRank = headNow.findIndex(th => /^#$/i.test((th.textContent||'').trim()));
    let idxMove = headNow.findIndex(th => th.dataset && th.dataset.moveCol === '1');

    let thNew = table.querySelector('thead th[data-newcol="1"]');
    if (!thNew){
      thNew = document.createElement('th');
      thNew.dataset.newcol = '1';
      thNew.style.textAlign = 'center';
      thNew.style.width = '44px';
      thNew.style.minWidth = '38px';
      thNew.style.maxWidth = '60px';
      headNow[idxMove].insertAdjacentElement('afterend', thNew);
    }

    // Narrow the "#" column
    headNow = Array.from(table.querySelectorAll('thead th'));
    idxRank = headNow.findIndex(th => /^#$/i.test((th.textContent||'').trim()));
    idxMove = headNow.findIndex(th => th.dataset && th.dataset.moveCol === '1');
    const idxNew = headNow.findIndex(th => th.dataset && th.dataset.newcol === '1');

    if (headNow[idxRank]) {
      headNow[idxRank].style.width     = '24px';
      headNow[idxRank].style.minWidth  = '22px';
      headNow[idxRank].style.maxWidth  = '28px';
      headNow[idxRank].style.textAlign = 'center';
    }
    table.style.tableLayout = 'fixed';
    table.style.width = '100%';

    // Resolve main column indexes by header text (after our inserts)
    const idxPlayer = headNow.findIndex(th => /player/i.test(th.textContent||''));
    const idxScore  = headNow.findIndex(th => /^score$/i.test(th.textContent||''));
    let   idxWhen   = headNow.findIndex(th => /when/i.test(th.textContent||''));
    if (idxWhen < 0) idxWhen = headNow.length - 1;

    const { pb, keyTs, globalMax } = await buildMaps();

    // Load previous entry positions (per entry: nameLC|score)
    const prev = loadPos();
    const next = {};
    const now = Date.now();

    // Per-row updates
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach((tr, i)=>{
      const tds0 = Array.from(tr.children);
      const tdRank = tds0[idxRank];

      // Ensure movement cell immediately after rank
      let tdMove = tds0[idxMove];
      if (!tdMove || tdMove === tdRank || tdMove.dataset.moveCell !== '1') {
        tdMove = document.createElement('td');
        tdMove.dataset.moveCell = '1';
        tdMove.style.textAlign = 'center';
        tdRank.insertAdjacentElement('afterend', tdMove);
      } else {
        tdMove.innerHTML = '';
      }

      // Ensure NEW cell immediately after movement
      const tds1 = Array.from(tr.children);
      const tdAfterMove = tds1[idxMove + 1] || tdMove.nextElementSibling;
      let tdNew = tds1[idxNew];
      if (!tdNew || tdNew === tdRank || tdNew === tdMove || tdNew.dataset.newCell !== '1') {
        tdNew = document.createElement('td');
        tdNew.dataset.newCell = '1';
        tdNew.style.textAlign = 'center';
        (tdAfterMove || tdMove).insertAdjacentElement('afterend', tdNew);
      } else {
        tdNew.innerHTML = '';
      }

      // Refresh indexes after inserts and read data cells
      const tds = Array.from(tr.children);
      const tdPlayer = tds[idxPlayer];
      const tdScore  = tds[idxScore];
      const tdWhen   = tds[idxWhen] || tds[tds.length - 1];

      // 1) Format When => DD/MM/YY @ HH:MM
      if (tdWhen) {
        const orig = tdWhen.textContent || '';
        const fmt  = fmt_DDMMYY_HHMM(orig);
        if (fmt && fmt !== orig) tdWhen.textContent = fmt;
      }

      // Entry key for movement & NEW: nameLC|score
      const nameLC = (tdPlayer?.textContent || '').trim().toLowerCase();
      const scoreN = Number((tdScore?.textContent || '').replace(/[^\d.]/g,''));
      const entryKey = `${nameLC}|${Number.isFinite(scoreN) ? scoreN : -1}`;
      const pos = i + 1;

      // 2) Movement (persist 7 days if no further movement)
      const prevRec = prev[entryKey];
      let deltaToShow = 0;
      if (prevRec && typeof prevRec.pos === 'number') {
        if (prevRec.pos !== pos) {
          // changed now
          deltaToShow = prevRec.pos - pos; // + = moved up
          next[entryKey] = { pos, delta: deltaToShow, tISO: new Date(now).toISOString() };
        } else {
          // unchanged; keep showing if within 7d and delta != 0
          const ageOK = prevRec.tISO && (now - Date.parse(prevRec.tISO)) <= NEW_MS;
          deltaToShow = ageOK ? (prevRec.delta || 0) : 0;
          next[entryKey] = { pos, delta: prevRec.delta || 0, tISO: prevRec.tISO || new Date(now).toISOString() };
        }
      } else {
        // first time seeing this entry
        next[entryKey] = { pos, delta: 0, tISO: new Date(now).toISOString() };
      }
      tdMove.innerHTML = arrowHTML(deltaToShow);

      // 3) NEW (≤7 days since that exact (player,score))
      if (nameLC && Number.isFinite(scoreN)) {
        const k = `${nameLC}|${scoreN}`;
        const ts = keyTs.get(k);
        if (ts && (Date.now() - ts.getTime()) <= NEW_MS) {
          tdNew.appendChild(yellowNEW());
        }
      }

      // 4) PB after Score — show ONLY ONCE per player (true PB occurrence), exclude global top score
      const isGlobalTop = Number((tdScore?.textContent || '').replace(/[^\d.]/g,'')) === globalMax;
      const best = pb.get(nameLC) || -Infinity;
      const curScore = Number((tdScore?.textContent || '').replace(/[^\d.]/g,''));
      const isPBScore = Number.isFinite(curScore) && curScore === best;

      // Prefer tagging the latest occurrence of that PB score (so PB doesn't repeat across multiple equal-score rows)
      function parseWhenMs(txt){
        if (!txt) return NaN;
        // Expect "DD/MM/YY @ HH:MM"
        const m = String(txt).trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s*@\s*(\d{2}):(\d{2})$/);
        if (!m) return NaN;
        const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]), hh = Number(m[4]), mi = Number(m[5]);
        if (![dd,mm,yy,hh,mi].every(Number.isFinite)) return NaN;
        // Stored timestamps are UTC; treat display as UTC for matching.
        return Date.UTC(2000 + yy, mm - 1, dd, hh, mi, 0, 0);
      }

      const pbKey = `${nameLC}|${best}`;
      const latestPbTs = keyTs.get(pbKey) || null; // Date (latest occurrence from official games)
      const rowWhenMs = parseWhenMs(tdWhen?.textContent || '');
      const matchLatest = (latestPbTs && Number.isFinite(rowWhenMs))
        ? Math.abs(latestPbTs.getTime() - rowWhenMs) <= 60 * 1000
        : true; // if we can't parse, don't block tagging

      if (!isGlobalTop && isPBScore && matchLatest && tdScore && !seenPB.has(nameLC) && !/\bPB\b/i.test(tdScore.innerHTML)) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'PB';
        tag.style.marginLeft = '6px';
        tdScore.appendChild(tag);
        seenPB.add(nameLC);
      }
    });

    // Save snapshot for next time
    savePos(next);
  }

  function tick(){ try { apply(); } catch(e){ console.error('HS Match v4 failed', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  try { window.__sqUIMutationBus?.on(()=>tick()); } catch(_) {}
})();

// === T button flash + shake — v3 (Safari-safe; 1→2→3 only when T is pressed)
(function tButtonFXv3(){
  // CSS (proper injection)
  if (!document.getElementById('tfx-css')) {
    const s = document.createElement('style'); s.id = 'tfx-css';
    s.textContent =
`.tfx{will-change:transform,filter}
@keyframes tFlashLow{0%{filter:brightness(1);box-shadow:none}12%{filter:brightness(1.4);box-shadow:0 0 10px rgba(255,255,255,.5),0 0 18px rgba(77,163,255,.3)}30%{filter:brightness(1.05);box-shadow:none}100%{filter:brightness(1);box-shadow:none}}
@keyframes tFlashMed{0%{filter:brightness(1);box-shadow:none}10%{filter:brightness(1.9);box-shadow:0 0 16px rgba(255,255,255,.7),0 0 28px rgba(77,163,255,.4)}24%{filter:brightness(1.1);box-shadow:none}38%{filter:brightness(1.6);box-shadow:0 0 12px rgba(255,255,255,.5),0 0 22px rgba(77,163,255,.35)}100%{filter:brightness(1);box-shadow:none}}
@keyframes tFlashHigh{0%{filter:brightness(1);box-shadow:none}8%{filter:brightness(2.6);box-shadow:0 0 22px rgba(255,255,255,.85),0 0 40px rgba(77,163,255,.5)}18%{filter:brightness(1.1);box-shadow:none}28%{filter:brightness(2.2);box-shadow:0 0 18px rgba(255,255,255,.7),0 0 34px rgba(77,163,255,.45)}42%{filter:brightness(1.15);box-shadow:none}100%{filter:brightness(1);box-shadow:none}}
@keyframes tShakeLow{0%,100%{transform:translateX(0)}20%{transform:translateX(-2px)}40%{transform:translateX(2px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@keyframes tShakeMed{0%,100%{transform:translateX(0)}15%{transform:translateX(-5px)}30%{transform:translateX(5px)}45%{transform:translateX(-4px)}60%{transform:translateX(4px)}75%{transform:translateX(-3px)}}
@keyframes tShakeHigh{0%,100%{transform:translateX(0) rotate(0)}12%{transform:translateX(-8px) rotate(-1deg)}24%{transform:translateX(8px) rotate(1deg)}36%{transform:translateX(-7px) rotate(-.9deg)}48%{transform:translateX(7px) rotate(.9deg)}60%{transform:translateX(-6px) rotate(-.8deg)}72%{transform:translateX(6px) rotate(.8deg)}84%{transform:translateX(-4px) rotate(-.6deg)}}
.tfx.flash-low{animation:tFlashLow .22s ease-in-out,tShakeLow .22s linear}
.tfx.flash-med{animation:tFlashMed .34s ease-in-out,tShakeMed .34s linear}
.tfx.flash-high{animation:tFlashHigh .50s ease-in-out,tShakeHigh .50s linear}`;
    document.head.appendChild(s);
  }

  // Find the visible T button (label "T" or treble)
  function isT(el){
    if (!el) return false;
    const label = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().toUpperCase();
    const data  = ((el.dataset && (el.dataset.shot || el.dataset.kind || '')) || '').toUpperCase();
    const isBtn = /^(BUTTON|A)$/i.test(el.tagName) || el.hasAttribute('role');
    return isBtn && (label === 'T' || data === 'T' || /TREB|TREBLE/.test(label+data));
  }
  function findT(){ return Array.from(document.querySelectorAll('button,.btn,a,[role="button"]')).find(el => isT(el) && el.offsetParent); }

  // Press-order only: 1 -> 2 -> 3 -> 1 ... (only T presses advance)
  let count = 0;

  function animate(el){
    el.classList.add('tfx');
    el.classList.remove('flash-low','flash-med','flash-high');
    void el.offsetWidth; // restart
    el.classList.add(count===1 ? 'flash-low' : count===2 ? 'flash-med' : 'flash-high');
    setTimeout(() => el.classList.remove('flash-low','flash-med','flash-high'), 700);
  }

  function onPress(){
    const el = findT(); if (!el) return;
    count = (count % 3) + 1;     // 1→2→3→1…
    animate(el);
  }

  // Wire clicks only on T; keyboard 't' also triggers it
  function wire(){
    const btn = findT(); if (!btn || btn.dataset.tFxWired==='1') return;
    btn.dataset.tFxWired = '1';
    btn.addEventListener('click', onPress);
  }
  document.addEventListener('keydown', e => { if ((e.key||'').toLowerCase() === 't') onPress(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  try { window.__sqUIMutationBus?.on(()=>wire()); } catch(_) {}
})();

// === D button flash + shake — v1 (1→2→3: Ultra-low → Low → Medium)
(function dButtonFX(){
  // CSS for D (kept separate from T)
  if (!document.getElementById('dfx-css')) {
    const s = document.createElement('style'); s.id = 'dfx-css';
    s.textContent =
`.dfx{will-change:transform,filter}
@keyframes dFlashUltra{0%{filter:brightness(1);box-shadow:none}18%{filter:brightness(1.2);box-shadow:0 0 6px rgba(255,255,255,.35),0 0 12px rgba(77,163,255,.20)}100%{filter:brightness(1);box-shadow:none}}
@keyframes dFlashLow{0%{filter:brightness(1);box-shadow:none}14%{filter:brightness(1.45);box-shadow:0 0 10px rgba(255,255,255,.45),0 0 18px rgba(77,163,255,.28)}100%{filter:brightness(1);box-shadow:none}}
@keyframes dFlashMed{0%{filter:brightness(1);box-shadow:none}12%{filter:brightness(1.7);box-shadow:0 0 14px rgba(255,255,255,.6),0 0 24px rgba(77,163,255,.35)}32%{filter:brightness(1.1);box-shadow:none}100%{filter:brightness(1);box-shadow:none}}
@keyframes dShakeUltra{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
@keyframes dShakeLow{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@keyframes dShakeMed{0%,100%{transform:translateX(0)}15%{transform:translateX(-5px)}30%{transform:translateX(5px)}45%{transform:translateX(-4px)}60%{transform:translateX(4px)}}
.dfx.flash-ultra{animation:dFlashUltra .18s ease-in-out,dShakeUltra .18s linear}
.dfx.flash-low{animation:dFlashLow .26s ease-in-out,dShakeLow .26s linear}
.dfx.flash-med{animation:dFlashMed .34s ease-in-out,dShakeMed .34s linear}`;
    document.head.appendChild(s);
  }

  // Find the visible D button (label "D" or "Double")
  function isD(el){
    if (!el) return false;
    const label = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().toUpperCase();
    const data  = ((el.dataset && (el.dataset.shot || el.dataset.kind || '')) || '').toUpperCase();
    const isBtn = /^(BUTTON|A)$/i.test(el.tagName) || el.hasAttribute('role');
    return isBtn && (label === 'D' || data === 'D' || /DOUBLE/.test(label+data));
  }
  function findD(){ return Array.from(document.querySelectorAll('button,.btn,a,[role="button"]')).find(el => isD(el) && el.offsetParent); }

  // Press-order only for D (independent of T/S)
  let dCount = 0;

  function animate(el){
    el.classList.add('dfx');
    el.classList.remove('flash-ultra','flash-low','flash-med');
    void el.offsetWidth; // restart
    el.classList.add(dCount===1 ? 'flash-ultra' : dCount===2 ? 'flash-low' : 'flash-med');
    setTimeout(()=> el.classList.remove('flash-ultra','flash-low','flash-med'), 600);
  }

  function onPressD(){
    const el = findD(); if (!el) return;
    dCount = (dCount % 3) + 1;   // 1 (ultra-low) → 2 (low) → 3 (medium)
    animate(el);
  }

  // Wire clicks only on D; keyboard 'd' also triggers it
  function wire(){
    const btn = findD(); if (!btn || btn.dataset.dFxWired==='1') return;
    btn.dataset.dFxWired = '1';
    btn.addEventListener('click', onPressD);
  }
  document.addEventListener('keydown', e => { if ((e.key||'').toLowerCase() === 'd') onPressD(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  try { window.__sqUIMutationBus?.on(()=>wire()); } catch(_) {}
})();

// === S button flash + shake — v1 (1→2→3: Ultra-ultra low → Ultra low → Low)
(function sButtonFX(){
  // CSS for S
  if (!document.getElementById('sfx-css')) {
    const s = document.createElement('style'); s.id = 'sfx-css';
    s.textContent =
`.sfx{will-change:transform,filter}
@keyframes sFlashXXL{0%{filter:brightness(1);box-shadow:none}
  18%{filter:brightness(1.12);box-shadow:0 0 4px rgba(255,255,255,.25),0 0 8px rgba(77,163,255,.15)}
  100%{filter:brightness(1);box-shadow:none}}
@keyframes sFlashUltra{0%{filter:brightness(1);box-shadow:none}
  16%{filter:brightness(1.25);box-shadow:0 0 6px rgba(255,255,255,.35),0 0 12px rgba(77,163,255,.20)}
  100%{filter:brightness(1);box-shadow:none}}
@keyframes sFlashLow{0%{filter:brightness(1);box-shadow:none}
  14%{filter:brightness(1.4);box-shadow:0 0 9px rgba(255,255,255,.45),0 0 16px rgba(77,163,255,.25)}
  100%{filter:brightness(1);box-shadow:none}}
@keyframes sShakeXXL{0%,100%{transform:translateX(0)}
  50%{transform:translateX(.4px)}}
@keyframes sShakeUltra{0%,100%{transform:translateX(0)}
  25%{transform:translateX(-.8px)}75%{transform:translateX(.8px)}}
@keyframes sShakeLow{0%,100%{transform:translateX(0)}
  20%{transform:translateX(-2px)}40%{transform:translateX(2px)}}
.sfx.flash-xxl{animation:sFlashXXL .16s ease-in-out, sShakeXXL .16s linear}
.sfx.flash-ultra{animation:sFlashUltra .20s ease-in-out, sShakeUltra .20s linear}
.sfx.flash-low{animation:sFlashLow .26s ease-in-out, sShakeLow .26s linear}`;
    document.head.appendChild(s);
  }

  // Find the visible S button (label "S" or "Single")
  function isS(el){
    if (!el) return false;
    const label = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim().toUpperCase();
    const data  = ((el.dataset && (el.dataset.shot || el.dataset.kind || '')) || '').toUpperCase();
    const isBtn = /^(BUTTON|A)$/i.test(el.tagName) || el.hasAttribute('role');
    return isBtn && (label === 'S' || /SINGLE/.test(label+data) || data === 'S');
  }
  function findS(){
    return Array.from(document.querySelectorAll('button,.btn,a,[role="button"]'))
      .find(el => isS(el) && el.offsetParent);
  }

  // Press-order only for S (independent of T/D)
  let sCount = 0;

  function animate(el){
    el.classList.add('sfx');
    el.classList.remove('flash-xxl','flash-ultra','flash-low');
    void el.offsetWidth; // restart
    el.classList.add(sCount===1 ? 'flash-xxl' : sCount===2 ? 'flash-ultra' : 'flash-low');
    setTimeout(()=> el.classList.remove('flash-xxl','flash-ultra','flash-low'), 500);
  }

  function onPressS(){
    const el = findS(); if (!el) return;
    sCount = (sCount % 3) + 1;   // 1 (XXL) → 2 (Ultra) → 3 (Low)
    animate(el);
  }

  // Wire clicks on S; keyboard 's' also triggers it
  function wire(){
    const btn = findS(); if (!btn || btn.dataset.sFxWired==='1') return;
    btn.dataset.sFxWired = '1';
    btn.addEventListener('click', onPressS);
  }
  document.addEventListener('keydown', e => { if ((e.key||'').toLowerCase() === 's') onPressS(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  try { window.__sqUIMutationBus?.on(()=>wire()); } catch(_) {}
})();

// === MISS button — red glow (1→2→3: soft → medium → high) ==================
(function missButtonFX(){
  // CSS for MISS
  if (!document.getElementById('mfx-css')) {
    const s = document.createElement('style'); s.id = 'mfx-css';
    s.textContent =
    ` .missfx{will-change:filter,box-shadow,transform,background-color}

/* existing glow tweaked to pair with bg pulse */
@keyframes mGlowSoft{
  0%{filter:brightness(1);box-shadow:none}
  20%{filter:brightness(1.15);box-shadow:0 0 10px rgba(244,63,94,.45),0 0 20px rgba(244,63,94,.25)}
  100%{filter:brightness(1);box-shadow:none}
}
@keyframes mGlowMed{
  0%{filter:brightness(1);box-shadow:none}
  18%{filter:brightness(1.35);box-shadow:0 0 16px rgba(244,63,94,.6),0 0 28px rgba(244,63,94,.35)}
  40%{filter:brightness(1.1);box-shadow:none}
  100%{filter:brightness(1);box-shadow:none}
}
@keyframes mGlowHigh{
  0%{filter:brightness(1);box-shadow:none;transform:scale(1)}
  14%{filter:brightness(1.6);box-shadow:0 0 22px rgba(244,63,94,.75),0 0 40px rgba(244,63,94,.45);transform:scale(1.02)}
  30%{filter:brightness(1.2);box-shadow:0 0 12px rgba(244,63,94,.45),0 0 26px rgba(244,63,94,.30);transform:scale(1.01)}
  100%{filter:brightness(1);box-shadow:none;transform:scale(1)}
}

/* pulse the actual red background from --miss-from to --miss-to and back */
@keyframes mBgPulse{
  0%  { background-color: var(--miss-from); }
  22% { background-color: var(--miss-to);   }
  100%{ background-color: var(--miss-from); }
}

/* combine glow + bg pulse; durations match levels */
.missfx.glow-soft{animation: mGlowSoft .26s ease-out, mBgPulse .26s ease-in-out}
.missfx.glow-med {animation: mGlowMed  .34s ease-out, mBgPulse .34s ease-in-out}
.missfx.glow-high{animation: mGlowHigh .44s ease-out, mBgPulse .44s ease-in-out}`
    
    document.head.appendChild(s);
  }

  // Find the visible MISS button (label "MISS"; allow 'X' only if marked as miss)
  function isMISS(el){
    if (!el) return false;
    const label = (el.textContent || el.getAttribute('aria-label') || el.title || '').trim();
    const up    = label.toUpperCase();
    const data  = ((el.dataset && (el.dataset.kind || el.dataset.shot || '')) || '').toLowerCase();
    const isBtn = /^(BUTTON|A)$/i.test(el.tagName) || el.hasAttribute('role');
    if (!isBtn) return false;
    if (up === 'MISS') return true;
    // Accept "X" only if metadata indicates miss
    if (up === 'X' && /miss/.test(data + ' ' + (el.getAttribute('aria-label')||'').toLowerCase())) return true;
    return /miss/.test(data);
  }
  function findMISS(){
    return Array.from(document.querySelectorAll('button,.btn,a,[role="button"]'))
      .find(el => isMISS(el) && el.offsetParent);
  }

  // Press-order only for MISS (independent)
  let mCount = 0;

  function animate(el){
    el.classList.add('missfx');
    el.classList.remove('glow-soft','glow-med','glow-high');
    void el.offsetWidth; // restart
    el.classList.add(mCount===1 ? 'glow-soft' : mCount===2 ? 'glow-med' : 'glow-high');
  }

  function onPressMISS(){
    const el = findMISS(); if (!el) return;
    mCount = (mCount % 3) + 1; // 1 soft → 2 med → 3 high
    animate(el);
  }

  // Wire clicks on MISS; keyboard 'm' also triggers it
  function wire(){
    const btn = findMISS(); if (!btn || btn.dataset.mFxWired==='1') return;
    btn.dataset.mFxWired = '1';
    btn.addEventListener('click', onPressMISS);
  }
  document.addEventListener('keydown', e => { if ((e.key||'').toLowerCase() === 'm') onPressMISS(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  try { window.__sqUIMutationBus?.on(()=>wire()); } catch(_) {}
})();

// === In-game minis ( (xx) ) — strip green boxes; only highest is green ======
(function strictBracketWinner(){
  const GREEN = '#6ee7b7';
  const MUTED = 'rgba(255,255,255,.6)';
  const RX = /^\(\d{1,3}\)$/; // "(30)", "(99)", etc.

  function isMini(el){
    if (!el || !el.offsetParent) return false;
    const t = (el.textContent || '').trim();
    return RX.test(t);
  }

  // remove any .tag styling that makes them boxed/green
  function sanitize(el){
    // If the mini or its parent uses .tag for the bracket, strip it
    const nodes = [el, el.parentElement];
    for (const n of nodes){
      if (!n) continue;
      if (n.classList && n.classList.contains('tag') && RX.test((n.textContent||'').trim())){
        n.classList.remove('tag');
        // clear visual remnants
        n.style.removeProperty('background');
        n.style.removeProperty('border');
        n.style.removeProperty('borderColor');
        n.style.removeProperty('color');
        n.style.removeProperty('box-shadow');
      }
    }
  }

  // find minis within a row-like container
  function findRowMinis(row){
    // pick visible nodes that look like a mini
    const cand = Array.from(row.querySelectorAll('small,span,strong,div'));
    const minis = cand.filter(isMini);
    if (minis.length < 2) return [];

    // sort by x, then take the left-most and right-most (the two player columns)
    minis.sort((a,b)=>a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return [minis[0], minis[minis.length-1]];
  }

  function valueOf(el){
    return parseInt((el.textContent||'').replace(/[^\d]/g,''), 10) || 0;
  }

  function paintRow(miniL, miniR){
    if (!miniL || !miniR) return;
    sanitize(miniL); sanitize(miniR);

    const vL = valueOf(miniL);
    const vR = valueOf(miniR);

    if (vL > vR){
      miniL.style.color = GREEN;
      miniR.style.color = MUTED;
    } else if (vR > vL){
      miniL.style.color = MUTED;
      miniR.style.color = GREEN;
    } else {
      // tie -> neither green
      miniL.style.color = MUTED;
      miniR.style.color = MUTED;
    }
  }

  function apply(root){
    // Try table rows first
    const rows = Array.from(root.querySelectorAll('table tr,[role="row"]'))
      .filter(r => r.offsetParent);
    let touched = 0;
    rows.forEach(r=>{
      const [a,b] = findRowMinis(r);
      if (a && b){ paintRow(a,b); touched++; }
    });

    // Fallback: scan visible sections that look like round rows
    if (!touched){
      const sections = Array.from(root.querySelectorAll('section,div,li'))
        .filter(s => s.offsetParent);
      sections.forEach(s=>{
        const [a,b] = findRowMinis(s);
        if (a && b) paintRow(a,b);
      });
    }
  }

  function run(){ apply(document.body || document); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Re-apply whenever the board updates (via shared UI mutation bus)
  try { window.__sqUIMutationBus?.on(()=>{ try { run(); } catch(_){/* ignore */} }); } catch(_){}
})();

// === Top Nav (Start / Restart / Stats) — equal widths across full row =======

