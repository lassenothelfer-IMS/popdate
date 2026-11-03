# Getting Popdate onto the App Store

Status on 3 Nov 2026: the app works end to end on the mock server (bots) and passes typecheck, lint and 286 tests (265 app, 21 backend). It has **not** run against a real Convex deployment on a phone, and it isn't ready for review yet.

This is the order we go in. Each step says who owns it and what "done" means. Tick the boxes as you go.

| Phase | What | Owner |
| --- | --- | --- |
| 0 | Minor UI tweaks and paywalls | Lasse (app), Jonas (backend for paywalls) |
| 1 | Production backend on Convex | Jonas |
| 2 | Accounts, build and TestFlight | Elias |
| 3 | Real playtest on phones | Everyone, Kian recruits |
| 4 | Fixes Apple will check | Elias, Jonas, Lasse |
| 5 | App Store listing and submission | Elias, Kian |
| 6 | After launch | Everyone |

---

## Phase 0: before anything else

These come first, because they change the build we test and the answers we give Apple.

### 0.1 Minor UI tweaks (Lasse)

- [ ] Go through every screen on a real iPhone (not the browser) in light and dark mode, with large text on, and list what looks off.
- [ ] The screen-reader hint on the Pop button still says "Press and hold"; VoiceOver users actually double-tap. Reword it.
- [ ] Check the role reveal ("This time you're choosing") and the final-two cards on the smallest iPhone (SE, 375 pt) and the largest (Pro Max, 430 pt).
- [ ] Final app icon from Kian (issue #11). The iOS icon is still Expo's template in `mobile/assets/expo.icon`. Splash colours are already done.
- [ ] Anything else found in the playtest in phase 3 goes here too.

Done when: a full room as chooser and as balloon looks right on two different iPhones.

### 0.2 Paywalls (Lasse and Jonas)

Popdate sells something digital (features inside the app), so Apple requires **in-app purchase** through StoreKit (App Store Review Guideline 3.1.1). A card form inside the app is not allowed anywhere. A link or button to a website checkout is allowed only on the **US storefront** (since 2025); elsewhere it needs Apple's External Purchase Link entitlement, with its own fees in the EU and some other countries. Plan for in-app purchase everywhere and treat a US web link as an optional extra.

Decide first (whole team):
- [ ] **What is paid.** Ideas that fit the game without breaking it: more second chances per week, seeing who almost picked you, a profile boost in the queue, more rooms per day. Don't charge for playing a basic room: rooms need six people, and a paywall in front of the queue empties it.
- [ ] **Subscription, one-time purchases, or both.** Price points per country.

Then build it:
- [ ] Sign the **Paid Apps agreement** in App Store Connect, under Business. Banking and tax forms have to be complete before any purchase works, even in testing.
- [ ] Create the products (subscription group and/or consumables) in App Store Connect → the app → Monetization.
- [ ] Add a purchases library. The common choice is RevenueCat (`react-native-purchases` with `react-native-purchases-ui`, which includes ready-made paywall screens). It handles receipts, restores and subscription status. **This is a new dependency: agree on it before adding it.** It has native code, so real purchases need a development build; in Expo Go it only runs in RevenueCat's preview mode, with fake purchases.
- [ ] Backend (Jonas): store what each user is entitled to on the server, and check it there, not only in the app. RevenueCat can send a webhook to a Convex HTTP action (`mobile/convex/http.ts`) when a purchase or renewal happens.
- [ ] The paywall screen must show the price, the billing period, what's included, **Restore purchases**, and links to the terms and privacy policy (Guideline 3.1.2 for subscriptions).
- [ ] Test with Sandbox Apple accounts (App Store Connect → Users and Access → Sandbox), including buy, cancel, renew and restore on a second phone.

Done when: a sandbox account can buy, the feature unlocks on the server, and restore works after reinstalling.

---

## Phase 1: production backend (Jonas)

The app talks to Convex only when `EXPO_PUBLIC_API=convex` and `EXPO_PUBLIC_CONVEX_URL` are set. A release build with `convex` but no URL now stops at launch with an error instead of quietly playing against bots.

All commands run in `mobile/`.

- [ ] Create the production deployment and push the schema and functions:
  ```bash
  npx convex deploy
  ```
  Note the deployment URL it prints (`https://<name>.convex.cloud`).
- [ ] Set up Convex Auth keys on production (it signs users in with a key pair):
  ```bash
  npx @convex-dev/auth --prod
  ```
- [ ] Production environment variables (Convex dashboard → Settings → Environment Variables): leave `LOBBY_SIZE` and `ALLOW_TEST_PLAYERS` **unset** in production, so rooms need six real people and fake test players can't be added.
- [ ] Seed the questions table if production starts empty (same way as on dev).
- [ ] Run the backend tests against the code being deployed: `npm run test:backend`.
- [ ] Decide who reviews reports and selfies, and how. Today a selfie is approved by hand:
  ```bash
  npx convex run verification:review '{"userId": "...", "status": "verified"}' --prod
  ```
  That's fine for a beta, not for launch (see phase 4).

Done when: the production URL exists, auth works, and a test sign-in from a dev build creates a user you can see in the dashboard.

---

## Phase 2: accounts, build and TestFlight (Elias)

### 2.1 Accounts

- [ ] Apple Developer Program membership ($99 a year). An organisation account is better for a dating app (it shows the company as the seller); it needs a D-U-N-S number, which takes days to weeks.
- [ ] Expo account with access to the EAS project. `mobile/app.json` lists the owner `elihhh` and project id `f4648c9d-c8ad-4a8e-8f14-b63942d3b618`. Add the others in expo.dev.
- [ ] App Store Connect: create the app with bundle id **`com.popdate.app`** (already in `app.json`), SKU, and primary language.

### 2.2 Point the builds at Convex

`eas.json` already sets `EXPO_PUBLIC_API=convex` for `preview` and `production`. The URL is missing on purpose (it's not a secret, but it differs per environment):

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_CONVEX_URL --value https://<name>.convex.cloud --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_CONVEX_URL --value https://<dev-name>.convex.cloud --environment preview --visibility plaintext
```

Then add `"environment": "production"` to the `production` profile and `"environment": "preview"` to the `preview` profile in `eas.json`, so each build picks up its own variables. Check with `npx eas-cli@latest env:list`.

### 2.3 Development build (for testing on phones)

Expo Go can't do push notifications, purchases or anything else with native code we add later.

```bash
npx eas-cli@latest build --profile development --platform ios
```

Register test phones with `npx eas-cli@latest device:create` first; internal builds only install on registered devices.

### 2.4 TestFlight

```bash
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios --latest
```

- EAS manages the signing certificate and provisioning profile; let it create them when asked.
- Push notifications: when EAS asks to set up a push key (APNs), say yes. The server sends pushes through Expo's push service (`mobile/convex/push.ts`), which needs that key.
- Build numbers count up by themselves (`autoIncrement` with `appVersionSource: remote`). Bump `version` in `app.json` for each App Store release.
- In App Store Connect → TestFlight, add testers. Internal testers (on the team) get builds right away; external testers need a short beta review first.

Done when: a TestFlight build installs, signs in, and plays a room against production Convex.

---

## Phase 3: real playtest (everyone, Kian recruits)

A room only starts with six compatible people in the line at once, so this needs planning.

- [ ] Get 12 to 18 testers with both men and women, so two rooms can run at the same time. Schedule one evening slot (the app has no scheduled rooms, but the testers need to be online together).
- [ ] Play at least five rooms. Everyone tries both roles.
- [ ] Check on real phones: push notifications (room ready, new match, message), the photo picker and camera, selfie upload, the keyboard covering fields, leaving mid-room, losing signal mid-room, reinstalling the app.
- [ ] Run the Maestro solo flow on a device: `mobile/.maestro/solo-playtest.yaml` (see `mobile/.maestro/README.md`).
- [ ] Collect what breaks or confuses people → back into phase 0.1.

Done when: five rooms in a row finish without anyone getting stuck.

---

## Phase 4: what Apple checks for dating apps

Apple treats dating apps as high risk. These are the usual reasons for rejection, with the GitHub issue numbers.

- [ ] **Review account for App Review (Guideline 2.1).** A reviewer alone can't fill a room of six. Apple wants a demo account rather than a built-in demo mode (a demo mode needs their approval first), so give them a review account whose rooms the server fills with bots, and explain it in the review notes. Without this, review will fail.
- [ ] **Sign in with Apple** instead of anonymous accounts (Elias). Apple doesn't require it for us: Guideline 4.8 only applies when an app offers a login like Google or Facebook, and Popdate has none. We want it because today, deleting the app loses the profile. If we ever add Google or Facebook login, it becomes required. Needs the `expo-apple-authentication` package and the "Sign In with Apple" capability for the bundle id (`ios.usesAppleSignIn: true` in `app.json`).
- [ ] **Report and block everywhere (Guideline 1.2):** on every person in a room (done via the "…" menu) and by long-pressing a message (not done, #6).
- [ ] **Blocked people disappear from Matches** (#7).
- [ ] **A stronger server word filter** (#8): catch "f*ck", "sh1t", spaced-out letters.
- [ ] **Photo moderation and real selfie checks** (#10): a liveness check, comparing the selfie with the profile photos, and requiring verification before queuing.
- [ ] **Age:** rate the app 18+ in App Store Connect (the age rating questionnaire is mandatory since January 2026). A typed birthday is the only check today. Texas has enforced age checks through Apple's Declared Age Range API (iOS 26+) since June 2026, and Utah and Louisiana are following, so plan for it.
- [ ] **Someone actually reads reports and answers them quickly,** with a plan for removing people, and contact details are published. Guideline 1.2 asks for both.
- [ ] **Crash reporting** (#18): pick Sentry, PostHog or EAS Observe. The app already has `mobile/src/utils/analytics.ts` and an error screen; plugging a provider in is one file.
- [ ] **Account deletion** inside the app: done (Settings → Delete account). Apple requires it.
- [ ] **Security:** `npm audit` reports 3 critical vulnerabilities in dependencies; check whether any ship in the app.

---

## Phase 5: App Store listing and submission (Elias, Kian)

- [ ] **Privacy policy and terms** on a public URL (not only inside the app). The in-app versions are English only; translate them or say so.
- [ ] **App Privacy labels** in App Store Connect. Popdate collects: photos, name, birthday, gender and who you want to meet, city, chat messages and answers, a device push token, and purchase history once paywalls exist. None of it is used for tracking across other companies' apps, so no tracking prompt is needed (as long as the analytics provider is set up without tracking).
- [ ] **Support URL** and contact email (`support@popdate.app` is in the app; make sure it receives mail).
- [ ] **Screenshots:** one set at 6.9" (1320×2868 or 1290×2796) is enough; App Store Connect scales it down for smaller iPhones. A 6.5" set is only needed if there's no 6.9" one. Check the screenshot page in App Store Connect when uploading. Light or dark mode; show the pop moment.
- [ ] **Description, keywords, subtitle,** and the age rating questionnaire (dating = 18+).
- [ ] **Review notes:** how to log in with the review account, how its rooms fill with bots, that rooms need six real people otherwise, and where report and block are. Mention that the queue-matched, one-chooser, five-balloon format is what makes it different from other dating apps (duplicate-app check, Guideline 4.3).
- [ ] **In-app purchases** attached to the version, each with its own review screenshot.
- [ ] Submit: `npx eas-cli@latest submit --platform ios` with the build, then "Add for Review" in App Store Connect.

Expect questions from review the first time; answer them in App Store Connect's Resolution Center.

---

## Phase 6: after launch

- [ ] Watch crashes and the playtest events (queue joined, lobby filled, room finished, match opened, first message, played again).
- [ ] Ship small fixes as over-the-air updates once EAS Update is set up (`npx eas-cli@latest update:configure`). JavaScript-only changes don't need a new review; anything with native code does.
- [ ] Keep enough people queuing at the same time. Kian's launch push decides whether rooms fill.

---

## Where things are

| | |
| --- | --- |
| App code | `mobile/src/` |
| Backend | `mobile/convex/` |
| Build profiles | `mobile/eas.json` |
| App config (bundle id, icon, permissions) | `mobile/app.json` |
| Checks | `npm run typecheck`, `npx expo lint`, `npm test` in `mobile/`; CI runs them on every pull request |
| Open issues | https://github.com/lassenothelfer-IMS/popdate/issues |
