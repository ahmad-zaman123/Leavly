import AwayMonth from "@/frontend/components/AwayMonth";
import { requireAdmin } from "@/backend/lib/auth";
import { getConfig, getTeamLeaves } from "@/backend/lib/data";
import { todayIso } from "@/backend/lib/dates";

export default async function AwayPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const cfg = await getConfig();
  const sp = await searchParams;
  const today = todayIso();
  const m = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const year = Number(m.slice(0, 4));
  const month = Number(m.slice(5, 7));
  const all = await getTeamLeaves();
  const leaves = all.map((l) => ({
    id: l.id,
    userId: l.userId,
    userName: l.userName,
    typeKey: l.typeKey,
    fromDate: l.fromDate,
    toDate: l.toDate,
    note: l.note,
    halfDay: l.halfDay,
  }));
  const types = cfg.types.map((t, i) => ({ key: t.key, label: t.label, colorIndex: i }));
  return <AwayMonth year={year} month={month} leaves={leaves} types={types} holidays={cfg.holidayMap} weekend={cfg.weekend} today={today} />;
}
