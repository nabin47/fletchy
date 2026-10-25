# Release checklist (things only the owner can do)

Claude Code keeps this list current and says when an item becomes the blocker.

## Done

- [x] Name, store title, repo and App ID decided (`app.config.json`)
- [x] GitHub repo created; Pages source = GitHub Actions

## Android signing (needed for Phase 3: signed AAB)

1. [ ] **Create `ADMIN_PAT`.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
   - Repository access: only `nabin47/fletchy`
   - Permissions: **Secrets: Read and write** (nothing else)
   - Expiry: 7 days is enough; it is only used once.
   - Save it in the repo: Settings → Secrets and variables → Actions → New repository secret → name `ADMIN_PAT`.
2. [ ] **Run "Create upload key".** Actions → Create upload key → Run workflow. It creates the upload keystore and stores it as four secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`. No values are ever shown. The run summary shows the upload certificate's SHA-256 fingerprint.
3. [ ] Optional: delete `ADMIN_PAT` afterwards.

## Building a release

- **Tag push:** set `version` in `app.config.json` (and `package.json`), merge, then push tag `v<version>` (for example `v0.1.0`). The workflow refuses a tag that does not match `app.config.json`.
- **Manual:** Actions → Android release → Run workflow (choose track and status).
- Download the signed AAB from the run's `fletchy-release-aab` artifact. `versionCode` = run number + 100, so it always increases.

## Google Play (Phase 4 adds the store listing details)

4. [ ] Create a Google Play Developer account (one-time fee). A personal account made after 13 Nov 2023 needs a **closed test with 12+ testers opted in for 14 continuous days** before production access.
5. [ ] Create the app in Play Console. Package name: `io.github.nabin47.fletchy` (permanent). Keep **Play App Signing** on (the default).
6. [ ] Upload the **first AAB by hand** (Testing → Internal testing → Create release), using the artifact from a release run.
7. [ ] Google Cloud: enable the *Google Play Android Developer API*, create a service account, create a JSON key.
8. [ ] Play Console → Users and permissions → invite the service account email, grant release permissions for this app.
9. [ ] Save the JSON key as repo secret `PLAY_SERVICE_ACCOUNT_JSON`. From then on release runs upload to Play automatically (default: internal track, draft status).
