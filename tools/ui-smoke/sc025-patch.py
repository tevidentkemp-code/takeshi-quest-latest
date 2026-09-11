from pathlib import Path

INDEX = Path('index.html')
text = INDEX.read_text()


def replace_between(src, start_marker, end_marker, replacement):
    start = src.index(start_marker)
    end = src.index(end_marker, start)
    return src[:start] + replacement + src[end:]

# 1) Preserve existing ALL TIME ordering/data, but carry the verified eligible-game
# denominator already present on v_player_xp through both per-code loaders.
misfire_loader = r'''SQ_MISFIRE.forCode = async function(code){
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
'''
text = replace_between(text, 'SQ_MISFIRE.forCode = async function(code){', 'window.SQ_MISFIRE = SQ_MISFIRE;', misfire_loader)

ach_loader_and_helpers = r'''SQ_ACH.forCode = async function(code){
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

// SC-025 — per-award league display helpers. AVERAGE is occurrence count divided
// by the existing eligible Classic game count from v_player_xp.games_played.
function __sqLeagueAverageValue(row){
  const games = Math.max(0, Number(row && row.games_played) || 0);
  const cnt = Math.max(0, Number(row && row.cnt) || 0);
  return games > 0 ? (cnt / games) : null;
}
function __sqLeagueAverageRows(rows){
  return (rows || []).slice().sort((a, b) => {
    const av = __sqLeagueAverageValue(a), bv = __sqLeagueAverageValue(b);
    if (av == null && bv != null) return 1;
    if (av != null && bv == null) return -1;
    if (av != null && bv != null && Math.abs(bv - av) > 1e-12) return bv - av;
    const byCount = (Number(b && b.cnt) || 0) - (Number(a && a.cnt) || 0);
    if (byCount) return byCount;
    const byName = String((a && a.name) || '').localeCompare(String((b && b.name) || ''));
    if (byName) return byName;
    return String((a && a.player_id) || '').localeCompare(String((b && b.player_id) || ''));
  });
}
function __sqLeagueAverageText(row){
  const avg = __sqLeagueAverageValue(row);
  return avg == null ? '—' : (avg.toFixed(2) + '/game');
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

'''
text = replace_between(text, 'SQ_ACH.forCode = async function(code){', '// Trophy detail popup: how to earn it + a leaderboard of everyone who has it.', ach_loader_and_helpers)

# 2) Awards + milestones use the same detail component. ALL TIME is deliberately
# the current view; AVERAGE only changes sorting/value rendering.
trophy_detail = r'''async function __sqTrophyDetail(code, earnedMap){
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

  const rows = await SQ_ACH.forCode(code);
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
    ordered.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'pp-trophy-lb-row'; row.dataset.games = String(Math.max(0, Number(r.games_played) || 0));
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);';
      const rk = document.createElement('span'); rk.className = 'pp-trophy-lb-rank'; rk.textContent = '#' + (i + 1); rk.style.cssText = 'font-weight:900;min-width:30px;color:' + medal(i);
      const nm = document.createElement('span'); nm.className = 'pp-trophy-lb-name'; nm.textContent = r.name; nm.style.cssText = 'flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const val = document.createElement('span'); val.className = 'pp-trophy-lb-value';
      val.textContent = mode === 'average' ? __sqLeagueAverageText(r) : (milestone ? '✓' : ('×' + r.cnt));
      val.title = mode === 'average' ? ((Number(r.cnt)||0) + ' occurrence(s) over ' + (Number(r.games_played)||0) + ' eligible games') : '';
      val.style.cssText = 'font-weight:900;color:' + (mode === 'average' ? s.c : (milestone ? '#2fd06b' : '#ffb14a')) + ';white-space:nowrap;';
      row.append(rk, nm, val); list.appendChild(row);
    });
    mount.appendChild(list);
  };
  modeBar.allBtn.onclick = () => render('all'); modeBar.avgBtn.onclick = () => render('average'); render('all');
  const foot = document.createElement('div'); foot.style.cssText = 'margin-top:14px;text-align:center;';
  const cb = document.createElement('button'); cb.className = 'btn sq-pill'; cb.textContent = 'Close'; cb.onclick = () => overlay.remove(); foot.appendChild(cb); body.appendChild(foot);
}

'''
text = replace_between(text, 'async function __sqTrophyDetail(code, earnedMap){', '// Per-game trophy detector for live celebration toasts.', trophy_detail)

# 3) Misfires receive the same switch while keeping the SC-024 rule/detail copy.
misfire_detail = r'''async function __sqMisfireDetail(code, misfireMap){
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
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#fecaca">MISFIRE · ' + m.penalty + ' XP</div></div></div>'
    + '<div style="margin:14px 2px 4px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">How it happens</div>'
    + '<div style="font-size:15px;font-weight:600;margin:0 2px 10px">' + m.desc + '.</div>'
    + '<div class="pp-misfire-detail-count" style="font-size:12px;font-weight:800;margin:0 2px 12px;color:' + (cnt > 0 ? '#fecaca' : 'var(--v3-muted,#98a2b8)') + '">' + (cnt > 0 ? ('Recorded ×' + cnt + ' historically') : 'Not recorded yet') + '</div>';
  const modeBar = __sqLeagueModeBar('Misfire leaderboard', '#fca5a5', 'rgba(248,113,113,.13)'); modeBar.title.classList.add('pp-misfire-leaderboard-title');
  const loading = document.createElement('p'); loading.className = 'muted'; loading.id = 'misfireLbLoading'; loading.style.fontSize = '13px'; loading.textContent = 'Loading…';
  const mount = document.createElement('div'); mount.className = 'pp-misfire-lb-mount';
  const rule = document.createElement('div'); rule.className = 'muted pp-misfire-detail-rule'; rule.style.cssText = 'font-size:10px;line-height:1.4;margin:12px 2px 0';
  rule.textContent = 'Historical counts can include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. Only the worst Misfire applies per game; the maximum deduction is 5 XP per game.';
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
    ordered.forEach((r,i)=>{
      const row=document.createElement('div'); row.className='pp-misfire-lb-row'; row.dataset.games=String(Math.max(0,Number(r.games_played)||0)); row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(127,29,29,.16);border:1px solid rgba(248,113,113,.16);';
      const rk=document.createElement('span'); rk.className='pp-misfire-lb-rank'; rk.textContent='#'+(i+1); rk.style.cssText='font-weight:900;min-width:30px;color:'+medal(i);
      const nm=document.createElement('span'); nm.className='pp-misfire-lb-name'; nm.textContent=r.name; nm.style.cssText='flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const val=document.createElement('span'); val.className='pp-misfire-lb-count'; val.textContent=mode==='average'?__sqLeagueAverageText(r):('×'+r.cnt); val.title=mode==='average'?((Number(r.cnt)||0)+' occurrence(s) over '+(Number(r.games_played)||0)+' eligible games'):''; val.style.cssText='font-weight:900;color:#fca5a5;white-space:nowrap;';
      row.append(rk,nm,val); list.appendChild(row);
    }); mount.appendChild(list);
  };
  modeBar.allBtn.onclick=()=>render('all'); modeBar.avgBtn.onclick=()=>render('average'); render('all');
  const foot=document.createElement('div'); foot.style.cssText='margin-top:14px;text-align:center;'; const cb=document.createElement('button'); cb.className='btn sq-pill'; cb.textContent='Close'; cb.onclick=()=>overlay.remove(); foot.appendChild(cb); body.appendChild(foot);
}

'''
text = replace_between(text, 'async function __sqMisfireDetail(code, misfireMap){', 'function __sqMisfireCase(misfireState, xpRow){', misfire_detail)

# Static guardrails before writing.
for token in ['ALL TIME', 'AVERAGE', '__sqLeagueAverageRows', 'games_played', 'pp-league-mode-btn']:
    if token not in text:
        raise SystemExit('SC-025 missing expected token: ' + token)
if text.count('async function __sqTrophyDetail(code, earnedMap){') != 1:
    raise SystemExit('SC-025 trophy detail function count is not 1')
if text.count('async function __sqMisfireDetail(code, misfireMap){') != 1:
    raise SystemExit('SC-025 misfire detail function count is not 1')
INDEX.write_text(text)

# Permanent focused regression. This checks the shared sorter/formatter and real DOM
# controls by exercising both positive and negative detail popups against fixture data.
TEST = Path('tools/ui-smoke/verify-sc025.js')
TEST.write_text(r'''const { chromium } = require('playwright');
const assert = require('assert');

(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8123/?sc025=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.__sqTrophyDetail==='function' && typeof window.__sqMisfireDetail==='function' && typeof window.__sqLeagueAverageRows==='function');

  await page.evaluate(()=>{
    window.SQ_XP.all = async()=>[
      {player_id:'p1',name:'Alex S',games_played:12},
      {player_id:'p2',name:'Sam T',games_played:2},
      {player_id:'p3',name:'Zero G',games_played:0},
    ];
    const base=window.sb;
    window.sb=window.__sb={
      from(table){
        if(table!=='v_player_achievements' && table!=='v_player_misfires') return base.from(table);
        let code='';
        const q={
          select(){return q;}, eq(col,val){if(col==='code') code=String(val||''); return q;},
          then(resolve){
            if(table==='v_player_achievements') resolve({data:[{player_id:'p1',cnt:3,xp:30},{player_id:'p2',cnt:2,xp:20},{player_id:'p3',cnt:1,xp:10}],error:null});
            else resolve({data:[{player_id:'p1',cnt:3},{player_id:'p2',cnt:2},{player_id:'p3',cnt:1}],error:null});
          }, catch(){return q;}
        }; return q;
      }
    };
  });

  async function read(selector,rowSelector,valueSelector){
    return page.evaluate(({selector,rowSelector,valueSelector})=>{
      const d=document.querySelector(selector); if(!d) return null;
      return {
        buttons:Array.from(d.querySelectorAll('.pp-league-mode-btn')).map(b=>({text:(b.textContent||'').trim(),mode:b.dataset.leagueMode,pressed:b.getAttribute('aria-pressed')})),
        rows:Array.from(d.querySelectorAll(rowSelector)).map(r=>({name:(r.querySelector(rowSelector.includes('misfire')?'.pp-misfire-lb-name':'.pp-trophy-lb-name')||{}).textContent||'',value:(r.querySelector(valueSelector)||{}).textContent||'',games:Number(r.dataset.games||0)}))
      };
    },{selector,rowSelector,valueSelector});
  }

  await page.evaluate(()=>window.__sqTrophyDetail('giant_slayer',{giant_slayer:{cnt:3,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===3);
  let t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.deepEqual(t.buttons.map(x=>x.text),['ALL TIME','AVERAGE']); assert.equal(t.buttons[0].pressed,'true');
  assert.equal(t.rows[0].name,'Alex S'); assert.equal(t.rows[0].value,'×3');
  await page.click('.pp-trophy-detail [data-league-mode="average"]');
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.equal(t.rows[0].name,'Sam T'); assert.equal(t.rows[0].value,'1.00/game'); assert.equal(t.rows[1].value,'0.25/game'); assert.equal(t.rows[2].value,'—');
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));

  await page.evaluate(()=>window.__sqTrophyDetail('score_100',{score_100:{cnt:1,xp:30}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-trophy-detail .pp-trophy-lb-row').length===3);
  await page.click('.pp-trophy-detail [data-league-mode="average"]');
  t=await read('.pp-trophy-detail','.pp-trophy-lb-row','.pp-trophy-lb-value');
  assert.equal(t.rows[0].name,'Sam T'); assert.equal(t.rows[0].value,'1.00/game');
  await page.keyboard.press('Escape'); await page.waitForFunction(()=>!document.querySelector('.pp-trophy-detail'));

  await page.evaluate(()=>window.__sqMisfireDetail('bull_blind',{bull_blind:{cnt:3}}));
  await page.waitForFunction(()=>document.querySelectorAll('.pp-misfire-detail .pp-misfire-lb-row').length===3);
  let m=await read('.pp-misfire-detail','.pp-misfire-lb-row','.pp-misfire-lb-count');
  assert.deepEqual(m.buttons.map(x=>x.text),['ALL TIME','AVERAGE']); assert.equal(m.rows[0].name,'Alex S'); assert.equal(m.rows[0].value,'×3');
  await page.click('.pp-misfire-detail [data-league-mode="average"]');
  m=await read('.pp-misfire-detail','.pp-misfire-lb-row','.pp-misfire-lb-count');
  assert.equal(m.rows[0].name,'Sam T'); assert.equal(m.rows[0].value,'1.00/game'); assert.equal(m.rows[2].value,'—');

  await page.setViewportSize({width:320,height:844});
  const fit=await page.evaluate(()=>{const d=document.querySelector('.pp-misfire-detail'),s=d.querySelector('.pp-league-mode-switch'); const dr=d.getBoundingClientRect(),sr=s.getBoundingClientRect(); return dr.left>=-1&&dr.right<=innerWidth+1&&sr.left>=dr.left-1&&sr.right<=dr.right+1;});
  assert(fit,'SC-025 controls overflow 320px modal');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('SC-025 ALL TIME / AVERAGE league regression: PASS');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
''')
