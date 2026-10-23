import { pgTable, serial, text, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  active: boolean("active").notNull().default(true),
  allowances: jsonb("allowances").$type<Record<string, number>>(),
  /** Set when an admin gives someone a starting or reset password; cleared once they choose their own. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const leaveTypes = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  days: real("days").notNull().default(0),
  position: integer("position").notNull().default(0),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  label: text("label").notNull(),
  /** Falls on the same day and month every year (the stored date is the first occurrence). */
  yearly: boolean("yearly").notNull().default(false),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  weekend: jsonb("weekend").$type<number[]>().notNull(),
  /** Month the leave year starts in, 1-12. 7 = July to June. */
  yearStartMonth: integer("year_start_month").notNull().default(7),
});

export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  typeKey: text("type_key").notNull(),
  fromDate: text("from_date").notNull(),
  toDate: text("to_date").notNull(),
  note: text("note").notNull().default(""),
  /** A single working day that counts as 0.5. Only meaningful when from and to are the same day. */
  halfDay: boolean("half_day").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

/** Failed sign-in counter per email, so a password cannot be guessed by brute force. */
export const loginAttempts = pgTable("login_attempts", {
  email: text("email").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: text("locked_until"),
  updatedAt: text("updated_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Leave = typeof leaves.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
