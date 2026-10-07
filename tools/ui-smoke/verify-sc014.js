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
// SC-072: WebKit reports the harness-aborted cloud sync as Load failed.
// Require an observed failed cloud GET; do not suppress other runtime errors.
function expectedBlockedPlayerSync(text, observed) {
  return observed && /^syncSavedPlayersFromCloud failed \{message: TypeError: Load failed, details: , hint: , code: \}$/.test(text);
}
// SC-072: exercise all roster densities at the same mobile viewports.
async function checkLineupCards(page, count) {
  const identity = await page.evaluate(() => JSON.stringify(__msPlayers));
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({width, height:844});
    const v = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#msPlayersList .ms2-slot')];
      return {
        cards: cards.map(el => {
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return {empty:el.classList.contains('empty'), h:r.height, x:r.x, right:r.right,
            border:s.borderTopStyle, radius:s.borderTopLeftRadius, bg:s.backgroundColor,
            font:parseFloat(s.fontSize), text:el.textContent.trim()};
        }),
        overflow:document.documentElement.scrollWidth > innerWidth,
        identity:JSON.stringify(__msPlayers),
        count:document.getElementById('msRosterCount').textContent,
        remove:[...document.querySelectorAll('#msPlayersList .ms-remove')].map(el => {
          const r=el.getBoundingClientRect(); return {w:r.width,h:r.height};
        })
      };
    });
    check(`SC072 ${count}/5 at ${width}: solid contained cards`, v.cards.length===5 &&
      v.cards.every(c=>c.border==='solid' && c.radius==='14px' && c.x>=0 && c.right<=width) && !v.overflow);
    check(`SC072 ${count}/5 at ${width}: readable honest empty places`,
      v.cards.filter(c=>c.empty).length===5-count && v.cards.filter(c=>c.empty).every((c,i)=>
        c.h>=52 && c.font>=11 && c.bg==='rgb(16, 24, 39)' &&
        c.text===`${String(count+i+1).padStart(2,'0')}  /  OPEN SLOT`));
    check(`SC072 ${count}/5 at ${width}: selected controls and identity preserved`,
      v.cards.filter(c=>!c.empty).every(c=>c.h>=68) && v.remove.length===count &&
      v.remove.every(r=>r.w>=44 && r.h>=44) && v.identity===identity && v.count===`${count} / 5 selected`);
    await screenshot(page, `sc072-${count}p-${width}`);
  }
  await page.setViewportSize({width:390,height:844});
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
  let blockedCloudReads = 0;
  const pageErrors = [];
  page.on('requestfailed', r => { if(r.method()==='GET' && /^https:\/\/[^/]+\.supabase\.co\//.test(r.url())) blockedCloudReads++; });
  page.on('pageerror', e => pageErrors.push(e.message));
  try {
    await openMode(page, 'classic');
    let s = await info(page);
    check('Classic empty setup explains the minimum', !s.ready && /2/.test(s.hint));
    check('Classic mode and roster count visible', s.mode === 'CLASSIC' && s.count === '0 / 5 selected');
    await screenshot(page, 'sc014-empty-mobile');
    await checkLineupCards(page, 0);
    await page.click('#msAddGuestBtn');
    check('Adding a guest focuses the new name', await page.evaluate(() => document.activeElement === document.querySelector('.ms-player-input')));
    await page.locator('.ms-player-input').fill('QA ALPHA');
    await page.locator('.ms-player-input').press('Enter');
    check('One Classic player cannot start', !(await info(page)).ready);
    await checkLineupCards(page, 1);
    await H.addGuests(page, ['QA BRAVO']);
    s = await info(page);
    check('Two Classic players can continue with visible ready state', s.ready && /2 players ready/i.test(s.hint));
    check('Mobile names and remove controls meet size requirements', await page.evaluate(() => {
      const input = document.querySelector('.ms-player-input');
      const remove = document.querySelector('.ms-remove').getBoundingClientRect();
      return parseFloat(getComputedStyle(input).fontSize) >= 16 && remove.width >= 44 && remove.height >= 44;
    }));
    await screenshot(page, 'sc014-ready-mobile');
    await checkLineupCards(page, 2);
    await H.addGuests(page, ['QA CHARLIE','QA DELTA','QA ECHO']);
    s = await info(page);
    check('Five players disable both add controls and explain why', s.players === 5 && s.guestsDisabled && s.savedDisabled && /5/.test(s.hint));
    await checkLineupCards(page, 5);
    await page.evaluate(() => __msAddGuest());
    check('Direct guest-add cannot bypass five-player cap', (await info(page)).players === 5);
    await page.locator('.ms-remove').last().click();
    s = await info(page);
    check('Removing a player re-enables both add controls', s.players === 4 && !s.guestsDisabled && !s.savedDisabled);
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
    const unexpected = consoleErrs.filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i.test(e) && !expectedBlockedPlayerSync(e, blockedCloudReads > 0));
    check('No unexpected console errors', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));
  check('No uncaught JavaScript errors', pageErrors.length === 0, pageErrors.join(' | '));
  const fixtureMessage='syncSavedPlayersFromCloud failed {message: TypeError: Load failed, details: , hint: , code: }';
  check('Offline noise classifier is scoped', expectedBlockedPlayerSync(fixtureMessage,true) && !expectedBlockedPlayerSync(fixtureMessage,false) && !expectedBlockedPlayerSync('TypeError: Load failed',true) && !expectedBlockedPlayerSync('syncSavedPlayersFromCloud failed {message: ReferenceError: broken}',true));
  console.log('SC072 observed offline cloud GET failures: '+blockedCloudReads);
  } finally { await browser.close(); }
  console.log(`\n${total - failures}/${total} passed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
