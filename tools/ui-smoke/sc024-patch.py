from pathlib import Path

index_path = Path('index.html')
text = index_path.read_text()

marker = """};
window.SQ_MISFIRE = SQ_MISFIRE;

// Milestones are one-time unlocks"""
if text.count(marker) != 1:
    raise SystemExit(f'expected one SQ_MISFIRE export marker, found {text.count(marker)}')
replacement = """};

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
    const nameMap = {};
    (names || []).forEach(n => { nameMap[n.player_id] = n.name; });
    const rows = res.data.map(r => ({
      player_id: r.player_id,
      name: nameMap[r.player_id] || '—',
      cnt: Number(r.cnt) || 0
    })).filter(r => r.cnt > 0)
      .sort((a, b) => (b.cnt - a.cnt)
        || String(a.name || '').localeCompare(String(b.name || ''))
        || String(a.player_id || '').localeCompare(String(b.player_id || '')));
    return { available:true, rows };
  }catch(_){ return { available:false, rows:[] }; }
};
window.SQ_MISFIRE = SQ_MISFIRE;

// Milestones are one-time unlocks"""
text = text.replace(marker, replacement, 1)

start = text.index('function __sqMisfireDetail(code, misfireMap){')
end = text.index('\n\nfunction __sqMisfireCase(misfireState, xpRow){', start)
old_fn = text[start:end]
if 'Misfire leaderboard' in old_fn:
    raise SystemExit('Misfire leaderboard already present unexpectedly')
new_fn = r'''async function __sqMisfireDetail(code, misfireMap){
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
    + '<div class="pp-misfire-detail-count" style="font-size:12px;font-weight:800;margin:0 2px 12px;color:' + (cnt > 0 ? '#fecaca' : 'var(--v3-muted,#98a2b8)') + '">' + (cnt > 0 ? ('Recorded ×' + cnt + ' historically') : 'Not recorded yet') + '</div>'
    + '<div class="pp-misfire-leaderboard-title" style="margin:6px 2px 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">Misfire leaderboard</div>'
    + '<p class="muted" id="misfireLbLoading" style="font-size:13px">Loading…</p>'
    + '<div class="muted pp-misfire-detail-rule" style="font-size:10px;line-height:1.4;margin:12px 2px 0">Historical counts can include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. Only the worst Misfire applies per game; the maximum deduction is 5 XP per game.</div>';
  modal.append(body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();

  const lbState = await SQ_MISFIRE.forCode(code);
  if (!overlay.isConnected) return;
  const loading = body.querySelector('#misfireLbLoading'); if (loading) loading.remove();
  if (!lbState || !lbState.available){
    const p = document.createElement('p'); p.className = 'muted pp-misfire-lb-unavailable'; p.style.fontSize = '13px';
    p.textContent = 'Misfire leaderboard is unavailable right now.'; body.insertBefore(p, body.querySelector('.pp-misfire-detail-rule'));
  } else if (!lbState.rows.length){
    const p = document.createElement('p'); p.className = 'muted pp-misfire-lb-empty'; p.style.fontSize = '13px';
    p.textContent = 'No one has recorded this Misfire yet.'; body.insertBefore(p, body.querySelector('.pp-misfire-detail-rule'));
  } else {
    const list = document.createElement('div'); list.className = 'pp-misfire-lb'; list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    const medal = i => i === 0 ? '#ffd24a' : i === 1 ? '#cbd5e1' : i === 2 ? '#d08b5a' : 'var(--v3-muted,#98a2b8)';
    lbState.rows.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'pp-misfire-lb-row';
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(127,29,29,.16);border:1px solid rgba(248,113,113,.16);';
      const rk = document.createElement('span'); rk.className = 'pp-misfire-lb-rank'; rk.textContent = '#' + (i + 1); rk.style.cssText = 'font-weight:900;min-width:30px;color:' + medal(i);
      const nm = document.createElement('span'); nm.className = 'pp-misfire-lb-name'; nm.textContent = r.name; nm.style.cssText = 'flex:1;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const ct = document.createElement('span'); ct.className = 'pp-misfire-lb-count'; ct.textContent = '×' + r.cnt; ct.style.cssText = 'font-weight:900;color:#fca5a5;';
      row.append(rk, nm, ct); list.appendChild(row);
    });
    body.insertBefore(list, body.querySelector('.pp-misfire-detail-rule'));
  }

  const foot = document.createElement('div'); foot.style.cssText = 'margin-top:14px;text-align:center;';
  const cb = document.createElement('button'); cb.className = 'btn sq-pill'; cb.textContent = 'Close'; cb.onclick = () => overlay.remove();
  foot.appendChild(cb); body.appendChild(foot);
}'''
text = text[:start] + new_fn + text[end:]
index_path.write_text(text)

test_path = Path('tools/ui-smoke/verify-sc009.js')
test = test_path.read_text()
block_start = test.index('  await page.click(\'.sq-stats-modal .pp-misfire-card[data-code="bull_blind"]\');')
block_end = test.index('\n\n  const realErrs =', block_start)
new_test = r'''  // SC-024: use the existing Player Stats fixture for the selected player's card,
  // then make the all-player Misfire source deterministic for leaderboard checks.
  await page.evaluate(() => {
    const baseSb = window.sb;
    window.__sc024MisfireSourceAudit = [];
    const byCode = {
      bull_blind: [
        { player_id:'p1', code:'bull_blind', cnt:3 },
        { player_id:'p2', code:'bull_blind', cnt:2 },
      ],
      century_drought: [],
    };
    const wrapped = {
      from(table){
        if (table !== 'v_player_misfires') return baseSb.from(table);
        let selectedCode = '';
        const q = {
          select(){ return q; },
          eq(col, value){ if (col === 'code') selectedCode = String(value || ''); return q; },
          then(resolve){
            window.__sc024MisfireSourceAudit.push({ table, code:selectedCode });
            resolve({ data:(byCode[selectedCode] || []).map(r => ({ ...r })), error:null });
          },
          catch(){ return q; },
        };
        return q;
      }
    };
    window.sb = wrapped; window.__sb = wrapped;
  });

  await page.click('.sq-stats-modal .pp-misfire-card[data-code="bull_blind"]');
  await page.waitForFunction(() => {
    const d = document.querySelector('.pp-misfire-detail');
    return !!d && !d.querySelector('#misfireLbLoading');
  });
  const detail = await page.evaluate(() => {
    const d = document.querySelector('.pp-misfire-detail');
    if (!d) return null;
    return {
      text: d.textContent,
      count: (d.querySelector('.pp-misfire-detail-count') || {}).textContent || '',
      rule: (d.querySelector('.pp-misfire-detail-rule') || {}).textContent || '',
      title: (d.querySelector('.pp-misfire-leaderboard-title') || {}).textContent || '',
      rows: Array.from(d.querySelectorAll('.pp-misfire-lb-row')).map(row => ({
        rank: (row.querySelector('.pp-misfire-lb-rank') || {}).textContent || '',
        name: (row.querySelector('.pp-misfire-lb-name') || {}).textContent || '',
        count: (row.querySelector('.pp-misfire-lb-count') || {}).textContent || '',
      })),
      fits: d.getBoundingClientRect().left >= -1 && d.getBoundingClientRect().right <= innerWidth + 1,
      hasClose: !!Array.from(d.querySelectorAll('button')).find(b => /^close$/i.test((b.textContent || '').trim())),
      sourceAudit: (window.__sc024MisfireSourceAudit || []).slice(),
    };
  });
  check('Misfire card opens detail modal', !!detail && /Bull Blind/.test(detail.text || ''), JSON.stringify(detail));
  if (detail) {
    check('Misfire detail carries repeat count', /Recorded ×3 historically/i.test(detail.count), detail.count);
    check('Misfire detail preserves launch-forward/worst/-5 rule', /5 Sep 2026 20:13 UTC/i.test(detail.rule) && /Only the worst Misfire applies per game/i.test(detail.rule) && /maximum deduction is 5 XP per game/i.test(detail.rule), detail.rule);
    check('Misfire detail now includes all-player leaderboard', norm(detail.title) === 'Misfire leaderboard' && detail.rows.length === 2, JSON.stringify(detail.rows));
    check('Misfire leaderboard ranks historical counts descending', detail.rows[0] && detail.rows[0].rank === '#1' && detail.rows[0].name === 'Alex S' && detail.rows[0].count === '×3' && detail.rows[1] && detail.rows[1].rank === '#2' && detail.rows[1].name === 'Sam T' && detail.rows[1].count === '×2', JSON.stringify(detail.rows));
    check('Misfire leaderboard reads the verified Misfire source only', detail.sourceAudit.some(x => x.table === 'v_player_misfires' && x.code === 'bull_blind'), JSON.stringify(detail.sourceAudit));
    check('Misfire leaderboard modal fits mobile and retains Close', detail.fits && detail.hasClose, JSON.stringify(detail));
  }

  await page.click('.pp-misfire-detail button');
  await page.waitForFunction(() => !document.querySelector('.pp-misfire-detail'));
  check('Misfire leaderboard Close dismisses modal', true);

  await page.evaluate(() => __sqMisfireDetail('century_drought', {}));
  const empty = await page.evaluate(() => {
    const d = document.querySelector('.pp-misfire-detail');
    return d ? {
      title: (d.querySelector('.pp-misfire-leaderboard-title') || {}).textContent || '',
      empty: (d.querySelector('.pp-misfire-lb-empty') || {}).textContent || '',
      rows: d.querySelectorAll('.pp-misfire-lb-row').length,
    } : null;
  });
  check('Misfire leaderboard has truthful zero-history state', !!empty && norm(empty.title) === 'Misfire leaderboard' && /No one has recorded this Misfire yet/i.test(empty.empty) && empty.rows === 0, JSON.stringify(empty));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.pp-misfire-detail'));
  check('Misfire leaderboard Escape dismisses modal', true);'''
test = test[:block_start] + new_test + test[block_end:]
test_path.write_text(test)
