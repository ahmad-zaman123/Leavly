import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleConfig } from "@/backend/lib/google";

/** Starts Google sign-in: remembers a random state in a short-lived cookie and sends the person to Google. */
export async function GET(req: NextRequest) {
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(new URL("/login?error=google-off", req.url));
  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/google/callback", req.url).toString();
  const res = NextResponse.redirect(googleAuthUrl(cfg.clientId, redirectUri, state));
  res.cookies.set(GOOGLE_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
