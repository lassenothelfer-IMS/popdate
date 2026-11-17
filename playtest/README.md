# Playtest

Kevin runs this. It does not change the Convex backend.

The question for the night: do six fitting people finish a room, from queue to match, and want to play again?

Until Jonas's Convex branch is merged and deployed to the cloud, practice alone on `main`. The home screen can force your role, and bots fill the other seats. Phones cannot reach a Convex backend running only on someone's laptop.

## Practice alone (today, on `main`)

From `mobile/`:

```bash
npm install
npm start
```

Open the project in Expo Go. On the welcome screen, tap **Skip with a test profile**. That button exists in development builds only. It signs you in as a woman, 17 May 2000, who wants to meet men, and skips photo setup.

On Home, the mock role chips are **Random**, **Popper**, and **Balloon**.

1. Choose **Popper**. Tap **Play**. Wait until the lobby fills. You pick a question, read answers, see photos, and pop one balloon each round. After four pops, open the match and send a chat message.
2. Choose **Balloon**. Tap **Play** again. Answer before the timer ends. When your balloon is popped, try **Watch**, then **Leave**.
3. From the match chat, open the menu and **Report**, then **Block**. In Settings, confirm that person is on the blocked list. Unblock them.
4. Sign out. Run the skip-profile path once more, then delete the account from Settings and confirm you land back on onboarding.

Write what happened in a copy of [notes-template.md](notes-template.md).

## Game night (when Convex is in the cloud)

Agree a fixed window, for example 20:00–22:00. A room starts only when one popper and five contestants who match each other's preference are in the queue together.

People:

- Kevin runs the night and writes the notes.
- Kian brings the players. Aim for both men and women, otherwise the lobby never fills.
- Lasse has a phone on the same build.
- Jonas confirms the cloud URL is up. Nobody edits `mobile/convex/` during the night.

Each player needs the same build, pointed at that cloud backend (`EXPO_PUBLIC_API=convex` and `EXPO_PUBLIC_CONVEX_URL` in `mobile/.env.local`). The role chips on Home disappear once the app is not on the mock.

Script:

1. Everyone finishes a profile before 20:00. Six photos, name, age, gender, who they want to meet.
2. At 20:00 everyone taps Play and stays on the queue screen. Say the count out loud ("4 of 6") so a stuck lobby is obvious.
3. Play one full room. The popper pops once per round. Popped players may watch or leave.
4. The popper and the winner open the match and send one message each.
5. One player blocks another, then both queue again. They must not land in the same room.
6. Stop at 22:00 even if a second room is unfinished. Fill in the notes the same night.

## Watch for these

These are already visible in the code. Confirm them on a phone, then assign the issue to the owner. Do not fix them in someone else's folder.

| What you should see | Owner |
| --- | --- |
| Terms and Privacy on the welcome screen say they are not ready yet. The links are still empty. | Elias |
| Report and block exist on the match chat menu. They are not on a person inside the room, and messages have no long-press. | Elias |
| On `main`, other players are bots. A real room waits on Jonas's cloud deploy. | Jonas |
| Push permission can be asked. A token is not registered until the EAS project is finished. | Elias |

## Screen to server method

The phone calls `PopdateApi` in `mobile/src/api/types.ts`. On `main` those methods hit the in-memory mock. On Jonas's branch, `mobile/src/api/convex-server.ts` calls the Convex functions below. Screens do not change between the two.

| What you tap | App method | Convex function |
| --- | --- | --- |
| App opens | `signIn`, `getMyProfile` | `users.me`, `profiles.getMine` |
| Finish profile | `saveProfile` | `profiles.generateUploadUrl`, `profiles.saveProfile` |
| Play | `joinQueue` | `queue.joinQueue` |
| Queue screen | `watchQueue` | `queue.status` |
| Cancel queue | `leaveQueue` | `queue.leaveQueue` |
| Room screen | `watchRoom` | `rooms.get` |
| Popper picks a question | `pickQuestion` | `rooms.pickQuestion` |
| Contestant sends an answer | `postAnswer` | `rooms.postAnswer` |
| Popper pops | `popBalloon` | `rooms.popBalloon` |
| Watch, leave, or the popper quits | `leaveRoom` | `rooms.leaveRoom` |
| Home match list | `listMatches` | `matches.list` |
| Match screen | `getMatch` | `matches.get` |
| Chat | `watchMessages`, `sendMessage` | `chat.list`, `chat.send` |
| Report | `report` | `safety.report` |
| Block | `block` | `safety.block` |
| Blocked list, unblock | `listBlocked`, `unblock` | `safety.listBlocked`, `safety.unblock` |
| Settings | `getSettings`, `saveSettings` | `settings.get`, `settings.save` |
| Notifications | `registerPushToken` | `settings.registerPushToken` |
| Selfie check | `getVerification`, `submitSelfie` | `verification.get`, `verification.submitSelfie` |
| Sign out | `signOut` | `account.prepareSignOut` |
| Delete account | `deleteAccount` | `account.deleteAccount` |
