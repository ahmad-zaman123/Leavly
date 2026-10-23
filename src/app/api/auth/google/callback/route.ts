import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { createSession } from "@/backend/lib/auth";
import { GOOGLE_STATE_COOKIE, googleConfig, googleEmailFromCode } from "@/backend/lib/google";

/** Google sends the person back here. Only emails an admin has already added can sign in. */
export async function GET(req: NextRequest) {
  const cfg = googleConfig();
  const url = new URL(req.url);
  const back = (error: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  };
  if (!cfg) return back("google-off");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return back("google-failed");
  const redirectUri = new URL("/api/auth/google/callback", req.url).toString();
  const email = await googleEmailFromCode(code, redirectUri, cfg);
  if (!email) return back("google-failed");
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return back("not-invited");
  if (!user.active) return back("deactivated");
  // Signing in with Google proves who they are, so a starting password does not need replacing.
  if (user.mustChangePassword) await db.update(users).set({ mustChangePassword: false }).where(eq(users.id, user.id));
  await createSession(user.id);
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  return res;
}
