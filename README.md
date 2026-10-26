# Popdate MVP: full plan

Oct 23, 2026 · @Lasse

## What Popdate is

Popdate is a mobile dating game, iOS first and built with React Native: one popper and 5 contestants in a chat room, and the popper pops balloons until one contestant is left, who becomes the match. The popper can be a woman with 5 men or a man with 5 women. There are no hosts: the app fills every room from the queue.

It is built on the format of the viral YouTube and Netflix show "Pop the Balloon or Find Love", but as a live app anyone can join. The working title is Popdate. The MVP is the smallest version that proves the loop works with real people on real phones.

The MVP has to answer one question: **do 1 girl and 5 to 8 guys have fun playing a full room from start to match?**

## How the game works

Players queue like in an online game. As soon as a lobby of 6 is full, the game starts: 1 popper and 5 contestants, 4 rounds, 1 pop per round, and the last balloon is the match.

### Before the game: profile

Nobody can queue without a finished profile: 6 photos, name, age, gender, who they want to meet, and a few basic infos (city, height, job or school, a short bio). This works like any other dating app.

### The queue

1. The player taps "Play" and enters the queue.
2. The server builds lobbies of 1 popper + 5 contestants who fit each other: the contestants are the gender the popper wants to meet, and the popper is the gender they want to meet.
3. When a lobby is full, everyone in it is pulled into the room at the same time.
4. There are no hosts and nobody creates rooms. The app decides who goes into which room and who pops, based on who is queuing right now. That can be 1 woman popping 5 men or 1 man popping 5 women. Sometimes you are the popper, most of the time you hold a balloon.

### One round

Every round has the same three steps.

1. **Question:** the popper picks one personality question from a list (for example "What would your friends say is your worst habit?"). Every contestant still in the game answers in text.
2. **Photo reveal:** each remaining contestant's next profile photo is shown. Round 1 shows photo 1, round 2 shows photo 2, and so on.
3. **Pop:** the popper pops exactly one balloon. That contestant is out. They can choose to keep watching or leave the room, but they can no longer answer or interact.

### The end

With 5 contestants there are 4 rounds. After the 4th pop, one balloon is left, and that contestant and the popper become a match.

### Defaults to confirm

- Lobby size: 1 popper + 5 contestants
- Answer time: 60 seconds per question, then unanswered contestants show "no answer"
- Pop time: 30 seconds, after that the popper is reminded (no auto-pop)
- Before round 1, contestants show only first name and age, no photo
- If a contestant leaves mid-game, their balloon counts as popped and the round continues

## What the app does

The app has seven screens, all in React Native with Expo.

| Screen | Who sees it | What happens there |
| --- | --- | --- |
| Onboarding | Everyone, once | Sign in, birthday (18+ only), gender, who you want to meet, accept terms |
| Profile setup | Everyone, once | Upload exactly 6 photos in order, add name, city, height, job or school, bio. Can't queue until done. |
| Home | Everyone | Big "Play" button, your profile, your matches |
| Queue | Everyone | "Finding your lobby" with players found so far (for example 4 of 6). Cancel anytime. |
| Game room | Popper and contestants | Balloons on top, round number, current question, answers, revealed photos, timers |
| Popped view | Popped contestants | Your balloon is gone. Choose "Watch" (read-only) or "Leave". |
| Match screen | Popper and winner | "It's a match" with both first photos, then a chat (next version) |

**The popper's view in each round:** pick a question from the list, see all answers come in, see each contestant's new photo, tap one balloon to pop.

**A contestant's view in each round:** see the question, type an answer before the timer ends, see the other contestants' answers and photos, wait for the pop.

Report and block stay available on every person in the room (long-press).

## How it is built

The app is a thin React Native client. Matchmaking, roles, timers, photo reveals and pops all run on the Convex server, so the phone can never cheat.

- **Client:** React Native with Expo and TypeScript, Expo Router for navigation, the `convex` client for data and live updates, Convex Auth for sign-in. iOS first; the same code can ship to Android later.
- **Backend:** [Convex](https://convex.dev), in `mobile/convex/`. Its database, server functions, live queries, scheduled functions for the timers, and file storage for the photos.
- **Rule of the repo:** the app never decides roles, who is popped or which photo is shown. It only calls server functions.
- **Live by default:** a Convex query re-runs by itself whenever its data changes, so the room, the queue and the chat update on every phone without polling.
- **Photo privacy:** a contestant's photo N is only sent to people in the room once round N's answers are in.
- **Who checks what:** every server function checks who is calling; nothing trusts an id or a role sent by the phone.

### Tables

All tables are in `mobile/convex/schema.ts`.

| Table | Holds |
| --- | --- |
| `users` and the `auth…` tables | Accounts and sign-in sessions (Convex Auth) |
| `profiles` | Name, birth date, gender, wants to meet, city, height, job, bio, and the 6 photos in order (files in Convex storage) |
| `queue` | Who is waiting, since when, with which gender and preference, and the room they were matched into |
| `rooms` | Popper, status (picking, answering, popping, finished), round, current question and options, timer, winner, match |
| `roomPlayers` | The contestants per room, popped or not, left or not |
| `questions` | The personality question list the popper picks from |
| `answers` | One answer per contestant per round |
| `matches`, `messages` | The final popper and winner pair, and their chat |
| `settings`, `pushTokens` | Each player's settings and their phones' push tokens |
| `verifications` | Selfie reviews (pending, verified, rejected) |
| `reports`, `blocks` | Safety data |
| `uploads`, `rateLimits` | Who uploaded which file, and the counters that stop flooding |

### Server functions the app calls

`mobile/src/api/convex-server.ts` maps each method of `PopdateApi` (`mobile/src/api/types.ts`) to one of these.

| Function | What it does |
| --- | --- |
| `queue.joinQueue`, `queue.leaveQueue`, `queue.status` | Enter or leave the queue (only with a profile), and watch it live. Joining builds a lobby in the same step: 1 popper and 5 contestants who all want to meet each other's side, never two people who blocked each other. |
| `rooms.get` | The room as you may see it, live. Photo N only from round N, other answers hidden while people are still answering. |
| `rooms.pickQuestion` | Popper only. Sets this round's question and starts the 60-second answer timer. |
| `rooms.postAnswer` | Contestants still in the game, before the timer ends. |
| `rooms.popBalloon` | Popper only, once per round. Pops one, reveals the next photos, starts the next round or creates the match. |
| `rooms.leaveRoom` | The popper leaving ends the room. A contestant leaving counts as popped. |
| `matches.*`, `chat.*` | Your matches, and the chat between the popper and the winner. |
| `profiles.*`, `settings.*`, `verification.*` | Profile with 18+ check, settings, push token, selfie review. |
| `safety.*`, `account.*` | Block, unblock, report, sign out, delete account (everything, as Apple requires). |

The timers are scheduled functions (`rooms.answerTimeUp`, `rooms.popTimeUp`), set by the step that starts them. The pop timer only reminds the popper; there is no auto-pop. Answers and messages go through the server's profanity filter.

### Running the backend

The app talks to the in-memory mock unless you switch it to Convex.

1. `cd mobile`, then `npm run backend` (`npx convex dev`). The first time, it asks you to log in to Convex with GitHub and creates the project. Without a login, it runs a local backend on your computer.
2. Once: `npx @convex-dev/auth --web-server-url http://localhost:8081` sets the sign-in keys on the deployment.
3. Add `EXPO_PUBLIC_API=convex` to `mobile/.env.local` (next to the `EXPO_PUBLIC_CONVEX_URL` that step 1 wrote), then restart `npm start`.

For testing with fewer phones:

- `npx convex env set LOBBY_SIZE 3` makes rooms of 1 popper + 2 contestants. Back to 6 for real games.
- `npx convex env set ALLOW_TEST_PLAYERS true` and then `npx convex run testPlayers:add '{"count": 2, "gender": "man", "wantsToMeet": "woman"}'` add test players. Only on a dev deployment: test players look exactly like real people.
- `npm run test:backend` runs the backend tests.

A phone can't reach a local backend on your computer; use the cloud dev deployment for that.

## What each person does

Four people, four folders, one shared repo. Each person works with their own Claude Code and stays inside their folder.

### Jonas: backend (`mobile/convex/`)

- Create the Convex project and turn on auth
- Write the database: profiles, queue, rooms, players, questions, answers, matches, messages, settings, reports, blocks
- Write the server functions: queue, matchmaking, rounds, timers, pops, match, chat, safety, account deletion
- Set up photo storage so each photo unlocks only in its round
- Share the Convex project with the team (the app only needs its URL, which `npx convex dev` writes to `.env.local`)
- Later: admin view for reports and selfie reviews, and sending push notifications

### Lasse: mobile app (`mobile/`, except Safety)

- Create the Expo app (React Native, TypeScript) and connect it to Jonas's Convex backend
- Build onboarding and profile setup with 6 photo uploads (expo-image-picker)
- Build the home screen and the queue screen
- Build the game room: question picker, answers, photo reveals, timers, pop, watch or leave
- Build the match screen
- Test the full flow on real phones with an Expo development build

### Elias: App Store and safety (`docs/`, `mobile/src/features/safety/`)

- Set team and bundle ID in `mobile/app.json` and set up EAS Build
- Create the app in App Store Connect and upload the first TestFlight build with EAS Submit
- Write the privacy policy and terms, link them in onboarding
- Replace anonymous login with Sign in with Apple (expo-apple-authentication)
- Own the report and block UI and the App Store review answers

### Kian: marketing (`marketing/`)

- Pick the final name and logo
- Build a landing page with a waitlist
- Make TikTok and Reels content showing the pop moment
- Recruit both men and women early, because a room only fills when the right mix is queuing at the same time
- Find 10 to 15 guys for the first test rooms

## Safety and App Store requirements

Apple treats dating apps as high risk, and missing safety features is a common reason for rejection.

### Must be in the MVP

- 18+ gate at signup, also enforced by the database
- Report and block on every guest and every message (long-press)
- Blocked users are never put in the same room
- Basic profanity filter on all messages, on the server
- Terms checkbox in onboarding

### Still needed before submission (Elias and Jonas)

- Real privacy policy and terms, linked in the app
- Sign in with Apple, replacing anonymous login
- Someone actually reviewing the reports table, and a plan for removing bad users
- Selfie verification for everyone, so photos and gender are real before anyone can queue
- Age assurance, which Apple and Google both expect from dating apps in 2026
- A clear answer to Apple's duplicate-app check (Guideline 4.3): the queue-matched, one-popper, five-contestant elimination format is the difference

## Not in the MVP, and risks

The game is a text chat room with photos, not a livestream. The MVP skips everything that is not needed to test the core loop.

### Left out of the MVP

- Video or voice in rooms (text chat only)
- Chat between popper and winner after the match
- Push notifications when a room goes live
- Payments, premium features, profile photos
- Selfie verification and an admin view for reports
- Android and web releases (the React Native code can target Android later, but the MVP only ships and tests on iOS)

### Main risks

- **Queue size is the bottleneck:** a game needs 6 fitting people online at once. Early on, run fixed play times (for example 20:00 to 22:00) so lobbies fill fast.
- **Competition:** the original Pop the Balloon creators launched their own app, Luv or Pop, in beta since March 2026, and Meet Group holds patents on live dating formats. Check them before launch.
- **Group chat rooms are hard to keep fun at scale:** if answers are slow or boring, players leave mid-game. Timers and good questions matter.
- **Moderation:** guys can be rude in a chat, so reports must be reviewed fast.
- **Nothing is built yet.** If the build takes too long, cut the timers and the watch mode first.
