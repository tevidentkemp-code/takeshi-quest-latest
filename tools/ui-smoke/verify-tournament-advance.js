// Tournament setup: single-select steps (type, size) must AUTO-ADVANCE on
// selection — no Next button, only Back — matching Match Play / Practice.
// The multi-select Players step and final Tree step keep their confirm button.
const { chromium } = require('playwright');
const fs = require('fs');
const APP_URL = process.env.SQ_APP_URL || 'http://localhost:8123/index.html';
const CHROMIUM = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

let failures = 0;
const check = (name, ok, detail) => { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); };

(async () => {
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  await ctx.addInitScript(() => {
    // Seed local saved players so the Players step has a roster offline.
    const iso = new Date().toISOString();
    const mk = (id, name) => ({ id, name, first_name: name, last_name: '', nickname: '', initials: name.slice(0, 2).toUpperCase(), joinedAt: iso, _src: 'cloud-cache' });
    localStorage.setItem('shateki_players', JSON.stringify([mk('t1', 'Anna'), mk('t2', 'Bram'), mk('t3', 'Cleo'), mk('t4', 'Dane'), mk('t5', 'Elle'), mk('t6', 'Finn'), mk('t7', 'Gwen'), mk('t8', 'Hugo')]));
    // Locked fake supabase so cloud reads resolve empty instead of hanging.
    const mkQuery = () => {
      const base = { then: (res) => res({ data: [], error: null }), catch() { return proxy; }, upsert: () => Promise.resolve({ data: [], error: null }), insert: () => Promise.resolve({ data: [], error: null }) };
      const proxy = new Proxy(base, { get(t, p) { return (p in t) ? t[p] : () => proxy; } });
      return proxy;
    };
    const fake = { from: () => mkQuery(), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
    try { Object.defineProperty(window, 'supabase', { value: { createClient: () => fake }, writable: false, configurable: false }); } catch (_) { window.supabase = { createClient: () => fake }; }
  });
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('supabase')) return route.abort('failed');
    if (url.includes('supabase.co')) return route.abort('failed');
    if (url.startsWith(APP_URL.split('/index.html')[0])) return route.continue();
    return route.abort('failed');
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const b = document.getElementById('bootSplash'); return !b || b.hidden || getComputedStyle(b).display === 'none' || getComputedStyle(b).opacity === '0'; }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const head = () => page.evaluate(() => (document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '');
  const footerInfo = () => page.evaluate(() => {
    const ft = document.querySelector('#startGameModalBody .modal-footer');
    if (!ft) return { hasBack: false, hasNext: false };
    const btns = Array.from(ft.querySelectorAll('button'));
    return {
      hasBack: btns.some((b) => /back/i.test(b.textContent)),
      hasNext: btns.some((b) => /next/i.test(b.textContent)),
    };
  });
  const clickPill = (label) => page.evaluate((lbl) => {
    const pill = Array.from(document.querySelectorAll('#startGameModalBody .sg-tournament-pill')).find((p) => (p.querySelector('.sg-tournament-pill-title') || {}).textContent.toUpperCase().includes(lbl));
    if (pill) pill.click();
    return !!pill;
  }, label);

  // Open SELECT GAME MODE and enter Tournament.
  await page.click('#startGameBtn'); await page.waitForTimeout(500);
  await page.click('#tournamentBtn'); await page.waitForTimeout(600);

  // Step 0: TYPE — only Back, no Next.
  check('Type step shown', /TOURNAMENT MODE/i.test(await head()), await head());
  let f = await footerInfo();
  check('Type step: Back present', f.hasBack, JSON.stringify(f));
  check('Type step: NO Next button (auto-advance)', !f.hasNext, JSON.stringify(f));

  // Push CLASSIC => should auto-advance to SIZE.
  check('CLASSIC pill found', await clickPill('CLASSIC')); await page.waitForTimeout(500);
  check('Selecting type auto-advanced to SIZE', /TOURNAMENT SIZE/i.test(await head()), await head());
  f = await footerInfo();
  check('Size step: Back present', f.hasBack, JSON.stringify(f));
  check('Size step: NO Next button (auto-advance)', !f.hasNext, JSON.stringify(f));

  // Push 4 PLAYERS => should auto-advance to SELECT PLAYERS.
  check('4 PLAYERS pill found', await clickPill('4 PLAYERS')); await page.waitForTimeout(500);
  check('Selecting size auto-advanced to SELECT PLAYERS', /SELECT PLAYERS/i.test(await head()), await head());

  // Players step is multi-select => a confirm (Next) is expected here.
  f = await footerInfo();
  check('Players step: Back present', f.hasBack, JSON.stringify(f));
  check('Players step: keeps a Next (multi-select confirm)', f.hasNext, JSON.stringify(f));

  // Back from Players => SIZE, Back from SIZE => TYPE (chain intact).
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#startGameModalBody .modal-footer button')).find((x) => /back/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(400);
  check('Back returns to SIZE', /TOURNAMENT SIZE/i.test(await head()), await head());
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#startGameModalBody .modal-footer button')).find((x) => /back/i.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(400);
  check('Back returns to TYPE (selection preserved)', /TOURNAMENT MODE/i.test(await head()), await head());

  await page.screenshot({ path: '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/tournament-advance.png' });
  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
