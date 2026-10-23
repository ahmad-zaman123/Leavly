"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { removeLeave, restoreLeave, type LeaveDTO } from "@/backend/lib/actions";
import { MONTHS, fmtDays, fmtRange, leaveDays, leaveYearLabel, leaveYearSpan, leaveYearWindow, parseDate, type WorkCalendar } from "@/backend/lib/dates";
import { typeColorVar } from "@/frontend/lib/colors";

export type TypeProp = { key: string; label: string; allowance: number; colorIndex: number };

export default function MyLeaves({
  types,
  leaves,
  holidays,
  weekend,
  today,
  year,
  yearStartMonth,
  yearList,
}: {
  types: TypeProp[];
  leaves: LeaveDTO[];
  holidays: string[];
  weekend: number[];
  today: string;
  year: number;
  yearStartMonth: number;
  yearList: number[];
}) {
  const router = useRouter();
  const cal: WorkCalendar = useMemo(() => ({ weekend, holidays: new Set(holidays) }), [weekend, holidays]);
  const win = leaveYearWindow(year, yearStartMonth);
  const [filter, setFilter] = useState<string>("all");
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [extra, setExtra] = useState<LeaveDTO[]>([]);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; kind?: "error" } | null>(null);
  const timer = useRef<number | null>(null);
  const show = (t: { msg: string; undo?: () => void; kind?: "error" }) => {
    setToast(t);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 6000);
  };

  const all = useMemo(() => {
    const seen = new Set<number>();
    return [...leaves, ...extra].filter((l) => {
      if (seen.has(l.id) || removed.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [leaves, extra, removed]);
  const inYear = all.filter((l) => l.fromDate <= win.to && l.toDate >= win.from);
  const typeOf = (k: string) => types.find((t) => t.key === k);

  const totals = types.map((t) => ({ ...t, used: inYear.filter((l) => l.typeKey === t.key).reduce((n, l) => n + leaveDays(l, cal, win), 0) }));
  // Running balance: walk each type chronologically so every row can say what was left after it.
  const leftAfter = new Map<number, number>();
  for (const t of types) {
    let bal = t.allowance;
    for (const l of inYear.filter((x) => x.typeKey === t.key).sort((a, b) => (a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : a.id - b.id))) {
      bal -= leaveDays(l, cal, win);
      leftAfter.set(l.id, bal);
    }
  }
  const shown = (filter === "all" ? inYear : inYear.filter((l) => l.typeKey === filter)).sort((a, b) => (a.fromDate < b.fromDate ? 1 : -1));
  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["From", "To", "Type", "Days", "Half day", "Note", "Left after"].map(esc).join(",")];
    for (const l of [...shown].reverse())
      lines.push(
        [l.fromDate, l.toDate, typeOf(l.typeKey)?.label ?? l.typeKey, leaveDays(l, cal), l.halfDay ? "yes" : "", l.note, leftAfter.get(l.id) ?? ""]
          .map(esc)
          .join(","),
      );
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leavly-${leaveYearLabel(year, yearStartMonth).replace("–", "-")}${filter === "all" ? "" : "-" + filter}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const groups = new Map<string, LeaveDTO[]>();
  for (const l of shown) {
    const k = l.fromDate.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }

  const doRemove = async (l: LeaveDTO) => {
    setRemoved((s) => new Set(s).add(l.id));
    const r = await removeLeave(l.id);
    if (r.error) {
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(l.id);
        return n;
      });
      show({ msg: r.error, kind: "error" });
      return;
    }
    const data = r.removed!;
    show({
      msg: `Removed ${fmtRange(data.fromDate, data.toDate)}.`,
      undo: async () => {
        setToast(null);
        const back = await restoreLeave(data);
        if (back.leave) {
          setExtra((x) => [...x, back.leave!]);
          show({ msg: "Restored." });
          router.refresh();
        } else show({ msg: back.error ?? "Could not restore.", kind: "error" });
      },
    });
    router.refresh();
  };

  return (
    <>
      <section className="block">
        <div className="sec-head">
          <div>
            <h2>My leaves</h2>
            <div className="hint">{leaveYearSpan(year, yearStartMonth)}</div>
          </div>
          <div className="tools">
            <label className="hint" htmlFor="ly">
              Leave year
            </label>
            <select id="ly" value={year} onChange={(e) => router.push(`/leaves?year=${e.target.value}`)}>
              {yearList.map((y) => (
                <option key={y} value={y}>
                  {leaveYearLabel(y, yearStartMonth)}
                </option>
              ))}
            </select>
            <button className="btn sm" type="button" onClick={exportCsv} disabled={!shown.length}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="totals">
          <button type="button" className={`tot${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>
            <span className="eyebrow">All</span>
            <span className="big num">{totals.reduce((n, t) => n + t.used, 0)}</span>
            <span className="hint">of {totals.reduce((n, t) => n + t.allowance, 0)} used</span>
          </button>
          {totals.map((t) => (
            <button
              type="button"
              key={t.key}
              className={`tot${filter === t.key ? " on" : ""}`}
              style={{ ["--c" as string]: typeColorVar(t.colorIndex) }}
              onClick={() => setFilter(filter === t.key ? "all" : t.key)}
            >
              <span className="eyebrow">
                <i className="dot" />
                {t.label}
              </span>
              <span className="big num">{t.used}</span>
              <span className="hint">of {t.allowance} used</span>
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="list">
          {groups.size ? (
            [...groups.entries()].map(([k, items]) => {
              const d = parseDate(k + "-01");
              const days = items.reduce((n, l) => n + leaveDays(l, cal), 0);
              return (
                <div key={k} className="group">
                  <div className="ghead">
                    <span>
                      {MONTHS[d.getMonth()]} {d.getFullYear()}
                    </span>
                    <span className="hint">
                      {days} day{days === 1 ? "" : "s"}
                    </span>
                  </div>
                  {items.map((l) => {
                    const t = typeOf(l.typeKey);
                    const past = l.toDate < today;
                    return (
                      <div className={`item${past ? " past" : ""}`} key={l.id} style={{ ["--c" as string]: typeColorVar(t?.colorIndex ?? 0) }}>
                        <span className="tdot" />
                        <div className="t">
                          <div className="l1">{t?.label ?? l.typeKey}</div>
                          <div className="l2">
                            <span className="num">{fmtRange(l.fromDate, l.toDate)}</span> · {fmtDays(leaveDays(l, cal))}
                            {l.note ? ` · ${l.note}` : ""}
                            {leftAfter.has(l.id) ? <span className="after"> · {leftAfter.get(l.id)} left after</span> : null}
                          </div>
                        </div>
                        <div className="act">
                          <button className="btn sm" type="button" onClick={() => doRemove(l)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="empty">
              {filter === "all" ? "No leave in this year yet." : `No ${typeOf(filter)?.label.toLowerCase()} leave in this year.`}{" "}
              <Link href="/">Log one on the dashboard.</Link>
            </div>
          )}
        </div>
      </section>

      {toast ? (
        <div className={`toast ${toast.kind ?? ""}`} role="status">
          <span>{toast.msg}</span>
          {toast.undo ? (
            <button type="button" onClick={toast.undo}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
