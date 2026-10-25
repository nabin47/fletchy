# Fletchy

One-tap arrow puzzle game (web/PWA, Android, later iOS). The full plan is `docs/PLAN.md`; progress is in `docs/PROGRESS.md`, dependency/design choices in `docs/DECISIONS.md`.

## Commands (what CI runs)

- `npm ci` - install from the lockfile
- `npm run typecheck` - `tsc --noEmit` (strict)
- `npm run lint` - ESLint
- `npm test` - Vitest unit tests (`tests/unit`)
- `npm run build` - Vite build to `dist/` (`VITE_BASE=/fletchy/` on Pages)
- `npm run test:e2e` - Playwright smoke test, screenshots in `test-results/screenshots`
- `npm run icons` - render `resources/*.svg` to PNGs
- `npx cap sync android && (cd android && ./gradlew assembleDebug)` - debug APK

## Rules

- The owner installs nothing locally. Every build, test, signing and release runs in GitHub Actions; CI is the source of truth. Never claim something works without a green run.
- Never commit secrets (keystores, passwords, service-account JSON live in GitHub Secrets only). Never echo them in logs.
- Name, store title, App ID and version live only in `app.config.json`; read them from there.
- The App ID `io.github.nabin47.fletchy` is permanent once published.
- Mode names are **Rush** and **Daily Grid**. Never use the old working title anywhere.
- TypeScript strict, no `any` without a comment. `src/core` is pure TS (no DOM) and fully unit-tested.
- Minimal dependencies; justify each in `docs/DECISIONS.md`.
- Original art, sound and wording only.
- Work in phases (PLAN.md Section 9): one PR per phase, merge when green, then update `docs/PROGRESS.md`.
- Workflows: minimal `permissions:`, latest `actions/*` majors, third-party actions pinned by SHA.
