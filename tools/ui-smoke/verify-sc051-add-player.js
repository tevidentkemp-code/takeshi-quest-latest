const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');

(async () => {
  const { browser, page, consoleErrs } = await H.launch();
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await page.evaluate(() => {
      window.__sc051Rows = Array.from({length:24}, (_,i) => ({
        id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
        name:'UI PLAYER '+String(i+1).padStart(2,'0'),
        first_name:'UI', last_name:'PLAYER '+String(i+1).padStart(2,'0'),
        nickname:i===23?'Long nickname <still a name> & friends':'',
        initials:'UP', avatar_id:i===23?29:i+1
      }));
      window.cloudListPlayers=async()=>window.__sc051Rows;
    });
    await page.locator('#msAddRegisteredBtn').tap();
    await page.waitForSelector('#spPlayerList .sp2-row');
    const reference = await page.evaluate(() => {
      const row=document.querySelector('#spPlayerList .sp2-row');
      const cs=getComputedStyle(row), nm=getComputedStyle(row.querySelector('.ms2-nm'));
      return {background:cs.backgroundColor,border:cs.borderColor,radius:cs.borderRadius,font:nm.fontSize};
    });
    await page.locator('#cancelSelectPlayerBtn').tap();
    await H.addGuests(page,['ALPHA','BETA']);
    await H.startMatch(page,3);
    await page.evaluate(() => {
      recordThrow({kind:'S'});
      window.__sc051Base=JSON.stringify(state);
    });

    const reset = async () => page.evaluate(() => {
      state=JSON.parse(window.__sc051Base);
      window.cloudListPlayers=async()=>window.__sc051Rows;
      save(); updateUI();
    });
    const open = async () => {
      await page.evaluate(()=>window.__sqOpenGameMenu106());
      await page.locator('.sq-menu106-row').filter({hasText:'Add Player'}).first().tap();
      await page.waitForSelector('.sq-add-player-modal');
    };
    const chooseSaved = async () => {
      await page.locator('.sq-add-player-modal .sq-menu106-row').filter({hasText:'UI PLAYER 24'}).tap();
      await page.waitForSelector('.sq-confirm-bd .sq-endmatch-yes');
    };
    const confirm = async yes => page.locator('.sq-confirm-bd '+(yes?'.sq-endmatch-yes':'.sq-endmatch-no')).tap();
    const protectedState = async () => page.evaluate(()=>JSON.stringify({players:state.players,score:state.score,history:state.history,match:state.match,currentRound:state.currentRound,currentPlayer:state.currentPlayer,currentDart:state.currentDart}));
    const header = async () => {
      const result=await page.evaluate(() => {
        const m=document.querySelector('.sq-add-player-modal'),r=m.getBoundingClientRect();
        return {inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,
          buttons:Array.from(m.querySelectorAll('.sq-menu106-back,.sq-menu106-x,.sq-menu106-close')).map(b=>{
            const br=b.getBoundingClientRect(),hr=b.parentElement.getBoundingClientRect();
            return br.width>=44&&br.height>=44&&br.top>=hr.top&&br.bottom<=hr.bottom;
          })};
      });
      assert(result.inside&&result.buttons.every(Boolean),'Back and Close have visible 44px targets inside the viewport');
    };
    const screenshot = async (name,width) => {
      if(!process.env.SQ_SCREENSHOTS) return;
      fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,`sc051-${name}-${width}.png`)});
    };

    for(const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      await page.emulateMedia({reducedMotion:width===390?'reduce':'no-preference'});
      await reset();
      // Guest stays available during discovery; late resolution must not replace its form.
      await page.evaluate(()=>{window.cloudListPlayers=()=>new Promise(resolve=>window.__sc051Resolve=resolve);});
      await open();
      assert(await page.locator('.sq-add-player-loading').isVisible(),'honest discovery loading state');
      await header();
      await page.locator('.sq-add-player-modal .sq-menu106-row').filter({hasText:'Guest Player'}).tap();
      await page.locator('#sqLateGuestName').waitFor();
      await page.evaluate(()=>window.__sc051Resolve(window.__sc051Rows));
      assert.equal(await page.locator('.sq-add-player-modal .sq-menu106-row').count(),0,'detached chooser cannot overwrite the guest form');
      await header();
      assert.equal(await page.locator('#sqLateGuestName').evaluate(n=>n.getBoundingClientRect().height),44,'guest input shares the setup field size');
      const guest='GUEST '+width;
      await page.locator('#sqLateGuestName').fill(guest);
      await screenshot('guest',width);
      await page.locator('.sq-add-player-modal .np-save').tap();
      assert.equal(await page.evaluate(()=>state.players.length),2,'guest awaits confirmation');
      await confirm(false);
      assert.equal(await page.locator('#sqLateGuestName').inputValue(),guest,'guest confirmation Cancel retains the entered name');
      await page.locator('.sq-add-player-modal .np-save').tap();
      await confirm(true);
      assert.equal(await page.evaluate(()=>state.players.at(-1).name),guest,'confirmed guest joins as final thrower');
      assert(await page.evaluate(()=>JSON.stringify(state.score[0][0])===JSON.stringify(JSON.parse(window.__sc051Base).score[0][0])),'guest addition preserves incumbent scored darts');

      await reset();
      await open();
      await page.waitForFunction(()=>document.querySelectorAll('.sq-add-player-modal .sq-menu106-row').length===25);
      await header();
      const layout=await page.evaluate(() => {
        const m=document.querySelector('.sq-add-player-modal'),body=m.querySelector('.sq-menu106-body');
        const row=Array.from(body.querySelectorAll('.sq-menu106-row')).find(n=>n.textContent.includes('UI PLAYER 24'));
        const cs=getComputedStyle(row),nm=getComputedStyle(row.querySelector('.ms2-nm'));
        return {background:cs.backgroundColor,border:cs.borderColor,radius:cs.borderRadius,font:nm.fontSize,
          avatar:row.querySelector('.ms2-ava')?.dataset.avatarId,
          literal:row.textContent.includes('<STILL A NAME>'),injected:!!row.querySelector('still'),
          scroll:body.scrollHeight>body.clientHeight&&getComputedStyle(body).overflowY==='auto'};
      });
      assert.equal(layout.background,reference.background,'late chooser uses setup row surface');
      assert.equal(layout.border,reference.border,'late chooser uses setup row border');
      assert.equal(layout.radius,reference.radius,'late chooser uses setup row corners');
      assert.equal(layout.font,reference.font,'late chooser uses setup name size');
      assert.equal(layout.avatar,'29','saved row retains its canonical avatar');
      assert(layout.literal&&!layout.injected&&layout.scroll,'long nickname remains literal text and list scrolls internally');
      // Safari on macOS uses Option-Tab for control navigation (Apple cpsh003).
      // Unchanged production also skips button-only dialogs with plain Tab.
      const optionTab=process.env.SQ_BROWSER==='webkit'&&process.platform==='darwin';
      const tab=optionTab?'Alt+Tab':'Tab';
      await page.keyboard.press(tab);
      const focus=await page.evaluate(()=>({inside:document.querySelector('.sq-add-player-modal').contains(document.activeElement),active:document.activeElement.outerHTML.slice(0,180),top:window.__sqModalStack?.at(-1)?.modal?.className}));
      assert(focus.inside,'keyboard focus stays in the chooser: '+JSON.stringify(focus));
      await page.locator('.sq-add-player-modal .sq-menu106-back').focus();
      await page.keyboard.press(optionTab?'Alt+Shift+Tab':'Shift+Tab');
      assert(await page.locator('.sq-add-player-modal .sq-menu106-close').evaluate(n=>n===document.activeElement),'reverse keyboard navigation wraps to Close');
      await page.keyboard.press(tab);
      assert(await page.locator('.sq-add-player-modal .sq-menu106-back').evaluate(n=>n===document.activeElement),'forward keyboard navigation wraps to Back');
      await screenshot('saved',width);
      await page.locator('.sq-add-player-modal .sq-menu106-row').filter({hasText:'UI PLAYER 24'}).scrollIntoViewIfNeeded();
      await screenshot('saved-long',width);
      await chooseSaved();
      assert.equal(await page.evaluate(()=>state.players.length),2,'saved choice awaits confirmation');
      assert.equal(await page.locator('.sq-menu106-bd').count(),0,'chooser closes before confirmation');
      assert((await page.locator('.sq-confirm-bd .modal-body').textContent()).includes('<still a name>'),'confirmation retains the full literal nickname');
      await confirm(false);
      await chooseSaved();
      await confirm(true);
      assert(await page.evaluate(()=>{
        const p=state.players.at(-1),expected=window.__sc051Rows[23];
        return ['id','name','first_name','last_name','nickname','initials','avatar_id'].every(k=>p[k]===expected[k])&&state.players.length===3;
      }),'confirmed saved choice preserves UUID, avatar and full identity as final thrower');

      await reset(); await open(); await chooseSaved();
      await page.evaluate(()=>{state.currentRound=7;state.currentPlayer=0;state.currentDart=0;recordThrow({kind:'Miss'});});
      const atCutoff=await protectedState();
      await confirm(true);
      assert.equal(await protectedState(),atCutoff,'stale confirmation after first17s cannot mutate roster or scored state');

      await reset();
      await page.evaluate(()=>{window.__sqAppendLatePlayer({name:'THREE'},'guest');window.__sqAppendLatePlayer({name:'FOUR'},'guest');});
      await open(); await chooseSaved();
      await page.evaluate(()=>window.__sqAppendLatePlayer({name:'FIVE'},'guest'));
      const atCap=await protectedState();
      await confirm(true);
      assert.equal(await protectedState(),atCap,'stale confirmation cannot append a sixth player');

      await reset();
      await page.evaluate(()=>{window.cloudListPlayers=async()=>{throw new Error('SC051 fixture unavailable');};});
      await open();
      await page.waitForFunction(()=>document.querySelector('.sq-add-player-modal')?.textContent.includes('Registered players unavailable'));
      await page.locator('.sq-add-player-modal .sq-menu106-row').filter({hasText:'Guest Player'}).tap();
      await page.locator('#sqLateGuestName').waitFor();
      await page.locator('.sq-add-player-modal .sq-menu106-back').tap();
      await page.locator('.sq-add-player-modal .sq-menu106-close').tap();
      assert.equal(await page.locator('.sq-menu106-bd').count(),0,'Guest remains usable after failure; Back and Close dismiss correctly');
      console.log(`PASS SC-051 ${width}: shared presentation, touch/focus, loading/failure, guest/saved confirmation, identity and stale cutoff/cap`);
    }
    assert(!consoleErrs.some(e=>e.startsWith('pageerror:')),'no uncaught browser errors');
    console.log('SC-051 ADD PLAYER PRESENTATION: PASS');
  } finally { await browser.close(); }
})().catch(err=>{console.error(err.stack||err);process.exit(1);});
