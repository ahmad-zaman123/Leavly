"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark";
const MODES: { v: Mode; label: string; icon: string }[] = [
  { v: "light", label: "Light", icon: "☀" },
  { v: "dark", label: "Dark", icon: "☾" },
];

/** Three-way theme switch, used inside the profile menu. */
export default function ThemeSwitch() {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    // The inline script in the layout already set data-theme before paint; mirror it here.
    const cur = document.documentElement.getAttribute("data-theme");
    setMode(cur === "dark" ? "dark" : "light");
  }, []);
  const apply = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem("theme", m);
    } catch {}
    document.documentElement.setAttribute("data-theme", m);
  };
  return (
    <div className="themeswitch">
      <span className="hint">Theme</span>
      <div className="seg" role="group" aria-label="Theme">
        {MODES.map((m) => (
          <button key={m.v} type="button" className={mode === m.v ? "on" : ""} onClick={() => apply(m.v)} aria-pressed={mode === m.v}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
