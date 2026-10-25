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
- **Status bar / splash plugins deferred to Phase 3** together with the other native polish (edge-to-edge, back-gesture test).
- **Test hook.** `window.__fletchy.debug` lets Playwright drive the game: real pointer taps on a free arrow's centre, plus helpers for wrong taps and reading state. It is harmless in production (it can only do what a player can).
