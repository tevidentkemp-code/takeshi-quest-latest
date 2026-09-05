from pathlib import Path
import re
import subprocess
import tempfile

INDEX = Path('index.html')
EXPECTED_BLOB = 'c5688cf19d2d8f7bf57cd9c991009f97292cb8a3'
text = INDEX.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact anchor, found {count}')
    text = text.replace(old, new, 1)


old_untouchable = "    { code:'untouchable',    name:'Untouchable',        icon:'👑', tier:'legendary', xp:200, desc:'Hit all three darts in every round of a game' },"
new_untouchable = """    { code:'untouchable',    name:'Untouchable',        icon:'👑', tier:'legendary', xp:200, desc:'Win the game without ever falling behind' },
    { code:'special_forces', name:'Special Forces',     icon:'🪖', tier:'legendary', xp:180, desc:'Hit three doubles, three trebles and three bulls in the final three rounds' },
    { code:'reverse_sweep',  name:'Reverse Sweep',      icon:'↩️', tier:'legendary', xp:150, desc:'Win a five-game match after losing the first two games' },
    { code:'clean_sweep',    name:'Clean Sweep',        icon:'🧼', tier:'gold',      xp:80,  desc:'Win every game in a three- or five-game match' },
    { code:'last_gasp',      name:'Last Gasp',          icon:'⏳', tier:'gold',      xp:50,  desc:'Win after trailing after the Doubles round' },
    { code:'pb_smasher',     name:'PB Smasher',         icon:'🔨', tier:'silver',    xp:50,  desc:'Beat your previous game PB by 100+ points' },
    { code:'century_streak', name:'Century Streak',     icon:'💯', tier:'silver',    xp:40,  desc:'Score 100+ in two consecutive rounds' },
    { code:'runaway',        name:'Runaway',            icon:'💨', tier:'silver',    xp:30,  desc:'Win a game by 200+ points' },
    { code:'steady_eddie',   name:'Steady Eddie',       icon:'📏', tier:'silver',    xp:25,  desc:'Score in 10 consecutive rounds in one game' },
    { code:'photo_finish',   name:'Photo Finish',       icon:'🏁', tier:'silver',    xp:20,  desc:'Win a game by 1–10 points' },"""
replace_once(old_untouchable, new_untouchable, 'achievement catalogue insertion')

replace_once(
    "    { code:'treble_trouble', name:'Treble Trouble',     icon:'🔱', tier:'gold',      xp:40,  desc:'Three trebles in one round' },",
    "    { code:'treble_trouble', name:'Treble Trouble',     icon:'🔱', tier:'gold',      xp:40,  desc:'Three trebles in a number round (10–20)' },",
    'Treble Trouble copy',
)
replace_once(
    "    { code:'double_down',    name:'Double Down',        icon:'♊', tier:'silver',    xp:25,  desc:'Three doubles in one round' },",
    "    { code:'double_down',    name:'Double Down',        icon:'♊', tier:'silver',    xp:25,  desc:'Three doubles in a number round (10–20)' },",
    'Double Down copy',
)

misfire_anchor = "window.SQ_ACH = SQ_ACH;\n\n// Milestones are one-time unlocks"
misfire_module = """window.SQ_ACH = SQ_ACH;

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
    { code:'century_drought',         name:'Century Drought',         icon:'🏜️', penalty:-2, desc:'Finish below 100 in five consecutive games' },
    { code:'wooden_spoon',            name:'Wooden Spoon',            icon:'🥄', penalty:-3, desc:'Finish sole last in five consecutive games' }
  ],
  async forName(name){
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
};
window.SQ_MISFIRE = SQ_MISFIRE;

// Milestones are one-time unlocks"""
replace_once(misfire_anchor, misfire_module, 'Misfire module insertion')

old_fetch = """  let xpProg = null, xpRow = null, achMap = {};
  try{
    const [xr, am] = await Promise.all([
      SQ_XP.forName(name).catch(()=>null),
      SQ_ACH.forName(name).catch(()=>null)
    ]);
    xpRow = xr || null;
    if (xpRow) xpProg = SQ_XP.progress(xpRow.total_xp);
    achMap = am || {};
  }catch(_){ }"""
new_fetch = """  let xpProg = null, xpRow = null, achMap = {}, misfireState = { available:false, map:{} };
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
  const misfireMap = misfireState.map || {};"""
replace_once(old_fetch, new_fetch, 'Player Stats parallel fetch')

old_trophy_tail = """    achPanel.appendChild(vault);
    achPanel.appendChild(__sqTrophyCase(achMap));

    let timers = [];"""
new_trophy_tail = """    achPanel.appendChild(vault);
    achPanel.appendChild(__sqTrophyCase(achMap));

    // Misfires are deliberately separate from the positive Trophy Vault.
    // Counts are historical; XP impact is the launch-forward value already
    // included in v_player_xp, so the client never retroactively deducts XP.
    const mfCard = document.createElement('div');
    mfCard.className = 'tag pp-misfires';
    mfCard.style.cssText = 'padding:12px;border-radius:14px;background:rgba(239,68,68,.055);border:1px solid rgba(248,113,113,.22);display:flex;flex-direction:column;gap:10px;';
    const mfHead = document.createElement('div');
    mfHead.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;';
    const mfTitleWrap = document.createElement('div');
    const mfTitle = document.createElement('strong'); mfTitle.textContent = 'Misfires'; mfTitle.style.cssText = 'font-size:15px;color:#fecaca;';
    const mfSub = document.createElement('div'); mfSub.className = 'muted'; mfSub.style.cssText = 'font-size:11px;margin-top:2px;'; mfSub.textContent = 'Historical record · XP penalties are launch-forward only';
    mfTitleWrap.append(mfTitle, mfSub);
    const mfXp = document.createElement('div');
    mfXp.className = 'pp-misfire-xp';
    mfXp.style.cssText = 'font-weight:900;font-size:13px;white-space:nowrap;color:#fecaca;';
    const mfXpKnown = !!(xpRow && Number.isFinite(Number(xpRow.misfire_xp)));
    const mfXpValue = mfXpKnown ? Number(xpRow.misfire_xp) : null;
    mfXp.textContent = mfXpKnown ? ((mfXpValue > 0 ? '+' : '') + String(mfXpValue) + ' XP') : 'XP —';
    mfHead.append(mfTitleWrap, mfXp); mfCard.appendChild(mfHead);

    if (!misfireState.available){
      const unavailable = document.createElement('div'); unavailable.className = 'muted'; unavailable.style.fontSize = '12px';
      unavailable.textContent = 'Misfire history is unavailable right now.'; mfCard.appendChild(unavailable);
    } else {
      const mfTotal = SQ_MISFIRE.CATALOG.reduce((sum, m) => sum + Number((misfireMap[m.code] || {}).cnt || 0), 0);
      const totalLine = document.createElement('div'); totalLine.className = 'pp-misfire-total';
      totalLine.style.cssText = 'font-size:12px;font-weight:800;'; totalLine.textContent = mfTotal + ' historical occurrence' + (mfTotal === 1 ? '' : 's');
      mfCard.appendChild(totalLine);

      const mfList = document.createElement('div'); mfList.style.cssText = 'display:flex;flex-direction:column;gap:7px;';
      SQ_MISFIRE.CATALOG.forEach(m => {
        const cnt = Number((misfireMap[m.code] || {}).cnt || 0);
        const row = document.createElement('div'); row.className = 'pp-misfire-row';
        row.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px;border-radius:10px;background:rgba(0,0,0,.16);' + (cnt ? '' : 'opacity:.58;');
        const ico = document.createElement('span'); ico.textContent = m.icon; ico.style.fontSize = '18px';
        const info = document.createElement('div'); info.style.minWidth = '0';
        const nm = document.createElement('div'); nm.style.cssText = 'font-size:12px;font-weight:900;'; nm.textContent = m.name;
        const ds = document.createElement('div'); ds.className = 'muted'; ds.style.cssText = 'font-size:10px;line-height:1.25;margin-top:2px;'; ds.textContent = m.desc;
        info.append(nm, ds);
        const val = document.createElement('div'); val.style.cssText = 'text-align:right;font-size:11px;font-weight:900;white-space:nowrap;';
        val.textContent = cnt + '× · ' + String(m.penalty) + ' XP';
        row.append(ico, info, val); mfList.appendChild(row);
      });
      mfCard.appendChild(mfList);
    }

    const mfFoot = document.createElement('div'); mfFoot.className = 'muted pp-misfire-foot';
    mfFoot.style.cssText = 'font-size:10px;line-height:1.35;';
    mfFoot.textContent = 'Historical counts include earlier Official/Classic games. XP penalties apply only from 5 Sep 2026 20:13 UTC. If several Misfires occur in one game, only the worst penalty applies; the maximum deduction is 5 XP per game.';
    mfCard.appendChild(mfFoot);
    achPanel.appendChild(mfCard);

    let timers = [];"""
replace_once(old_trophy_tail, new_trophy_tail, 'Misfires UI insertion')

# Guard the protected navigation shape and deferred product rule.
if "const tabs = [['Stats', statsPanel], ['XP', xpPanel], ['Achievements', achPanel]];" not in text:
    raise SystemExit('Player Stats tab contract changed unexpectedly')
for code in ['photo_finish','runaway','last_gasp','special_forces','steady_eddie','century_streak','pb_smasher','reverse_sweep','clean_sweep']:
    marker = "{ code:'" + code + "'"
    if text.count(marker) != 1:
        raise SystemExit(f'catalogue marker {code}: expected exactly 1, found {text.count(marker)}')
if 'david_and_goliath' in text.lower():
    raise SystemExit('deferred David & Goliath feature unexpectedly present')

INDEX.write_text(text, encoding='utf-8')

# Parse-check the exact application script we modified. This avoids treating
# non-JavaScript template/script payloads elsewhere in the HTML as executable JS.
scripts = re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', text, re.I)
targets = [body for body in scripts if 'const SQ_ACH = {' in body and 'openPlayerStatsDialog' in body]
if len(targets) != 1:
    raise SystemExit(f'Expected exactly one modified app script, found {len(targets)}')
fn = Path(tempfile.gettempdir()) / 'sc008-app-script.js'
fn.write_text(targets[0], encoding='utf-8')
subprocess.run(['node', '--check', str(fn)], check=True)
print('SC-008 patch applied; modified app script parse-check PASS')
