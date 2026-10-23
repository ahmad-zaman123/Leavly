"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Avatar from "./Avatar";
import type { LeaveDTO } from "@/lib/actions";
import { DOW, MONTHS, countWorkingDays, fmtDate, fmtDays, fmtRange, isWorkingDay, isoDate, leaveDays, parseDate, type WorkCalendar } from "@/lib/dates";
import { typeColorVar } from "@/lib/colors";

type T = { key: string; label: string; colorIndex: number };

export default function AwayMonth({
  year,
  month,
  leaves,
  types,
  holidays,
  weekend,
  today,
}: {
  year: number;
  month: number; // 1-12
  leaves: LeaveDTO[];
  types: T[];
  holidays: Record<string, string>;
  weekend: number[];
  today: string;
}) {
  const router = useRouter();
  const cal: WorkCalendar = useMemo(() => ({ weekend, holidays: new Set(Object.keys(holidays)) }), [weekend, holidays]);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = isoDate(new Date(year, month, 0));
  const win = { from: first, to: last };
  const typeOf = (k: string) => types.find((t) => t.key === k);

  const days: string[] = [];
  for (let d = parseDate(first); d <= parseDate(last); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) days.push(isoDate(d));
  const workingDays = days.filter((k) => isWorkingDay(parseDate(k), cal)).length;

  const inMonth = leaves.filter((l) => l.fromDate <= last && l.toDate >= first);
  const perDay = new Map<string, LeaveDTO[]>();
  for (const k of days)
    if (isWorkingDay(parseDate(k), cal))
      perDay.set(
        k,
        inMonth.filter((l) => k >= l.fromDate && k <= l.toDate),
      );

  const byPerson = new Map<number, { name: string; items: LeaveDTO[]; days: number }>();
  for (const l of inMonth) {
    const e = byPerson.get(l.userId) ?? { name: l.userName, items: [], days: 0 };
    e.items.push(l);
    e.days += leaveDays(l, cal, win);
    byPerson.set(l.userId, e);
  }
  const people = [...byPerson.entries()].sort((a, b) => b[1].days - a[1].days || a[1].name.localeCompare(b[1].name));
  const totalDays = people.reduce((n, [, p]) => n + p.days, 0);
  let busiest: { day: string; n: number } | null = null;
  for (const [k, ls] of perDay) if (ls.length && (!busiest || ls.length > busiest.n)) busiest = { day: k, n: ls.length };

  const go = (y: number, m: number) => router.push(`/admin/away?month=${y}-${String(m).padStart(2, "0")}`);
  const prev = () => (month === 1 ? go(year - 1, 12) : go(year, month - 1));
  const next = () => (month === 12 ? go(year + 1, 1) : go(year, month + 1));
  const nowY = Number(today.slice(0, 4));
  const nowM = Number(today.slice(5, 7));

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["Person", "Type", "From", "To", "Days in month", "Half day", "Note"].map(esc).join(",")];
    for (const [, p] of people)
      for (const l of p.items)
        lines.push(
          [p.name, typeOf(l.typeKey)?.label ?? l.typeKey, l.fromDate, l.toDate, leaveDays(l, cal, win), l.halfDay ? "yes" : "", l.note].map(esc).join(","),
        );
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leavly-away-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <section className="block">
        <div className="sec-head">
          <div>
            <h2>Away</h2>
            <div className="hint">Everyone's leave in one month.</div>
          </div>
          <div className="tools">
            <button className="btn icon" type="button" onClick={prev} aria-label="Previous month">
              ‹
            </button>
            <strong className="caltitle">
              {MONTHS[month - 1]} {year}
            </strong>
            <button className="btn icon" type="button" onClick={next} aria-label="Next month">
              ›
            </button>
            <button className="btn sm" type="button" onClick={() => go(nowY, nowM)} disabled={year === nowY && month === nowM}>
              This month
            </button>
            <button className="btn sm" type="button" onClick={exportCsv} disabled={!people.length}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="totals">
          <div className="tot">
            <span className="eyebrow">People away</span>
            <span className="big num">{people.length}</span>
            <span className="hint">{people.length === 1 ? "person" : "people"} with leave this month</span>
          </div>
          <div className="tot">
            <span className="eyebrow">Days of leave</span>
            <span className="big num">{totalDays}</span>
            <span className="hint">across {workingDays} working days</span>
          </div>
          <div className="tot">
            <span className="eyebrow">Busiest day</span>
            <span className="big num">{busiest ? busiest.n : 0}</span>
            <span className="hint">{busiest ? `away on ${DOW[parseDate(busiest.day).getDay()]} ${fmtDate(busiest.day)}` : "nobody away on any day"}</span>
          </div>
          {types.map((t) => {
            const n = inMonth.filter((l) => l.typeKey === t.key).reduce((s, l) => s + leaveDays(l, cal, win), 0);
            return (
              <div className="tot" key={t.key} style={{ ["--c" as string]: typeColorVar(t.colorIndex) }}>
                <span className="eyebrow">
                  <i className="dot" />
                  {t.label}
                </span>
                <span className="big num">{n}</span>
                <span className="hint">days this month</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="block">
        <div className="sec-head">
          <h3>By day</h3>
          <span className="hint">Working days only. Taller stacks mean more people out on the same day.</span>
        </div>
        <div className="daystrip">
          {days.map((k) => {
            const d = parseDate(k);
            const off = !isWorkingDay(d, cal);
            const ls = perDay.get(k) ?? [];
            return (
              <div
                key={k}
                className={["dsd", off ? "off" : "", k === today ? "today" : "", ls.length >= 2 ? "busy" : ""].filter(Boolean).join(" ")}
                title={holidays[k] ?? (off ? "Weekend" : ls.map((l) => l.userName).join(", ") || "Nobody away")}
              >
                <span className="dsn num">{d.getDate()}</span>
                <span className="dsw">{DOW[d.getDay()].slice(0, 1)}</span>
                <span className="dsstack">
                  {ls.map((l) => (
                    <i key={l.id} style={{ background: typeColorVar(typeOf(l.typeKey)?.colorIndex ?? 0) }} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="block">
        <div className="sec-head">
          <h3>By person</h3>
        </div>
        <div className="list">
          {people.length ? (
            people.map(([uid, p]) => (
              <div className="person open" key={uid}>
                <div className="prow static">
                  <Avatar id={uid} name={p.name} />
                  <div className="t">
                    <div className="l1">{p.name}</div>
                    <div className="l2">
                      {p.items.length} {p.items.length === 1 ? "entry" : "entries"}
                    </div>
                  </div>
                  <div className="pstats">
                    <span className="num big">{p.days}</span>
                    <span className="hint">{p.days === 1 ? "day" : "days"} this month</span>
                  </div>
                </div>
                <div className="pdetail plist">
                  {p.items
                    .sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1))
                    .map((l) => {
                      const t = typeOf(l.typeKey);
                      const n = leaveDays(l, cal, win);
                      const full = leaveDays(l, cal);
                      return (
                        <div className="wp" key={l.id} style={{ ["--c" as string]: typeColorVar(t?.colorIndex ?? 0) }}>
                          <i />
                          <span>{t?.label ?? l.typeKey}</span>
                          <small>
                            {fmtRange(l.fromDate, l.toDate)} · {fmtDays(n)}
                            {full !== n ? ` of ${fmtDays(full)} (rest in another month)` : ""}
                            {l.note ? ` · ${l.note}` : ""}
                          </small>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Nobody has leave in {MONTHS[month - 1]}.</div>
          )}
        </div>
      </section>
    </>
  );
}
