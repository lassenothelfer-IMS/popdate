# Backend review, 6 Nov 2026

A full review of `mobile/convex` found 39 confirmed problems; a second agent checked each one. They're listed most severe first, each with the reviewer's suggested fix.

**Status, 7 Nov 2026:** 1 to 18 (the high and medium ones) are fixed, each with a backend test in `convex/game.test.ts`. A second review of those fixes found 14 more problems in them, all fixed too. The biggest one: iOS pauses the app in the background, so the queue now keeps someone who locked their phone for up to 10 minutes as a contestant, but only lets someone who checked in within the last 90 seconds be the chooser. 19 to 39 (low) are still open; 7, 19 and 23 of them partly overlap what's fixed (photos of blocked people, rows of deleted accounts).

## 1. ✅ Fixed. [high] Waiting queue rows never expire and are never checked again, and matchmake builds each lobby around the oldest waiting row (`first`). In a straight lobby that row is the only possible chooser, so an abandoned row becomes the popper of a room of five real players. Rows only go away through leaveQueue, prepareSignOut or deleteAccount. There is no crons.ts and no TTL. On a cold start, app/index.tsx sends a queued player to /home and leaves their row waiting.

`mobile/convex/queue.ts:170` (lens: queue)

**Fix:** Smallest fix: the queue screen pings the server while it is open, and matchmaking drops rows that stop pinging.

1. **schema.ts:** add `seenAt: v.optional(v.number())` to the `queue` table.
2. **queue.ts, joinQueue:** set `seenAt: Date.now()` in `entry`.
3. **queue.ts, new mutation:** add `pingQueue`. It finds the caller's row via `by_user` and, if the row has no `roomId`, patches `seenAt: Date.now()`.
4. **queue-screen.tsx:** while `status.state === 'searching'`, call `api.pingQueue()` every 20-30 s with a `setInterval` in `FillingRoom`. Also add the method to src/api/types.ts, convex-server.ts and mock-server.ts.
5. **queue.ts, matchmake:** filter the list before the `for (const first of waiting)` loop, and loop over `fresh` instead of `waiting`:
```ts
const cutoff = Date.now() - 90_000;
const fresh = [];
for (const row of waiting) {
  if ((row.seenAt ?? row.joinedAt) < cutoff) await ctx.db.delete(row._id);
  else fresh.push(row);
}
```
6. **queue.ts, stats/status:** apply the same `seenAt` cutoff as a filter only, since queries can't delete.

Optional extra safeguard: in `pickTimeUp`, if `room.round === 1` and the popper never picked, end the room with `finish(ctx, roomId, { withWinner: false })` before any contestant is charged.

## 2. ✅ Fixed. [medium] Blocking someone doesn't cut off their access to you. matches.list/get, chat.list and rooms.get never check blocks, so the blocked person keeps a live view of the blocker's current name, age and photos, plus the whole chat history. The blocker also still sees the blocked person in their own Matches. The app's Block action (src/features/chat/person-actions.tsx:108) only calls safety.block and never unmatches.

`mobile/convex/matches.ts:22` (lens: authz)

**Fix:** Use the existing isBlockedEitherWay helper (lib/people.ts:33) on each read path:

1. **matches.ts list:** after sorting, keep only matches where `!(await isBlockedEitherWay(ctx, userId, otherId))`. Here otherId is the popperId or winnerId that isn't userId.
2. **matches.ts get:** return null when isBlockedEitherWay is true.
3. **chat.ts list:** right after requireMyMatch, return [] when `isBlockedEitherWay(ctx, userId, otherId)` is true. Leave the check inside send as it is, so the existing test's error message "You can't message this person anymore." still holds.
4. **lib/room.ts roomView:** for the popper card and for each contestant seat, set photos to [] when isBlockedEitherWay(viewerId, thatUserId) is true. For the popper, use `blocked ? {...card, photos: []} : card`. The queue already keeps blocked pairs apart, so this only affects rooms played before the block, or a block made during a room.
5. **safety.ts listBlocked:** return photo '' when the reverse block row exists, meaning blockerId = block.blockedId and blockedId = userId.

This also lets an unblock restore the chat, which is what the mock contract test expects (mock-server.test.ts:262-263). Add one convex-test that blocks after a match and asserts all of these:
- matches.list is empty for both people
- chat.list returns []
- rooms.get has no photos for the other person
- listBlocked has no photo after a mutual block

That test closes GitHub issue #7 along with the three extra leaks.

## 3. ✅ Fixed. [medium] applyPurchaseEvent credits balloon packs and Popdate+ without ever checking event.environment, and docs/DEPLOYMENT.md tells you to send SANDBOX events to the prod webhook. Free sandbox purchases therefore become real entitlements on production. The comment on purchaseEvents.environment in schema.ts says the opposite: a test purchase must never be credited as a real one.

`mobile/convex/balloons.ts:90` (lens: authz)

**Fix:** 1. In http.ts, pass `store: typeof event.store === 'string' ? event.store : undefined` to applyPurchaseEvent.
2. In applyPurchaseEvent (balloons.ts), skip both addBalloons and setPlusUntil when `event.store === 'TEST_STORE' && !process.env.ALLOW_TEST_STORE`, but still insert the purchaseEvents row so the event counts as seen.
3. Set ALLOW_TEST_STORE on dev only.
4. Keep crediting App Store SANDBOX, so App Review and TestFlight purchases still work.
5. Also set the prod webhook in RevenueCat to the App Store app only, and add that to DEPLOYMENT.md:64.

## 4. ✅ Fixed. [medium] finish() creates the match and sends both people an "It's a match" push without checking blocks. The room screen lets anyone block someone mid-game, and the room carries on, so a room can end with a match between two people where one has blocked the other.

`mobile/convex/lib/room.ts:169` (lens: game)

**Fix:** In `finish()` (mobile/convex/lib/room.ts), skip the match and the push when either person has blocked the other. Keep `winnerId`, so history still shows the contestant as the winner. `matchId` stays undefined, which the client already handles: there's no handoff, as in the unmatch case.

```ts
import { ageFromBirthDate, getProfile, isBlockedEitherWay, personCard, photoUrls } from './people';
...
const winner = withWinner ? (await seatsOf(ctx, roomId)).find(stillIn) : undefined;
const blocked = winner ? await isBlockedEitherWay(ctx, room.popperId, winner.userId) : false;
let matchId: Id<'matches'> | undefined;
if (winner && !blocked) {
  matchId = await ctx.db.insert('matches', { ... });
  await schedulePush(ctx, [room.popperId, winner.userId], { ... });
}
```

Add a test to game.test.ts for this case: Luca blocks Lena mid-room, Lena pops Noah, then check that `room.matchId` is null and `luca.as.query(api.matches.list)` returns an empty list.

## 5. ✅ Fixed. [medium] A chooser who never shows up still gets a full game played for them by the timers. Queue rows never expire, so someone who backgrounded or killed the app while waiting can be drawn as chooser. pickTimeUp then picks every question and popLimitUp pops a random balloon every round. pop() charges each of those contestants a balloon because they answered, and the last one is matched with a chooser who was never there.

`mobile/convex/rooms.ts:188` (lens: game)

**Fix:** Record whether the popper has ever acted in the room, and close a room nobody chose in instead of letting the timer pop.
- schema.ts rooms: add `popperActed: v.optional(v.boolean())`.
- rooms.ts pickQuestion and popBalloon: `await ctx.db.patch(room._id, { popperActed: true })`.
- rooms.ts popLimitUp, before the random pop:
`if (!room.popperActed) { await finish(ctx, roomId, { withWinner: false }); return; }`
The room then ends after round 1 (about 2.5 minutes) with no balloons spent and no match. A popper who is there but slow is unaffected, because any pick or pop sets the flag. Expiring stale queue rows (a heartbeat or a max wait) would stop the ghost from being seated at all, but that is a bigger change.

## 6. ✅ Fixed. [medium] deleteAccount never deletes the `answers` rows, but the in-app privacy policy (src/features/settings/legal-screen.tsx:76) says deleting your account deletes your answers, and the README says deletion removes everything. The answer text is also still shown to the other players.

`mobile/convex/account.ts:44` (lens: account)

**Fix:** 1. In schema.ts, add an index on `answers`: `.index('by_user', ['userId'])`.
2. In account.ts:65, add the table to the existing loop: `for (const table of ['settings', 'pushTokens', 'balloons', 'answers'] as const)`.

This is safe even for a room that is still running. It runs after stepOut, so the user's seat is already popped or left. endAnsweringIfEveryoneAnswered only counts seats that are still in, and pop() never runs again on that seat.

Also extend the deletion test in game.test.ts to check that Luca has no `answers` rows left.

The other option is to change the policy text, but the text would still be stored next to a deleted user, so deleting is the better fix.

## 7. ✅ Fixed. [medium] Photos and selfies are uploaded to _storage before any mutation records an owner. Every upload that is never saved stays in storage with no `uploads` row and no reference, so neither deleteAccount nor anything else can ever delete it.

`mobile/src/api/convex-server.ts:150` (lens: account)

**Fix:** Add a sweep on the server, because client-side cleanup cannot cover a network drop or the user quitting the app. Create mobile/convex/crons.ts that runs an internalMutation every hour (crons.interval('sweep unclaimed uploads', { hours: 1 }, internal.uploads.sweep)). The sweep pages through ctx.db.system.query('_storage') in _creationTime order and stops at files newer than a grace period, for example 24 h. For each older file it checks ctx.db.query('uploads').withIndex('by_storage', q => q.eq('storageId', file._id)).unique() and calls ctx.storage.delete(file._id) when there is no row. This is safe because every referenced file has an `uploads` row: profile photos and selfies get one through claimImage, and test players get one through testPlayers.ts:57. Optional client-side pairing: in ConvexServer, drop a pendingUploads entry when saveProfile fails with 'A photo did not upload', so a photo that sat unsaved past the grace period gets uploaded again rather than reusing an id that was swept.

## 8. ✅ Fixed. [medium] After a Popdate+ subscriber deletes their account, a RevenueCat TRANSFER into the new account does nothing. deleteAccount deleted both the users row and the wallet holding plusUntil, so accountOf(transferredFrom) returns null and transferPlus is skipped. The delete dialog also never says that Apple billing continues.

`mobile/convex/balloons.ts:77` (lens: account)

**Fix:** Keep the Popdate+ end date through the delete, and let TRANSFER read it:

(a) In `account.ts` `deleteAccount`, take `'balloons'` out of the table loop. If the wallet row has `plusUntil > Date.now()`, keep it and patch it down to the subscription fields only (`free: 0, extra: 0`; `plusUntil` and `plusEventAt` stay). Otherwise delete it as now.

(b) In `balloons.ts`, find the TRANSFER source without requiring the users row:
`const from = (event.transferredFrom ?? []).map((id) => ctx.db.normalizeId('users', id)).find((id) => id !== null) ?? null;`
`transferPlus` and `walletRow` then find the kept row through the `by_user` index. After the transfer, delete that row if `ctx.db.get(from)` is null. When nothing could be moved, also store `revenueCatIds: event.transferredFrom` on the `purchaseEvents` row so it can be credited by hand.

(c) Add a line to `settings.deleteBody` in all four locales saying Popdate+ keeps billing through Apple until it is cancelled under Manage subscription.

(d) Add a `game.test.ts` case: RENEWAL for noah, then `deleteAccount` as noah, then TRANSFER from noah to luca. Expect `balloons(luca).plus` to be true.

Another fix: when the TRANSFER source is unknown, schedule an internal action that calls RevenueCat's `GET /v1/subscribers/{to}` and sets `plusUntil` from the `plus` entitlement's `expires_date`. This needs a secret RevenueCat API key in Convex.

## 9. ✅ Fixed. [medium] deleteAccount, and unmatch in matches.ts:50, read and delete every message of a match in a single mutation. A busy or flooded chat therefore goes past Convex's per-transaction limits (32,000 documents scanned, 16 MiB read, 16,000 documents written; checked against docs.convex.dev/production/state/limits). After that the account can never be deleted and the match can never be unmatched.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\account.ts:107` (lens: perf)

**Fix:** In `unmatch` and in `deleteAccount`'s match loop:
1. Delete only the match document right away. With the match gone, `requireMyMatch` rejects every later `chat.send` and `chat.list` call, so the messages are already unreachable.
2. Then call `ctx.scheduler.runAfter(0, internal.matches.purgeMessages, { matchId })`.

Add `purgeMessages` to `matches.ts`:

```ts
export const purgeMessages = internalMutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, { matchId }) => {
    const batch = await ctx.db
      .query('messages')
      .withIndex('by_match', (q) => q.eq('matchId', matchId))
      .take(500);
    for (const m of batch) await ctx.db.delete(m._id);
    if (batch.length === 500) {
      await ctx.scheduler.runAfter(0, internal.matches.purgeMessages, { matchId });
    }
  },
});
```

Each batch of 500 stays far below the per-transaction limits. Convex allows up to 1,000 scheduled functions per mutation, which is far more than any user's match count.

## 10. ✅ Fixed. [medium] Matchmaking only looks at the 500 oldest unmatched queue rows (take(MAX_WAITING)), and nothing ever expires a row: there is no cron, and rows leave only through the Cancel button, a match, or sign-out. Once the oldest 500 rows cannot form a lobby among themselves, everyone who joins later is invisible to matchmaking for good.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\queue.ts:16` (lens: perf)

**Fix:** 1. **Always consider the joiner.** In `joinQueue`, pass the row you just inserted or replaced into `matchmake(ctx, mine)`. In `matchmake`, add it to `waiting` when it isn't already there (`if (!waiting.some(r => r._id === mine._id)) waiting.push(mine)`). Do the same in `status` so `roomReach` reflects what matchmaking actually sees.
2. **Stop abandoned rows from piling up.** Add `lastSeenAt: v.number()` to `queue` and an index `['roomId', 'lastSeenAt']`. Add a `pingQueue` mutation that the queue screen calls about every 30 seconds while searching. Add `convex/crons.ts` with an `interval` cron, running every minute, that deletes unmatched rows whose `lastSeenAt` is older than about 2 minutes (bounded `take`, run again if more are left).

Later, if the queue grows, query candidates per compatible gender bucket (index `['roomId', 'gender', 'joinedAt']`) instead of one global oldest-500 window.

## 11. ✅ Fixed. [medium] When no lobby forms, matchmake loads the blocks of every waiting player: blocksOf(first) runs for each of up to 500 rows, with both directions collected unbounded. A joinQueue's read set therefore grows with the total block rows of the whole queue, and scripted mutual blocks can push every joinQueue past the 32,000-documents-scanned limit.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\queue.ts:172` (lens: perf)

**Fix:** In `matchmake`, stop collecting each player's whole block list. Check blocks only between the members of the group being built, using the existing `by_pair` index:

```ts
const blocked = async (a, b) => (await ctx.db.query('blocks').withIndex('by_pair', q => q.eq('blockerId', a).eq('blockedId', b)).first()) !== null;
```

Then:
1. Before reading anything from the database, skip `first` if fewer than `lobbySize() - 1` waiting rows fit it. In the common "no lobby possible" case, matchmaking then reads no blocks at all.
2. When adding a candidate, run `blocked(candidate, m) || blocked(m, candidate)` for each current group member `m`. That is at most 10 point lookups, each reading at most one document. Cache the results per pair.
3. Remove `blockLookup`.
4. Add a small budget on these lookups per run, for example 1,000. If the budget runs out, the queue stays as it is until the next join.

Cost then depends on group size, not on how many block rows anyone has, so the per-transaction scan limit can no longer be reached.

## 12. ✅ Fixed. [medium] Every joinQueue reads the whole waiting range, plus about 2 block queries per waiting player, and then writes into that same range. Concurrent joinQueue, leaveQueue and saveProfile calls by waiting players therefore always conflict under OCC. Joins serialize globally and start failing under burst load.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\queue.ts:167` (lens: perf)

**Fix:** Take matchmaking out of the joinQueue transaction.
1. Turn `matchmake` into `export const matchmake = internalMutation({ args: {}, handler: async (ctx) => { ...current body... } })`.
2. In joinQueue, replace `await matchmake(ctx);` with `await ctx.scheduler.runAfter(0, internal.queue.matchmake, {});`.

After that, joinQueue reads only the caller's own row, profile, balloons and rate-limit doc. Joins no longer conflict with each other or fail with an error the player sees. Convex runs a scheduled mutation exactly once and retries it automatically (convex/src/server/scheduler.ts:37-38), so the matchmaker absorbs the contention. Clients already learn about a match through the reactive `status` query.

To shorten each matchmake run, filter `waiting` with `fits()` first. Skip any `first` with fewer than lobbySize()-1 fitting candidates before calling blocksOf.

In game.test.ts, run the scheduled matchmaker after each joinQueue: use fake timers and `t.finishInProgressScheduledFunctions()`, or call `internal.queue.matchmake` directly.

## 13. ✅ Fixed. [medium] Uploaded files are recorded only when saveProfile or submitSelfie claims them. Nothing ever deletes uploads that are never claimed, and there is no sweep or `uploads` row for them. Storage grows without bound, and a player's photos can outlive their account.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\lib\uploads.ts:12` (lens: perf)

**Fix:** Add mobile/convex/crons.ts. Have it run an hourly internalMutation that does the following:
- Reads `ctx.db.system.query('_storage').withIndex('by_creation_time', q => q.gt('_creationTime', watermark).lt('_creationTime', Date.now() - 24h))`, in batches of 100–200 or so.
- For each file, looks up an `uploads` row via the existing `by_storage` index. If there is none, it calls `ctx.storage.delete(file._id)`.
- Saves the last `_creationTime` it processed as the watermark in a one-row table, so later runs scan only new files.

Every file that is in use already has an `uploads` row (claimImage and testPlayers insert one), so this deletes only unclaimed files:
- removed picks,
- abandoned onboarding,
- failed claims,
- orphans of deleted accounts.

It needs no client change and no owner field on uploads.

There is one small edge case on the client. If a claim fails because a pending upload is older than the cutoff and was already swept, convex-server.ts should drop that entry from `pendingUploads`, so the next save uploads the photo again.

## 14. ✅ Fixed. [medium] Blocking someone you matched with hides nothing. `matches.list`, `matches.get` and `chat.list` never check `blocks`, so the person you blocked comes back in your Matches, and they keep your name, photo and the whole chat.

`mobile/convex/matches.ts:22` (lens: safety)

**Fix:** Filter blocked matches when reading instead of deleting anything, so unblocking from Settings brings the match back:

1. mobile/convex/matches.ts `list`: after collecting, keep only matches where `!(await isBlockedEitherWay(ctx, userId, otherId))`, with `otherId = match.popperId === userId ? match.winnerId : match.popperId`. Import the helper from ./lib/people.
2. mobile/convex/matches.ts `get`: return null when `isBlockedEitherWay(ctx, userId, otherId)`. chat-screen.tsx already handles a null `getMatch`.
3. mobile/convex/chat.ts `list`: after `requireMyMatch`, return [] when `isBlockedEitherWay(ctx, userId, otherId)`. This covers a stale deep link or push that still points at the chat.
4. Make the same change in the mock (`listMatches`/`getMatch` in mobile/src/api/mock-server.ts using `this.isBlocked(match.other.id)`) so the two stay in step.
5. Add a game.test.ts case: block, check that `matches.list` is empty for both sides, unblock, check that the match comes back.

## 15. ✅ Fixed. [medium] A harasser can erase the evidence and dodge reports. Either person's unmatch, or deleting their account, hard-deletes every message for both people. A report records no match or room. Reporting a deleted account fails with "That person doesn't exist."

`mobile/convex/matches.ts:43` (lens: safety)

**Fix:** 1. In `safety.report`, use a check that does not require the row to exist. Keep `normalizeId('users', userId)` (fail if null) and the self-check, and drop the `ctx.db.get` requirement. `v.id('users')` validates the format only, so inserting a deleted user's id works.
2. Add optional `matchId: v.id('matches')` and `transcript: v.array(v.object({ senderId, text, sentAt }))` to `reports`. In `report`, look up the match between `me` and `reportedId` (`by_popper`/`by_winner`) and copy its newest messages (for example up to `CHAT_LIMIT`) into the row.
3. Keep evidence through an unmatch or deletion. Before deleting in `matches.unmatch` and in `deleteAccount`'s match loop, copy the messages into a small `endedChats` table: `{ aId, bId, matchId, messages, endedAt }`, indexed by the pair. Have `report` fall back to that table when no live match exists, and purge rows older than about 30 days with a daily cron (`crons.ts`). The chat still disappears for both people as the UI promises, but the team keeps a time-limited copy for review.

## 16. ✅ Fixed. [medium] The selfie is never deleted after review, although the app says it is compared to photo 1 "and then deleted". `review` only changes the status, so the stored file stays until the user sends another selfie or deletes their account.

`mobile/convex/verification.ts:62` (lens: safety)

**Fix:** Smallest fix: in mobile/convex/verification.ts `review`, delete the file once the decision is made.

```ts
if (row) {
  await deleteImage(ctx, row.selfie);
  await ctx.db.patch(row._id, { status });
}
```

`deleteImage` already copes with a file that is gone: it checks `ctx.db.system.get` before `storage.delete` and deletes the `uploads` row only if one exists. Convex does not enforce that a stored `_storage` id still points at a file. So the later `deleteImage(row.selfie)` calls are safe no-ops: the one in `submitSelfie` after a rejection, and the one in `account.ts` on account deletion. The reviewer still sees the selfie in the dashboard before running `review`.

Cleaner variant: make `selfie: v.optional(v.id('_storage'))` in schema.ts. In `review`, patch `{ status, selfie: undefined }`. Guard the two existing `deleteImage(row.selfie)` calls with `if (row.selfie)`.

## 17. ✅ Fixed. [medium] Production credits every SANDBOX event as a real purchase. http.ts never reads `store`, and applyPurchaseEvent never checks `environment`, which it only stores. DEPLOYMENT.md sets the prod webhook to send sandbox events for every app in the project, and RevenueCat's Test Store docs say Test Store purchases are 'reported as sandbox data'. So free Test Store and TestFlight purchases turn into real packs and real Popdate+ on prod.

`mobile/convex/balloons.ts:93` (lens: payments)

**Fix:** In convex/http.ts, before calling runMutation, drop Test Store events unless the deployment opts in:
`if (event.store === 'TEST_STORE' && process.env.ACCEPT_TEST_STORE !== 'true') return new Response(null, { status: 200 });`
Then run `npx convex env set ACCEPT_TEST_STORE true` on dev only.

Alternatively, pass `store` through to applyPurchaseEvent so the event is still recorded in purchaseEvents, just without calling addBalloons or setPlusUntil.

Belt and braces: in DEPLOYMENT.md step 0.2, set the prod webhook's app filter to the App Store app only, not "all apps".

## 18. ✅ Fixed. [medium] TRANSFER copies whatever plusUntil the server has stored for the source account. It does not use what RevenueCat actually moved. A source that is missing, stale, or unrelated to the moved purchase gives the wrong result, and the TRANSFER is still recorded as handled, so it is never retried.

`mobile/convex/lib/balloons.ts:78` (lens: payments)

**Fix:** Stop copying the stored plusUntil. Get the truth from RevenueCat. In http.ts, inside the httpAction (it can call fetch), when event.type === 'TRANSFER', call GET https://api.revenuecat.com/v1/subscribers/{encodeURIComponent(id)} with `Authorization: Bearer ${process.env.REVENUECAT_SECRET_KEY}`. Do this for the first Popdate id in transferred_to and the first in transferred_from. Read `subscriber.entitlements.plus.expires_date`: a date string becomes its epoch ms, null means lifetime, and a missing entitlement means none. Pass the results to applyPurchaseEvent as new args `plusUntilTo` and `plusUntilFrom`. If a fetch fails, return a 500 before running the mutation, so RevenueCat retries instead of the event being recorded as handled. In applyPurchaseEvent's TRANSFER branch, replace transferPlus with:
- `if (to) await setPlusUntil(ctx, to, plusUntilTo ?? 0, eventAt)`
- `if (from) await setPlusUntil(ctx, from, plusUntilFrom ?? 0, eventAt)`

This no longer needs the source row: a deleted account works, and so does a TRANSFER whose receipt held only a pack. Optionally, use the same lookup for the other Plus events too, which would also cover the late-retry case.

## 19. [low] A contestant who leaves before answering still gets that round's photo revealed. leave() records poppedInRound = room.round, and photoCount = min(revealed, poppedInRound) then unlocks photo N once round N reaches popping, even though they never played round N.

`mobile/convex/lib/room.ts:247` (lens: authz)

**Fix:** Store the cap at leave time. Add an optional field `photosShown: v.optional(v.number())` to roomPlayers in schema.ts. In leave(), add `photosShown: room.status === 'popping' ? room.round : room.round - 1` to the patch at room.ts:213. In roomView line 247, use `Math.min(revealed, seat.photosShown ?? seat.poppedInRound ?? 0)`. Make the same change in mock-server.ts leaveRoom and toView. Leave poppedInRound and leftInRound as they are, because history, second chances and the 'left in round N' label read them. For the finished-room variant, record the reveal count when a room ends outside popping (or keep the status it had before finishing) and use that instead of room.round.

## 20. [low] A room that ends early is treated as if round N was played: for status 'finished', revealed = room.round. If the popper leaves (or the room runs out of questions) during round N picking or answering, photo N of every contestant still in unlocks, though round N's answers never came in.

`mobile/convex/lib/room.ts:237` (lens: authz)

**Fix:** Record how many photos are out when it happens, instead of working it out from the status afterwards:
- In convex/schema.ts, add `revealed: v.optional(v.number())` to `rooms`.
- In startPopping (lib/room.ts), patch `revealed: room.round` together with `status: 'popping'`.
- In roomView, replace lines 237-238 with `const revealed = room.revealed ?? 0;`.

During picking and answering in round N this still gives N-1, and a room that finished from a pop still shows N. A room the popper leaves in round N picking or answering, or one that runs out of questions, now shows only the N-1 photos that really unlocked. Make the same change in src/api/mock-server.ts toView/startPopping so the two stay in sync. Then add one assertion to game.test.ts: after the popper leaves at round 1 picking, `contestants.every(c => c.photos.length === 0)`.

## 21. [low] The RevenueCat app user id is the Convex users id, and the backend gives that id to everyone you share a room or match with: contestant id, popper id, and Match.other.id. RevenueCat's public SDK key ships in the app, and with it anyone who knows an app user id can read that customer from RevenueCat, so room-mates can see your purchase history.

`mobile/src/state/session.tsx:91` (lens: authz)

**Fix:** Stop using the Convex users id as the RevenueCat app user id. Give each account a random id that only its owner ever sees:
1) Schema: add a table purchaseIds { userId: v.id('users'), rcId: v.string() } with indexes by_user and by_rc_id.
2) Add a mutation users.purchasesId (requireUserId). It returns the existing row's rcId, or inserts a new one with crypto.randomUUID() and returns that.
3) In session.tsx:91, call setPurchasesUser(await api.getPurchasesId()) instead of setPurchasesUser(userId). Keep identify(userId) for analytics.
4) In balloons.ts accountOf, look each id up in purchaseIds.by_rc_id first. Keep the current normalizeId('users', id) path as a fallback for customers already logged in under a raw users id. Delete the purchaseIds row when the account is deleted.
Room views and matches can keep exposing users ids, because RevenueCat no longer knows them.

## 22. [low] deleteAccount deletes only the files that profile.photos and the verification row point to. Files the user uploaded but never saved have no `uploads` row (claimImage writes it only on save), so they stay in storage after the account is gone. That includes photos picked and then removed in the form, and a selfie whose submit failed.

`mobile/convex/account.ts:50` (lens: authz)

**Fix:** Backend only, catching every path including app crashes: add mobile/convex/crons.ts with an hourly internalMutation. It pages through `ctx.db.system.query('_storage')` for files older than 2 hours. The upload URL is short-lived and the 2-hour margin covers a save still in progress. For each such file with no row in `uploads.by_storage`, it calls `ctx.storage.delete(file._id)`. To keep each run small, it can store a cursor, or only look at the `_creationTime` window since the last run. A deleted account's unsaved uploads are then gone within hours of deletion.

An optional extra makes the cleanup immediate: add a `by_owner` index to `uploads`, have the client register each upload right after the POST with a small mutation that inserts the `uploads` row, and have `deleteAccount` delete every `uploads` row where `ownerId` is that user, together with its file.

## 23. [low] postAnswer and popBalloon don't send the round they were made for. The Convex client keeps mutations queued while it is offline and resends them on reconnect (RequestManager.restart/resume), so a request sent during a connection drop applies to whatever round is in that phase when it finally arrives.

`mobile/convex/rooms.ts:120` (lens: game)

**Fix:** Send the round each call was made for, and reject it once the room has moved on.

Server (rooms.ts):
- Add `round: v.number()` to the args of postAnswer and popBalloon, and to pickQuestion too.
- After requireRoom, add: `if (room.round !== round) fail('That round is over.');`
- If builds without the field are already in testers' hands, use `v.optional(v.number())` and check only when `round !== undefined`.

Client:
- In types.ts, convex-server.ts and mock-server.ts, add a round parameter to the three methods and pass it as `{ roomId, round, text }` / `{ roomId, round, contestantId }`.
- In game-room-screen.tsx, pass `room.round` from the render where the button was pressed, the same moment `pressedIn` is captured.

A stale request then fails with 'That round is over.' instead of landing in a later round.

## 24. [low] Photo reveal counts the round in which someone was popped or the room ended, even when that round's answers never came in. A contestant who leaves during picking or answering of round N gets photo N revealed once that round reaches popping. A room that ends early in picking or answering shows photo N of everyone still in, because a finished room uses revealed = round.

`mobile/convex/lib/room.ts:247` (lens: game)

**Fix:** Record how many photos were showing at the moment someone leaves or the room ends, and cap the view at that number.

1. In schema.ts, add optional `photosShown: v.optional(v.number())` to roomPlayers and `revealedRounds: v.optional(v.number())` to rooms.
2. In leave() (room.ts:213), also patch `photosShown: room.status === 'popping' ? room.round : room.round - 1`.
3. In finish() (room.ts:185), also patch `revealedRounds: room.status === 'popping' ? room.round : room.round - 1`. finish() reads the room before patching it, so `room.status` is still the phase it ended in.
4. In roomView, use `const revealed = room.status === 'finished' ? (room.revealedRounds ?? room.round) : room.status === 'popping' ? room.round : room.round - 1;` and `const photoCount = seat.popped ? Math.min(revealed, seat.photosShown ?? seat.poppedInRound ?? 0) : revealed;`.
5. Mirror both changes in mock-server.ts toView/leave/finish so the two stay in step.
6. Add a convex-test case: a contestant leaves in round 2 picking, the room reaches popping, and that contestant still has 1 photo.

## 25. [low] runnerUpOf leaves out every seat with left = true. leave() also sets left on contestants who were already popped and later tapped "Play another room", which the app does through leaveRoom. When the last elimination was a walk-out, the real runner-up (popped the round before, then left to play again) is skipped. The second chance then goes to someone popped earlier, or to nobody. leftInRound already tells these two cases apart.

`mobile/convex/secondChances.ts:16` (lens: game)

**Fix:** In mobile/convex/secondChances.ts:16, exclude only walk-outs, not contestants who left after their pop:
`const popped = (await seatsOf(ctx, room._id)).filter((seat) => seat.popped && seat.leftInRound === undefined);`
Optionally add a convex-test case: a contestant popped in round N-1 leaves, then the last contestant to leave walks out, and runnerUpOf (through secondChances.list) should still return the round N-1 contestant.

## 26. [low] matchmake only ever sees the 500 oldest waiting rows (`take(MAX_WAITING)` on by_room_joined ascending). When those 500 can't form a lobby among themselves, every newer joiner is invisible: matchmaking stops for everyone instead of just slowing down. Rows don't expire, so the window drains only when people tap Leave line.

`mobile/convex/queue.ts:20` (lens: queue)

**Fix:** Make sure matchmake always sees the person who just joined. In joinQueue, keep the row you inserted or replaced (`const me = { _id, ...entry }` via `ctx.db.get(id)`) and call `matchmake(ctx, me)`. In matchmake, after `const waiting = await waitingPlayers(ctx);`, add `if (!waiting.some((row) => row._id === me._id)) waiting.push(me);`. The woman in row 501 then becomes a `first`, finds 5 men in the window and forms the room right away. A joiner who fits nobody still waits, which is correct. For the longer term, add cleanup for stale unmatched rows, for example a cron that deletes rows whose `joinedAt` is older than N minutes, so abandoned rows stop piling up in the window.

## 27. [low] The greedy lobby builder adds candidates in join order and never backtracks. One early candidate's blocks can therefore keep a valid lobby from forming on every later join, for as long as that candidate waits.

`mobile/convex/queue.ts:175` (lens: queue)

**Fix:** In matchmake, when the greedy group for `first` comes up short, retry while leaving out the members whose blocks pushed others out. A sketch:

1. Move the inner loop into `buildGroup(first, skip: Set<Id<'users'>>)`. It works as now, but also skips `skip.has(candidate.userId)`. Each time a fitting candidate is rejected because of `clashing`, record which group member's blocks put them there, in a `crowders` set (or record every member that contributed blocks).
2. In matchmake: `let group = await buildGroup(first, new Set())`. If `group.length <= contestantsNeeded`, then for each `m` in the crowders from that pass, try `buildGroup(first, new Set([m]))` and keep the first result that has more than contestantsNeeded members.

That adds at most 5 extra passes per `first`, and blockLookup is already cached. In the scenario, skipping Luca gives Lena, Noah, Ben, Tom, Jan and Max, so the room forms.

Add a convex-test case that mirrors the scenario, with LOBBY_SIZE 4: Lena, then Luca who blocked Noah and Ben, then Noah, Ben and Tom all join. Expect Lena to be matched with Noah, Ben and Tom.

## 28. [low] The balloon gate runs only at joinQueue. matchmake seats rows without checking hasBalloon again, and Popdate+ is time-based (plusUntil). A player who joined on Popdate+ with an empty wallet can therefore be seated after it has ended and play a room for free, because spend() clamps at zero.

`mobile/convex/queue.ts:93` (lens: queue)

**Fix:** Check balloons again at seating time, in queue.ts matchmake. Before the `for (const first of waiting)` loop, drop the rows whose owner can no longer pay, so the client's status falls back to 'idle' and the queue screen shows NotInQueue instead of searching forever:

```ts
const waiting = [];
for (const row of await waitingPlayers(ctx)) {
  if (await hasBalloon(ctx, row.userId)) waiting.push(row);
  else await ctx.db.delete(row._id);
}
```

If reading up to 500 wallets on every join is too costly, do the same check lazily for `first` and each `candidate` as they are considered for a group. Add a convex-test case: Popdate+ with an empty wallet, join, move plusUntil into the past, then fill the lobby. The row should be gone and no room created for that player.

## 29. [low] secondChances.list and send don't skip runner-ups whose account was deleted. The chooser keeps seeing a ghost "Someone, 0" with no photo as 'almost', and can send a second chance to an account that no longer exists.

`mobile/convex/secondChances.ts:42` (lens: account)

**Fix:** In `runnerUpOf` (mobile/convex/secondChances.ts), drop a runner-up whose account is gone. `list` and `send` both call it, so one change fixes both:

```ts
const seat = popped.find((s) => s.poppedInRound === last) ?? null;
return seat && (await ctx.db.get(seat.userId)) ? seat : null;
```

After this, a deleted runner-up never appears as 'almost' (including after an accepted chance and match were deleted), and `send` fails with "That person was not your runner-up." instead of inserting a row nobody can answer.

## 30. [low] Report retention does not match the policy. Reports are said to be kept "up to a year", but nothing ever deletes them. Reports filed by the deleted user, which can include free-text details, are kept too, and neither the policy nor the deleteAccount docblock mentions them.

`mobile/src/features/settings/legal-screen.tsx:76` (lens: account)

**Fix:** Add mobile/convex/crons.ts. Use `cronJobs()` and `crons.daily('purge old reports', { hourUTC: 3, minuteUTC: 0 }, internal.safety.purgeOldReports)`. Add an internalMutation `purgeOldReports` to safety.ts. It sets `cutoff = Date.now() - 365*24*60*60_000`, runs `ctx.db.query('reports').withIndex('by_creation_time', q => q.lt('_creationTime', cutoff)).take(500)`, deletes each row, and reschedules itself if it got a full batch. In deleteAccount, either delete or anonymize the user's own reports: add `.index('by_reporter', ['reporterId'])` to `reports`, then delete those rows or clear `details`. Or extend the policy sentence to say reports you filed are kept for up to a year too. While editing, either delete the user's `answers` rows in deleteAccount or drop "answers" from the policy's deletion list.

## 31. [low] deleteAccount leaves `rateLimits` rows and `purchaseEvents` keyed by the deleted user id. Neither is mentioned in the deletion docblock or the privacy policy, and the policy's "What we collect" section doesn't list purchase history at all.

`mobile/convex/account.ts:44` (lens: account)

**Fix:** Do one of these two:

1. Delete the data. In deleteAccount, before the sign-in records are deleted:
   - For each prefix in ['upload','saveProfile','sendMessage','joinQueue','postAnswer','block','report','saveSettings','pushToken','selfie'], look up `${prefix}:${userId}` with the by_key index (unique()) and delete the row if there is one.
   - Add `.index('by_user', ['userId'])` to purchaseEvents in schema.ts. In deleteAccount, patch each of the user's rows to `{ userId: undefined }` and keep the row itself, because eventId is still needed so a resent event doesn't count twice.

2. Document it instead. In legal-screen.tsx, add purchases (balloon packs and Popdate+, through Apple and RevenueCat) to "What we collect". Add to "How long we keep it" that purchase records (product, date) are kept after deletion for accounting and disputes. Mention purchaseEvents in the deleteAccount docblock.

The rateLimits deletion is cheap in either case and worth doing.

## 32. [low] deleteAccount reads and deletes every match's full message history in one mutation. A heavy chatter can pass Convex's per-transaction document limits, and then account deletion always fails.

`mobile/convex/account.ts:47` (lens: account)

**Fix:** Delete the match row right away, inside the mutation that ends it. Do the message deletion in batches in a separate internal mutation that schedules itself again until no messages are left. For example, in matches.ts:

export const purgeMessages = internalMutation({ args: { matchId: v.id('matches') }, handler: async (ctx, { matchId }) => { const batch = await ctx.db.query('messages').withIndex('by_match', q => q.eq('matchId', matchId)).take(500); for (const m of batch) await ctx.db.delete(m._id); if (batch.length === 500) await ctx.scheduler.runAfter(0, internal.matches.purgeMessages, { matchId }); } });

In unmatch, and in the matches loop of deleteAccount, replace the collect-and-delete of messages with `await ctx.scheduler.runAfter(0, internal.matches.purgeMessages, { matchId: match._id })`, then `ctx.db.delete(match._id)`.

Once the match row is gone, requireMyMatch already refuses to show or accept messages for it. So the messages that are still being deleted can't be read by anyone in the meantime.

## 33. [low] queue.status is a live subscription (useQueueStatus → watchQueue) that reads up to 500 waiting rows for every searching player. Any write in that index range invalidates every searcher's subscription, so reads grow with the square of the number of people waiting.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\queue.ts:59` (lens: perf)

**Fix:** Make `status` read a bounded number of rows instead of the whole waiting range. There is no counter table to keep consistent.

1. Add an index in schema.ts: `.index('by_room_kind', ['roomId', 'gender', 'wantsToMeet', 'joinedAt'])`.
2. In `status`, get a count for each of the 6 (gender, wantsToMeet) kinds: `ctx.db.query('queue').withIndex('by_room_kind', q => q.eq('roomId', undefined).eq('gender', g).eq('wantsToMeet', w)).take(needed + 1)`. Read all 6 kinds, or only the kinds that can matter for you. Exclude your own row from its kind's count.
3. Rewrite `roomReach` to work on per-kind counts. For each kind k: count k if it fits you. Then, for each popper kind that fits you, take 2 plus the kinds that fit that popper (subtract 1 when the popper's own kind fits itself). Cap at `needed`. The result is already capped at `needed`, so per-kind counts above `needed` never matter.

Each run then reads at most 6 x (needed + 1), about 42 small docs, whatever N is. Because each read stops after `needed + 1` rows, a write further down a kind's range (for example a new join at the end) no longer invalidates the subscription. matchmake's read of 500 rows in `joinQueue` can stay; it runs once per mutation and does not fan out to subscribers.

## 34. [low] The Matches tab badge, mounted in the tabs layout and therefore active whenever the app is open, polls every 30 s. Each poll calls matches.list, which collects all matches unbounded and runs a profile lookup and storage URL per match (convex/matches.ts:22-40), then calls chat.list once per match. Each chat.list reads up to 200 messages only so the client can take the last one. The Matches screen (threads.ts:8-15) does the same on every focus.

`C:\Users\lasse\WebstormProjects\popdate\mobile\src\features\matches\use-your-turn.ts:24` (lens: perf)

**Fix:** Smallest fix: return each match's newest message from `matches.list` and stop calling `chat.list` per match.

1. In `convex/matches.ts`, in `matchView`, read only the newest message:
   `const last = await ctx.db.query('messages').withIndex('by_match', q => q.eq('matchId', match._id)).order('desc').first();`
   Return `last: last ? { senderId: last.senderId as string, text: last.text, sentAt: new Date(last.sentAt).toISOString() } : null`. That is one document per match instead of 200.
2. Add `last` to the `Match` type in `src/api/types.ts`. Update `src/api/mock-server.ts` to match.
3. In `use-your-turn.ts`, compute the count as `matches.filter(m => !m.last || m.last.senderId !== myId).length`. In `threads.ts`, make `withLastMessages` map to `{ match, last: match.last }` with no `listMessages` calls.

Optional: drop the 30 s timer and have the badge use a single live subscription, through a new `api.watchMatches` built on the existing `watch()` helper in `convex-server.ts`. One subscription to `matches.list` then gets pushed updates as messages arrive, replacing the N+1 polled calls.

## 35. [low] registerPushToken accepts any string matching ExponentPushToken[...] and never caps the number of tokens per user. push.send posts all recipients' tokens in one Expo request, and Expo rejects a request with more than 100 messages, so one inflated account silences pushes for everyone it shares a push with.

`C:\Users\lasse\WebstormProjects\popdate\mobile\convex\settings.ts:59` (lens: perf)

**Fix:** 1. Cap tokens per user. In settings.ts registerPushToken, after the patch or insert, load the user's rows with `ctx.db.query('pushTokens').withIndex('by_user', q => q.eq('userId', userId)).collect()`, sort them by updatedAt (newest first) and delete everything after the first 5.
2. Keep one user's tokens from failing everyone's push. In push.ts, make tokensFor return the tokens grouped per user (string[][]). In send, post each group as its own request, for example `await Promise.all(groups.map(g => fetch(url, {...body: JSON.stringify(g.slice(0, 100).map(to => ({to, title, body, data, sound: 'default'})))}).catch(() => undefined)))`. If you keep a single request, at least split the tokens into chunks of 100. Per-user requests also stop the mixed-project rejection.

## 36. [low] A block made during a room does not stop that room from matching the two people. `finish()` inserts the match and sends "It's a match. Say hi." without calling `isBlockedEitherWay`, unlike `secondChances.answer`.

`mobile/convex/lib/room.ts:172` (lens: safety)

**Fix:** In `mobile/convex/lib/room.ts`, add `isBlockedEitherWay` to the import from './people'. In `finish()`, only create the match and push when neither person has blocked the other, and keep `winnerId` as it is:

```ts
const winner = withWinner ? (await seatsOf(ctx, roomId)).find(stillIn) : undefined;
let matchId: Id<'matches'> | undefined;
if (winner && !(await isBlockedEitherWay(ctx, room.popperId, winner.userId))) {
  matchId = await ctx.db.insert('matches', { ... });
  await schedulePush(ctx, [room.popperId, winner.userId], { ... });
}
// patch unchanged: winnerId: winner?.userId, matchId
```

Keeping `winnerId` while `matchId` is undefined leaves the room in the same state as after an unmatch. `roomView` returns `matchId: null`, `history.ts` already handles a room with a winner and no match, and the popper's second chance to the runner-up still works. Add a convex-test that blocks during a room and pops down to the blocker, then checks that `matches.list` is empty for both and the view's `matchId` is null.

## 37. [low] Ordinary input gets past the server's word filter. A straight apostrophe counts as part of a word, and invisible characters or decomposed accents split a word in two, so the exact whole-word lookup never sees the bad word.

`mobile/src/utils/profanity.ts:38` (lens: safety)

**Fix:** In mobile/src/utils/profanity.ts, take the apostrophe out of the word pattern, and keep combining marks and format characters inside words so fold() strips them:
- fold: `text.normalize('NFD').replace(/[\p{M}\p{Cf}]/gu, '').toLowerCase()`
- maskProfanity: `text.replace(/[\p{L}\p{M}\p{Cf}]+/gu, ...)`
- hasProfanity: `text.split(/[^\p{L}\p{M}\p{Cf}]+/u)`

Result: "espèce d'••••••", "••••'s sake", "'••••'", and soft-hyphen, ZWJ and NFD variants are fully masked. Existing test cases are unchanged. Add test cases for "d'enculé", "fuck's" and an NFD input.

## 38. [low] Profile names never go through the profanity filter. The name is the free text other players see most: in rooms, history, Matches, chat push titles and the second-chance push body.

`mobile/convex/profiles.ts:120` (lens: safety)

**Fix:** Reject a profane name when the profile is saved. Do not mask it, because a name made of bullets is useless.
1. In mobile/convex/lib/profanity.ts, change the export to `export { hasProfanity, maskProfanity } from '../../src/utils/profanity';`.
2. In mobile/convex/profiles.ts saveProfile, before `const fields = {...}`, add:
`const name = text(args.name, 'name', 50); if (hasProfanity(name)) fail('Please pick a different name.');`
3. Use `name` in place of `text(args.name, 'name', 50)` in `fields`.

Names that are already stored stay as they are until the next save. That is acceptable before launch.

## 39. [low] The 18+ check uses a different calendar day than the app. The server's `ageFromBirthDate` reads the date with local-time getters, and Convex runs in UTC, while onboarding uses the phone's local date. Near an 18th birthday the two disagree.

`mobile/convex/profiles.ts:79` (lens: safety)

**Fix:** In checkBirthDate (mobile/convex/profiles.ts:79), work out the age on the latest calendar date anywhere on Earth (UTC+14) instead of the server's UTC date. The birth date is self-declared, so this loosens nothing that matters, and the server then never rejects someone the phone accepted: `const age = ageFromBirthDate(birthDate, new Date(Date.now() + 14 * 60 * 60_000));`. This relies on the runtime being UTC. To make it independent of the host timezone, which matters for convex-test on a local machine, switch `ageFromBirthDate` to `getUTCFullYear`/`getUTCMonth`/`getUTCDate` when it gets a server-supplied date, or add a small UTC variant just for the server check.
