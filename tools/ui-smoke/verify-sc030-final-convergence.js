// SC-030 final visual convergence regression. Production data is blocked by the shared harness.
const H = require('./harness');
const assert = require('assert/strict');

(async()=>{
  const {browser,page,consoleErrs} = await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['FRAME ALPHA','FRAME BETA']);
    await H.startMatch(page);
    await page.waitForSelector('#liveV2Panel:not([hidden])');

    for (const size of [{width:320,height:844},{width:390,height:844},{width:430,height:932}]){
      await page.setViewportSize(size);
      await page.waitForTimeout(350);
      const ui = await page.evaluate(()=>{
        const panel=document.getElementById('liveV2Panel');
        const gameCell=panel.querySelector('.v2GameCell');
        const head=document.getElementById('floatHead');
        const top=document.getElementById('sqDmdTopBar');
        const bezel=document.getElementById('sqDmdWrap');
        const rect=el=>el.getBoundingClientRect();
        const css=el=>getComputedStyle(el);
        const ps=css(panel), hs=css(head), ts=css(top);
        return {
          overflow:document.documentElement.scrollWidth>innerWidth+1,
          panel:{
            border:[ps.borderTopWidth,ps.borderRightWidth,ps.borderBottomWidth,ps.borderLeftWidth],
            padding:[ps.paddingTop,ps.paddingRight,ps.paddingBottom,ps.paddingLeft],
            shadow:ps.boxShadow,
            backgroundImage:ps.backgroundImage,
            backgroundColor:ps.backgroundColor,
            width:rect(panel).width
          },
          gameWidth:rect(gameCell).width,
          head:{
            border:[hs.borderTopWidth,hs.borderRightWidth,hs.borderBottomWidth,hs.borderLeftWidth],
            shadow:hs.boxShadow
          },
          topPadding:[ts.paddingLeft,ts.paddingRight],
          dmdWidth:rect(bezel).width,
          headWidth:rect(head).width
        };
      });
      const zero = values => values.every(v => parseFloat(v) <= .1);
      assert(!ui.overflow, size.width+'px convergence has no horizontal overflow');
      assert(zero(ui.panel.border), size.width+'px Live V2 redundant outer border is removed');
      assert(zero(ui.panel.padding), size.width+'px Live V2 redundant outer padding is reclaimed');
      assert(ui.panel.shadow === 'none', size.width+'px Live V2 redundant outer shadow is removed');
      assert(ui.panel.backgroundImage === 'none' && ui.panel.backgroundColor === 'rgba(0, 0, 0, 0)', size.width+'px Live V2 outer shell is transparent');
      assert(ui.gameWidth >= ui.panel.width - 1.5, size.width+'px inner gameplay module receives reclaimed width');
      assert(zero(ui.head.border), size.width+'px redundant DMD host border is removed');
      assert(ui.head.shadow === 'none', size.width+'px redundant DMD host shadow is removed');
      assert(zero(ui.topPadding), size.width+'px DMD wrapper horizontal padding is removed');
      assert(ui.dmdWidth >= ui.headWidth - 1.5, size.width+'px single DMD bezel uses the available host width');
    }
    const unexpected=consoleErrs.filter(x=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(x));
    assert.deepEqual(unexpected,[],'no unexpected browser errors: '+unexpected.join('\n'));
    console.log('PASS SC-030 final shell convergence at 320/390/430');
  }finally{ await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
