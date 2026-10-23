"use client";

import { useState, type InputHTMLAttributes } from "react";

/** A password field with an eye button that reveals what was typed. */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span className="pwwrap">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
      >
        {show ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 8.6 3.5 10 7-0.5 1.2-1.3 2.4-2.3 3.4M6.6 6.6C4.6 8 3 9.9 2 12c1.4 3.5 5 7 10 7 1.5 0 2.9-.3 4.2-.9" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 12c1.4-3.5 5-7 10-7s8.6 3.5 10 7c-1.4 3.5-5 7-10 7S3.4 15.5 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
