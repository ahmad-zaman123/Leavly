export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function fmtDate(s: string, withYear = false): string {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${withYear ? " " + d.getFullYear() : ""}`;
}

export function fmtRange(from: string, to: string): string {
  const withYear = from.slice(0, 4) !== String(new Date().getFullYear());
  return from === to ? fmtDate(from, withYear) : `${fmtDate(from, withYear)} – ${fmtDate(to, withYear)}`;
}

export function* eachDay(from: string, to: string): Generator<Date> {
  let d = parseDate(from);
  const end = parseDate(to);
  while (d <= end) {
    yield d;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
}

export type WorkCalendar = { weekend: number[]; holidays: Set<string> };

export function isWorkingDay(d: Date, cal: WorkCalendar): boolean {
  return !cal.weekend.includes(d.getDay()) && !cal.holidays.has(isoDate(d));
}

export type DateWindow = { from: string; to: string };

/** The leave year a date falls in, named by the calendar year it starts in. With startMonth 7, 2026 means Jul 2026 to Jun 2027. */
export function leaveYearOf(iso: string, startMonth: number): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= startMonth ? y : y - 1;
}

/** First and last day of a leave year. */
export function leaveYearWindow(year: number, startMonth: number): DateWindow {
  const from = isoDate(new Date(year, startMonth - 1, 1));
  const to = isoDate(new Date(year + 1, startMonth - 1, 0));
  return { from, to };
}

/** "2026" for a January start, "2026–27" otherwise. */
export function leaveYearLabel(year: number, startMonth: number): string {
  return startMonth === 1 ? String(year) : `${year}–${String(year + 1).slice(2)}`;
}

/** "Jul 2026 – Jun 2027" */
export function leaveYearSpan(year: number, startMonth: number): string {
  const w = leaveYearWindow(year, startMonth);
  return `${MONTHS[Number(w.from.slice(5, 7)) - 1].slice(0, 3)} ${w.from.slice(0, 4)} – ${MONTHS[Number(w.to.slice(5, 7)) - 1].slice(0, 3)} ${w.to.slice(0, 4)}`;
}

/** Working days between two dates inclusive, skipping weekends and public holidays. `within` limits the count to a date window. */
export function countWorkingDays(from: string, to: string, cal: WorkCalendar, within?: DateWindow): { days: number; skippedHolidays: number } {
  let days = 0;
  let skippedHolidays = 0;
  if (!from || !to || to < from) return { days, skippedHolidays };
  for (const d of eachDay(from, to)) {
    if (within) {
      const k = isoDate(d);
      if (k < within.from || k > within.to) continue;
    }
    if (isWorkingDay(d, cal)) days++;
    else if (cal.holidays.has(isoDate(d))) skippedHolidays++;
  }
  return { days, skippedHolidays };
}

/** Days a leave entry uses: working days in range, or 0.5 for a half day that falls on a working day. */
export function leaveDays(l: { fromDate: string; toDate: string; halfDay?: boolean }, cal: WorkCalendar, within?: DateWindow): number {
  const n = countWorkingDays(l.fromDate, l.toDate, cal, within).days;
  return l.halfDay ? Math.min(n, 0.5) : n;
}

/** "half a day", "1 working day", "2.5 working days" */
export function fmtDays(n: number): string {
  if (n === 0.5) return "half a day";
  return `${n} working day${n === 1 ? "" : "s"}`;
}
