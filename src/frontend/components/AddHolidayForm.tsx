"use client";

import { useState } from "react";
import DatePicker from "./DatePicker";
import { addHoliday } from "@/backend/lib/actions";

export default function AddHolidayForm({ weekend, holidays, today }: { weekend: number[]; holidays: string[]; today: string }) {
  const [date, setDate] = useState("");
  const [key, setKey] = useState(0);
  return (
    <form
      className="holform"
      action={addHoliday}
      key={key}
      onSubmit={() => {
        // Clear the row after the server action runs so a second holiday can be added straight away.
        window.setTimeout(() => {
          setDate("");
          setKey((k) => k + 1);
        }, 400);
      }}
    >
      <DatePicker
        id="nh-date"
        name="date"
        value={date}
        onChange={setDate}
        weekend={weekend}
        holidays={new Set(holidays)}
        today={today}
        ariaLabel="Holiday date"
      />
      <div className="holname">
        <input type="text" name="label" placeholder="Name, e.g. Eid" aria-label="Holiday name" />
        <button className="btn sm primary" type="submit" disabled={!date}>
          Add
        </button>
      </div>
      <label className="halftick">
        <input type="checkbox" name="yearly" value="1" /> repeats every year
      </label>
    </form>
  );
}
