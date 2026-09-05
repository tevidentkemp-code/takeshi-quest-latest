// SC-009 regression: canonical achievement names/rules + Misfire card parity/detail.
const H = require('./harness');
const FX = require('./pstats-fixture');
let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok || !detail ? '' : '  — ' + detail));
}
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await FX.install(page);
  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(1800);

  const canonical = await page.evaluate(() => {
    const by = Object.fromEntries(SQ_ACH.CATALOG.map((x) => [x.code, x]));
    return ['treble_trouble','triple_threat','double_down','double_trouble','untouchable','flawless_game','david_and_goliath']
      .map((code) => by[code] || null);
  });
  const byCode = Object.fromEntries(canonical.filter(Boolean).map((x) => [x.code, x]));
  check('catalogue: all SC-009 entries present', canonical.length === 7 && canonical.every(Boolean), JSON.stringify(canonical));
  check('Mini Maxi name/rule', byCode.treble_trouble && byCode.treble_trouble.name === 'Mini Maxi' && /number round 10–20 only/i.test(byCode.treble_trouble.desc), JSON.stringify(byCode.treble_trouble));
  check('Maxi name/rule', byCode.triple_threat && byCode.triple_threat.name === 'Maxi' && /Trebles round only/i.test(byCode.triple_threat.desc), JSON.stringify(byCode.triple_threat));
  check('Mini D’s name/rule', byCode.double_down && byCode.double_down.name === 'Mini D’s' && /number round 10–20 only/i.test(byCode.double_down.desc), JSON.stringify(byCode.double_down));
  check('Double D’s name/rule', byCode.double_trouble && byCode.double_trouble.name === 'Double D’s' && /Doubles round only/i.test(byCode.double_trouble.desc), JSON.stringify(byCode.double_trouble));
  check('Untouchable canonical copy', byCode.untouchable && /without ever being behind after any completed round/i.test(byCode.untouchable.desc), JSON.stringify(byCode.untouchable));
  check('Sharpshooter’s Game canonical copy', byCode.flawless_game && /No non-scoring darts for the entire game/i.test(byCode.flawless_game.desc), JSON.stringify(byCode.flawless_game));
  check('David & Goliath catalogue +100 XP', byCode.david_and_goliath && byCode.david_and_goliath.xp === 100 && /10-game average/i.test(byCode.david_and_goliath.desc) && /200\+/i.test(byCode.david_and_goliath.desc), JSON.stringify(byCode.david_and_goliath));

  const detector = await page.evaluate(() => {
    const mk = (tot = 0, darts = []) => ({ roundTotal: tot, darts });
    const miss = [{kind:'Miss',points:0},{kind:'Miss',points:0},{kind:'Miss',points:0}];
    const triples = [{kind:'T',points:60},{kind:'T',points:60},{kind:'T',points:60}];
    const doubles = [{kind:'D',points:40},{kind:'D',points:40},{kind:'D',points:40}];
    const board = [Array.from({length:14}, () => mk(1, miss)), Array.from({length:14}, () => mk(0, miss))];
    board[0][12] = mk(180, triples); // Trebles special round
    board[0][11] = mk(120, doubles); // Doubles special round
    const res = SQ_ACH.detectGame(board, {players:['A','B']});
    const codes = ((res.find((r) => r.player === 0) || {}).earned || []).map((e) => e.code);
    return {codes};
  });
  check('live detector: special Trebles earns Maxi, not Mini Maxi', detector.codes.includes('triple_threat') && !detector.codes.includes('treble_trouble'), JSON.stringify(detector));
  check('live detector: special Doubles earns Double D’s, not Mini D’s', detector.codes.includes('double_trouble') && !detector.codes.includes('double_down'), JSON.stringify(detector));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).find((b) => /^achievements$/i.test(b.textContent.trim()));
    if (btn) btn.click();
  });
  await page.waitForTimeout(700);

  const ui = await page.evaluate(() => {
    const modal = document.querySelector('.sq-stats-modal');
    const mf = modal && modal.querySelector('.pp-misfires');
    const strongs = modal ? Array.from(modal.querySelectorAll('strong')) : [];
    const milestone = strongs.find((x) => /Milestones/.test(x.textContent));
    const trophies = strongs.find((x) => /^🏆 Trophies$/.test(x.textContent.trim()) || /^Trophies$/.test(x.textContent.trim()));
    const mfTitle = strongs.find((x) => /Misfires/.test(x.textContent));
    const cards = mf ? Array.from(mf.querySelectorAll('.pp-misfire-card')) : [];
    const bull = mf && mf.querySelector('.pp-misfire-card[data-code="bull_blind"]');
    const cold = mf && mf.querySelector('.pp-misfire-card[data-code="cold_start"]');
    const grid = mf && mf.querySelector('.pp-misfire-grid');
    return {
      visible: !!mf && mf.offsetParent !== null,
      cardCount: cards.length,
      gridDisplay: grid ? getComputedStyle(grid).display : '',
      gridTemplate: grid ? getComputedStyle(grid).gridTemplateColumns : '',
      unlocked: norm((mf && mf.querySelector('.pp-misfire-unlocked') || {}).textContent || ''),
      total: norm((mf && mf.querySelector('.pp-misfire-total') || {}).textContent || ''),
      xp: norm((mf && mf.querySelector('.pp-misfire-xp') || {}).textContent || ''),
      bullCount: norm((bull && bull.querySelector('.pp-misfire-count') || {}).textContent || ''),
      bullBg: bull ? getComputedStyle(bull).backgroundImage : '',
      coldExists: !!cold,
      order: [milestone, trophies, mfTitle].map((x) => x ? x.getBoundingClientRect().top : -1),
      tabs: Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).map((b) => b.textContent.trim()),
      overflow: modal ? modal.scrollWidth - modal.clientWidth : 999,
    };
  });
  check('Misfires visible after positive awards', ui.visible && ui.order[0] >= 0 && ui.order[0] < ui.order[1] && ui.order[1] < ui.order[2], JSON.stringify(ui));
  check('Misfires use card grid with all 8 rules', ui.cardCount === 8 && ui.gridDisplay === 'grid' && ui.gridTemplate.split(' ').length >= 2, JSON.stringify(ui));
  check('Misfire unlock summary uses trophy-style count', ui.unlocked === '2 / 8 unlocked', JSON.stringify(ui));
  check('Misfire historical total preserved', ui.total === '4 historical occurrences', JSON.stringify(ui));
  check('Misfire XP impact preserved', ui.xp === '-2 XP', JSON.stringify(ui));
  check('repeatable Misfire ×N badge preserved', ui.bullCount === '×3', JSON.stringify(ui));
  check('earned Misfire has distinct negative styling', /gradient/i.test(ui.bullBg), JSON.stringify(ui.bullBg));
  check('Player Stats navigation unchanged', JSON.stringify(ui.tabs) === JSON.stringify(['Stats','XP','Achievements']), JSON.stringify(ui.tabs));
  check('390px layout has no horizontal modal overflow', ui.overflow <= 1, JSON.stringify(ui.overflow));

  await page.evaluate(() => {
    const b = document.querySelector('.sq-stats-modal .pp-misfire-card[data-code="cold_start"]');
    if (b) b.click();
  });
  await page.waitForTimeout(250);
  const detail = await page.evaluate(() => {
    const d = document.querySelector('.pp-misfire-detail');
    return d ? {
      text: norm(d.textContent),
      count: norm((d.querySelector('.pp-misfire-detail-count') || {}).textContent || ''),
      rule: norm((d.querySelector('.pp-misfire-detail-rule') || {}).textContent || ''),
    } : null;
  });
  check('Misfire card opens detail modal', !!detail && /Cold Start/.test(detail.text) && /-1 XP/.test(detail.text), JSON.stringify(detail));
  check('Misfire detail shows player count', !!detail && /recorded this 1×/i.test(detail.count), JSON.stringify(detail));
  check('Misfire detail explains launch-forward / worst / -5 cap', !!detail && /only from 5 Sep 2026 20:13 UTC/i.test(detail.rule) && /only the worst penalty applies/i.test(detail.rule) && /maximum deduction of 5 XP per game/i.test(detail.rule), JSON.stringify(detail));

  const realErrs = consoleErrs.filter((e) => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', realErrs.length === 0, realErrs.slice(0,5).join(' | '));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
