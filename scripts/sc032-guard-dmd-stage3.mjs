import fs from 'node:fs';

const path = 'src/game/engine.js';
let source = fs.readFileSync(path, 'utf8');

function fail(message){
  console.error(`SC-032 Stage-3 guard FAILED: ${message}`);
  process.exit(1);
}

function replaceOnce(body, before, after, label){
  const count = body.split(before).length - 1;
  if (count !== 1) fail(`${label}: expected exactly one anchor, found ${count}`);
  return body.replace(before, after);
}

const startMarker = '// >>> PATCH:SQ_DMD_CLEAR_Z3_ENDTURN';
const endMarker = '// <<< PATCH:SQ_DMD_CLEAR_Z3_ENDTURN';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) fail('Stage-3 marker block not found');

let block = source.slice(start, end);

block = replaceOnce(
  block,
  "// - After 3rd dart, run Stage 3 round-end banner/roll-up, then clear Z3.\n    if (typeof dartIndex === 'number' && dartIndex === 2) {",
  "// - After 3rd dart, run Stage 3 round-end banner/roll-up, then clear Z3.\n    // Skip owns its own controller transient; do not start a competing visit banner.\n    if (typeof dartIndex === 'number' && dartIndex === 2 && !window.__sqSkipInProgress) {",
  'Skip ownership guard'
);

block = replaceOnce(
  block,
  "const baseDelay = 180;  // let last-dart callout land\nsetTimeout(() => {\n  try {",
  "const baseDelay = 180;  // let last-dart callout land\n// Every future Stage-3 frame belongs to this exact completed visit. A new throw\n// hard-clears/increments the renderer flow token; Undo reduces history below the\n// expected completed-visit length. Either condition invalidates every old timer.\nconst __sqDmdStage3Token = Number(window.__sqDmdFlowToken || 0);\nconst __sqDmdStage3ExpectedHistory = (Array.isArray(state?.history) ? state.history.length : 0) + 1;\nconst __sqDmdStage3Current = () => (\n  Number(window.__sqDmdFlowToken || 0) === __sqDmdStage3Token &&\n  Array.isArray(state?.history) &&\n  state.history.length >= __sqDmdStage3ExpectedHistory\n);\nsetTimeout(() => {\n  if (!__sqDmdStage3Current()) return;\n  try {",
  'Stage-3 ownership token'
);

let nestedCount = 0;
block = block.replace(/setTimeout\(\(\)=>\{\n(\s*)try\{/g, (_match, indent) => {
  nestedCount += 1;
  return `setTimeout(()=>{\n${indent}if (!__sqDmdStage3Current()) return;\n${indent}try{`;
});
if (nestedCount !== 6) fail(`nested Stage-3 timers: expected 6 guards, found ${nestedCount}`);

const nextSource = source.slice(0, start) + block + source.slice(end);
if (nextSource === source) fail('patch produced no change');

// Safety invariants: this writer may alter only the marked presentation block.
const beforeOutside = source.slice(0, start) + source.slice(end);
const nextEnd = nextSource.indexOf(endMarker, start);
const afterOutside = nextSource.slice(0, start) + nextSource.slice(nextEnd);
if (beforeOutside !== afterOutside) fail('content outside Stage-3 presentation block changed');

fs.writeFileSync(path, nextSource, 'utf8');
console.log(`SC-032 Stage-3 guard PASS: ${nestedCount} delayed frames now ownership-gated; Skip scheduling suppressed.`);
