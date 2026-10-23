import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  allowances: text("allowances", { mode: "json" }).$type<Record<string, number>>(),
  /** Set when an admin gives someone a starting or reset password; cleared once they choose their own. */
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const leaveTypes = sqliteTable("leave_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  days: real("days").notNull().default(0),
  position: integer("position").notNull().default(0),
});

export const holidays = sqliteTable("holidays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  label: text("label").notNull(),
  /** Falls on the same day and month every year (the stored date is the first occurrence). */
  yearly: integer("yearly", { mode: "boolean" }).notNull().default(false),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  weekend: text("weekend", { mode: "json" }).$type<number[]>().notNull(),
  /** Month the leave year starts in, 1-12. 7 = July to June. */
  yearStartMonth: integer("year_start_month").notNull().default(7),
});

export const leaves = sqliteTable("leaves", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  typeKey: text("type_key").notNull(),
  fromDate: text("from_date").notNull(),
  toDate: text("to_date").notNull(),
  note: text("note").notNull().default(""),
  /** A single working day that counts as 0.5. Only meaningful when from and to are the same day. */
  halfDay: integer("half_day", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Leave = typeof leaves.$inferSelect;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
