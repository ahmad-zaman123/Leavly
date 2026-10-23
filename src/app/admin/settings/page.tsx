import AddHolidayForm from "@/components/AddHolidayForm";
import { AutoSubmitInput, AutoSubmitSelect } from "@/components/AutoSubmit";
import { addType, deleteHoliday, deleteType, setHolidayYearly, setWeekend, setYearStart, updateType } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { getConfig } from "@/lib/data";
import { DOW, MONTHS, fmtDate, leaveYearSpan, leaveYearOf, todayIso } from "@/lib/dates";
import { typeColorVar } from "@/lib/colors";

export default async function SettingsPage() {
  await requireAdmin();
  const cfg = await getConfig();
  const total = cfg.types.reduce((n, t) => n + t.days, 0);
  return (
    <>
      <section className="block">
        <div className="sec-head">
          <h2>Settings</h2>
          <span className="hint">Changes save as soon as you leave a field.</span>
        </div>
        <div className="setgrid">
          <div className="setcard">
            <h3>Leave types</h3>
            <div className="hint">
              Default days per person per year. Total <b className="num">{total}</b>.
            </div>
            {cfg.types.map((t, i) => (
              <div className="r type" key={t.id} style={{ ["--c" as string]: typeColorVar(i) }}>
                <form action={updateType} className="contents">
                  <input type="hidden" name="id" value={t.id} />
                  <i className="dot" />
                  <AutoSubmitInput type="text" name="label" defaultValue={t.label} aria-label="Type name" required />
                  <AutoSubmitInput type="number" name="days" min={0} step={0.5} defaultValue={t.days} aria-label="Days per year" />
                </form>
                <form action={deleteType} className="contents">
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    className="btn sm"
                    type="submit"
                    aria-label={`Remove ${t.label}`}
                    disabled={cfg.types.length <= 1}
                    title={cfg.types.length <= 1 ? "Keep at least one type" : "Remove this type"}
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
            <form className="r type add" action={addType} key={cfg.types.length}>
              <i className="dot dot-empty" />
              <input type="text" name="label" placeholder="New type, e.g. Study" required />
              <input type="number" name="days" min={0} step={0.5} placeholder="days" />
              <button className="btn sm" type="submit">
                Add
              </button>
            </form>
          </div>

          <div className="setcard">
            <h3>Leave year</h3>
            <div className="hint">Balances reset at the start of this month.</div>
            <form action={setYearStart} className="inline">
              <label className="hint" htmlFor="ys">
                Starts in
              </label>
              <AutoSubmitSelect id="ys" name="month" defaultValue={String(cfg.yearStartMonth)}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
            <div className="hint">
              Current leave year: <b>{leaveYearSpan(leaveYearOf(todayIso(), cfg.yearStartMonth), cfg.yearStartMonth)}</b>
            </div>
          </div>

          <div className="setcard">
            <h3>Weekend</h3>
            <div className="hint">These days never count as leave.</div>
            <form action={setWeekend} className="wk">
              {DOW.map((d, i) => (
                <label key={d}>
                  <AutoSubmitInput type="checkbox" name="day" value={i} defaultChecked={cfg.weekend.includes(i)} />
                  {d}
                </label>
              ))}
            </form>
          </div>

          <div className="setcard">
            <h3>Public holidays</h3>
            <div className="hint">Leave covering these dates is not deducted.</div>
            {cfg.holidays.length ? (
              cfg.holidays.map((h) => (
                <div className="r hol" key={h.id}>
                  <span className="holtext">
                    <span className="num">{h.yearly ? fmtDate(h.date) : fmtDate(h.date, true)}</span> · {h.label}
                  </span>
                  <form action={setHolidayYearly}>
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="yearly" value={h.yearly ? "0" : "1"} />
                    <button
                      className={`ytoggle${h.yearly ? " on" : ""}`}
                      type="submit"
                      title={h.yearly ? "Repeats every year. Click to make it a one-off." : "One-off. Click to repeat every year."}
                      aria-pressed={h.yearly}
                    >
                      {h.yearly ? "every year" : "once"}
                    </button>
                  </form>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="btn sm" type="submit" aria-label={`Remove ${h.label}`}>
                      ✕
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="empty">No holidays added yet.</div>
            )}
            <AddHolidayForm weekend={cfg.weekend} holidays={Object.keys(cfg.holidayMap)} today={todayIso()} />
          </div>
        </div>
      </section>
    </>
  );
}
