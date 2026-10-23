"use client";

import { useActionState } from "react";
import PasswordInput from "./PasswordInput";
import type { FormState } from "@/lib/actions";

type Field = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  minLength?: number;
  autoFocus?: boolean;
};

export default function AuthForm({
  action,
  fields,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form className="auth" action={formAction}>
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === "password" ? (
            <PasswordInput
              id={`auth-${f.name}`}
              name={f.name}
              placeholder={f.placeholder}
              required={f.required ?? true}
              autoComplete={f.autoComplete}
              minLength={f.minLength}
              autoFocus={f.autoFocus}
            />
          ) : (
            <input
              id={`auth-${f.name}`}
              name={f.name}
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              required={f.required ?? true}
              autoComplete={f.autoComplete}
              autoFocus={f.autoFocus}
            />
          )}
          {f.hint ? <span className="hint">{f.hint}</span> : null}
        </label>
      ))}
      {state.error ? <div className="msg error">{state.error}</div> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
