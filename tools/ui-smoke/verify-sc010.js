// SC-010 regression: cold-read coalescing + honest positive-achievement failure state.
const H = require('./harness');
const FX = require('./pstats-fixture');
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

async function scenario(mode){
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  await H.boot(page, { settle:2500 });
  await FX.install(page);
  await page.evaluate((mode) => {
    const baseFrom = window.sb.from.bind(window.sb);
    window.__sc010Calls = {};
    const resultQuery = (data, error) => {
      const q = {
        select(){ return q; }, eq(){ return q; }, ilike(){ return q; }, or(){ return q; }, order(){ return q; }, limit(){ return q; },
        then(res){ res({ data, error }); }, catch(){ return q; }
      };
      return q;
    };
    const wrapped = {
      from(table){
        window.__sc010Calls[table] = (window.__sc010Calls[table] || 0) + 1;
        if (table === 'v_player_achievements' && mode === 'error') return resultQuery(null, { message:'statement timeout' });
        if (table === 'v_player_achievements' && mode === 'empty') return resultQuery([], null);
        return baseFrom(table);
      }
    };
    window.sb = wrapped; window.__sb = wrapped;
    if (window.SQ_XP){ window.SQ_XP._cache = null; window.SQ_XP._cacheAt = 0; window.SQ_XP._inflight = null; }
  }, mode);

  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).find(b => /^achievements$/i.test(b.textContent.trim()));
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  const ui = await page.evaluate(() => {
    const root = document.querySelector('.sq-stats-modal');
    const sec = title => root.querySelector('[data-achievement-section="' + title + '"]');
    const sectionText = title => normLocal((sec(title) || {}).textContent || '');
    function normLocal(v){ return String(v || '').replace(/\s+/g, ' ').trim(); }
    return {
      vaultCount: normLocal((root.querySelector('.pp-vault-count') || {}).textContent || ''),
      vaultSub: normLocal((root.querySelector('.pp-vault-sub') || {}).textContent || ''),
      vaultShelf: normLocal((root.querySelector('.pp-vault-shelf') || {}).textContent || ''),
      milestones: sectionText('Milestones'),
      trophies: sectionText('Trophies / Awards'),
      misfires: sectionText('Misfires'),
      calls: { ...window.__sc010Calls },
    };
  });
  await browser.close();
  return { ui, consoleErrs };
}

(async () => {
  const success = await scenario('success');
  check('cold Player Stats performs one v_player_xp read', success.ui.calls.v_player_xp === 1, JSON.stringify(success.ui.calls));
  check('success reads positive achievements once by resolved player id', success.ui.calls.v_player_achievements === 1, JSON.stringify(success.ui.calls));
  check('success reads Misfires once by resolved player id', success.ui.calls.v_player_misfires === 1, JSON.stringify(success.ui.calls));
  check('successful history renders earned Trophy Vault count', success.ui.vaultCount === '2 / 58', success.ui.vaultCount);
  check('successful history preserves real section counts', /0 \/ 15 unlocked/.test(success.ui.milestones) && /2 \/ 43 unlocked/.test(success.ui.trophies), success.ui.milestones + ' | ' + success.ui.trophies);
  check('Misfires remain available on success', /2 \/ 8 unlocked/.test(success.ui.misfires) && /4 historical occurrences/.test(success.ui.misfires), success.ui.misfires);

  const failed = await scenario('error');
  check('achievement fetch failure is not rendered as 0/58', failed.ui.vaultCount === '— / 58', failed.ui.vaultCount);
  check('achievement fetch failure is explicitly labelled unavailable', /Achievement history unavailable/i.test(failed.ui.vaultSub) && /Achievement history is unavailable right now/i.test(failed.ui.vaultShelf), failed.ui.vaultSub + ' | ' + failed.ui.vaultShelf);
  check('failed history uses dash counts, not false zero section counts', /— \/ 15 unlocked/.test(failed.ui.milestones) && /— \/ 43 unlocked/.test(failed.ui.trophies), failed.ui.milestones + ' | ' + failed.ui.trophies);
  check('Misfires still render when positive achievement read fails', /2 \/ 8 unlocked/.test(failed.ui.misfires) && /4 historical occurrences/.test(failed.ui.misfires), failed.ui.misfires);
  check('failure path still performs only one XP read', failed.ui.calls.v_player_xp === 1, JSON.stringify(failed.ui.calls));

  const empty = await scenario('empty');
  check('successful empty history remains a genuine zero state', empty.ui.vaultCount === '0 / 58' && /No trophies yet/i.test(empty.ui.vaultShelf), empty.ui.vaultCount + ' | ' + empty.ui.vaultShelf);
  check('successful empty sections remain real zero counts', /0 \/ 15 unlocked/.test(empty.ui.milestones) && /0 \/ 43 unlocked/.test(empty.ui.trophies), empty.ui.milestones + ' | ' + empty.ui.trophies);

  const errs = [...success.consoleErrs, ...failed.consoleErrs, ...empty.consoleErrs].filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', errs.length === 0, errs.slice(0,5).join(' | '));

  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
