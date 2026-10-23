"use client";

import { useActionState, useState } from "react";
import PasswordInput from "./PasswordInput";
import { changePassword, type FormState } from "@/backend/lib/actions";

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changePassword, {});
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  return (
    <form className="req" action={formAction} key={state.ok ?? "pw"}>
      <label>
        Current password
        <PasswordInput id="pw-current" name="current" autoComplete="current-password" required />
      </label>
      <div className="row">
        <label>
          New password
          <PasswordInput
            id="pw-next"
            name="next"
            autoComplete="new-password"
            minLength={8}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-invalid={tooShort || undefined}
          />
        </label>
        <label>
          Confirm new password
          <PasswordInput
            id="pw-confirm"
            name="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || undefined}
          />
        </label>
      </div>
      {tooShort ? <div className="msg error">Use at least 8 characters.</div> : null}
      {mismatch ? <div className="msg error">The two new passwords do not match.</div> : null}
      {state.error ? <div className="msg error">{state.error}</div> : null}
      {state.ok ? <div className="msg ok">{state.ok}</div> : null}
      <div className="foot">
        <span className="hint">At least 8 characters.</span>
        <button className="btn primary" type="submit" disabled={pending || mismatch || tooShort || !next || !confirm}>
          {pending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
