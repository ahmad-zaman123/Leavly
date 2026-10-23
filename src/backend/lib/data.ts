import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/backend/db";
import { holidays, leaveTypes, leaves, settings, users, type Leave, type LeaveType, type User } from "@/backend/db/schema";
import { leaveDays, leaveYearWindow, type WorkCalendar } from "./dates";

/** 24 days a year in total: 14 casual, 10 sick. Admins can change these on the Admin page. */
export const DEFAULT_TYPES = [
  { key: "casual", label: "Casual", days: 14, position: 0 },
  { key: "sick", label: "Sick", days: 10, position: 1 },
];

let defaultsChecked = false;

/** Seeds the settings row and default leave types once per process; later calls are free. */
export async function ensureDefaults(): Promise<void> {
  if (defaultsChecked) return;
  const [row, types] = await Promise.all([
    db.query.settings.findFirst({ where: eq(settings.id, 1) }),
    db.select({ id: leaveTypes.id }).from(leaveTypes).limit(1),
  ]);
  if (!row)
    await db
      .insert(settings)
      .values({ id: 1, weekend: [0, 6] })
      .onConflictDoNothing();
  if (types.length === 0) await db.insert(leaveTypes).values(DEFAULT_TYPES).onConflictDoNothing();
  defaultsChecked = true;
}

export type Config = {
  weekend: number[];
  yearStartMonth: number;
  types: LeaveType[];
  holidays: { id: number; date: string; label: string; yearly: boolean }[];
  /** Every holiday date that applies, with yearly ones repeated across nearby years. */
  holidayMap: Record<string, string>;
  calendar: WorkCalendar;
};

/** Expands yearly holidays into concrete dates for a span of years. */
export function expandHolidays(list: { date: string; label: string; yearly: boolean }[], fromYear: number, toYear: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of list) {
    if (!h.yearly) {
      out[h.date] = h.label;
      continue;
    }
    const mmdd = h.date.slice(5);
    const first = Number(h.date.slice(0, 4));
    for (let y = Math.max(fromYear, first); y <= toYear; y++) out[`${y}-${mmdd}`] = h.label;
  }
  return out;
}

export async function getConfig(): Promise<Config> {
  await ensureDefaults();
  // Three independent reads; run them together so a remote database costs one round trip, not three.
  const [row, types, hols] = await Promise.all([
    db.query.settings.findFirst({ where: eq(settings.id, 1) }).then((r) => r!),
    db.select().from(leaveTypes).orderBy(asc(leaveTypes.position), asc(leaveTypes.id)),
    db.select().from(holidays).orderBy(asc(holidays.date)),
  ]);
  const thisYear = new Date().getFullYear();
  const holidayMap = expandHolidays(hols, thisYear - 2, thisYear + 3);
  return {
    weekend: row.weekend,
    yearStartMonth: row.yearStartMonth,
    types,
    holidays: hols,
    holidayMap,
    calendar: { weekend: row.weekend, holidays: new Set(Object.keys(holidayMap)) },
  };
}

export function allowanceFor(user: Pick<User, "allowances">, type: LeaveType): number {
  const ov = user.allowances?.[type.key];
  return typeof ov === "number" && Number.isFinite(ov) ? ov : type.days;
}

/** Working days used per leave type in a leave year (named by the calendar year it starts in). */
export function usageFor(userLeaves: Leave[], cfg: Config, year: number): Record<string, number> {
  const u: Record<string, number> = {};
  const within = leaveYearWindow(year, cfg.yearStartMonth);
  for (const t of cfg.types) u[t.key] = 0;
  for (const l of userLeaves) {
    if (u[l.typeKey] === undefined) continue;
    u[l.typeKey] += leaveDays(l, cfg.calendar, within);
  }
  return u;
}

export type TeamLeave = Leave & { userName: string };

export async function getTeamLeaves(): Promise<TeamLeave[]> {
  const rows = await db
    .select({ leave: leaves, userName: users.name })
    .from(leaves)
    .innerJoin(users, eq(users.id, leaves.userId))
    .orderBy(asc(leaves.fromDate));
  return rows.map((r) => ({ ...r.leave, userName: r.userName }));
}

export async function getUserLeaves(userId: number): Promise<Leave[]> {
  return db.select().from(leaves).where(eq(leaves.userId, userId)).orderBy(desc(leaves.fromDate));
}
