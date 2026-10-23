"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import { addHoliday } from "@/backend/lib/actions";
import { fmtDate } from "@/backend/lib/dates";

/**
 * A plain server form, like the other Settings controls. The parent keys it by the number of holidays,
 * so it clears itself once the new row has arrived. Duplicates are caught before submitting.
 */
export default function AddHolidayForm({ weekend, holidays, today }: { weekend: number[]; holidays: Record<string, string>; today: string }) {
  const [date, setDate] = useState("");
  const taken = date ? holidays[date] : undefined;
  return (
    <form className="holform" action={addHoliday}>
      <DatePicker
        id="nh-date"
        name="date"
        value={date}
        onChange={setDate}
        weekend={weekend}
        holidays={new Set(Object.keys(holidays))}
        today={today}
        ariaLabel="Holiday date"
      />
      <div className="holname">
        <input type="text" name="label" placeholder="Name, e.g. Eid" aria-label="Holiday name" />
        <button className="btn sm primary" type="submit" disabled={!date || !!taken}>
          Add
        </button>
      </div>
      <label className="halftick">
        <input type="checkbox" name="yearly" value="1" /> repeats every year
      </label>
      {taken ? (
        <div className="msg warn">
          {fmtDate(date, true)} is already a holiday ({taken}).
        </div>
      ) : null}
    </form>
  );
}
