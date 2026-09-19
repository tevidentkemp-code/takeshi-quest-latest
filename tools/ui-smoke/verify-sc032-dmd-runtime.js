const assert = require('assert/strict');
const H = require('./harness');

const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
function assertNoUnexpectedErrors(consoleErrs, label){
  const unexpected = consoleErrs.filter(error => !BROWSER_NOISE.test(error));
  assert.deepEqual(unexpected, [], `${label}: ${unexpected.join('\n')}`);
}

async function visible(page, selector){
  return page.$(`${selector}:not([disabled])`);
}

function staleStage3(writes){
  return writes.filter(w => /ROUND SCORE|NEXT UP|TO THROW FIRST|COMPLETE/i.test(`${w.z2} ${w.z3}`));
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['DMD ALPHA', 'DMD BETA']);
    await H.startMatch(page);
    await page.waitForFunction(() => window.__sqDmdV2Ready === true && !!window.__sqDmdV2 && typeof window.sqDmdShowZones === 'function');

    // Capture every renderer write without changing renderer behaviour.
    await page.evaluate(() => {
      window.__sqSc032DmdWrites = [];
      const original = window.sqDmdShowZones;
      window.__sqSc032OriginalShowZones = original;
      window.sqDmdShowZones = function(zones, opts){
        try {
          window.__sqSc032DmdWrites.push({
            at: performance.now(),
            z1: String(zones?.z1 || ''),
            z2: String(zones?.z2 || ''),
            z3: String(zones?.z3 || ''),
            type: String(opts?.type || ''),
          });
        } catch (_) {}
        return original.apply(this, arguments);
      };
    });

    const score = async () => {
      const button = await visible(page, '#pad .dtBullBtn');
      assert(button, 'score button is available');
      await button.click();
    };

    // 1) Generic Skip owns its feedback. Engine third-dart timers must not
    // repaint ROUND SCORE / NEXT UP underneath the controller transient.
    await page.evaluate(() => { window.__sqSc032DmdWrites = []; });
    const start = await page.evaluate(() => ({
      player: state.currentPlayer,
      history: state.history.length,
    }));
    const skip = await visible(page, '#pad .dtActBtn.skip');
    assert(skip, 'Skip is available');
    await skip.click();
    await page.waitForFunction((player) => state.currentPlayer !== player && state.currentDart === 0, start.player, { timeout: 350 });
    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'TURN SKIPPED', { timeout: 350 });
    await page.waitForTimeout(1100);

    const skipped = await page.evaluate(() => ({
      history: state.history.length,
      writes: window.__sqSc032DmdWrites.slice(),
      openAbsences: (state.__sqCatchUp?.jobs || []).filter(j => j && j.kind === 'absence' && !j.completed).map(j => ({
        playerIndex: j.playerIndex,
        pendingRounds: (j.pendingRounds || []).slice()
      }))
    }));
    assert.equal(skipped.history, start.history + 1, 'Start-of-turn Skip Go records one synthetic absence history event');
    assert.equal(skipped.openAbsences.length, 1, 'Start-of-turn Skip Go creates one open absence job');
    assert.deepEqual(staleStage3(skipped.writes), [], `Skip must not leak third-dart Stage-3 writes: ${JSON.stringify(staleStage3(skipped.writes))}`);

    // This test owns DMD sequencing, not absence/catch-up semantics. Retire the
    // synthetic absence after proving Skip feedback so later DMD scenarios start
    // from a clean normal-turn cursor under the new implicit-return contract.
    await page.evaluate(() => {
      const cu=state.__sqCatchUp;
      if(cu && Array.isArray(cu.jobs)){
        cu.jobs.forEach(job => {
          if(job && job.kind==='absence' && !job.completed){
            job.pendingRounds=[];
            job.completed=true;
            job.absent=false;
            job.returned=true;
          }
        });
        cu.active=false;
        cu.awaitingReturn=false;
        delete cu.activeJobIndex;
        delete cu.resumeFinished;
      }
      save();
    });

    // 2) Complete the next player's visit normally, then throw immediately for
    // the following player. That new input hard-clears/cancels the old DMD flow.
    // No delayed ROUND SCORE / NEXT UP from the previous visit may repaint later.
    await score();
    await score();
    const beforeThird = await page.evaluate(() => ({ player: state.currentPlayer, history: state.history.length }));
    await score();
    await page.waitForFunction((player) => state.currentPlayer !== player && state.currentDart === 0, beforeThird.player, { timeout: 350 });

    // Immediate next-player input is the cancellation boundary.
    await score();
    await page.waitForFunction((history) => state.history.length > history, beforeThird.history + 1, { timeout: 350 });
    await page.evaluate(() => { window.__sqSc032DmdWrites = []; });
    await page.waitForTimeout(1900);

    const rapid = await page.evaluate(() => ({
      player: state.currentPlayer,
      dart: state.currentDart,
      writes: window.__sqSc032DmdWrites.slice(),
    }));
    assert.equal(rapid.dart, 1, 'immediate next-player throw remains recorded');
    assert.deepEqual(staleStage3(rapid.writes), [], `new throw must cancel previous visit Stage-3 writes: ${JSON.stringify(staleStage3(rapid.writes))}`);

    // 3) Generic Undo remains controller-owned and settles cleanly.
    let undo = await visible(page, '#pad .dtActBtn.undo');
    assert(undo, 'Undo is available');
    await undo.click();
    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'THROW UNDONE', { timeout: 350 });
    const undone = await page.evaluate(() => ({ dart: state.currentDart, active: window.__sqDmdV2?.snapshot?.().active?.headline || '' }));
    assert.equal(undone.dart, 0, 'Undo restores the immediate next-player dart');
    assert.equal(undone.active, 'THROW UNDONE', 'Undo presentation remains controller-owned');

    // 4) Undoing the third dart before Stage-3 starts must invalidate that
    // completed-visit sequence even though generic Undo intentionally does not
    // hard-clear the DMD renderer.
    await score();
    await score();
    const beforeUndoThird = await page.evaluate(() => ({
      player: state.currentPlayer,
      history: state.history.length,
    }));
    await score();
    await page.waitForFunction((player) => state.currentPlayer !== player && state.currentDart === 0, beforeUndoThird.player, { timeout: 350 });

    undo = await visible(page, '#pad .dtActBtn.undo');
    assert(undo, 'Undo remains available after a completed visit');
    await undo.click();
    await page.waitForFunction((player) => state.currentPlayer === player && state.currentDart === 2, beforeUndoThird.player, { timeout: 350 });
    await page.evaluate(() => { window.__sqSc032DmdWrites = []; });
    await page.waitForTimeout(1900);

    const thirdUndone = await page.evaluate(() => ({
      player: state.currentPlayer,
      dart: state.currentDart,
      writes: window.__sqSc032DmdWrites.slice(),
      active: window.__sqDmdV2?.snapshot?.().active?.headline || '',
    }));
    assert.equal(thirdUndone.player, beforeUndoThird.player, 'third-dart Undo restores the original player');
    assert.equal(thirdUndone.dart, 2, 'third-dart Undo restores dart three input');
    assert.deepEqual(staleStage3(thirdUndone.writes), [], `third-dart Undo must cancel old Stage-3 writes: ${JSON.stringify(staleStage3(thirdUndone.writes))}`);

    assertNoUnexpectedErrors(consoleErrs, 'SC-032 DMD runtime');
    console.log('SC-032 DMD RUNTIME OWNERSHIP: ALL PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
