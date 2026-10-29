const assert=require('node:assert/strict');
const H=require('./harness');
(async()=>{
 const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
 try{
  await H.boot(page); await H.toMatchCard(page); await H.addGuests(page,['ALPHA','BETA']); await H.startMatch(page);
  // The existing prethrow controller is installed on the first canonical throw.
  await page.evaluate(()=>{recordThrow({kind:'S',sector:10});undo();});
  await page.waitForFunction(()=>typeof window.__sqDmdStartPreThrow==='function');
  await page.evaluate(()=>{
   const start=performance.now(); Date.now=()=>Date.parse('2026-11-01T12:00:00Z')+performance.now()-start;
   document.dispatchEvent(new Event('visibilitychange')); window.__dmdSeasonalWrites=[];
   const original=window.sqDmdShowZones;
   window.sqDmdShowZones=function(z,o){window.__dmdSeasonalWrites.push({z2:String(z?.z2||''),z3:String(z?.z3||'')});return original.apply(this,arguments);};
   window.__sqDmdShowTurnIntro(true);
  });
  let r=await page.evaluate(()=>({writes:window.__dmdSeasonalWrites.slice(),alias:window.__sqHalloweenNickname(state.players[0]),epithet:window.__sqHalloweenEpithet(state.players[0]).toUpperCase(),player:state.players[0].name,slides:__sqV3IdleSlides()}));
  assert(r.writes.some(w=>w.z2.trim()===r.alias&&w.z3==='TO THROW FIRST'),'first turn announces seasonal alias');
  assert.equal(r.player,'ALPHA'); assert(r.slides.some(s=>s.lab==='HALLOWEEN'&&s.val===r.epithet),'V3 idle offers seasonal nickname');
  await page.waitForTimeout(950);
  assert.equal((await page.evaluate(()=>window.__sqDmdPinnedZ2Text)).trim(),r.alias,'prethrow display retains seasonal alias');
  await page.evaluate(()=>{const start=performance.now();Date.now=()=>Date.parse('2026-11-02T00:00:00Z')+performance.now()-start;document.dispatchEvent(new Event('visibilitychange'));});
  const expired=await page.evaluate(()=>({pinned:window.__sqDmdPinnedZ2Text, slides:__sqV3IdleSlides(),player:state.players[0].name}));
  assert.equal(expired.pinned,'ALPHA','prethrow pin restores original at expiry');assert(!expired.slides.some(s=>s.lab==='HALLOWEEN'));assert.equal(expired.player,'ALPHA');
  // A delayed first-turn callback must re-read the window, not resurrect an expired alias.
  await page.evaluate(()=>{
   const start=performance.now();Date.now=()=>Date.parse('2026-11-01T12:00:00Z')+performance.now()-start;
   document.dispatchEvent(new Event('visibilitychange'));window.__sqDmdShowTurnIntro(true);
   Date.now=()=>Date.parse('2026-11-02T00:00:00Z')+performance.now()-start;document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(950);
  assert.equal(await page.evaluate(()=>window.__sqDmdPinnedZ2Text),'ALPHA','delayed intro cannot resurrect expired alias');
  await page.evaluate(()=>{
   const start=performance.now();Date.now=()=>Date.parse('2026-11-01T12:00:00Z')+performance.now()-start;
   document.dispatchEvent(new Event('visibilitychange'));window.__dmdSeasonalWrites=[];
   recordThrow({kind:'S',sector:10});recordThrow({kind:'S',sector:10});recordThrow({kind:'S',sector:10});
  });
  const nextAlias=await page.evaluate(()=>window.__sqHalloweenNickname(state.players[1]));
  await page.waitForFunction(alias=>window.__dmdSeasonalWrites.some(w=>w.z2.trim()===alias&&w.z3==='TO THROW'),nextAlias,{timeout:12000});
  assert.equal(await page.evaluate(()=>state.players[1].name),'BETA','handoff does not change identity');
  assert.equal(consoleErrs.filter(x=>x.startsWith('pageerror:')).length,0);
  console.log('PASS seasonal DMD intro, handoff, pinned expiry, delayed cancellation, V3 idle and unchanged players');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
