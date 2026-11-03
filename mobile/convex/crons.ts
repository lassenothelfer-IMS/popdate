import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily('delete unconfirmed waitlist signups', { hourUTC: 3, minuteUTC: 0 }, internal.waitlist.pruneUnconfirmed);

export default crons;
