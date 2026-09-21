const H = require('./harness');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
const meta = JSON.parse(fs.readFileSync(path.join(__dirname,'../../assets/release-metadata.json'),'utf8'));

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page,{settle:1200});
    const button=page.locator('#sqReleaseVersionBtn');
    await button.waitFor({state:'visible'});
    assert.equal((await button.textContent()).trim(),'v'+meta.currentVersion);

    for (const width of [320,390,430]){
      await page.setViewportSize({width,height:844});
      await button.click();
      const modal=page.locator('.sq-release-notes-modal');
      await modal.waitFor({state:'visible'});

      const state=await page.evaluate(()=>{
        const modal=document.querySelector('.sq-release-notes-modal');
        const body=modal && modal.querySelector('.sq-release-notes-body');
        const entries=body ? [...body.querySelectorAll('.sq-release-entry')] : [];
        const rect=modal && modal.getBoundingClientRect();
        return {
          title:modal && modal.querySelector('.menu-modal-title-text')?.textContent?.trim(),
          sub:modal && modal.querySelector('.menu-modal-title-sub')?.textContent?.trim(),
          entries:entries.length,
          firstId:entries[0]?.querySelector('.sq-release-id')?.textContent?.trim(),
          scrollable:!!body && body.scrollHeight > body.clientHeight,
          fits:!!rect && rect.left >= -0.5 && rect.right <= innerWidth + 0.5,
          overflow:document.documentElement.scrollWidth > innerWidth + 1
        };
      });

      assert.equal(state.title,'RELEASE NOTES');
      assert.equal(state.sub,'CURRENT v'+meta.currentVersion);
      assert.equal(state.entries,meta.releases.length);
      assert.equal(state.firstId,'v'+meta.currentVersion);
      assert(state.scrollable,width+'px release body scrolls internally');
      assert(state.fits,width+'px modal fits viewport');
      assert.equal(state.overflow,false,width+'px no horizontal document overflow');

      if (process.env.SQ_SCREENSHOTS){
        fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'sc050-release-notes-'+width+'.png'),fullPage:false});
      }

      await modal.locator('button[aria-label="Back"]').click();
      await modal.waitFor({state:'detached'});

      await button.click();
      const reopened=page.locator('.sq-release-notes-modal');
      await reopened.waitFor({state:'visible'});
      await reopened.locator('.modal-footer button').filter({hasText:/^CLOSE$/}).click();
      await reopened.waitFor({state:'detached'});
    }

    const unexpected=consoleErrs.filter((msg)=>!BROWSER_NOISE.test(msg));
    assert.deepEqual(unexpected,[]);
    console.log('SC-050 release notes runtime PASS at 320/390/430px');
  } finally {
    await browser.close();
  }
})().catch((error)=>{ console.error(error); process.exit(1); });
