/*
 * Shateki Quest — DMD V2 controller (SC-030 build-prep module)
 *
 * This module is intentionally isolated from index.html until the live monolith
 * integration points are patched and regression-tested. It owns DMD event
 * priority/cancellation, concise copy, optional capability-safe vibration, and
 * the visual shell around the existing #sqDmdCanvas renderer.
 *
 * It DOES NOT alter scoring, game rules, mode routing, persistence, Supabase,
 * or Throwpad S/D/T labels.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.SQDmdV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const VERSION = '2.0.0-sc030-preintegration';

  const PRIORITY = Object.freeze({
    IDLE: 0,
    THROW: 10,
    VISIT: 20,
    COMPETITIVE: 30,
    ACHIEVEMENT: 40,
    RECORD: 50,
    GAME: 60
  });

  const DEFAULT_DURATION = Object.freeze({
    [PRIORITY.THROW]: 500,
    [PRIORITY.VISIT]: 700,
    [PRIORITY.COMPETITIVE]: 850,
    [PRIORITY.ACHIEVEMENT]: 950,
    [PRIORITY.RECORD]: 1150,
    [PRIORITY.GAME]: 1400
  });

  const HAPTIC_PATTERNS = Object.freeze({
    tap: 8,
    hit: 10,
    double: [10, 24, 10],
    treble: [10, 20, 10, 20, 12],
    miss: 6,
    visit: 12,
    competitive: [12, 24, 18],
    major: [16, 28, 24]
  });

  function clean(value, max = 24) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, max);
  }

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function signed(value) {
    const n = finite(value, 0);
    return `${n >= 0 ? '+' : ''}${Math.round(n)}`;
  }

  function targetLabel(target) {
    const raw = clean(target, 16);
    if (!raw) return '';
    if (raw === 'D' || raw === 'DOUBLE' || raw === 'DOUBLES') return 'DOUBLES';
    if (raw === 'T' || raw === 'TRIPLE' || raw === 'TRIPLES' || raw === 'TREBLE' || raw === 'TREBLES') return 'TREBLES';
    if (raw === 'B' || raw === 'BULL' || raw === 'BULLS') return 'BULL';
    return raw;
  }

  function makeMessage(event) {
    const e = event || {};
    const kind = clean(e.kind, 40);
    const total = Number.isFinite(Number(e.total)) ? `TOTAL ${Math.round(Number(e.total))}` : '';
    const player = clean(e.player, 14);
    const target = targetLabel(e.target);
    const dart = Math.min(3, Math.max(1, Math.round(finite(e.dart, 1))));
    const score = Math.round(finite(e.points, 0));
    const visit = Math.round(finite(e.visitPoints, 0));
    const margin = Math.round(finite(e.margin, 0));
    const gameScore = Math.round(finite(e.gameScore, finite(e.total, 0)));
    const matchScore = clean(e.matchScore, 12);
    const achievement = clean(e.achievement, 22);

    switch (kind) {
      case 'PLAYER_UP':
        return { priority: PRIORITY.IDLE, headline: player ? `${player} UP` : 'TO THROW', subline: target ? `TARGET ${target}` : '', type: 'hold', duration: 0, haptic: null };
      case 'TARGET':
        return { priority: PRIORITY.IDLE, headline: target ? `TARGET ${target}` : 'TARGET', subline: player ? `${player} UP` : '', type: 'hold', duration: 0, haptic: null };
      case 'HIT_SINGLE':
        return { priority: PRIORITY.THROW, headline: `SINGLE +${score}`, subline: total, type: 'hold', haptic: 'hit' };
      case 'HIT_DOUBLE':
        return { priority: PRIORITY.THROW, headline: `DOUBLE +${score}`, subline: total, type: 'hold', haptic: 'double' };
      case 'HIT_TREBLE':
        return { priority: PRIORITY.THROW, headline: `TREBLE +${score}`, subline: total, type: 'hold', haptic: 'treble' };
      case 'OUTER_BULL':
        return { priority: PRIORITY.THROW, headline: 'OUTER BULL +25', subline: total, type: 'hold', haptic: 'double' };
      case 'BULLSEYE':
        return { priority: PRIORITY.VISIT, headline: 'BULLSEYE +50', subline: total, type: 'hold', haptic: 'major' };
      case 'MISS':
        return { priority: PRIORITY.THROW, headline: 'MISS', subline: `DART ${dart} OF 3`, type: 'hold', haptic: 'miss' };
      case 'SCRATCH':
      case 'MISS_X3':
        return { priority: PRIORITY.VISIT, headline: 'SCRATCH', subline: 'NO SCORE', type: 'hold', haptic: 'miss' };
      case 'VISIT_COMPLETE':
        return { priority: PRIORITY.VISIT, headline: `VISIT +${visit}`, subline: total, type: 'hold', haptic: 'visit' };
      case 'NEW_LEADER':
        return { priority: PRIORITY.COMPETITIVE, headline: 'NEW LEADER', subline: player ? `${player} ${signed(margin)}` : signed(margin), type: 'hold', haptic: 'competitive' };
      case 'LEVEL':
        return { priority: PRIORITY.COMPETITIVE, headline: 'LEVEL', subline: clean(e.scoreLine || e.totalLine || '', 18), type: 'hold', haptic: 'competitive' };
      case 'ROUND_DOUBLES':
        return { priority: PRIORITY.COMPETITIVE, headline: 'DOUBLES', subline: clean(e.roundLabel || 'ROUND 12', 16), type: 'hold', haptic: 'competitive' };
      case 'ROUND_TREBLES':
        return { priority: PRIORITY.COMPETITIVE, headline: 'TREBLES', subline: clean(e.roundLabel || 'ROUND 13', 16), type: 'hold', haptic: 'competitive' };
      case 'ROUND_BULL':
        return { priority: PRIORITY.COMPETITIVE, headline: 'BULL', subline: clean(e.roundLabel || 'FINAL ROUND', 16), type: 'hold', haptic: 'major' };
      case 'UNDO':
        return { priority: PRIORITY.VISIT, headline: 'THROW UNDONE', subline: clean(e.subline || 'SCORE RESTORED', 20), type: 'hold', haptic: 'tap' };
      case 'SKIP':
        return { priority: PRIORITY.VISIT, headline: 'TURN SKIPPED', subline: player ? `${player} UP` : '', type: 'hold', haptic: 'tap' };
      case 'PERSONAL_BEST':
        return { priority: PRIORITY.RECORD, headline: 'PERSONAL BEST!', subline: String(gameScore), type: 'hold', haptic: 'major' };
      case 'SHATEKI_RECORD':
        return { priority: PRIORITY.RECORD, headline: 'NEW SHATEKI RECORD', subline: String(gameScore), type: 'hold', haptic: 'major' };
      case 'ACHIEVEMENT':
        return { priority: PRIORITY.ACHIEVEMENT, headline: 'TROPHY UNLOCKED', subline: achievement, type: 'hold', haptic: 'major' };
      case 'GAME_WON':
        return { priority: PRIORITY.GAME, headline: 'GAME WON', subline: player ? `${player} · ${gameScore}` : String(gameScore), type: 'hold', haptic: 'major' };
      case 'MATCH_WON':
        return { priority: PRIORITY.GAME, headline: 'MATCH WON', subline: player ? `${player}${matchScore ? ` · ${matchScore}` : ''}` : matchScore, type: 'hold', haptic: 'major' };
      case 'LAST_DART_HERO':
        return { priority: PRIORITY.ACHIEVEMENT, headline: 'LAST DART HERO', subline: total, type: 'lastDartImg', duration: 900, haptic: 'major' };
      case 'DESMOND_DELIGHT':
        return { priority: PRIORITY.ACHIEVEMENT, headline: 'DESMOND DELIGHT', subline: total, type: 'desmondImg', duration: 900, haptic: 'major' };
      case 'VOLDY':
        return { priority: PRIORITY.ACHIEVEMENT, headline: clean(e.headline || 'VOLDY', 22), subline: total, type: 'voldyImg', duration: 900, haptic: 'major' };
      default:
        return {
          priority: Number.isFinite(Number(e.priority)) ? Number(e.priority) : PRIORITY.THROW,
          headline: clean(e.headline || kind, 24),
          subline: clean(e.subline || '', 24),
          type: clean(e.type || 'hold', 24).toLowerCase(),
          duration: Number.isFinite(Number(e.duration)) ? Math.max(0, Number(e.duration)) : undefined,
          haptic: e.haptic || null
        };
    }
  }

  function supportsHaptics(nav) {
    return !!(nav && typeof nav.vibrate === 'function');
  }

  function createHaptics(options = {}) {
    const nav = options.navigator || (root && root.navigator);
    let enabled = options.enabled !== false;
    return {
      supported: () => supportsHaptics(nav),
      enabled: () => enabled,
      setEnabled(value) { enabled = !!value; },
      pulse(kind) {
        if (!enabled || !supportsHaptics(nav)) return false;
        const pattern = HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.tap;
        try { return nav.vibrate(pattern) !== false; } catch (_) { return false; }
      },
      cancel() {
        if (!supportsHaptics(nav)) return false;
        try { return nav.vibrate(0) !== false; } catch (_) { return false; }
      }
    };
  }

  function createDefaultScheduler() {
    return {
      set(fn, ms) { return setTimeout(fn, ms); },
      clear(id) { clearTimeout(id); }
    };
  }

  function createController(options = {}) {
    const scheduler = options.scheduler || createDefaultScheduler();
    const render = typeof options.render === 'function' ? options.render : () => {};
    const clearBackend = typeof options.clear === 'function' ? options.clear : () => {};
    const restoreIdle = typeof options.restoreIdle === 'function' ? options.restoreIdle : () => {};
    const haptics = options.haptics || createHaptics({ enabled: false });
    const maxQueue = Math.max(0, Math.min(4, finite(options.maxQueue, 2)));
    const queue = [];
    let active = null;
    let timer = null;
    let generation = 0;
    let suspended = false;

    function durationFor(msg) {
      if (Number.isFinite(Number(msg.duration))) return Math.max(0, Number(msg.duration));
      return DEFAULT_DURATION[msg.priority] || 600;
    }

    function renderMessage(msg) {
      if (!msg) return;
      const ms = durationFor(msg);
      try {
        render(
          { z2: clean(msg.headline, 24), z3: clean(msg.subline, 24) },
          { type: msg.type || 'hold', ms: ms || 2000, amp: Number.isFinite(Number(msg.amp)) ? Number(msg.amp) : 3.2 }
        );
      } catch (_) {}
      if (msg.haptic) haptics.pulse(msg.haptic);
    }

    function cancelTimer() {
      if (timer != null) scheduler.clear(timer);
      timer = null;
    }

    function restore() {
      active = null;
      cancelTimer();
      if (queue.length) {
        queue.sort((a, b) => b.priority - a.priority || a.__seq - b.__seq);
        showNow(queue.shift());
        return;
      }
      try { restoreIdle(); } catch (_) {}
    }

    function showNow(msg) {
      generation += 1;
      const token = generation;
      cancelTimer();
      try { clearBackend(); } catch (_) {}
      active = msg;
      if (!suspended || msg.priority >= PRIORITY.RECORD) renderMessage(msg);
      const ms = durationFor(msg);
      if (ms > 0) {
        timer = scheduler.set(() => {
          if (token !== generation) return;
          restore();
        }, ms);
      }
    }

    let seq = 0;
    function enqueue(msg) {
      msg.__seq = ++seq;
      if (maxQueue === 0) return;
      queue.push(msg);
      queue.sort((a, b) => b.priority - a.priority || a.__seq - b.__seq);
      while (queue.length > maxQueue) queue.pop();
    }

    function emit(event) {
      const msg = makeMessage(event);
      msg.priority = finite(msg.priority, PRIORITY.THROW);
      if (msg.priority === PRIORITY.IDLE && !active) {
        active = msg;
        renderMessage(msg);
        return msg;
      }
      if (!active || msg.priority >= active.priority) {
        showNow(msg);
      } else {
        enqueue(msg);
      }
      return msg;
    }

    function hardClear({ restore = true } = {}) {
      generation += 1;
      cancelTimer();
      queue.length = 0;
      active = null;
      try { clearBackend(); } catch (_) {}
      haptics.cancel();
      if (restore) {
        try { restoreIdle(); } catch (_) {}
      }
    }

    function setSuspended(value) {
      suspended = !!value;
      if (suspended) haptics.cancel();
    }

    return {
      emit,
      clear: hardClear,
      suspend: setSuspended,
      snapshot() {
        return {
          active: active ? { ...active } : null,
          queue: queue.map(item => ({ ...item })),
          suspended,
          version: VERSION
        };
      },
      priorities: PRIORITY,
      haptics
    };
  }

  function visualCss() {
    return `
#v2InfoDmd{
  position:relative;
  isolation:isolate;
  overflow:hidden;
  background:#080604;
  border-color:rgba(255,176,0,.34)!important;
  box-shadow:inset 0 0 0 1px rgba(255,176,0,.08), inset 0 12px 30px rgba(0,0,0,.72), 0 0 16px rgba(255,142,0,.06);
}
#v2InfoDmd::after{
  content:"";
  position:absolute;
  inset:0;
  z-index:5;
  pointer-events:none;
  background:repeating-linear-gradient(to bottom, rgba(255,255,255,.018) 0 1px, transparent 1px 4px), linear-gradient(115deg, rgba(255,255,255,.035), transparent 24%, transparent 76%, rgba(255,176,0,.018));
  mix-blend-mode:screen;
  opacity:.78;
}
#sqDmdCanvas{
  position:relative;
  z-index:2;
  image-rendering:pixelated;
  filter:saturate(1.06) contrast(1.03) drop-shadow(0 0 4px rgba(255,145,0,.16));
}
@media (prefers-reduced-motion: reduce){
  #sqDmdCanvas{filter:saturate(1.02) contrast(1.02);}
}
`;
  }

  function installVisualShell(doc) {
    const d = doc || (root && root.document);
    if (!d || typeof d.createElement !== 'function') return false;
    if (d.getElementById('sq-dmd-v2-shell-css')) return true;
    const style = d.createElement('style');
    style.id = 'sq-dmd-v2-shell-css';
    style.textContent = visualCss();
    (d.head || d.documentElement).appendChild(style);
    return true;
  }

  function detectExistingBackend(host) {
    const w = host || root || {};
    return {
      render(zones, opts) {
        if (typeof w.sqDmdShowZones === 'function') return w.sqDmdShowZones(zones, opts);
      },
      clear() {
        if (typeof w.__sqDmdHardClearQueue === 'function') return w.__sqDmdHardClearQueue();
        if (typeof w.sqDmdStop === 'function') return w.sqDmdStop();
      },
      restoreIdle() {
        if (typeof w.sqDmdSetIdle === 'function') return w.sqDmdSetIdle();
      }
    };
  }

  function install(options = {}) {
    const host = options.host || root || {};
    const backend = options.backend || detectExistingBackend(host);
    const haptics = options.haptics || createHaptics({
      navigator: options.navigator || host.navigator,
      enabled: options.hapticsEnabled === true
    });
    const controller = createController({ ...backend, haptics, maxQueue: options.maxQueue || 2 });
    if (options.visualShell !== false) installVisualShell(options.document || host.document);
    if (host && typeof host.addEventListener === 'function') {
      host.addEventListener('visibilitychange', () => controller.suspend(!!(host.document && host.document.hidden)));
    }
    host.__sqDmdV2 = controller;
    return controller;
  }

  return Object.freeze({
    VERSION,
    PRIORITY,
    HAPTIC_PATTERNS,
    makeMessage,
    supportsHaptics,
    createHaptics,
    createController,
    detectExistingBackend,
    installVisualShell,
    visualCss,
    install
  });
});
