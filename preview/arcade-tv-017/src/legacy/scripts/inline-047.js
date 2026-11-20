
// Measure the fixed controls instead of assuming their height: D/T/B layouts
// and Safari's changing viewport leave different amounts of usable space.
(function(){
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(fit); };
  function fit(){
    raf = 0;
    if (document.body.dataset.page !== 'game' || !document.body.classList.contains('livev2-on') || document.body.classList.contains('livev3-on')) return;
    const panel = document.getElementById('liveV2Panel');
    const pager = panel && panel.querySelector('.v2InfoPager');
    const pad = document.getElementById('padBar');
    if (!pager || !pad || !pager.offsetHeight || !pad.offsetHeight) return;
    const box = panel.getBoundingClientRect(), pageBox = pager.getBoundingClientRect();
    const scale = pageBox.height / pager.offsetHeight || 1;
    const viewport = window.visualViewport;
    const bottom = Math.min(pad.getBoundingClientRect().top, viewport ? viewport.height + viewport.offsetTop : innerHeight);
    const height = Math.max(126, Math.min(900, Math.floor(pager.offsetHeight + (bottom - box.bottom - 10) / scale)));
    if (Math.abs(height - pager.offsetHeight) > 1) panel.style.setProperty('--sqClassicRaceHeight', height + 'px');
  }
  const observer = new ResizeObserver(schedule);
  ['liveV2Panel','padBar'].forEach(id => { const node = document.getElementById(id); if (node) observer.observe(node); });
  new MutationObserver(schedule).observe(document.body, {attributes:true, attributeFilter:['class','data-page']});
  window.addEventListener('resize', schedule, {passive:true});
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule, {passive:true});
  schedule();
})();

// SC-042 acceptance hotfix — non-score Milestone detail boards must rank the
// progress measure named by the selected milestone, not the number of different
// milestones a player has unlocked. This late compatibility hook is intentionally
// isolated from scoring/XP/earned-state logic and can be removed once the detail
// resolver is folded into the semantic modals source.
(function installSc042MilestoneFamilyHotfix(){
  if (window.__sqSc042MilestoneFamilyHotfix) return;
  const ACH = window.SQ_ACH;
  const originalDetail = window.__sqTrophyDetail;
  if (!ACH || typeof originalDetail !== 'function') return;
  window.__sqSc042MilestoneFamilyHotfix = true;

  const volumeCodes = new Set(['regular','veteran','centurion']);
  const sweepCodes = new Set(['double_sweep','treble_sweep']);
  const metaCodes = new Set(['collector','trophy_hunter']);
  let roundCache = null;
  let roundCacheAt = 0;
  let roundInflight = null;

  const sortProgress = rows => (rows || []).filter(r => Number(r && r.cnt) > 0)
    .sort((a,b) => (Number(b.cnt)||0) - (Number(a.cnt)||0)
      || String(a.name||'').localeCompare(String(b.name||''))
      || String(a.player_id||'').localeCompare(String(b.player_id||'')));

  async function milestoneRoundRows(force){
    const now = Date.now();
    if (!force && roundCache && (now - roundCacheAt) < 60000) return roundCache;
    if (!force && roundInflight) return roundInflight;
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return roundCache || [];
    const run = (async()=>{
      const out = [];
      const pageSize = 1000;
      for (let start = 0; start < 100000; start += pageSize){
        let q = SB.from('v_ach_rounds')
          .select('game_id,pidx,player_id,ridx,target,trebles,doubles,bull_any')
          .order('game_id',{ascending:true})
          .order('pidx',{ascending:true})
          .order('ridx',{ascending:true});
        const res = await q.range(start, start + pageSize - 1);
        if (!res || res.error || !Array.isArray(res.data)) return roundCache || [];
        out.push(...res.data);
        if (res.data.length < pageSize) break;
      }
      roundCache = out;
      roundCacheAt = Date.now();
      return out;
    })();
    if (!force) roundInflight = run;
    try{ return await run; }
    finally{ if (!force && roundInflight === run) roundInflight = null; }
  }

  ACH.forMilestoneProgress = async function(code){
    try{
      const threshold = this.scoreMilestoneThreshold(code);
      if (threshold) return await this.forScoreMilestone(code);

      const directory = (await this.playerDirectory()).filter(p => Math.max(0, Number(p && p.games_played) || 0) > 0);
      const players = new Map((directory || []).map(p => [String(p.player_id), p]));
      const build = counts => sortProgress((directory || []).map(p => ({
        player_id:p.player_id,
        name:p.name || '—',
        cnt:Number(counts.get(String(p.player_id)) || 0),
        games_played:Math.max(0, Number(p.games_played) || 0)
      })));

      if (volumeCodes.has(code)){
        const counts = new Map((directory || []).map(p => [String(p.player_id), Math.max(0, Number(p.games_played) || 0)]));
        return build(counts);
      }

      if (code === 'bull_club' || sweepCodes.has(code)){
        const rows = await milestoneRoundRows(false);
        const counts = new Map();
        const targets = new Map();
        (rows || []).forEach(r => {
          const key = String((r && r.player_id) || '');
          if (!key || !players.has(key)) return;
          if (code === 'bull_club'){
            const n = Math.max(0, Number(r && r.bull_any) || 0);
            if (n) counts.set(key, (counts.get(key) || 0) + n);
            return;
          }
          const hits = code === 'double_sweep' ? Number(r && r.doubles) : Number(r && r.trebles);
          const target = Number(r && r.target);
          if (!(hits > 0) || !(target >= 10 && target <= 20)) return;
          if (!targets.has(key)) targets.set(key, new Set());
          targets.get(key).add(target);
        });
        if (code !== 'bull_club') targets.forEach((set,key) => counts.set(key, set.size));
        return build(counts);
      }

      if (metaCodes.has(code)){
        const state = await this._sourceRows({});
        if (!state || !state.available) return [];
        const codesByPlayer = new Map();
        (state.rows || []).forEach(r => {
          const key = String((r && r.player_id) || '');
          const trophy = String((r && r.code) || '').trim();
          if (!key || !players.has(key) || !trophy || Number(r && r.cnt) <= 0 || metaCodes.has(trophy)) return;
          if (!codesByPlayer.has(key)) codesByPlayer.set(key, new Set());
          codesByPlayer.get(key).add(trophy);
        });
        const counts = new Map();
        codesByPlayer.forEach((set,key) => counts.set(key, set.size));
        return build(counts);
      }

      return await this.forCode(code);
    }catch(_){ return []; }
  };

  // The existing detail renderer already owns layout, mode buttons and earned
  // state. Redirect only its non-score Milestone row fetch for the duration of
  // this one popup, then restore the original generic aggregate function.
  window.__sqTrophyDetail = async function(code, earnedMap){
    if (!ACH.isMilestone(code) || ACH.scoreMilestoneThreshold(code)) return originalDetail(code, earnedMap);
    const originalForMilestones = ACH.forMilestones;
    ACH.forMilestones = () => ACH.forMilestoneProgress(code);
    try{ return await originalDetail(code, earnedMap); }
    finally{ ACH.forMilestones = originalForMilestones; }
  };
})();
