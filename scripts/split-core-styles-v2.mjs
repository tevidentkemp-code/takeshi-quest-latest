console.error(`SC-031 runtime-first CSS splitting is retired.

The semantic CSS files under src/styles/** are now the intended source authority.
Use:
  node scripts/build-core-styles-from-source.mjs

to generate the compatibility stylesheet from source.

Historical runtime-first split evidence remains in Git history and in:
  src/styles/core-source-manifest.json

This retired command fails closed so the legacy compatibility runtime cannot silently overwrite source-owned CSS.`);
process.exit(1);
