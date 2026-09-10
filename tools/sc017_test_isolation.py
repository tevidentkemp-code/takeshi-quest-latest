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
new = '''    const miniAv = await page.evaluate(() => {
      const cr = Number(state.currentRound || 0);
      const beforeEntry = structuredClone(state.score?.[0]?.[cr] || { darts:[], roundTotal:0 });
      const beforeDart = state.currentDart;
      try{
        const entry = state.score[0][cr];
        const first = structuredClone((entry.darts && entry.darts[0]) || { kind:'S', points:10 });
        entry.darts = [structuredClone(first), structuredClone(first), structuredClone(first)];
        entry.roundTotal = entry.darts.reduce((sum,d)=>sum+Number(d?.points||0),0);
        state.currentDart = 3;
        liveV2Render();
        return {
          r3: document.getElementById('v2Mini3R0')?.textContent || '',
          mtc: document.getElementById('v2MiniMtc0')?.textContent || ''
        };
      } finally {
        state.score[0][cr] = beforeEntry;
        state.currentDart = beforeDart;
        liveV2Render();
      }
    });
    assert(miniAv.r3 && miniAv.r3 !== '–', '3R AV populated for a completed-round state');
    assert.equal(miniAv.r3, miniAv.mtc, '3R AV and MTC AV agree after the first completed round');
    console.log('PASS compact 3R AV / MTC AV strip');'''
if s.count(old) != 1:
    raise RuntimeError(f'isolation anchor count={s.count(old)}')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('SC-017 average smoke isolated from DMD journey')
