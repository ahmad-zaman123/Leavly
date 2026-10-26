"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import { logout } from "@/backend/lib/actions";


export type ProfileInfo = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
};

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICON = {
  key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L19 3m-3.5 3.5L18 9",
  out: "M10 17l5-5-5-5m5 5H3m9-9h7a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-7",
};

export default function ProfileMenu({ user }: { user: ProfileInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="pmenu" ref={ref}>
      <button type="button" className="ptrigger" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar id={user.id} name={user.name} className="sm" />
        <span className="pname">{user.name.split(" ")[0]}</span>
        <svg
          className="caret"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="pdrop" role="menu" aria-label="Account">
          <div className="pcardhead">
            <Avatar id={user.id} name={user.name} className="lg" />
            <div className="pwho">
              <div className="name">
                {user.name}
                {user.role === "admin" ? <span className="chip admin">Admin</span> : null}
              </div>
              <div className="hint">{user.email}</div>
            </div>
          </div>
          <div className="psep" />
          <Link href="/account" role="menuitem" className="pitem" ref={firstItem} onClick={() => setOpen(false)}>
            <Icon d={ICON.key} />
            Change password
          </Link>
          <div className="psep" />
          <form action={logout}>
            <button type="submit" role="menuitem" className="pitem danger">
              <Icon d={ICON.out} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
