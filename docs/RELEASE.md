# Release checklist (things only the owner can do)

Claude Code keeps this list current and says when an item becomes the blocker.
Downloads ("artifacts") are at GitHub → Actions → pick the run → **Artifacts** at the bottom of the run page.

## 1. Already done

- [x] Name, store title, repo and App ID decided (`app.config.json`)
- [x] GitHub repo, Pages (`https://nabin47.github.io/fletchy/`), Actions permissions
- [x] `ADMIN_PAT` created, upload key generated (secrets `ANDROID_KEYSTORE_*`, `ANDROID_KEY_*`)
- [x] First signed AAB built (Android release run 40185401141, versionCode 101)
- [ ] Optional: delete the `ADMIN_PAT` secret now. It is only needed to create a new upload key.
- [ ] Quick trademark search for "Fletchy" (if there is a clash, only `app.config.json`'s name and store title change)

## 2. Google Play developer account (about 1-2 days)

- [ ] Sign up at play.google.com/console (one-time fee, identity verification).
- [ ] Note your account type:
  - **Personal** (created after 13 Nov 2023): you must run a **closed test with at least 12 testers opted in for 14 continuous days** before you can apply for production (section 6).
  - **Organization**: exempt from that rule, but needs a D-U-N-S number.

## 3. Create the app and fill in "Set up your app"

- [ ] Play Console → **Create app**: app name `Fletchy: Arrow Puzzle Rush`, default language English (United States), **Game**, **Free**. Accept the declarations.
- [ ] Leave **Play App Signing** on (the default). Our key is only the *upload* key, so Google can reset it if it is ever lost.
- [ ] Answer every App content form exactly as in [`store/DATA_SAFETY.md`](../store/DATA_SAFETY.md): privacy policy, app access, ads, content rating, target audience, data safety, advertising ID, government/financial/health.

## 4. Store listing (Grow → Store presence → Main store listing)

Download the **`store-listing`** artifact from the latest CI run on `main`. Everything is generated from `app.config.json`, so edit that file (not Play Console) when the text changes.

- [ ] App name: `listing/en-US/title.txt`
- [ ] Short description: `listing/en-US/short_description.txt`
- [ ] Full description: `listing/en-US/full_description.txt`
- [ ] App icon: `icon-512.png` (512x512)
- [ ] Feature graphic: `feature-graphic.png` (1024x500)
- [ ] Phone screenshots: `screenshots/phone-1.png` … `phone-5.png` (1080x1920, captions built in)
- [ ] Store settings: category **Puzzle**, contact email, website `https://nabin47.github.io/fletchy/`

## 5. First upload by hand (the API cannot create the first release)

- [ ] Download **`fletchy-release-aab`** from the latest *Android release* run and unzip it.
- [ ] Play Console → **Testing → Internal testing** → Testers: create an email list with yourself → **Create new release** → upload `fletchy-<version>-<code>.aab` → release notes: `whatsnew/whatsnew-en-US` from the store-listing artifact → **Save → Review → Start rollout**.
- [ ] Open the opt-in link on your phone, install from Play, and play a round.
- [ ] Optional: under App bundle explorer → Downloads, upload `mapping.txt` from the same artifact so crash reports are readable (automatic once the API is set up).

## 6. Automate uploads (optional but recommended)

- [ ] Google Cloud console: create a project, enable **Google Play Android Developer API**, create a **service account**, then add a **JSON key** and download it.
- [ ] Play Console → **Users and permissions** → Invite new user → the service account email → app permissions for Fletchy: *Release to testing tracks* and *Release to production* (plus *View app information*).
- [ ] Save the JSON file contents as repo secret **`PLAY_SERVICE_ACCOUNT_JSON`**.
- From then on: Actions → **Android release** → Run workflow → choose `track` (`internal`, `alpha` = closed test, `production`) and `status`. Use `draft` until your first manual release is live, then `completed`. Tag pushes (`v1.2.3`) also upload, to internal / draft.

## 7. Closed test: 12 testers for 14 days (personal accounts)

- [ ] Recruit **12 or more** testers (friends, students, colleagues). Each needs a Google account; a Google Group makes this easy.
- [ ] Play Console → **Testing → Closed testing** → the default *Alpha* track → add the testers (email list or Google Group) → create a release with the same AAB (or run *Android release* with `track: alpha`) → roll out.
- [ ] Send testers the opt-in link. They must **stay opted in for 14 continuous days**. Encourage them to actually play; Google asks about tester engagement.
- [ ] Ask testers for feedback; fix issues; ship updates to the same track (versionCode increases automatically).

## 8. Production

- [ ] After 14 days: Dashboard → **Apply for production**, then answer the questions about your closed test. Review usually takes up to about a week.
- [ ] Once approved: run *Android release* with `track: production`, `status: completed` (or create the release in Play Console).
- [ ] Tell Claude Code the store link; it adds the Play badge to the web page and the share text.

**Timeline:** plan about three weeks from the first closed-test release to production.

## Later: iOS (Phase 6)

- [ ] Apple Developer Program membership.
- [ ] App Store Connect API key (as repo secrets), then the iOS workflow gets enabled.
- [ ] Apple requires unique app names: confirm "Fletchy" is free when creating the App Store listing.
