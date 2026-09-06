// SC-010 regression: coalesced XP + split positive-achievement reads + honest failure state.
const H = require('./harness');
const FX = require('./pstats-fixture');
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}

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
        if (table === 'v_ach_base') {
          if (mode === 'errorBase') return resultQuery(null, { message:'statement timeout' });
          if (mode === 'empty') return resultQuery([], null);
          return resultQuery([{ code:'giant_slayer', cnt:1, xp:10 }], null);
        }
        if (table === 'v_ach_david_goliath') {
          if (mode === 'errorDg') return resultQuery(null, { message:'statement timeout' });
          if (mode === 'empty') return resultQuery([], null);
          return resultQuery([{ code:'david_and_goliath', cnt:1, xp:100 }], null);
        }
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
    function normLocal(v){ return String(v || '').replace(/\s+/g, ' ').trim(); }
    const sectionText = title => normLocal((sec(title) || {}).textContent || '');
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

async function metaScenario(n){
  const { browser, page } = await H.launch({ width:390, height:844 });
  await H.boot(page, { settle:2500 });
  await FX.install(page);
  const result = await page.evaluate(async (n) => {
    const resultQuery = (data, error) => {
      const q = { select(){ return q; }, eq(){ return q; }, then(res){ res({ data, error }); }, catch(){ return q; } };
      return q;
    };
    const rows = Array.from({ length:n }, (_, i) => ({ code:'test_code_' + i, cnt:1, xp:1 }));
    const wrapped = { from(table){
      if (table === 'v_ach_base') return resultQuery(rows, null);
      if (table === 'v_ach_david_goliath') return resultQuery([], null);
      return resultQuery([], null);
    }};
    window.sb = wrapped; window.__sb = wrapped;
    const state = await window.SQ_ACH.forPlayerId('p1');
    return { available:state.available, collector:state.map.collector || null, trophyHunter:state.map.trophy_hunter || null };
  }, n);
  await browser.close();
  return result;
}

(async () => {
  const success = await scenario('success');
  check('cold Player Stats performs one v_player_xp read', success.ui.calls.v_player_xp === 1, JSON.stringify(success.ui.calls));
  check('success reads v_ach_base once by player id', success.ui.calls.v_ach_base === 1, JSON.stringify(success.ui.calls));
  check('success reads David & Goliath once by player id', success.ui.calls.v_ach_david_goliath === 1, JSON.stringify(success.ui.calls));
  check('combined v_player_achievements hot path is no longer used by Player Stats', !success.ui.calls.v_player_achievements, JSON.stringify(success.ui.calls));
  check('success reads Misfires once by resolved player id', success.ui.calls.v_player_misfires === 1, JSON.stringify(success.ui.calls));
  check('split sources merge into earned Trophy Vault count', success.ui.vaultCount === '2 / 58', success.ui.vaultCount);
  check('split sources preserve positive section counts', /0 \/ 15 unlocked/.test(success.ui.milestones) && /2 \/ 43 unlocked/.test(success.ui.trophies), success.ui.milestones + ' | ' + success.ui.trophies);
  check('Misfires remain available on success', /2 \/ 8 unlocked/.test(success.ui.misfires) && /4 historical occurrences/.test(success.ui.misfires), success.ui.misfires);

  for (const mode of ['errorBase','errorDg']) {
    const failed = await scenario(mode);
    check(mode + ': either positive source failure is not rendered as 0/58', failed.ui.vaultCount === '— / 58', failed.ui.vaultCount);
    check(mode + ': failure is explicitly labelled unavailable', /Achievement history unavailable/i.test(failed.ui.vaultSub) && /Achievement history is unavailable right now/i.test(failed.ui.vaultShelf), failed.ui.vaultSub + ' | ' + failed.ui.vaultShelf);
    check(mode + ': failed history uses dash section counts', /— \/ 15 unlocked/.test(failed.ui.milestones) && /— \/ 43 unlocked/.test(failed.ui.trophies), failed.ui.milestones + ' | ' + failed.ui.trophies);
    check(mode + ': Misfires still render independently', /2 \/ 8 unlocked/.test(failed.ui.misfires) && /4 historical occurrences/.test(failed.ui.misfires), failed.ui.misfires);
    check(mode + ': failure path still performs only one XP read', failed.ui.calls.v_player_xp === 1, JSON.stringify(failed.ui.calls));
  }

  const empty = await scenario('empty');
  check('successful empty split history remains a genuine zero state', empty.ui.vaultCount === '0 / 58' && /No trophies yet/i.test(empty.ui.vaultShelf), empty.ui.vaultCount + ' | ' + empty.ui.vaultShelf);
  check('successful empty sections remain real zero counts', /0 \/ 15 unlocked/.test(empty.ui.milestones) && /0 \/ 43 unlocked/.test(empty.ui.trophies), empty.ui.milestones + ' | ' + empty.ui.trophies);

  const meta10 = await metaScenario(10);
  check('Collector is derived at 10 distinct positive base codes', meta10.available && meta10.collector && meta10.collector.cnt === 1 && meta10.collector.xp === 150 && !meta10.trophyHunter, JSON.stringify(meta10));
  const meta20 = await metaScenario(20);
  check('Trophy Hunter is derived at 20 distinct positive base codes', meta20.available && meta20.collector && meta20.trophyHunter && meta20.trophyHunter.cnt === 1 && meta20.trophyHunter.xp === 350, JSON.stringify(meta20));

  const allErrs = [success, await scenario('errorBase'), await scenario('errorDg'), empty]
    .flatMap(x => x.consoleErrs || [])
    .filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', allErrs.length === 0, allErrs.slice(0,5).join(' | '));

  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
