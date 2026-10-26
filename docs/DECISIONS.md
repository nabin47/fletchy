# Decisions

## Dependencies

| Package | Why |
|---|---|
| `@capacitor/core`, `@capacitor/android` (runtime) | Native wrapper for Android (PLAN Section 2). |
| `@capacitor/cli` (dev) | `cap add` / `cap sync` in CI. |
| `vite` (dev) | Dev server and bundler; tiny output, no framework. |
| `typescript` (dev) | Strict typing. Pinned to 6.0.x because `typescript-eslint` 8 does not yet support TS 7. |
| `vitest` (dev) | Unit tests for `src/core`; shares Vite's config and transforms. |
| `@playwright/test` (dev) | Headless smoke tests and screenshots (PLAN Section 4). |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` (dev) | Required lint check. |
| `@types/node` (dev) | Types for config files and scripts that run in Node. |
| `sharp` (dev) | Renders the SVG artwork to PNG icons and splash screens. |
| `@capacitor/app` | Native back button and app pause events. |
| `@capacitor/haptics` | Native haptics (web falls back to `navigator.vibrate`). |
| `@capacitor/preferences` | Native key-value storage that the OS will not evict like WebView storage (web uses `localStorage`). |
| `@capacitor/share` | Native share sheet for Daily results (web uses the Web Share API, then the clipboard). |

`@capacitor/assets` is **not** a dependency: it pins old versions of `sharp` and `@capacitor/cli`, so `bootstrap.yml` runs it once with `npx --yes @capacitor/assets@3.0.5`.

## Process

- **Lockfile committed in Phase 0.** The plan expected the bootstrap workflow to create `package-lock.json`, but the Claude Code sandbox had Node 22 / npm 10 (same as CI), so the lockfile was generated there and committed. That lets `ci.yml`, `pages.yml` and `android-debug.yml` use `npm ci` immediately. `bootstrap.yml` still runs `npm install` and commits any lockfile refresh.
- **`android-debug.yml` works before bootstrap.** If `android/` is not committed yet, it generates a temporary platform with `npx cap add android` plus `scripts/android-customize.mjs`, so a debug APK exists from day one. Once the bootstrap PR is merged the committed project is used.
- **Bootstrap PR has no CI checks.** Pushes made with `GITHUB_TOKEN` do not trigger workflows, so the bootstrap PR shows no checks; CI runs on `main` after merge. (A PAT would avoid this but is not worth the extra secret.)
- **Phase branches.** Claude Code sessions develop on a session branch (`claude/...`) instead of `phase-N`; there is still one PR per phase.
- **Android SDK levels.** Capacitor 8.5's template already uses minSdk 24 / compileSdk 36 / targetSdk 36 with AGP 8.13 and Gradle 8.14.3; `android-customize.mjs` asserts these values.

## Engine (Phase 1)

- **Lane = whole ray to the edge.** Arrow A depends on B if B occupies *any* cell between A's head and the edge, not only the nearest one. That makes "A is free" exactly "A has no dependencies", so a cycle-free graph always has a free arrow.
- **Cycle check on insert.** A new arrow N adds edges N -> (arrows in N's lane) and A -> N (arrows whose lane crosses N). A cycle appears iff one of N's dependencies can reach one of N's dependents; a DFS over the existing graph checks that.
- **Exhaustive fallback.** The generator tries random placements first and, if none work, scans every (cell, direction, length) placement. So "no valid placement exists" (the Rush overflow condition) is exact, not a guess.
- **`node scripts/sim.ts` without a TS runner.** Node 22.18+ strips types natively, so core imports use explicit `.ts` extensions (`allowImportingTsExtensions`, `erasableSyntaxOnly` in tsconfig). That avoids adding `tsx` or `ts-node`.
- **Wave size grows past 3.** The plan says waves of 1 to 3 arrows. With a 1.4 s spawn floor, a fast player clears 3 arrows faster than they arrive, so the perfect bot would never lose. Wave size starts at 1-3 and slowly grows (`waveSizeRange` in `config.ts`). The sim confirms every bot is eventually overwhelmed.
- **Bot model.** Each bot taps after `reaction + scanPerArrow * arrowsOnBoard` seconds (reading a busy board takes longer). With probability `errorRate` it taps a blocked arrow.

## Web game (Phase 2)

- **No PWA plugin.** A ~40-line Vite plugin in `vite.config.ts` generates `manifest.webmanifest`, `privacy.html` (from `resources/privacy.template.html`) and a precaching `sw.js`. Name, colours and repo all come from `app.config.json`. The service worker is registered only on the web build, never inside the native apps.
- **Daily epoch = 2026-10-25.** Puzzle #1 is the day Phase 2 was built. Changing the epoch renumbers every puzzle, so treat it as fixed from now on.
- **Test hook.** `window.__fletchy.debug` lets Playwright drive the game: real pointer taps on a free arrow's centre, plus helpers for wrong taps and reading state. It is harmless in production (it can only do what a player can).

## Android (Phase 3)

- **No INTERNET permission.** Capacitor serves the game from inside the APK through an intercepted `https://localhost` origin, so no socket is ever opened. The manifest marks the permission `tools:node="remove"` so no library can merge it back. The emulator test checks that the installed app requests no INTERNET permission and still boots.
- **No status-bar or splash-screen plugin.** Capacitor 8's built-in `SystemBars` handles edge-to-edge (`insetsHandling: 'css'` injects `--safe-area-inset-*`, used with an `env()` fallback). It also handles the status/navigation bar icon style, which follows the theme. The Android 12+ system splash (icon on the background colour) is enough; `@capacitor/splash-screen` is not needed.
- **Back button and predictive back (targetSdk 36).** `@capacitor/app` registers an `OnBackPressedCallback`, which still works when predictive back is on. Behaviour: in-game back opens the pause menu; back on pause resumes; back in the tutorial skips it; back on other screens returns to the menu; back on the menu exits. **Test result:** the `emulator` job in `android-debug.yml` boots an API 36 emulator and runs `scripts/android-smoke.sh`, which presses KEYCODE_BACK and follows `[fletchy] screen=` lines in logcat. The Playwright smoke test covers the same logic on the web.
- **Identity in Gradle.** `android/app/build.gradle` reads `appId` and `version` from `app.config.json`. The release workflow sets `ANDROID_VERSION_NAME` (from the tag) and `ANDROID_VERSION_CODE` (run number + 100). Signing is read from env vars only when `ANDROID_KEYSTORE_PATH` is set.
- **Release status defaults to `draft`.** Play rejects `completed` releases while the app itself is still a draft in Play Console. Switch to `completed` in the manual run once the app is set up.
- **CI triggers.** `ci.yml` and `android-debug.yml` now run on pull requests and pushes to `main` (not every branch push), so a PR no longer runs everything twice.

## Launch prep (Phase 4)

- **Store screenshots are 1080x1920 (9:16).** The 390x844 and 360x800 smoke-test screenshots are taller than 2:1, which Play rejects. `tests/e2e/store.spec.ts` captures dedicated shots at 405x720 CSS px with a 2.667 device scale factor. Captions are added by sharp (no design tool) and come from `app.config.json` like every other store string.
- **Generated, not committed.** `store/build/` is rebuilt by CI on every run and uploaded as the `store-listing` artifact. Only the source (SVG, config, script) is in git, so text and screenshots can never drift from the game.
- **Target audience 13+.** Selecting under-13 age groups would bring in the Families policy. The game is general-audience, so the answers in `store/DATA_SAFETY.md` exclude those groups.
- **Store badges on the web page** wait until the listing is live (Phase 4 has nothing to link to yet).

## Feel and look rework (after the first play-test)

Owner feedback: too easy (waiting for waves after clearing the board), arrows too big on too small a grid (looked made for young children), and too many colours.

- **Dynamic difficulty.** Rush no longer runs on a fixed wave timer. A difficulty *level* rises with time (0.2 per second). It also gains 0.25 every time the player clears the board below `minOnBoard(level)`, which pulls the next wave in after 0.35 s. Nobody waits on an empty board, and fast players climb the curve faster. The level sets the arrival rate (0.55 arrows/s × 1.025^level), wave spacing, arrow length and `chainBias`. The plan's "+200 and 2 s delay" on a board clear is now "+200 and the next wave arrives at once". Sim (100 games per bot): beginner about 67 s mean, casual 110 s, skilled 158 s, perfect bot overwhelmed at about 189 s.
- **Bigger grid, thinner arrows.** Rush and Daily are 9×13 (the plan said 7×10 and 8×10). Arrows are a thin shaft plus a small head on a 6% tile. Cells are about 41 px wide on a 390 px phone, below the plan's 44 dp touch target. To compensate, a tap on an empty cell picks the nearest arrow cell within 0.8 cells (`Renderer.arrowAt`). Long arrows (2-3 cells) are most of the board, so the effective target is larger.
- **Minimal palette.** Every arrow is one ink colour; the arrowhead shape shows direction. There is one muted sage accent and a muted red only for mistakes. Light is the default (warm off-white `#f4f2ee`, ink `#34363c`), with a matching soft dark theme. The **colorblind option was removed**: with monochrome arrows and shape-coded direction, nothing depends on telling colours apart. Icon, splash, store art and privacy page use the same palette.
- **Daily boards changed** with the new size, so every date now has a different puzzle than before. This happened before launch, and puzzle numbers are unchanged.
