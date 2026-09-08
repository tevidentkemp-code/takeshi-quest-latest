// SC-015 classic throwpad checks, using the existing network-isolated harness.
// Inspect real rendered controls; never substitute a mock game or score source.
async function inspectLayout(page) {
  return page.evaluate(() => {
    const problems = [];
    const pad = document.getElementById('pad');
    const actions = pad.querySelector('.dtActions');
    const controls = [...actions.querySelectorAll('button')];
    const names = controls.map(b => b.id === 'settingsBtnGamePad' ? 'settings' :
      ['miss', 'undo', 'skip'].find(c => b.classList.contains(c)));
    if (names.join(',') !== 'miss,undo,skip,settings') problems.push('control order: ' + names);
    for (const b of controls) {
      const box = b.getBoundingClientRect();
      const label = b.id || b.className;
      if (box.width < 43.9 || box.height < 43.9) problems.push(label + ': tap target below 44px');
      if (box.left < 0 || box.right > innerWidth + .5 || box.bottom > innerHeight + .5)
        problems.push(label + ': outside viewport');
      for (const child of b.querySelectorAll('.dtIcon,.dtLbl')) {
        const r = child.getBoundingClientRect();
        const style = getComputedStyle(child);
        if (!r.width || !r.height || style.visibility === 'hidden' || style.display === 'none')
          problems.push(label + ': hidden label/icon');
        if (r.left < box.left + 1 || r.right > box.right - 1 || r.top < box.top + 1 || r.bottom > box.bottom - 1)
          problems.push(label + ': label/icon overflows');
      }
    }
    for (let i = 1; i < controls.length; i++) {
      if (controls[i - 1].getBoundingClientRect().right > controls[i].getBoundingClientRect().left)
        problems.push('overlapping action buttons');
    }
    return problems;
  });
}

function createThrowpadChecks(check, screenshot) {
  const seen = new Set();
  return {
    async onTurn(page) {
      const type = await page.evaluate(() => ROUNDS[state.currentRound]?.type);
      if (!type || seen.has(type)) return;
      seen.add(type);
      const viewport = page.viewportSize();
      for (const width of type === 'number' ? [320, 360, 390, 430, 820] : [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        // Allow the existing settings insertion/layout timer and responsive canvas to settle.
        await page.waitForTimeout(1200);
        const problems = await inspectLayout(page);
        check(`${type} throwpad at ${width}px: labels fit, controls stay reachable`, !problems.length, problems.join('; '));
        if (width === 390 || (width === 320 && type === 'number'))
          await screenshot(page, `sc015-throwpad-${type}-${width}`);
      }
      await page.setViewportSize(viewport);
    },
    finish() {
      check('Throwpad fit checked on number, doubles, triples and bull rounds',
        ['number', 'doubles', 'triples', 'bull'].every(type => seen.has(type)), [...seen].join(', '));
    },
  };
}

async function checkScoreControls(page, check) {
  const position = () => page.evaluate(() => ({ round:state.currentRound, player:state.currentPlayer, dart:state.currentDart }));
  const initial = await position();
  for (const label of ['Single', 'Double', 'Treble']) {
    await page.locator(`#pad [data-score-label="${label}"]`).click();
    await page.waitForTimeout(350);
    const scored = await position();
    check(`${label} records one dart`, scored.round === initial.round && scored.player === initial.player && scored.dart === initial.dart + 1);
    const points = await page.evaluate(({ initial, label }) => {
      const dart = state.score[initial.player][initial.round].darts[initial.dart];
      return dart.points === ROUNDS[initial.round].target * { Single:1, Double:2, Treble:3 }[label];
    }, { initial, label });
    check(`${label} retains the correct score multiplier`, points);
    check(`${label} updates MISS xN`, await page.locator('#pad .dtX3').getAttribute('data-miss-n') === '2');
    await page.locator('#pad .dtActBtn.undo').click();
    await page.waitForTimeout(500);
    check(`Undo restores the dart after ${label}`, JSON.stringify(await position()) === JSON.stringify(initial));
  }
  await page.locator('#pad .dtActBtn.miss').click();
  await page.waitForTimeout(750);
  check('MISS records exactly one dart', (await position()).dart === initial.dart + 1);
  await page.locator('#pad .dtX3').click();
  await page.waitForTimeout(1200);
  const nextPlayer = await position();
  check('MISS x2 advances to the next player', nextPlayer.round === initial.round && nextPlayer.player !== initial.player && nextPlayer.dart === 0);
  await page.locator('#pad .dtActBtn.skip').click();
  await page.waitForTimeout(1500);
  const skipped = await position();
  check('SKIP advances the turn without a dead button', skipped.round !== nextPlayer.round || skipped.player !== nextPlayer.player);
}

module.exports = { createThrowpadChecks, checkScoreControls };
