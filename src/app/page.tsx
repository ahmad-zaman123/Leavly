import DashboardApp, { type TypeProp } from "@/components/DashboardApp";
import type { LeaveDTO } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { allowanceFor, getConfig, getTeamLeaves, getUserLeaves } from "@/lib/data";
import { leaveYearOf, todayIso } from "@/lib/dates";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ year?: string; all?: string }> }) {
  const user = await requireUser();
  const cfg = await getConfig();
  const sp = await searchParams;
  const today = todayIso();
  const ys = cfg.yearStartMonth;
  const thisYear = leaveYearOf(today, ys);
  const year = Number(sp.year) || thisYear;
  const showAll = sp.all === "1";

  const mine = await getUserLeaves(user.id);
  // Members only ever receive their own leave. Admins also see the team's, so their calendar shows everyone.
  const isAdmin = user.role === "admin";
  const team = isAdmin ? await getTeamLeaves() : mine.map((l) => ({ ...l, userName: user.name }));

  const years = new Set<number>([thisYear, thisYear + 1, year]);
  for (const l of mine) {
    years.add(leaveYearOf(l.fromDate, ys));
    years.add(leaveYearOf(l.toDate, ys));
  }

  const types: TypeProp[] = cfg.types.map((t, i) => ({ key: t.key, label: t.label, allowance: allowanceFor(user, t), colorIndex: i }));
  const leaves: LeaveDTO[] = team.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: l.userName,
    typeKey: l.typeKey,
    fromDate: l.fromDate,
    toDate: l.toDate,
    note: l.note,
    halfDay: l.halfDay,
  }));
  const holidayMap = cfg.holidayMap;

  return (
    <main>
      <DashboardApp
        me={{ id: user.id, name: user.name, email: user.email }}
        types={types}
        team={leaves}
        holidays={holidayMap}
        weekend={cfg.weekend}
        today={today}
        year={year}
        yearStartMonth={ys}
        yearList={[...years].sort((a, b) => a - b)}
        showAll={showAll}
        showTeam={isAdmin}
      />
    </main>
  );
}
