import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import HeaderNav from "@/components/HeaderNav";
import ThemeSwitch from "@/components/ThemeSwitch";

export const metadata: Metadata = {
  title: "Leavly",
  description: "Office leave register with balances, a team calendar and approvals.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Leavly", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d6b76" },
    { media: "(prefers-color-scheme: dark)", color: "#0f151b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

// Light or dark only, no "follow the system" mode. First visit picks from the OS setting, then the choice is remembered.
const themeInit = `(function(){var t=null;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const profile = user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="top">
          <div className="wrap hbar">
            <Link href="/" className="brand" aria-label="Leavly home">
              <img src="/icon.svg" alt="" width={28} height={28} />
              <span>Leavly</span>
            </Link>
            {profile ? (
              <HeaderNav user={profile} />
            ) : (
              <div className="hnav">
                <ThemeSwitch />
              </div>
            )}
          </div>
        </header>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
