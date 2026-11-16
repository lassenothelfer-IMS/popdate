/** How far back, and from how many rooms, Home's "most rooms open around" hour is told. */
const BUSY_HOUR_DAYS = 14;
const BUSY_HOUR_MIN_ROOMS = 5;

/**
 * The UTC hour most of these rooms started in, over the last two weeks, or null
 * while there are too few to say. The app shows it in the phone's time.
 */
export function busiestHour(startedAt: number[], now = Date.now()) {
  const since = now - BUSY_HOUR_DAYS * 24 * 60 * 60_000;
  const counts = new Array<number>(24).fill(0);
  let rooms = 0;
  for (const at of startedAt) {
    if (at < since) continue;
    counts[new Date(at).getUTCHours()] += 1;
    rooms += 1;
  }
  if (rooms < BUSY_HOUR_MIN_ROOMS) return null;
  return counts.indexOf(Math.max(...counts));
}
