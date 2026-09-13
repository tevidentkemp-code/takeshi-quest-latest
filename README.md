# Shateki Quest

Static web app for the Shateki Quest darts game.

## Architecture

SC-031 is migrating the historical single-file runtime to source-first HTML, CSS and JavaScript with generated compatibility outputs. The branch also contains a parity-tested Vite build candidate. Production remains the static GitHub Pages baseline until SC-031 is separately approved for release.

See `docs/architecture/` for the current source-authority and build contracts. Persistent data is owned by the live Shateki-Quest Supabase project; do not create a competing local source of truth.
