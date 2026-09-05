from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    s = s.replace(old, new, 1)
    print('patched', label)

replace_once("""  _cache: null, _cacheAt: 0,
  async all(force){
    const now = Date.now();
    if (!force && this._cache && (now - this._cacheAt) < 60000) return this._cache;
    const SB = window.sb || window.__sb || null;
    if (!SB || typeof SB.from !== 'function') return this._cache || [];
    try{
      const { data, error } = await SB.from('v_player_xp').select('*');
      if (error || !Array.isArray(data)) return this._cache || [];
      this._cache = data; this._cacheAt = now;
      return data;
    }catch(_){ return this._cache || []; }
  },
""", """  _cache: null, _cacheAt: 0, _inflight: null,
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
""", 'SQ_XP in-flight coalescing')

replace_once("""  async forName(name){
    try{
      const xr = await SQ_XP.forName(name); if (!xr) return {};
      const SB = window.sb || window.__sb || null;
      if (!SB || typeof SB.from !== 'function') return {};
      const { data, error } = await SB.from('v_player_achievements').select('code,cnt,xp').eq('player_id', xr.player_id);
      if (error || !Array.isArray(data)) return {};
      const map = {}; data.forEach(r => { map[r.code] = { cnt: Number(r.cnt) || 0, xp: Number(r.xp) || 0 }; });
      return map;
    }catch(_){ return {}; }
  }
""", """  async forPlayerId(playerId){
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
""", 'SQ_ACH player-id read/state')

replace_once("""  async forName(name){
    try{
      const xr = await SQ_XP.forName(name); if (!xr) return { available:false, map:{} };
      const SB = window.sb || window.__sb || null;
      if (!SB || typeof SB.from !== 'function') return { available:false, map:{} };
      const { data, error } = await SB.from('v_player_misfires').select('code,cnt').eq('player_id', xr.player_id);
      if (error || !Array.isArray(data)) return { available:false, map:{} };
      const map = {}; data.forEach(r => { map[r.code] = { cnt:Number(r.cnt) || 0 }; });
      return { available:true, map };
    }catch(_){ return { available:false, map:{} }; }
  }
""", """  async forPlayerId(playerId){
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
""", 'SQ_MISFIRE player-id read')

replace_once("""  let xpProg = null, xpRow = null, achMap = {}, misfireState = { available:false, map:{} };
  try{
    const [xr, am, mf] = await Promise.all([
      SQ_XP.forName(name).catch(()=>null),
      SQ_ACH.forName(name).catch(()=>null),
      SQ_MISFIRE.forName(name).catch(()=>({ available:false, map:{} }))
    ]);
    xpRow = xr || null;
    if (xpRow) xpProg = SQ_XP.progress(xpRow.total_xp);
    achMap = am || {};
    misfireState = mf || { available:false, map:{} };
  }catch(_){ }
  const misfireMap = misfireState.map || {};
""", """  let xpProg = null, xpRow = null, achState = { available:false, map:{} }, misfireState = { available:false, map:{} };
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
""", 'Player Stats one-time player resolution')

replace_once("""  {
    const catalog = (window.SQ_ACH && Array.isArray(SQ_ACH.CATALOG)) ? SQ_ACH.CATALOG : [];
""", """  {
    const achAvailable = !!(achState && achState.available);
    const catalog = (window.SQ_ACH && Array.isArray(SQ_ACH.CATALOG)) ? SQ_ACH.CATALOG : [];
""", 'achievement availability flag')

replace_once("""    const vcB = document.createElement('b'); vcB.textContent = String(earnedN);
""", """    const vcB = document.createElement('b'); vcB.textContent = achAvailable ? String(earnedN) : '—';
""", 'vault unavailable count')

replace_once("""    const vsub = document.createElement('div'); vsub.className = 'pp-vault-sub'; vsub.textContent = 'Trophies unlocked · ' + Math.round(pctDone * 100) + '%';
""", """    const vsub = document.createElement('div'); vsub.className = 'pp-vault-sub'; vsub.textContent = achAvailable ? ('Trophies unlocked · ' + Math.round(pctDone * 100) + '%') : 'Achievement history unavailable';
""", 'vault unavailable subtitle')

replace_once("""    if (!shelf.length){ const none = document.createElement('div'); none.className = 'pp-vault-more'; none.textContent = 'No trophies yet — go earn some!'; shelfEl.appendChild(none); }
""", """    if (!shelf.length){ const none = document.createElement('div'); none.className = 'pp-vault-more'; none.textContent = achAvailable ? 'No trophies yet — go earn some!' : 'Achievement history is unavailable right now.'; shelfEl.appendChild(none); }
""", 'vault unavailable message')

replace_once("""    achPanel.appendChild(__sqTrophyCase(achMap));
""", """    achPanel.appendChild(__sqTrophyCase(achMap, achAvailable));
""", 'pass availability to trophy case')

replace_once("""function __sqTrophyCase(earnedMap){
""", """function __sqTrophyCase(earnedMap, available = true){
""", 'trophy case availability parameter')

replace_once("""    b.onclick = () => { try{ __sqTrophyDetail(a.code, earnedMap); }catch(_){ } };
""", """    if (available) b.onclick = () => { try{ __sqTrophyDetail(a.code, earnedMap); }catch(_){ } };
    else { b.style.cursor = 'default'; b.title = 'Achievement history is unavailable right now.'; }
""", 'disable misleading trophy detail on failure')

replace_once("""    cnt.textContent = earnedN + ' / ' + codeList.length + ' unlocked';
""", """    cnt.textContent = available ? (earnedN + ' / ' + codeList.length + ' unlocked') : ('— / ' + codeList.length + ' unlocked');
""", 'section unavailable count')

p.write_text(s, encoding='utf-8')

# Static guards before browser QA.
checks = [
    ("_inflight: null", 'XP in-flight guard'),
    ("SQ_ACH.forPlayerId(xpRow.player_id)", 'direct achievement player-id read'),
    ("SQ_MISFIRE.forPlayerId(xpRow.player_id)", 'direct Misfire player-id read'),
    ("Achievement history is unavailable right now.", 'honest unavailable state'),
]
for needle, label in checks:
    if needle not in s:
        raise SystemExit(f'missing guard: {label}')
if "const [xr, am, mf] = await Promise.all([" in s:
    raise SystemExit('old triple fan-out remains')

verify = r'''// SC-010 regression: cold-read coalescing + honest positive-achievement failure state.
const H = require('./harness');
const FX = require('./pstats-fixture');
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

async function scenario(mode){
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  await H.boot(page, { settle:2500 });
  await FX.install(page);
  await page.evaluate((mode) => {
    const baseFrom = window.sb.from.bind(window.sb);
    window.__sc010Calls = {};
    const resultQuery = (data, error) => {
      const q = {
        select(){ return q; }, eq(){ return q; }, ilike(){ return q; }, or(){ return q; }, order(){ return q; }, limit(){ return q; },
        then(res){ res({ data, error }); }, catch(){ return q; }
      };
      return q;
    };
    const wrapped = {
      from(table){
        window.__sc010Calls[table] = (window.__sc010Calls[table] || 0) + 1;
        if (table === 'v_player_achievements' && mode === 'error') return resultQuery(null, { message:'statement timeout' });
        if (table === 'v_player_achievements' && mode === 'empty') return resultQuery([], null);
        return baseFrom(table);
      }
    };
    window.sb = wrapped; window.__sb = wrapped;
    if (window.SQ_XP){ window.SQ_XP._cache = null; window.SQ_XP._cacheAt = 0; window.SQ_XP._inflight = null; }
  }, mode);

  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).find(b => /^achievements$/i.test(b.textContent.trim()));
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  const ui = await page.evaluate(() => {
    const root = document.querySelector('.sq-stats-modal');
    const sec = title => root.querySelector('[data-achievement-section="' + title + '"]');
    const sectionText = title => normLocal((sec(title) || {}).textContent || '');
    function normLocal(v){ return String(v || '').replace(/\s+/g, ' ').trim(); }
    return {
      vaultCount: normLocal((root.querySelector('.pp-vault-count') || {}).textContent || ''),
      vaultSub: normLocal((root.querySelector('.pp-vault-sub') || {}).textContent || ''),
      vaultShelf: normLocal((root.querySelector('.pp-vault-shelf') || {}).textContent || ''),
      milestones: sectionText('Milestones'),
      trophies: sectionText('Trophies / Awards'),
      misfires: sectionText('Misfires'),
      calls: { ...window.__sc010Calls },
    };
  });
  await browser.close();
  return { ui, consoleErrs };
}

(async () => {
  const success = await scenario('success');
  check('cold Player Stats performs one v_player_xp read', success.ui.calls.v_player_xp === 1, JSON.stringify(success.ui.calls));
  check('success reads positive achievements once by resolved player id', success.ui.calls.v_player_achievements === 1, JSON.stringify(success.ui.calls));
  check('success reads Misfires once by resolved player id', success.ui.calls.v_player_misfires === 1, JSON.stringify(success.ui.calls));
  check('successful history renders earned Trophy Vault count', success.ui.vaultCount === '2 / 58', success.ui.vaultCount);
  check('successful history preserves real section counts', /0 \/ 15 unlocked/.test(success.ui.milestones) && /2 \/ 43 unlocked/.test(success.ui.trophies), success.ui.milestones + ' | ' + success.ui.trophies);
  check('Misfires remain available on success', /2 \/ 8 unlocked/.test(success.ui.misfires) && /4 historical occurrences/.test(success.ui.misfires), success.ui.misfires);

  const failed = await scenario('error');
  check('achievement fetch failure is not rendered as 0/58', failed.ui.vaultCount === '— / 58', failed.ui.vaultCount);
  check('achievement fetch failure is explicitly labelled unavailable', /Achievement history unavailable/i.test(failed.ui.vaultSub) && /Achievement history is unavailable right now/i.test(failed.ui.vaultShelf), failed.ui.vaultSub + ' | ' + failed.ui.vaultShelf);
  check('failed history uses dash counts, not false zero section counts', /— \/ 15 unlocked/.test(failed.ui.milestones) && /— \/ 43 unlocked/.test(failed.ui.trophies), failed.ui.milestones + ' | ' + failed.ui.trophies);
  check('Misfires still render when positive achievement read fails', /2 \/ 8 unlocked/.test(failed.ui.misfires) && /4 historical occurrences/.test(failed.ui.misfires), failed.ui.misfires);
  check('failure path still performs only one XP read', failed.ui.calls.v_player_xp === 1, JSON.stringify(failed.ui.calls));

  const empty = await scenario('empty');
  check('successful empty history remains a genuine zero state', empty.ui.vaultCount === '0 / 58' && /No trophies yet/i.test(empty.ui.vaultShelf), empty.ui.vaultCount + ' | ' + empty.ui.vaultShelf);
  check('successful empty sections remain real zero counts', /0 \/ 15 unlocked/.test(empty.ui.milestones) && /0 \/ 43 unlocked/.test(empty.ui.trophies), empty.ui.milestones + ' | ' + empty.ui.trophies);

  const errs = [...success.consoleErrs, ...failed.consoleErrs, ...empty.consoleErrs].filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', errs.length === 0, errs.slice(0,5).join(' | '));

  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
'''
Path('tools/ui-smoke/verify-sc010.js').write_text(verify, encoding='utf-8')
print('created tools/ui-smoke/verify-sc010.js')
