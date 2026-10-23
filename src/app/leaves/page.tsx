import MyLeaves, { type TypeProp } from "@/components/MyLeaves";
import type { LeaveDTO } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { allowanceFor, getConfig, getUserLeaves } from "@/lib/data";
import { leaveYearOf, todayIso } from "@/lib/dates";

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requireUser();
  const cfg = await getConfig();
  const sp = await searchParams;
  const today = todayIso();
  const ys = cfg.yearStartMonth;
  const thisYear = leaveYearOf(today, ys);
  const year = Number(sp.year) || thisYear;
  const mine = await getUserLeaves(user.id);
  const years = new Set<number>([thisYear, year]);
  for (const l of mine) {
    years.add(leaveYearOf(l.fromDate, ys));
    years.add(leaveYearOf(l.toDate, ys));
  }
  const types: TypeProp[] = cfg.types.map((t, i) => ({ key: t.key, label: t.label, allowance: allowanceFor(user, t), colorIndex: i }));
  const leaves: LeaveDTO[] = mine.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: user.name,
    typeKey: l.typeKey,
    fromDate: l.fromDate,
    toDate: l.toDate,
    note: l.note,
    halfDay: l.halfDay,
  }));
  return (
    <main>
      <MyLeaves
        types={types}
        leaves={leaves}
        holidays={Object.keys(cfg.holidayMap)}
        weekend={cfg.weekend}
        today={today}
        year={year}
        yearStartMonth={ys}
        yearList={[...years].sort((a, b) => b - a)}
      />
    </main>
  );
}
