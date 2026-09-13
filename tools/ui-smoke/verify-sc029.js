const H = require('./harness');
const FX = require('./pstats-fixture');
const assert = require('assert/strict');
let checks = 0;
const hub = '.sq-player-stats-hub';
function check(label, ok, detail){ assert.ok(ok, label + (detail ? ': ' + JSON.stringify(detail) : '')); checks++; console.log('PASS  ' + label); }
async function scenario(width){
  const { browser, page, consoleErrs } = await H.launch({ width, height:844 });
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
  try{
    await H.boot(page); await FX.install(page);
    await page.evaluate(() => {
      const from = window.sb.from.bind(window.sb); window.__sc029Reads = {};
      window.sb.from = table => { window.__sc029Reads[table] = (window.__sc029Reads[table] || 0) + 1; return from(table); };
      openPlayerStatsHub('Alex S');
    });
    await page.waitForSelector(hub + ' .pp-hero'); await page.waitForTimeout(900);
    const before = await page.locator(hub).evaluate(el => {
      const body=el.querySelector('.menu-modal-body'), profile=el.querySelector('.sq-player-stats-profile');
      const tabs=[...profile.querySelectorAll('.pp-tab')], name=profile.querySelector('.pp-hero-name'), nameRow=name&&name.parentElement, chip=nameRow&&nameRow.children[1];
      const nr=nameRow&&nameRow.getBoundingClientRect(), cr=chip&&chip.getBoundingClientRect();
      return { profileTop:profile.getBoundingClientRect().top, menuTop:el.querySelector('.menu-list').getBoundingClientRect().top,
        tabWidths:tabs.map(t=>t.getBoundingClientRect().width), power:profile.querySelector('.pp-tile-value')?.textContent||'',
        chipRight:nr&&cr?nr.right-cr.right:999, chipAfterName:!!(cr&&name&&cr.left>=name.getBoundingClientRect().right-1),
        overflow:[el,...el.querySelectorAll('*')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1&&!['hidden','clip'].includes(getComputedStyle(e).overflowX)).map(e=>({cls:e.className,w:e.clientWidth,sw:e.scrollWidth})),
        reads:{...(window.__sc029Reads||{})}, bodyScroll:body.scrollTop };
    });
    check(width + ': Power Rank renders canonical fixture value', before.power === '8.75 (#3)', before);
    check(width + ': hero uses lightweight official-game source', (before.reads.v_player_game_scores_official_clean||0)>=1 && !before.reads.v_power_rankings_last56_official_clean, before.reads);
    check(width + ': STATS / XP / ACHIEVEMENTS are equal width', Math.max(...before.tabWidths)-Math.min(...before.tabWidths)<=1.5, before.tabWidths);
    check(width + ': level chip is at right edge of name row', Math.abs(before.chipRight)<=2 && before.chipAfterName, before);
    check(width + ': no horizontal overflow', !before.overflow.length, before.overflow);
    await page.locator(hub + ' .menu-row').last().scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
    const after = await page.locator(hub).evaluate(el => { const body=el.querySelector('.menu-modal-body'), profile=el.querySelector('.sq-player-stats-profile'); return {profileTop:profile.getBoundingClientRect().top,menuTop:el.querySelector('.menu-list').getBoundingClientRect().top,scrollTop:body.scrollTop}; });
    check(width + ': submenu rows scroll', after.scrollTop>0 && after.menuTop<before.menuTop, {before,after});
    check(width + ': profile and tabs stay fixed', Math.abs(after.profileTop-before.profileTop)<=2, {before,after});
    const unexpected=consoleErrs.filter(e=>!/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
    check(width + ': no new console or JavaScript errors', !unexpected.length&&!pageErrors.length, {unexpected,pageErrors});
  } finally { await browser.close(); }
}
(async()=>{ for(const width of [390,320]) await scenario(width); console.log(`ALL PASS (${checks} checks)`); })().catch(e=>{console.error(e);process.exit(1);});
