const assert = require('assert');
const H = require('./harness');

function blankBoard() {
  return Array.from({ length: 14 }, () => ({ darts: [null, null, null], roundTotal: 0 }));
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await H.boot(page, { settle: 2200 });

    const eligibility = await page.evaluate(() => {
      const make = ({ count = 3, round = 5, mode = 'match', forcePractice = false, tournament = false, vsShadow = false } = {}) => {
        state.players = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'P' + (i + 1) }));
        state.score = state.players.map(() => Array.from({ length: MAX_ROUNDS }, () => ({ darts: [null, null, null], roundTotal: 0 })));
        state.currentRound = round;
        state.currentPlayer = 0;
        state.currentDart = 0;
        state.history = [];
        state.finished = false;
        state.suddenDeath = { active: false, participants: [], turnIndex: 0, throws: [], round: 1 };
        state.match = {
          id: 'sc034-gate',
          mode,
          gameMode: mode,
          gameFormat: 'match_play',
          gameVariant: mode === 'turbo' ? 'turbo' : 'classic',
          forcePractice,
          tournament,
          autoRotateOrder: true,
          wins: Array.from({ length: count }, () => 0),
          history: [],
          targetWins: 3,
          gameNumber: 1
        };
        state.matchAgg = {
          hits: Array.from({ length: count }, () => ({})),
          totals60: Array.from({ length: count }, () => 0),
          totals100: Array.from({ length: count }, () => 0),
          totals140: Array.from({ length: count }, () => 0)
        };
        delete state.lateEntryCatchups;
        delete state.__sqLateCatchupActive;
        if (vsShadow) {
          state.match.mode = 'practice';
          state.match.forcePractice = true;
          state.match.practiceType = 'vsshadow';
          state.shadow = { status: 'runtime_phase', autoTurnEnabled: true };
        } else {
          delete state.shadow;
        }
      };

      make({ round: 6 });
      const before17 = __sqLateEntryStatus();

      make({ round: 7 });
      const at17BeforeDart = __sqLateEntryStatus();
      state.score[0][7].darts[0] = { kind: 'Miss', points: 0 };
      const at17AfterDart = __sqLateEntryStatus();

      make({ round: 8 });
      const after17 = __sqLateEntryStatus();

      make({ count: 6, round: 4 });
      const full = __sqLateEntryStatus();

      make({ round: 4, mode: 'practice', forcePractice: true });
      const practice = __sqLateEntryStatus();

      make({ round: 4, tournament: true });
      const tournament = __sqLateEntryStatus();

      make({ round: 7, mode: 'turbo' });
      const turboBeforeFirst17 = __sqLateEntryStatus();
      state.score[1][7].darts[0] = { kind: 'S', points: 17 };
      const turboAfterFirst17 = __sqLateEntryStatus();

      return { before17, at17BeforeDart, at17AfterDart, after17, full, practice, tournament, turboBeforeFirst17, turboAfterFirst17 };
    });

    assert.equal(eligibility.before17.allowed, true, 'Match Play should allow late entry before 17s');
    assert.equal(eligibility.at17BeforeDart.allowed, true, 'Late entry should remain open before the first dart at 17s');
    assert.equal(eligibility.at17AfterDart.allowed, false, 'Late entry must close after the first dart at 17s');
    assert.equal(eligibility.after17.allowed, false, 'Late entry must remain closed after 17s');
    assert.equal(eligibility.full.allowed, false, 'Six-player game must reject a seventh player');
    assert.equal(eligibility.practice.allowed, false, 'Practice must not inherit Match Play late entry');
    assert.equal(eligibility.tournament.allowed, false, 'Tournament must not inherit Match Play late entry');
    assert.equal(eligibility.turboBeforeFirst17.allowed, true, 'Turbo may add a player only before its first dart at 17s');
    assert.equal(eligibility.turboAfterFirst17.allowed, false, 'Turbo late entry must close after its first dart');

    const added = await page.evaluate(() => {
      state.players = [
        { id: 'a', name: 'ALPHA' },
        { id: 'b', name: 'BETA' },
        { id: 'c', name: 'CHARLIE' }
      ];
      state.score = state.players.map(() => Array.from({ length: MAX_ROUNDS }, () => ({ darts: [null, null, null], roundTotal: 0 })));
      state.currentRound = 5; // 15s live
      state.currentPlayer = 1;
      state.currentDart = 0;
      state.history = [];
      state.finished = false;
      state.suddenDeath = { active: false, participants: [], turnIndex: 0, throws: [], round: 1 };
      state.match = {
        id: 'sc034-add',
        mode: 'match',
        gameMode: 'classic',
        gameFormat: 'match_play',
        gameVariant: 'classic',
        autoRotateOrder: true,
        wins: [2, 1, 0],
        history: [{
          totals: [220, 190, 175],
          board: [
            [{ owner: 'ALPHA', darts: [null, null, null], roundTotal: 0 }],
            [{ owner: 'BETA', darts: [null, null, null], roundTotal: 0 }],
            [{ owner: 'CHARLIE', darts: [null, null, null], roundTotal: 0 }]
          ]
        }],
        targetWins: 3,
        gameNumber: 2
      };
      state.matchAgg = {
        hits: [{ owner: 'ALPHA' }, { owner: 'BETA' }, { owner: 'CHARLIE' }],
        totals60: [4, 3, 2],
        totals100: [1, 1, 0],
        totals140: [0, 0, 0]
      };
      delete state.lateEntryCatchups;
      delete state.__sqLateCatchupActive;

      const result = __sqAddLatePlayer({
        id: 'late-id',
        name: 'DELTA',
        first_name: 'Delta',
        nickname: 'Late'
      });
      const late = state.score[3];
      const avg = (typeof computeMatchAverages === 'function') ? computeMatchAverages()[3] : null;
      return {
        result,
        names: state.players.map(p => p.name),
        wins: state.match.wins.slice(),
        oldTotals: state.match.history[0].totals.slice(),
        oldBoardLen: state.match.history[0].board.length,
        oldBoardLate: state.match.history[0].board[3],
        aggLens: {
          hits: state.matchAgg.hits.length,
          t60: state.matchAgg.totals60.length,
          t100: state.matchAgg.totals100.length,
          t140: state.matchAgg.totals140.length
        },
        statuses: late.slice(0, 6).map(x => x.lateEntryStatus || ''),
        dartsBeforeJoin: late.slice(0, 5).map(x => x.darts.slice()),
        avg
      };
    });

    assert.equal(added.result.ok, true, 'Late player was not added');
    assert.equal(added.result.finalThrower, true, 'Late player must be appended as final thrower');
    assert.deepEqual(added.names, ['ALPHA', 'BETA', 'CHARLIE', 'DELTA'], 'Late player was not appended to the throw order');
    assert.deepEqual(added.result.pendingRounds, [2, 3, 4], 'Only the three most recent missed rounds should be recoverable');
    assert.deepEqual(added.result.scratchedRounds, [0, 1], 'Older missed rounds should be scratched');
    assert.deepEqual(added.wins, [2, 1, 0, 0], 'Match wins were not identity-aligned for the late player');
    assert.equal(added.oldTotals[3], null, 'Previous-game totals need a did-not-participate placeholder');
    assert.equal(added.oldBoardLen, 4, 'Previous-game board needs an identity placeholder');
    assert.equal(added.oldBoardLate, null, 'Previous-game board placeholder must not invent darts');
    assert.deepEqual(added.aggLens, { hits: 4, t60: 4, t100: 4, t140: 4 }, 'Match aggregate arrays were not extended');
    assert.deepEqual(added.statuses, ['scratched_absent', 'scratched_absent', 'catchup_pending', 'catchup_pending', 'catchup_pending', ''], 'Late-entry round classification is wrong');
    assert(added.dartsBeforeJoin.flat().every(x => x === null), 'Absent rounds must not fabricate dart attempts');
    if (added.avg) assert.equal(added.avg.throws, 0, 'Absent/pending rounds must not count as thrown darts');

    const catchup = await page.evaluate(() => {
      // DELTA is the final thrower in the live 15s round.
      state.currentPlayer = 3;
      state.currentRound = 5;
      state.currentDart = 0;
      for (let i = 0; i < 3; i++) recordThrow({ kind: 'Miss' });
      const afterLiveRound = {
        active: JSON.parse(JSON.stringify(state.__sqLateCatchupActive || null)),
        currentPlayer: state.currentPlayer,
        currentRound: state.currentRound,
        pending: state.lateEntryCatchups[0].pendingRounds.slice()
      };

      const progression = [];
      for (let visit = 0; visit < 3; visit++) {
        for (let i = 0; i < 3; i++) recordThrow({ kind: 'Miss' });
        progression.push({
          active: JSON.parse(JSON.stringify(state.__sqLateCatchupActive || null)),
          currentPlayer: state.currentPlayer,
          currentRound: state.currentRound,
          pending: state.lateEntryCatchups[0].pendingRounds.slice()
        });
      }

      const afterAll = {
        currentPlayer: state.currentPlayer,
        currentRound: state.currentRound,
        active: state.__sqLateCatchupActive || null,
        pending: state.lateEntryCatchups[0].pendingRounds.slice(),
        completed: state.lateEntryCatchups[0].completedRounds.slice(),
        statuses: state.score[3].slice(0, 6).map(x => x.lateEntryStatus || ''),
        throws: (typeof computeMatchAverages === 'function') ? computeMatchAverages()[3].throws : null
      };

      // Undo the last catch-up dart after live play has resumed.
      undo();
      const afterUndo = {
        currentPlayer: state.currentPlayer,
        currentRound: state.currentRound,
        currentDart: state.currentDart,
        active: JSON.parse(JSON.stringify(state.__sqLateCatchupActive || null)),
        pending: state.lateEntryCatchups[0].pendingRounds.slice()
      };
      recordThrow({ kind: 'Miss' });
      const afterRedo = {
        currentPlayer: state.currentPlayer,
        currentRound: state.currentRound,
        currentDart: state.currentDart,
        active: state.__sqLateCatchupActive || null,
        pending: state.lateEntryCatchups[0].pendingRounds.slice()
      };

      save();
      const saved = safeLoad(STORAGE_KEY);
      return { afterLiveRound, progression, afterAll, afterUndo, afterRedo, saved };
    });

    assert.equal(catchup.afterLiveRound.currentPlayer, 3, 'Catch-up must stay with the late player');
    assert.equal(catchup.afterLiveRound.currentRound, 2, 'Catch-up should start at the oldest of the three recoverable rounds');
    assert.equal(catchup.afterLiveRound.active.roundIndex, 2, 'Catch-up active round mismatch');
    assert.deepEqual(catchup.afterLiveRound.pending, [2, 3, 4], 'Pending catch-up queue changed before a catch-up visit completed');
    assert.equal(catchup.progression[0].currentRound, 3, 'Catch-up did not advance to second missed round');
    assert.equal(catchup.progression[1].currentRound, 4, 'Catch-up did not advance to third missed round');
    assert.equal(catchup.progression[2].currentRound, 6, 'Live play did not resume at the next table round');
    assert.equal(catchup.progression[2].currentPlayer, 0, 'Live play must resume with the first thrower');
    assert.equal(catchup.afterAll.active, null, 'Catch-up state should clear after all permitted rounds');
    assert.deepEqual(catchup.afterAll.pending, [], 'Catch-up queue should be empty after completion');
    assert.deepEqual(catchup.afterAll.completed, [2, 3, 4], 'Catch-up completion list is wrong');
    assert.equal(catchup.afterAll.statuses[0], 'scratched_absent', 'Older scratch classification changed');
    assert.equal(catchup.afterAll.statuses[1], 'scratched_absent', 'Older scratch classification changed');
    assert.deepEqual(catchup.afterAll.statuses.slice(2, 5), ['catchup_complete', 'catchup_complete', 'catchup_complete'], 'Catch-up completion markers are wrong');
    if (catchup.afterAll.throws != null) assert.equal(catchup.afterAll.throws, 12, 'Only real live/catch-up darts should count as attempts');

    assert.equal(catchup.afterUndo.currentPlayer, 3, 'Undo must return to the late player');
    assert.equal(catchup.afterUndo.currentRound, 4, 'Undo must restore the catch-up target');
    assert.equal(catchup.afterUndo.currentDart, 2, 'Undo should reopen the third dart of the completed catch-up visit');
    assert.equal(catchup.afterUndo.active.roundIndex, 4, 'Undo did not reactivate catch-up state');
    assert(catchup.afterUndo.pending.includes(4), 'Undo did not restore the catch-up round to the queue');
    assert.equal(catchup.afterRedo.currentRound, 6, 'Redo did not return to live play');
    assert.equal(catchup.afterRedo.currentPlayer, 0, 'Redo did not return to the first live thrower');
    assert.equal(catchup.afterRedo.active, null, 'Redo left stale catch-up state');
    assert(catchup.saved && Array.isArray(catchup.saved.lateEntryCatchups), 'Late-entry queue was not persisted in the resume cache');

    const rotationIdentity = await page.evaluate(() => {
      // Prove SC-033 rotation still keeps the new player's historical placeholders
      // and match aggregates aligned with identity after SC-034.
      const before = {
        names: state.players.map(p => p.name),
        wins: state.match.wins.slice(),
        totals: state.match.history[0].totals.slice(),
        boardOwners: state.match.history[0].board.map(rows => rows == null ? null : (rows?.[0]?.owner || null)),
        hits: state.matchAgg.hits.slice()
      };
      const ok = __sqRotateThrowOrderOnePlace();
      return {
        ok,
        before,
        after: {
          names: state.players.map(p => p.name),
          wins: state.match.wins.slice(),
          totals: state.match.history[0].totals.slice(),
          boardOwners: state.match.history[0].board.map(rows => rows == null ? null : (rows?.[0]?.owner || null)),
          hits: state.matchAgg.hits.slice()
        }
      };
    });
    assert.equal(rotationIdentity.ok, true, 'SC-033 rotation stopped working after SC-034');
    const rotate = arr => arr.slice(1).concat(arr[0]);
    for (const key of ['names', 'wins', 'totals', 'boardOwners', 'hits']) {
      assert.deepEqual(rotationIdentity.after[key], rotate(rotationIdentity.before[key]), 'Identity alignment failed after rotation for ' + key);
    }

    const menu = await page.evaluate(() => {
      // Restore an eligible live state and inspect the canonical in-game menu row.
      state.currentRound = 5;
      state.currentPlayer = 0;
      state.currentDart = 0;
      state.finished = false;
      delete state.__sqLateCatchupActive;
      if (Array.isArray(state.score)) state.score.forEach(b => { if (b && b[7]) b[7].darts = [null, null, null]; });
      window.__sqOpenGameMenu106();
      const rows = Array.from(document.querySelectorAll('.sq-menu106-row'));
      const add = rows.find(r => /Add Player/i.test(r.textContent || ''));
      const enabled = add ? !add.disabled : false;
      const text = add ? add.textContent : '';
      document.querySelectorAll('.sq-menu106-bd').forEach(n => n.remove());

      state.currentRound = 7;
      state.score[0][7].darts[0] = { kind: 'Miss', points: 0 };
      window.__sqOpenGameMenu106();
      const rows2 = Array.from(document.querySelectorAll('.sq-menu106-row'));
      const add2 = rows2.find(r => /Add Player/i.test(r.textContent || ''));
      const disabled = add2 ? !!add2.disabled : false;
      const text2 = add2 ? add2.textContent : '';
      document.querySelectorAll('.sq-menu106-bd').forEach(n => n.remove());
      return { exists: !!add, enabled, text, existsLate: !!add2, disabled, text2 };
    });
    assert.equal(menu.exists, true, 'Game Menu is missing Add Player');
    assert.equal(menu.enabled, true, 'Add Player should be enabled before 17s');
    assert.match(menu.text, /final thrower/i, 'Enabled Add Player row should explain final thrower behaviour');
    assert.equal(menu.existsLate, true, 'Add Player row should remain visible after cutoff to explain why it is unavailable');
    assert.equal(menu.disabled, true, 'Add Player should be disabled after the first dart at 17s');
    assert.match(menu.text2, /17/i, 'Disabled Add Player row should explain the cutoff');

    const pageErrors = consoleErrs.filter(x => String(x).startsWith('pageerror:'));
    assert.deepEqual(pageErrors, [], 'Unexpected page errors: ' + JSON.stringify(pageErrors));
    console.log('SC-034 live Add Player PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
