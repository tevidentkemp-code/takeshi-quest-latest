/*
 * Shateki Quest — SC-030 DMD V2 modular controller.
 *
 * Owned boundary: DMD presentation sequencing only.
 * Does not alter scoring, game rules, mode routing, persistence or Supabase.
 */

export const VERSION = '2.1.0-sc030-modular';

export const PRIORITY = Object.freeze({
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

export const HAPTIC_PATTERNS = Object.freeze({
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

export function makeMessage(event = {}) {
  const kind = clean(event.kind, 40);
  const total = Number.isFinite(Number(event.total)) ? `TOTAL ${Math.round(Number(event.total))}` : '';
  const player = clean(event.player, 14);
  const target = targetLabel(event.target);
  const dart = Math.min(3, Math.max(1, Math.round(finite(event.dart, 1))));
  const score = Math.round(finite(event.points, 0));
  const visit = Math.round(finite(event.visitPoints, 0));
  const margin = Math.round(finite(event.margin, 0));
  const gameScore = Math.round(finite(event.gameScore, finite(event.total, 0)));
  const matchScore = clean(event.matchScore, 12);
  const achievement = clean(event.achievement, 22);

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
      return { priority: PRIORITY.COMPETITIVE, headline: 'LEVEL', subline: clean(event.scoreLine || event.totalLine || '', 18), type: 'hold', haptic: 'competitive' };
    case 'ROUND_DOUBLES':
      return { priority: PRIORITY.COMPETITIVE, headline: 'DOUBLES', subline: clean(event.roundLabel || 'ROUND 12', 16), type: 'hold', haptic: 'competitive' };
    case 'ROUND_TREBLES':
      return { priority: PRIORITY.COMPETITIVE, headline: 'TREBLES', subline: clean(event.roundLabel || 'ROUND 13', 16), type: 'hold', haptic: 'competitive' };
    case 'ROUND_BULL':
      return { priority: PRIORITY.COMPETITIVE, headline: 'BULL', subline: clean(event.roundLabel || 'FINAL ROUND', 16), type: 'hold', haptic: 'major' };
    case 'UNDO':
      return { priority: PRIORITY.VISIT, headline: 'THROW UNDONE', subline: clean(event.subline || 'SCORE RESTORED', 20), type: 'hold', haptic: 'tap' };
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
      return { priority: PRIORITY.ACHIEVEMENT, headline: clean(event.headline || 'VOLDY', 22), subline: total, type: 'voldyImg', duration: 900, haptic: 'major' };
    default:
      return {
        priority: Number.isFinite(Number(event.priority)) ? Number(event.priority) : PRIORITY.THROW,
        headline: clean(event.headline || kind, 24),
        subline: clean(event.subline || '', 24),
        type: clean(event.type || 'hold', 24).toLowerCase(),
        duration: Number.isFinite(Number(event.duration)) ? Math.max(0, Number(event.duration)) : undefined,
        haptic: event.haptic || null
      };
  }
}

export function supportsHaptics(nav) {
  return !!(nav && typeof nav.vibrate === 'function');
}

export function createHaptics(options = {}) {
  const nav = options.navigator || globalThis.navigator;
  let enabled = options.enabled === true;
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

function defaultScheduler() {
  return {
    set(fn, ms) { return setTimeout(fn, ms); },
    clear(id) { clearTimeout(id); }
  };
}

export function createController(options = {}) {
  const scheduler = options.scheduler || defaultScheduler();
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const render = typeof options.render === 'function' ? options.render : () => {};
  const clearBackend = typeof options.clear === 'function' ? options.clear : () => {};
  const restoreIdle = typeof options.restoreIdle === 'function' ? options.restoreIdle : () => {};
  const haptics = options.haptics || createHaptics({ enabled: false });
  const maxQueue = Math.max(0, Math.min(4, finite(options.maxQueue, 2)));
  const staleLowPriorityMs = Math.max(250, finite(options.staleLowPriorityMs, 900));
  const queue = [];
  let active = null;
  let idleBaseline = null;
  let timer = null;
  let generation = 0;
  let suspended = false;
  let seq = 0;

  function durationFor(msg) {
    if (Number.isFinite(Number(msg.duration))) return Math.max(0, Number(msg.duration));
    return DEFAULT_DURATION[msg.priority] || 600;
  }

  function renderMessage(msg) {
    if (!msg || suspended) return;
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

  function isStale(msg) {
    if (!msg || msg.priority > PRIORITY.VISIT || !Number.isFinite(msg.__queuedAt)) return false;
    return (now() - msg.__queuedAt) > staleLowPriorityMs;
  }

  function nextQueued() {
    queue.sort((a, b) => b.priority - a.priority || a.__seq - b.__seq);
    while (queue.length) {
      const candidate = queue.shift();
      if (!isStale(candidate)) return candidate;
    }
    return null;
  }

  function restore() {
    active = null;
    cancelTimer();
    const next = nextQueued();
    if (next) {
      showNow(next);
      return;
    }
    try { restoreIdle(idleBaseline); } catch (_) {}
  }

  function showNow(msg) {
    generation += 1;
    const token = generation;
    cancelTimer();
    try { clearBackend(); } catch (_) {}
    active = msg;
    renderMessage(msg);
    const ms = durationFor(msg);
    if (ms > 0) {
      timer = scheduler.set(() => {
        if (token !== generation) return;
        restore();
      }, ms);
    }
  }

  function enqueue(msg) {
    if (maxQueue === 0) return;
    msg.__seq = ++seq;
    msg.__queuedAt = now();
    queue.push(msg);
    queue.sort((a, b) => b.priority - a.priority || a.__seq - b.__seq);
    while (queue.length > maxQueue) queue.pop();
  }

  function emit(event) {
    const msg = makeMessage(event);
    msg.priority = finite(msg.priority, PRIORITY.THROW);
    if (msg.priority === PRIORITY.IDLE) {
      idleBaseline = msg;
      if (!active) renderMessage(msg);
      return msg;
    }
    if (!active || msg.priority >= active.priority) showNow(msg);
    else enqueue(msg);
    return msg;
  }

  function hardClear({ restore: shouldRestore = true } = {}) {
    generation += 1;
    cancelTimer();
    queue.length = 0;
    active = null;
    try { clearBackend(); } catch (_) {}
    haptics.cancel();
    if (shouldRestore) {
      try { restoreIdle(idleBaseline); } catch (_) {}
    }
  }

  function setSuspended(value) {
    const next = !!value;
    if (next === suspended) return;
    suspended = next;
    if (suspended) {
      generation += 1;
      cancelTimer();
      queue.splice(0, queue.length, ...queue.filter(item => item.priority > PRIORITY.VISIT));
      if (active && active.priority <= PRIORITY.VISIT) active = null;
      haptics.cancel();
      try { clearBackend(); } catch (_) {}
      return;
    }
    if (active && !isStale(active)) showNow(active);
    else restore();
  }

  return {
    emit,
    clear: hardClear,
    suspend: setSuspended,
    snapshot() {
      return {
        active: active ? { ...active } : null,
        idle: idleBaseline ? { ...idleBaseline } : null,
        queue: queue.map(item => ({ ...item })),
        suspended,
        version: VERSION
      };
    },
    priorities: PRIORITY,
    haptics
  };
}

export function detectExistingBackend(host = globalThis) {
  return {
    render(zones, opts) {
      if (typeof host.sqDmdShowZones === 'function') return host.sqDmdShowZones(zones, opts);
    },
    clear() {
      if (typeof host.__sqDmdHardClearQueue === 'function') return host.__sqDmdHardClearQueue();
      if (typeof host.sqDmdStop === 'function') return host.sqDmdStop();
    },
    restoreIdle() {
      if (typeof host.sqDmdSetIdle === 'function') return host.sqDmdSetIdle(host.__sqDmdIdleText || '');
    }
  };
}

export function bindVisibility(controller, doc = globalThis.document) {
  if (!controller || !doc || typeof doc.addEventListener !== 'function') return () => {};
  const onVisibility = () => controller.suspend(!!doc.hidden);
  doc.addEventListener('visibilitychange', onVisibility, { passive: true });
  onVisibility();
  return () => {
    try { doc.removeEventListener('visibilitychange', onVisibility); } catch (_) {}
  };
}

export function install(options = {}) {
  const host = options.host || globalThis;
  const doc = options.document || host.document || globalThis.document;
  const backend = options.backend || detectExistingBackend(host);
  const haptics = options.haptics || createHaptics({
    navigator: options.navigator || host.navigator,
    enabled: options.hapticsEnabled === true
  });
  const controller = createController({
    ...backend,
    haptics,
    maxQueue: options.maxQueue ?? 2,
    staleLowPriorityMs: options.staleLowPriorityMs ?? 900
  });
  const unbindVisibility = bindVisibility(controller, doc);
  controller.dispose = () => {
    unbindVisibility();
    controller.clear({ restore: false });
  };
  if (host && typeof host === 'object') host.__sqDmdV2 = controller;
  return controller;
}
