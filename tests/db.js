// Small database helper for the test runner: works with the embedded PGlite folder or a Postgres URL.
const path = require("path");
const bcrypt = require("bcryptjs");

const raw = (process.env.DATABASE_URL || "pglite://./pgdata-test").trim();
const remote = /^postgres(ql)?:\/\//.test(raw);

async function open() {
  if (remote) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: raw, max: 2, ssl: /localhost|127\.0\.0\.1/.test(raw) ? undefined : { rejectUnauthorized: false } });
    return { query: (sql, params) => pool.query(sql, params).then((r) => r.rows), close: () => pool.end() };
  }
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite(path.resolve(raw.replace(/^pglite:\/\//, "")));
  return { query: (sql, params) => db.query(sql, params).then((r) => r.rows), close: () => db.close() };
}

const QA = {
  admin: { email: "qa-admin@leavly-test.invalid", name: "QA Admin", password: "qa-admin-pass-123", role: "admin" },
  member: { email: "qa-member@leavly-test.invalid", name: "QA Member", password: "qa-member-pass-123", role: "member" },
};

/** Seeds config and the two QA accounts; idempotent. */
async function seed() {
  const db = await open();
  try {
    await db.query(
      "INSERT INTO settings (id, weekend, year_start_month) VALUES (1, '[0,6]'::jsonb, 7) ON CONFLICT (id) DO UPDATE SET weekend='[0,6]'::jsonb, year_start_month=7",
    );
    await db.query("DELETE FROM leave_types WHERE key NOT IN ('casual','sick')");
    await db.query(
      "INSERT INTO leave_types (key,label,days,position) VALUES ('casual','Casual',14,0),('sick','Sick',10,1) ON CONFLICT (key) DO UPDATE SET days = EXCLUDED.days",
    );
    await db.query("DELETE FROM holidays");
    for (const [d, l] of [
      ["2026-08-14", "Independence Day"],
      ["2026-11-09", "Iqbal Day"],
      ["2026-12-25", "Quaid-e-Azam Day"],
    ])
      await db.query("INSERT INTO holidays (date, label, yearly) VALUES ($1, $2, true) ON CONFLICT (date) DO NOTHING", [d, l]);
    for (const u of Object.values(QA)) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.query(
        "INSERT INTO users (email,name,password_hash,role,active,must_change_password,created_at) VALUES ($1,$2,$3,$4,true,false,$5) ON CONFLICT (email) DO UPDATE SET password_hash=$3, role=$4, active=true, must_change_password=false, allowances=NULL",
        [u.email, u.name, hash, u.role, new Date().toISOString()],
      );
    }
    await db.query("DELETE FROM leaves WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@leavly-test.invalid' OR email LIKE '%@example.com')");
    await db.query("DELETE FROM users WHERE email LIKE '%@example.com'");
    await db.query("DELETE FROM login_attempts");
  } finally {
    await db.close();
  }
}

/** Removes everything the suite created. */
async function cleanup() {
  const db = await open();
  try {
    await db.query("DELETE FROM leaves WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@leavly-test.invalid' OR email LIKE '%@example.com')");
    await db.query("DELETE FROM users WHERE email LIKE '%@leavly-test.invalid' OR email LIKE '%@example.com'");
    await db.query("DELETE FROM holidays WHERE label NOT IN ('Independence Day','Iqbal Day','Quaid-e-Azam Day')");
    await db.query("DELETE FROM leave_types WHERE key NOT IN ('casual','sick')");
    await db.query("UPDATE settings SET weekend='[0,6]'::jsonb, year_start_month=7 WHERE id=1");
    await db.query("DELETE FROM login_attempts");
  } finally {
    await db.close();
  }
}

module.exports = { QA, seed, cleanup, remote, raw };

if (require.main === module) {
  const cmd = process.argv[2];
  (cmd === "cleanup" ? cleanup() : seed())
    .then(() => console.log(`db: ${cmd === "cleanup" ? "cleaned" : "seeded"} (${remote ? "postgres" : raw})`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
