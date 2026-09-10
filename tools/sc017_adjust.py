from pathlib import Path

index = Path('index.html')
smoke = Path('tools/ui-smoke/verify-classic-visual-fit.js')

html = index.read_text(encoding='utf-8')
anchor = '''/* SC-017: compact live averages directly beneath each player information cell. */
.livev2panel .v2MiniAvg{'''
replacement = '''/* SC-017: compact live averages directly beneath each player information cell. */
.livev2panel .v2ScoreGrid{ row-gap:0; }
.livev2panel .v2MiniAvg{'''
if html.count(anchor) != 1:
    raise RuntimeError(f'average-strip geometry anchor count={html.count(anchor)}')
html = html.replace(anchor, replacement, 1)
index.write_text(html, encoding='utf-8')

js = smoke.read_text(encoding='utf-8')
anchor = '''    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('MTC AV'), 'MTC AV label present');
    await page.locator('#pad .dtBullBtn').first().click();'''
replacement = '''    assert((await page.locator('#liveV2Panel .v2MiniAvg').first().innerText()).includes('MTC AV'), 'MTC AV label present');
    const avgAttachGap = await page.evaluate(() => {
      const score=document.querySelector('#liveV2Panel .v2ScoreBox[data-p="0"]')?.getBoundingClientRect();
      const avg=document.querySelector('#liveV2Panel .v2MiniAvg[data-p="0"]')?.getBoundingClientRect();
      return score&&avg ? Math.abs(avg.top-score.bottom) : 999;
    });
    assert(avgAttachGap<2,'mini-average strip attaches directly below player cell');
    await page.locator('#pad .dtBullBtn').first().click();'''
if js.count(anchor) != 1:
    raise RuntimeError(f'average-strip smoke anchor count={js.count(anchor)}')
js = js.replace(anchor, replacement, 1)
smoke.write_text(js, encoding='utf-8')

print('SC-017 geometry adjustment applied')
