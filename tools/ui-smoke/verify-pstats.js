// Player Stats profile: data correctness (fixture-driven), single-source
// Power Rank, nickname fallback, stack registration, collapsed coming-soon.
const H = require('./harness');
const FX = require('./pstats-fixture');
const E = FX.EXPECTED;
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await FX.install(page);
  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(4500);

  const snap = await page.evaluate(() => {
    const modal = document.querySelector('.sq-stats-modal');
    if (!modal) return null;
    const txt = (el) => (el ? el.innerText : null);
    // hero
    const hero = modal.querySelector('.pp-hero') || modal.querySelector('.modal-body > div > div');
    const tiles = {};
    modal.querySelectorAll('.pp-tile, .modal-body [class]').forEach(() => {});
    // generic: find label/value rows in cards by walking all cards
    const rows = {};
    const cards = {};
    modal.querySelectorAll('.pp-card, .modal-body .tag').forEach((c) => {
      const title = norm2((c.querySelector('strong') || {}).textContent || '');
      if (!title) return;
      cards[title] = c;
      c.querySelectorAll(':scope > div').forEach((r) => {
        const spans = r.querySelectorAll(':scope > span');
        if (spans.length === 2) rows[title + '|' + norm2(spans[0].textContent)] = spans[1].innerText;
      });
    });
    function norm2(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
    // hero tiles (label/value pairs)
    const heroTiles = {};
    (hero ? hero.querySelectorAll(':scope div') : []).forEach(() => {});
    modal.querySelectorAll('.modal-body div').forEach((d) => {
      const kids = Array.from(d.children);
      if (kids.length === 2 && /power rank|games|pl avg/i.test(kids[0].textContent) && kids[0].className.includes('muted')) {
        heroTiles[norm2(kids[0].textContent).toUpperCase()] = norm2(kids[1].textContent);
      }
    });
    const bodyText = modal.innerText;
    return {
      heroTiles,
      rows,
      cardTitles: Object.keys(cards),
      bodyText: bodyText.slice(0, 4000),
      onStack: (window.__sqModalStack || []).length === 1,
      chipText: (modal.querySelector('.modal-body span b') || {}).textContent || '',
    };
  });

  check('dialog rendered', !!snap);
  if (!snap) { await browser.close(); process.exit(1); }

  // hero
  check('hero: name + nickname shown', new RegExp(E.name).test(snap.bodyText) && new RegExp(E.nick).test(snap.bodyText), snap.bodyText.slice(0, 200));
  check('hero: LV chip', E.chip.test(snap.bodyText));
  check('hero tile: POWER RANK ' + E.heroPowerRank, snap.heroTiles['POWER RANK'] === E.heroPowerRank, JSON.stringify(snap.heroTiles));
  check('hero tile: GAMES ' + E.heroGames, snap.heroTiles['GAMES'] === E.heroGames);
  check('hero tile: PL AVG ' + E.heroAvg, snap.heroTiles['PL AVG'] === E.heroAvg);
  check('hero: XP bar caption', new RegExp(E.xpLeft).test(snap.bodyText) && E.xpRight.test(snap.bodyText));

  // quick stats rows
  for (const [label, want] of Object.entries(E.quick)) {
    const got = snap.rows['Quick Stats|' + label];
    check(`Quick Stats: ${label} = ${JSON.stringify(want)}`, norm(got) === norm(want), JSON.stringify(got));
  }
  const gotPower = snap.rows['Quick Stats|Current Power Rank'];
  check(`Quick Stats: Current Power Rank = ${E.quickPowerRank} (single-sourced with hero)`, norm(gotPower) === E.quickPowerRank, JSON.stringify(gotPower));

  // Turbo exclusion: the fixture has a 6th (turbo) game with score 40. It must
  // NOT appear — Lowest Score stays 77, Games stays 5.
  check('Turbo game excluded: Lowest Score stays 77 (not 40)', norm(snap.rows['Quick Stats|Lowest Score']) === '77', JSON.stringify(snap.rows['Quick Stats|Lowest Score']));
  check('Turbo game excluded: Games stays 5 (not 6)', snap.heroTiles['GAMES'] === '5', JSON.stringify(snap.heroTiles['GAMES']));

  // premier league rows
  for (const [label, want] of Object.entries(E.premier)) {
    const got = snap.rows['Premier League|' + label];
    check(`Premier League: ${label} = ${want}`, norm(got) === norm(want), JSON.stringify(got));
  }

  // targets + rivals (innerText keeps line breaks)
  const gotFav = snap.rows['Targets|Favourite Numbers'];
  const gotWeak = snap.rows['Targets|Weakest Numbers'];
  check('Targets: Favourite top-3 with %', norm(gotFav) === norm(E.targetsFav), JSON.stringify(gotFav));
  check('Targets: Weakest bottom-3 with %', norm(gotWeak) === norm(E.targetsWeak), JSON.stringify(gotWeak));
  check('Rivals: Nemesis', norm(snap.rows['Rivals|Nemesis']) === norm(E.rivalsNemesis), JSON.stringify(snap.rows['Rivals|Nemesis']));
  check('Rivals: Favourite Victims', norm(snap.rows['Rivals|Favourite Victims']) === norm(E.rivalsVictims), JSON.stringify(snap.rows['Rivals|Favourite Victims']));

  // FORM panel (win-rate gauge + verdict + strip)
  const form = await page.evaluate(() => {
    const p = document.querySelector('.pp-form');
    if (!p) return null;
    const canvas = p.querySelector('canvas');
    return {
      value: (p.querySelector('.pp-form-value') || {}).textContent,
      verdict: (p.querySelector('.pp-verdict') || {}).textContent,
      sub: (p.querySelector('.pp-form-sub') || {}).textContent,
      cells: p.querySelectorAll('.pp-strip-cell').length,
      winCells: p.querySelectorAll('.pp-strip-cell.win').length,
      gaugeDrawn: !!(canvas && canvas.width > 0),
    };
  });
  check('FORM panel present with gauge canvas', !!form && form.gaugeDrawn, JSON.stringify(form));
  if (form) {
    check('FORM: win rate 60%', form.value === '60%', JSON.stringify(form.value));
    check('FORM: verdict STEADY (recent avg == career avg)', /STEADY/.test(form.verdict || ''), JSON.stringify(form.verdict));
    check('FORM: sub shows 3W / 2L', /3W \/ 2L/.test(form.sub || ''), JSON.stringify(form.sub));
    check('FORM: strip has 5 cells, 3 wins', form.cells === 5 && form.winCells === 3, JSON.stringify({ cells: form.cells, wins: form.winCells }));
  }

  // collapsed coming-soon (replaces the two placeholder cards)
  check('Tournament/Turbo collapsed into one coming-soon strip',
    !snap.cardTitles.includes('Tournament') && !snap.cardTitles.includes('Turbo') && /coming soon/i.test(snap.bodyText),
    JSON.stringify(snap.cardTitles));

  // ---- XP tab hero: XP CORE reactor ----
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab'));
    const xp = btns.find((b) => /^xp$/i.test(b.textContent.trim())); if (xp) xp.click();
  });
  await page.waitForTimeout(1600);
  const xpHero = await page.evaluate(() => {
    const orb = document.querySelector('.pp-xporb');
    if (!orb) return null;
    const c = orb.querySelector('canvas');
    return {
      level: (orb.querySelector('.pp-orb-level') || {}).textContent,
      title: (orb.querySelector('.pp-orb-title') || {}).textContent,
      xp: (orb.querySelector('.pp-orb-xp') || {}).textContent,
      segOn: orb.querySelectorAll('.pp-orb-seg i.on').length,
      next: (orb.querySelector('.pp-orb-next') || {}).textContent,
      canvasDrawn: !!(c && c.width > 0),
    };
  });
  check('XP hero: reactor present with drawn canvas', !!xpHero && xpHero.canvasDrawn, JSON.stringify(xpHero));
  if (xpHero) {
    check('XP hero: level 2 settled', xpHero.level === '2', JSON.stringify(xpHero.level));
    check('XP hero: title ROOKIE', /rookie/i.test(xpHero.title || ''), JSON.stringify(xpHero.title));
    check('XP hero: total XP 151 settled', xpHero.xp === '151', JSON.stringify(xpHero.xp));
    check('XP hero: "33 XP to Level 3"', /33 XP to Level 3/i.test(xpHero.next || ''), JSON.stringify(xpHero.next));
    check('XP hero: segments partially lit (not 0/full)', xpHero.segOn > 0 && xpHero.segOn < 12, JSON.stringify(xpHero.segOn));
  }
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/pstats-xp-reactor.png' });

  // ---- Achievements tab hero: TROPHY VAULT ----
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab'));
    const a = btns.find((b) => /^achievements$/i.test(b.textContent.trim())); if (a) a.click();
  });
  await page.waitForTimeout(1400);
  const achHero = await page.evaluate(() => {
    const v = document.querySelector('.pp-vault');
    if (!v) return null;
    return {
      count: (v.querySelector('.pp-vault-count b') || {}).textContent,
      total: (v.querySelector('.pp-vault-count small') || {}).textContent,
      sub: (v.querySelector('.pp-vault-sub') || {}).textContent,
      badges: v.querySelectorAll('.pp-vault-badge').length,
      badgesIn: v.querySelectorAll('.pp-vault-badge.in').length,
      barWidth: (v.querySelector('.pp-vault-bar > span') || {}).style ? (v.querySelector('.pp-vault-bar > span').style.width || '') : '',
    };
  });
  check('Achievements hero: vault present', !!achHero, JSON.stringify(achHero));
  if (achHero) {
    check('Achievements hero: earned count counted up to 2', achHero.count === '2', JSON.stringify(achHero.count));
    check('Achievements hero: shows "/ N total"', /^ \/ \d+$/.test(achHero.total || ''), JSON.stringify(achHero.total));
    check('Achievements hero: 2 badges popped in', achHero.badges === 2 && achHero.badgesIn === 2, JSON.stringify(achHero));
    check('Achievements hero: completion bar filled (non-zero)', achHero.barWidth && achHero.barWidth !== '0%', JSON.stringify(achHero.barWidth));
  }
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/pstats-trophy-vault.png' });

  // back to Stats for the stack/escape checks
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab'));
    const s = btns.find((b) => /^stats$/i.test(b.textContent.trim())); if (s) s.click();
  });
  await page.waitForTimeout(300);

  // stack + escape
  check('profile registered on the shared modal stack', snap.onStack);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const afterEsc = await page.evaluate(() => ({
    stack: (window.__sqModalStack || []).length,
    open: !!document.querySelector('.sq-stats-modal'),
  }));
  check('Escape closes the profile via the stack', afterEsc.stack === 0 && !afterEsc.open, JSON.stringify(afterEsc));

  // XP ladder registers too
  await FX.install(page);
  await page.evaluate(() => window.openXpLeaderboard());
  await page.waitForTimeout(1200);
  const ladder = await page.evaluate(() => ({ stack: (window.__sqModalStack || []).length, hasRows: /Alex S/.test(document.body.innerText) }));
  check('XP Level Ladder registers on the stack', ladder.stack === 1 && ladder.hasRows, JSON.stringify(ladder));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('XP ladder closes on Escape', await page.evaluate(() => (window.__sqModalStack || []).length === 0));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
