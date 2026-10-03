const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');
const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/release-metadata.json'), 'utf8'));
const BROWSER_NOISE = /supabase|Failed to fetch|fetch failed|net::|NetworkError|load resource|Content Security Policy|connect-src/i;
const out = process.env.SQ_SCREENSHOTS;
if (out) fs.mkdirSync(out, { recursive: true });

(async () => {
  for (const [width, height] of [[320,844], [390,844], [430,844], [320,568], [820,844]]) {
    const { browser, page, consoleErrs } = await H.launch({ width, height }, { seedPlayers: true });
    try {
      await page.emulateMedia({ reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      await H.boot(page, { settle: 1300 });
      const snapshot = async (name) => {
        if (out) await page.screenshot({ path: path.join(out, `vis001-${width}x${height}-${name}.png`), fullPage: name === 'home' });
      };
      const modeBody = page.locator('#startGameModal .modal-body');
      const mainReady = async () => page.waitForFunction(() => document.getElementById('trainingBtn')?.getAttribute('aria-disabled') === 'false');
      const back = async () => {
        await page.locator('#startGameModalBody .sg-practice-footer button').filter({ hasText: /BACK/i }).tap();
        await mainReady();
      };
      const openModes = async () => { await page.locator('#startGameBtn').tap(); await mainReady(); };
      const checkCards = async () => {
        const state = await page.evaluate(() => {
          const modal = document.querySelector('#startGameModal .sg-modal');
          const box = (n) => { const r = n.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
          return {
            fits: box(modal).left >= 0 && box(modal).right <= innerWidth,
            cards: Array.from(modal.querySelectorAll('.sg-opt')).map(n => {
              const copy = n.querySelector('.sg-copy'), badge = n.querySelector('.sg-opt-soon');
              return { id:n.id, overflow:n.scrollWidth > n.clientWidth, copy:box(copy), badge:badge && box(badge), font:parseFloat(getComputedStyle(n.querySelector('.sg-opt-desc')).fontSize) };
            }),
            backButtons: Array.from(modal.querySelectorAll('.modal-footer button')).filter(n => n.offsetParent !== null).map(box)
          };
        });
        assert(state.fits, 'mode chooser fits the viewport');
        for (const card of state.cards) {
          assert(!card.overflow, `${card.id} has no horizontal overflow`);
          assert(card.font >= 12, `${card.id} supporting text is readable`);
          if (card.badge) assert(card.badge.left >= card.copy.left - .1 && card.badge.right <= card.copy.right + .1, `${card.id} badge stays in the copy area`);
        }
        assert.equal(state.backButtons.length, 1, 'exactly one visible Back in the current menu');
        assert(state.backButtons[0].height >= 44, 'Back retains its mobile touch target');
      };
      await page.waitForFunction(() => typeof window.__homeLivePrinterInjectLine === 'function');
      await page.evaluate(() => window.__homeLivePrinterInjectLine('CLA / 21:50 VIS QA ALPHA (300) bts VIS QA BETA (200)'));
      await page.waitForFunction(() => document.getElementById('homeLivePrinterRows')?.textContent.includes('VIS QA ALPHA'));
      const home = await page.evaluate(() => {
        const box=n=>{const r=n.getBoundingClientRect();return {id:n.id,x:r.x,y:r.y,width:r.width,height:r.height};};
        return {
          feed:box(document.getElementById('homeLivePrinter')),
          header:box(document.querySelector('#homeLivePrinter .lp-top')),
          title:box(document.querySelector('#homeLivePrinter .lp-title')),
          buttons:Array.from(document.querySelectorAll('#details button')).filter(n=>n.offsetParent!==null).map(box),
          rows:document.querySelectorAll('#homeLivePrinterRows tr.lp-row').length,
          playing:document.getElementById('homeLivePauseBtn').getAttribute('aria-pressed')
        };
      });
      assert.equal(home.rows, 15, 'VIDE retains its 15 stable rows with populated content');
      assert.equal(home.playing, 'false', 'Home starts playing');
      assert.equal(home.header.height, width <= 480 ? 43 : 48, 'VIDE header retains the reviewed baseline height');
      assert.equal(home.title.x, home.header.x + (width <= 480 ? 12 : 14), 'LIVE UPDATES retains its left position');
      const expectedFeedHeight = width <= 560 ? Math.min(540, Math.max(500, (width-32)*1.42)) : 560;
      assert(Math.abs(home.feed.height-expectedFeedHeight)<.1, 'VIDE outer geometry stays fixed');
      for (const button of home.buttons) assert(button.width >= 43.99 && button.height >= 43.99, `${button.id} meets 44×44`);
      const pause = page.locator('#homeLivePauseBtn');
      await pause.tap();
      assert.equal(await pause.getAttribute('aria-pressed'), 'true', 'Pause works');
      assert.equal((await pause.textContent()).trim(), 'PLAY', 'paused state is labelled Play');
      assert.equal(await pause.evaluate(n=>getComputedStyle(n).color), 'rgba(255, 174, 86, 0.96)', 'paused state keeps its orange feedback');
      await pause.tap();
      assert.equal(await pause.getAttribute('aria-pressed'), 'false', 'Play resumes');
      await page.evaluate(()=>window.scrollTo(0,0));
      await snapshot('home');
      for (const id of ['homeLivePauseBtn', 'sqReleaseVersionBtn', 'adminCodeBtn']) {
        const tab = process.env.SQ_BROWSER === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
        await page.keyboard.press(tab);
        await page.locator('#'+id).focus();
        assert(await page.locator('#'+id).evaluate(n=>n.matches(':focus-visible') && (getComputedStyle(n).outlineStyle !== 'none' || getComputedStyle(n).boxShadow !== 'none')), `${id} keyboard focus remains visible`);
      }
      assert.equal((await page.locator('#sqReleaseVersionBtn').textContent()).trim(), 'v'+metadata.currentVersion);
      await page.locator('#sqReleaseVersionBtn').tap();
      await page.locator('.sq-release-notes-modal button[aria-label="Back"]').tap();
      await page.locator('.sq-release-notes-modal').waitFor({ state:'detached' });
      await page.locator('#sqReleaseVersionBtn').tap();
      await page.locator('.sq-release-notes-modal .modal-footer button').filter({ hasText:/^CLOSE$/ }).tap();
      await page.locator('.sq-release-notes-modal').waitFor({ state:'detached' });
      await page.locator('#adminCodeBtn').tap();
      await page.locator('#adminCodeGateOverlay').waitFor({ state:'visible' });
      assert.equal(await page.evaluate(()=>window.__sqAdminAuthed), false, 'Admin opens its existing unauthenticated gate');
      await page.locator('#adminCodeGateOverlay button').filter({ hasText:/^Return$/ }).tap();
      await page.locator('#adminCodeGateOverlay').waitFor({ state:'detached' });
      await page.evaluate(()=>window.scrollTo(0,0));
      await openModes(); await checkCards(); await snapshot('mode');
      if (height === 568) {
        await modeBody.evaluate(n=>n.scrollTop=n.scrollHeight);
        const last = await page.locator('#trainingBtn').boundingBox();
        const footer = await page.locator('#closeStartGameModalBtn').boundingBox();
        assert(last.y+last.height <= footer.y+1, 'last main option can be fully reached above Back');
      }
      await page.locator('#practiceBtn').tap();
      assert.equal(await modeBody.evaluate(n=>n.scrollTop), 0, 'Practice starts at its introduction');
      await checkCards(); await snapshot('practice');
      const beforeAi = await page.evaluate(()=>({mode:window.__sqSelectedMode,practice:window.__sqPracticeGameType}));
      assert.equal(await page.locator('#practiceVsAiBtn').getAttribute('aria-disabled'), 'true');
      // aria-disabled is intentional feedback; native disabled is false. Use actual touch.
      await page.locator('#practiceVsAiBtn').scrollIntoViewIfNeeded();
      const ai = await page.locator('#practiceVsAiBtn').boundingBox();
      await page.touchscreen.tap(ai.x + ai.width/2, ai.y + ai.height/2);
      await page.locator('[role="status"]').filter({hasText:'VS AI coming soon - needs the AI opponent engine first.'}).waitFor({state:'visible'});
      assert.deepEqual(await page.evaluate(()=>({mode:window.__sqSelectedMode,practice:window.__sqPracticeGameType})), beforeAi, 'VS AI Coming Soon does not select a playable mode');
      if (height === 568) {
        await modeBody.evaluate(n=>n.scrollTop=n.scrollHeight);
        const last = await page.locator('#practiceVsShadowBtn').boundingBox();
        const footer = await page.locator('#startGameModalBody .sg-practice-footer button').boundingBox();
        assert(last.y+last.height <= footer.y+1, 'Vs Shadow can be fully reached above Back');
        await snapshot('practice-last');
      }
      await back();
      assert.equal(await modeBody.evaluate(n=>n.scrollTop), 0, 'Back opens the main chooser at its start');
      await page.locator('#questBtn').tap();
      assert.equal(await modeBody.evaluate(n=>n.scrollTop), 0, 'Match submenu starts at its introduction');
      await checkCards(); await snapshot('match');
      assert.equal(await page.locator('#matchTurboBtn .sg-opt-desc').evaluate(n=>getComputedStyle(n).color), 'rgb(127, 174, 200)', 'Turbo descriptor keeps its existing cyan family');
      await back();
      if (width === 390) {
        for (const [parent,choice,expected] of [['questBtn','matchClassicBtn','classic'],['questBtn','matchTurboBtn','turbo'],['practiceBtn','practiceClassicBtn','classic'],['practiceBtn','practiceVsShadowBtn','vsShadow']]) {
          await page.locator('#'+parent).tap(); await page.locator('#'+choice).tap();
          await page.waitForFunction(()=>document.body.dataset.page === 'players');
          const mode = await page.evaluate(()=>({selected:window.__sqSelectedMode,variant:window.__sqSelectedMatchVariant,practice:window.__sqPracticeGameType}));
          assert.equal(mode.selected, parent === 'questBtn' ? 'match' : 'practice');
          assert.equal(parent === 'questBtn' ? mode.variant : mode.practice, expected, `${choice} retains its actual Match Card route`);
          await page.locator('#startScreenBtn').tap(); await mainReady();
        }
        // Fixture only the read providers; the real mode buttons and handlers remain intact.
        await page.evaluate(() => {
          const players = [{id:'vis-qa-1',name:'VIS QA ALPHA',nickname:'Route fixture'},{id:'vis-qa-2',name:'VIS QA BETA',nickname:'Route fixture'}];
          const load = async () => players;
          window.__sqLoadPlayerStatsPlayers = load;
          try { __sqLoadPlayerStatsPlayers = load; } catch (_) {}
          window.cloudListPlayers = load;
          try { cloudListPlayers = load; } catch (_) {}
          window.getGamesForMode = async () => [];
        });
        for (const [id,title] of [['trainingBtn','TRAINING'],['tournamentBtn','TOURNAMENT']]) {
          await page.locator('#'+id).tap();
          await page.waitForFunction(text=>document.querySelector('#startGameModalBody .sg-tournament-title')?.textContent.includes(text), title);
          await back();
        }
      }
      await page.locator('#closeStartGameModalBtn').tap();
      assert.equal(await page.evaluate(()=>document.body.dataset.page), 'details', 'main Back returns Home');
      assert.deepEqual(consoleErrs.filter(e=>e.startsWith('pageerror:')), [], 'no uncaught browser error');
      // WebKit reports this exact read failure when the harness blocks Supabase.
      const unexpected = consoleErrs.filter(e=>!BROWSER_NOISE.test(e) && !/^syncSavedPlayersFromCloud failed.*TypeError: Load failed/i.test(e));
      assert.deepEqual(unexpected, [], 'no unexpected console errors');
      console.log(`PASS VIS-001 ${width}×${height}: populated VIDE, touch/focus, utility routes, mode labels, submenu scrolling and Back`);
    } finally { await browser.close(); }
  }
})().catch(error=>{console.error(error);process.exit(1);});
