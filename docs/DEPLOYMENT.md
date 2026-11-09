# Getting Popdate onto the App Store

Status on 3 Nov 2026: the app works end to end on the mock server (bots) and passes typecheck, lint and 286 tests (265 app, 21 backend). It has **not** run against a real Convex deployment on a phone, and it isn't ready for review yet.

This is the order we go in. Each step says who owns it and what "done" means. Tick the boxes as you go.

| Phase | What | Owner |
| --- | --- | --- |
| 0 | Minor UI tweaks and paywalls | Lasse |
| 1 | Production backend on Convex | Lasse |
| 2 | Accounts, build and TestFlight | Lasse |
| 3 | Real playtest on phones | Everyone, Kian and Jonas recruit |
| 4 | Fixes Apple will check | Lasse |
| 5 | App Store listing and submission | Lasse, Kian |
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

### 0.2 Paywalls (Lasse)

Popdate sells something digital (features inside the app), so Apple requires **in-app purchase** through StoreKit (App Store Review Guideline 3.1.1). A card form inside the app is not allowed anywhere. A link or button to a website checkout is allowed only on the **US storefront** (since 2025); elsewhere it needs Apple's External Purchase Link entitlement, with its own fees in the EU and some other countries. Plan for in-app purchase everywhere and treat a US web link as an optional extra.

**The model: balloons (decided by Lasse 2026-11-06, built, numbers still open for the team).** Rooms cost balloons; the rules are in `mobile/src/shared/balloons.ts`, used by the server, the mock and the app alike:
- Joining the line needs at least one balloon.
- You lose one **only when yours gets popped**, or when you leave a room while still holding it. Winning keeps it, and the chooser never pays. A pop costs nothing if you never answered in that room (you may have closed the app while in line and been seated later).
- **3 free balloons a day**: they top back up at UTC midnight (1:00 or 2:00 in Zurich). A new account starts with **2 extra**.
- **Balloon packs** (consumables): `popdate.balloons.5` and `popdate.balloons.15`. Bought balloons never expire and are used after the free ones.
- **Popdate+** (subscription, entitlement `plus`): unlimited balloons. Room for more perks later (seeing who almost picked you, filters).
- Why this shape: every room needs six people, so the free refill keeps players coming back instead of leaving, and only losing costs a balloon.

Still to agree (whole team):
- [ ] The numbers: free per day, starter extra, pack sizes. Change them in `src/shared/balloons.ts`; the server reads the same file.
- [ ] Prices. Ideas: 5 balloons CHF 2.90, 15 for CHF 6.90, Popdate+ around CHF 7–10 a month with a cheaper yearly plan.
- [ ] Known gap: signing out and making a new profile gives a fresh starter wallet, because test accounts are anonymous. Sign in with Apple closes it.

Then build it:
- [ ] Sign the **Paid Apps agreement** in App Store Connect, under Business. First confirm the legal entity there ("Edit Legal Entity"), then accept the terms and fill in bank account, tax forms (W-8BEN for non-US individuals) and contacts. Banking and tax forms have to be complete before any purchase works, even in testing. *Submitted 2026-11-06: tax forms active, bank account and agreement processing.* For the W-8BEN treaty claim, app sales are usually business profits: Switzerland, Article 7, 0%, "Income from the sale of applications", no permanent establishment in the US.
- [ ] **EU later (decided 2026-11-04).** The EU storefront needs a Digital Services Act trader declaration under Business. A paid app means "trader", and Apple then shows the account holder's address, phone and email on the EU store page. Launch without the EU first; before adding it, get a business or c/o address and a separate app email and phone.
- [ ] Create the products (subscription group and/or consumables) in App Store Connect → the app → Monetization.
- [x] App record in App Store Connect: **Popdate: Dating Game** (`popdate` was taken), bundle ID `com.goodn8s.popdate`.
- [x] RevenueCat (agreed 2026-11-06): project "Popdate: Dating Game", App Store app connected with an In-App Purchase key (.p8, kept by Lasse only). The app side is in `mobile/src/utils/purchases.ts`: entitlement **`plus`**, the RevenueCat **Test Store** in development builds (fake products, no Apple needed) and the App Store everywhere else. Settings has a Popdate+ section with **Restore purchases**. Nothing is locked behind `plus` yet.
- [x] Balloons in the app and on the server (2026-11-06): the `balloons` table, spending on a pop in `convex/lib/room.ts`, the check in `joinQueue`, the live count on Home, and the balloon shop when you're out (Get in line, Play another room).
- [x] RevenueCat, Test Store (done 2026-11-07):
  - entitlement **`plus`** (Popdate+) with `popdate.plus.weekly` ($4.99), `popdate.plus.6months` ($29.99) and `popdate.plus.yearly` ($49.99). No monthly plan.
  - consumables `popdate.balloons.5` ($2.99) and `popdate.balloons.15` ($6.99), the ids in `src/shared/balloons.ts`.
  - offering **`default`** (current): `$rc_weekly`, `$rc_six_month`, `$rc_annual`, with the published paywall **Popdate+** (Settings → Get Popdate+).
  - offering **`balloons`**: `balloons_5`, `balloons_15` and `$rc_weekly`, with the published paywall **Balloon shop** (shown when you're out of balloons).
  - Both paywalls were made with RevenueCat's AI editor in Popdate's colours, have a close button, and link to the Terms and Privacy pages below. The headline uses the system font; upload Gloock in RevenueCat to use the serif.
  - Test Store prices are USD placeholders and can't be edited once saved: make new products to change them.
- [x] Terms and Privacy on GitHub Pages: https://lassenothelfer-ims.github.io/popdate/terms/ and https://lassenothelfer-ims.github.io/popdate/privacy/. Built from the app's own text (`site/build.mjs`) by `.github/workflows/pages.yml` whenever `legal-screen.tsx` changes. Use the privacy URL in App Store Connect too. Swap in Kian's website later if it gets its own pages.
- [ ] The same products in **App Store Connect** (the app → Monetization), with the **same product ids**: a subscription group "Popdate+" with the three plans, and the two consumables, with CHF prices. Then add each App Store product to the matching package in both offerings (the "Popdate: Dating Game (App Store)" slot) and attach the three plans to `plus`.
- [ ] RevenueCat webhook → Convex (Lasse), **once per Convex deployment** (dev now, prod again in phase 1):
  - Set `REVENUECAT_WEBHOOK_AUTH` on that deployment to its own long random string: `npx convex env set REVENUECAT_WEBHOOK_AUTH <value>` for dev, the same with `--prod` for production.
  - In RevenueCat → Integrations → Webhooks, add one webhook per deployment: `https://<that-deployment>.convex.site/revenuecat`, with that deployment's string as the Authorization header. The dev webhook gets **sandbox events only**; the prod webhook gets both, since TestFlight and App Review buy in sandbox but talk to prod. Set the prod webhook's app filter to the **App Store app only**.
  - On **dev only**: `npx convex env set ACCEPT_TEST_STORE true`. Without it a deployment records RevenueCat Test Store purchases but credits nothing, so free test buys can never become real balloons on prod.
  - Recommended on both: `REVENUECAT_SECRET_KEY` (RevenueCat → API keys → a **secret key for API v1**; `GET /v1/subscribers` doesn't take v2 keys). When a restore moves Popdate+ to another account (a TRANSFER), the server then asks RevenueCat what moved instead of guessing from what it stored.
  - Each deployment ignores accounts it doesn't know, and keeps those events in `purchaseEvents` (product, `environment`, RevenueCat ids) so a lost purchase can be credited by hand. A `SANDBOX` row is a test: never credit it as real.
  - Packs and Popdate+ only reach the server this way; the app is never trusted to add balloons.
- [ ] Apply for the **App Store Small Business Program** (15% instead of 30%), then turn it on in RevenueCat's App Store app settings.
- [ ] Rebuild the development build (`eas build --profile development --platform ios`): RevenueCat is native code, so the build from 2026-11-04 doesn't have it.
- [x] Backend: entitlements live on the server. `convex/http.ts` takes RevenueCat's webhook, `convex/balloons.ts` applies each event once (packs add balloons, Popdate+ events set `plusUntil`). A restore on another account (RevenueCat's TRANSFER event) moves Popdate+ along. PRODUCT_CHANGE is ignored on purpose: the new plan's RENEWAL carries its expiration. Not handled yet: refunds of packs.
- [ ] The paywall screen must show the price, the billing period, what's included, **Restore purchases**, and links to the terms and privacy policy (Guideline 3.1.2 for subscriptions).
- [ ] Test with Sandbox Apple accounts (App Store Connect → Users and Access → Sandbox), including buy, cancel, renew and restore on a second phone.

Done when: a sandbox account can buy, the feature unlocks on the server, and restore works after reinstalling.

---

## Phase 1: production backend (Lasse)

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
- [ ] Production environment variables (Convex dashboard → Settings → Environment Variables): leave `LOBBY_SIZE`, `ALLOW_TEST_PLAYERS` and `ACCEPT_TEST_STORE` **unset** in production, so rooms need six real people, fake test players can't be added, and Test Store purchases count for nothing.
- [ ] Check the scheduled jobs run (Convex dashboard → Schedules → Cron jobs, from `convex/crons.ts`): the queue sweep every minute, the sweep of unsaved uploads every hour, the purge of ended chats every day.
- [ ] Set `REVENUECAT_WEBHOOK_AUTH` with `--prod` and add the production webhook in RevenueCat (see 0.2). Without it, real purchases never reach production: nobody gets their balloons or Popdate+.
- [ ] Seed the questions table if production starts empty (same way as on dev).
- [ ] Run the backend tests against the code being deployed: `npm run test:backend`.
- [ ] Decide who reviews reports and selfies, and how. Today a selfie is approved by hand:
  ```bash
  npx convex run verification:review '{"userId": "...", "status": "verified"}' --prod
  ```
  That's fine for a beta, not for launch (see phase 4).

Done when: the production URL exists, auth works, and a test sign-in from a dev build creates a user you can see in the dashboard.

---

## Phase 2: accounts, build and TestFlight (Lasse)

### 2.1 Accounts

- [ ] Apple Developer Program membership ($99 a year, plus VAT where it applies). **Lasse, Kian, Jonas and Kevin split it four ways: about $25 each a year.** One person has to be the Account Holder: they sign Apple's agreements, pay with their card, and are the only one who can renew or accept new terms, so agree who that is and settle the shares with them. The others get access through App Store Connect → Users and Access.
  - Individual account: quickest, but the App Store shows the Account Holder's own legal name as the seller, and the account can't be handed to someone else later.
  - Organisation account: shows a company name, can add and remove people as the team changes, and is better for a dating app. It needs a registered company (or association) with a D-U-N-S number, which takes days to weeks.
  - Paywall earnings (phase 0.2) are paid to the Account Holder's bank account, so decide how they're shared before the first sale.
- [x] **EAS project on a team account.** Done 3 Nov 2026: the project is now `@goodn8s-team/popdate` (id `6d969a16-8f03-40b0-ab56-6b10f2695343`), owned by Lasse's Expo organization `goodn8s-team`, instead of Elias's account `elihhh`. Any builds or credentials made on the old project stay there; new ones are made on this one.
- [ ] For now only Lasse is in the `goodn8s-team` organization and runs the builds. When someone else needs to, invite them on expo.dev (Account settings → Members) with the Developer role or higher.
- [ ] App Store Connect: create the app with bundle id **`com.goodn8s.popdate`** (already in `app.json`; `com.popdate.app` was taken), SKU, and primary language.

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

## Phase 3: real playtest (everyone, Kian and Jonas recruit)

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
- [ ] **Sign in with Apple** instead of anonymous accounts (Lasse). Apple doesn't require it for us: Guideline 4.8 only applies when an app offers a login like Google or Facebook, and Popdate has none. We want it because today, deleting the app loses the profile. If we ever add Google or Facebook login, it becomes required. Needs the `expo-apple-authentication` package and the "Sign In with Apple" capability for the bundle id (`ios.usesAppleSignIn: true` in `app.json`).
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

## Phase 5: App Store listing and submission (Lasse, Kian)

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
