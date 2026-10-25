import { asc } from "drizzle-orm";
import AddPerson from "@/frontend/components/AddPerson";
import GettingStarted, { type SetupStep } from "@/frontend/components/GettingStarted";
import ThisWeek from "@/frontend/components/ThisWeek";
import { AutoSubmitSelect } from "@/frontend/components/AutoSubmit";
import TeamTable, { type Person, type TypeCol } from "@/frontend/components/TeamTable";
import UpcomingList from "@/frontend/components/UpcomingList";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { requireAdmin } from "@/backend/lib/auth";
import { allowanceFor, getConfig, getTeamLeaves, usageFor } from "@/backend/lib/data";
import { leaveYearLabel, leaveYearOf, todayIso } from "@/backend/lib/dates";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const admin = await requireAdmin();
  const cfg = await getConfig();
  const sp = await searchParams;
  const today = todayIso();
  const thisYear = leaveYearOf(today, cfg.yearStartMonth);
  const year = Number(sp.year) || thisYear;

  const rows = await db.select().from(users).orderBy(asc(users.name));
  const all = await getTeamLeaves();
  const byUser = new Map<number, typeof all>();
  for (const l of all) byUser.set(l.userId, [...(byUser.get(l.userId) ?? []), l]);
  const years = [thisYear - 1, thisYear, thisYear + 1];

  const types: TypeCol[] = cfg.types.map((t, i) => ({ key: t.key, label: t.label, days: t.days, colorIndex: i }));
  const people: Person[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    active: p.active,
    allowances: p.allowances ?? null,
    usage: usageFor(byUser.get(p.id) ?? [], cfg, year),
    allowance: Object.fromEntries(cfg.types.map((t) => [t.key, allowanceFor(p, t)])),
  }));
  const upcomingAndCurrent = all
    .filter((l) => l.toDate >= today || l.fromDate.slice(0, 7) === today.slice(0, 7))
    .map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.userName,
      typeKey: l.typeKey,
      fromDate: l.fromDate,
      toDate: l.toDate,
      note: l.note,
      halfDay: l.halfDay,
    }));
  const upcoming = all
    .filter((l) => l.toDate >= today)
    .sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1))
    .map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.userName,
      typeKey: l.typeKey,
      fromDate: l.fromDate,
      toDate: l.toDate,
      note: l.note,
      halfDay: l.halfDay,
    }));

  const onlyMe = people.length <= 1;
  // The checklist stays until people and holidays are in; the last step is just a nudge to look.
  const steps: SetupStep[] = [
    { key: "people", label: "Add your people", done: !onlyMe, hint: "Then share the site link and each person's starting password." },
    { key: "holidays", label: "Add this year's public holidays", done: cfg.holidays.length > 0, href: "/admin/settings" },
    {
      key: "year",
      label: "Check the leave year start and weekend days",
      done: false,
      href: "/admin/settings",
      hint: `Currently ${leaveYearLabel(thisYear, cfg.yearStartMonth)}.`,
    },
  ];
  const setupDone = steps[0].done && steps[1].done;
  return (
    <>
      {setupDone ? null : <GettingStarted steps={steps} />}
      <ThisWeek leaves={upcomingAndCurrent} types={types} holidays={cfg.holidayMap} weekend={cfg.weekend} today={today} />
      <section className="block">
        <div className="sec-head">
          <h2>Team</h2>
          <form method="get" className="tools">
            <label className="hint" htmlFor="year">
              Balances for
            </label>
            <AutoSubmitSelect id="year" name="year" defaultValue={String(year)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {leaveYearLabel(y, cfg.yearStartMonth)}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        </div>
        <TeamTable people={people} types={types} meId={admin.id} />
        <div className="hint">Click a person to set allowances, change their role, reset their password or deactivate them.</div>
      </section>

      <AddPerson openByDefault={onlyMe} />

      <section className="block">
        <div className="sec-head">
          <h2>Upcoming leave</h2>
          <span className="hint">Everyone, from today onward. Remove an entry if someone logged it by mistake.</span>
        </div>
        <UpcomingList leaves={upcoming} types={types} weekend={cfg.weekend} holidays={Object.keys(cfg.holidayMap)} />
      </section>
    </>
  );
}
