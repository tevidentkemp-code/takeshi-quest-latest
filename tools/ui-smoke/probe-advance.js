// Probe: what element sits above the advanceMatch button?
const H = require('./harness');
(async () => {
  const { browser, page } = await H.launch({ width: 390, height: 844 });
  await H.boot(page, { settle: 3000 });
  await H.toMatchCard(page);
  await H.addGuests(page, ['TESTA', 'TESTB']);
  await H.startMatch(page, 1);
  await H.playToCompletion(page);
  // page carousel until advance visible
  for (let i = 0; i < 4; i++) {
    const vis = await page.evaluate(() => { const b = document.querySelector('[data-action="advanceMatch"]'); return !!b && b.offsetParent !== null; });
    if (vis) break;
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.sq-gamecomplete-backdrop button'));
      const next = btns.find((b) => b.offsetParent !== null && /^NEXT/i.test(b.textContent.trim()) && !b.dataset.action);
      if (next) next.click();
    });
    await page.waitForTimeout(900);
  }
  const info = await page.evaluate(() => {
    const b = document.querySelector('[data-action="advanceMatch"]');
    if (!b) return { found: false };
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const chain = [];
    let n = top;
    while (n && chain.length < 6) { chain.push((n.tagName || '') + '.' + String(n.className).split(' ').slice(0, 2).join('.')); n = n.parentElement; }
    const cs = top ? getComputedStyle(top) : null;
    return {
      found: true, label: b.textContent.trim(), rect: { x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height) },
      topEl: top ? (top.tagName + ' ' + String(top.className).slice(0, 60)) : null,
      topIsButton: top === b || (top && b.contains(top)),
      topPointer: cs ? cs.pointerEvents : null,
      chain,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: '/tmp/claude-0/-home-user-takeshi-quest-latest/a0f87c99-8ef4-52be-a315-5993b28477a5/scratchpad/advance-probe.png' });
  await browser.close();
})();
