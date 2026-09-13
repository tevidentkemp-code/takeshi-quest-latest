import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temp = {
  html: '.sc031-build-index.html',
  css: '.sc031-build-core.css',
  js: '.sc031-build-core.js',
};

function fail(message, result = null) {
  console.error(`SC-031 runtime materialization FAIL: ${message}`);
  if (result?.stdout) process.stderr.write(result.stdout);
  if (result?.stderr) process.stderr.write(result.stderr);
  process.exit(1);
}

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) fail(`${script} exited ${result.status}`, result);
  return result;
}

function copy(from, to) {
  const source = path.join(root, from);
  const target = path.join(root, to);
  if (!fs.existsSync(source)) fail(`generated file missing: ${from}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

try {
  run('scripts/render-index-from-source.mjs', ['--output', temp.html, '--evidence', '.sc031-build-html-evidence.json']);
  copy(temp.html, 'index.html');

  run('scripts/build-core-styles-from-source.mjs', ['--output', temp.css, '--evidence', '.sc031-build-css-evidence.json']);
  copy(temp.css, 'src/legacy/styles/inline-002.css');

  run('scripts/build-core-js-from-source.mjs', ['--output', temp.js, '--evidence', '.sc031-build-js-evidence.json']);
  copy(temp.js, 'src/legacy/scripts/inline-005.js');

  run('scripts/verify-core-styles-v2.mjs');
  run('scripts/verify-core-domains.mjs');
  run('scripts/verify-modularization.mjs');

  console.log('SC-031 runtime materialization PASS: HTML, core CSS and core JS rebuilt from source authority.');
} finally {
  for (const file of Object.values(temp)) fs.rmSync(path.join(root, file), { force: true });
}
