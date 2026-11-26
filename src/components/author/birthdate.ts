/**
 * Free-text birth date parsing (Open Library and seed data store dates as text).
 * Pure functions, no DB or server imports, so they can be unit-tested directly.
 */

export type BirthDay = { year: number | null; month: number; day: number };

const MONTHS = new Map<string, number>(
  [
    ["january", 1], ["jan", 1], ["february", 2], ["feb", 2], ["march", 3], ["mar", 3], ["april", 4], ["apr", 4],
    ["may", 5], ["june", 6], ["jun", 6], ["july", 7], ["jul", 7], ["august", 8], ["aug", 8], ["september", 9],
    ["sep", 9], ["sept", 9], ["october", 10], ["oct", 10], ["november", 11], ["nov", 11], ["december", 12], ["dec", 12],
  ],
);

/** Lower-case, strip ordinals ("22nd"), punctuation and filler words, collapse whitespace. */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/\bof\b/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checked(year: number | null, month: number, day: number): BirthDay | null {
  if (month < 1 || month > 12 || day < 1) return null;
  // Use a leap year when the year is unknown so 29 February survives.
  const probeYear = year ?? 2000;
  const daysInMonth = new Date(Date.UTC(probeYear, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return { year, month, day };
}

/**
 * Parses a birth date into month and day (plus year when present). Accepts:
 *   "22 August 1920", "22nd Aug. 1920", "August 22, 1920", "Aug 22 1920",
 *   "1920-08-22", "1920/8/22", "1920-08-22T00:00:00", "August 22" and "22 August".
 * Year-only, month-only, "circa" and unparseable strings return null.
 */
export function parseBirthDate(raw: string | null | undefined): BirthDay | null {
  if (!raw) return null;
  const s = normalise(raw);
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{4})[-/ ](\d{1,2})[-/ ](\d{1,2})(?:\D.*)?$/))) return checked(+m[1], +m[2], +m[3]);

  if ((m = s.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/)) && MONTHS.has(m[2])) return checked(+m[3], MONTHS.get(m[2])!, +m[1]);

  if ((m = s.match(/^([a-z]+) (\d{1,2}) (\d{4})$/)) && MONTHS.has(m[1])) return checked(+m[3], MONTHS.get(m[1])!, +m[2]);

  if ((m = s.match(/^([a-z]+) (\d{1,2})$/)) && MONTHS.has(m[1])) return checked(null, MONTHS.get(m[1])!, +m[2]);

  if ((m = s.match(/^(\d{1,2}) ([a-z]+)$/)) && MONTHS.has(m[2])) return checked(null, MONTHS.get(m[2])!, +m[1]);

  return null;
}

/** Whether a free-text birth date falls on the given calendar day (any year). */
export function isBornOn(raw: string | null | undefined, month: number, day: number): boolean {
  const p = parseBirthDate(raw);
  return !!p && p.month === month && p.day === day;
}

/** Today's month and day in server local time. */
export function todayMonthDay(now: Date = new Date()): { month: number; day: number } {
  return { month: now.getMonth() + 1, day: now.getDate() };
}
