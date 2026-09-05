from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')
original = s


def sub_one(pattern, repl, label, flags=0):
    global s
    s2, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected exactly 1 replacement, got {n}')
    s = s2
    print('PATCH', label)


def patch_catalog_entry(code, name=None, desc=None):
    global s
    pat = re.compile(r"\{ code:'" + re.escape(code) + r"',[^\n]*\}")
    m = pat.search(s)
    if not m:
        raise SystemExit(f'catalog entry not found: {code}')
    entry = m.group(0)
    new = entry
    if name is not None:
        new, n = re.subn(r"name:(?:'[^']*'|\"[^\"]*\")", "name:'" + name + "'", new, count=1)
        if n != 1:
            raise SystemExit(f'{code}: name replacement failed')
    if desc is not None:
        new, n = re.subn(r"desc:(?:'[^']*'|\"[^\"]*\")", "desc:'" + desc + "'", new, count=1)
        if n != 1:
            raise SystemExit(f'{code}: desc replacement failed')
    if new == entry:
        raise SystemExit(f'{code}: entry was not changed')
    s = s[:m.start()] + new + s[m.end():]
    print('PATCH catalog', code)


# Canonical display names / rule copy.
patch_catalog_entry('treble_trouble', name='Mini Maxi', desc='Three trebles in a number round 10–20 only')
patch_catalog_entry('triple_threat', name='Maxi', desc='Three trebles in the Trebles round only')
patch_catalog_entry('double_down', name='Mini D’s', desc='Three doubles in a number round 10–20 only')
patch_catalog_entry('double_trouble', name='Double D’s', desc='Three doubles in the Doubles round only')
patch_catalog_entry('untouchable', name='Untouchable', desc='Win a game without ever being behind after any completed round')
patch_catalog_entry('flawless_game', name='Sharpshooter’s Game', desc='No non-scoring darts for the entire game')
patch_catalog_entry('special_forces', desc='Earn Double D’s, Maxi and Bull Run in one game')
patch_catalog_entry('last_gasp', desc='Be behind after round 12, then win')

# David & Goliath is distinct from the existing Giant Slayer award.
if "code:'david_and_goliath'" in s:
    raise SystemExit('david_and_goliath already present before SC-009 patch')
m = re.search(r"(^[ \t]*\{ code:'giant_slayer',[^\n]*\}\s*,?\n)", s, flags=re.M)
if not m:
    raise SystemExit('giant_slayer catalogue anchor not found')
indent = re.match(r'^[ \t]*', m.group(1)).group(0)
dg = indent + "{ code:'david_and_goliath',name:'David & Goliath',   icon:'🪨', tier:'gold',      xp:100, desc:'Win when your pre-game 10-game average is at least 200 points lower than an opponent’s' },\n"
s = s[:m.end()] + dg + s[m.end():]
print('PATCH David & Goliath catalogue')

# Live toast detector must mirror the number-round/special-round distinction.
sub_one(r"if \(tre === 3\) add\('treble_trouble'\);", "if (ri <= 10 && tre === 3) add('treble_trouble');", 'Mini Maxi round isolation')
sub_one(r"if \(dou === 3\) add\('double_down'\);", "if (ri <= 10 && dou === 3) add('double_down');", 'Mini Ds round isolation')

# Untouchable: unique game winner who was never behind after a completed round.
sub_one(
    r"const won = totals\[p\] === maxTotal && maxTotal > 0;\n",
    "const won = totals[p] === maxTotal && maxTotal > 0;\n"
    "    const topCount = totals.filter(t => t === maxTotal).length;\n"
    "    const uniqueWon = won && topCount === 1;\n"
    "    const running = Array(board.length).fill(0);\n"
    "    let neverBehind = true;\n"
    "    const roundN = Math.max.apply(null, board.map(rs => (rs || []).length).concat([0]));\n"
    "    for (let ri = 0; ri < roundN; ri++){\n"
    "      for (let q = 0; q < board.length; q++) running[q] += Number((((board[q] || [])[ri] || {}).roundTotal) || 0);\n"
    "      const lead = Math.max.apply(null, running.concat([0]));\n"
    "      if (running[p] < lead) { neverBehind = false; break; }\n"
    "    }\n",
    'Untouchable cumulative state insert'
)
sub_one(
    r"if \(best >= 14\) add\('untouchable'\); else if \(best >= 5\) add\('inferno'\); else if \(best >= 3\) add\('hot_streak'\);",
    "if (best >= 5) add('inferno'); else if (best >= 3) add('hot_streak');\n"
    "    if (!opts.is_tiebreak && board.length >= 2 && uniqueWon && neverBehind) add('untouchable');",
    'Untouchable obsolete streak removal'
)

# Canonical positive-section label and a stable section marker for regression tests.
sub_one(
    r"const card = document\.createElement\('div'\); card\.className = 'tag';\n    card\.style\.cssText = 'padding:14px;",
    "const card = document.createElement('div'); card.className = 'tag';\n    card.dataset.achievementSection = title;\n    card.style.cssText = 'padding:14px;",
    'positive section data marker'
)
sub_one(
    r"wrap\.append\(section\('Milestones', '🎖️', mset\), section\('Trophies', '🏆', tset\)\);",
    "wrap.append(section('Milestones', '🎖️', mset), section('Trophies / Awards', '🏆', tset));",
    'Trophies Awards section label'
)

# Misfires use the same compact card-grid/click-detail model, but remain separate
# from positive achievement progression and keep a distinct negative treatment.
helpers = r'''
function __sqMisfireDetail(code, misfireMap){
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
    + '<div class="muted pp-misfire-detail-rule" style="font-size:10px;line-height:1.4;margin:0 2px">Historical counts can include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. Only the worst Misfire applies per game; the maximum deduction is 5 XP per game.</div>';
  const foot = document.createElement('div'); foot.style.cssText = 'margin-top:14px;text-align:center;';
  const cb = document.createElement('button'); cb.className = 'btn sq-pill'; cb.textContent = 'Close'; cb.onclick = () => overlay.remove();
  foot.appendChild(cb); body.appendChild(foot); modal.append(body); overlay.appendChild(modal); document.body.appendChild(overlay);
  try{if(window.sqModal&&window.sqModal.register)window.sqModal.register(overlay,modal,function(){overlay.remove();});}catch(_){}
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.remove(); });
  modal.tabIndex = 0; modal.focus();
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
      const pen = document.createElement('div'); pen.className = 'pp-misfire-penalty'; pen.textContent = m.penalty + ' XP'; pen.style.cssText = 'font-size:9px;font-weight:900;color:#fca5a5;';
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
  foot.textContent = 'Historical counts include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. If several Misfires occur in one game, only the worst penalty applies; the maximum deduction is 5 XP per game.';
  card.appendChild(foot);
  return card;
}

'''
marker = '// === Player Stats — redesigned overview'
if s.count(marker) != 1:
    raise SystemExit(f'Player Stats marker expected once, got {s.count(marker)}')
if 'function __sqMisfireCase' in s:
    raise SystemExit('Misfire helper already present before patch')
s = s.replace(marker, helpers + marker, 1)
print('PATCH Misfire card/detail helpers')

start = s.find("    const mfCard = document.createElement('div');")
end_marker = '    achPanel.appendChild(mfCard);'
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('legacy Misfire panel block not found')
end += len(end_marker)
s = s[:start] + "    const mfCard = __sqMisfireCase(misfireState, xpRow);\n    achPanel.appendChild(mfCard);" + s[end:]
print('PATCH Misfire panel call')

# Guardrails.
for required in [
    "name:'Mini Maxi'", "name:'Maxi'", "name:'Mini D’s'", "name:'Double D’s'",
    "name:'Sharpshooter’s Game'", "code:'david_and_goliath'", "section('Trophies / Awards'",
    'function __sqMisfireCase', 'function __sqMisfireDetail',
    "if (ri <= 10 && tre === 3) add('treble_trouble');",
    "if (ri <= 10 && dou === 3) add('double_down');",
    "uniqueWon && neverBehind",
]:
    if required not in s:
        raise SystemExit(f'missing required post-patch marker: {required}')
if s.count("code:'david_and_goliath'") != 1:
    raise SystemExit('David & Goliath catalogue count is not exactly 1')
if "if (best >= 14) add('untouchable')" in s:
    raise SystemExit('obsolete Untouchable detector remains')

p.write_text(s, encoding='utf-8')
print('SC-009 index patch OK', len(original.encode('utf-8')), '->', len(s.encode('utf-8')))
