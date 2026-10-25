# Progress

## Phase 0: Skeleton and pipelines (done)

- Hello app live at https://nabin47.github.io/fletchy/ (Pages deploy run 40176536630)
- Debug APK artifact from `android-debug.yml` (run 40176648714)
- `android/` committed via the Bootstrap workflow (PR #3)

## Phase 1: Core engine (in progress)

- [x] `src/core`: types, seeded RNG (mulberry32), grid, rules, dependency graph and cycle check, generator, solver, scoring, config
- [x] Rush engine (waves, hearts, combo, board-clear bonus, heart restore, overflow game over)
- [x] Daily Grid engine (UTC seed, puzzle number, stars, share text, streak)
- [x] Unit tests incl. the 10,000-seed property test and golden determinism values
- [x] Bot balance sim (`npm run sim`) in the CI run summary
- [ ] CI green on the Phase 1 PR
