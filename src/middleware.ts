import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/register", "/api/auth/"];

// A fresh nonce per request: only scripts carrying it (Next's own, and the ones in the layout) may run.
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://visitor-tracker-app.vercel.app",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
  ].join("; ");
}

// Same rule as the server: production never falls back to the development secret.
function sessionSecret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") return null;
  return new TextEncoder().encode(s ?? "dev-secret-not-for-production");
}

export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const res = await route(req, nonce, csp);
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

async function route(req: NextRequest, nonce: string, csp: string) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  const secret = sessionSecret();
  let signedIn = false;
  let mustChange = false;
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, secret);
      signedIn = true;
      mustChange = payload.mcp === 1;
    } catch {
      signedIn = false;
    }
  }
  // Next reads the nonce from the request's policy and puts it on its own scripts. The layout reads x-nonce.
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const next = () => NextResponse.next({ request: { headers } });

  // Static assets (icons, manifest) are public.
  if (/\.(webmanifest|png|svg|ico|jpg|jpeg|webp|txt)$/.test(pathname)) return next();
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  if (!signedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && isPublic && !pathname.startsWith("/api/auth/")) {
    const url = req.nextUrl.clone();
    url.pathname = mustChange ? "/welcome" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // A starting password must be replaced before anything else is used.
  if (signedIn && mustChange && pathname !== "/welcome") {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
