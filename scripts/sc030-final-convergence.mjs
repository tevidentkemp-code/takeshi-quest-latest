import fs from 'node:fs';

function read(path){ return fs.readFileSync(path, 'utf8'); }
function write(path, value){ fs.writeFileSync(path, value, 'utf8'); }
function replaceOnce(path, from, to){
  const input = read(path);
  if (!input.includes(from)) throw new Error(`SC-030 convergence anchor missing in ${path}`);
  const output = input.replace(from, to);
  if (output === input) throw new Error(`SC-030 convergence replacement made no change in ${path}`);
  write(path, output);
}

// 1) DMD image scenes: fill the display width, preserve image aspect ratio,
// and allow centred vertical cropping rather than narrowing the artwork.
replaceOnce(
  'src/legacy/scripts/inline-007.js',
`  // Fit the complete image AND its maximum shake/pulse inside the display.\n  function drawDmdSceneImage(im, age, amp, rateX, rateY, pulseAmp, yAmp){\n    if (!im || !im.complete || !im.naturalWidth || !im.naturalHeight) return;\n    amp = Math.min(12, Math.max(0, Number(amp) || 0));\n    const inset = 6;\n    const scale = Math.min(\n      (NATIVE_W - 2 * (inset + amp)) / im.naturalWidth,\n      (NATIVE_H - 2 * (inset + amp * yAmp)) / im.naturalHeight\n    ) / (1 + pulseAmp);`,
`  // Special artwork is a DMD banner, not a contained thumbnail: keep its\n  // natural aspect ratio, fill the usable width at every pulse phase, and let\n  // the native canvas crop excess height symmetrically. Small shake/pulse\n  // excursions may crop a few horizontal edge pixels, which is intentional.\n  function drawDmdSceneImage(im, age, amp, rateX, rateY, pulseAmp, yAmp){\n    if (!im || !im.complete || !im.naturalWidth || !im.naturalHeight) return;\n    amp = Math.min(12, Math.max(0, Number(amp) || 0));\n    const insetX = 4;\n    const safeWidth = Math.max(1, NATIVE_W - insetX * 2);\n    const minPulse = Math.max(.8, 1 - Math.abs(Number(pulseAmp) || 0));\n    const scale = safeWidth / im.naturalWidth / minPulse;`
);

// 2) Remove the redundant outer Live V2 cabinet. The meaningful inner modules
// retain their own borders, while the reclaimed 28px horizontal padding becomes
// usable player/shot/round space.
replaceOnce(
  'src/styles/live-game/v2-panel.css',
`.livev2panel{\n  max-width: 560px;\n  width:100%;\n  border-radius: 26px;\n  background: linear-gradient(180deg, rgba(18,24,44,.92), rgba(10,13,25,.92));\n  box-shadow: 0 18px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);\n  border: 1px solid rgba(255,255,255,.08);\n  padding: 16px 14px 14px;\n  margin: 10px auto 0;\n}`,
`.livev2panel{\n  max-width: 560px;\n  width:100%;\n  border-radius: 0;\n  background: transparent;\n  box-shadow: none;\n  border: 0;\n  padding: 0;\n  margin: 6px auto 0;\n}`
);

// 3) Remove the redundant DMD host card but retain the actual .sq-dmd machine
// bezel. Also remove horizontal wrapper padding so the bezel uses the reclaimed width.
replaceOnce(
  'src/styles/live-game/v2-mobile.css',
`  /* Top score header becomes a single “card” */\n  body[data-page="game"] #floatHead{\n    border-radius: 18px !important;\n    box-shadow: var(--shadow) !important;\n    margin: 10px 0 10px !important;\n    overflow: hidden !important;\n  }`,
`  /* SC-030 final convergence: the DMD itself is the machine component.\n     Keep one bezel and make the surrounding sticky host visually disappear. */\n  body[data-page="game"] #floatHead{\n    background: var(--bg) !important;\n    border: 0 !important;\n    border-radius: 0 !important;\n    box-shadow: none !important;\n    margin: 2px 0 8px !important;\n    overflow: visible !important;\n  }\n  body[data-page="game"] #sqDmdTopBar.sq-dmd-wrap{\n    padding: 2px 0 !important;\n  }`
);

// 4) The existing browser test already records native DMD image draw bounds.
// Change the acceptance from "contain everything" to the intended full-width
// banner contract while still requiring the artwork to intersect the display.
replaceOnce(
  'tools/ui-smoke/verify-classic-visual-fit.js',
`      assert(boxes.every(([x,y,w,h])=>x>=0&&y>=0&&x+w<=640&&y+h<=160),type+' stays inside display');\n      console.log('PASS '+type+' animation bounds');`,
`      assert(boxes.every(([x,y,w,h])=>w>=630&&x<16&&x+w>624&&y<160&&y+h>0),type+' fills DMD width and remains vertically centred through canvas cropping');\n      console.log('PASS '+type+' full-width DMD artwork');`
);

// 5) Add a focused runtime regression for the two redundant shell removals.
const convergenceTest = `// SC-030 final visual convergence regression. Production data is blocked by the shared harness.\nconst H = require('./harness');\nconst assert = require('assert/strict');\n\n(async()=>{\n  const {browser,page,consoleErrs} = await H.launch({width:390,height:844});\n  try{\n    await H.boot(page);\n    await H.toMatchCard(page);\n    await H.addGuests(page,['FRAME ALPHA','FRAME BETA']);\n    await H.startMatch(page);\n    await page.waitForSelector('#liveV2Panel:not([hidden])');\n\n    for (const size of [{width:320,height:844},{width:390,height:844},{width:430,height:932}]){\n      await page.setViewportSize(size);\n      await page.waitForTimeout(350);\n      const ui = await page.evaluate(()=>{\n        const panel=document.getElementById('liveV2Panel');\n        const gameCell=panel.querySelector('.v2GameCell');\n        const head=document.getElementById('floatHead');\n        const top=document.getElementById('sqDmdTopBar');\n        const bezel=document.getElementById('sqDmdWrap');\n        const rect=el=>el.getBoundingClientRect();\n        const css=el=>getComputedStyle(el);\n        const ps=css(panel), hs=css(head), ts=css(top);\n        return {\n          overflow:document.documentElement.scrollWidth>innerWidth+1,\n          panel:{\n            border:[ps.borderTopWidth,ps.borderRightWidth,ps.borderBottomWidth,ps.borderLeftWidth],\n            padding:[ps.paddingTop,ps.paddingRight,ps.paddingBottom,ps.paddingLeft],\n            shadow:ps.boxShadow,\n            backgroundImage:ps.backgroundImage,\n            backgroundColor:ps.backgroundColor,\n            width:rect(panel).width\n          },\n          gameWidth:rect(gameCell).width,\n          head:{\n            border:[hs.borderTopWidth,hs.borderRightWidth,hs.borderBottomWidth,hs.borderLeftWidth],\n            shadow:hs.boxShadow\n          },\n          topPadding:[ts.paddingLeft,ts.paddingRight],\n          dmdWidth:rect(bezel).width,\n          headWidth:rect(head).width\n        };\n      });\n      const zero = values => values.every(v => parseFloat(v) <= .1);\n      assert(!ui.overflow, size.width+'px convergence has no horizontal overflow');\n      assert(zero(ui.panel.border), size.width+'px Live V2 redundant outer border is removed');\n      assert(zero(ui.panel.padding), size.width+'px Live V2 redundant outer padding is reclaimed');\n      assert(ui.panel.shadow === 'none', size.width+'px Live V2 redundant outer shadow is removed');\n      assert(ui.panel.backgroundImage === 'none' && ui.panel.backgroundColor === 'rgba(0, 0, 0, 0)', size.width+'px Live V2 outer shell is transparent');\n      assert(ui.gameWidth >= ui.panel.width - 1.5, size.width+'px inner gameplay module receives reclaimed width');\n      assert(zero(ui.head.border), size.width+'px redundant DMD host border is removed');\n      assert(ui.head.shadow === 'none', size.width+'px redundant DMD host shadow is removed');\n      assert(zero(ui.topPadding), size.width+'px DMD wrapper horizontal padding is removed');\n      assert(ui.dmdWidth >= ui.headWidth - 1.5, size.width+'px single DMD bezel uses the available host width');\n    }\n    const unexpected=consoleErrs.filter(x=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(x));\n    assert.deepEqual(unexpected,[],'no unexpected browser errors: '+unexpected.join('\\n'));\n    console.log('PASS SC-030 final shell convergence at 320/390/430');\n  }finally{ await browser.close(); }\n})().catch(e=>{console.error(e);process.exit(1);});\n`;
write('tools/ui-smoke/verify-sc030-final-convergence.js', convergenceTest);

// 6) Make the final RC gate permanently enforce the convergence patch on source
// and dist, not just this one build.
replaceOnce(
  '.github/workflows/sc030-release-candidate-qa.yml',
`          node tools/ui-smoke/verify-sc030-reduced-motion-runtime.js | tee sc030-final-source-motion.txt\n          node tools/ui-smoke/verify-sc030-dmd-runtime.js | tee sc030-final-source-dmd.txt`,
`          node tools/ui-smoke/verify-sc030-reduced-motion-runtime.js | tee sc030-final-source-motion.txt\n          node tools/ui-smoke/verify-sc030-dmd-runtime.js | tee sc030-final-source-dmd.txt\n          node tools/ui-smoke/verify-sc030-final-convergence.js | tee sc030-final-source-convergence.txt`
);
replaceOnce(
  '.github/workflows/sc030-release-candidate-qa.yml',
`          node tools/ui-smoke/verify-sc030-reduced-motion-runtime.js | tee sc030-final-dist-motion.txt\n          node tools/ui-smoke/verify-sc030-dmd-runtime.js | tee sc030-final-dist-dmd.txt`,
`          node tools/ui-smoke/verify-sc030-reduced-motion-runtime.js | tee sc030-final-dist-motion.txt\n          node tools/ui-smoke/verify-sc030-dmd-runtime.js | tee sc030-final-dist-dmd.txt\n          node tools/ui-smoke/verify-sc030-final-convergence.js | tee sc030-final-dist-convergence.txt`
);

// 7) Reconcile the stale SC-030 handover with the implementation that now exists.
let doc = read('docs/SC-030-LIVE-GAME-DMD-V2-MODULAR.md');
doc = doc.replace(/^Status:.*$/m,
  'Status: RELEASE CANDIDATE — runtime integration and final visual convergence implemented on the isolated SC-030 branch. Production release remains unauthorised until explicit release approval.');
doc = doc.replace(
  'It does **not** currently load in the app. Phase 1 must pass independently before any runtime bootstrap is introduced.',
  'The controller now loads through the source-authoritative DMD bootstrap. Runtime adoption, action responsiveness, Undo/Skip behaviour, semantic CSS ownership and reduced-motion handling are implemented and covered by dedicated regressions.'
);
doc = doc.replace(
  /## Next implementation slice after Phase 1 green[\\s\\S]*?## Security boundary/,
`## Implemented SC-030 delivery\n\n- modular DMD controller + source-authoritative bootstrap;\n- ordinary throw/Miss/visit/player/round event adoption without scoring-semantic changes;\n- truthful Undo feedback and immediate Skip responsiveness;\n- existing Last Dart Hero / Desmond / Voldy special scenes retained;\n- special artwork rendered as full-width DMD banners with aspect ratio preserved and centred vertical crop;\n- semantic Live Game CSS ownership for the DMD cabinet;\n- reduced-motion adapter and runtime verification;\n- redundant Live V2 outer cabinet removed so the inner player/shot/round modules use the reclaimed width;\n- redundant DMD host card removed while retaining one meaningful machine bezel;\n- source and dist browser regression, mobile fit and cloud-failure resilience are release gates.\n\n## Remaining release steps\n\n1. Final release-candidate QA must pass at the candidate head.\n2. Review the generated 320/390/430 visual evidence for product fit.\n3. Open the SC-030 release PR only after that evidence is accepted.\n4. Merge/release only with explicit release approval.\n5. Run the separate Shateki Engineering Hardening change after SC-030; do not mix it into this release.\n\n## Security boundary`
);
write('docs/SC-030-LIVE-GAME-DMD-V2-MODULAR.md', doc);

console.log('SC-030 final visual convergence source patch applied.');
