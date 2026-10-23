"use client";

import Link from "next/link";
import { useState } from "react";
import Avatar from "./Avatar";
import type { LeaveDTO } from "@/backend/lib/actions";
import { DOW, MONTHS, fmtDate, isWorkingDay, isoDate, parseDate, type WorkCalendar } from "@/backend/lib/dates";
import { typeColorVar } from "@/frontend/lib/colors";

type T = { key: string; label: string; colorIndex: number };

/** Who is off this week or this month, at the top of the admin Team tab. */
export default function ThisWeek({
  leaves,
  types,
  holidays,
  weekend,
  today,
}: {
  leaves: LeaveDTO[];
  types: T[];
  holidays: Record<string, string>;
  weekend: number[];
  today: string;
}) {
  const [range, setRange] = useState<"week" | "month">("week");
  const cal: WorkCalendar = { weekend, holidays: new Set(Object.keys(holidays)) };
  const d0 = parseDate(today);
  const weekStart = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - d0.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => isoDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)));
  const monthDays: string[] = [];
  for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d.getMonth() === d0.getMonth(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    monthDays.push(isoDate(d));
  const days = range === "week" ? weekDays : monthDays;
  const offOn = (k: string) => (isWorkingDay(parseDate(k), cal) ? leaves.filter((l) => k >= l.fromDate && k <= l.toDate) : []);
  const anyOff = days.some((k) => offOn(k).length);
  const typeOf = (key: string) => types.find((t) => t.key === key);
  const monthParam = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}`;

  return (
    <section className="block">
      <div className="sec-head">
        <h2>{range === "week" ? "This week" : "This month"}</h2>
        <div className="tools">
          <span className="hint">
            {range === "week" ? `${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6], true)}` : `${MONTHS[d0.getMonth()]} ${d0.getFullYear()}`}
            {anyOff ? "" : " · nobody is away"}
          </span>
          <div className="seg" role="group" aria-label="Range">
            <button type="button" className={range === "week" ? "on" : ""} onClick={() => setRange("week")}>
              Week
            </button>
            <button type="button" className={range === "month" ? "on" : ""} onClick={() => setRange("month")}>
              Month
            </button>
          </div>
          {range === "month" ? (
            <Link href={`/admin/away?month=${monthParam}`} className="btn link">
              Full report →
            </Link>
          ) : null}
        </div>
      </div>

      {range === "week" ? (
        <div className="weekstrip">
          {weekDays.map((k) => {
            const d = parseDate(k);
            const we = weekend.includes(d.getDay());
            const hol = holidays[k];
            const off = offOn(k);
            return (
              <div key={k} className={["ws", k === today ? "today" : "", we || hol ? "off" : ""].filter(Boolean).join(" ")}>
                <div className="wsh">
                  <span className="eyebrow">{DOW[d.getDay()]}</span>
                  <span className="num">{d.getDate()}</span>
                </div>
                {hol ? <div className="hn">{hol}</div> : null}
                <div className="wsb">
                  {off.map((l) => {
                    const t = typeOf(l.typeKey);
                    return (
                      <div
                        key={l.id}
                        className="wp"
                        style={{ ["--c" as string]: typeColorVar(t?.colorIndex ?? 0) }}
                        title={`${l.userName} · ${t?.label}${l.halfDay ? " · half day" : ""}`}
                      >
                        <Avatar id={l.userId} name={l.userName} className="sm" style={{ ["--c" as string]: typeColorVar(t?.colorIndex ?? 0) }} />
                        <span>{l.userName.split(" ")[0]}</span>
                        {l.halfDay ? <small>½</small> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="daystrip">
          {monthDays.map((k) => {
            const d = parseDate(k);
            const off = !isWorkingDay(d, cal);
            const ls = offOn(k);
            return (
              <div
                key={k}
                className={["dsd", off ? "off" : "", k === today ? "today" : "", ls.length >= 2 ? "busy" : ""].filter(Boolean).join(" ")}
                title={
                  holidays[k] ??
                  (off ? "Weekend" : ls.map((l) => `${l.userName} (${typeOf(l.typeKey)?.label}${l.halfDay ? ", half" : ""})`).join(", ") || "Nobody away")
                }
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
      )}
      {range === "month" ? (
        <div className="hint">One bar per person away that day, in the leave type's colour. Hover a day for names, or open the full report for the list.</div>
      ) : null}
    </section>
  );
}
