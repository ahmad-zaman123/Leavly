"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/admin", label: "Team" },
    { href: "/admin/away", label: "Away" },
    { href: "/admin/settings", label: "Settings" },
  ];
  return (
    <nav className="tabs" aria-label="Admin sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={(t.href === "/admin" ? path === "/admin" : path.startsWith(t.href)) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
