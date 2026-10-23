"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "./PasswordInput";
import { addUser, type FormState } from "@/lib/actions";

export default function AddUserForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addUser, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const lastOk = useRef<string | undefined>(undefined);
  // Clear the fields after a successful add, but keep the form mounted so the message shows.
  useEffect(() => {
    if (state.ok && state.ok !== lastOk.current) {
      lastOk.current = state.ok;
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok]);
  return (
    <form className="req" action={formAction} ref={formRef}>
      <div className="row">
        <label>
          Full name
          <input id="nu-name" name="name" type="text" required autoComplete="off" />
        </label>
        <label>
          Email
          <input id="nu-email" name="email" type="email" required autoComplete="off" />
        </label>
      </div>
      <div className="row">
        <label>
          Starting password
          <PasswordInput id="nu-password" name="password" minLength={8} required autoComplete="off" placeholder="they can change it later" />
        </label>
        <label>
          Role
          <select id="nu-role" name="role" defaultValue="member">
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </div>
      {!pending && state.error ? <div className="msg error">{state.error}</div> : null}
      {!pending && state.ok ? <div className="msg ok">{state.ok}</div> : null}
      <div className="foot">
        <span className="hint">Tell them the email and starting password. Nothing is emailed.</span>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add person"}
        </button>
      </div>
    </form>
  );
}
