// League & Rankings arcade redesigns: data correctness + animation settle.
// Dialog 1: Power Rankings ("Power Arena").
const H = require('./harness');
const FX = require('./league-fixture');
const E = FX.EXPECTED;
let failures = 0;
function check(name, ok, detail) { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail)); }

(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await FX.install(page);

  // ---- Power Rankings ----
  await page.evaluate(() => window.openPowerRankingsDialog('official'));
  await page.waitForTimeout(2200); // count-ups + bars settle

  const pw = await page.evaluate(() => {
    const bd = document.querySelector('.sq132-bd');
    if (!bd) return null;
    const pods = Array.from(bd.querySelectorAll('.pw-pod'));
    const p1 = bd.querySelector('.pw-pod.p1');
    const rows = Array.from(bd.querySelectorAll('.pw-row'));
    const rowOf = (name) => rows.find((r) => (r.querySelector('.pw-row-name') || {}).textContent === name);
    const alex = rowOf('Alex S');
    return {
      onStack: (window.__sqModalStack || []).length === 1,
      podiumCount: pods.length,
      winner: p1 ? (p1.querySelector('.pw-pod-name') || {}).textContent : null,
      crown: !!(p1 && p1.querySelector('.pw-pod-crown')),
      winnerAvg: p1 ? (p1.querySelector('.pw-pod-avg') || {}).textContent : null,
      totalRows: rows.length,
      rankedNames: rows.filter((r) => !r.classList.contains('benched')).map((r) => (r.querySelector('.pw-row-name') || {}).textContent),
      benched: rows.filter((r) => r.classList.contains('benched')).map((r) => ({
        name: (r.querySelector('.pw-row-name') || {}).textContent,
        tag: (r.querySelector('.pw-tag') || {}).textContent,
      })),
      firstAvg: rows.length ? (rows[0].querySelector('.pw-avg') || {}).textContent : null,
      firstRankClass: rows.length ? rows[0].querySelector('.pw-rank').className : '',
      alexChips: alex ? Array.from(alex.querySelectorAll('.pw-chip')).map((c) => c.textContent) : null,
      barsFilled: rows.every((r) => { const f = r.querySelector('.pw-bar > span'); return f && parseFloat(f.style.width || '0') > 0; }),
      note: !!bd.querySelector('.sq132-note'),
    };
  });

  check('Power: dialog open + on stack', !!pw && pw.onStack, JSON.stringify(pw && { onStack: pw.onStack }));
  if (pw) {
    check('Power: podium has 3 blocks', pw.podiumCount === E.power.podiumCount, JSON.stringify(pw.podiumCount));
    check(`Power: winner ${E.power.podiumWinner} centre with crown`, pw.winner === E.power.podiumWinner && pw.crown, JSON.stringify({ winner: pw.winner, crown: pw.crown }));
    check('Power: winner avg settled 9.50', pw.winnerAvg === E.power.firstAvg, JSON.stringify(pw.winnerAvg));
    check('Power: 6 rows total (4 ranked + 2 benched)', pw.totalRows === E.power.totalRows, JSON.stringify(pw.totalRows));
    check('Power: ranked order', JSON.stringify(pw.rankedNames) === JSON.stringify(E.power.rankedNames), JSON.stringify(pw.rankedNames));
    check('Power: benched tagged Inactive/Unranked', JSON.stringify(pw.benched) === JSON.stringify(E.power.benched), JSON.stringify(pw.benched));
    check('Power: row 1 avg counted to 9.50 with gold rank', pw.firstAvg === E.power.firstAvg && /g1/.test(pw.firstRankClass), JSON.stringify({ avg: pw.firstAvg, cls: pw.firstRankClass }));
    check('Power: Alex latest-scores chips', JSON.stringify(pw.alexChips) === JSON.stringify(E.power.alexChips), JSON.stringify(pw.alexChips));
    check('Power: all power bars grown in', pw.barsFilled);
    check('Power: mode note retained', pw.note);
  }
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/league-power-arena.png' });

  // Turbo tab -> empty-state message (fixture has no turbo rows)
  await page.evaluate(() => { document.querySelector('.sq132-tabs button[data-mode="turbo"]').click(); });
  await page.waitForTimeout(800);
  const turbo = await page.evaluate(() => (document.querySelector('.pw-arena') || {}).textContent || '');
  check('Power: turbo empty state preserved', /not available yet for turbo/i.test(turbo), JSON.stringify(turbo.slice(0, 90)));

  // Escape closes via stack
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('Power: Escape closes clean', await page.evaluate(() => (window.__sqModalStack || []).length === 0 && !document.querySelector('.sq132-bd')));

  // ---- Premier League ----
  await page.evaluate(() => window.openPremierLeagueDialog());
  await page.waitForTimeout(2400); // rows slide + count-ups + medal pass

  const pl = await page.evaluate(() => {
    const bd = document.querySelector('.sq136-pl-bd');
    if (!bd) return null;
    const rows = Array.from(bd.querySelectorAll('.pl-row'));
    const info = (r) => ({
      name: (r.querySelector('.pl-name') || {}).textContent,
      avg: (r.querySelector('.pl-avg') || {}).textContent,
      best: ((r.querySelector('.pl-best') || {}).textContent || '').replace(/[🥇🥈🥉]/g, '').trim(),
      medal: ((r.querySelector('.sq137-medal') || {}).textContent) || null,
      rank: (r.querySelector('.pl-rank') || {}).textContent,
      games: ((r.querySelector('.pl-sub') || {}).textContent || '').trim(),
      unq: r.classList.contains('unq'),
      lead: r.classList.contains('lead'),
      trophy: !!r.querySelector('.pl-trophy'),
      dotsOn: r.querySelectorAll('.pl-dots i.on').length,
      dotsTotal: r.querySelectorAll('.pl-dots i').length,
      barW: parseFloat(((r.querySelector('.pl-bar > span') || {}).style || {}).width || '0'),
    });
    return {
      onStack: (window.__sqModalStack || []).length === 1,
      note: ((bd.querySelector('.sq136-pl-note') || {}).textContent) || '',
      rows: rows.map(info),
    };
  });

  check('Premier: dialog open + on stack', !!pl && pl.onStack);
  if (pl) {
    const R = pl.rows;
    check('Premier: 4 rows (3 qualified + 1 building)', R.length === 4, JSON.stringify(R.map((r) => r.name)));
    E.premier.ranked.forEach((want, i) => {
      const got = R[i] || {};
      check(`Premier: #${i + 1} ${want.name} avg ${want.avg} (${want.games})`,
        got.name === want.name && got.avg === want.avg && got.best === want.best && got.games === want.games && got.rank === '#' + (i + 1),
        JSON.stringify(got));
    });
    check('Premier: leader row glows with trophy', R[0] && R[0].lead && R[0].trophy);
    const unq = R.find((r) => r.unq);
    const wantU = E.premier.unqualified;
    check(`Premier: ${wantU.name} building — ${wantU.label}, dots ${wantU.dotsOn}/${wantU.dotsTotal}`,
      !!unq && unq.name === wantU.name && unq.avg === wantU.avg && unq.rank === '—'
      && unq.dotsOn === wantU.dotsOn && unq.dotsTotal === wantU.dotsTotal && unq.games.includes(wantU.label),
      JSON.stringify(unq));
    const medalsGot = {};
    R.forEach((r) => { if (r.medal) medalsGot[r.best] = r.medal; });
    const medalKeys = Object.keys(E.premier.medals);
    const medalsOk = Object.keys(medalsGot).length === medalKeys.length && medalKeys.every((k) => medalsGot[k] === E.premier.medals[k]);
    check('Premier: sq137 medals still attach to best scores', medalsOk, JSON.stringify(medalsGot));
    check('Premier: all avg bars grown in', R.every((r) => r.barW > 0), JSON.stringify(R.map((r) => r.barW)));
    check('Premier: month note pill retained', /Games Minimum/i.test(pl.note), JSON.stringify(pl.note));
  }
  await page.screenshot({ path: '/home/user/takeshi-quest-latest/docs/ui-audit/screenshots/league-premier-arena.png' });

  // empty state on a filter with no games (2025 — all fixture games are 2026)
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.sq136-pl-bd [data-filter-id]')).find((x) => x.dataset.filterId === 'Y2025');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const plEmpty = await page.evaluate(() => ((document.querySelector('.pl-arena') || {}).textContent) || '');
  check('Premier: empty-state wording preserved', /No official saved-player games found/i.test(plEmpty), JSON.stringify(plEmpty.slice(0, 80)));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('Premier: Escape closes clean', await page.evaluate(() => (window.__sqModalStack || []).length === 0 && !document.querySelector('.sq136-pl-bd')));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
