const assert=require('node:assert/strict');
const H=require('./harness');
(async()=>{
 for (const width of [320,390,430]) {
  const {browser,page,consoleErrs}=await H.launch({width,height:844});
  try {
   await H.boot(page,{settle:1000});
   await page.evaluate(async()=>{
    Date.now=()=>Date.parse('2026-11-01T12:00:00Z'); document.dispatchEvent(new Event('visibilitychange'));
    const rows=[{name:'Alexandria Worthington-Smythe',player_id:'qa-1',total_xp:151,badges:2},{name:'Another Player',player_id:'qa-2',total_xp:100,badges:1}];
    window.SQ_XP.all=async()=>{window.SQ_XP._allAvailable=true;return rows;};
    window.openPlayerStatsDialog=(name)=>{window.__testOpenedName=name;};
    await window.openXpLeaderboard();
   });
   const labels=page.locator('.modal-backdrop .modal-body b[data-sq-halloween-original]');
   assert.equal(await labels.count(),2);
   const result=await labels.first().evaluate(el=>({text:el.textContent, expected:window.__sqHalloweenNickname({name:'Alexandria Worthington-Smythe',id:'qa-1'}),clipped:el.scrollWidth>el.clientWidth+1, rect:el.getBoundingClientRect().toJSON()}));
   assert.equal(result.text,result.expected); assert.equal(result.clipped,false,'XP leaderboard alias must fit');
   const btn=page.locator('.modal-backdrop .modal-body button[aria-label="Open Alexandria Worthington-Smythe"]');
   const box=await btn.boundingBox();assert(box&&box.width>0&&box.height>0&&box.x+box.width<=width,'profile control remains visible');
   await page.evaluate(()=>{Date.now=()=>Date.parse('2026-11-02T00:00:00Z');document.dispatchEvent(new Event('visibilitychange'));});
   assert.equal(await labels.first().textContent(),'Alexandria Worthington-Smythe');
   await btn.click();assert.equal(await page.evaluate(()=>window.__testOpenedName),'Alexandria Worthington-Smythe');
   assert.equal(consoleErrs.filter(x=>x.startsWith('pageerror:')).length,0);
   console.log('PASS XP leaderboard alias, fit, expiry, identity at',width);
  } finally {await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
