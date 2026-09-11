from pathlib import Path

# 1) Fixture: remove the later duplicate empty Turbo latest-score view. The
# populated fixture earlier in the object must be the single controlling key.
fixture = Path('tools/ui-smoke/league-fixture.js')
f = fixture.read_text()
empty_key = "    v_latest_scores_turbo_clean: [],\n"
if f.count(empty_key) == 1:
    f = f.replace(empty_key, '', 1)
elif f.count(empty_key) != 0:
    raise SystemExit(f'Unexpected duplicate empty Turbo fixture count: {f.count(empty_key)}')
fixture.write_text(f)

# 2) Runtime: distinguish a successful zero-row result from a fetch failure.
index = Path('index.html')
text = index.read_text()
start = text.find('window.openHighScoreLeagueDialog = async function(initialMode)')
if start < 0:
    raise SystemExit('High Score League live definition not found')
end = text.find('\n  window.', start + 50)
if end < 0:
    end = min(len(text), start + 20000)
region = text[start:end]
old_zero = """      if(!rows.length){
        arena.innerHTML='<p class=\"tag\">'+(mode==='turbo'?'Turbo':'Official')+' High Score League data is not available yet.</p>';
        return;
      }"""
new_zero = """      if(!rows.length){
        arena.innerHTML='<p class=\"tag\">'+(mode==='turbo'?'No Turbo high scores found.':'No Official high scores found.')+'</p>';
        return;
      }"""
if old_zero in region:
    region = region.replace(old_zero, new_zero, 1)
elif 'No Turbo high scores found.' not in region:
    raise SystemExit('High Score League zero-row branch not found')
text = text[:start] + region + text[end:]
index.write_text(text)

# 3) Regression: wait for count-up completion deterministically, then prove a
# successful empty Turbo source renders a genuine empty state rather than an
# unavailable/error state.
verify = Path('tools/ui-smoke/verify-league-arcade.js')
v = verify.read_text()
old_turbo_wait = """  await page.waitForTimeout(900);
  const hsTurbo = await page.evaluate(() => {"""
new_turbo_wait = """  await page.waitForFunction((expected) => (document.querySelector('.hs-record-score') || {}).textContent === expected, E.hs.turbo.record.score, { timeout: 3000 });
  const hsTurbo = await page.evaluate(() => {"""
if old_turbo_wait in v:
    v = v.replace(old_turbo_wait, new_turbo_wait, 1)
elif "E.hs.turbo.record.score, { timeout: 3000 }" not in v:
    raise SystemExit('Turbo readiness wait target not found')

old_official_wait = """  await page.waitForTimeout(900);
  const hsOfficialAgain = await page.evaluate(() => ({"""
new_official_wait = """  await page.waitForFunction((expected) => (document.querySelector('.hs-record-score') || {}).textContent === expected, E.hs.record.score, { timeout: 3000 });
  const hsOfficialAgain = await page.evaluate(() => ({"""
if old_official_wait in v:
    v = v.replace(old_official_wait, new_official_wait, 1)
elif "E.hs.record.score, { timeout: 3000 }" not in v:
    raise SystemExit('Official readiness wait target not found')

anchor = """  check('HS League: switching back restores Official source', hsOfficialAgain.score === E.hs.record.score && hsOfficialAgain.holder === E.hs.record.holder && /All-Time Record — Official/i.test(hsOfficialAgain.eyebrow || ''), JSON.stringify(hsOfficialAgain));

  await page.keyboard.press('Escape');"""
replacement = """  check('HS League: switching back restores Official source', hsOfficialAgain.score === E.hs.record.score && hsOfficialAgain.holder === E.hs.record.holder && /All-Time Record — Official/i.test(hsOfficialAgain.eyebrow || ''), JSON.stringify(hsOfficialAgain));

  // Successful zero-row Turbo response must be a truthful empty state, not a cloud-error state.
  await page.evaluate(() => {
    window.__sqSc019From = window.sb.from;
    window.sb.from = (table) => {
      if (table !== 'v_latest_scores_turbo_clean') return window.__sqSc019From(table);
      const q = { select(){return q;}, order(){return q;}, limit(){return q;}, then(resolve){ resolve({data:[], error:null}); }, catch(){return q;} };
      return q;
    };
    const b = Array.from(document.querySelectorAll('.sq-fix100-backdrop button[data-mode]')).find((x) => x.dataset.mode === 'turbo');
    if (b) b.click();
  });
  await page.waitForFunction(() => /No Turbo high scores found/i.test((document.querySelector('.hs-arena') || {}).textContent || ''), undefined, { timeout: 3000 });
  const hsTurboEmpty = await page.evaluate(() => ((document.querySelector('.hs-arena') || {}).textContent) || '');
  check('HS League: genuine Turbo zero rows show empty state', /No Turbo high scores found/i.test(hsTurboEmpty) && !/not available yet/i.test(hsTurboEmpty), JSON.stringify(hsTurboEmpty));
  await page.evaluate(() => { if (window.__sqSc019From) { window.sb.from = window.__sqSc019From; delete window.__sqSc019From; } });

  await page.keyboard.press('Escape');"""
if anchor in v:
    v = v.replace(anchor, replacement, 1)
elif 'genuine Turbo zero rows show empty state' not in v:
    raise SystemExit('Empty-state regression insertion target not found')
verify.write_text(v)
