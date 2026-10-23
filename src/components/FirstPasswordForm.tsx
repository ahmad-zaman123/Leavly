"use client";

import { useActionState, useState } from "react";
import PasswordInput from "./PasswordInput";
import { setFirstPassword, type FormState } from "@/lib/actions";

export default function FirstPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setFirstPassword, {});
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  return (
    <form className="auth" action={formAction}>
      <label>
        New password
        <PasswordInput
          id="fp-next"
          name="next"
          autoComplete="new-password"
          minLength={8}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={tooShort || undefined}
          autoFocus
        />
      </label>
      <label>
        Confirm new password
        <PasswordInput
          id="fp-confirm"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch || undefined}
        />
      </label>
      {tooShort ? <div className="msg error">Use at least 8 characters.</div> : null}
      {mismatch ? <div className="msg error">The two passwords do not match.</div> : null}
      {state.error ? <div className="msg error">{state.error}</div> : null}
      <button className="btn primary" type="submit" disabled={pending || mismatch || tooShort || !next || !confirm}>
        {pending ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
