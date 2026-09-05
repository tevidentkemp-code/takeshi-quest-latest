// SC-009 regression: canonical achievement names/rules, D&G metadata, Misfire card/detail parity.
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

  const canon = await page.evaluate(() => {
    const byCode = Object.fromEntries((SQ_ACH.CATALOG || []).map(x => [x.code, x]));
    const pick = c => byCode[c] ? { name: byCode[c].name, desc: byCode[c].desc, xp: byCode[c].xp } : null;
    return {
      miniMaxi: pick('treble_trouble'),
      maxi: pick('triple_threat'),
      miniDs: pick('double_down'),
      doubleDs: pick('double_trouble'),
      untouchable: pick('untouchable'),
      sharpshooter: pick('flawless_game'),
      specialForces: pick('special_forces'),
      david: pick('david_and_goliath'),
      giant: pick('giant_slayer'),
      detector: SQ_ACH.detectGame.toString(),
    };
  });

  check('Mini Maxi display/rule canonical', canon.miniMaxi && canon.miniMaxi.name === 'Mini Maxi' && /number round 10–20 only/i.test(canon.miniMaxi.desc), JSON.stringify(canon.miniMaxi));
  check('Maxi display/rule canonical', canon.maxi && canon.maxi.name === 'Maxi' && /Trebles round only/i.test(canon.maxi.desc), JSON.stringify(canon.maxi));
  check('Mini D’s display/rule canonical', canon.miniDs && canon.miniDs.name === 'Mini D’s' && /number round 10–20 only/i.test(canon.miniDs.desc), JSON.stringify(canon.miniDs));
  check('Double D’s display/rule canonical', canon.doubleDs && canon.doubleDs.name === 'Double D’s' && /Doubles round only/i.test(canon.doubleDs.desc), JSON.stringify(canon.doubleDs));
  check('Untouchable display/rule canonical', canon.untouchable && /without ever being behind after any completed round/i.test(canon.untouchable.desc), JSON.stringify(canon.untouchable));
  check('Sharpshooter’s Game display/rule canonical', canon.sharpshooter && canon.sharpshooter.name === 'Sharpshooter’s Game' && /non-scoring darts for the entire game/i.test(canon.sharpshooter.desc), JSON.stringify(canon.sharpshooter));
  check('Special Forces names the three canonical awards', canon.specialForces && /Double D’s/i.test(canon.specialForces.desc) && /Maxi/i.test(canon.specialForces.desc) && /Bull Run/i.test(canon.specialForces.desc), JSON.stringify(canon.specialForces));
  check('David & Goliath is +100 and uses pre-game 10-game / 200-point rule', canon.david && canon.david.name === 'David & Goliath' && canon.david.xp === 100 && /pre-game 10-game average/i.test(canon.david.desc) && /200 points lower/i.test(canon.david.desc), JSON.stringify(canon.david));
  check('legacy Giant Slayer remains distinct', !!canon.giant && canon.giant.name === 'Giant Slayer', JSON.stringify(canon.giant));
  check('live detector isolates Mini Maxi to number rounds', /ri <= 10 && tre === 3/.test(canon.detector), 'detector mismatch');
  check('live detector isolates Mini D’s to number rounds', /ri <= 10 && dou === 3/.test(canon.detector), 'detector mismatch');
  check('live detector uses unique-win never-behind Untouchable', /uniqueWon && neverBehind/.test(canon.detector) && !/best >= 14[^\n]*untouchable/.test(canon.detector), 'detector mismatch');

  await page.evaluate(() => window.openPlayerStatsDialog('Alex S'));
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.sq-stats-modal .pp-tab')).find(b => /^achievements$/i.test(b.textContent.trim()));
    if (btn) btn.click();
  });
  await page.waitForTimeout(900);

  const ui = await page.evaluate(() => {
    const root = document.querySelector('.sq-stats-modal');
    const sections = Array.from(root.querySelectorAll('[data-achievement-section]')).map(x => x.dataset.achievementSection);
    const card = root.querySelector('.pp-misfires');
    const byCode = {};
    if (card) card.querySelectorAll('.pp-misfire-card').forEach(x => {
      byCode[x.dataset.code] = {
        count: Number(x.dataset.count || 0),
        name: (x.querySelector('.pp-misfire-name') || {}).textContent || '',
        penalty: (x.querySelector('.pp-misfire-penalty') || {}).textContent || '',
        repeat: (x.querySelector('.pp-misfire-count') || {}).textContent || '',
      };
    });
    return {
      sections,
      cardCount: card ? card.querySelectorAll('.pp-misfire-card').length : 0,
      total: card ? (card.querySelector('.pp-misfire-total') || {}).textContent || '' : '',
      unlocked: card ? (card.querySelector('.pp-misfire-unlocked') || {}).textContent || '' : '',
      xp: card ? (card.querySelector('.pp-misfire-xp') || {}).textContent || '' : '',
      byCode,
      tabs: Array.from(root.querySelectorAll('.pp-tab')).map(b => b.textContent.trim()),
    };
  });

  check('achievement sections ordered Milestones → Trophies / Awards → Misfires', JSON.stringify(ui.sections) === JSON.stringify(['Milestones','Trophies / Awards','Misfires']), JSON.stringify(ui.sections));
  check('Misfires render all 8 trophy-style cards', ui.cardCount === 8, JSON.stringify(ui));
  check('Misfire unlocked summary counts distinct earned rules', norm(ui.unlocked) === '2 / 8 unlocked', ui.unlocked);
  check('Misfire historical total remains DB-derived', norm(ui.total) === '4 historical occurrences', ui.total);
  check('Misfire XP remains DB-derived', norm(ui.xp) === '-2 XP', ui.xp);
  check('Bull Blind repeat badge shows ×3', ui.byCode.bull_blind && ui.byCode.bull_blind.count === 3 && norm(ui.byCode.bull_blind.repeat) === '×3' && norm(ui.byCode.bull_blind.penalty) === '-1 XP', JSON.stringify(ui.byCode));
  check('Cold Start remains recorded once', ui.byCode.cold_start && ui.byCode.cold_start.count === 1 && norm(ui.byCode.cold_start.penalty) === '-1 XP', JSON.stringify(ui.byCode));
  check('Player Stats navigation remains Stats / XP / Achievements', JSON.stringify(ui.tabs) === JSON.stringify(['Stats','XP','Achievements']), JSON.stringify(ui.tabs));

  await page.click('.sq-stats-modal .pp-misfire-card[data-code="bull_blind"]');
  await page.waitForTimeout(300);
  const detail = await page.evaluate(() => {
    const d = document.querySelector('.pp-misfire-detail');
    return d ? { text: d.textContent, count: (d.querySelector('.pp-misfire-detail-count') || {}).textContent || '', rule: (d.querySelector('.pp-misfire-detail-rule') || {}).textContent || '' } : null;
  });
  check('Misfire card opens detail modal', !!detail && /Bull Blind/.test(detail.text || ''), JSON.stringify(detail));
  if (detail) {
    check('Misfire detail carries repeat count', /Recorded ×3 historically/i.test(detail.count), detail.count);
    check('Misfire detail preserves launch-forward/worst/-5 rule', /5 Sep 2026 20:13 UTC/i.test(detail.rule) && /Only the worst Misfire applies per game/i.test(detail.rule) && /maximum deduction is 5 XP per game/i.test(detail.rule), detail.rule);
  }

  const realErrs = consoleErrs.filter(e => !/supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource/i.test(e));
  check('no unexpected console errors', realErrs.length === 0, realErrs.slice(0,5).join(' | '));

  await browser.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
