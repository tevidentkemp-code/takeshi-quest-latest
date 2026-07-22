// Saving a new player from the Match Setup screen must: (1) close the Add
// Player dialog, and (2) drop that player onto the Match Card. Repeats per save.
//
// The save path uses the module-scoped `sb` client, so we install a fake
// window.supabase BEFORE boot (locking it so the real UMD can't overwrite it)
// and abort the UMD route. Every query resolves empty; upsert resolves ok.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const APP_URL = process.env.SQ_APP_URL || 'http://localhost:8123/index.html';
const CHROMIUM = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

let failures = 0;
const check = (name, ok, detail) => { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); };

(async () => {
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  // Fake supabase client, locked so the (blocked) UMD can't clobber it.
  await ctx.addInitScript(() => {
    const mkQuery = () => {
      const base = {
        then: (res) => res({ data: [], error: null }),
        catch() { return proxy; },
        upsert: () => Promise.resolve({ data: [{ id: 'new-id' }], error: null }),
        insert: () => Promise.resolve({ data: [{ id: 'new-id' }], error: null }),
      };
      // Any other builder method (select/eq/is/in/order/...) returns the chain.
      const proxy = new Proxy(base, { get(t, prop) { if (prop in t) return t[prop]; return () => proxy; } });
      return proxy;
    };
    const fake = { from: () => mkQuery(), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
    const supa = { createClient: () => fake };
    try { Object.defineProperty(window, 'supabase', { value: supa, writable: false, configurable: false }); } catch (_) { window.supabase = supa; }
  });

  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('supabase')) return route.abort('failed'); // keep our fake
    if (url.includes('supabase.co')) return route.abort('failed');
    if (url.startsWith(APP_URL.split('/index.html')[0])) return route.continue();
    return route.abort('failed');
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('dialog', (d) => d.accept());

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const b = document.getElementById('bootSplash'); return !b || b.hidden || getComputedStyle(b).display === 'none' || getComputedStyle(b).opacity === '0'; }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // Reach the Match Card / setup screen.
  await page.click('#startGameBtn'); await page.waitForTimeout(400);
  await page.click('#questBtn'); await page.waitForTimeout(400);
  await page.click('#matchClassicBtn'); await page.waitForTimeout(700);
  check('Match Setup reached (register btn visible)', await page.isVisible('#msRegisterPlayerBtn'));

  async function saveNewPlayer(first) {
    await page.click('#msRegisterPlayerBtn'); await page.waitForTimeout(400);
    const modalOpen = await page.evaluate(() => { const m = document.getElementById('addPlayerModal'); return m && !m.classList.contains('hidden'); });
    check(`Add Player modal open for "${first}"`, modalOpen);
    await page.fill('#newPlayerFirst', first); await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('newPlayerFirst').dispatchEvent(new Event('input', { bubbles: true })));
    await page.waitForTimeout(150);
    await page.click('#savePlayerBtn'); await page.waitForTimeout(900);
  }

  // ---- Save #1 ----
  await saveNewPlayer('Zed');
  let s1 = await page.evaluate(() => ({
    hidden: document.getElementById('addPlayerModal').classList.contains('hidden'),
    names: Array.from(document.querySelectorAll('#msPlayersList .ms-player-name')).map((n) => n.textContent.trim()),
  }));
  const has = (names, who) => names.some((n) => n.toUpperCase().includes(who));
  check('Save #1: Add Player dialog closed', s1.hidden, JSON.stringify(s1));
  check('Save #1: Zed on the match card', has(s1.names, 'ZED'), JSON.stringify(s1.names));

  // ---- Save #2 (repeat) ----
  await saveNewPlayer('Yara');
  let s2 = await page.evaluate(() => ({
    hidden: document.getElementById('addPlayerModal').classList.contains('hidden'),
    names: Array.from(document.querySelectorAll('#msPlayersList .ms-player-name')).map((n) => n.textContent.trim()),
  }));
  check('Save #2: Add Player dialog closed', s2.hidden, JSON.stringify(s2));
  check('Save #2: both Zed and Yara on the card', has(s2.names, 'ZED') && has(s2.names, 'YARA'), JSON.stringify(s2.names));

  // Start button should now be enabled (2 players).
  const startEnabled = await page.evaluate(() => { const b = document.getElementById('startMatchBtn'); return b && !b.disabled; });
  check('Two players => SELECT MATCH LENGTH enabled', startEnabled);

  await page.screenshot({ path: '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/saveplayer-card.png' });
  // Ignore artifacts of the offline fake: the aborted Supabase CDN <script>
  // raises a resource-load Event, surfaced by the app's global error banner.
  const badErrs = errs.filter((e) => !/ERR_FAILED|Failed to load resource|\[object Event\]/.test(e));
  check('no unexpected console errors', badErrs.length === 0, JSON.stringify(badErrs.slice(0, 5)));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
