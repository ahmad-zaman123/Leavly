"use server";

import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/backend/db";
import { holidays, leaveTypes, leaves, settings, users } from "@/backend/db/schema";
import { clearSession, createSession, requireAdmin, requireUser } from "./auth";
import { countWorkingDays, fmtDate, fmtDays, fmtRange } from "./dates";
import { ensureDefaults, getConfig } from "./data";

export type LeaveDTO = { id: number; userId: number; userName: string; typeKey: string; fromDate: string; toDate: string; note: string; halfDay: boolean };
export type FormState = { error?: string; ok?: string; leave?: LeaveDTO };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

async function userCount(): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  return Number(n);
}

/* ---------- accounts ---------- */

/** Only the very first account can self-register. It becomes the admin. */
export async function setup(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name || !email || !password) return { error: "Name, email and password are all required." };
  if (!isEmail(email)) return { error: "That email address does not look right." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  await ensureDefaults();
  if ((await userCount()) > 0) return { error: "The ledger is already set up. Ask your admin to add you." };
  const passwordHash = await bcrypt.hash(password, 10);
  const [u] = await db.insert(users).values({ name, email, passwordHash, role: "admin", createdAt: new Date().toISOString() }).returning({ id: users.id });
  await createSession(u.id);
  redirect("/");
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const u = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return { error: "Wrong email or password." };
  if (!u.active) return { error: "This account has been deactivated. Ask your admin." };
  await createSession(u.id, { mustChangePassword: u.mustChangePassword });
  redirect(u.mustChangePassword ? "/welcome" : "/");
}

/** First sign-in with a starting password: choose your own, no current password needed. */
export async function setFirstPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (next.length < 8) return { error: "Use a password of at least 8 characters." };
  if (next !== confirm) return { error: "The two passwords do not match." };
  if (await bcrypt.compare(next, user.passwordHash)) return { error: "Choose something different from the starting password." };
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false })
    .where(eq(users.id, user.id));
  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is wrong." };
  if (next.length < 8) return { error: "Use a new password of at least 8 characters." };
  if (next !== confirm) return { error: "The two new passwords do not match." };
  if (next === current) return { error: "The new password is the same as the current one." };
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false })
    .where(eq(users.id, user.id));
  return { ok: "Password changed." };
}

/* ---------- leave ---------- */

export async function logLeave(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const cfg = await getConfig();
  const typeKey = str(fd, "type");
  const from = str(fd, "from");
  const to = str(fd, "to");
  const note = str(fd, "note").slice(0, 140);
  const halfDay = str(fd, "half") === "1" && from === to;
  if (!cfg.types.some((t) => t.key === typeKey)) return { error: "Pick a leave type." };
  if (!isDate(from) || !isDate(to)) return { error: "Pick both dates." };
  if (to < from) return { error: "The end date is before the start date." };
  const full = countWorkingDays(from, to, cfg.calendar).days;
  if (full === 0) return { error: "Those dates contain no working days." };
  const days = halfDay ? 0.5 : full;
  const clash = await db.query.leaves.findFirst({
    where: and(eq(leaves.userId, user.id), sql`${leaves.fromDate} <= ${to}`, sql`${leaves.toDate} >= ${from}`),
  });
  if (clash) return { error: `That overlaps leave you already logged (${fmtRange(clash.fromDate, clash.toDate)}).` };
  const [row] = await db
    .insert(leaves)
    .values({ userId: user.id, typeKey, fromDate: from, toDate: to, note, halfDay, createdAt: new Date().toISOString() })
    .returning({ id: leaves.id });
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  return {
    ok: `Logged ${fmtDays(days)}.`,
    leave: { id: row.id, userId: user.id, userName: user.name, typeKey, fromDate: from, toDate: to, note, halfDay },
  };
}

/** Removes a leave and hands it back so the page can offer Undo. */
export async function removeLeave(id: number): Promise<{ removed?: LeaveDTO; error?: string }> {
  const user = await requireUser();
  const l = await db.query.leaves.findFirst({ where: eq(leaves.id, Number(id)) });
  if (!l) return { error: "That leave is already gone." };
  if (l.userId !== user.id && user.role !== "admin") return { error: "You can only remove your own leave." };
  const owner = await db.query.users.findFirst({ where: eq(users.id, l.userId) });
  await db.delete(leaves).where(eq(leaves.id, l.id));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  return {
    removed: {
      id: l.id,
      userId: l.userId,
      userName: owner?.name ?? "",
      typeKey: l.typeKey,
      fromDate: l.fromDate,
      toDate: l.toDate,
      note: l.note,
      halfDay: l.halfDay,
    },
  };
}

/** Puts back a leave removed moments ago (Undo). */
export async function restoreLeave(data: LeaveDTO): Promise<{ leave?: LeaveDTO; error?: string }> {
  const user = await requireUser();
  if (data.userId !== user.id && user.role !== "admin") return { error: "Not allowed." };
  if (!isDate(data.fromDate) || !isDate(data.toDate) || data.toDate < data.fromDate) return { error: "Bad dates." };
  const clash = await db.query.leaves.findFirst({
    where: and(eq(leaves.userId, data.userId), sql`${leaves.fromDate} <= ${data.toDate}`, sql`${leaves.toDate} >= ${data.fromDate}`),
  });
  if (clash) return { error: "Those dates are taken again." };
  const [row] = await db
    .insert(leaves)
    .values({
      userId: data.userId,
      typeKey: String(data.typeKey),
      fromDate: data.fromDate,
      toDate: data.toDate,
      note: String(data.note ?? "").slice(0, 140),
      halfDay: !!data.halfDay && data.fromDate === data.toDate,
      createdAt: new Date().toISOString(),
    })
    .returning({ id: leaves.id });
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  return { leave: { ...data, id: row.id } };
}

/* ---------- admin: people ---------- */

export async function addUser(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = str(fd, "role") === "admin" ? "admin" : "member";
  if (!name || !email || !password) return { error: "Name, email and a starting password are all required." };
  if (!isEmail(email)) return { error: "That email address does not look right." };
  if (password.length < 8) return { error: "Use a starting password of at least 8 characters." };
  if (await db.query.users.findFirst({ where: eq(users.email, email) })) return { error: "Someone with that email already exists." };
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ name, email, passwordHash, role, mustChangePassword: true, createdAt: new Date().toISOString() });
  return { ok: `${name} added. Give them the email and starting password. They will be asked to choose their own password when they first sign in.` };
}

export async function setUserPassword(fd: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(fd.get("userId"));
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return;
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true })
    .where(eq(users.id, userId));
  revalidatePath("/admin", "layout");
}

export async function setAllowance(fd: FormData): Promise<void> {
  await requireAdmin();
  const userId = Number(fd.get("userId"));
  const typeKey = str(fd, "type");
  const raw = str(fd, "value");
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) return;
  const next = { ...(u.allowances ?? {}) };
  if (raw === "" || !Number.isFinite(Number(raw))) delete next[typeKey];
  else next[typeKey] = Number(raw);
  await db.update(users).set({ allowances: next }).where(eq(users.id, userId));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function setRole(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(fd.get("userId"));
  const role = str(fd, "role");
  if (role !== "admin" && role !== "member") return;
  if (userId === admin.id) return; // never demote yourself
  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin", "layout");
}

export async function setActive(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = Number(fd.get("userId"));
  const active = str(fd, "active") === "1";
  if (userId === admin.id) return;
  await db.update(users).set({ active }).where(eq(users.id, userId));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

/* ---------- admin: settings ---------- */

export async function addType(fd: FormData): Promise<void> {
  await requireAdmin();
  const label = str(fd, "label");
  const days = Number(fd.get("days"));
  if (!label) return;
  const key =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `type-${Date.now()}`;
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(leaveTypes);
  await db
    .insert(leaveTypes)
    .values({ key, label, days: Number.isFinite(days) ? days : 0, position: Number(n) })
    .onConflictDoNothing();
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function updateType(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const label = str(fd, "label");
  const days = Number(fd.get("days"));
  const patch: { label?: string; days?: number } = {};
  if (label) patch.label = label;
  if (Number.isFinite(days)) patch.days = days;
  if (Object.keys(patch).length) await db.update(leaveTypes).set(patch).where(eq(leaveTypes.id, id));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function deleteType(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(leaveTypes);
  if (Number(n) <= 1) return; // keep at least one type
  await db.delete(leaveTypes).where(eq(leaveTypes.id, id));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function setWeekend(fd: FormData): Promise<void> {
  await requireAdmin();
  const days = fd
    .getAll("day")
    .map(Number)
    .filter((n) => n >= 0 && n <= 6);
  await db.update(settings).set({ weekend: days }).where(eq(settings.id, 1));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function setYearStart(fd: FormData): Promise<void> {
  await requireAdmin();
  const m = Number(fd.get("month"));
  if (!Number.isInteger(m) || m < 1 || m > 12) return;
  await db.update(settings).set({ yearStartMonth: m }).where(eq(settings.id, 1));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function addHoliday(fd: FormData): Promise<void> {
  await requireAdmin();
  const date = str(fd, "date");
  const label = str(fd, "label") || "Public holiday";
  const yearly = str(fd, "yearly") === "1";
  if (!isDate(date)) return;
  await db.insert(holidays).values({ date, label, yearly }).onConflictDoNothing();
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function setHolidayYearly(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const yearly = str(fd, "yearly") === "1";
  await db.update(holidays).set({ yearly }).where(eq(holidays.id, id));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function deleteHoliday(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(fd.get("id"));
  await db.delete(holidays).where(eq(holidays.id, id));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}
