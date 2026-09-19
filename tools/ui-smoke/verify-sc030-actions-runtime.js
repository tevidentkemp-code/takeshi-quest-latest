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
    await H.addGuests(page, ['ACTION ALPHA', 'ACTION BETA']);
    await H.startMatch(page);
    await page.waitForFunction(() => window.__sqDmdV2Ready === true && !!window.__sqDmdV2);

    // Instrument the destructive legacy DMD clear. Generic Skip/Undo should no
    // longer need it now that the controller owns a non-destructive transient channel.
    await page.evaluate(() => {
      window.__sqSc030HardClearCount = 0;
      const original = window.__sqDmdHardClearQueue;
      window.__sqSc030OriginalHardClear = original;
      window.__sqDmdHardClearQueue = function(...args){
        window.__sqSc030HardClearCount += 1;
        return original.apply(this, args);
      };
    });

    const before = await page.evaluate(() => ({
      history: state.history.length,
      player: state.currentPlayer,
      round: state.currentRound,
      dart: state.currentDart,
    }));
    assert.equal(before.history, 0);
    assert.equal(before.dart, 0);

    const skip = await page.$('#pad .dtActBtn.skip:not([disabled])');
    assert(skip, 'Skip action is available');
    await skip.click();

    // SC-036 start-of-turn Skip Go is now one synthetic absence event rather
    // than three scored misses. Responsiveness is unchanged: the hand-off must
    // still complete inside the existing 300ms guard.
    await page.waitForFunction((startPlayer) => (
      state.history.length >= 1 &&
      state.currentDart === 0 &&
      state.currentPlayer !== startPlayer
    ), before.player, { timeout: 300 });

    const skipped = await page.evaluate(() => ({
      history: state.history.length,
      player: state.currentPlayer,
      round: state.currentRound,
      dart: state.currentDart,
      skipFlag: !!window.__sqSkipInProgress,
      active: window.__sqDmdV2?.snapshot?.().active?.headline || '',
      hardClears: window.__sqSc030HardClearCount,
    }));
    assert.equal(skipped.history, 1, 'Start-of-turn Skip Go records one synthetic absence event');
    assert.equal(skipped.dart, 0, 'Skip hands off at the next player dart 1');
    assert.equal(skipped.skipFlag, false, 'Skip suppression flag is cleared synchronously');
    assert.equal(skipped.active, 'TURN SKIPPED', 'Skip feedback is controller-owned');
    assert.equal(skipped.hardClears, 0, 'generic Skip does not erase DMD baseline');

    // Next player input remains live while the Skip message is still active.
    const scoreButton = await page.$('#pad .dtBullBtn:not([disabled])');
    assert(scoreButton, 'next-player scoring input is immediately available');
    await scoreButton.click();
    await page.waitForFunction((history) => state.history.length > history, skipped.history, { timeout: 300 });
    const rescored = await page.evaluate(() => ({
      history: state.history.length,
      player: state.currentPlayer,
      dart: state.currentDart,
    }));
    assert.equal(rescored.history, 2, 'next player can score immediately after Skip');
    assert.equal(rescored.player, skipped.player, 'immediate score belongs to next player');
    assert.equal(rescored.dart, 1, 'next player advances one dart');

    // Scoring buttons intentionally retain their existing legacy clear path, so
    // reset the instrumentation before isolating generic Undo behavior.
    await page.evaluate(() => { window.__sqSc030HardClearCount = 0; });
    const undo = await page.$('#pad .dtActBtn.undo:not([disabled])');
    assert(undo, 'Undo action is available');
    await undo.click();
    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'THROW UNDONE');
    const undone = await page.evaluate(() => ({
      history: state.history.length,
      player: state.currentPlayer,
      dart: state.currentDart,
      hardClears: window.__sqSc030HardClearCount,
      active: window.__sqDmdV2.snapshot().active?.headline || '',
    }));
    assert.equal(undone.history, 1, 'Undo removes the immediate next-player dart while preserving the absence event');
    assert.equal(undone.player, skipped.player, 'Undo restores the same next player');
    assert.equal(undone.dart, 0, 'Undo restores dart index after immediate score');
    assert.equal(undone.hardClears, 0, 'generic Undo no longer erases DMD baseline');
    assert.equal(undone.active, 'THROW UNDONE');

    await page.waitForTimeout(900);
    const settled = await page.evaluate(() => ({ active: window.__sqDmdV2?.snapshot?.().active || null }));
    assert.equal(settled.active, null, 'Undo transient expires cleanly back to renderer-owned state');

    assertNoUnexpectedErrors(consoleErrs, 'SC-030 responsive actions runtime');
    console.log('SC-030 RESPONSIVE ACTIONS: ALL PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
