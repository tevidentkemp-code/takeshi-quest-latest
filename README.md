# Shateki Quest

Production application repository for Shateki Quest.

## Engineering

Current production authority is the `main` branch. Material architecture work is performed on isolated branches and must pass the repository regression gates before release.

Node-based repository tooling uses the version declared in `.node-version`. CI dependencies are installed deterministically from committed lockfiles. External GitHub Actions are pinned to immutable commit SHAs.

See `docs/architecture/PUBLIC_RELEASE_ENGINEERING_STANDARD.md` for the public-release engineering standard and `docs/architecture/MODULAR_MIGRATION.md` for the active modular migration contract.
