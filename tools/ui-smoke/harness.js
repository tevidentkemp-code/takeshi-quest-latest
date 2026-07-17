// Playwright harness for SHATEKI-QUEST UI verification.
// Safety guarantee: every request to *.supabase.co is aborted at the network
// layer, so no run can ever read or write production data. The supabase-js
// CDN script is served from the locally installed npm copy instead.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP_URL = process.env.SQ_APP_URL || 'http://localhost:8123/index.html';
const UMD = process.env.SQ_SUPABASE_UMD ||
  path.join(__dirname, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
const CHROMIUM = process.env.SQ_CHROMIUM ||
  (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

async function launch(viewport, opts = {}) {
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const ctx = await browser.newContext({
    viewport: viewport || { width: 390, height: 844 },
    isMobile: (viewport || { width: 390 }).width < 500,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  if (opts.seedPlayers) {
    await ctx.addInitScript(() => {
      const iso = new Date().toISOString();
      const mk = (id, name, first, last, nick, ini) => ({ id, name, first_name: first, last_name: last, nickname: nick, initials: ini, joinedAt: iso, _src: 'cloud-cache' });
      localStorage.setItem('shateki_players', JSON.stringify([
        mk('audit-test-1', 'TESTA', 'Test', 'Alpha', 'The Auditor', 'TA'),
        mk('audit-test-2', 'TESTB', 'Test', 'Beta', 'The Verifier', 'TB'),
      ]));
    });
  }
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('supabase')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(UMD, 'utf8') });
    }
    if (url.includes('supabase.co')) return route.abort('failed');
    if (url.startsWith(APP_URL.split('/index.html')[0])) return route.continue();
    return route.abort('failed');
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const consoleErrs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrs.push('pageerror: ' + String(e).slice(0, 200)));
  page.on('dialog', async (d) => { await d.accept(); });
  return { browser, ctx, page, consoleErrs };
}

async function boot(page, opts = {}) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const b = document.getElementById('bootSplash');
    return !b || b.hidden || getComputedStyle(b).display === 'none' || getComputedStyle(b).opacity === '0';
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(opts.settle || 2500);
}

// ---- reusable flows -------------------------------------------------------
async function toMatchCard(page) {
  await page.click('#startGameBtn'); await page.waitForTimeout(400);
  await page.click('#questBtn'); await page.waitForTimeout(400);
  await page.click('#matchClassicBtn'); await page.waitForTimeout(700);
}
async function addGuests(page, names) {
  for (const n of names) {
    await page.click('#msAddGuestBtn'); await page.waitForTimeout(250);
    const inputs = await page.$$('#msPlayersList input');
    await inputs[inputs.length - 1].fill(n);
    await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  }
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(300);
}
async function startMatch(page, games = 1) {
  await page.click('#startMatchBtn'); await page.waitForTimeout(500);
  const cells = await page.$$('#mlGrid button');
  if (cells[games - 1]) await cells[games - 1].click(); else if (cells[0]) await cells[0].click();
  await page.waitForTimeout(300);
  await page.click('#mlStartBtn'); await page.waitForTimeout(800);
  const btns = await page.$$('.modal-backdrop:not(.hidden) button');
  for (const bb of btns) {
    const t = (await bb.textContent() || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (/^START GAME/.test(t)) { await bb.click(); break; }
  }
  await page.waitForFunction(() => document.body.dataset.page === 'game', { timeout: 15000 });
  await page.waitForTimeout(2000);
}
// Asymmetric scoring so games never end in a draw.
async function playToCompletion(page) {
  let turn = 0;
  for (let i = 0; i < 160; i++) {
    const info = await page.evaluate(() => ({
      pg: document.body.dataset.page,
      modal: !!document.querySelector('.modal-backdrop:not(.hidden)'),
    }));
    if (info.pg !== 'game' || info.modal) break;
    if (turn % 2 === 1) {
      const x3 = await page.$('#pad button.dtX3:not([disabled])');
      if (x3) await x3.click().catch(() => {});
    } else {
      for (let d = 0; d < 3; d++) {
        const s = await page.$('#pad button.dtBullBtn:not([disabled])') || await page.$('#pad button:not([disabled])');
        if (s) await s.click().catch(() => {});
        await page.waitForTimeout(220);
      }
    }
    turn++;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
}

// Visible-UI snapshot used for regression diffing.
async function domSnapshot(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetParent !== null || (getComputedStyle(el).position === 'fixed' && getComputedStyle(el).display !== 'none'));
    const btns = Array.from(document.querySelectorAll('button')).filter(vis)
      .map((b) => ({ id: b.id || null, cls: String(b.className).trim(), t: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), aria: b.getAttribute('aria-label') }));
    const modals = Array.from(document.querySelectorAll('.modal-backdrop')).filter((m) => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none')
      .map((m) => ({ id: m.id || '(dyn)', cls: m.className }));
    return { page: document.body.dataset.page, modals, buttons: btns };
  });
}

module.exports = { launch, boot, toMatchCard, addGuests, startMatch, playToCompletion, domSnapshot, APP_URL };
