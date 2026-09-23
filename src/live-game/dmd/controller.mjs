/*
 * Shateki Quest — SC-030 DMD V2 modular controller.
 *
 * Owned boundary: DMD presentation sequencing only.
 * Does not alter scoring, game rules, mode routing, persistence or Supabase.
 */

export const VERSION = '2.1.0-sc030-modular';
export const ARCHITECTURE = 'sxp05-gate3-scene-contract';

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
      return { priority: PRIORITY.THROW, headline: 'BULLSEYE +50', subline: total, type: 'hold', haptic: 'major' };
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
      return { priority: PRIORITY.VISIT, headline: 'DOUBLES', subline: clean(event.roundLabel || 'ROUND 12', 16), type: 'hold', haptic: 'competitive' };
    case 'ROUND_TREBLES':
      return { priority: PRIORITY.VISIT, headline: 'TREBLES', subline: clean(event.roundLabel || 'ROUND 13', 16), type: 'hold', haptic: 'competitive' };
    case 'ROUND_BULL':
      return { priority: PRIORITY.VISIT, headline: 'BULL', subline: clean(event.roundLabel || 'FINAL ROUND', 16), type: 'hold', haptic: 'major' };
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

const REPLACEMENT_KINDS = new Set([
  'BULLSEYE',
  'LAST_DART_HERO',
  'DESMOND_DELIGHT',
  'VOLDY',
  'ACHIEVEMENT',
  'PERSONAL_BEST',
  'SHATEKI_RECORD',
  'GAME_WON',
  'MATCH_WON'
]);

function familyForPriority(priority) {
  if (priority >= PRIORITY.GAME) return 'GAME';
  if (priority >= PRIORITY.RECORD) return 'RECORD';
  if (priority >= PRIORITY.ACHIEVEMENT) return 'ACHIEVEMENT';
  if (priority >= PRIORITY.COMPETITIVE) return 'COMPETITIVE';
  if (priority >= PRIORITY.VISIT) return 'VISIT';
  if (priority >= PRIORITY.THROW) return 'THROW';
  return 'IDLE';
}

export function makeEventToken(event = {}, msg = makeMessage(event)) {
  const explicit = clean(event.eventToken || event.token || event.sceneToken, 96);
  if (explicit) return explicit;
  const kind = clean(event.kind, 40) || 'EVENT';
  const parts = [
    kind,
    event.gameId,
    event.matchId,
    event.mode || event.gameMode || event.practiceType,
    event.round,
    event.turn,
    event.dart,
    event.historyLength,
    event.player,
    event.target,
    event.points,
    event.visitPoints,
    event.total,
    event.gameScore,
    event.matchScore,
    msg && msg.headline,
    msg && msg.subline
  ].map(value => clean(value, 24));
  return parts.join('|');
}

export function makeSceneDescriptor(event = {}, msg = makeMessage(event)) {
  const kind = clean(event.kind, 40) || 'EVENT';
  const priority = finite(msg && msg.priority, PRIORITY.THROW);
  return Object.freeze({
    architecture: ARCHITECTURE,
    sceneId: clean(event.sceneId || kind, 48),
    kind,
    mode: clean(event.mode || event.gameMode || event.practiceType, 24),
    family: familyForPriority(priority),
    priority,
    token: makeEventToken(event, msg),
    sceneType: REPLACEMENT_KINDS.has(kind) ? 'replacement' : 'dynamic',
    renderType: String((msg && msg.type) || 'hold').trim().slice(0, 24),
    duration: Number.isFinite(Number(msg && msg.duration)) ? Math.max(0, Number(msg.duration)) : undefined,
    headline: clean(msg && msg.headline, 24),
    subline: clean(msg && msg.subline, 24),
    amp: Number.isFinite(Number(event.amp)) ? Number(event.amp) : 3.2,
    playerInput: event.playerInput === true || event.input === true,
    replayable: event.replayable === true,
    payload: Object.freeze({
      player: clean(event.player, 24),
      target: targetLabel(event.target),
      dart: finite(event.dart, 0),
      points: finite(event.points, 0),
      visitPoints: finite(event.visitPoints, 0),
      total: Number.isFinite(Number(event.total)) ? Number(event.total) : null,
      gameScore: Number.isFinite(Number(event.gameScore)) ? Number(event.gameScore) : null,
      matchScore: clean(event.matchScore, 16)
    })
  });
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
  const renderScene = typeof options.renderScene === 'function' ? options.renderScene : null;
  const clearBackend = typeof options.clear === 'function' ? options.clear : () => {};
  const restoreIdle = typeof options.restoreIdle === 'function' ? options.restoreIdle : () => {};
  const baselineProvider = typeof options.baselineProvider === 'function' ? options.baselineProvider : null;
  const haptics = options.haptics || createHaptics({ enabled: false });
  const maxQueue = Math.max(0, Math.min(4, finite(options.maxQueue, 2)));
  const dedupeWindowMs = Math.max(250, finite(options.dedupeWindowMs, 2500));
  const queue = [];
  const recentTokens = new Map();
  let active = null;
  let idleBaseline = null;
  let timer = null;
  let generation = 0;
  let suspended = false;
  let seq = 0;
  let lastDecision = null;

  function durationFor(msg) {
    if (Number.isFinite(Number(msg.duration))) return Math.max(0, Number(msg.duration));
    return DEFAULT_DURATION[msg.priority] || 600;
  }

  function pruneRecentTokens() {
    const cutoff = now() - dedupeWindowMs;
    for (const [token, at] of recentTokens) {
      if (at < cutoff) recentTokens.delete(token);
    }
    while (recentTokens.size > 64) {
      recentTokens.delete(recentTokens.keys().next().value);
    }
  }

  function isDuplicateToken(token) {
    if (!token) return false;
    pruneRecentTokens();
    const at = recentTokens.get(token);
    return Number.isFinite(at) && (now() - at) <= dedupeWindowMs;
  }

  function rememberToken(token) {
    if (!token) return;
    pruneRecentTokens();
    recentTokens.set(token, now());
  }

  function resolveBaseline() {
    if (baselineProvider) {
      try {
        const provided = baselineProvider();
        if (provided) {
          const candidate = Number.isFinite(Number(provided.priority)) && provided.headline != null
            ? { ...provided }
            : makeMessage(provided);
          if (finite(candidate.priority, PRIORITY.IDLE) === PRIORITY.IDLE) idleBaseline = candidate;
        }
      } catch (_) {}
    }
    return idleBaseline;
  }

  function renderMessage(msg, scene) {
    if (!msg || suspended) return;
    const ms = durationFor(msg);
    try {
      if (renderScene) {
        renderScene(Object.freeze({
          ...scene,
          duration: ms,
          renderType: scene.renderType || msg.type || 'hold',
          amp: Number.isFinite(Number(scene.amp)) ? Number(scene.amp) : 3.2
        }));
      } else {
        render(
          { z2: clean(msg.headline, 24), z3: clean(msg.subline, 24) },
          { type: msg.type || 'hold', ms: ms || 2000, amp: Number.isFinite(Number(msg.amp)) ? Number(msg.amp) : 3.2 }
        );
      }
    } catch (_) {}
    if (msg.haptic) haptics.pulse(msg.haptic);
  }

  function cancelTimer() {
    if (timer != null) scheduler.clear(timer);
    timer = null;
  }

  function nextQueued() {
    queue.sort((a, b) => b.msg.priority - a.msg.priority || a.__seq - b.__seq);
    return queue.shift() || null;
  }

  function restore() {
    active = null;
    cancelTimer();
    const next = nextQueued();
    if (next) {
      showNow(next.msg, next.event, next.scene);
      return;
    }
    const baseline = resolveBaseline();
    try { restoreIdle(baseline); } catch (_) {}
    lastDecision = { action: 'restore', token: baseline ? makeEventToken({ kind:'BASELINE' }, baseline) : '' };
  }

  function showNow(msg, event = {}, scene = makeSceneDescriptor(event, msg)) {
    generation += 1;
    const timerGeneration = generation;
    cancelTimer();
    try { clearBackend(); } catch (_) {}
    active = { ...msg, __scene: scene };
    rememberToken(scene.token);
    renderMessage(msg, scene);
    lastDecision = { action: 'show', token: scene.token, family: scene.family, priority: scene.priority };
    const ms = durationFor(msg);
    if (ms > 0) {
      timer = scheduler.set(() => {
        if (timerGeneration !== generation) return;
        restore();
      }, ms);
    }
  }

  function enqueue(msg, event, scene) {
    if (maxQueue === 0 || !scene.replayable) return false;
    queue.push({ msg, event, scene, __seq: ++seq });
    queue.sort((a, b) => b.msg.priority - a.msg.priority || a.__seq - b.__seq);
    while (queue.length > maxQueue) queue.pop();
    lastDecision = { action: 'queue', token: scene.token, family: scene.family, priority: scene.priority };
    return true;
  }

  function cancelPresentation() {
    generation += 1;
    cancelTimer();
    queue.length = 0;
    active = null;
    try { clearBackend(); } catch (_) {}
    haptics.cancel();
  }

  function emit(event = {}) {
    const msg = makeMessage(event);
    msg.priority = finite(msg.priority, PRIORITY.THROW);
    const scene = makeSceneDescriptor(event, msg);

    if (msg.priority === PRIORITY.IDLE) {
      idleBaseline = msg;
      if (!active) renderMessage(msg, scene);
      lastDecision = { action: 'baseline', token: scene.token, family: scene.family, priority: scene.priority };
      return msg;
    }

    if (isDuplicateToken(scene.token)) {
      lastDecision = { action: 'dedupe', token: scene.token, family: scene.family, priority: scene.priority };
      return { ...msg, __deduped: true, __scene: scene };
    }

    if (scene.playerInput && active) {
      cancelPresentation();
      showNow(msg, event, scene);
      lastDecision = { action: 'input-preempt', token: scene.token, family: scene.family, priority: scene.priority };
      return msg;
    }

    if (!active || msg.priority >= active.priority) {
      showNow(msg, event, scene);
      return msg;
    }

    if (scene.replayable && msg.priority >= active.priority) {
      enqueue(msg, event, scene);
      return msg;
    }

    lastDecision = { action: 'suppress-drop', token: scene.token, family: scene.family, priority: scene.priority };
    return { ...msg, __suppressed: true, __scene: scene };
  }

  function hardClear({ restore: shouldRestore = true } = {}) {
    cancelPresentation();
    if (shouldRestore) {
      const baseline = resolveBaseline();
      try { restoreIdle(baseline); } catch (_) {}
    }
  }

  function setSuspended(value) {
    const next = !!value;
    if (next === suspended) return;
    suspended = next;
    if (suspended) {
      cancelPresentation();
      return;
    }
    restore();
  }

  return {
    emit,
    clear: hardClear,
    suspend: setSuspended,
    snapshot() {
      return {
        active: active ? { ...active } : null,
        idle: idleBaseline ? { ...idleBaseline } : null,
        queue: queue.map(item => ({ ...item.msg, __scene: item.scene })),
        suspended,
        version: VERSION,
        architecture: ARCHITECTURE,
        lastDecision: lastDecision ? { ...lastDecision } : null
      };
    },
    priorities: PRIORITY,
    haptics
  };
}

export function detectExistingBackend(host = globalThis) {
  const hasTransientChannel = !!(
    host &&
    typeof host.__sqDmdShowTransientZones === 'function' &&
    typeof host.__sqDmdCancelTransientScenes === 'function'
  );
  return {
    render(zones, opts) {
      if (hasTransientChannel) return host.__sqDmdShowTransientZones(zones, opts);
      if (typeof host.sqDmdShowZones === 'function') return host.sqDmdShowZones(zones, opts);
    },
    clear() {
      if (hasTransientChannel) return host.__sqDmdCancelTransientScenes();
      if (typeof host.__sqDmdHardClearQueue === 'function') return host.__sqDmdHardClearQueue();
      if (typeof host.sqDmdStop === 'function') return host.sqDmdStop();
    },
    restoreIdle() {
      if (hasTransientChannel) return host.__sqDmdCancelTransientScenes();
      if (typeof host.sqDmdSetIdle === 'function') return host.sqDmdSetIdle('');
    },
    transient: hasTransientChannel
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
    dedupeWindowMs: options.dedupeWindowMs ?? 2500,
    baselineProvider: options.baselineProvider
  });
  const unbindVisibility = bindVisibility(controller, doc);
  controller.dispose = () => {
    unbindVisibility();
    controller.clear({ restore: false });
  };
  if (host && typeof host === 'object') host.__sqDmdV2 = controller;
  return controller;
}
