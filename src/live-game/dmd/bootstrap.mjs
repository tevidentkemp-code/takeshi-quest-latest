import '../postgame-flow.mjs';
import '../postgame-hotfix.mjs';
import '../xp-breakdown.mjs';
import '../postgame-release-guard.mjs';
import '../bull-colours.mjs';
import { detectExistingBackend, install } from './controller.mjs';
import { createMotionSafeBackend } from './motion.mjs';

const MAX_ATTEMPTS = 120;
const RETRY_MS = 50;
let attempts = 0;
let timer = null;

function backendReady(host) {
  return !!(
    host &&
    typeof host.sqDmdShowZones === 'function' &&
    typeof host.__sqDmdShowTransientZones === 'function' &&
    typeof host.__sqDmdCancelTransientScenes === 'function' &&
    typeof host.sqDmdSetIdle === 'function'
  );
}

/*
 * SC-032 compatibility gate.
 *
 * Production still has one legacy Stage-3 visit sequence inside recordThrow():
 * ROUND SCORE -> NEXT UP / round-complete -> pre-throw. Those callbacks are
 * presentation-only but they are ordinary setTimeout callbacks, so before this
 * guard they could outlive the visit that created them and repaint stale DMD
 * text after Skip, Undo or a fast next-player throw.
 *
 * Keep scoring/game state completely untouched. We wrap recordThrow only long
 * enough to recognise the one Stage-3 timer by its stable presentation markers,
 * then recursively guard that timer family with a presentation generation.
 * Any later throw, legacy hard-clear, Undo or Skip invalidates the generation.
 */
function callbackSource(fn) {
  try { return Function.prototype.toString.call(fn); } catch (_) { return ''; }
}

function isLegacyStage3Timer(fn) {
  const source = callbackSource(fn);
  return source.includes('ROUND SCORE') && source.includes('NEXT UP');
}

function invalidateVisitFlow(host) {
  const next = Number(host.__sqDmdVisitFlowGeneration || 0) + 1;
  host.__sqDmdVisitFlowGeneration = next;
  return next;
}

function visitFlowIsCurrent(host, token) {
  return Number(host.__sqDmdVisitFlowGeneration || 0) === Number(token);
}

function installLegacyStage3TimerGate(host) {
  if (!host || host.__sqDmdStage3TimerGateInstalled) return true;
  if (typeof host.recordThrow !== 'function' || typeof host.setTimeout !== 'function') return false;

  const originalRecordThrow = host.recordThrow;
  const nativeSetTimeout = host.setTimeout.bind(host);

  const runInStage3Scope = (token, callback, callbackArgs) => {
    if (!visitFlowIsCurrent(host, token)) return undefined;

    const priorSetTimeout = host.setTimeout;
    host.setTimeout = function guardedNestedStage3Timeout(nextCallback, delay, ...nextArgs) {
      if (typeof nextCallback !== 'function') return nativeSetTimeout(nextCallback, delay, ...nextArgs);
      return nativeSetTimeout(function runGuardedNestedStage3(...runtimeArgs) {
        if (!visitFlowIsCurrent(host, token)) return undefined;
        return runInStage3Scope(token, nextCallback, runtimeArgs);
      }, delay, ...nextArgs);
    };

    try {
      return callback(...callbackArgs);
    } finally {
      host.setTimeout = priorSetTimeout;
    }
  };

  host.recordThrow = function sc032RecordThrowWithDmdFlowGuard(...args) {
    const token = invalidateVisitFlow(host);
    const priorSetTimeout = host.setTimeout;

    host.setTimeout = function captureLegacyStage3Timeout(callback, delay, ...timerArgs) {
      if (typeof callback !== 'function' || !isLegacyStage3Timer(callback)) {
        return nativeSetTimeout(callback, delay, ...timerArgs);
      }
      return nativeSetTimeout(function runGuardedStage3(...runtimeArgs) {
        if (!visitFlowIsCurrent(host, token)) return undefined;
        return runInStage3Scope(token, callback, runtimeArgs);
      }, delay, ...timerArgs);
    };

    try {
      return originalRecordThrow.apply(this, args);
    } finally {
      host.setTimeout = priorSetTimeout;
    }
  };

  // Preserve explicit legacy cancellation as a cancellation boundary for any
  // already-scheduled Stage-3 family (including specialised Vs Shadow paths).
  if (typeof host.__sqDmdHardClearQueue === 'function') {
    const originalHardClear = host.__sqDmdHardClearQueue;
    host.__sqDmdHardClearQueue = function sc032HardClearWithVisitInvalidation(...args) {
      invalidateVisitFlow(host);
      return originalHardClear.apply(this, args);
    };
  }

  host.__sqDmdStage3TimerGateInstalled = true;
  return true;
}

function bindControllerVisitInvalidation(controller, host) {
  if (!controller || controller.__sqStage3InvalidationBound) return controller;

  const originalEmit = controller.emit.bind(controller);
  controller.emit = function sc032EmitWithVisitInvalidation(event = {}) {
    const kind = String(event && event.kind || '').trim().toUpperCase();
    if (kind === 'UNDO' || kind === 'SKIP') invalidateVisitFlow(host);
    return originalEmit(event);
  };

  const originalClear = controller.clear.bind(controller);
  controller.clear = function sc032ClearWithVisitInvalidation(options) {
    invalidateVisitFlow(host);
    return originalClear(options);
  };

  controller.__sqStage3InvalidationBound = true;
  return controller;
}

function boot() {
  if (window.__sqDmdV2) return true;

  if (!backendReady(window)) {
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      console.warn('[SC-030] DMD V2 bootstrap skipped: existing DMD backend was not ready.');
      return false;
    }
    timer = window.setTimeout(boot, RETRY_MS);
    return false;
  }

  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }

  // Install the compatibility timer boundary before the controller so all
  // subsequent Live V2 input uses the guarded recordThrow reference.
  installLegacyStage3TimerGate(window);

  const backend = createMotionSafeBackend(detectExistingBackend(window), window);
  window.__sqDmdV2 = bindControllerVisitInvalidation(install({
    host: window,
    document,
    backend,
    maxQueue: 2,
    hapticsEnabled: false,
  }), window);
  window.__sqDmdV2Ready = true;
  return true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export {
  backendReady,
  bindControllerVisitInvalidation,
  boot,
  installLegacyStage3TimerGate,
  invalidateVisitFlow,
  isLegacyStage3Timer,
  visitFlowIsCurrent,
};
