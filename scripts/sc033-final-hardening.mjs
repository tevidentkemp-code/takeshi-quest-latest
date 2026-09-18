import fs from 'node:fs';

function replaceOnce(path, from, to) {
  const input = fs.readFileSync(path, 'utf8');
  if (!input.includes(from)) throw new Error(`Missing SC-033 hardening anchor in ${path}`);
  fs.writeFileSync(path, input.replace(from, to), 'utf8');
}

// Preserve the policy-ownership rationale explicitly: guest Match Play can be
// reclassified for persistence/stat eligibility after a game, but the match-level
// order policy must remain stable.
replaceOnce(
  'src/game/engine.js',
  `// SC-033 keeps ordinary Match Play order ownership inside the existing player-array
// model. Practice, Vs Shadow and Tournament are deliberately excluded.
function __sqIsAutoThrowOrderMatch(){`,
  `// SC-033 keeps ordinary Match Play order ownership inside the existing player-array
// model. Practice, Vs Shadow and Tournament are deliberately excluded.
// A boolean autoRotateOrder is the Match Play order-policy marker; do not infer
// eligibility from mutable stats/persistence classification fields.
function __sqIsAutoThrowOrderMatch(){`
);

// Canonical mobile rule: interactive controls must retain a >=44px tap target.
replaceOnce(
  'src/styles/setup/throw-order.css',
  '  min-height:38px;',
  '  min-height:44px;'
);
replaceOnce(
  'src/styles/setup/throw-order.css',
  '.to-auto-toggle{ min-width:84px; min-height:34px; padding:0 10px; font-size:10px; }',
  '.to-auto-toggle{ min-width:84px; min-height:44px; padding:0 10px; font-size:10px; }'
);

// Make Vs Shadow isolation explicit in the dedicated contract.
replaceOnce(
  'tools/ui-smoke/verify-sc033-throw-order.js',
  `        practice: run({ mode: 'practice', forcePractice: true, practiceType: 'classic', autoRotateOrder: undefined }),
        tournament: run({ tournament: true, tournamentType: 'classic' }),`,
  `        practice: run({ mode: 'practice', forcePractice: true, practiceType: 'classic', autoRotateOrder: undefined }),
        vsShadow: run({ mode: 'practice', forcePractice: true, practiceType: 'vsshadow' }),
        tournament: run({ tournament: true, tournamentType: 'classic' }),`
);

// Prove the actual AUTO control remains mobile-safe at the supported narrow widths.
replaceOnce(
  'tools/ui-smoke/verify-sc033-throw-order.js',
  `    assert.equal(initialDialog.toggleText.trim(), 'AUTO ON', 'AUTO should default ON for new Match Play');
    assert.equal(initialDialog.pressed, 'true', 'AUTO toggle aria state should default ON');
    await shot(page, 'sc033-throw-order-auto-on', '.modal-throworder');

    // AUTO OFF must preserve the existing manual throw-order step between games.`,
  `    assert.equal(initialDialog.toggleText.trim(), 'AUTO ON', 'AUTO should default ON for new Match Play');
    assert.equal(initialDialog.pressed, 'true', 'AUTO toggle aria state should default ON');

    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.waitForTimeout(120);
      const fit = await page.evaluate(() => {
        const modal = document.querySelector('.modal-throworder');
        const toggle = modal && modal.querySelector('.to-auto-toggle');
        const mr = modal && modal.getBoundingClientRect();
        const tr = toggle && toggle.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          modalLeft: mr ? mr.left : -999,
          modalRight: mr ? mr.right : 99999,
          toggleHeight: tr ? tr.height : 0,
        };
      });
      assert.equal(fit.overflow, false, width + 'px Throw Order must not create horizontal overflow');
      assert(fit.modalLeft >= -1 && fit.modalRight <= width + 1, width + 'px Throw Order modal must stay within viewport');
      assert(fit.toggleHeight >= 43.5, width + 'px AUTO toggle must preserve the canonical 44px minimum tap target');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    await shot(page, 'sc033-throw-order-auto-on', '.modal-throworder');

    // AUTO OFF must preserve the existing manual throw-order step between games.`
);

console.log('SC-033 final hardening patch applied.');
