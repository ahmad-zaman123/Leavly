import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

export const SESSION_COOKIE = "session";

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(s ?? "dev-secret-not-for-production");
}

export type Session = { uid: number; mustChangePassword?: boolean };

export async function createSession(uid: number, opts: { mustChangePassword?: boolean } = {}): Promise<void> {
  const token = await new SignJWT({ uid, mcp: opts.mustChangePassword ? 1 : 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(authSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    const uid = Number(payload.uid);
    return Number.isFinite(uid) ? { uid, mustChangePassword: payload.mcp === 1 } : null;
  } catch {
    return null;
  }
}

/** The signed-in, active user. Roles are read from the database, never from the cookie. */
export async function currentUser(): Promise<User | null> {
  const s = await getSession();
  if (!s) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, s.uid) });
  return u && u.active ? u : null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}
