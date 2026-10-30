function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** The oldest age a birthday can give; the server takes nothing older either. */
export const MAX_AGE = 120;

/**
 * Turns day, month and year fields into `YYYY-MM-DD`, or null if the date
 * doesn't exist or hasn't happened yet.
 */
export function parseBirthDate(day: string, month: string, year: string, today = new Date()): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (![d, m, y].every(Number.isInteger) || y < 1900) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayUtc) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function ageFromBirthDate(birthDate: string, today = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const month = today.getMonth() + 1;
  const hadBirthday = month > m || (month === m && today.getDate() >= d);
  return today.getFullYear() - y - (hadBirthday ? 0 : 1);
}
