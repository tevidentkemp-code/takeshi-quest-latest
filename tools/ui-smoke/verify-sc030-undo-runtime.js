const assert = require('assert/strict');
const H = require('./harness');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
function assertNoUnexpectedErrors(consoleErrs, label){
  const unexpected = consoleErrs.filter(error => !BROWSER_NOISE.test(error));
  assert.deepEqual(unexpected, [], `${label}: ${unexpected.join('\n')}`);
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['UNDO ALPHA', 'UNDO BETA']);
    await H.startMatch(page);
    await page.waitForFunction(() => window.__sqDmdV2Ready === true && !!window.__sqDmdV2);

    // No-history Undo must remain truthful: state stays empty and generic DMD V2
    // must not claim a throw was restored.
    const noHistoryBefore = await page.evaluate(() => state.history.length);
    assert.equal(noHistoryBefore, 0);
    await page.click('#pad .dtActBtn.undo');
    await page.waitForTimeout(180);
    const noHistory = await page.evaluate(() => ({
      history: state.history.length,
      active: window.__sqDmdV2?.snapshot?.().active?.headline || null,
    }));
    assert.equal(noHistory.history, 0);
    assert.notEqual(noHistory.active, 'THROW UNDONE');

    // Record one verified scoring dart through the existing scoring path.
    const scoreButton = await page.$('#pad .dtBullBtn:not([disabled])');
    assert(scoreButton, 'scoring button available');
    await scoreButton.click();
    await page.waitForTimeout(250);
    const scored = await page.evaluate(() => ({
      history: state.history.length,
      dart: state.currentDart,
      player: state.currentPlayer,
      round: state.currentRound,
    }));
    assert.equal(scored.history, 1, 'existing score path records history');
    assert.equal(scored.dart, 1, 'existing score path advances one dart');

    // Undo presentation is now emitted only after undo() successfully restores state.
    await page.click('#pad .dtActBtn.undo');
    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'THROW UNDONE');
    const undone = await page.evaluate(() => ({
      history: state.history.length,
      dart: state.currentDart,
      player: state.currentPlayer,
      round: state.currentRound,
      active: window.__sqDmdV2.snapshot().active?.headline || '',
      queue: window.__sqDmdV2.snapshot().queue.length,
    }));
    assert.equal(undone.history, 0, 'undo removes the recorded throw');
    assert.equal(undone.dart, 0, 'undo restores the dart index');
    assert.equal(undone.player, scored.player, 'undo restores same player');
    assert.equal(undone.round, scored.round, 'undo restores same round');
    assert.equal(undone.active, 'THROW UNDONE');
    assert.equal(undone.queue, 0, 'undo does not leave stale pending DMD events');

    assertNoUnexpectedErrors(consoleErrs, 'SC-030 Undo runtime');
    console.log('SC-030 UNDO DMD ADOPTION: ALL PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
