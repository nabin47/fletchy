# Fletchy: Build Plan for Claude Code

## Project identity (decided, use exactly these)

| Item | Value |
|---|---|
| Game name | **Fletchy** |
| Store title (Play and App Store, max 30 chars) | **Fletchy: Arrow Puzzle Rush** |
| GitHub repo name | `fletchy` (lowercase) |
| App ID (Android package and iOS bundle ID) | `io.github.nabin47.fletchy` |
| Web address | `https://nabin47.github.io/fletchy/` (so `VITE_BASE=/fletchy/`) |
| Privacy policy URL | `https://nabin47.github.io/fletchy/privacy.html` |

- Before writing any config, run `gh api user --jq .login` to confirm the GitHub username. **If it is not `nabin47`, use the real username everywhere in the table above** (App ID, web address, privacy URL).
- The App ID is **permanent once published**. Do not change it after the first Play upload.
- Keep the name, store title, App ID and version in ONE place (`app.config.json`) and read them from there everywhere else (Vite, Capacitor config, share text, manifest, store text). A rename must never need more than that file plus the repo name.
- The in-game mode names stay **Rush** and **Daily Grid**. Do not use the old working title "Arrow Rush" anywhere in code, UI or store text: a different app called "ArrowRush: Tap & Clear Game" already exists on the App Store, which is why that title was dropped.

## 0. Your mission and ground rules

Build a simple, endlessly replayable, addictive one-tap puzzle game and ship it as:

1. a **web game** (hosted free on GitHub Pages, installable as a PWA),
2. an **Android app** on Google Play (primary target),
3. an **iOS app** on the App Store (later phase, same codebase).

**Hard constraint: nothing is installed on my computer.** I have only a browser and Claude Code. Therefore:

- All builds, tests, signing and releases run in **GitHub Actions**. CI is the source of truth. If your sandbox has Node, you may use it for quick scaffolding or unit tests, but never rely on it and never require me to run any command.
- Use `gh` (or whatever GitHub API/MCP access you have) to push, trigger workflows, watch runs and read failure logs. If you cannot read run results, tell me and I will paste logs.
- Never commit secrets. Signing keys, passwords and service-account JSON live only in GitHub Secrets.

### Working agreements

- Work in phases (Section 9). Finish a phase, get CI green, then update `docs/PROGRESS.md` and continue to the next. Do not ask me questions unless something is truly blocked on me (Section 11 lists what only I can do).
- **CI feedback loop:** push, `gh run watch`, on failure `gh run view --log-failed`, fix, repeat. After 5 failed attempts on the same problem, stop and summarize what you tried.
- Never say something works unless a CI run proves it. Link the run.
- Small commits with clear messages. Open one PR per phase from a `phase-N` branch; merge when green.
- TypeScript strict mode. No `any` unless commented. Minimal dependencies (every dependency must justify itself in `docs/DECISIONS.md`).
- Original art, sound and names only. Mechanics of the tap-away arrow genre are fair game; do not copy any existing game's look, icons, names or wording.
- Create a short `CLAUDE.md` in the repo root (under 40 lines) that points to this plan, lists the commands CI runs, and states the rules above. Save this plan as `docs/PLAN.md`.

### Versions to use (verified Oct 2026; re-check at build time)

- Node 22, JDK 21, **Capacitor 8** (requires Node 22+, Xcode 26+, Android SDK 36, AGP 8.13, Gradle 8.14.x, minSdk 24, iOS 15+, SPM default on iOS).
- **Google Play requires new apps and updates to target Android 16 (API 36) since 31 Aug 2026.** compileSdk/targetSdk = 36.
- Actions: latest major versions of `actions/*`. Pin third-party actions by commit SHA with a version comment.
- Give every workflow a minimal `permissions:` block.

## 1. The game

### 1.1 Core mechanic (one tap)

A portrait grid (default **7 columns x 10 rows**) holds **arrows**. An arrow is a straight run of 1 to 3 cells with a head pointing in one of 4 directions. **Tap an arrow:**

- **Lane clear** (no other arrow in any cell between its head and the board edge): it slides off the board. Score and combo go up.
- **Lane blocked:** it bumps, the blocking arrow flashes, a heart is lost, combo resets.

Data model (keep it generic so bent "snake" arrows can be added later without rewrites):

```ts
type Dir = 'U' | 'D' | 'L' | 'R';
interface Arrow { id: number; cells: Cell[]; dir: Dir } // head = last cell
```

### 1.2 Why it can be infinite and always fair

Arrow A "depends on" arrow B if B occupies a cell in A's exit lane. A board is solvable **if and only if the dependency graph has no cycle**. The generator inserts arrows one at a time and **rejects any placement that would create a cycle**, so every board, at every moment, is solvable and always has at least one free arrow. No hand-made levels, ever. All randomness uses a seeded PRNG (mulberry32) so the same seed always gives the same board.

### 1.3 Mode A: Rush (endless survival, the main mode)

- Board starts with ~10 arrows. Every `spawnInterval` seconds a **wave** of 1 to 3 new arrows is inserted via the same cycle-safe generator.
- **Pressure:** a ring fills as the board gets dense. Game over when hearts hit 0, or when board density is at least 85% and no valid placement exists for a wave.
- Hearts: 3. A wrong tap costs 1 heart. Clearing a full wave "perfectly" (no wrong taps) can restore 1 heart.
- Difficulty ramp (all numbers live in `src/core/config.ts`, tunable):
  - `spawnInterval = max(1.4s, 4.2s * 0.97^wave)`
  - `waveSize` and long-arrow probability rise with wave number
  - `chainBias` rises: the generator prefers placements that lengthen the longest dependency chain, so boards need more planning later
- Score: `10 * arrow.length * comboMultiplier`. Combo +1 per correct tap, expires after 2.5 s idle or any wrong tap. Multiplier = `1 + 0.5 * floor(combo / 5)`, capped at x4. Clearing the whole board gives +200 and delays the next wave 2 s.
- Local best score and best wave saved.

### 1.4 Mode B: Daily Grid (retention engine)

- Seed = hash of the **UTC date** string plus a constant salt, so everyone worldwide gets the same puzzle. Puzzle number = days since a launch-epoch constant.
- One fixed board (8x10, about 65% filled), 3 hearts, goal: clear everything. Result: time, mistakes, stars (3 stars = no mistakes and under par time).
- One attempt per day for the official result; replay allowed without affecting the streak.
- **Share button:** copyable text like `Fletchy Daily #12  0:42  ❤❤🤍` plus the web link (`https://nabin47.github.io/fletchy/`, later the store link), via Web Share API (web) and `@capacitor/share` (native).
- Streak counter, stored locally. No backend in v1.

### 1.5 Feel (this is what makes it addictive)

- Round length 30 to 90 seconds, restart in one tap.
- Instant feedback on every tap: smooth ease-in slide, particle burst, subtle screen shake on a wrong tap.
- Combo sound that rises in pitch (synthesized with WebAudio oscillators, so no audio files or licensing).
- Haptics on native (`@capacitor/haptics`), with web fallback to `navigator.vibrate` where available.
- A visible "best score" and "so close" nudge at game over. "Tap to retry" is the biggest button.
- Hint: highlights one free arrow (3 free per day in v1; later a rewarded ad).
- First run: a 30-second scripted tutorial with 3 tiny boards. No text walls.

### 1.6 Accessibility and polish

- Direction is never conveyed by color alone (arrowheads are shapes). Colorblind-safe palette option.
- `prefers-reduced-motion` respected. Touch targets at least 44 dp. Dark and light theme.
- i18n-ready string table (English first).
- Pause automatically on `visibilitychange` and the Capacitor app-pause event.

## 2. Architecture

```
/
  app.config.json          # name "Fletchy", storeTitle, appId, version, URLs, store texts: single source of truth
  capacitor.config.ts      # reads app.config.json
  src/
    core/                  # PURE TypeScript, no DOM, fully unit-tested
      types.ts rng.ts grid.ts rules.ts dependency.ts
      generator.ts solver.ts rush.ts daily.ts scoring.ts config.ts
    ui/                    # canvas renderer, input, screens (DOM overlays), juice
    platform/              # thin wrappers: haptics, storage, share, app lifecycle
                           # each with a web fallback; native via Capacitor plugins
    main.ts
  tests/                   # vitest (core) + playwright (smoke)
  scripts/                 # sim.ts (bot balance sim), make-icons.mjs, screenshots
  public/                  # manifest.webmanifest, service worker, icons, privacy.html
  resources/               # icon.svg, splash.svg (original artwork, drawn as SVG)
  android/  ios/           # generated by the bootstrap workflow, then committed
  store/                   # Play listing text, screenshots (generated), data-safety notes
  docs/                    # PLAN.md PROGRESS.md DECISIONS.md RELEASE.md
  .github/workflows/
```

Stack: **Vite + TypeScript + plain Canvas 2D** (no game engine needed; keeps the bundle tiny). Menus and settings are DOM overlays for accessibility. Capacitor 8 wraps the built web app for Android and iOS. Plugins: `@capacitor/app`, `haptics`, `preferences`, `share`, `status-bar`/system-bars handling, `splash-screen`. Targets: 60 fps on a low-end 2 GB device, gzipped JS under 300 KB, first paint under 2 s, **fully offline**, zero network calls in v1.

Rendering rules: scale for `devicePixelRatio`; compute layout from viewport minus safe-area insets (`env(safe-area-inset-*)`). Android 15+/target 36 enforces edge-to-edge, so test insets explicitly.

## 3. Bootstrap without any local tooling

Since I cannot run `npm` or `npx` locally, the one-time scaffolding runs in CI.

1. Hand-write `package.json` (no lockfile yet), `tsconfig.json`, `vite.config.ts`, a minimal `index.html` and `src/main.ts`.
2. **`bootstrap.yml`** (`workflow_dispatch`, inputs: `add_ios` boolean). It must: run `npm install` to create `package-lock.json`; render `resources/icon.svg` and `splash.svg` to PNG with `scripts/make-icons.mjs` (sharp); run `npx cap add android` (and `ios` if requested); run `@capacitor/assets` to generate icons and splash; apply the Android customizations in Section 6; then push a `bootstrap/native` branch and open a PR. Needs repo setting "Allow GitHub Actions to create pull requests" (Section 11).
3. After the bootstrap PR is merged, every other workflow uses `npm ci` and the committed `android/` and `ios/` folders.

## 4. Testing (all in CI)

- **Unit (Vitest) on `src/core`:**
  - 10,000 random seeds: every generated board is solvable, no overlapping cells, no arrow outside the grid.
  - Same seed gives identical board (determinism), including across Node versions.
  - Rush engine: after every spawn the board still has at least one free arrow.
  - Daily: same UTC date gives the same board; different dates differ.
- **Bot simulation (`npm run sim`):** headless bots at several skill levels (reaction delay, error rate) play Rush; the script prints average survival time, waves reached and score percentiles to `$GITHUB_STEP_SUMMARY`. Use it to tune `config.ts` so a beginner survives about 60 to 90 s and a perfect bot is eventually overwhelmed. This replaces playtesting I cannot do on a local machine.
- **Playwright smoke test** against the built web app in headless Chromium: loads with no console errors, can start Rush, a test hook (`window.__fletchy.debug`) lets a bot make taps, game-over screen appears, Daily mode loads. It saves **screenshots at 390x844 and 360x800** and uploads them as workflow artifacts so progress can be reviewed visually without running anything. Reuse these as store screenshots.
- Lint (ESLint) and `tsc --noEmit` are required checks.

## 5. Workflows (all in `.github/workflows/`)

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | push, PR | Node 22, `npm ci`, typecheck, lint, unit tests, build, Playwright smoke, upload `dist` and screenshots |
| `pages.yml` | push to `main` | Build and deploy to GitHub Pages (`actions/deploy-pages`). Gives me a playable URL on my phone after every merge |
| `android-debug.yml` | push, PR | Build web, `cap sync android`, JDK 21, `./gradlew assembleDebug`, upload the APK artifact for sideloading and testing |
| `android-release.yml` | tag `v*` or manual (inputs: `track` = internal / alpha / production, default internal; `status` = draft / completed) | Build signed AAB, upload as artifact, and if Play secrets exist upload to Play with `r0adkll/upload-google-play` (pinned by SHA) |
| `create-upload-key.yml` | manual, once | Generate the Android **upload keystore** with random passwords and write them straight into repo secrets with `gh secret set` using `ADMIN_PAT`. Never print or upload the values |
| `bootstrap.yml` | manual, once | See Section 3 |
| `ios-release.yml` | manual | macOS runner with Xcode 26, gated by repo variable `IOS_ENABLED=true`. Builds, signs, uploads to TestFlight. Skeleton only until Phase 6 |
| `dependabot.yml` | n/a | Weekly updates for npm and GitHub Actions |

Release details:

- `versionName` from the git tag; `versionCode` = `github.run_number` plus a fixed offset (must only ever increase).
- Signing: patch `android/app/build.gradle` so `signingConfigs.release` reads `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` from the environment. The workflow decodes `ANDROID_KEYSTORE_BASE64` to a temp file.
- Use **Play App Signing** (the default). The generated key is only the *upload* key, so if it is ever lost Google can reset it.
- Play upload prerequisites: the Android Publisher API enabled in Google Cloud, a service account added as a user in Play Console with release permission for this app, its JSON in secret `PLAY_SERVICE_ACCOUNT_JSON`, and the **first AAB uploaded manually** in Play Console (the API cannot create the app). The AAB is a workflow artifact, so I can download it for that first upload.
- The closed-test track is named `alpha` in the API.
- Cache npm and Gradle. Set sensible `timeout-minutes`. Add `concurrency` groups so pushes cancel stale runs.

## 6. Android customizations (applied by `bootstrap.yml`, then committed)

- `minSdk 24`, `compileSdk`/`targetSdk 36`, `applicationId` from `app.config.json`.
- Portrait-locked, edge-to-edge handled with safe-area CSS, immersive status bar styling.
- Release build: R8 minify on, no debuggable flag, no unneeded permissions (v1 needs **none**, not even INTERNET if possible; keep it only if a plugin forces it).
- Back button: handle via `@capacitor/app`. With targetSdk 36 the system back/predictive-back behavior changed, so explicitly test that back in-game opens the pause menu and back on the main menu exits. Add a note to `docs/DECISIONS.md` with the result.
- Adaptive icon (foreground/background) from `resources/icon.svg`.

## 7. Web / PWA

- `manifest.webmanifest`, maskable icons, a small service worker that precaches the build so the game works offline.
- Pages base path comes from `VITE_BASE`, set to `/fletchy/` in `pages.yml` (it must match the repo name; use `/` for local and Capacitor builds, because the native apps load files from the device, not from that web path). The manifest `start_url`, `scope` and service-worker paths must respect the base. Include `public/privacy.html` (needed for the Play listing) and a simple landing section with Play Store and App Store badges once live.
- The web build is also my free demo and marketing page.

## 8. Store assets (generate in the repo under `store/`)

- App icon 512x512, feature graphic 1024x500 (both original, rendered from SVG in CI).
- Phone screenshots from the Playwright run (at least 4, with short captions).
- Store title "Fletchy: Arrow Puzzle Rush", short description (80 chars max), full description, release notes. All text is original and never mentions other games.
- `privacy.html`: states that v1 collects no personal data, has no accounts, no ads and no analytics, and stores only game progress locally on the device.
- `store/DATA_SAFETY.md`: answers for the Play Data Safety form (v1: no data collected or shared), plus notes for the content rating questionnaire and "not designed for children" target-audience answer. These are for me to enter; document them clearly.

## 9. Phases and acceptance criteria

**Phase 0: Skeleton and pipelines.** Repo structure, bootstrap run, lockfile, `ci.yml`, `pages.yml`, `android-debug.yml`. Done when: a "hello" Vite app is live on Pages and a debug APK artifact exists, all from CI.

**Phase 1: Core engine.** All of `src/core` with tests and the bot sim. Done when: unit tests green, the 10,000-seed property test passes, sim output shows a sensible difficulty curve in the CI summary.

**Phase 2: Playable web game.** Canvas renderer, input, juice, Rush, Daily, menus, settings, tutorial, storage, share, sounds, PWA. Done when: Playwright smoke passes, screenshots look right, I can play on my phone via the Pages URL.

**Phase 3: Android build and release pipeline.** Native polish from Section 6, `create-upload-key.yml`, `android-release.yml`. Done when: a signed AAB is produced by a tagged run and (once I add secrets) lands on the Play **internal** track.

**Phase 4: Launch prep.** Store assets, privacy page, `docs/RELEASE.md` with my step-by-step checklist (account, first upload, closed test, production access). Done when: everything on the Play Console checklist is either generated or documented.

**Phase 5: Retention and money (after launch).** Rewarded hints and an interstitial every N rounds via AdMob (`@capacitor-community/admob`) with Google's consent flow (UMP), unlockable themes, a global Daily leaderboard (small free backend such as Supabase or Firebase), and notification of the daily puzzle. Update the privacy policy and Data Safety answers before shipping ads.

**Phase 6: iOS.** Enable `ios-release.yml`: Xcode 26 runner, signing with certificate and provisioning secrets or an App Store Connect API key, upload to TestFlight. Check iOS safe areas and haptics.

## 10. Risks to handle

- Name: "Fletchy" showed no matching games in quick web searches, but that is not proof. Apple requires unique app names, so confirm when creating the App Store listing; Google Play does not require unique titles, so there the risks are discoverability and trademarks. I (the human) will do a trademark search. If a clash appears, change only `app.config.json`'s name and store title; the App ID and repo can stay.
- Edge-to-edge and back-gesture behavior on Android 15/16: test with the emulator-free approach by keeping the logic simple and covering layout with Playwright viewport tests.
- Clones are plentiful: the differentiators are the endless Rush mode, the Daily shareable puzzle and game feel. Spend polish time there.
- Free GitHub Actions minutes: Linux builds on public repos are free; macOS minutes cost far more on private repos. Prefer a **public repo** (safe, because no secrets are ever committed) unless I say otherwise.
- Never log secrets; `create-upload-key.yml` must not echo them.

## 11. What only I (the human) must do

Claude Code: list these in `docs/RELEASE.md` as a checklist and remind me when each becomes the blocker.

1. **Already decided:** name, store title, repo name and App ID are in the "Project identity" table at the top. My remaining check: a quick trademark search for "Fletchy", and confirming the GitHub username is `nabin47` (Claude Code will verify this with `gh`).
2. Create the GitHub repo and give Claude Code push access. In Settings: Pages source = **GitHub Actions**; Actions permissions = read and write, and "Allow GitHub Actions to create and approve pull requests".
3. Create a **fine-grained personal access token** for this repo with Secrets read/write and save it as secret `ADMIN_PAT` (used only by `create-upload-key.yml`).
4. Create a **Google Play Developer account** (one-time fee). A *personal* account created after 13 Nov 2023 must run a **closed test with at least 12 testers opted in for 14 continuous days** before applying for production access; organization accounts are exempt but need a D-U-N-S number. Plan about three weeks from first closed-test release to production.
5. In Google Cloud: enable the Google Play Android Developer API, create a service account, download its JSON key, add the service account as a user in Play Console (Users and permissions) with release permission for the app, and save the JSON as secret `PLAY_SERVICE_ACCOUNT_JSON`.
6. Create the app in Play Console, upload the **first AAB manually** (download it from the release workflow artifact), fill in the Data Safety form, content rating and target audience using `store/DATA_SAFETY.md`.
7. Recruit 12 or more testers for the closed test (friends, students, colleagues) and keep them opted in 14 days.
8. Much later, for iOS: Apple Developer Program membership and App Store Connect API key.

## 12. Start now

1. Read this whole plan.
2. Do **Phase 0**. Ask me for nothing; use the values in the "Project identity" table.
3. Tell me, in one short message, the Pages URL (expected: `https://nabin47.github.io/fletchy/`) once it is live and what I need to do for Section 11 items 2 and 3 so the bootstrap workflow can run.
