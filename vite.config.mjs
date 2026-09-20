import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const root = process.cwd();

function copyTreeIfPresent(sourceRel, targetRel) {
  const source = path.join(root, sourceRel);
  if (!fs.existsSync(source)) return;
  const target = path.join(root, targetRel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function shatekiCompatibilityRuntime() {
  return {
    name: 'shateki-compatibility-runtime',
    apply: 'build',
    closeBundle() {
      // Classic runtime scripts are deliberately still loaded by path while SC-031
      // completes compatibility migration. Keep those paths available in dist.
      copyTreeIfPresent('src/legacy', 'dist/src/legacy');
      copyTreeIfPresent('src/styles', 'dist/src/styles');
      copyTreeIfPresent('src/features', 'dist/src/features');
      copyTreeIfPresent('assets', 'dist/assets');
      fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '', 'utf8');
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [shatekiCompatibilityRuntime()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    cssMinify: false,
    assetsInlineLimit: 0,
  },
});
