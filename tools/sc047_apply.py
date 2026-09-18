
from pathlib import Path
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 match, found {n}")
    return text.replace(old, new, 1)

# 1) Game Complete DMD: fixed centred slow pulse, not scrolling marquee.
path = 'src/app/state.js'
s = read(path)
old = """  // Presentation-only finished-game state: once completion is valid, replace
  // the last live-game DMD frame with a cabinet-style full-width GAME OVER
  // marquee. The next startNewGame(true) hard-clears this scene.
  try{
    window.__sqDmdStopPreThrow?.();
    window.__sqDmdHardClearQueue?.();
    window.sqDmdShowZones?.({ z2:'GAME OVER', z3:'' }, { type:'marqueeFull', ms:60 * 60 * 1000 });
  }catch(_){ }
"""
new = """  // Presentation-only finished-game state: once completion is valid, replace
  // the last live-game DMD frame with a centred, slow-breathing GAME OVER.
  // No lateral movement or strobe; the next fresh game hard-clears this scene.
  try{
    window.__sqDmdStopPreThrow?.();
    window.__sqDmdHardClearQueue?.();
    window.sqDmdShowZones?.({ z2:'GAME OVER', z3:'' }, { type:'pulseCenter', ms:60 * 60 * 1000 });
  }catch(_){ }
"""
s = replace_once(s, old, new, 'state GAME OVER scene')
write(path, s)

# 2) DMD renderer: add pulseCenter scene.
path = 'src/legacy/scripts/inline-007.js'
s = read(path)
marker = "        // >>> PATCH:SQ_DMD_MARQUEE_FULL START\n"
pulse = """    // >>> PATCH:SC047_DMD_GAME_OVER_PULSE START
    // Full-DMD centred slow pulse for the completed-game background.
    // Text never moves laterally; reduced-motion users get a fixed centre frame.
    if (active && active.type === 'pulseCenter') {
      const t = (z2t || '').toUpperCase();
      if (t) {
        const reduce = __sqSc045ReducedMotion();
        const age = Math.max(0, now - active.start);
        const cycleMs = 2400;
        const wave = reduce ? 0 : (Math.sin((age / cycleMs) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
        const basePx = Math.max(TEXT.topPx, TEXT.botPx) + 4;
        const px = Math.round(basePx + wave * 7);
        const w = measureTextPx(t, px, 900);
        const x = Math.round((NATIVE_W - w) / 2);
        const y = Math.floor((NATIVE_H / 2) + px * 0.35);
        drawTextPx(t, x, y, px, 900);
      }
      thresholdNativeToAmber();
      return;
    }
    // <<< PATCH:SC047_DMD_GAME_OVER_PULSE END

"""
s = replace_once(s, marker, pulse + marker, 'renderer pulse insertion')
s = replace_once(
    s,
    'type: o.type || "hold", // hold | flash | wipe | shake | roll | idle | anticipationEyes | dolphinSwim | bullseyeHit',
    'type: o.type || "hold", // hold | flash | wipe | shake | roll | idle | pulseCenter | anticipationEyes | dolphinSwim | bullseyeHit',
    'renderer type comment'
)
write(path, s)

# 3) Match Leaderboard: do not relocate/restore STATS into its action stack.
path = 'src/legacy/scripts/inline-045.js'
s = read(path)
old = """      // Restore the STATS action on the leaderboard: the static top row that
      // hosted it is display:none, so relocate #statsHubBtnFinal into the
      // action stack (audit N-4). Its openStatsHubDialog handler is preserved.
      var statsFinal = document.getElementById('statsHubBtnFinal');
      if (statsFinal) {
        statsFinal.textContent = 'STATS';
        statsFinal.classList.remove('letter-throw', 'top-throw');
        statsFinal.classList.add('btn', 'big', 'sq-fix170-stats');
        if (statsFinal.parentElement !== stack) stack.appendChild(statsFinal);
      }

"""
new = """      // SC-047: Match Leaderboard no longer carries a STATS action.
      // Keep the legacy static control out of the visible action stack.
      var statsFinal = document.getElementById('statsHubBtnFinal');
      if (statsFinal) {
        statsFinal.classList.add('hidden');
        statsFinal.style.display = 'none';
      }

"""
s = replace_once(s, old, new, 'remove leaderboard STATS relocation')
write(path, s)

# 4) Reuse the exact post-game scorecard component from the leaderboard.
path = 'src/live-game/postgame-flow.mjs'
s = read(path)
style_anchor = """@media (max-width:560px){
  .modal-gamecomplete.sq-gc-arcade .gc-arcade-shell{ min-height:0; padding:28px 18px 20px; }
"""
style_insert = """/* SC-047: leaderboard GAME SCORES reuses this exact scorecard component. */
.sq-pg-scorecard-backdrop .sq-pg-scorecard-dialog{
  width:min(94vw,620px);
  max-width:620px;
  max-height:min(86vh,780px);
  overflow:auto;
}
.sq-pg-scorecard-dialog .gc-arcade-shell{
  min-height:0 !important;
  padding:24px 18px 18px !important;
}
.sq-pg-scorecard-dialog .sq-pg-scorecard{
  display:block !important;
}
.sq-pg-scorecard-dialog .sq-pg-nav{
  margin-top:18px;
}

"""
s = replace_once(s, style_anchor, style_insert + style_anchor, 'scorecard dialog styles')

hydrate_anchor = "async function hydrateRecordBadges(st, rows, scorecard) {\n"
dialog_fn = """function openGameScorecardDialog(stOverride = null) {
  const st = stOverride || getState();
  if (!st || !Array.isArray(st.players) || !st.players.length) return false;
  injectStyles();

  document.querySelectorAll('.sq-pg-scorecard-backdrop').forEach(node => {
    try { node.remove(); } catch (_) {}
  });

  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop sq-pg-scorecard-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal modal-gamecomplete sq-gc-arcade sq-pg-scorecard-dialog';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Game Scorecard');

  const shell = document.createElement('div');
  shell.className = 'gc-arcade-shell';

  const closeTop = document.createElement('button');
  closeTop.type = 'button';
  closeTop.className = 'gc-close';
  closeTop.setAttribute('aria-label', 'Close');
  closeTop.textContent = '✕';

  const built = buildScorecard(modal, st);
  const scorecard = built.screen;
  const rows = built.rows;
  scorecard.hidden = false;

  const nav = document.createElement('div');
  nav.className = 'sq-pg-nav';
  const closeBottom = document.createElement('button');
  closeBottom.type = 'button';
  closeBottom.className = 'sq-pg-next';
  closeBottom.textContent = 'CLOSE';
  nav.appendChild(closeBottom);

  shell.appendChild(closeTop);
  shell.appendChild(scorecard);
  shell.appendChild(nav);
  modal.appendChild(shell);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    try { document.removeEventListener('keydown', onKey); } catch (_) {}
    try { overlay.remove(); } catch (_) {}
  };
  const onKey = event => {
    if (event && event.key === 'Escape') close();
  };
  closeTop.onclick = close;
  closeBottom.onclick = close;
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  hydrateRecordBadges(st, rows, scorecard);
  try { closeTop.focus(); } catch (_) {}
  return true;
}

"""
s = replace_once(s, hydrate_anchor, dialog_fn + hydrate_anchor, 'reusable scorecard dialog')

boot_anchor = """function boot() {
  injectStyles();
  let tries = 0;
"""
boot_new = """function boot() {
  injectStyles();
  if (typeof window !== 'undefined') window.__sqOpenGameScorecardDialog = openGameScorecardDialog;
  let tries = 0;
"""
s = replace_once(s, boot_anchor, boot_new, 'expose scorecard dialog')
s = replace_once(
    s,
    "export { installPostGameFlow, upgradePostGameOverlay, scorecardRows };",
    "export { installPostGameFlow, upgradePostGameOverlay, scorecardRows, openGameScorecardDialog };",
    'scorecard export'
)
write(path, s)

# 5) Legacy leaderboard GAME SCORES entry point delegates to the shared modern component.
path = 'src/game/engine.js'
s = read(path)
anchor = """function openGameScoresDialog() {
  if (!state.match || !Array.isArray(state.match.history) || !state.match.history.length) {
"""
delegate = """function openGameScoresDialog() {
  try {
    if (typeof window.__sqOpenGameScorecardDialog === 'function' && window.__sqOpenGameScorecardDialog()) return;
  } catch (err) {
    try { console.warn('[SC-047] modern Game Scorecard unavailable; using legacy fallback', err); } catch (_) {}
  }

  if (!state.match || !Array.isArray(state.match.history) || !state.match.history.length) {
"""
s = replace_once(s, anchor, delegate, 'engine game scorecard delegation')
s = replace_once(
    s,
    '// ROUND SCORE (score) -> (if round completes: ROUND <n> COMPLETE -> NEXT UP.. <next target> -> <player> TO THROW FIRST)',
    '// ROUND SCORE (score) -> (if round completes: ROUND <n> COMPLETE -> NEXT UP / <next target> -> <player> TO THROW)',
    'engine Stage 3 NEXT UP comment'
)
write(path, s)

# 6) Intentional legacy patch evidence.
manifest_path = ROOT / 'src/legacy/intentional-patches.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
meta = {
  'src/legacy/scripts/inline-007.js': {
    'task':'SC-047 post-game DMD pulse correction',
    'reason':'Replace the scrolling GAME OVER marquee with a centred slow-breathing DMD scene while preserving the existing renderer API and interruption boundary.',
    'protectedBehaviour':'Presentation only. Scoring, game rules, player order, mode routing, persistence, rankings, XP and Supabase data/schema/RLS are unchanged.'
  },
  'src/legacy/scripts/inline-045.js': {
    'task':'SC-047 Match Leaderboard action cleanup',
    'reason':'Stop relocating the obsolete STATS control into the Match Leaderboard action stack, matching the approved post-game flow.',
    'protectedBehaviour':'Leaderboard navigation, NEXT GAME, GAME SCORES, END MATCH confirmation, scoring, persistence and match lifecycle remain unchanged.'
  }
}
for file, vals in meta.items():
    p = ROOT / file
    raw = p.read_bytes()
    hit = False
    for item in manifest.get('patches', []):
        if item.get('file') == file:
            item['sha256'] = hashlib.sha256(raw).hexdigest()
            item['bytes'] = len(raw)
            item.update(vals)
            hit = True
            break
    if not hit:
        raise SystemExit(f'intentional patch entry missing for {file}')
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

# 7) Focused static acceptance.
write('tools/ui-smoke/verify-sc047-postgame-corrective.mjs', """import fs from 'node:fs';
import assert from 'node:assert/strict';

const state = fs.readFileSync('src/app/state.js','utf8');
const engine = fs.readFileSync('src/game/engine.js','utf8');
const renderer = fs.readFileSync('src/legacy/scripts/inline-007.js','utf8');
const fix170 = fs.readFileSync('src/legacy/scripts/inline-045.js','utf8');
const postgame = fs.readFileSync('src/live-game/postgame-flow.mjs','utf8');

assert.match(state, /GAME OVER[\\s\\S]{0,160}type:'pulseCenter'/, 'Game Complete must emit centred pulseCenter GAME OVER');
assert.doesNotMatch(state, /GAME OVER[\\s\\S]{0,160}type:'marqueeFull'/, 'Game Complete must not emit scrolling marqueeFull');
assert.match(renderer, /active\\.type === 'pulseCenter'/, 'DMD renderer missing pulseCenter');
assert.doesNotMatch(fix170, /appendChild\\(statsFinal\\)/, 'Leaderboard must not relocate STATS into actions');
assert.match(fix170, /statsFinal\\.style\\.display = 'none'/, 'Leaderboard STATS must be hidden');
assert.match(postgame, /function openGameScorecardDialog/, 'shared Game Scorecard dialog missing');
assert.match(postgame, /buildScorecard\\(modal, st\\)/, 'Leaderboard Game Scores must reuse the post-game scorecard builder');
assert.match(postgame, /__sqOpenGameScorecardDialog = openGameScorecardDialog/, 'scorecard dialog hook missing');
assert.match(engine, /__sqOpenGameScorecardDialog/, 'legacy Game Scores entry point does not delegate to modern scorecard');
assert.match(engine, /z2:'NEXT UP', z3:String\\(nextLbl \\|\\| ''\\)\\.toUpperCase\\(\\)/, 'NEXT UP / target two-row contract missing');
assert.doesNotMatch(engine, /NEXT UP\\.\\./, 'old NEXT UP ellipsis remains');
console.log('SC-047 POST-GAME CORRECTIVE STATIC: ALL PASS');
""")

# 8) Browser acceptance.
write('tools/ui-smoke/verify-sc047-postgame-corrective.js', """const assert = require('node:assert/strict');
const H = require('./harness');
const fs = require('fs');
const path = require('path');

(async()=>{
  const launched=await H.launch({width:390,height:844});
  const browser=launched.browser, page=launched.page, consoleErrs=launched.consoleErrs;
  try{
    await H.boot(page,{settle:2600});
    await page.waitForFunction(()=>typeof window.openGameCompleteDialog==='function' && typeof window.showLeaderboard==='function' && typeof window.sqDmdShowZones==='function');

    await page.evaluate(()=>{
      const mkRounds=(base)=>Array.from({length:14},(_,i)=>({
        darts:[{kind:'S',sector:10,points:i===0?base:0},{kind:'Miss',points:0},{kind:'Miss',points:0}],
        roundTotal:i===0?base:0
      }));
      state.players=[
        {id:'p1',name:'Test One',initials:'T1',color:'#64d8ff'},
        {id:'p2',name:'Test Two',initials:'T2',color:'#7be0a0'}
      ];
      state.score=[mkRounds(105),mkRounds(204)];
      state.currentRound=13; state.currentPlayer=1; state.currentDart=0;
      state.finished=true; state.gameAwarded=false; state.history=[];
      state.match={id:'sc047',targetWins:3,gameNumber:2,wins:[0,1],completedLogged:false,history:[{totals:[105,204],board:[mkRounds(105),mkRounds(204)]}]};
      window.__sc047Writes=[];
      const original=window.sqDmdShowZones;
      window.sqDmdShowZones=function(z,o){
        window.__sc047Writes.push({z2:String((z&&z.z2)||''),z3:String((z&&z.z3)||''),type:String((o&&o.type)||'')});
        return original.apply(this,arguments);
      };
      openGameCompleteDialog();
    });

    await page.waitForSelector('.sq-gamecomplete-backdrop');
    await page.waitForSelector('.sq-gamecomplete-backdrop .sq-pg-scorecard');
    const gameOver=await page.evaluate(()=>window.__sc047Writes.find(x=>x.z2==='GAME OVER'));
    assert(gameOver,'GAME OVER write missing');
    assert.equal(gameOver.type,'pulseCenter','GAME OVER must use pulseCenter');

    await page.click('.sq-gamecomplete-backdrop .sq-pg-next');
    await page.waitForFunction(()=>!document.querySelector('.sq-gamecomplete-backdrop .sq-pg-scorecard').hidden);
    const endCard=await page.evaluate(()=>({
      title:document.querySelector('.sq-gamecomplete-backdrop .sq-pg-scorecard-title')?.textContent.trim(),
      head:Array.from(document.querySelectorAll('.sq-gamecomplete-backdrop .sq-pg-score-head span')).map(n=>n.textContent.trim()),
      rows:Array.from(document.querySelectorAll('.sq-gamecomplete-backdrop .sq-pg-score-row')).map(n=>n.innerText.replace(/\\s+/g,' ').trim())
    }));

    await page.evaluate(()=>document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(n=>n.remove()));
    await page.evaluate(()=>showLeaderboard());
    await page.waitForFunction(()=>document.body.dataset.page==='leaderboard');

    const stats=await page.evaluate(()=>{
      const el=document.getElementById('statsHubBtnFinal');
      const stack=document.querySelector('#leaderboard .stacked-actions');
      return {inStack:!!(el&&stack&&stack.contains(el)),visible:!!(el&&getComputedStyle(el).display!=='none'&&!el.classList.contains('hidden'))};
    });
    assert.equal(stats.inStack,false,'STATS remains in Match Leaderboard action stack');
    assert.equal(stats.visible,false,'STATS remains visible on Match Leaderboard');

    await page.click('#gameScoresBtn');
    await page.waitForSelector('.sq-pg-scorecard-backdrop .sq-pg-scorecard');
    const lbCard=await page.evaluate(()=>({
      title:document.querySelector('.sq-pg-scorecard-backdrop .sq-pg-scorecard-title')?.textContent.trim(),
      head:Array.from(document.querySelectorAll('.sq-pg-scorecard-backdrop .sq-pg-score-head span')).map(n=>n.textContent.trim()),
      rows:Array.from(document.querySelectorAll('.sq-pg-scorecard-backdrop .sq-pg-score-row')).map(n=>n.innerText.replace(/\\s+/g,' ').trim()),
      legacyTables:document.querySelectorAll('.sq-pg-scorecard-backdrop table.hs-table').length
    }));
    assert.deepEqual(lbCard.title,endCard.title,'Leaderboard Game Scores title differs from post-game scorecard');
    assert.deepEqual(lbCard.head,endCard.head,'Leaderboard Game Scores headers differ from post-game scorecard');
    assert.deepEqual(lbCard.rows,endCard.rows,'Leaderboard Game Scores rows differ from post-game scorecard');
    assert.equal(lbCard.legacyTables,0,'legacy round-by-round hs-table still rendered');

    await page.evaluate(()=>document.querySelectorAll('.sq-pg-scorecard-backdrop').forEach(n=>n.remove()));

    const pulse=await page.evaluate(()=>new Promise(resolve=>{
      window.__sqDmdHardClearQueue?.();
      window.sqDmdStop?.();
      const c=document.getElementById('sqDmdCanvas');
      const samples=[];
      const started=performance.now();
      window.sqDmdShowZones({z2:'GAME OVER',z3:''},{type:'pulseCenter',ms:5000});
      function metric(){
        const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;
        let minX=c.width,maxX=-1,minY=c.height,maxY=-1,lit=0;
        for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
          const i=(y*c.width+x)*4,r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
          if(a>80&&r>110&&g>45&&b<130&&r>g*1.18){lit++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
        }
        return {lit:lit,x:minX,w:maxX>=0?maxX-minX+1:0,h:maxY>=0?maxY-minY+1:0,cx:maxX>=0?(minX+maxX)/2:0,canvasW:c.width};
      }
      function tick(){
        const age=performance.now()-started;
        if(samples.length===0&&age>=180)samples.push(metric());
        if(samples.length===1&&age>=780){samples.push(metric());resolve(samples);return;}
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
    assert.equal(pulse.length,2,'pulse samples missing');
    for(const m of pulse){
      assert(m.lit>20,'GAME OVER pulse is not visible');
      assert(Math.abs(m.cx-m.canvasW/2)<m.canvasW*0.06,'GAME OVER is not centred');
    }
    assert(Math.abs(pulse[0].cx-pulse[1].cx)<pulse[0].canvasW*0.025,'GAME OVER drifts laterally');
    assert(Math.abs(pulse[0].w-pulse[1].w)>2,'GAME OVER does not visibly breathe/pulse');

    const out=process.env.SQ_SCREENSHOTS||path.join(process.cwd(),'qa-artifacts-sc047');
    fs.mkdirSync(out,{recursive:true});
    await page.locator('#sqDmdWrap').screenshot({path:path.join(out,'sc047-game-over-pulse.png')});

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],unexpected.join('\\n'));
    console.log('SC-047 POST-GAME CORRECTIVE RUNTIME: ALL PASS');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
""")

print('SC-047 patch applied')
