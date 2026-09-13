// SC-031 synthetic Supabase failure resilience checks.
// No request reaches production: the Supabase CDN is served locally and every
// *.supabase.co request is fulfilled/aborted by Playwright before network egress.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = process.env.SQ_APP_URL || 'http://localhost:8123/index.html';
const UMD = process.env.SQ_SUPABASE_UMD ||
  path.join(__dirname, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
const CASES = [400, 401, 403, 500, 'timeout'];
let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures += 1;
}

async function runCase(browser, failure) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const pageErrors = [];
  const consoleErrors = [];

  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('supabase')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: fs.readFileSync(UMD, 'utf8'),
      });
    }
    if (url.includes('supabase.co')) {
      if (failure === 'timeout') return route.abort('timedout');
      return route.fulfill({
        status: failure,
        contentType: 'application/json',
        body: JSON.stringify({
          code: `SC031_SYNTHETIC_${failure}`,
          message: `Synthetic Supabase ${failure} response for offline resilience test`,
        }),
      });
    }
    if (url.startsWith(APP_URL.split('/index.html')[0])) return route.continue();
    return route.abort('failed');
  });

  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 300)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('dialog', async (dialog) => dialog.accept());

  const label = `Supabase ${failure}`;
  try {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const splash = document.getElementById('bootSplash');
      return !splash || splash.hidden || getComputedStyle(splash).display === 'none' || getComputedStyle(splash).opacity === '0';
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2200);

    check(`${label}: app boots to Home`, await page.evaluate(() => document.body.dataset.page === 'details'));
    check(`${label}: Start Game remains usable`, await page.locator('#startGameBtn').isVisible().catch(() => false));

    await page.click('#startGameBtn');
    await page.waitForTimeout(350);
    check(`${label}: game-mode modal opens`, await page.evaluate(() => {
      const modal = document.getElementById('startGameModal');
      return !!modal && !modal.classList.contains('hidden');
    }));

    await page.click('#questBtn');
    await page.waitForTimeout(250);
    check(`${label}: Classic remains selectable`, await page.locator('#matchClassicBtn').isVisible().catch(() => false));

    await page.click('#matchClassicBtn');
    await page.waitForTimeout(550);
    check(`${label}: local Match Card remains reachable`, await page.evaluate(() => document.body.dataset.page === 'players'));

    const fatal = pageErrors.filter((message) => !/NetworkError|Failed to fetch|fetch failed/i.test(message));
    check(`${label}: no uncaught page error`, fatal.length === 0, fatal.join(' | '));

    // Console network errors are expected in these synthetic cases. We only
    // fail on a first-error banner, which represents an uncaught app crash.
    check(`${label}: no crash banner`, !(await page.$('#firstErrorBanner')),
      consoleErrors.slice(0, 3).join(' | '));
  } catch (error) {
    check(`${label}: journey completes`, false, String(error));
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const failure of CASES) await runCase(browser, failure);
  } finally {
    await browser.close();
  }
  console.log(`\nSC-031 cloud failure resilience: ${failures ? 'FAIL' : 'PASS'}`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error('SC-031 cloud failure resilience CRASH:', error);
  process.exit(2);
});
