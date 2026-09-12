// SC-028: original profile moves to the hub; navigation reuses loaded panels.
const H = require('./harness');
const FX = require('./pstats-fixture');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const shots = process.env.SQ_SCREENSHOTS || path.resolve(__dirname, '../../output/playwright');
fs.mkdirSync(shots, { recursive:true });
let checks = 0;
function check(label, ok, detail) { assert.ok(ok, label + (detail ? ': ' + JSON.stringify(detail) : '')); checks++; console.log('PASS  ' + label); }
const hubSel = '.sq-player-stats-hub';
const childSel = '.sq-stats-modal';
async function fit(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { fits:r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
      overflow:[el, ...el.querySelectorAll(el.classList.contains('sq-player-stats-hub') ? '*' : '.modal-body')].filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 1 && !['hidden','clip'].includes(getComputedStyle(e).overflowX)).map(e => ({ cls:e.className, w:e.clientWidth, sw:e.scrollWidth })) };
  });
}
async function scenario(width) {
  const { browser, page, consoleErrs } = await H.launch({ width, height:844 });
  try {
    await H.boot(page);
    await FX.install(page);
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.evaluate(() => {
      const fetchGames = window.cloudFetchAllGamesAsLocal;
      window.__sc028GamesReads = 0;
      window.cloudFetchAllGamesAsLocal = async () => { // The unchanged home live printer also polls games in the background.
        if (!String(new Error().stack).includes('lpBuildDerivedPrinterItems')) window.__sc028GamesReads++;
        return fetchGames(); };
      const from = window.sb.from.bind(window.sb);
      window.__sc028Reads = {};
      window.sb.from = table => {
        window.__sc028Reads[table] = (window.__sc028Reads[table] || 0) + 1;
        const q = from(table);
        // Latest Matches uses these filters; its fixture has no match rows.
        q.is = q.not = q.in = q.gte = q.lte = q.range = () => q;
        return q;
      };
      openPlayerStatsHub('Alex S');
    });
    await page.waitForSelector(hubSel + ' .pp-hero');
    await page.waitForTimeout(1100);
    const original = await page.locator(hubSel).evaluate(el => {
      window.__sc028Hero = el.querySelector('.pp-hero');
      return { text:el.innerText, tiles:[...el.querySelectorAll('.pp-tile-value')].map(x => x.textContent),
        rows:[...el.querySelectorAll('.menu-row-title')].map(x => x.textContent), tabs:[...el.querySelectorAll('.pp-tab')].map(x => x.textContent),
        reads:{ ...window.__sc028Reads }, games:window.__sc028GamesReads,
        headerFirst:el.querySelector('.menu-modal-body').firstElementChild.className === 'sq-player-stats-profile',
        beforeRows:el.querySelector('.pp-tabs').getBoundingClientRect().bottom < el.querySelector('.menu-list').getBoundingClientRect().top };
    });
    check(width + ': complete existing live profile on hub', /Alex S/.test(original.text) && /The Atomic/.test(original.text) && /LV 2/.test(original.text) && /ROOKIE/.test(original.text) && /151 XP/.test(original.text) && /33 TO LEVEL 3/i.test(original.text));
    check(width + ': unchanged calculated values', JSON.stringify(original.tiles) === JSON.stringify(['8.75 (#3)','5','126.0']), original.tiles);
    check(width + ': profile and primary buttons before hub rows', original.headerFirst && original.beforeRows);
    check(width + ': exactly three primary controls', JSON.stringify(original.tabs) === JSON.stringify(['Stats','XP','Achievements']));
    check(width + ': old Player Stats row gone; all nine other rows remain', JSON.stringify(original.rows) === JSON.stringify(['Level Ladder','Latest Matches','Player High Scores','Progression','Practice Stats','Target Hit %','Target Points %','Player H2H','H2H Matchups (Coming Soon)']), original.rows);
    check(width + ': one games load and one XP/split achievement read', original.games === 1 && original.reads.v_player_xp === 1 && original.reads.v_ach_base === 1 && original.reads.v_ach_david_goliath === 1 && !original.reads.v_player_achievements, original);
    const hubFit = await fit(page, hubSel);
    check(width + ': hub fits without horizontal overflow', hubFit.fits && !hubFit.overflow.length, hubFit);
    await page.screenshot({ path:path.join(shots, `sc028-hub-${width}.png`) });
    await page.locator(hubSel + ' .menu-row').last().scrollIntoViewIfNeeded();
    check(width + ': last menu option reachable by vertical scrolling', await page.locator(hubSel + ' .menu-modal-body').evaluate(el => el.scrollTop > 0));
    check(width + ': Back and Close remain in viewport', await page.locator(hubSel + ' .menu-modal-header').evaluate(el => [...el.querySelectorAll('button')].every(b => { const r=b.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight; })));
    await page.locator(hubSel + ' .menu-modal-body').evaluate(el => el.scrollTop = 0);
    for (const [idx,label,content] of [[0,'Stats','Quick Stats'],[1,'XP','XP & Level'],[2,'Achievements','TROPHY VAULT']]) {
      await page.locator(hubSel + ' .pp-tab').nth(idx).click();
      await page.waitForTimeout(1200);
      const child = page.locator(childSel);
      check(width + ': ' + label + ' opens original content only', (await child.innerText()).toLowerCase().includes(content.toLowerCase()) && await page.locator('.pp-hero').count() === 0 && await page.locator(childSel + ' .pp-tabs').count() === 0);
      const childFit = await fit(page, childSel);
      check(width + ': ' + label + ' fits', childFit.fits && !childFit.overflow.length, childFit);
      await page.screenshot({ path:path.join(shots, `sc028-${label.toLowerCase()}-${width}.png`) });
      await child.locator('.modal-footer button').filter({ hasText:idx === 1 ? /^Close$/i : /BACK/i }).click();
      await page.waitForSelector(hubSel + ' .pp-hero');
      check(width + ': return restores the same single header and active button', await page.evaluate(idx => document.querySelector('.pp-hero') === window.__sc028Hero && document.querySelectorAll('.pp-hero').length === 1 && document.querySelectorAll('.pp-tab')[idx].classList.contains('active'), idx));
    }
    check(width + ': entering/returning from panels adds no reads', await page.evaluate(original => JSON.stringify(window.__sc028Reads) === JSON.stringify(original.reads) && window.__sc028GamesReads === original.games, original));
    await page.locator(hubSel + ' .pp-tab').first().click();
    await page.keyboard.press('Escape');
    await page.waitForSelector(hubSel);
    check(width + ': Escape returns without a stale stack entry', await page.evaluate(() => !document.querySelector('.sq-stats-modal') && (window.__sqModalStack || []).length === 0));
    for (const title of ['Level Ladder','Latest Matches']) {
      await page.locator(hubSel + ' .menu-row').filter({ has:page.locator('.menu-row-title', { hasText:new RegExp('^' + title + '$') }) }).click();
      await page.waitForSelector(childSel + ' .modal-footer');
      check(width + ': ' + title + ' unchanged route opens', await page.locator(hubSel).count() === 0 && (await page.locator(childSel).innerText()).toLowerCase().includes(title.toLowerCase()));
      await page.locator(childSel + ' .modal-footer button').filter({ hasText:/BACK/i }).click();
      await page.waitForSelector(hubSel + ' .pp-hero');
    }
    await page.locator(hubSel + ' [aria-label="Back"]').click();
    await page.waitForSelector('.ps-pick-search');
    check(width + ': hub Back returns to player picker', await page.locator(hubSel).count() === 0);
    await page.getByRole('button', { name:'Close', exact:true }).click();
    await page.evaluate(() => openPlayerStatsDialog('Sam T'));
    await page.waitForSelector(childSel + ' .pp-cards');
    check(width + ': direct Stats callers have content without header', await page.locator('.pp-hero').count() === 0);
    await page.locator(childSel + ' .modal-footer button').filter({ hasText:/BACK/i }).click();
    await page.waitForSelector(hubSel + ' .pp-hero');
    check(width + ': direct caller Back selects correct player', await page.locator('.pp-hero-name').textContent() === 'Sam T');
    await page.locator(hubSel + ' [aria-label="Close"]').click();
    check(width + ': hub Close exits', await page.locator(hubSel).count() === 0);
    await page.evaluate(() => openPlayerStatsHub('Jo R'));
    await page.waitForSelector(hubSel + ' .pp-tab');
    check(width + ': zero-game player keeps truthful empty state', /No official games/.test(await page.locator(hubSel).innerText()) && await page.locator('.pp-tile').count() === 0);
    const unexpected = consoleErrs.filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
    check(width + ': no new console or JavaScript errors', !unexpected.length && !pageErrors.length, { unexpected, pageErrors });
  } finally { await browser.close(); }
}
(async () => { for (const width of process.env.SQ_WIDTH ? [Number(process.env.SQ_WIDTH)] : [390,320]) await scenario(width); console.log(`ALL PASS (${checks} checks)`); })().catch(e => { console.error(e); process.exit(1); });
