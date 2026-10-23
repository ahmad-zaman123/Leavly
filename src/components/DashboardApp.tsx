"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import LogForm, { type Draft, type TypeInfo } from "./LogForm";
import { removeLeave, restoreLeave, type LeaveDTO } from "@/lib/actions";
import {
  DOW,
  MONTHS,
  countWorkingDays,
  fmtDate,
  fmtDays,
  fmtRange,
  isoDate,
  isWorkingDay,
  leaveDays,
  leaveYearLabel,
  leaveYearOf,
  leaveYearSpan,
  leaveYearWindow,
  parseDate,
  type WorkCalendar,
} from "@/lib/dates";
import { typeColorVar } from "@/lib/colors";

export type TypeProp = { key: string; label: string; allowance: number; colorIndex: number };

type Props = {
  me: { id: number; name: string; email: string };
  types: TypeProp[];
  team: LeaveDTO[];
  holidays: Record<string, string>;
  weekend: number[];
  today: string;
  year: number;
  yearStartMonth: number;
  yearList: number[];
  showAll: boolean;
  /** Admins see everyone's leave on the calendar; members see only their own. */
  showTeam: boolean;
};

type Sel = { from: string; to: string };
type Toast = { msg: string; undo?: () => void; kind?: "ok" | "error" };

const addDays = (iso: string, n: number) => {
  const d = parseDate(iso);
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

export default function DashboardApp({ me, types, team, holidays, weekend, today, year, yearStartMonth, yearList, showAll, showTeam }: Props) {
  const router = useRouter();
  const cal: WorkCalendar = useMemo(() => ({ weekend, holidays: new Set(Object.keys(holidays)) }), [weekend, holidays]);

  /* ---- optimistic layer over server data ---- */
  const [extra, setExtra] = useState<LeaveDTO[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const leaves = useMemo(() => {
    const seen = new Set<number>();
    const out: LeaveDTO[] = [];
    for (const l of [...team, ...extra]) {
      if (seen.has(l.id) || removed.has(l.id)) continue;
      seen.add(l.id);
      out.push(l);
    }
    return out.sort((a, b) => (a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : 0));
  }, [team, extra, removed]);
  const mine = useMemo(() => leaves.filter((l) => l.userId === me.id), [leaves, me.id]);
  const typeOf = (key: string) => types.find((t) => t.key === key);
  const who = (l: LeaveDTO) => (showTeam ? (l.userId === me.id ? "You" : l.userName) : "");
  const yearWindow = useMemo(() => leaveYearWindow(year, yearStartMonth), [year, yearStartMonth]);
  const typeInfo: TypeInfo[] = useMemo(
    () =>
      types.map((t) => ({
        ...t,
        used: mine.filter((l) => l.typeKey === t.key).reduce((n, l) => n + leaveDays(l, cal, yearWindow), 0),
      })),
    [types, mine, cal, yearWindow],
  );
  const totalAllow = typeInfo.reduce((n, t) => n + t.allowance, 0);
  const totalUsed = typeInfo.reduce((n, t) => n + t.used, 0);

  /* ---- form draft, remembered type, sheet ---- */
  const [draft, setDraft] = useState<Draft>({ type: types[0]?.key ?? "", from: "", to: "", note: "" });
  useEffect(() => {
    try {
      const last = localStorage.getItem("lastType");
      if (last && types.some((t) => t.key === last)) setDraft((d) => ({ ...d, type: last }));
    } catch {}
  }, [types]);
  const changeDraft = (d: Draft) => {
    setDraft((prev) => {
      // Remember the type only when the person actually changed it, so the form's own
      // housekeeping writes (defaulting the date) never clobber the saved choice.
      if (d.type !== prev.type) {
        try {
          localStorage.setItem("lastType", d.type);
        } catch {}
      }
      return d;
    });
  };
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [picking, setPicking] = useState(false);
  const [hintSeen, setHintSeen] = useState(false);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("welcomeSeen") !== "1") setWelcome(true);
    } catch {}
  }, []);
  const dismissWelcome = () => {
    setWelcome(false);
    try {
      localStorage.setItem("welcomeSeen", "1");
    } catch {}
  };
  useEffect(() => {
    try {
      if (localStorage.getItem("calHintSeen") === "1") setHintSeen(true);
    } catch {}
  }, []);
  const markHintSeen = () => {
    setHintSeen(true);
    try {
      localStorage.setItem("calHintSeen", "1");
    } catch {}
  };
  const calRef = useRef<HTMLElement>(null);
  const pickOnCalendar = () => {
    setSheetOpen(false);
    setPicking(true);
    calRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => setPicking(false), 5000);
  };
  // Press L anywhere (outside a field) to jump to the log form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "l" && e.key !== "L") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      if (window.matchMedia("(max-width: 760px)").matches) setSheetOpen(true);
      else {
        document.getElementById("logform")?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => (document.getElementById("r-from") as HTMLInputElement | null)?.focus(), 300);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Swipe down on the sheet header closes it.
  const touchY = useRef<number | null>(null);
  const onSheetTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0].clientY;
  };
  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (touchY.current !== null && e.touches[0].clientY - touchY.current > 80) {
      touchY.current = null;
      setSheetOpen(false);
    }
  };
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // "/#logform" from the header: scroll to the form (desktop) or open the sheet (mobile).
  useEffect(() => {
    if (window.location.hash !== "#logform") return;
    if (window.matchMedia("(max-width: 760px)").matches) setSheetOpen(true);
    else document.getElementById("logform")?.scrollIntoView({ behavior: "smooth", block: "center" });
    history.replaceState(null, "", "/");
  }, []);

  /* ---- toast, highlight ---- */
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (t: Toast, ms = 6000) => {
    setToast(t);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [flashType, setFlashType] = useState<string | null>(null);

  /* ---- calendar state ---- */
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<string>(today); // any day inside the shown month/week
  const [sel, setSel] = useState<Sel | null>(null);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const dragged = useRef(false);
  const prevSel = useRef<Sel | null>(null);

  const cd = parseDate(cursor);
  const cy = cd.getFullYear();
  const cm = cd.getMonth();

  const onLogged = (leave: LeaveDTO, message: string) => {
    setExtra((x) => [...x, leave]);
    setHighlightId(leave.id);
    setFlashType(leave.typeKey);
    setCursor(leave.fromDate);
    setSel(null);
    setFocusDay(null);
    setSheetOpen(false);
    showToast({ msg: message, kind: "ok" }, 4000);
    window.setTimeout(() => {
      setHighlightId(null);
      setFlashType(null);
    }, 3000);
    router.refresh();
  };

  const doRemove = async (l: LeaveDTO) => {
    setRemoved((s) => new Set(s).add(l.id));
    const r = await removeLeave(l.id);
    if (r.error) {
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(l.id);
        return n;
      });
      showToast({ msg: r.error, kind: "error" });
      return;
    }
    const data = r.removed!;
    showToast({
      msg: `Removed ${fmtRange(data.fromDate, data.toDate)}.`,
      undo: async () => {
        setToast(null);
        const back = await restoreLeave(data);
        if (back.leave) {
          setExtra((x) => [...x, back.leave!]);
          showToast({ msg: "Restored.", kind: "ok" }, 3000);
          router.refresh();
        } else showToast({ msg: back.error ?? "Could not restore.", kind: "error" });
      },
    });
    router.refresh();
  };

  /* ---- selection handlers ---- */
  const applySelection = (s: Sel) => {
    changeDraft({ ...draft, from: s.from, to: s.to });
    if (isMobile) setSheetOpen(true);
  };
  const onDown = (day: string) => {
    prevSel.current = sel;
    anchor.current = day;
    dragged.current = false;
    setSel({ from: day, to: day });
    setFocusDay(day);
  };
  const onEnter = (day: string) => {
    if (!anchor.current) return;
    if (day !== anchor.current) dragged.current = true;
    const a = anchor.current;
    setSel(a <= day ? { from: a, to: day } : { from: day, to: a });
  };
  const onUp = (day: string) => {
    if (!anchor.current) return;
    setPicking(false);
    markHintSeen();
    let s: Sel;
    if (!dragged.current && prevSel.current && prevSel.current.from === prevSel.current.to && prevSel.current.from < day) {
      s = { from: prevSel.current.from, to: day }; // second tap extends the first
    } else {
      const a = anchor.current;
      s = a <= day ? { from: a, to: day } : { from: day, to: a };
    }
    anchor.current = null;
    setSel(s);
    setFocusDay(day);
    applySelection(s);
  };
  useEffect(() => {
    const up = () => {
      anchor.current = null;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  const clearSel = () => {
    setSel(null);
    setFocusDay(null);
  };

  /* ---- derived views ---- */
  const peopleOn = (day: string) => (isWorkingDay(parseDate(day), cal) ? leaves.filter((l) => day >= l.fromDate && day <= l.toDate) : []);

  const shift = (dir: 1 | -1) => {
    if (view === "month") setCursor(isoDate(new Date(cy, cm + dir, 1)));
    else setCursor(addDays(cursor, 7 * dir));
  };

  const monthCells: string[] = [];
  if (view === "month") {
    const first = new Date(cy, cm, 1);
    const start = new Date(cy, cm, 1 - first.getDay());
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (i >= 35 && d.getMonth() !== cm) break;
      monthCells.push(isoDate(d));
    }
  }
  const weekStart = addDays(cursor, -cd.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const title = view === "month" ? `${MONTHS[cm]} ${cy}` : `${fmtDate(weekStart)} – ${fmtDate(weekDays[6], true)}`;

  const awayInView = (() => {
    const days = view === "month" ? monthCells.filter((k) => parseDate(k).getMonth() === cm) : weekDays;
    const seen = new Map<number, LeaveDTO>();
    for (const k of days) for (const l of peopleOn(k)) if (!seen.has(l.id)) seen.set(l.id, l);
    return [...seen.values()];
  })();

  const upcomingAll = mine.filter((l) => l.toDate >= today).sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
  const upcomingTotal = upcomingAll.length;
  const upcoming = upcomingAll.slice(0, 3);

  const go = (patch: { year?: number; all?: boolean }) => {
    const y = patch.year ?? year;
    const a = patch.all ?? showAll;
    router.push(`/?year=${y}${a ? "&all=1" : ""}`);
  };

  const chip = (l: LeaveDTO, k: string) => {
    const t = typeOf(l.typeKey);
    const c = typeColorVar(t?.colorIndex ?? 0);
    if (!showTeam) {
      return (
        <span
          key={l.id + k}
          className={`mpill${l.id === highlightId ? " flash" : ""}`}
          style={{ ["--c" as string]: c }}
          title={`${t?.label ?? l.typeKey}${l.halfDay ? " · half day" : ""}${l.note ? ` · ${l.note}` : ""}`}
        >
          {t?.label ?? l.typeKey}
          {l.halfDay ? " ½" : ""}
        </span>
      );
    }
    return (
      <Avatar
        key={l.id + k}
        id={l.userId}
        name={l.userName}
        title={`${l.userName} · ${t?.label ?? l.typeKey}${l.halfDay ? " · half day" : ""}${l.note ? ` · ${l.note}` : ""}`}
        className={`${l.userId === me.id ? "me" : ""}${l.halfDay ? " half" : ""}${l.id === highlightId ? " flash" : ""}`}
        style={{ ["--c" as string]: c }}
      />
    );
  };

  const selDays = sel ? countWorkingDays(sel.from, sel.to, cal) : null;

  return (
    <>
      {welcome && mine.length === 0 ? (
        <div className="welcome">
          <div>
            <b>Welcome, {me.name.split(" ")[0]}.</b> This is your balance for {leaveYearSpan(year, yearStartMonth)}. Log leave in the box on the right, click a
            day on the calendar, or press <kbd>L</kbd>. Weekends and public holidays never count.
          </div>
          <button className="btn sm" type="button" onClick={dismissWelcome}>
            Got it
          </button>
        </div>
      ) : null}
      <div className="topgrid">
        <section className="block">
          <div className="sec-head">
            <h2>My balance</h2>
          </div>
          <div className="balance">
            <div className={`card hero${totalAllow - totalUsed < 0 ? " over" : ""}${flashType ? " flash" : ""}`}>
              <div className="herohead">
                <div className="eyebrow">Days left</div>
                <select id="year" className="yearsel" value={year} aria-label="Leave year" onChange={(e) => go({ year: Number(e.target.value) })}>
                  {yearList.map((y) => (
                    <option key={y} value={y}>
                      {leaveYearLabel(y, yearStartMonth)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="big">
                {totalAllow - totalUsed}
                <small> of {totalAllow}</small>
              </div>
              <div className="heronotes">
                {(() => {
                  const next = mine.filter((l) => l.toDate >= today).sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1))[0];
                  const last = mine.filter((l) => l.toDate < today).sort((a, b) => (a.toDate > b.toDate ? -1 : 1))[0];
                  const line = (l: LeaveDTO) => `${fmtRange(l.fromDate, l.toDate)} · ${typeOf(l.typeKey)?.label ?? l.typeKey}${l.halfDay ? " · half day" : ""}`;
                  return (
                    <>
                      <div>
                        <span className="k">Next</span> {next ? line(next) : "nothing planned"}
                      </div>
                      <div>
                        <span className="k">Last</span> {last ? line(last) : "none yet"}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="bar">
                {typeInfo.map((t) => (
                  <i
                    key={t.key}
                    style={{
                      width: `${totalAllow > 0 ? (t.used / totalAllow) * 100 : 0}%`,
                      background: `color-mix(in srgb, ${typeColorVar(t.colorIndex)} 70%, var(--hero-fg))`,
                    }}
                    title={`${t.label}: ${t.used} used`}
                  />
                ))}
              </div>
              <div className="sub">
                {totalUsed} used · {leaveYearSpan(year, yearStartMonth)}
              </div>
            </div>
            <div className="cards">
              {typeInfo.map((t) => {
                const rem = t.allowance - t.used;
                return (
                  <div
                    className={`card type${rem < 0 ? " over" : ""}${flashType === t.key ? " flash" : ""}`}
                    key={t.key}
                    style={{ ["--c" as string]: typeColorVar(t.colorIndex) }}
                  >
                    <div className="eyebrow">
                      <i className="dot" />
                      {t.label}
                    </div>
                    <div className="big">
                      {rem}
                      <small> / {t.allowance}</small>
                    </div>
                    <div className="sub">{t.used} used</div>
                    <div className="bar">
                      <i style={{ width: `${t.allowance > 0 ? Math.min(100, (t.used / t.allowance) * 100) : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className={`block logpanel${sheetOpen ? " open" : ""}`}
          aria-hidden={isMobile && !sheetOpen ? true : undefined}
          onTouchStart={onSheetTouchStart}
          onTouchMove={onSheetTouchMove}
        >
          <div className="sec-head desk">
            <h2 title="Shortcut: press L anywhere on this page to jump here">Log leave</h2>
          </div>
          <LogForm
            types={typeInfo}
            cal={cal}
            today={today}
            year={year}
            yearStartMonth={yearStartMonth}
            mine={mine}
            draft={draft}
            onChange={changeDraft}
            onLogged={onLogged}
            onClose={isMobile ? () => setSheetOpen(false) : undefined}
            onPickOnCalendar={pickOnCalendar}
          />
        </section>
        {sheetOpen ? <div className="scrim" onClick={() => setSheetOpen(false)} /> : null}
      </div>

      <section className={`block calsec${picking ? " picking" : ""}`} ref={calRef}>
        <div className="sec-head">
          <h2>{showTeam ? "Team calendar" : "Calendar"}</h2>
          <div className="tools">
            <div className="seg" role="group" aria-label="View">
              <button type="button" className={view === "month" ? "on" : ""} onClick={() => setView("month")}>
                Month
              </button>
              <button type="button" className={view === "week" ? "on" : ""} onClick={() => setView("week")}>
                Week
              </button>
            </div>
            <button className="btn icon" type="button" onClick={() => shift(-1)} aria-label="Previous">
              ‹
            </button>
            <strong className="caltitle">{title}</strong>
            <button className="btn icon" type="button" onClick={() => shift(1)} aria-label="Next">
              ›
            </button>
            <button className="btn sm" type="button" onClick={() => setCursor(today)}>
              Today
            </button>
          </div>
        </div>

        {picking ? (
          <div className="pickbanner">Click a day, or drag across several days, to set the dates.</div>
        ) : !hintSeen ? (
          <div className="hint calhint">Tip: click a day, or drag across days, to pick dates for a new leave.</div>
        ) : null}
        {view === "month" ? (
          <div className="cal">
            <div className="dow">
              {DOW.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid">
              {monthCells.map((k) => {
                const d = parseDate(k);
                const out = d.getMonth() !== cm;
                const hol = holidays[k];
                const we = weekend.includes(d.getDay());
                const inSel = sel && k >= sel.from && k <= sel.to;
                const cls = [
                  "d",
                  out ? "out" : "",
                  we ? "off" : "",
                  hol ? "hol" : "",
                  k === today ? "today" : "",
                  k < today ? "past" : "",
                  inSel ? "sel" : "",
                  k === focusDay ? "focus" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const people = peopleOn(k);
                return (
                  <div
                    className={cls}
                    key={k}
                    role="button"
                    tabIndex={0}
                    aria-label={`${fmtDate(k, true)}${hol ? ", " + hol : ""}${people.length ? ", " + people.length + " away" : ""}`}
                    onPointerDown={(e) => {
                      if (e.button === 0) onDown(k);
                    }}
                    onPointerEnter={() => onEnter(k)}
                    onPointerUp={() => onUp(k)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDown(k);
                        onUp(k);
                      }
                    }}
                  >
                    <div className="n">
                      <span>{d.getDate()}</span>
                      {people.length > 3 ? <em>{people.length}</em> : null}
                    </div>
                    {hol ? (
                      <div className="hn" title={hol}>
                        {hol}
                      </div>
                    ) : (
                      <div />
                    )}
                    <div className="people">{people.map((l) => chip(l, k))}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="cal week">
            <div className="wgrid">
              {weekDays.map((k) => {
                const d = parseDate(k);
                const hol = holidays[k];
                const we = weekend.includes(d.getDay());
                const people = peopleOn(k);
                const inSel = sel && k >= sel.from && k <= sel.to;
                return (
                  <div key={k} className={["wd", we ? "off" : "", hol ? "hol" : "", k === today ? "today" : "", inSel ? "sel" : ""].filter(Boolean).join(" ")}>
                    <button type="button" className="wh" onPointerDown={() => onDown(k)} onPointerUp={() => onUp(k)}>
                      <span className="eyebrow">{DOW[d.getDay()]}</span>
                      <span className="num">{d.getDate()}</span>
                    </button>
                    {hol ? <div className="hn">{hol}</div> : null}
                    <div className="wlist">
                      {we ? (
                        <span className="hint">Weekend</span>
                      ) : people.length ? (
                        people.map((l) =>
                          showTeam ? (
                            <div
                              key={l.id}
                              className={`wp${l.id === highlightId ? " flash" : ""}`}
                              style={{ ["--c" as string]: typeColorVar(typeOf(l.typeKey)?.colorIndex ?? 0) }}
                            >
                              <Avatar
                                id={l.userId}
                                name={l.userName}
                                className={`sm${l.userId === me.id ? " me" : ""}`}
                                style={{ ["--c" as string]: typeColorVar(typeOf(l.typeKey)?.colorIndex ?? 0) }}
                              />
                              <span>{who(l)}</span>
                              <small>
                                {typeOf(l.typeKey)?.label}
                                {l.halfDay ? " · ½" : ""}
                              </small>
                            </div>
                          ) : (
                            chip(l, k)
                          ),
                        )
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(() => {
          const daysInView = view === "month" ? monthCells.filter((k) => parseDate(k).getMonth() === cm) : weekDays;
          const typesInView = types.filter((t) => awayInView.some((l) => l.typeKey === t.key));
          const holidayInView = daysInView.some((k) => holidays[k]);
          const meInView = showTeam && awayInView.some((l) => l.userId === me.id);
          return (
            <div className="legend">
              {typesInView.map((t) => (
                <span key={t.key} style={{ ["--c" as string]: typeColorVar(t.colorIndex) }}>
                  <i />
                  {t.label}
                </span>
              ))}
              {holidayInView ? (
                <span>
                  <i className="h" />
                  Public holiday
                </span>
              ) : null}
              {meInView ? (
                <span>
                  <i className="you" />
                  You
                </span>
              ) : null}
              <span className="hint">Weekends and public holidays are never counted.</span>
            </div>
          );
        })()}
        {focusDay ? (
          <div className="daypanel">
            <div className="dp-head">
              <div>
                <strong>{sel && sel.from !== sel.to ? fmtRange(sel.from, sel.to) : fmtDate(focusDay, true)}</strong>
                {holidays[focusDay] ? <span className="pill hol"> {holidays[focusDay]}</span> : null}
                {weekend.includes(parseDate(focusDay).getDay()) ? <span className="pill off">weekend</span> : null}
                {selDays ? (
                  <span className="hint">
                    {" "}
                    · {selDays.days} working day{selDays.days === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className="inline">
                {selDays && selDays.days > 0 ? (
                  <button
                    className="btn sm primary"
                    type="button"
                    onClick={() => {
                      if (isMobile) setSheetOpen(true);
                      else document.getElementById("logform")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    Log leave for these dates
                  </button>
                ) : null}
                <button className="btn sm" type="button" onClick={clearSel}>
                  Clear
                </button>
              </div>
            </div>
            <div className="dp-body">
              {peopleOn(focusDay).length ? (
                peopleOn(focusDay).map((l) => (
                  <div key={l.id} className="wp" style={{ ["--c" as string]: typeColorVar(typeOf(l.typeKey)?.colorIndex ?? 0) }}>
                    {showTeam ? <Avatar id={l.userId} name={l.userName} className="sm" /> : null}
                    {showTeam ? <span>{who(l)}</span> : null}
                    <small>
                      {typeOf(l.typeKey)?.label} · {fmtRange(l.fromDate, l.toDate)}
                      {l.halfDay ? " · half day" : ""}
                      {l.note ? ` · ${l.note}` : ""}
                    </small>
                  </div>
                ))
              ) : (
                <span className="hint">
                  {isWorkingDay(parseDate(focusDay), cal) ? (showTeam ? "Nobody is away on this day." : "No leave on this day.") : "Not a working day."}
                </span>
              )}
            </div>
          </div>
        ) : null}

        {showTeam ? (
          <div className="list">
            <div className="sec-head" style={{ marginTop: 6 }}>
              <div className="eyebrow">Away this {view}</div>
              <Link href={`/admin/away?month=${cy}-${String(cm + 1).padStart(2, "0")}`} className="btn link">
                See the whole month →
              </Link>
            </div>
            {awayInView.length ? (
              <>
                {awayInView.map((l) => (
                  <div
                    className={`item${l.id === highlightId ? " flash" : ""}`}
                    key={l.id}
                    style={{ ["--c" as string]: typeColorVar(typeOf(l.typeKey)?.colorIndex ?? 0) }}
                  >
                    <Avatar id={l.userId} name={l.userName} />
                    <div className="t">
                      <div className="l1">
                        {showTeam ? <>{who(l)} · </> : null}
                        <span className="tname">{typeOf(l.typeKey)?.label ?? l.typeKey}</span>
                      </div>
                      <div className="l2">
                        <span className="num">{fmtRange(l.fromDate, l.toDate)}</span> · {fmtDays(leaveDays(l, cal))}
                        {l.note ? ` · ${l.note}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="hint">Nobody is away this {view}.</div>
            )}
          </div>
        ) : null}
      </section>

      <section className="block">
        <div className="sec-head">
          <h2>Upcoming</h2>
          <Link href="/leaves" className="btn link">
            See all my leaves →
          </Link>
        </div>
        <div className="list">
          {upcoming.length ? (
            upcoming.map((l) => {
              const t = typeOf(l.typeKey);
              const n = leaveDays(l, cal);
              return (
                <div className={`item${l.id === highlightId ? " flash" : ""}`} key={l.id} style={{ ["--c" as string]: typeColorVar(t?.colorIndex ?? 0) }}>
                  <span className="tdot" />
                  <div className="t">
                    <div className="l1">{t?.label ?? l.typeKey}</div>
                    <div className="l2">
                      <span className="num">{fmtRange(l.fromDate, l.toDate)}</span> · {fmtDays(n)}
                      {l.note ? ` · ${l.note}` : ""}
                    </div>
                  </div>
                  <div className="act">
                    <button className="btn sm" type="button" onClick={() => doRemove(l)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">
              {mine.length ? (
                <>
                  Nothing coming up. <Link href="/leaves">See past leaves.</Link>
                </>
              ) : (
                <>
                  Nothing logged yet. You have <b>{totalAllow}</b> days this leave year. Log your first leave above, or click a day on the calendar.
                </>
              )}
            </div>
          )}
          {upcomingTotal > upcoming.length ? (
            <div className="hint">
              <Link href="/leaves">{upcomingTotal - upcoming.length} more upcoming</Link>
            </div>
          ) : null}
        </div>
      </section>

      {!sheetOpen ? (
        <button className="fab" type="button" onClick={() => setSheetOpen(true)}>
          + Log leave
        </button>
      ) : null}

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
