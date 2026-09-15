const assert = require('assert/strict');
const H = require('./harness');

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  try {
    await H.boot(page);
    await H.toMatchCard(page); await H.addGuests(page, ['SPIKE A', 'SPIKE B']); await H.startMatch(page);
    await page.waitForFunction(() => !!window.__sqDmdV2 && !!window.__sqDmdSpike);
    const result = await page.evaluate(async () => {
      const out = [];
      window.__sqDmdV2.emit({ kind: 'PLAYER_UP', player: 'SPIKE A', target: 20 });
      await new Promise(r => setTimeout(r, 30)); out.push(window.__sqDmdSpike?.active?.scene);
      window.__sqDmdV2.emit({ kind: 'HIT_TREBLE', points: 60, target: 20, total: 60 });
      await new Promise(r => setTimeout(r, 30)); out.push(window.__sqDmdSpike?.active?.scene);
      window.__sqDmdV2.emit({ kind: 'DESMOND_DELIGHT', total: 80 });
      await new Promise(r => setTimeout(r, 30)); out.push(window.__sqDmdSpike?.active?.scene);
      window.__sqDmdV2.emit({ kind: 'HIT_DOUBLE', points: 40 });
      await new Promise(r => setTimeout(r, 30));
      return { out, owner: window.__sqDmdOwnership.snapshot(), canvasCount: document.querySelectorAll('#sqDmdCanvas').length };
    });
    assert.deepEqual(result.out, ['PLAYER_UP', 'TREBLE', 'DESMOND']);
    assert.equal(result.canvasCount, 1);
    assert.equal(result.owner.owner, 'v2');
    console.log('PASS renderer spike Player Up/Treble/Desmond ownership and V2 fallback');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
