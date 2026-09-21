const assert=require('node:assert/strict');
const H=require('./harness');

const BROWSER_NOISE=/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await page.waitForFunction(()=>window.__sqReleaseInfo && document.getElementById('sqReleaseBadge'));

    for (const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      await page.waitForTimeout(80);
      const snap=await page.evaluate(()=>{
        const badge=document.getElementById('sqReleaseBadge');
        const hero=document.querySelector('#details .home-arcade-hero');
        const start=document.getElementById('startGameBtn');
        const br=badge.getBoundingClientRect();
        const hr=hero.getBoundingClientRect();
        return {
          version:window.__sqReleaseInfo.version,
          badgeText:badge.textContent.replace(/\s+/g,' ').trim(),
          dataset:badge.dataset.version,
          badgeVisible:!!(badge.offsetWidth&&badge.offsetHeight),
          badgeInHero:br.left>=hr.left-1&&br.right<=hr.right+1&&br.top>=hr.top-1&&br.bottom<=hr.bottom+1,
          pageFits:document.documentElement.scrollWidth<=innerWidth+1,
          startVisible:!!(start&&start.offsetWidth&&start.offsetHeight),
          startLabel:start?start.textContent.replace(/\s+/g,' ').trim():'',
        };
      });
      assert.equal(snap.version,'2026.09.21.1');
      assert.equal(snap.dataset,'2026.09.21.1');
      assert.equal(snap.badgeText,'v2026.09.21.1 ▾');
      assert.equal(snap.badgeVisible,true,`badge hidden at ${width}px`);
      assert.equal(snap.badgeInHero,true,`badge leaves hero at ${width}px`);
      assert.equal(snap.pageFits,true,`Home overflows horizontally at ${width}px`);
      assert.equal(snap.startVisible,true,`Start Game hidden at ${width}px`);
      assert(/START GAME/i.test(snap.startLabel),`Start Game label changed at ${width}px`);
    }

    await page.setViewportSize({width:390,height:844});
    await page.click('#sqReleaseBadge');
    await page.waitForSelector('#sqReleaseNotesOverlay .sq-release-modal');
    const modal=await page.evaluate(()=>{
      const overlay=document.getElementById('sqReleaseNotesOverlay');
      const body=overlay.querySelector('.sq-release-body');
      return {
        title:(overlay.querySelector('.sq-release-title')||{}).textContent,
        current:(overlay.querySelector('.sq-release-current')||{}).textContent,
        firstVersion:(overlay.querySelector('.sq-release-version')||{}).textContent,
        text:body.textContent,
        overflowY:getComputedStyle(body).overflowY,
        back:[...overlay.querySelectorAll('.sq-release-foot button')].find(x=>x.textContent.trim()==='Back')?.textContent,
        close:[...overlay.querySelectorAll('.sq-release-foot button')].find(x=>x.textContent.trim()==='Close')?.textContent,
      };
    });
    assert.equal(modal.title,'Release Notes');
    assert.equal(modal.current,'CURRENT · v2026.09.21.1');
    assert.equal(modal.firstVersion,'v2026.09.21.1');
    assert(/Volde-D’eux/.test(modal.text));
    assert(/DMD commentary/.test(modal.text));
    assert(['auto','scroll'].includes(modal.overflowY),'Release Notes body must be scrollable');
    assert.equal(modal.back,'Back');
    assert.equal(modal.close,'Close');

    await page.click('#sqReleaseNotesOverlay .sq-release-foot button:first-child');
    await page.waitForFunction(()=>!document.getElementById('sqReleaseNotesOverlay'));
    await page.click('#sqReleaseBadge');
    await page.waitForSelector('#sqReleaseNotesOverlay');
    await page.click('#sqReleaseNotesOverlay .sq-release-foot button:last-child');
    await page.waitForFunction(()=>!document.getElementById('sqReleaseNotesOverlay'));

    const unexpected=consoleErrs.filter(e=>!BROWSER_NOISE.test(e));
    assert.deepEqual(unexpected,[],'unexpected browser errors: '+unexpected.join('\n'));
    console.log('SC-050 release badge + Release Notes browser acceptance PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
