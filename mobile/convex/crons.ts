import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Waitlist signups nobody confirmed go after 30 days, as the waitlist's privacy policy says.
crons.daily('delete unconfirmed waitlist signups', { hourUTC: 3, minuteUTC: 0 }, internal.waitlist.pruneUnconfirmed);

// Places in line nobody checked in on for 10 minutes leave the queue.
crons.interval('sweep stale queue rows', { minutes: 1 }, internal.queue.sweepStale, {});

// Matchmaking also runs once a minute on its own, so a lobby that became possible
// without anyone joining (someone came back to the app) still forms.
crons.interval('matchmake', { minutes: 1 }, internal.queue.matchmake, {});

// Uploaded photos and selfies nobody ever saved are deleted after a day.
crons.interval('sweep unclaimed uploads', { hours: 1 }, internal.uploads.sweepUnclaimed, {});

// Ended chats kept for reports go after 30 days.
crons.interval('purge ended chats', { hours: 24 }, internal.matches.purgeEndedChats, {});

export default crons;
