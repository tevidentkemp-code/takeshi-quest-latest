// Training TDB + Select modes and the Practice Stats area.
// Uses a STATEFUL fake supabase: inserts accumulate in window.__trStore and are
// served back for training_sessions / v_training_player_summary reads, so the
// Practice Stats modal shows real aggregated data.
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
    window.__trStore = [];
    const players = [{ id: 'p1', name: 'Trainee One', nickname: 'The Bolt', initials: 'TO' }];
    const mkQuery = (table) => {
      const base = {
        then: (res) => {
          let data = [];
          if (/players/i.test(table)) data = players.slice();
          else if (table === 'training_sessions') data = (window.__trStore || []).slice().reverse();
          else if (table === 'v_training_player_summary') {
            const by = {}; (window.__trStore || []).forEach((r) => { (by[r.mode] = by[r.mode] || []).push(r); });
            data = Object.keys(by).map((mode) => { const rows = by[mode]; const n = rows.length;
              return { mode, sessions: n, avg_points: Math.round(rows.reduce((a, b) => a + b.total_points, 0) / n),
                best_points: Math.max.apply(null, rows.map((r) => r.total_points)),
                avg_hit_pct: Math.round(rows.reduce((a, b) => a + Number(b.hit_pct), 0) / n * 10) / 10, avg_darts: 30, last_played_at: new Date().toISOString() }; });
          }
          res({ data, error: null });
        },
        catch() { return proxy; },
        upsert: () => Promise.resolve({ data: [], error: null }),
        insert: (row) => { try { (window.__trStore = window.__trStore || []).push(row); } catch (_) {} return Promise.resolve({ data: [row], error: null }); },
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
  const clickText = (sel, label) => page.evaluate(({ s, l }) => {
    const b = Array.from(document.querySelectorAll('#startGameModalBody ' + s)).find((x) => x.textContent.toUpperCase().includes(l));
    if (b) b.click(); return !!b;
  }, { s: sel, l: label });

  async function playSession(maxGoes) {
    for (let i = 0; i < maxGoes + 3; i++) {
      if (await page.evaluate(() => !!document.querySelector('.tr-summary'))) break;
      for (let d = 0; d < 3; d++) {
        await page.evaluate(() => { const bs = document.querySelectorAll('.tr-overlay .tr-pad button'); const b = bs[bs.length - 1]; if (b) b.click(); });
        await page.waitForTimeout(110);
      }
      await page.waitForTimeout(600);
    }
  }

  // ============ TDB ============
  await page.click('#startGameBtn'); await page.waitForTimeout(500);
  await page.click('#trainingBtn'); await page.waitForTimeout(400);
  await clickPill('TRAINEE ONE'); await page.waitForTimeout(300);
  check('TDB: mode is selectable (not SOON)', await page.evaluate(() => !document.querySelector('#startGameModalBody .sg-pill-soon')));
  await clickPill('TDB'); await page.waitForTimeout(300);
  check('TDB: length step shown', await page.evaluate(() => /SESSION LENGTH/i.test((document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '')));
  await clickPill('10 ROUNDS'); await page.waitForTimeout(600);

  // On a number target, TDB pad must exclude SINGLE.
  const tdbPad = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('.tr-overlay .tr-pad button')).map((b) => b.dataset.sec);
    return { secs, cue: (document.querySelector('.tr-target-cue') || {}).textContent || '' };
  });
  if (/BULL/i.test(tdbPad.cue)) check('TDB: bull target has 25 + BULL', tdbPad.secs.includes('bull'), JSON.stringify(tdbPad));
  else check('TDB: number target excludes SINGLE (D/T only)', !tdbPad.secs.includes('single') && tdbPad.secs.includes('treble'), JSON.stringify(tdbPad));

  await playSession(10);
  await page.waitForTimeout(400);
  check('TDB: summary shown', await page.evaluate(() => !!document.querySelector('.tr-summary')));
  const tdbIns = await page.evaluate(() => (window.__trStore || []).filter((r) => r.mode === 'tdb'));
  check('TDB: session saved with mode=tdb', tdbIns.length === 1 && tdbIns[0].rounds_played === 10, JSON.stringify(tdbIns.map((r) => ({ m: r.mode, n: r.rounds_played }))));
  // back home
  await page.evaluate(() => { const b = document.querySelector('.tr-summary .tr-done'); if (b) b.click(); });
  await page.waitForTimeout(400);

  // ============ SELECT ============
  await page.click('#startGameBtn'); await page.waitForTimeout(500);
  await page.click('#trainingBtn'); await page.waitForTimeout(400);
  await clickPill('TRAINEE ONE'); await page.waitForTimeout(300);
  await clickPill('SELECT'); await page.waitForTimeout(300);
  check('Select: config step shown', await page.evaluate(() => /SELECT TARGETS/i.test((document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '')));
  // add a DOUBLE 15 and a FULL 20
  await clickText('.tr-sel-sec', 'DOUBLE'); await page.waitForTimeout(120);
  await clickText('.tr-sel-num', '15'); await page.waitForTimeout(120);
  await clickText('.tr-sel-sec', 'FULL'); await page.waitForTimeout(120);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#startGameModalBody .tr-sel-num')).find((x) => x.textContent.trim() === '20'); if (b) b.click(); });
  await page.waitForTimeout(150);
  const chips = await page.evaluate(() => Array.from(document.querySelectorAll('#startGameModalBody .tr-sel-chip')).map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
  check('Select: two targets chosen', chips.length === 2, JSON.stringify(chips));
  await page.evaluate(() => { const b = document.querySelector('#startGameModalBody .modal-footer button.primary'); if (b) b.click(); }); // NEXT
  await page.waitForTimeout(300);
  check('Select: length step shown', await page.evaluate(() => /SESSION LENGTH/i.test((document.querySelector('#startGameModalBody .sg-tournament-title') || {}).textContent || '')));
  await clickPill('10 ROUNDS'); await page.waitForTimeout(600);
  // Select target must be one of the configured ones (double 15 or full 20).
  const selCue = await page.evaluate(() => (document.querySelector('.tr-target-cue') || {}).textContent || '');
  check('Select: target is a configured one', /15|20/.test(selCue), selCue);
  await playSession(10);
  await page.waitForTimeout(400);
  const selIns = await page.evaluate(() => (window.__trStore || []).filter((r) => r.mode === 'select'));
  check('Select: session saved with mode=select + config targets', selIns.length === 1 && selIns[0].config && Array.isArray(selIns[0].config.targets) && selIns[0].config.targets.length === 2, JSON.stringify(selIns.map((r) => r.config)));

  // ============ PRACTICE STATS (from summary button) ============
  await page.evaluate(() => { const b = document.querySelector('.tr-summary .tr-sum-stats'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const stats = await page.evaluate(() => {
    const m = document.querySelector('.trs-head');
    if (!m) return null;
    return {
      title: (document.querySelector('.trs-head h3') || {}).textContent,
      cards: document.querySelectorAll('.trs-card').length,
      withData: document.querySelectorAll('.trs-card:not(.trs-empty-card)').length,
      sessions: document.querySelectorAll('.trs-sess').length,
      modes: Array.from(document.querySelectorAll('.trs-sess-mode')).map((x) => x.textContent),
    };
  });
  check('Practice Stats modal opens', !!stats && /Practice Stats/i.test(stats.title || ''), JSON.stringify(stats));
  if (stats) {
    check('Practice Stats: 3 mode cards', stats.cards === 3, String(stats.cards));
    check('Practice Stats: TDB + SELECT cards have data', stats.withData === 2, String(stats.withData));
    check('Practice Stats: recent sessions listed (>=2)', stats.sessions >= 2, String(stats.sessions));
    check('Practice Stats: shows both modes in history', stats.modes.join(',').includes('TDB') && stats.modes.join(',').includes('SELECT'), JSON.stringify(stats.modes));
  }

  await page.screenshot({ path: '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/training-stats.png' });
  const badErrs = errs.filter((e) => !/ERR_FAILED|Failed to load resource|\[object Event\]/.test(e));
  check('no unexpected console errors', badErrs.length === 0, JSON.stringify(badErrs.slice(0, 6)));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
