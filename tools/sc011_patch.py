from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
index_path = root / 'index.html'
test_path = root / 'tools' / 'ui-smoke' / 'verify-progression-modes.js'

index = index_path.read_text(encoding='utf-8')

helper_pattern = re.compile(
    r"  function blockAvgPoints\(arr, k\)\{\n.*?    return pts;\n  \}",
    re.S,
)
helper_replacement = """  function blockAvgPoints(arr, k){
    const pts = [];
    const n = arr.length;
    if (!Number.isFinite(k) || k <= 0 || n < k) return pts;
    let sum = 0;
    for (let i=0; i<n; i++){
      sum += Number(arr[i]) || 0;
      if (i >= k) sum -= Number(arr[i-k]) || 0;
      if (i >= k-1) pts.push({ x:i, y:sum/k });
    }
    return pts;
  }"""
index, helper_count = helper_pattern.subn(helper_replacement, index, count=1)
if helper_count != 1:
    raise SystemExit(f'Expected exactly one Progression average helper, found {helper_count}')

stats_pattern = re.compile(
    r"    const blockMeans = \[\];\n.*?    pillAvg\.textContent = `Avg Low \$\{minAvg\.toFixed\(1\)\} · Avg High \$\{maxAvg\.toFixed\(1\)\}`;",
    re.S,
)
stats_replacement = """    const rollingMeans = blockAvgPoints(scores, activeBlockSize).map(p=>p.y);
    if (!rollingMeans.length){
      pillAvg.textContent = `${activeBlockSize} Game AV needs ${activeBlockSize} games`;
      return;
    }
    const minAvg = Math.min(...rollingMeans);
    const maxAvg = Math.max(...rollingMeans);
    pillAvg.textContent = `Avg Low ${minAvg.toFixed(1)} · Avg High ${maxAvg.toFixed(1)}`;"""
index, stats_count = stats_pattern.subn(stats_replacement, index, count=1)
if stats_count != 1:
    raise SystemExit(f'Expected exactly one Progression AV range block, found {stats_count}')

index_path.write_text(index, encoding='utf-8')

test = test_path.read_text(encoding='utf-8')
old_fixture = """    const officialRows = [100, 200, 300, 400, 500, 600].map((score, i) => ({
      game_id: 'o' + i,
      ts: `2026-08-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
      player_name: 'Thom',
      score
    }));"""
new_fixture = """    const officialRows = Array.from({ length: 21 }, (_, i) => ({
      game_id: 'o' + i,
      ts: `2026-08-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
      player_name: 'Thom',
      score: 100 + i * 10
    }));"""
if test.count(old_fixture) != 1:
    raise SystemExit('Official Progression fixture changed unexpectedly')
test = test.replace(old_fixture, new_fixture, 1)

checks_pattern = re.compile(
    r"  const officialStats = \(await pillAll\.textContent\(\) \|\| ''\)\.trim\(\);\n.*?  const queries = await page\.evaluate\(\(\) => window\.__progQueries\.slice\(\)\);",
    re.S,
)
checks_replacement = """  const officialStats = (await pillAll.textContent() || '').trim();
  check('Official fixture only drives summary', officialStats.includes('Avg 200.0') && officialStats.includes('Low 100') && officialStats.includes('High 300'), officialStats);

  const officialB20Initial = (await pillAvg.textContent() || '').trim();
  check('20 Game AV is a true rolling window', officialB20Initial.includes('Avg Low 195.0') && officialB20Initial.includes('Avg High 205.0'), officialB20Initial);

  await modal.locator('button[data-mode=\"B5\"]').click();
  await page.waitForTimeout(150);
  const officialB5 = (await pillAvg.textContent() || '').trim();
  check('5 Game AV is a true rolling window', officialB5.includes('Avg Low 120.0') && officialB5.includes('Avg High 280.0'), officialB5);

  await modal.locator('button[data-mode=\"B10\"]').click();
  await page.waitForTimeout(150);
  const officialB10 = (await pillAvg.textContent() || '').trim();
  check('10 Game AV is a true rolling window', officialB10.includes('Avg Low 145.0') && officialB10.includes('Avg High 255.0'), officialB10);

  await page.setViewportSize({ width: 400, height: 844 });
  await page.waitForTimeout(250);
  const officialAfterResize = (await pillAvg.textContent() || '').trim();
  check('resize preserves selected 10 Game AV', officialAfterResize.includes('Avg Low 145.0') && officialAfterResize.includes('Avg High 255.0'), officialAfterResize);

  await turbo.click();
  await page.waitForFunction(() => {
    const m = document.querySelector('.modal .sq-progression-mode-toggle')?.closest('.modal');
    const p = m?.querySelector('.prog-stats');
    return !!p && /Avg 65\\.0/.test(p.textContent || '');
  });

  check('Turbo becomes selected', (await turbo.getAttribute('aria-pressed')) === 'true');
  check('Official deselects', (await official.getAttribute('aria-pressed')) === 'false');
  const turboStats = (await pillAll.textContent() || '').trim();
  check('Turbo fixture only drives summary', turboStats.includes('Avg 65.0') && turboStats.includes('Low 40') && turboStats.includes('High 90'), turboStats);
  check('Turbo extracts selected player total by player index', !turboStats.includes('9000'), turboStats);

  const turboB10 = (await pillAvg.textContent() || '').trim();
  check('Incomplete 10-game tail is not presented as a 10 Game AV', turboB10.includes('10 Game AV needs 10 games'), turboB10);

  await modal.locator('button[data-mode=\"B5\"]').click();
  await page.waitForTimeout(150);
  const turboB5 = (await pillAvg.textContent() || '').trim();
  check('5 Game AV remains mode-isolated in Turbo', turboB5.includes('Avg Low 60.0') && turboB5.includes('Avg High 70.0'), turboB5);

  await modal.locator('button[data-mode=\"B20\"]').click();
  await page.waitForTimeout(150);
  const turboB20 = (await pillAvg.textContent() || '').trim();
  check('Incomplete 20-game tail is not presented as a 20 Game AV', turboB20.includes('20 Game AV needs 20 games'), turboB20);

  const queries = await page.evaluate(() => window.__progQueries.slice());"""
test, checks_count = checks_pattern.subn(checks_replacement, test, count=1)
if checks_count != 1:
    raise SystemExit(f'Expected exactly one Progression verifier check block, found {checks_count}')

test_path.write_text(test, encoding='utf-8')

print('SC-011 patch applied: index.html + verify-progression-modes.js')
