// Training / Standard mode, end to end: TRAINING button -> setup (player ->
// mode -> length, auto-advancing) -> arcade game screen -> play 10 goes ->
// summary with total points, hit rate, and a save to training_sessions.
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

  const inserts = [];
  await ctx.exposeFunction('__trCapture', (row) => { inserts.push(row); });

  await ctx.addInitScript(() => {
    const players = [{ id: 'p1', name: 'Trainee One', nickname: 'The Bolt', initials: 'TO' }, { id: 'p2', name: 'Trainee Two', nickname: '', initials: 'TT' }];
    const mkQuery = (table) => {
      const base = {
        then: (res) => res({ data: /players/i.test(table) ? players.slice() : [], error: null }),
        catch() { return proxy; },
        upsert: () => Promise.resolve({ data: [], error: null }),
        insert: (row) => { try { window.__trCapture && window.__trCapture({ table, row }); } catch (_) {} return Promise.resolve({ data: [row], error: null }); },
      };
      const proxy = new Proxy(base, { get(t, p) { return (p in t) ? t[p] : () => proxy; } });
      return proxy;
    };
    const fake = { from: (t) => mkQuery(t), auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} };
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
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 160)));

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const b = document.getElementById('bootSplash'); return !b || b.hidden || getComputedStyle(b).display === 'none' || getComputedStyle(b).opacity === '0'; }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const clickPill = (label) => page.evaluate((lbl) => {
    const p = Array.from(document.querySelectorAll('#startGameModalBody .sg-tournament-pill')).find((x) => (x.querySelector('.sg-tournament-pill-title') || {}).textContent.toUpperCase().includes(lbl));
    if (p) p.click(); return !!p;
  }, label);

  // Enter TRAINING.
  await page.click('#startGameBtn'); await page.waitForTimeout(500);
  const trainingLive = await page.evaluate(() => { const b = document.getElementById('trainingBtn'); return b && !b.classList.contains('disabled'); });
  check('TRAINING button enabled (LIVE)', trainingLive);
  await page.click('#trainingBtn'); await page.waitForTimeout(500);

  // Setup: player -> mode -> length (each auto-advances).
  check('Player step shown', await page.evaluate(() => /TRAINING/i.test((document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '')));
  check('Pick player', await clickPill('TRAINEE ONE')); await page.waitForTimeout(350);
  check('Mode step shown', await page.evaluate(() => /TRAINING MODE/i.test((document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '')));
  check('Pick STANDARD', await clickPill('STANDARD')); await page.waitForTimeout(350);
  check('Length step shown', await page.evaluate(() => /SESSION LENGTH/i.test((document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '')));
  check('Pick 10 ROUNDS', await clickPill('10 ROUNDS')); await page.waitForTimeout(600);

  // Game screen up.
  check('Arcade game screen shown', await page.evaluate(() => !!document.querySelector('.tr-overlay')));
  check('Your Avg tile present', await page.evaluate(() => !!document.querySelector('.tr-v-avg')));

  // Play 10 goes: 3 darts each. Alternate sections so points + hits accrue.
  const secs = ['treble', 'single', 'miss'];
  for (let go = 0; go < 12; go++) {
    const done = await page.evaluate(() => !!document.querySelector('.tr-summary'));
    if (done) break;
    for (let d = 0; d < 3; d++) {
      const sec = secs[d % secs.length];
      await page.evaluate((s) => { const b = document.querySelector('.tr-overlay .tr-pad button[data-sec="' + s + '"]'); if (b) b.click(); }, sec);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(620); // wait out the finish-go delay
  }

  // Summary.
  await page.waitForTimeout(400);
  const sum = await page.evaluate(() => {
    const s = document.querySelector('.tr-summary');
    if (!s) return null;
    return {
      pts: (s.querySelector('.tr-sum-pts') || {}).textContent,
      delta: (s.querySelector('.tr-sum-delta') || {}).textContent,
      goes: Array.from(s.querySelectorAll('.tr-sum-cell b')).map((b) => b.textContent),
      note: (s.querySelector('.tr-sum-note') || {}).textContent,
      bars: s.querySelectorAll('.tr-sum-prog .tr-bar').length,
    };
  });
  check('Summary shown after 10 goes', !!sum, JSON.stringify(sum));
  if (sum) {
    const pts = Number(sum.pts);
    check('Summary: total points is a positive number', pts > 0, sum.pts);
    check('Summary: shows benchmark/delta line', /benchmark|average/i.test(sum.delta), sum.delta);
    check('Summary: 10 GOES recorded', sum.goes.includes('10'), JSON.stringify(sum.goes));
    check('Summary: progression has 10 bars', sum.bars === 10, String(sum.bars));
    check('Summary: saved-to-practice-stats note', /saved/i.test(sum.note), sum.note);
  }

  // A training_sessions insert must have been attempted with the right shape.
  const trIns = inserts.filter((i) => /training_sessions/.test(i.table));
  check('Inserted one training_sessions row', trIns.length === 1, JSON.stringify(trIns.map((i) => i.table)));
  if (trIns.length) {
    const r = trIns[0].row;
    check('Insert: mode=standard, 10 rounds, results present', r.mode === 'standard' && r.rounds_played === 10 && Array.isArray(r.results) && r.results.length === 10, JSON.stringify({ mode: r.mode, rounds: r.rounds_played, results: (r.results || []).length, pts: r.total_points }));
    check('Insert: totals consistent (points>=0, darts=30)', r.total_darts === 30 && r.total_points >= 0, JSON.stringify({ darts: r.total_darts, pts: r.total_points }));
  }

  await page.screenshot({ path: '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/training-summary.png' });
  const badErrs = errs.filter((e) => !/ERR_FAILED|Failed to load resource|\[object Event\]/.test(e));
  check('no unexpected console errors', badErrs.length === 0, JSON.stringify(badErrs.slice(0, 5)));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
