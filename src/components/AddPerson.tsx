"use client";

import { useState } from "react";
import AddUserForm from "./AddUserForm";

export default function AddPerson({ openByDefault }: { openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  return (
    <section className="block">
      <div className="sec-head">
        <h2>Add a person</h2>
        {!open ? (
          <button className="btn sm" type="button" onClick={() => setOpen(true)}>
            + Add
          </button>
        ) : openByDefault ? null : (
          <button className="btn sm link" type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        )}
      </div>
      {open ? (
        <AddUserForm />
      ) : (
        <div className="hint">Add a colleague by name and email with a starting password. They choose their own password on first sign-in.</div>
      )}
    </section>
  );
}
