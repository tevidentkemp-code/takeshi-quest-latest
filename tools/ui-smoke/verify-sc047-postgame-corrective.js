const assert = require('node:assert/strict');
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
      rows:Array.from(document.querySelectorAll('.sq-gamecomplete-backdrop .sq-pg-score-row')).map(n=>n.innerText.replace(/\s+/g,' ').trim())
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
      rows:Array.from(document.querySelectorAll('.sq-pg-scorecard-backdrop .sq-pg-score-row')).map(n=>n.innerText.replace(/\s+/g,' ').trim()),
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

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected,[],unexpected.join('\n'));
    console.log('SC-047 POST-GAME CORRECTIVE RUNTIME: ALL PASS');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
