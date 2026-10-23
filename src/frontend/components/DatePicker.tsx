"use client";

import { useEffect, useRef, useState } from "react";
import { DOW, MONTHS, fmtDate, isoDate, parseDate } from "@/backend/lib/dates";

/** A date field with its own month-grid popover, so the format and look are the same everywhere. */
export default function DatePicker({
  id,
  name,
  value,
  min,
  onChange,
  weekend,
  holidays,
  today,
  ariaLabel,
  align = "left",
}: {
  id: string;
  name: string;
  value: string;
  min?: string;
  onChange: (iso: string) => void;
  weekend: number[];
  holidays: Set<string>;
  today: string;
  ariaLabel: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const base = parseDate(value || today);
  const [ym, setYm] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const b = parseDate(value || today);
    setYm({ y: b.getFullYear(), m: b.getMonth() });
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const first = new Date(ym.y, ym.m, 1);
  const start = new Date(ym.y, ym.m, 1 - first.getDay());
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i >= 35 && d.getMonth() !== ym.m) break;
    cells.push(isoDate(d));
  }
  const pick = (k: string) => {
    onChange(k);
    setOpen(false);
  };
  const shift = (n: number) => setYm(({ y, m }) => ({ y: new Date(y, m + n, 1).getFullYear(), m: new Date(y, m + n, 1).getMonth() }));
  // Show the year only when it differs from today's, to keep the pill short.
  const label = value ? `${DOW[parseDate(value).getDay()]} ${fmtDate(value, value.slice(0, 4) !== today.slice(0, 4))}` : "Pick a date";

  return (
    <div className="dp" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        id={id}
        className={`dpbtn${value ? "" : " empty"}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${label}`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M8 2v3m8-3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
        <span>{label}</span>
      </button>
      {open ? (
        <div className={`dppop${align === "right" ? " right" : ""}`} role="dialog" aria-label="Choose a date">
          <div className="dphead">
            <button type="button" className="btn icon" onClick={() => shift(-1)} aria-label="Previous month">
              ‹
            </button>
            <strong>
              {MONTHS[ym.m]} {ym.y}
            </strong>
            <button type="button" className="btn icon" onClick={() => shift(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="dpdow">
            {DOW.map((d) => (
              <span key={d}>{d.slice(0, 2)}</span>
            ))}
          </div>
          <div className="dpgrid">
            {cells.map((k) => {
              const d = parseDate(k);
              const out = d.getMonth() !== ym.m;
              const disabled = !!min && k < min;
              const cls = [
                "dpd",
                out ? "out" : "",
                weekend.includes(d.getDay()) ? "off" : "",
                holidays.has(k) ? "hol" : "",
                k === today ? "today" : "",
                k === value ? "sel" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  type="button"
                  key={k}
                  className={cls}
                  disabled={disabled}
                  onClick={() => pick(k)}
                  title={holidays.has(k) ? "Public holiday" : undefined}
                  aria-label={fmtDate(k, true)}
                  aria-pressed={k === value}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="dpfoot">
            <button type="button" className="btn sm" onClick={() => pick(today)} disabled={!!min && today < min}>
              Today
            </button>
            <span className="hint">Shaded days are weekends or holidays.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
