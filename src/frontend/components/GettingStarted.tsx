"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type SetupStep = { key: string; label: string; done: boolean; href?: string; hint?: string };

const KEY = "leavly.setup-dismissed";

/**
 * First-run checklist for the admin: what to set up before the team arrives.
 * Steps tick themselves off from real data; "Dismiss" hides it on this browser.
 */
export default function GettingStarted({ steps }: { steps: SetupStep[] }) {
  // Start hidden so a dismissed card never flashes before the effect reads localStorage.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };
  if (!show) return null;
  const left = steps.filter((s) => !s.done).length;
  return (
    <section className="welcome setup" aria-labelledby="setup-h">
      <div className="setup-head">
        <div>
          <b id="setup-h">Getting started</b>
          <span className="hint"> {left === 0 ? "All set." : `${left} step${left === 1 ? "" : "s"} to go.`}</span>
        </div>
        <button type="button" className="btn sm" onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <ol className="setup-list">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? "done" : ""}>
            <span className="setup-mark" aria-hidden="true">
              {s.done ? "✓" : ""}
            </span>
            <span className="setup-text">
              <span className="setup-label">{s.href && !s.done ? <Link href={s.href}>{s.label}</Link> : s.label}</span>
              {s.hint ? <span className="hint"> {s.hint}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
