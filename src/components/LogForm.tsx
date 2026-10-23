"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { logLeave, type FormState, type LeaveDTO } from "@/lib/actions";
import { DOW, countWorkingDays, fmtDate, fmtDays, fmtRange, leaveDays, leaveYearOf, parseDate, isoDate, type WorkCalendar } from "@/lib/dates";
import { typeColorVar } from "@/lib/colors";
import DatePicker from "./DatePicker";

export type TypeInfo = { key: string; label: string; allowance: number; used: number; colorIndex: number };

export type Draft = { type: string; from: string; to: string; note: string };

const fmtDay = (iso: string) => `${DOW[parseDate(iso).getDay()]} ${fmtDate(iso)}`;

export default function LogForm({
  types,
  cal,
  today,
  year,
  yearStartMonth,
  mine,
  draft,
  onChange,
  onLogged,
  onClose,
  onPickOnCalendar,
}: {
  types: TypeInfo[];
  cal: WorkCalendar;
  today: string;
  year: number;
  yearStartMonth: number;
  mine: LeaveDTO[];
  draft: Draft;
  onChange: (d: Draft) => void;
  onLogged: (leave: LeaveDTO, message: string) => void;
  onClose?: () => void;
  onPickOnCalendar?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(logLeave, {});
  const lastHandled = useRef<number | null>(null);
  const [multi, setMulti] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [half, setHalf] = useState(false);
  const [done, setDone] = useState<{ text: string } | null>(null);
  const t = types.find((x) => x.key === draft.type);
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });

  // A range picked on the calendar opens the end-date field on its own.
  useEffect(() => {
    if (draft.from && draft.to && draft.to !== draft.from) setMulti(true);
  }, [draft.from, draft.to]);
  useEffect(() => {
    if (draft.note) setShowNote(true);
  }, [draft.note]);

  useEffect(() => {
    if (state.leave && lastHandled.current !== state.leave.id) {
      lastHandled.current = state.leave.id;
      const tt = types.find((x) => x.key === state.leave!.typeKey);
      const n = leaveDays(state.leave, cal);
      // `used` may or may not already include this leave, depending on render timing; only subtract it once.
      const counted = mine.some((l) => l.id === state.leave!.id);
      const left = tt ? tt.allowance - tt.used - (counted ? 0 : n) : null;
      setDone({
        text: `${fmtDays(n)} of ${tt?.label ?? state.leave.typeKey} on ${fmtRange(state.leave.fromDate, state.leave.toDate)}.${left !== null ? ` ${left} left.` : ""}`,
      });
      onLogged(state.leave, state.ok ?? "Logged.");
      onChange({ ...draft, from: today, to: today, note: "" });
      setMulti(false);
      setShowNote(false);
      setHalf(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Default the date to today so the summary shows at once.
  useEffect(() => {
    if (!draft.from) onChange({ ...draft, from: today, to: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.from]);

  const d0 = parseDate(today);
  const addDays = (n: number) => isoDate(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + n));
  const picks = [
    { label: "Yesterday", d: addDays(-1) },
    { label: "Today", d: today },
    { label: "Tomorrow", d: addDays(1) },
  ];
  const pick = (d: string) => {
    set({ from: d, to: d });
    setMulti(false);
  };
  const isHalf = half && !multi;

  /* ---- what will happen, worked out before submit ---- */
  const from = draft.from;
  const to = multi ? draft.to || draft.from : draft.from;
  let summary: React.ReactNode = null;
  let warn: { level: "error" | "warn"; text: string } | null = null;
  let days = 0;
  if (from && to) {
    if (to < from) warn = { level: "error", text: "The end date is before the start date." };
    else {
      const r = countWorkingDays(from, to, cal);
      days = isHalf ? Math.min(r.days, 0.5) : r.days;
      const overlap = mine.find((l) => from <= l.toDate && to >= l.fromDate);
      const left = t ? t.allowance - t.used - days : null;
      const sameYear = leaveYearOf(from, yearStartMonth) === year;
      summary = (
        <>
          <b style={{ color: t ? typeColorVar(t.colorIndex) : undefined }}>{t?.label}</b>
          {" · "}
          <span>{from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}`}</span>
          {" · "}
          <b>{fmtDays(days)}</b>
          {r.skippedHolidays ? <span className="hint">{` (skips ${r.skippedHolidays} holiday${r.skippedHolidays === 1 ? "" : "s"})`}</span> : null}
          {t && left !== null && sameYear ? <span className="hint">{` · ${left} left`}</span> : null}
        </>
      );
      if (days === 0)
        warn = {
          level: "error",
          text:
            from === to
              ? `${fmtDay(from)} is ${cal.holidays.has(from) ? "a public holiday" : "a weekend day"}, so nothing to log.`
              : "Those dates are all weekends or holidays, so nothing to log.",
        };
      else if (overlap)
        warn = { level: "error", text: `Overlaps leave you already logged (${fmtRange(overlap.fromDate, overlap.toDate)}). Remove that one first.` };
      else if (t && left !== null && left < 0 && sameYear)
        warn = { level: "warn", text: `This goes ${-left} day${-left === 1 ? "" : "s"} over your ${t.label.toLowerCase()} balance. You can still log it.` };
    }
  }
  const blocked = !from || !to || !t || warn?.level === "error";
  const buttonText = pending
    ? "Saving…"
    : blocked || !days
      ? "Log leave"
      : `Log ${days === 0.5 ? "half a day" : `${days} day${days === 1 ? "" : "s"}`} of ${t?.label}`;

  if (done) {
    return (
      <div className="req done" id="logform">
        <div className="sheet-head">
          <h2>Log leave</h2>
          {onClose ? (
            <button className="btn icon" type="button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          ) : null}
        </div>
        <div className="donebox">
          <span className="tick" aria-hidden>
            ✓
          </span>
          <div>
            <b>Logged.</b> {done.text}
          </div>
        </div>
        <div className="foot">
          <span className="hint">The calendar and your balance are updated.</span>
          <button className="btn" type="button" onClick={() => setDone(null)}>
            Log another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="req logbox"
      action={formAction}
      id="logform"
      onKeyDown={(e) => {
        if (e.key === "Escape" && onClose) onClose();
      }}
    >
      <div className="sheet-head">
        <span className="handle" aria-hidden />
        <h2>Log leave</h2>
        {onClose ? (
          <button className="btn icon" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        ) : null}
      </div>

      <div className="lrow">
        <span className="lk">Type</span>
        <div className="typepick" role="radiogroup" aria-label="Leave type">
          {types.map((x) => (
            <label key={x.key} className={`typechip${draft.type === x.key ? " on" : ""}`} style={{ ["--c" as string]: typeColorVar(x.colorIndex) }}>
              <input type="radio" name="type" value={x.key} checked={draft.type === x.key} onChange={() => set({ type: x.key })} />
              <i />
              {x.label}
              <span className="num">{x.allowance - x.used}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="lrow">
        <span className="lk">When</span>
        <div className="when">
          {!multi ? (
            <>
              {picks.map((p) => (
                <button key={p.label} type="button" className={`wbtn${from === p.d ? " on" : ""}`} onClick={() => pick(p.d)}>
                  {p.label}
                </button>
              ))}
              <DatePicker
                id="r-from"
                name="from"
                value={draft.from}
                onChange={(v) => set({ from: v, to: v })}
                weekend={cal.weekend}
                holidays={cal.holidays}
                today={today}
                ariaLabel="Date"
              />
              <input type="hidden" name="to" value={draft.from} />
            </>
          ) : (
            <>
              <DatePicker
                id="r-from"
                name="from"
                value={draft.from}
                onChange={(v) => set({ from: v, to: !draft.to || draft.to < v ? v : draft.to })}
                weekend={cal.weekend}
                holidays={cal.holidays}
                today={today}
                ariaLabel="From"
              />
              <span className="arrow" aria-hidden>
                →
              </span>
              <DatePicker
                id="r-to"
                name="to"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(v) => set({ to: v })}
                weekend={cal.weekend}
                holidays={cal.holidays}
                today={today}
                ariaLabel="To"
                align="right"
              />
            </>
          )}
          {onPickOnCalendar ? (
            <button type="button" className="wbtn icon" onClick={onPickOnCalendar} title="Pick the dates on the calendar below" aria-label="Pick on calendar">
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
                <path d="M9 14l2 2 4-4" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="lrow">
        <span className="lk">Extras</span>
        <div className="extras">
          <label
            className={`xchip${isHalf ? " on" : ""}${multi ? " disabled" : ""}`}
            title={multi ? "Half days apply to a single day" : "Count this as half a day"}
          >
            <input type="checkbox" name="half" value="1" checked={isHalf} disabled={multi} onChange={(e) => setHalf(e.target.checked)} />
            Half day
          </label>
          <label className={`xchip${multi ? " on" : ""}`} title="Log several days in one go">
            <input
              type="checkbox"
              checked={multi}
              onChange={(e) => {
                setMulti(e.target.checked);
                if (!e.target.checked) set({ to: draft.from });
                else setHalf(false);
              }}
            />
            End date
          </label>
          <label className={`xchip${showNote ? " on" : ""}`} title="Add a short note">
            <input
              type="checkbox"
              checked={showNote}
              onChange={(e) => {
                setShowNote(e.target.checked);
                if (!e.target.checked) set({ note: "" });
              }}
            />
            Note
          </label>
        </div>
      </div>
      {showNote ? (
        <div className="lrow">
          <span className="lk" />
          <input
            id="r-note"
            name="note"
            type="text"
            maxLength={140}
            placeholder="e.g. family trip, doctor"
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
            autoFocus
          />
        </div>
      ) : null}

      {warn ? <div className={`msg ${warn.level === "error" ? "error" : "warn"}`}>{warn.text}</div> : null}
      {state.error ? <div className="msg error">{state.error}</div> : null}
      <div className="lfoot">
        <div className="summary">{summary ?? <span className="hint">Pick a date to see the summary.</span>}</div>
        <button className="btn primary" type="submit" disabled={pending || blocked}>
          {buttonText}
        </button>
      </div>
    </form>
  );
}
