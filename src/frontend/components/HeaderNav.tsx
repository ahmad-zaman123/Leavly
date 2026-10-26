"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileMenu, { type ProfileInfo } from "./ProfileMenu";
import ThemeSwitch from "./ThemeSwitch";

export default function HeaderNav({ user }: { user: ProfileInfo }) {
  const path = usePathname();
  const onDashboard = path === "/";
  return (
    <div className="hnav">
      <Link
        href="/#logform"
        className="btn primary sm logbtn"
        onClick={(e) => {
          if (!onDashboard) return;
          e.preventDefault();
          const el = document.getElementById("logform");
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => (document.getElementById("r-from") as HTMLElement | null)?.focus(), 400);
        }}
      >
        + Log leave
      </Link>
      <Link href="/leaves" className={`navpill${path.startsWith("/leaves") ? " on" : ""}`} aria-current={path.startsWith("/leaves") ? "page" : undefined}>
        My leaves
      </Link>
      {user.role === "admin" ? (
        <Link href="/admin" className={`navpill${path.startsWith("/admin") ? " on" : ""}`} aria-current={path.startsWith("/admin") ? "page" : undefined}>
          Admin
        </Link>
      ) : null}
      <ProfileMenu user={user} />
      <ThemeSwitch />
    </div>
  );
}
