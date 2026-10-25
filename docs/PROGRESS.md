# Progress

## Phase 0: Skeleton and pipelines (done)

- Hello app live at https://nabin47.github.io/fletchy/ (Pages deploy run 40176536630)
- Debug APK artifact from `android-debug.yml` (run 40176648714)
- `android/` committed via the Bootstrap workflow (PR #3)

## Phase 1: Core engine (done, PR #4)

- [x] `src/core`: types, seeded RNG (mulberry32), grid, rules, dependency graph and cycle check, generator, solver, scoring, config
- [x] Rush engine (waves, hearts, combo, board-clear bonus, heart restore, overflow game over)
- [x] Daily Grid engine (UTC seed, puzzle number, stars, share text, streak)
- [x] Unit tests incl. the 10,000-seed property test and golden determinism values
- [x] Bot balance sim (`npm run sim`) in the CI run summary
- [x] CI green on the Phase 1 PR (run 40177349397)

## Phase 2: Playable web game (in progress)

- [x] Canvas renderer (devicePixelRatio, safe areas), pointer input, arrowhead shapes for direction
- [x] Juice: ease-in slide-off, particles, bump + blocker flash, screen shake, score popups, rising combo pitch (WebAudio), haptics
- [x] Rush and Daily Grid screens, HUD with pressure ring, pause, game over with "so close" nudge and big retry button
- [x] Daily result with stars, share (native / Web Share / clipboard), streak, practice replays
- [x] Hints (3 per day), 3-board first-run tutorial, settings (sound, vibration, theme, colorblind palette, reduce motion)
- [x] Storage (Preferences on native, localStorage on web), auto-pause on visibilitychange and app pause, back button handling
- [x] PWA: generated manifest, precaching service worker, privacy page
- [x] Playwright smoke test through every screen, screenshots at 390x844 and 360x800
- [ ] CI green, then play-test on phone via Pages
