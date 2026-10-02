// SC-010/SC-026 regression: honest positive-achievement state on the split read path.
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
        if (table === 'v_player_xp' && mode === 'hydrated_error') return resultQuery(null, { message:'statement timeout' });
        if ((table === 'v_player_xp' && mode === 'xp_hang') ||
            (table === 'v_player_misfires' && mode === 'misfire_hang') ||
            ((table === 'v_ach_base' || table === 'v_ach_david_goliath') && mode === 'positive_hang')) {
          const q = {
            select(){ return q; }, eq(){ return q; }, ilike(){ return q; }, or(){ return q; }, order(){ return q; }, limit(){ return q; },
            then(){ /* deliberately never settles: production statement-timeout/hung-request regression */ },
            catch(){ return q; }
          };
          return q;
        }
        if ((table === 'v_ach_base' || table === 'v_ach_david_goliath') && mode === 'error') {
          return resultQuery(null, { message:'statement timeout' });
        }
        if ((table === 'v_ach_base' || table === 'v_ach_david_goliath') && mode === 'empty') {
          return resultQuery([], null);
        }
        return baseFrom(table);
      }
    };
    window.sb = wrapped; window.__sb = wrapped;
    if (window.SQ_XP){
      window.SQ_XP._cache = null; window.SQ_XP._cacheAt = 0; window.SQ_XP._inflight = null;
      try{ window.SQ_XP._oneCache && window.SQ_XP._oneCache.clear(); }catch(_){}
      try{ window.SQ_XP._oneInflight && window.SQ_XP._oneInflight.clear(); }catch(_){}
    }
    if (window.SQ_ACH){
      window.SQ_ACH._playerDirectoryCache = null;
      window.SQ_ACH._playerDirectoryCacheAt = 0;
      window.SQ_ACH._playerDirectoryInflight = null;
    }
  }, mode);

  await page.evaluate(() => window.openPlayerStatsHub('Alex S'));
  await page.locator('.sq-player-stats-hub .pp-tab').first().waitFor({ state:'visible', timeout:2000 });
  if (mode === 'hydrated' || mode === 'hydrated_error') {
    await page.locator('.sq-player-stats-hub .pp-tile-label').first().waitFor({ state:'visible', timeout:6000 });
    // Healthy loaded history can be reused. Failed aggregate-backed history
    // must reopen through dedicated sources, rather than reusing failure.
    await page.evaluate(() => { window.__sc010Calls = {}; });
  }
  await page.evaluate(() => {
    window.__testProfileTabs = Array.from(document.querySelectorAll('.sq-player-stats-hub .pp-tab')).map(b => b.textContent.trim());
    const btn = Array.from(document.querySelectorAll('.sq-player-stats-hub .pp-tab')).find(b => /^achievements$/i.test(b.textContent.trim()));
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
  check('Achievements starts one scoped v_player_xp read for aggregate Misfire XP', success.ui.calls.v_player_xp === 1, JSON.stringify(success.ui.calls));
  check('Achievements does not touch slow target-profile analytics before rendering', !success.ui.calls.v_player_last30_targets && !success.ui.calls.v_player_last30_target_rates, JSON.stringify(success.ui.calls));
  check('success reads v_ach_base once by resolved player id', success.ui.calls.v_ach_base === 1, JSON.stringify(success.ui.calls));
  check('success reads v_ach_david_goliath once by resolved player id', success.ui.calls.v_ach_david_goliath === 1, JSON.stringify(success.ui.calls));
  check('success does not use combined v_player_achievements hot path', !success.ui.calls.v_player_achievements, JSON.stringify(success.ui.calls));
  check('success reads Misfires once by resolved player id', success.ui.calls.v_player_misfires === 1, JSON.stringify(success.ui.calls));
  check('successful history renders earned Trophy Vault count', success.ui.vaultCount === '2 / 58', success.ui.vaultCount);
  check('successful history preserves real section counts', /0 \/ 15 unlocked/.test(success.ui.milestones) && /2 \/ 43 unlocked/.test(success.ui.trophies), success.ui.milestones + ' | ' + success.ui.trophies);
  check('Misfires remain available on success', /3 \/ 11 unlocked/.test(success.ui.misfires) && /6 historical occurrences/.test(success.ui.misfires), success.ui.misfires);

  const xpHang = await scenario('xp_hang');
  check('a never-settling XP request does not block the Trophy Vault', xpHang.ui.vaultCount === '2 / 58', xpHang.ui.vaultCount);
  check('a never-settling XP request does not block positive achievement sections', /0 \/ 15 unlocked/.test(xpHang.ui.milestones) && /2 \/ 43 unlocked/.test(xpHang.ui.trophies), xpHang.ui.milestones + ' | ' + xpHang.ui.trophies);
  check('a never-settling XP request does not block Misfire history', /3 \/ 11 unlocked/.test(xpHang.ui.misfires) && /6 historical occurrences/.test(xpHang.ui.misfires), xpHang.ui.misfires);
  check('XP hang path starts one XP request without slow target analytics', xpHang.ui.calls.v_player_xp === 1 && !xpHang.ui.calls.v_player_last30_targets && !xpHang.ui.calls.v_player_last30_target_rates, JSON.stringify(xpHang.ui.calls));

  const misfireHang = await scenario('misfire_hang');
  check('hung Misfire history cannot hide successful positive achievements', misfireHang.ui.vaultCount === '2 / 58', misfireHang.ui.vaultCount);
  check('hung Misfire history is honestly pending, with no invented count', /Loading Misfire history/.test(misfireHang.ui.misfires) && /— \/ 11/.test(misfireHang.ui.misfires), misfireHang.ui.misfires);
  check('optional XP does not compete with pending history', !misfireHang.ui.calls.v_player_xp, JSON.stringify(misfireHang.ui.calls));

  const positiveHang = await scenario('positive_hang');
  check('hung positive history cannot hide successful Misfires', /3 \/ 11 unlocked/.test(positiveHang.ui.misfires) && /6 historical occurrences/.test(positiveHang.ui.misfires), positiveHang.ui.misfires);
  check('hung positive history is honestly pending, with no false zero', positiveHang.ui.vaultCount === '— / 58' && /Loading achievement history/.test(positiveHang.ui.vaultSub), positiveHang.ui.vaultCount + ' | ' + positiveHang.ui.vaultSub);

  const hydrated = await scenario('hydrated');
  check('healthy hydrated history is reused without duplicate queries', Object.keys(hydrated.ui.calls).length === 0, JSON.stringify(hydrated.ui.calls));
  check('hydrated hub preserves real achievement and Misfire counts', hydrated.ui.vaultCount === '2 / 58' && /6 historical occurrences/.test(hydrated.ui.misfires), hydrated.ui.vaultCount + ' | ' + hydrated.ui.misfires);

  const hydratedError = await scenario('hydrated_error');
  check('failed hydrated history recovers through dedicated sources', hydratedError.ui.calls.v_ach_base === 1 && hydratedError.ui.calls.v_ach_david_goliath === 1 && hydratedError.ui.calls.v_player_misfires === 1 && !hydratedError.ui.calls.v_player_last30_targets, JSON.stringify(hydratedError.ui.calls));
  check('failed aggregate XP cannot hide real hydrated-hub history', hydratedError.ui.vaultCount === '2 / 58' && /6 historical occurrences/.test(hydratedError.ui.misfires), hydratedError.ui.vaultCount + ' | ' + hydratedError.ui.misfires);

  const failed = await scenario('error');
  check('split achievement fetch failure is not rendered as 0/58', failed.ui.vaultCount === '— / 58', failed.ui.vaultCount);
  check('split achievement fetch failure is explicitly labelled unavailable', /Achievement history unavailable/i.test(failed.ui.vaultSub) && /Achievement history is unavailable right now/i.test(failed.ui.vaultShelf), failed.ui.vaultSub + ' | ' + failed.ui.vaultShelf);
  check('failed history uses dash counts, not false zero section counts', /— \/ 15 unlocked/.test(failed.ui.milestones) && /— \/ 43 unlocked/.test(failed.ui.trophies), failed.ui.milestones + ' | ' + failed.ui.trophies);
  check('Misfires still render when positive split reads fail', /3 \/ 11 unlocked/.test(failed.ui.misfires) && /6 historical occurrences/.test(failed.ui.misfires), failed.ui.misfires);
  check('failure path still avoids combined v_player_achievements', !failed.ui.calls.v_player_achievements, JSON.stringify(failed.ui.calls));

  const empty = await scenario('empty');
  check('successful empty split history remains a genuine zero state', empty.ui.vaultCount === '0 / 58' && /No trophies yet/i.test(empty.ui.vaultShelf), empty.ui.vaultCount + ' | ' + empty.ui.vaultShelf);
  check('successful empty sections remain real zero counts', /0 \/ 15 unlocked/.test(empty.ui.milestones) && /0 \/ 43 unlocked/.test(empty.ui.trophies), empty.ui.milestones + ' | ' + empty.ui.trophies);

  const errs = [...success.consoleErrs, ...xpHang.consoleErrs, ...misfireHang.consoleErrs, ...positiveHang.consoleErrs, ...hydrated.consoleErrs, ...hydratedError.consoleErrs, ...failed.consoleErrs, ...empty.consoleErrs].filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', errs.length === 0, errs.slice(0,5).join(' | '));

  const fs = require('fs');
  const path = require('path');
  const corePre = fs.readFileSync(path.join(__dirname, '../../src/legacy/quarantine/core-pre-modals.js'), 'utf8');
  check('match metadata uses canonical target_wins without a known-failing targetWins probe',
    corePre.includes("select('id,created_at,players,wins,history,total_games,target_wins')") &&
    !corePre.includes('targetWins,target_wins'));

  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
