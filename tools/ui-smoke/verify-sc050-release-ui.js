const assert = require('assert/strict');
const H = require('./harness');

(async () => {
  for (const viewport of [{width:320,height:844},{width:390,height:844},{width:430,height:844}]) {
    const {browser,page,consoleErrs} = await H.launch(viewport);
    try {
      await H.boot(page,{settle:1200});
      await page.waitForFunction(() => document.getElementById('sqReleaseVersionBtn')?.dataset.releaseVersion === '1.1.0');
      const button = await page.evaluate(() => {
        const b=document.getElementById('sqReleaseVersionBtn'), r=b.getBoundingClientRect();
        return {text:b.textContent.trim(),visible:!!b.offsetParent,width:r.width,height:r.height};
      });
      assert.equal(button.text,'v1.1.0');
      assert(button.visible);
      assert(button.height >= 43.5, viewport.width + 'px version tap target remains touch-safe');

      await page.click('#sqReleaseVersionBtn');
      await page.waitForSelector('#sqReleaseNotesModal .sq-release-modal');
      const layout = await page.evaluate(() => {
        const overlay=document.getElementById('sqReleaseNotesModal');
        const modal=overlay.querySelector('.sq-release-modal');
        const body=overlay.querySelector('.sq-release-body');
        const footer=overlay.querySelector('.sq-release-footer');
        const mr=modal.getBoundingClientRect(), fr=footer.getBoundingClientRect();
        return {
          cards:[...overlay.querySelectorAll('.sq-release-card')].map(x=>x.dataset.releaseVersion),
          current:overlay.querySelector('.sq-release-current')?.textContent || '',
          overflow:document.documentElement.scrollWidth > innerWidth + 1,
          modalFits:mr.left >= -1 && mr.right <= innerWidth + 1 && mr.top >= -1 && mr.bottom <= innerHeight + 1,
          footerVisible:fr.top >= mr.top && fr.bottom <= mr.bottom + 1,
          bodyScrollable:getComputedStyle(body).overflowY === 'auto'
        };
      });
      assert.deepEqual(layout.cards,['1.1.0','1.0.0']);
      assert.match(layout.current,/v1\.1\.0/);
      assert(!layout.overflow,viewport.width + 'px release UI has no horizontal overflow');
      assert(layout.modalFits,viewport.width + 'px release modal stays within viewport');
      assert(layout.footerVisible,viewport.width + 'px Back/Close footer remains visible');
      assert(layout.bodyScrollable,viewport.width + 'px notes body owns scrolling');

      await page.click('#sqReleaseNotesModal [data-release-action="back"]');
      await page.waitForFunction(() => !document.getElementById('sqReleaseNotesModal'));
      await page.click('#sqReleaseVersionBtn');
      await page.click('#sqReleaseNotesModal [data-release-action="close"]');
      await page.waitForFunction(() => !document.getElementById('sqReleaseNotesModal'));
      await page.click('#sqReleaseVersionBtn');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('sqReleaseNotesModal'));

      const unexpected = consoleErrs.filter(x => !/supabase|failed to fetch|networkerror|load resource|content security policy|connect-src/i.test(x));
      assert.deepEqual(unexpected,[],viewport.width + 'px unexpected console errors: ' + unexpected.join(' | '));
    } finally {
      await browser.close();
    }
  }
  console.log('SC-050 release UI PASS');
})().catch(err => { console.error(err); process.exit(1); });
