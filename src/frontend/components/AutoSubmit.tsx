"use client";

import type { ChangeEvent, InputHTMLAttributes, SelectHTMLAttributes } from "react";

/** An input that submits its enclosing form as soon as its value changes. */
export function AutoSubmitInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} onChange={(e: ChangeEvent<HTMLInputElement>) => e.currentTarget.form?.requestSubmit()} />;
}

export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e: ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit()} />;
}
