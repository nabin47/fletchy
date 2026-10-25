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

`@capacitor/assets` is **not** a dependency: it pins old versions of `sharp` and `@capacitor/cli`, so `bootstrap.yml` runs it once with `npx --yes @capacitor/assets@3.0.5`.

## Process

- **Lockfile committed in Phase 0.** The plan expected the bootstrap workflow to create `package-lock.json`, but the Claude Code sandbox had Node 22 / npm 10 (same as CI), so the lockfile was generated there and committed. That lets `ci.yml`, `pages.yml` and `android-debug.yml` use `npm ci` immediately. `bootstrap.yml` still runs `npm install` and commits any lockfile refresh.
- **`android-debug.yml` works before bootstrap.** If `android/` is not committed yet, it generates a temporary platform with `npx cap add android` plus `scripts/android-customize.mjs`, so a debug APK exists from day one. Once the bootstrap PR is merged the committed project is used.
- **Bootstrap PR has no CI checks.** Pushes made with `GITHUB_TOKEN` do not trigger workflows, so the bootstrap PR shows no checks; CI runs on `main` after merge. (A PAT would avoid this but is not worth the extra secret.)
- **Phase branches.** Claude Code sessions develop on a session branch (`claude/...`) instead of `phase-N`; there is still one PR per phase.
- **Android SDK levels.** Capacitor 8.5's template already uses minSdk 24 / compileSdk 36 / targetSdk 36 with AGP 8.13 and Gradle 8.14.3; `android-customize.mjs` asserts these values.
