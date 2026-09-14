import fs from 'node:fs';
import crypto from 'node:crypto';

const evidencePath = process.argv[2] || 'sc030-transient-evidence.json';
const paths = {
  renderer: 'src/legacy/scripts/inline-007.js',
  controller: 'src/live-game/dmd/controller.mjs',
  bootstrap: 'src/live-game/dmd/bootstrap.mjs',
  patches: 'src/legacy/intentional-patches.json',
  unit: 'tools/ui-smoke/verify-sc030-dmd-v2.mjs',
  runtime: 'tools/ui-smoke/verify-sc030-dmd-runtime.js',
  migration: 'src/legacy/migration-manifest.json',
};
const read = file => fs.readFileSync(file, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const count = (body, needle) => body.split(needle).length - 1;
const original = Object.fromEntries(Object.entries(paths).filter(([key]) => key !== 'migration').map(([key, file]) => [key, read(file)]));
const migration = JSON.parse(read(paths.migration));
const rendererManifest = migration.scripts.find(entry => entry.file === paths.renderer);
if (!rendererManifest) throw new Error('SC-030 renderer missing from migration manifest');
if (sha(original.renderer) !== rendererManifest.sha256) throw new Error('SC-030 renderer has undeclared pre-existing drift');

// 1) Add a presentation-only transient channel to the proven legacy renderer.
// Transient scenes may pre-empt stale presentation, but never mutate persistent
// Z2/Z3 baseline state and never discard queued non-controller scenes.
let renderer = original.renderer;
const apiMarker = '  // expose\n  // @CANONICAL:DMD_PUBLIC_API\n';
if (count(renderer, apiMarker) !== 1) throw new Error('SC-030 renderer API marker mismatch');
const transientBlock = `  // >>> PATCH:SC030_DMD_TRANSIENT_CHANNEL START\n  // Presentation-only channel used by the modular DMD controller.\n  // It deliberately does NOT update __sqDmdLastZ2/__sqDmdLastZ3, so once a\n  // transient scene ends the established renderer returns to its real baseline.\n  function __sqDmdShowTransientZones(z, opts){\n    const o = opts || {};\n    const hasZ2 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z2') || Object.prototype.hasOwnProperty.call(z,'zone2')));\n    const hasZ3 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z3') || Object.prototype.hasOwnProperty.call(z,'zone3')));\n    const scene = {\n      __sqControllerTransient: true,\n      type: o.type || 'hold',\n      dir: o.dir || 'fwd',\n      revealMs: (typeof o.revealMs === 'number' ? o.revealMs : undefined),\n      amp: (typeof o.amp === 'number' ? o.amp : undefined),\n      fx: (typeof o.fx === 'string' ? o.fx : undefined),\n      z3Small: !!o.z3Small,\n      z1: __sqDmdLastZ1,\n      z2: hasZ2 ? String((z.z2 ?? z.zone2) ?? '') : __sqDmdLastZ2,\n      z3: hasZ3 ? String((z.z3 ?? z.zone3) ?? '') : __sqDmdLastZ3,\n      ms: +o.ms || (o.type === 'flash' ? DEFAULTS.flashMs : DEFAULTS.holdMs),\n      start: performance.now()\n    };\n\n    // Remove only older controller transients. Preserve legitimate legacy queue\n    // entries that may have been scheduled by the existing end-of-turn flow.\n    for (let i = q.length - 1; i >= 0; i--) {\n      if (q[i] && q[i].__sqControllerTransient) q.splice(i, 1);\n    }\n    active = scene;\n    start();\n    return true;\n  }\n\n  function __sqDmdCancelTransientScenes(){\n    for (let i = q.length - 1; i >= 0; i--) {\n      if (q[i] && q[i].__sqControllerTransient) q.splice(i, 1);\n    }\n    if (active && active.__sqControllerTransient) nextScene();\n    start();\n    return true;\n  }\n  // <<< PATCH:SC030_DMD_TRANSIENT_CHANNEL END\n\n`;
renderer = renderer.replace(apiMarker, transientBlock + apiMarker);
const exposeAnchor = '  window.sqDmdShowZ3 = (t, o) => showZones({ z3: t }, o);\n';
if (count(renderer, exposeAnchor) !== 1) throw new Error('SC-030 renderer expose anchor mismatch');
renderer = renderer.replace(exposeAnchor, exposeAnchor + "  window.__sqDmdShowTransientZones = __sqDmdShowTransientZones;\n  window.__sqDmdCancelTransientScenes = __sqDmdCancelTransientScenes;\n");
if (count(renderer, 'PATCH:SC030_DMD_TRANSIENT_CHANNEL START') !== 1) throw new Error('SC-030 transient channel insertion failed');

// 2) Controller adapter: prefer the non-destructive transient channel. Fallback
// stays fail-safe for unit portability, while bootstrap below requires the safe API.
let controller = original.controller;
const backendStart = controller.indexOf('export function detectExistingBackend(host = globalThis) {');
const backendEnd = controller.indexOf('export function bindVisibility', backendStart);
if (backendStart < 0 || backendEnd < 0) throw new Error('SC-030 backend adapter boundaries not found');
const backend = `export function detectExistingBackend(host = globalThis) {\n  const hasTransientChannel = !!(\n    host &&\n    typeof host.__sqDmdShowTransientZones === 'function' &&\n    typeof host.__sqDmdCancelTransientScenes === 'function'\n  );\n  return {\n    render(zones, opts) {\n      if (hasTransientChannel) return host.__sqDmdShowTransientZones(zones, opts);\n      if (typeof host.sqDmdShowZones === 'function') return host.sqDmdShowZones(zones, opts);\n    },\n    clear() {\n      if (hasTransientChannel) return host.__sqDmdCancelTransientScenes();\n      if (typeof host.__sqDmdHardClearQueue === 'function') return host.__sqDmdHardClearQueue();\n      if (typeof host.sqDmdStop === 'function') return host.sqDmdStop();\n    },\n    restoreIdle() {\n      if (hasTransientChannel) return host.__sqDmdCancelTransientScenes();\n      if (typeof host.sqDmdSetIdle === 'function') return host.sqDmdSetIdle('');\n    },\n    transient: hasTransientChannel\n  };\n}\n\n`;
controller = controller.slice(0, backendStart) + backend + controller.slice(backendEnd);

// 3) Bootstrap fails closed unless the safe transient renderer contract exists.
let bootstrap = original.bootstrap;
const readyOld = `    typeof host.sqDmdShowZones === 'function' &&\n    (typeof host.__sqDmdHardClearQueue === 'function' || typeof host.sqDmdStop === 'function') &&\n    typeof host.sqDmdSetIdle === 'function'\n`;
if (count(bootstrap, readyOld) !== 1) throw new Error('SC-030 bootstrap readiness anchor mismatch');
bootstrap = bootstrap.replace(readyOld, `    typeof host.sqDmdShowZones === 'function' &&\n    typeof host.__sqDmdShowTransientZones === 'function' &&\n    typeof host.__sqDmdCancelTransientScenes === 'function' &&\n    typeof host.sqDmdSetIdle === 'function'\n`);

// 4) Declare the renderer change through the existing legacy-patch evidence system.
const patchJson = JSON.parse(original.patches);
if (!Array.isArray(patchJson.patches)) throw new Error('SC-030 intentional patch manifest malformed');
if (patchJson.patches.some(entry => entry.file === paths.renderer)) throw new Error('SC-030 renderer patch already declared');
patchJson.patches.push({
  file: paths.renderer,
  originalSha256: rendererManifest.sha256,
  sha256: sha(renderer),
  bytes: Buffer.byteLength(renderer, 'utf8'),
  task: 'SC-030 DMD transient presentation channel',
  reason: 'Allow the modular DMD priority controller to pre-empt presentation without erasing the proven renderer persistent Z2/Z3 baseline or legitimate legacy queue entries.',
  protectedBehaviour: 'No scoring, game rules, player order, mode routing, Supabase, ranking or persistence semantics changed. Existing public DMD APIs remain available.'
});
patchJson.patches.sort((a, b) => a.file.localeCompare(b.file));
const patches = JSON.stringify(patchJson, null, 2) + '\n';

// 5) Pure-module contract proves the adapter chooses the safe channel.
let unit = original.unit;
const unitAnchor = `(function testVisibilityBinding(){`;
if (count(unit, unitAnchor) !== 1) throw new Error('SC-030 unit insertion anchor mismatch');
const backendTest = `(function testTransientBackendAdapter(){\n  const calls = [];\n  const host = {\n    __sqDmdShowTransientZones(z,o){ calls.push(['transient',z,o]); },\n    __sqDmdCancelTransientScenes(){ calls.push(['cancel']); },\n    sqDmdShowZones(){ calls.push(['legacy-render']); },\n    __sqDmdHardClearQueue(){ calls.push(['hard-clear']); },\n    sqDmdSetIdle(){ calls.push(['legacy-idle']); }\n  };\n  const backend = DMD.detectExistingBackend(host);\n  assert.equal(backend.transient, true);\n  backend.render({z2:'SAFE',z3:'BASELINE'}, {type:'hold',ms:100});\n  backend.clear();\n  backend.restoreIdle();\n  assert.deepEqual(calls.map(x=>x[0]), ['transient','cancel','cancel']);\n  console.log('PASS non-destructive transient backend adapter');\n})();\n\n`;
unit = unit.replace(unitAnchor, backendTest + unitAnchor);

// 6) Browser contract verifies safe API availability and baseline restoration by
// comparing settled amber-dot canvas signatures before/after a controller scene.
let runtime = original.runtime;
const bootField = `      hardClear: typeof window.__sqDmdHardClearQueue,\n`;
if (count(runtime, bootField) !== 1) throw new Error('SC-030 runtime boot field anchor mismatch');
runtime = runtime.replace(bootField, bootField + `      transientShow: typeof window.__sqDmdShowTransientZones,\n      transientCancel: typeof window.__sqDmdCancelTransientScenes,\n`);
const bootAssert = `    assert.equal(boot.hardClear, 'function', 'legacy hard-clear API remains available');\n`;
if (count(runtime, bootAssert) !== 1) throw new Error('SC-030 runtime boot assertion anchor mismatch');
runtime = runtime.replace(bootAssert, bootAssert + `    assert.equal(boot.transientShow, 'function', 'safe transient renderer channel is available');\n    assert.equal(boot.transientCancel, 'function', 'safe transient cancellation channel is available');\n`);
const priorityAnchor = `    await page.evaluate(() => {\n      window.__sqDmdV2.emit({ kind: 'HIT_SINGLE', points: 20, total: 20 });\n      window.__sqDmdV2.emit({ kind: 'SHATEKI_RECORD', gameScore: 700 });\n    });\n`;
if (count(runtime, priorityAnchor) !== 1) throw new Error('SC-030 runtime priority anchor mismatch');
const restorationTest = `    // Establish a controlled legacy baseline, then prove a controller transient\n    // returns to the same rendered dot pattern rather than blank/stale V2 copy.\n    const amberSignature = () => page.evaluate(() => {\n      const canvas = document.getElementById('sqDmdCanvas');\n      const ctx = canvas.getContext('2d');\n      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;\n      let amber = 0;\n      for (let i=0; i<data.length; i+=4) {\n        if (data[i] > 175 && data[i+1] > 70 && data[i+1] < 225 && data[i+2] < 135 && data[i+3] > 80) amber++;\n      }\n      return amber;\n    });\n    await page.evaluate(() => {\n      window.__sqDmdHardClearQueue?.();\n      window.sqDmdSetIdle?.('BASELINE');\n      window.sqDmdShowZones?.({ z3:'TRUE STATE' }, { type:'hold', ms:40, z3Small:true });\n    });\n    await page.waitForTimeout(420);\n    const baselineAmber = await amberSignature();\n    assert(baselineAmber > 20, 'controlled legacy DMD baseline renders amber dots');\n    await page.evaluate(() => window.__sqDmdV2.emit({ kind:'UNDO' }));\n    await page.waitForFunction(() => window.__sqDmdV2?.snapshot?.().active?.headline === 'THROW UNDONE');\n    await page.waitForTimeout(900);\n    const restoredAmber = await amberSignature();\n    const delta = Math.abs(restoredAmber - baselineAmber);\n    assert(delta <= Math.max(40, baselineAmber * 0.15), 'controller scene restores the legacy DMD baseline');\n\n`;
runtime = runtime.replace(priorityAnchor, restorationTest + priorityAnchor);

const patched = { renderer, controller, bootstrap, patches, unit, runtime };
for (const [key, body] of Object.entries(patched)) fs.writeFileSync(paths[key], body, 'utf8');
const evidence = {
  schemaVersion: 1,
  purpose: 'non-destructive transient DMD presentation channel for SC-030 controller',
  files: Object.fromEntries(Object.keys(patched).map(key => [key, {
    path: paths[key], oldSha256: sha(original[key]), newSha256: sha(patched[key])
  }])),
  rendererOriginalSha256: rendererManifest.sha256,
  scoringChanged: false,
  rulesChanged: false,
  persistentDataChanged: false,
};
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
console.log('SC-030 transient presentation channel patch prepared successfully');
