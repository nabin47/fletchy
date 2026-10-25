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

## Phase 2: Playable web game (done, PR #5)

- [x] Canvas renderer (devicePixelRatio, safe areas), pointer input, arrowhead shapes for direction
- [x] Juice: ease-in slide-off, particles, bump + blocker flash, screen shake, score popups, rising combo pitch (WebAudio), haptics
- [x] Rush and Daily Grid screens, HUD with pressure ring, pause, game over with "so close" nudge and big retry button
- [x] Daily result with stars, share (native / Web Share / clipboard), streak, practice replays
- [x] Hints (3 per day), 3-board first-run tutorial, settings (sound, vibration, theme, colorblind palette, reduce motion)
- [x] Storage (Preferences on native, localStorage on web), auto-pause on visibilitychange and app pause, back button handling
- [x] PWA: generated manifest, precaching service worker, privacy page
- [x] Playwright smoke test through every screen, screenshots at 390x844 and 360x800
- [x] CI green (run 40178696612); deployed to Pages and play-tested on a phone

## Phase 3: Android build and release pipeline (done, PR #6)

- [x] Native polish: identity/version from `app.config.json` in Gradle, R8 + resource shrinking, no permissions, portrait, edge-to-edge via Capacitor SystemBars + safe-area CSS, status bar style follows the theme
- [x] Back button: in-game pauses, back from pause resumes, tutorial skips, menu exits (Playwright logic test + API 36 emulator test)
- [x] `create-upload-key.yml`, `android-release.yml` (signed AAB artifact, optional Play upload)
- [x] `docs/RELEASE.md` checklist
- [x] CI green incl. the API 36 emulator job (run 40181549434)
- [x] Upload key created (run 40185348922); signed AAB built (run 40185401141, manual dispatch: the session's git proxy cannot push tags)

## Phase 4: Launch prep (in progress)

- [x] Store text in `app.config.json` (title, short and full description, release notes, screenshot captions) with length checks in unit tests
- [x] `scripts/make-store-assets.mjs`: 512 icon, 1024x500 feature graphic, 5 captioned 1080x1920 screenshots, listing text, `whatsnew` → `store-listing` CI artifact
- [x] Release notes passed to the Play upload (`whatsNewDirectory`)
- [x] `store/DATA_SAFETY.md` (Data safety, content rating, target audience, ads, app access answers)
- [x] `docs/RELEASE.md`: full owner checklist from account to production
- [ ] CI green on the Phase 4 PR
