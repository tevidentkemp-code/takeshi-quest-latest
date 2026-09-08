// SC-014: setup limits, focus-safe async rendering and mobile intake.
// Uses the existing offline harness; no production Supabase reads or writes.
const H = require('./harness');
const fs = require('fs');
const path = require('path');
let failures = 0, total = 0;
function check(name, ok, detail = '') {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ' — ' + detail}`);
}
const shots = process.env.SQ_SCREENSHOTS;
async function screenshot(page, name) {
  if (!shots) return;
  fs.mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true });
}
async function info(page) {
  return page.evaluate(() => ({
    page: document.body.dataset.page,
    mode: document.getElementById('msModeLabel')?.textContent,
    count: document.getElementById('msRosterCount')?.textContent,
    ready: !document.getElementById('startMatchBtn').disabled,
    hint: document.getElementById('msMinHint').textContent,
    players: __msPlayers.length,
    guestsDisabled: document.getElementById('msAddGuestBtn').disabled,
    savedDisabled: document.getElementById('msAddRegisteredBtn').disabled,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
}
async function openMode(page, mode) {
  await H.boot(page, { settle: 500 });
  await page.click('#startGameBtn');
  await page.click(mode === 'classic' || mode === 'turbo' ? '#questBtn' : '#practiceBtn');
  const id = {classic:'matchClassicBtn',turbo:'matchTurboBtn',practice:'practiceClassicBtn',shadow:'practiceVsShadowBtn'}[mode];
  await page.click('#' + id);
}
(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await openMode(page, 'classic');
    let s = await info(page);
    check('Classic empty setup explains the minimum', !s.ready && /2/.test(s.hint));
    check('Classic mode and roster count visible', s.mode === 'CLASSIC' && s.count === '0 / 6 selected');
    await screenshot(page, 'sc014-empty-mobile');
    await page.click('#msAddGuestBtn');
    check('Adding a guest focuses the new name', await page.evaluate(() => document.activeElement === document.querySelector('.ms-player-input')));
    await page.locator('.ms-player-input').fill('QA ALPHA');
    await page.locator('.ms-player-input').press('Enter');
    check('One Classic player cannot start', !(await info(page)).ready);
    await H.addGuests(page, ['QA BRAVO']);
    s = await info(page);
    check('Two Classic players can continue with visible ready state', s.ready && /2 players ready/i.test(s.hint));
    check('Mobile names and remove controls meet size requirements', await page.evaluate(() => {
      const input = document.querySelector('.ms-player-input');
      const remove = document.querySelector('.ms-remove').getBoundingClientRect();
      return parseFloat(getComputedStyle(input).fontSize) >= 16 && remove.width >= 44 && remove.height >= 44;
    }));
    await screenshot(page, 'sc014-ready-mobile');
    await H.addGuests(page, ['QA CHARLIE','QA DELTA','QA ECHO','QA FOXTROT']);
    s = await info(page);
    check('Six players disable both add controls and explain why', s.players === 6 && s.guestsDisabled && s.savedDisabled && /6/.test(s.hint));
    await page.evaluate(() => __msAddGuest());
    check('Direct guest-add cannot bypass six-player cap', (await info(page)).players === 6);
    await page.locator('.ms-remove').last().click();
    s = await info(page);
    check('Removing a player re-enables both add controls', s.players === 5 && !s.guestsDisabled && !s.savedDisabled);
    await page.click('#msAddGuestBtn');
    s = await info(page);
    check('Unnamed guests keep existing exclusion behaviour explicit', s.ready && /unnamed guest.*left out/.test(s.hint));
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      check(`${width}px setup has no horizontal overflow`, !(await info(page)).overflow);
    }
    await page.setViewportSize({ width: 390, height: 844 });

    // A real delayed callback must retain the same input node, caret and name.
    await page.evaluate(() => {
      window.__sc014OriginalRanks = __ms2EnsurePowerRanks;
      window.__ms2PowerRanks = null;
      __ms2EnsurePowerRanks = () => new Promise(resolve => { window.__sc014ResolveRanks = resolve; });
      __msPlayers = [{type:'registered',name:'QA SAVED'}, {type:'guest',name:'QA TYPING'}];
      __msRenderPlayers();
    });
    await page.locator('.ms-player-input').fill('QA TYPING NOW');
    await page.evaluate(() => {
      const input = document.querySelector('.ms-player-input');
      input.focus(); input.setSelectionRange(3, 6);
      window.__sc014Input = input;
      window.__ms2PowerRanks = new Map([['qa saved', 7]]);
      window.__sc014ResolveRanks(window.__ms2PowerRanks);
    });
    check('Delayed rankings preserve input identity, focus, caret and name', await page.evaluate(() => {
      const input = document.querySelector('.ms-player-input');
      return input === window.__sc014Input && document.activeElement === input && input.selectionStart === 3 && input.selectionEnd === 6 && input.value === 'QA TYPING NOW';
    }));
    check('Delayed ranking still appears on the saved player', await page.evaluate(() => /Power Rank:\s*7/.test(document.getElementById('msPlayersList').textContent)));
    await page.evaluate(() => { __ms2EnsurePowerRanks = window.__sc014OriginalRanks; });

    // Exercise the actual navigation and mode-specific setup owners.
    for (const mode of ['turbo', 'practice', 'shadow']) {
      await openMode(page, mode);
      check(`${mode}: correct visible mode`, (await info(page)).mode === ({turbo:'TURBO',practice:'PRACTICE',shadow:'VS SHADOW'}[mode]));
      await H.addGuests(page, ['QA ONE']);
      s = await info(page);
      check(`${mode}: correct minimum`, s.ready === (mode !== 'turbo'));
      if (mode === 'shadow') {
        check('Vs Shadow exposes only one real-player place', s.count === '1 / 1 selected' && s.guestsDisabled && s.savedDisabled);
        await page.evaluate(() => __msAddGuest());
        check('Vs Shadow still rejects a second real player', (await info(page)).players === 1);
      }
      if (mode === 'turbo') await H.addGuests(page, ['QA TWO']);
      await page.click('#startMatchBtn');
      check(`${mode}: match length opens`, await page.isVisible('#matchLengthModal'));
      await page.click('#mlFooterBackBtn');
      check(`${mode}: Back preserves the line-up`, (await info(page)).players === (mode === 'turbo' ? 2 : 1));
      await page.click('#startScreenBtn');
      check(`${mode}: setup Back returns to game mode menu`, await page.isVisible('#startGameModal'));
    }
    await openMode(page, 'classic');
    check('Reload starts with a clean setup', (await info(page)).players === 0 && !(await info(page)).ready);
    const unexpected = consoleErrs.filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(e));
    check('No unexpected console errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
  } finally { await browser.close(); }
  console.log(`\n${total - failures}/${total} passed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
