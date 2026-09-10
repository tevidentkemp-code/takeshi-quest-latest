from pathlib import Path

p = Path('tools/ui-smoke/verify-classic-visual-fit.js')
s = p.read_text(encoding='utf-8')
old = '''    await page.locator('#pad .dtBullBtn').first().click();
    await page.locator('#pad .dtBullBtn').first().click();
    await page.waitForTimeout(500);
    const miniAv = await page.evaluate(() => ({
      r3: document.getElementById('v2Mini3R0')?.textContent || '',
      mtc: document.getElementById('v2MiniMtc0')?.textContent || ''
    }));
    assert(miniAv.r3 && miniAv.r3 !== '–', '3R AV populated after a completed round');
    assert.equal(miniAv.r3, miniAv.mtc, '3R AV and MTC AV agree after the first completed round');
    console.log('PASS compact 3R AV / MTC AV strip');'''
new = '''    const miniAv = await page.evaluate(async () => {
      const pIdx = 0;
      const cr = Number(state.currentRound || 0);
      const beforeEntry = structuredClone(state.score?.[pIdx]?.[cr] || { darts:[], roundTotal:0 });
      const beforeDart = state.currentDart;
      try{
        state.score[pIdx][cr] = {
          darts:[
            { kind:'S', points:10 },
            { kind:'S', points:10 },
            { kind:'S', points:10 }
          ],
          roundTotal:30
        };
        state.currentDart = 3;
        const pair = __sqV2LiveAveragePair(pIdx, cr);
        liveV2Render();
        await new Promise(resolve => setTimeout(resolve, 140));
        return {
          pairR3: __sqFmtAvg(pair.r3),
          pairMtc: __sqFmtAvg(pair.mtc),
          r3: document.getElementById('v2Mini3R0')?.textContent || '',
          mtc: document.getElementById('v2MiniMtc0')?.textContent || ''
        };
      } finally {
        state.score[pIdx][cr] = beforeEntry;
        state.currentDart = beforeDart;
        liveV2Render();
        await new Promise(resolve => setTimeout(resolve, 140));
      }
    });
    assert.equal(miniAv.pairR3, '30', '3R helper uses completed-round score');
    assert.equal(miniAv.pairMtc, '30', 'MTC helper uses completed-round score');
    assert.equal(miniAv.r3, miniAv.pairR3, 'rendered 3R AV matches helper');
    assert.equal(miniAv.mtc, miniAv.pairMtc, 'rendered MTC AV matches helper');
    console.log('PASS compact 3R AV / MTC AV strip');'''
if s.count(old) != 1:
    raise RuntimeError(f'isolation anchor count={s.count(old)}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('SC-017 average smoke isolated from DMD journey')
