import fs from 'node:fs';
import crypto from 'node:crypto';

const evidencePath = process.argv[2] || 'sc030-dmd-style-evidence.json';
const files = {
  controller: 'src/live-game/dmd/controller.mjs',
  bootstrap: 'src/live-game/dmd/bootstrap.mjs',
  css: 'src/styles/live-game/topbar.css',
  unit: 'tools/ui-smoke/verify-sc030-dmd-v2.mjs',
  runtime: 'tools/ui-smoke/verify-sc030-dmd-runtime.js',
};
const original = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

// 1. Controller: remove temporary injected visual ownership. Sequencing stays JS;
// semantic Live Game CSS becomes the only DMD skin owner.
let controller = original.controller;
const visualStart = controller.indexOf('export function visualCss() {');
const visualEnd = controller.indexOf('export function detectExistingBackend', visualStart);
if (visualStart < 0 || visualEnd < 0 || visualEnd <= visualStart) throw new Error('SC-030 visual helper boundaries not found exactly');
controller = controller.slice(0, visualStart) + controller.slice(visualEnd);
const installLine = "  if (options.visualShell !== false) installVisualShell(doc);\n";
if (controller.split(installLine).length - 1 !== 1) throw new Error('SC-030 controller visual-shell install line count mismatch');
controller = controller.replace(installLine, '');
if (/visualCss|installVisualShell|sq-dmd-v2-shell-css/.test(controller)) throw new Error('SC-030 controller still owns DMD CSS after staticisation');

// 2. Bootstrap: remove the temporary visualShell option entirely.
let bootstrap = original.bootstrap;
const visualOption = '    visualShell: true,\n';
if (bootstrap.split(visualOption).length - 1 !== 1) throw new Error('SC-030 bootstrap visualShell option count mismatch');
bootstrap = bootstrap.replace(visualOption, '');
if (bootstrap.includes('visualShell')) throw new Error('SC-030 bootstrap still requests injected CSS');

// 3. Semantic CSS: append restrained cabinet treatment without changing layout height.
const startMarker = '/* >>> SC-030 DMD V2 CABINET TREATMENT START */';
const endMarker = '/* <<< SC-030 DMD V2 CABINET TREATMENT END */';
if (original.css.includes(startMarker) || original.css.includes(endMarker)) throw new Error('SC-030 DMD cabinet treatment already present');
const cssBlock = `\n\n${startMarker}\n/* Presentation only: preserve the canonical 74px portrait / 88px landscape DMD footprint. */\nbody[data-page="game"] #sqDmdWrap{\n  isolation:isolate;\n  background:\n    radial-gradient(120% 150% at 50% -35%, rgba(255,176,54,.065), transparent 52%),\n    linear-gradient(180deg, #080604 0%, #050403 100%);\n  border-color:rgba(255,153,24,.30);\n  box-shadow:\n    inset 0 1px 0 rgba(255,210,128,.07),\n    inset 0 -12px 28px rgba(0,0,0,.48),\n    0 0 0 1px rgba(255,122,0,.10),\n    0 9px 24px rgba(0,0,0,.46),\n    0 0 14px rgba(255,133,16,.055);\n}\nbody[data-page="game"] #sqDmdWrap::before{\n  content:"";\n  position:absolute;\n  inset:0;\n  pointer-events:none;\n  z-index:1;\n  opacity:.14;\n  background-image:radial-gradient(circle, rgba(255,154,35,.24) 0 .55px, transparent .7px);\n  background-size:4px 4px;\n}\nbody[data-page="game"] #sqDmdCanvas{\n  position:relative;\n  z-index:2;\n  filter:saturate(1.05) contrast(1.04) drop-shadow(0 0 3px rgba(255,143,28,.13));\n}\nbody[data-page="game"] #sqDmdWrap .sq-dmd-overlay{\n  z-index:3;\n  opacity:.12;\n  background:\n    linear-gradient(to bottom, rgba(255,226,184,.055), transparent 22%),\n    repeating-linear-gradient(to bottom, rgba(255,255,255,.024) 0 1px, transparent 1px 4px);\n}\n@media (prefers-reduced-motion: reduce){\n  body[data-page="game"] #sqDmdCanvas{ filter:saturate(1.02) contrast(1.02); }\n}\n${endMarker}\n`;
if (/mix-blend-mode/i.test(cssBlock)) throw new Error('SC-030 cabinet treatment must not reintroduce blend-mode flashing risk');
if (/\bheight\s*:/.test(cssBlock)) throw new Error('SC-030 cabinet treatment must not change DMD height');
const css = original.css.replace(/\s*$/, '') + cssBlock;

// 4. Unit contract: move visual ownership assertions to semantic CSS.
let unit = original.unit;
const importAnchor = "import assert from 'node:assert/strict';\nimport * as DMD from '../../src/live-game/dmd/controller.mjs';";
if (unit.split(importAnchor).length - 1 !== 1) throw new Error('SC-030 unit import anchor mismatch');
unit = unit.replace(importAnchor, "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport * as DMD from '../../src/live-game/dmd/controller.mjs';");
const unitStart = unit.indexOf('(function testVisualShellContract(){');
const unitEnd = unit.indexOf("console.log('SC-030 DMD V2 MODULAR CONTROLLER: ALL PASS');", unitStart);
if (unitStart < 0 || unitEnd < 0) throw new Error('SC-030 visual unit contract boundaries not found');
const staticTest = `(function testVisualOwnershipContract(){\n  assert.equal(typeof DMD.visualCss, 'undefined', 'controller must not own CSS');\n  assert.equal(typeof DMD.installVisualShell, 'undefined', 'controller must not inject style tags');\n  const css = fs.readFileSync('src/styles/live-game/topbar.css', 'utf8');\n  const start = css.indexOf('${startMarker}');\n  const end = css.indexOf('${endMarker}');\n  assert(start >= 0 && end > start, 'semantic DMD cabinet block exists');\n  const block = css.slice(start, end);\n  assert(block.includes('#sqDmdWrap'));\n  assert(block.includes('#sqDmdCanvas'));\n  assert(block.includes('prefers-reduced-motion'));\n  assert(block.includes('radial-gradient'));\n  assert(!/\\bheight\\s*:/.test(block), 'DMD skin does not alter the fixed footprint');\n  assert(!/mix-blend-mode|rainbow|hsl\\(/i.test(block), 'DMD skin avoids flashing-prone/nightclub effects');\n  console.log('PASS semantic DMD visual ownership contract');\n})();\n\n`;
unit = unit.slice(0, unitStart) + staticTest + unit.slice(unitEnd);

// 5. Browser contract: assert no injected style tag and prove semantic CSS layers through the active Classic theme.
let runtime = original.runtime;
const styleField = "      styleInstalled: !!document.getElementById('sq-dmd-v2-shell-css'),\n";
if (runtime.split(styleField).length - 1 !== 1) throw new Error('SC-030 runtime style field anchor mismatch');
runtime = runtime.replace(styleField, "      injectedStyle: !!document.getElementById('sq-dmd-v2-shell-css'),\n");
const styleAssert = "    assert.equal(boot.styleInstalled, true, 'visual shell is installed');\n";
if (runtime.split(styleAssert).length - 1 !== 1) throw new Error('SC-030 runtime style assertion anchor mismatch');
runtime = runtime.replace(styleAssert, "    assert.equal(boot.injectedStyle, false, 'DMD appearance is owned by semantic CSS, not an injected style tag');\n");
const beforeReturn = "        canvas: { width: canvas.width, height: canvas.height },\n        wrap: { width: wrap.width, height: wrap.height },\n        pad: { top: pad.top, bottom: pad.bottom, width: pad.width },\n";
if (runtime.split(beforeReturn).length - 1 !== 1) throw new Error('SC-030 runtime geometry anchor mismatch');
runtime = runtime.replace(beforeReturn, "        canvas: { width: canvas.width, height: canvas.height },\n        wrap: { width: wrap.width, height: wrap.height },\n        pad: { top: pad.top, bottom: pad.bottom, width: pad.width },\n        skin: {\n          backgroundImage: getComputedStyle(document.getElementById('sqDmdWrap')).backgroundImage,\n          dotBackgroundImage: getComputedStyle(document.getElementById('sqDmdWrap'), '::before').backgroundImage,\n          boxShadow: getComputedStyle(document.getElementById('sqDmdWrap')).boxShadow,\n          canvasFilter: getComputedStyle(document.getElementById('sqDmdCanvas')).filter,\n        },\n");
const padAssert = "    assert(before.pad.width > 250, 'Throwpad remains usable');\n";
if (runtime.split(padAssert).length - 1 !== 1) throw new Error('SC-030 runtime skin assertion anchor mismatch');
runtime = runtime.replace(padAssert, "    assert(before.pad.width > 250, 'Throwpad remains usable');\n    assert.notEqual(before.skin.backgroundImage, 'none', 'active mode theme retains a cabinet background');\n    assert.match(before.skin.dotBackgroundImage, /radial-gradient/i, 'semantic dot-matrix surface treatment layers through Classic');\n    assert.notEqual(before.skin.boxShadow, 'none', 'semantic cabinet depth is active');\n    assert.notEqual(before.skin.canvasFilter, 'none', 'controlled amber canvas treatment is active');\n");

const patched = { controller, bootstrap, css, unit, runtime };
for (const [key, text] of Object.entries(patched)) fs.writeFileSync(files[key], text, 'utf8');

const evidence = {
  schemaVersion: 1,
  purpose: 'move SC-030 DMD appearance from JS injection to semantic Live Game CSS',
  files: Object.fromEntries(Object.keys(files).map(key => [key, {
    path: files[key],
    oldSha256: sha(original[key]),
    newSha256: sha(patched[key]),
  }])),
  layoutHeightChanged: false,
  scoringChanged: false,
  rendererChanged: false,
  blendModePresent: false,
};
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
console.log('SC-030 DMD visual ownership staticised successfully');
