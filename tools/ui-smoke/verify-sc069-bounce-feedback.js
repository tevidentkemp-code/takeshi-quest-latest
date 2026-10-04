// Native MISS/Undo/navigation gestures. Read fixtures; every production write is blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');
const out = process.env.SQ_SC069_ARTIFACTS || '/tmp/sc069-feedback-' + (process.env.SQ_BROWSER || 'chromium');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const { browser, ctx, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  let blockedWrites = 0;
  const receipts = [];
  try {
    await ctx.route('**.supabase.co/rest/v1/**', r => {
      const method = r.request().method(), headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '*/0' };
      if (method === 'GET') return r.fulfill({ status: 200, headers, contentType: 'application/json', body: '[]' });
      if (method === 'HEAD') return r.fulfill({ status: 200, headers, body: '' });
      if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET,HEAD,OPTIONS', 'access-control-allow-headers': r.request().headers()['access-control-request-headers'] || 'apikey,authorization,content-type,x-client-info' }, body: '' });
      blockedWrites++; return r.abort('failed');
    });
    await ctx.addInitScript(() => {
      const d = window.__sc069 = { armed: false, frames: [], records: [], writes: [], events: [], emits: [], detaches: [], timerMarks: [] };
      // Private observation only: no layout reads, native input/state/timer changes.
      d.inspectGesture = (target, pointerId) => {
        try {
          const current = document.querySelector('#pad .dtActBtn.miss');
          const nearest = target?.closest?.('#pad .dtActBtn.miss') || null;
          const node = el => el ? { connected: el.isConnected, bound: el.__sqMissBounceHoldBound === true, start: el.__sqMissBounceStart ? { ...el.__sqMissBounceStart } : null, heldClass: el.classList.contains('sq-miss-bounce-held'), captured: pointerId == null ? null : el.hasPointerCapture?.(pointerId) === true } : null;
          return { nearestMiss: node(nearest), currentMiss: node(current), heldMiss: node(d.held), nearestIsCurrent: nearest === current, heldIsCurrent: d.held === current, cursor: typeof state === 'undefined' ? null : { history: state.history?.length, player: state.currentPlayer, round: state.currentRound, dart: state.currentDart, token: state.__gameToken }, suppressClickUntil: Number(window.__sqMissBounceSuppressClick || 0) };
        } catch (error) { return { observationError: String(error) }; }
      };
      for (const type of ['pointerdown', 'pointerup', 'click', 'pointermove', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) document.addEventListener(type, e => {
        if (d.armed) d.events.push({ type, at: performance.now(), text: String(e.target?.textContent || '').trim(), cls: String(e.target?.className || ''), heldConnected: d.held?.isConnected, pointerId: e.pointerId ?? null, pointerType: e.pointerType ?? null, clientX: e.clientX ?? null, clientY: e.clientY ?? null, buttons: e.buttons ?? null, gesture: d.inspectGesture(e.target, e.pointerId) });
      }, true);
      const nativeSetTimeout = window.setTimeout, nativeClearTimeout = window.clearTimeout, watchedTimers = new Map();
      window.setTimeout = function(callback, delay, ...args) {
        if (!d.armed || Number(delay) !== 360 || typeof callback !== 'function') return Reflect.apply(nativeSetTimeout, this, [callback, delay, ...args]);
        const mark = { caseAtSchedule: d.name, scheduledAt: performance.now(), delay: Number(delay), missBounceCallback: Function.prototype.toString.call(callback).includes("recordThrow({ kind:'BounceOut' })") };
        let handle;
        const observed = function(...callbackArgs) {
          watchedTimers.delete(handle);
          d.timerMarks.push({ ...mark, handle, phase: 'fire-before', at: performance.now(), gesture: d.inspectGesture(d.held) });
          try { return Reflect.apply(callback, this, callbackArgs); }
          finally { d.timerMarks.push({ ...mark, handle, phase: 'fire-after', at: performance.now(), gesture: d.inspectGesture(d.held) }); }
        };
        handle = Reflect.apply(nativeSetTimeout, this, [observed, delay, ...args]);
        watchedTimers.set(handle, mark);
        d.timerMarks.push({ ...mark, handle, phase: 'schedule', at: performance.now(), gesture: d.inspectGesture(d.held) });
        return handle;
      };
      window.clearTimeout = function(handle) {
        const mark = watchedTimers.get(handle);
        if (mark && d.armed) d.timerMarks.push({ ...mark, handle, phase: 'clear', at: performance.now(), gesture: d.inspectGesture(d.held) });
        watchedTimers.delete(handle);
        return Reflect.apply(nativeClearTimeout, this, [handle]);
      };
      const p = CanvasRenderingContext2D.prototype, clear = p.clearRect, text = p.fillText;
      p.clearRect = function () { const result = clear.apply(this, arguments); if (d.armed && this.canvas.width === 640 && this.canvas.height === 160 && !this.canvas.id) { this.__sc069Frame = { at: performance.now(), text: [] }; d.frames.push(this.__sc069Frame); if (d.frames.length > 240) d.frames.shift(); } return result; };
      p.fillText = function () { const result = text.apply(this, arguments); if (d.armed && this.__sc069Frame) this.__sc069Frame.text.push(String(arguments[0])); return result; };
    });
    await H.boot(page, { settle: 800 });
    await H.toMatchCard(page); await H.addGuests(page, ['AUDIT ALPHA', 'AUDIT BETA']); await H.startMatch(page, 3);
    await page.waitForFunction(() => window.__sqDmdV2Ready === true && document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden') === 'true');
    await page.evaluate(() => {
      const d = window.__sc069;
      d.snap = () => ({ at: performance.now(), page: document.body.dataset.page, finished: state.finished, history: state.history.length, player: state.currentPlayer, round: state.currentRound, dart: state.currentDart, tail: state.history.at(-1), controller: window.__sqDmdV2.snapshot() });
      const record = recordThrow;
      recordThrow = window.recordThrow = function () { const entry = { at: performance.now(), spec: { ...arguments[0] }, before: d.snap() }; try { return record.apply(this, arguments); } finally { if (d.armed) { entry.after = d.snap(); d.records.push(entry); } } };
      const render = window.__sqDmdShowTransientZones;
      window.__sqDmdShowTransientZones = function () { if (d.armed) d.writes.push({ at: performance.now(), zones: { ...arguments[0] }, opts: { ...arguments[1] }, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }); return render.apply(this, arguments); };
      const emit = window.__sqDmdV2.emit;
      window.__sqDmdV2.emit = function () { if (d.armed) d.emits.push({ at: performance.now(), event: { ...arguments[0] } }); if (d.failFeedback && arguments[0]?.kind === 'BOUNCE_OUT') throw Error('SC069 isolated display failure'); return emit.apply(this, arguments); };
      new MutationObserver(() => { if (d.armed && d.held && !d.held.isConnected && !d.detaches.length) d.detaches.push({ at: performance.now(), state: d.snap() }); }).observe(document.getElementById('pad'), { childList: true, subtree: true });
    });
    const begin = async name => { console.log('CASE ' + name); await page.evaluate(name => { const d = window.__sc069; Object.assign(d, { name, armed: true, frames: [], records: [], writes: [], events: [], emits: [], detaches: [], timerMarks: [], held: document.querySelector('#pad .dtActBtn.miss') }); d.before = d.snap(); }, name); };
    const read = async () => { const r = await page.evaluate(() => { const d = window.__sc069; return { name: d.name, before: d.before, after: d.snap(), records: d.records, writes: d.writes, emits: d.emits, events: d.events, frames: d.frames, detaches: d.detaches, timerMarks: d.timerMarks }; }); receipts.push(r); fs.writeFileSync(path.join(out, r.name + '.json'), JSON.stringify(r, null, 2)); console.log('RESULT ' + r.name + ' ' + JSON.stringify({ historyBefore: r.before.history, historyAfter: r.after.history, records: r.records.map(x => x.spec), BOEmits: r.emits.filter(e => e.event.kind === 'BOUNCE_OUT').length, detaches: r.detaches.length })); return r; };
    const press = async () => { const b = await page.locator('#pad .dtActBtn.miss').boundingBox(); assert(b, 'MISS visible'); const point = { x: b.x + b.width / 2, y: b.y + b.height / 2 }; await page.mouse.move(point.x, point.y); await page.mouse.down(); return point; };
    const hold = async () => { await press(); await page.waitForTimeout(450); await page.mouse.up(); };
    const undoAll = async () => { for (let i = 0; i < 8 && await page.evaluate(() => state.history.length > 0); i++) await page.locator('#pad .dtActBtn.undo').click(); await page.waitForTimeout(750); assert.equal(await page.evaluate(() => state.history.length), 0); };
    const boFrames = r => r.frames.filter(f => f.text.join('').includes('BOUNCE OUT'));
    const committedBO = r => { assert.equal(r.records.length, 1, 'one canonical hold call'); assert.equal(r.records[0].spec.kind, 'BounceOut'); assert.equal(r.after.history, r.before.history + 1, 'one accepted history entry'); assert.equal(r.after.tail.throw.bounceOut, true); assert.equal(r.after.tail.throw.points, 0); assert.equal(r.emits.filter(e => e.event.kind === 'BOUNCE_OUT').length, 1, 'one presentation dispatch'); assert(r.emits.find(e => e.event.kind === 'BOUNCE_OUT').at >= r.records[0].at, 'feedback follows canonical call'); };

    await begin('short-tap'); await page.locator('#pad .dtActBtn.miss').click(); let r = await read();
    assert.equal(r.records.length, 1); assert.equal(r.records[0].spec.kind, 'Miss'); assert.equal(r.after.tail.throw.bounceOut, undefined); assert.equal(r.emits.length, 0); await undoAll();

    await begin('hold-real-rapid-next-press');
    const rapidPoint = await press(); await page.waitForTimeout(450);
    // Read the current MISS target while the first pointer is still down. A
    // canonical render may replace the pad; do no layout/transport work between
    // the measured first release and genuine next native press.
    const rapidTarget = await page.locator('#pad .dtActBtn.miss').boundingBox();
    assert(rapidTarget, 'current MISS visible before rapid release');
    assert(rapidPoint.x >= rapidTarget.x && rapidPoint.x < rapidTarget.x + rapidTarget.width && rapidPoint.y >= rapidTarget.y && rapidPoint.y < rapidTarget.y + rapidTarget.height, 'held pointer remains inside the current MISS target');
    await page.mouse.up(); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(100); r = await read();
    assert.deepEqual(r.records.map(x => x.spec.kind), ['BounceOut', 'Miss']); assert.equal(r.after.history, 2); assert.equal(r.records[0].after.tail.throw.bounceOut, true); assert.equal(r.after.tail.throw.bounceOut, undefined);
    const downs = r.events.filter(e => e.type === 'pointerdown'), ups = r.events.filter(e => e.type === 'pointerup'); r.rapidGapMs = downs[1].at - ups[0].at;
    console.log('MEASURE genuine BO next-press gap ' + JSON.stringify({ ms: r.rapidGapMs, pointerdownCount: downs.length, pointerupCount: ups.length }));
    assert(r.rapidGapMs < 220, 'second genuine press actually occurred within220ms'); await undoAll();

    await page.locator('#pad .dtActBtn.miss').click(); await page.locator('#pad .dtActBtn.miss').click(); await begin('third-dart-detach'); await hold(); await page.waitForTimeout(100); r = await read(); committedBO(r);
    assert.equal(r.detaches.length, 1); assert.equal(r.after.player, 1); assert.equal(r.after.dart, 0); await undoAll();

    await begin('hold-immediate-undo'); await hold(); await page.locator('#pad .dtActBtn.undo').click(); await page.waitForTimeout(1100); r = await read();
    assert.equal(r.records.length, 1); assert.equal(r.after.history, 0); assert.equal(r.after.dart, 0); const undoneAt = r.events.find(e => e.type === 'click' && e.text === 'UNDO').at;
    assert(!boFrames(r).some(f => f.at > undoneAt), 'no BO canvas frame survives actual Undo'); assert(!r.after.controller.queue.some(m => m.bounceOut)); await page.screenshot({ path: path.join(out, 'after-undo.png') }); await undoAll();

    await page.emulateMedia({ reducedMotion: 'reduce' }); await begin('reduced-motion-static-canvas'); await hold(); await page.waitForTimeout(100); await page.screenshot({ path: path.join(out, 'reduced-motion-static.png') }); await page.waitForTimeout(500); r = await read(); committedBO(r);
    const safe = r.writes.find(w => w.zones.z2 === 'BOUNCE OUT'); assert(safe && safe.reduced); assert.equal(safe.opts.type, 'hold'); assert.equal(safe.opts.ms, 420); assert.equal(safe.opts.amp, 0); assert.equal(safe.opts.fx, undefined);
    const visible = boFrames(r); assert(visible.length >= 2, 'static BO text actually draws'); assert(!r.frames.some(f => f.at >= visible[0].at && f.at <= visible.at(-1).at && f.text.length === 0), 'no alternating blank BO canvas frames under reduced motion');
    await undoAll(); await page.emulateMedia({ reducedMotion: 'no-preference' });

    await begin('rejected-busy-hold'); await page.evaluate(() => window.__sqInitialOrderApplying = true); await hold(); r = await read(); await page.evaluate(() => window.__sqInitialOrderApplying = false);
    assert.equal(r.records.length, 1); assert.equal(r.after.history, 0); assert.equal(r.emits.length, 0, 'rejected call never cues');

    await begin('feedback-unavailable'); await page.evaluate(() => window.__sc069.failFeedback = true); await hold(); r = await read(); await page.evaluate(() => window.__sc069.failFeedback = false); committedBO(r); await undoAll();

    // Presentation-only high-record setup; the audited hold is still a native
    // gesture. Measure latency without changing priorities or forcing a frame.
    await page.evaluate(() => window.__sqDmdV2.emit({ kind: 'SHATEKI_RECORD', gameScore: 900 })); await begin('queued-behind-record'); await hold();
    const queued = await page.evaluate(() => window.__sqDmdV2.snapshot()); assert.equal(queued.active.headline, 'NEW SHATEKI RECORD'); assert(queued.queue.some(m => m.bounceOut));
    await page.waitForTimeout(1250); r = await read(); committedBO(r); const first = boFrames(r)[0]; r.recordQueueLatencyMs = first ? first.at - r.records[0].at : null; console.log('MEASURE queued BO latency ' + JSON.stringify({ ms: r.recordQueueLatencyMs, frames: boFrames(r).length })); await undoAll();

    await page.evaluate(() => window.__sqDmdV2.emit({ kind: 'SHATEKI_RECORD', gameScore: 900 })); await begin('queued-record-then-undo'); await hold(); await page.locator('#pad .dtActBtn.undo').click(); await page.waitForTimeout(1400); r = await read();
    assert.equal(r.after.history, 0); assert.equal(boFrames(r).length, 0, 'queued BO cannot replay behind higher record after Undo'); assert(!r.after.controller.queue.some(m => m.bounceOut)); await undoAll();

    async function advance(round) { await page.evaluate(round => { for (let n = 0; state.currentRound < round && n < 100; n++) { const type = ROUNDS[state.currentRound].type; recordThrow(type === 'doubles' ? { kind: 'D', sector: 20 } : type === 'triples' ? { kind: 'T', sector: 20 } : { kind: state.currentPlayer === 0 ? 'T' : 'S' }); } if (state.currentRound !== round) throw Error('Canonical round fixture failed'); }, round); await page.waitForFunction(round => document.querySelector('#v2Rows .v2Badge.liveRow')?.dataset.round === String(round), round); }
    for (const [name, round] of [['doubles-hold', 11], ['triples-hold', 12], ['bull-hold', 13]]) { await advance(round); if (round === 13) await page.evaluate(() => recordThrow({ kind: 'B', bull: 'Inner' })); await begin(name); await hold(); r = await read(); committedBO(r); }

    // Finish a real canonical asymmetric game; only the final Bull gesture is
    // under observation. No new six-player start or invented score fixture.
    await page.evaluate(() => { for (let n = 0; n < 6 && !(state.currentRound === 13 && state.currentPlayer === 1 && state.currentDart === 2); n++) recordThrow({ kind: 'B', bull: 'Inner' }); if (state.currentRound !== 13 || state.currentPlayer !== 1 || state.currentDart !== 2) throw Error('Final Bull fixture failed'); });
    await begin('accepted-final-bull'); await hold(); await page.waitForFunction(() => state.finished === true); r = await read(); committedBO(r); assert(r.after.finished, 'final dart completes game'); await page.screenshot({ path: path.join(out, 'accepted-final-bull.png') });

    await page.locator('[data-action="gcClose"]').click(); await page.locator('#settingsBtnGame').click(); await page.locator('.sq-menu106-row').filter({ hasText: 'End Match' }).click(); await page.locator('.sq-confirm-bd .sq-endmatch-yes').click();
    await page.waitForFunction(() => document.body.dataset.page === 'details' && state.history.length === 0);
    assert.equal(await page.evaluate(() => document.body.dataset.page), 'details'); assert.equal(await page.evaluate(() => state.history.length), 0); assert.equal(await page.evaluate(() => window.__sqDmdV2.snapshot().queue.some(m => m.bounceOut) || !!window.__sqDmdV2.snapshot().active?.bounceOut), false);

    // A fresh ordinary match gives the real pre-threshold End Match path a clean
    // cursor. The mouse remains down while actual keyboard controls navigate.
    await H.toMatchCard(page); await H.addGuests(page, ['AUDIT ALPHA', 'AUDIT BETA']); await H.startMatch(page, 3);
    await begin('navigation-before-threshold'); await press(); await page.waitForTimeout(30); await page.locator('#settingsBtnGame').focus(); await page.keyboard.press('Enter');
    const end = page.locator('.sq-menu106-row').filter({ hasText: 'End Match' }); await end.waitFor({ state: 'visible' }); await end.focus(); await page.keyboard.press('Enter'); const yes = page.locator('.sq-confirm-bd .sq-endmatch-yes'); await yes.waitFor({ state: 'visible' }); await yes.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(550); await page.mouse.up(); r = await read();
    const confirmed = r.events.find(e => e.type === 'click' && e.text === 'YES').at, down = r.events.find(e => e.type === 'pointerdown').at; r.navConfirmMs = confirmed - down; assert(r.navConfirmMs < 360, 'navigation genuinely completed before hold threshold');
    assert.equal(r.after.page, 'details'); assert.equal(r.after.history, 0); assert.equal(r.records.length, 0, 'cancelled navigation makes no late scoring call'); assert.equal(r.emits.filter(e => e.event.kind === 'BOUNCE_OUT').length, 0); assert.equal(boFrames(r).length, 0); await page.screenshot({ path: path.join(out, 'after-navigation.png') });

    // Established SC065/SC070 fixture shape with actual throw-order confirmation
    // and Turbo Ready. No new six-player start; recovered-six is appended to an
    // already legal five-player fixture exactly as the protected suite does.
    async function seed(count, mode) {
      const expectedToken = await page.evaluate(({ count, mode }) => {
        const token = Number(state.__gameToken || 0); state = JSON.parse(JSON.stringify(baseState)); state.__gameToken = token;
        const expectedToken = Number(state.__gameToken || 0) + 1;
        state.players = Array.from({ length: count }, (_, i) => ({ id: 'sc069-' + i, name: 'AUDIT ' + (i + 1), initials: 'A' + (i + 1), avatar_id: i + 1 })); assignUniqueColors(state.players);
        state.match = { id: 'sc069-offline', gameNumber: 1, targetWins: 3, autoRotateOrder: true, wins: Array(count).fill(0), history: [], mode: 'match', gameFormat: 'match_play', gameVariant: 'classic' };
        if (mode === 'practice') Object.assign(state.match, { mode: 'practice', forcePractice: true, isPractice: true });
        if (mode === 'tournament') Object.assign(state.match, { tournament: true, tournamentType: 'classic', tournamentRules: { startRoundIndex: 0, strictTimer: false } });
        if (mode === 'turbo') Object.assign(state.match, { mode: 'turbo', gameVariant: 'turbo', startTarget: '17', strictTimer: true, throwLimitSeconds: 20 });
        startNewGame(count > 1 ? false : true);
        return expectedToken;
      }, { count, mode });
      if (count > 1) await page.click('.to-start');
      await page.waitForFunction(expectedToken=>!window.__sqThrowOrderRevealPending&&!document.querySelector('.sq-throw-order-reveal')&&Number(state.__gameToken||0)===expectedToken&&document.body.dataset.page==='game'&&!state.__sqSecurityPreparing&&!window.__sqSecurityInputBlocked&&state.__sqGameControl&&window.SQ_GAMEPLAY.hasCachedController(state)&&window.SQ_GAMEPLAY.canThrow()&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true',expectedToken);
      if (mode === 'turbo') { await page.waitForFunction(() => document.body.dataset.page === 'game'); await page.click('.sq-turbo-ready-start'); await page.waitForFunction(() => window.__sqTurboTimerStatus().active); }
      await page.waitForFunction(expectedToken=>!window.__sqThrowOrderRevealPending&&!document.querySelector('.sq-throw-order-reveal')&&Number(state.__gameToken||0)===expectedToken&&document.body.dataset.page==='game'&&!state.__sqSecurityPreparing&&!window.__sqSecurityInputBlocked&&state.__sqGameControl&&window.SQ_GAMEPLAY.hasCachedController(state)&&window.SQ_GAMEPLAY.canThrow()&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true',expectedToken);
    }
    async function modeHold(name) {
      await begin(name); await hold(); r = await read(); committedBO(r);
      await page.locator('#pad .dtActBtn.undo').click(); await page.waitForTimeout(1100);
      const restored = await page.evaluate(() => ({ state: window.__sc069.snap(), frames: window.__sc069.frames, events: window.__sc069.events }));
      const undoAt = restored.events.find(e => e.type === 'click' && e.text === 'UNDO').at;
      assert.equal(restored.state.history, 0, name + ' Undo preserves the empty starting cursor');
      assert(!restored.frames.some(f => f.at > undoAt && f.text.join('').includes('BOUNCE OUT')), name + ' has no stale BO after Undo');
      r.undoAfter = restored.state;
    }
    for (const count of [2, 3, 4, 5]) { await seed(count, 'match'); await modeHold('classic-' + count + '-player-hold-undo'); }
    for (const [count, mode] of [[1, 'practice'], [3, 'practice'], [3, 'tournament'], [2, 'turbo']]) { await seed(count, mode); await modeHold(mode + '-' + count + '-player-hold-undo'); }
    await seed(5, 'match');
    await page.evaluate(() => { state.players.push({ id: 'sc069-historic-6', name: 'HISTORIC SIX', initials: 'H6', color: '#abcdef' }); state.score.push(JSON.parse(JSON.stringify(state.score[0]))); state.match.wins.push(0); ensureMatchAgg(); updateUI(); });
    await page.waitForFunction(() => document.getElementById('liveV2Panel').dataset.pcount === '6'); await modeHold('recovered-six-hold-undo');
    // Recovered Shadow human input does not require inventing an Official replay.
    // Keep its completion/auto-turn disabled and preserve the established wipe.
    await seed(2, 'practice');
    await page.evaluate(() => { state.players[1].isShadow = true; state.match.practiceType = 'vsShadow'; state.shadow = { mode: 'vsShadow', realPlayerIndex: 0, shadowPlayerIndex: 1 }; updateUI(); });
    assert.equal(await page.evaluate(() => __sqIsVsShadowRuntime() && !__sqVsShadowCurrentPlayerIsShadow() && __sqVsShadowCompletionBlocked()), true); await modeHold('recovered-shadow-human-hold-undo');

    assert.deepEqual(consoleErrs.filter(e => e.startsWith('pageerror:')), [], 'strict page errors');
    fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify({ url: H.APP_URL, browser: process.env.SQ_BROWSER || 'chromium', blockedWrites, strictPageErrors: [], cases: receipts }, null, 2));
    console.log('SC069 native feedback PASS ' + JSON.stringify({ cases: receipts.length, blockedWrites, strictPageErrors: [] }));
  } catch (error) {
    try { await page.screenshot({ path: path.join(out, 'failure.png') }); fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: String(error), state: await page.evaluate(() => window.__sc069?.snap?.()), gestureObservation: await page.evaluate(() => { const d = window.__sc069; return d ? { events: d.events, timerMarks: d.timerMarks, gesture: d.inspectGesture?.(d.held) } : null; }), pageErrors: consoleErrs.filter(e => e.startsWith('pageerror:')) }, null, 2)); } catch (_) {}
    throw error;
  } finally { await browser.close(); console.log('SC069 browser fully closed'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
