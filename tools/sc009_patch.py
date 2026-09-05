from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')


def rep(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {n}')
    s = s.replace(old, new, 1)
    print('PATCH', label)

# Canonical display names / descriptions.
rep("{ code:'untouchable',    name:'Untouchable',        icon:'👑', tier:'legendary', xp:200, desc:'Win the game without ever falling behind' },",
    "{ code:'untouchable',    name:'Untouchable',        icon:'👑', tier:'legendary', xp:200, desc:'Win a game without ever being behind after any completed round' },", 'untouchable copy')
rep("{ code:'special_forces', name:'Special Forces',     icon:'🪖', tier:'legendary', xp:180, desc:'Hit three doubles, three trebles and three bulls in the final three rounds' },",
    "{ code:'special_forces', name:'Special Forces',     icon:'🪖', tier:'legendary', xp:180, desc:\"Earn Double D’s + Maxi + Bull Run in one game\" },", 'special forces copy')
rep("{ code:'last_gasp',      name:'Last Gasp',          icon:'⏳', tier:'gold',      xp:50,  desc:'Win after trailing after the Doubles round' },",
    "{ code:'last_gasp',      name:'Last Gasp',          icon:'⏳', tier:'gold',      xp:50,  desc:'Be behind after round 12, then win' },", 'last gasp copy')
rep("{ code:'flawless_game',  name:\"Sharpshooter's Game\",icon:'✨', tier:'legendary', xp:120, desc:'No missed darts for a whole game' },",
    "{ code:'flawless_game',  name:\"Sharpshooter's Game\",icon:'✨', tier:'legendary', xp:120, desc:'No non-scoring darts for the entire game' },", 'sharpshooter copy')
rep("{ code:'treble_trouble', name:'Treble Trouble',     icon:'🔱', tier:'gold',      xp:40,  desc:'Three trebles in a number round (10–20)' },",
    "{ code:'treble_trouble', name:'Mini Maxi',          icon:'🔱', tier:'gold',      xp:40,  desc:'Three trebles in a number round 10–20 only' },", 'mini maxi')
rep("{ code:'double_down',    name:'Double Down',        icon:'♊', tier:'silver',    xp:25,  desc:'Three doubles in a number round (10–20)' },",
    "{ code:'double_down',    name:\"Mini D’s\",          icon:'♊', tier:'silver',    xp:25,  desc:'Three doubles in a number round 10–20 only' },", 'mini ds')
rep("{ code:'triple_threat',  name:'Triple Threat',      icon:'⚡', tier:'gold',      xp:60,  desc:'Three triples in the Triples round' },",
    "{ code:'triple_threat',  name:'Maxi',               icon:'⚡', tier:'gold',      xp:60,  desc:'Three trebles in the Trebles round only' },", 'maxi')
rep("{ code:'double_trouble', name:'Double Trouble',     icon:'🎲', tier:'gold',      xp:45,  desc:'Three doubles in the Doubles round' },",
    "{ code:'double_trouble', name:\"Double D’s\",        icon:'🎲', tier:'gold',      xp:45,  desc:'Three doubles in the Doubles round only' },", 'double ds')

# David & Goliath is a separate award from Giant Slayer. Backend activation is a bounded DB change.
giant = "{ code:'giant_slayer',   name:'Giant Slayer',       icon:'🗡️', tier:'gold',      xp:0,   desc:'Beat a higher-level player (bonus scales with the gap)' },"
rep(giant, giant + "\n    { code:'david_and_goliath',name:'David & Goliath',   icon:'🪨', tier:'gold',      xp:100, desc:\"Win when your pre-game 10-game average is 200+ points lower than an opponent’s\" },", 'david and goliath catalogue')

# Live toast detector must mirror the distinct number-round vs special-round rules.
rep("if (tre === 3) add('treble_trouble');", "if (ri <= 10 && tre === 3) add('treble_trouble');", 'live mini maxi isolation')
rep("if (dou === 3) add('double_down');", "if (ri <= 10 && dou === 3) add('double_down');", 'live mini ds isolation')

# Untouchable is not a full-house streak: it is a win without ever being behind after a completed round.
old = """    if (totMiss === 0 && totDarts > 0) add('flawless_game');
    if (scoredRounds >= 14) add('full_board');
    if (centuryRounds >= 3) add('ton_machine');
    if (best >= 14) add('untouchable'); else if (best >= 5) add('inferno'); else if (best >= 3) add('hot_streak');"""
new = """    if (totMiss === 0 && totDarts > 0) add('flawless_game');
    if (scoredRounds >= 14) add('full_board');
    if (centuryRounds >= 3) add('ton_machine');
    let neverBehind = won;
    if (won){
      const running = new Array(board.length).fill(0);
      const nRounds = Math.max.apply(null, board.map(rs => (rs || []).length).concat([0]));
      for (let ri = 0; ri < nRounds && neverBehind; ri++){
        for (let q = 0; q < board.length; q++) running[q] += Number((((board[q] || [])[ri] || {}).roundTotal)) || 0;
        for (let q = 0; q < board.length; q++) if (q !== p && running[q] > running[p]) { neverBehind = false; break; }
      }
    }
    if (won && neverBehind) add('untouchable');
    if (best >= 5) add('inferno'); else if (best >= 3) add('hot_streak');"""
rep(old, new, 'live untouchable rule')

# Reuse the existing modal system for Misfire detail.
anchor = "window.SQ_MISFIRE = SQ_MISFIRE;"
misfire_detail = r'''

function __sqMisfireDetail(m, cnt){
  const got = Math.max(0, Number(cnt) || 0);
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal pp-misfire-detail';
  modal.style.cssText = 'max-width:460px;width:92vw;max-height:86vh;overflow:hidden;';
  const body = document.createElement('div'); body.className = 'modal-body'; body.style.cssText = 'overflow-y:auto;max-height:82vh;';
  body.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:linear-gradient(135deg,rgba(127,29,29,.52),rgba(69,10,10,.36));border:1px solid rgba(248,113,113,.48);">'
    + '<div style="font-size:40px;line-height:1">' + m.icon + '</div>'
    + '<div style="min-width:0"><div style="font-weight:900;font-size:20px;color:#fff">' + m.name + '</div>'
    + '<div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#fecaca">MISFIRE · ' + String(m.penalty) + ' XP</div></div></div>'
    + '<div style="margin:14px 2px 4px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">How it happens</div>'
    + '<div style="font-size:15px;font-weight:600;margin:0 2px 10px">' + m.desc + '.</div>'
    + '<div class="pp-misfire-detail-count" style="font-size:12px;font-weight:900;margin:0 2px 14px;color:' + (got ? '#fca5a5' : 'var(--v3-muted,#98a2b8)') + '">'
    + (got ? ('You’ve recorded this ' + got + '×') : 'You haven’t recorded this yet') + '</div>'
    + '<div style="margin:6px 2px 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.6">XP rule</div>'
    + '<div class="muted pp-misfire-detail-rule" style="font-size:13px;line-height:1.45">Historical awards remain visible. XP penalties apply only from 5 Sep 2026 20:13 UTC. If several Misfires occur in one game, only the worst penalty applies, with a maximum deduction of 5 XP per game.</div>';
  const foot = document.createElement('div'); foot.style.cssText = 'margin-top:14px;text-align:center;';
  const cb = document.createElement('button'); cb.className = 'btn sq-pill'; cb.textContent = 'Close'; cb.onclick = () => overlay.remove();
  foot.appendChild(cb); body.appendChild(foot); modal.append(body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();
}
'''
rep(anchor, anchor + misfire_detail, 'misfire detail modal')

# Replace the vertical Misfire list with the same card-grid anatomy as the Trophy Vault.
start = s.find("const mfCard = document.createElement('div');")
end_marker = "achPanel.appendChild(mfCard);"
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('misfire panel block not found')
end += len(end_marker)
old_panel = s[start:end]
new_panel = r'''const mfCard = document.createElement('div');
    mfCard.className = 'tag pp-misfires';
    mfCard.style.cssText = 'padding:14px;border-radius:16px;background:rgba(239,68,68,.055);border:1px solid rgba(248,113,113,.22);';
    const mfHead = document.createElement('div');
    mfHead.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;';
    const mfTitleWrap = document.createElement('div');
    const mfTitle = document.createElement('strong'); mfTitle.textContent = '⚠️ Misfires'; mfTitle.style.cssText = 'font-size:15px;color:#fecaca;';
    const mfSub = document.createElement('div'); mfSub.className = 'muted'; mfSub.style.cssText = 'font-size:11px;margin-top:2px;'; mfSub.textContent = 'Historical record · XP penalties are launch-forward only';
    mfTitleWrap.append(mfTitle, mfSub);
    const mfStatus = document.createElement('div'); mfStatus.style.cssText = 'text-align:right;white-space:nowrap;';
    const mfUnlocked = document.createElement('div'); mfUnlocked.className = 'muted pp-misfire-unlocked'; mfUnlocked.style.cssText = 'font-weight:800;font-size:12px;';
    const mfXp = document.createElement('div'); mfXp.className = 'pp-misfire-xp'; mfXp.style.cssText = 'font-weight:900;font-size:11px;margin-top:2px;color:#fecaca;';
    const mfXpKnown = !!(xpRow && Number.isFinite(Number(xpRow.misfire_xp)));
    const mfXpValue = mfXpKnown ? Number(xpRow.misfire_xp) : null;
    mfXp.textContent = mfXpKnown ? ((mfXpValue > 0 ? '+' : '') + String(mfXpValue) + ' XP') : 'XP —';
    mfStatus.append(mfUnlocked, mfXp); mfHead.append(mfTitleWrap, mfStatus); mfCard.appendChild(mfHead);

    if (!misfireState.available){
      mfUnlocked.textContent = '— / ' + SQ_MISFIRE.CATALOG.length + ' unlocked';
      const unavailable = document.createElement('div'); unavailable.className = 'muted'; unavailable.style.fontSize = '12px';
      unavailable.textContent = 'Misfire history is unavailable right now.'; mfCard.appendChild(unavailable);
    } else {
      const mfTotal = SQ_MISFIRE.CATALOG.reduce((sum, m) => sum + Number((misfireMap[m.code] || {}).cnt || 0), 0);
      const earnedN = SQ_MISFIRE.CATALOG.filter(m => Number((misfireMap[m.code] || {}).cnt || 0) > 0).length;
      mfUnlocked.textContent = earnedN + ' / ' + SQ_MISFIRE.CATALOG.length + ' unlocked';
      const totalLine = document.createElement('div'); totalLine.className = 'pp-misfire-total muted';
      totalLine.style.cssText = 'font-size:11px;font-weight:800;margin:-3px 0 9px;'; totalLine.textContent = mfTotal + ' historical occurrence' + (mfTotal === 1 ? '' : 's');
      mfCard.appendChild(totalLine);

      const mfGrid = document.createElement('div'); mfGrid.className = 'pp-misfire-grid'; mfGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;';
      const makeMisfireBadge = m => {
        const cnt = Number((misfireMap[m.code] || {}).cnt || 0); const earned = cnt > 0;
        const b = document.createElement('div'); b.className = 'pp-misfire-card'; b.dataset.code = m.code; b.title = m.desc + (earned && cnt > 1 ? ('  (recorded ' + cnt + '×)') : '');
        b.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;cursor:pointer;padding:10px 6px;border-radius:12px;'
          + (earned ? 'background:linear-gradient(135deg,rgba(127,29,29,.48),rgba(69,10,10,.32));border:1px solid rgba(248,113,113,.45);'
                    : 'background:rgba(255,255,255,.03);border:1px dashed rgba(248,113,113,.18);opacity:.42;filter:grayscale(1);');
        const ic = document.createElement('div'); ic.textContent = m.icon; ic.style.cssText = 'font-size:26px;line-height:1;';
        const nm = document.createElement('div'); nm.textContent = m.name; nm.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:.01em;color:' + (earned ? '#fecaca' : 'var(--v3-muted,#98a2b8)') + ';line-height:1.15;';
        b.append(ic, nm); b.onclick = () => { try{ __sqMisfireDetail(m, cnt); }catch(_){ } };
        if (earned && cnt > 1){
          const bc = document.createElement('div'); bc.className = 'pp-misfire-count'; bc.textContent = '×' + cnt;
          bc.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff5f5;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);';
          b.appendChild(bc);
        }
        return b;
      };
      SQ_MISFIRE.CATALOG.forEach(m => { if (Number((misfireMap[m.code] || {}).cnt || 0) > 0) mfGrid.appendChild(makeMisfireBadge(m)); });
      SQ_MISFIRE.CATALOG.forEach(m => { if (!(Number((misfireMap[m.code] || {}).cnt || 0) > 0)) mfGrid.appendChild(makeMisfireBadge(m)); });
      mfCard.appendChild(mfGrid);
    }

    const mfFoot = document.createElement('div'); mfFoot.className = 'muted pp-misfire-foot';
    mfFoot.style.cssText = 'font-size:10px;line-height:1.35;margin-top:10px;';
    mfFoot.textContent = 'Historical counts include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. If several Misfires occur in one game, only the worst penalty applies; the maximum deduction is 5 XP per game.';
    mfCard.appendChild(mfFoot);
    achPanel.appendChild(mfCard);'''
s = s[:start] + new_panel + s[end:]
print('PATCH misfire card grid')

p.write_text(s, encoding='utf-8')
print('DONE', len(s.encode('utf-8')))
