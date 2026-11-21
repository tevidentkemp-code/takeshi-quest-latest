const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./harness');

(async()=>{
  const {browser,ctx,page,consoleErrs}=await H.launch({width:1440,height:810},{emptyCloudReads:true});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['ALPHA','BETA']);
    await H.startMatch(page,3);
    await page.evaluate(()=>{
      window.__v2PBWRSnapshot={__ts:Date.now(),wrByRound:new Map([['10',30]]),
        pbByBucket:new Map([['alpha',new Map([['10',20]])]])};
      window.__sqOpenGameMenu106();
    });
    await page.locator('.sq-menu106-bd').getByText(/TV Mode/i).first().click();
    const tv=page.frameLocator('#sqTvModeOverlay iframe');
    const key=label=>tv.locator('[data-dart="'+label+'"]');
    await key('Double').waitFor();
    assert.equal(await tv.locator('.round-table tbody tr').count(),2);
    assert.equal(await tv.locator('.hit-tile').count(),3);
    const view=page.frames().find(f=>f.url().includes('/assets/tv/arcade.html'));
    assert.deepEqual(await view.evaluate(()=>[state.records.world[0],state.records.world[1],
      ...state.records.personal.map(row=>row[0])]),[30,null,null,null]);
    const currentName=()=>page.evaluate(()=>getPlayerName(state.currentPlayer).toUpperCase());
    const names=await tv.locator('.round-table .name').allTextContents();
    assert.deepEqual(names.map(n=>n.toUpperCase()),await page.evaluate(()=>state.players.map((_,i)=>getPlayerName(i).toUpperCase())));
    const spectatorPage=ctx.waitForEvent('page');
    await page.locator('#sqTvWatch').click();
    const watcher=await spectatorPage;
    await watcher.locator('.running-total').first().waitFor();
    assert.equal(await watcher.locator('.scorepad').count(),0);
    const settings=tv.getByRole('button',{name:'Settings'});
    assert.equal(await watcher.getByRole('button',{name:'Settings'}).count(),0);
    await settings.click();
    const menu=page.locator('.sq-menu106-bd');
    await menu.getByText('Match Display',{exact:true}).click();
    await menu.getByRole('button',{name:'Back'}).click();
    await menu.locator('.sq-menu106-close').click();
    await page.waitForFunction(()=>document.querySelector('#sqTvModeOverlay iframe').contentDocument.activeElement?.classList.contains('tv-settings'));
    assert.equal(await tv.getByRole('button',{name:/Miss ×/}).count(),0);
    await tv.getByRole('button',{name:'Skip Go'}).click();
    assert.equal(await page.evaluate(()=>state.history.at(-1)?.type),'absenceSkip');
    await tv.getByRole('button',{name:'Undo'}).click();
    assert.equal(await page.evaluate(()=>state.history.length),0);
    await key('Double').click();
    await watcher.getByText('D10',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>state.history.length),1);
    assert.equal(await tv.locator('.running-total').first().textContent(),'20');
    await watcher.reload();
    await watcher.getByText('D10',{exact:true}).waitFor();
    await tv.locator('[data-action="undo"]').click();
    await page.waitForFunction(()=>state.history.length===0);
    await watcher.waitForFunction(()=>document.querySelector('.running-total')?.textContent==='0');
    const miss=key('Miss');
    const box=await miss.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.waitForFunction(()=>state.history.at(-1)?.throw?.bounceOut===true);
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>state.history.length),1);
    await miss.click();
    await page.waitForFunction(()=>state.history.length===2);
    await tv.locator('[data-action="skip"]').click();
    await page.waitForFunction(()=>state.history.length===3);
    assert.equal((await tv.locator('.thrower-identity:not(.departing-name) h2').textContent()).toUpperCase(),await currentName());
    const out=process.env.SQ_SCREENSHOTS||path.join(__dirname,'../../qa-artifacts/tv');
    fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'arcade-scoreboard.png')});
    const game=()=>page.evaluate(()=>JSON.stringify([state.score,state.history,state.currentPlayer,state.currentRound,state.currentDart]));
    const before=await game();
    await page.locator('#sqTvExit').click();
    await watcher.getByText('Waiting for the scorer to reopen TV mode').waitFor();
    assert.equal(before,await game());
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>window.__sqTvModeToggle(true));
    await key('Single').waitFor();
    await page.evaluate(()=>{for(let n=0;n<85&&state.currentRound<10;n++)recordThrow({kind:'Miss'});});
    await tv.getByRole('button',{name:'Skip Go'}).click();
    await page.evaluate(()=>{for(let n=0;n<3;n++)recordThrow({kind:'Miss'});});
    await key('Single').click();
    assert.deepEqual(await page.evaluate(()=>[state.history.at(-1).round,state.history.at(-1).throw.points]),[10,20]);
    await tv.getByRole('button',{name:'Undo'}).click();
    for (const [round,label,points] of [[11,'D16',32],[12,'T4',12],[13,'Inner 50',50]]) {
      await page.evaluate(r=>{
        for (let n=0;n<90 && !state.finished && state.currentRound<r;n++) recordThrow({kind:'Miss'});
      },round);
      await key(label).click();
      assert.equal(await page.evaluate(()=>state.history.at(-1).throw.points),points);
      await tv.locator('[data-action="undo"]').click();
      assert.equal(await page.evaluate(()=>state.currentDart),0);
    }
    assert.equal(await tv.locator('#screen').getAttribute('data-motion'),'off');
    const finalHistory=await page.evaluate(()=>{
      for(let n=0;n<90&&!state.finished;n++){
        if(state.currentRound===13&&state.currentPlayer===1&&state.currentDart===2)break;
        recordThrow({kind:'Miss'});
      }
      return state.history.length;
    });
    await key('Miss').click();
    await page.getByRole('dialog',{name:'Draw decider shootout'}).waitFor();
    await watcher.getByRole('heading',{name:'Tied for first'}).waitFor();
    await watcher.reload();
    await watcher.getByRole('heading',{name:'Tied for first'}).waitFor();
    await page.getByRole('button',{name:'Close decider'}).click();
    await page.getByRole('button',{name:'Undo final dart'}).click();
    await key('Inner 50').waitFor();
    assert.deepEqual(await page.evaluate(()=>[state.history.length,state.currentRound,state.currentDart]),[finalHistory,13,2]);
    await key('Inner 50').click();
    await watcher.getByRole('heading',{name:'Game winner'}).waitFor();
    assert.equal(await watcher.locator('.running-total').first().textContent(),'50');
    assert.deepEqual(consoleErrs.filter(x=>x.startsWith('pageerror:')),[]);
    console.log('PASS game menu, real throw, spectator refresh, Undo, bounce-out, Miss, handover, special rounds, reduced motion, tied finish and spectator reconnect');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
