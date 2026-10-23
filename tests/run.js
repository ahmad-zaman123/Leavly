// End-to-end runner: creates the tables, seeds QA accounts, starts a production server, runs the suite, cleans up.
// Usage: npm run test:e2e            (embedded database in ./pgdata-test)
//        DATABASE_URL=postgres://… npm run test:e2e   (against a real Postgres, e.g. a staging Supabase)
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const db = require("./db");

const PORT = Number(process.env.E2E_PORT || 3101);
const root = path.resolve(__dirname, "..");
const env = {
  ...process.env,
  DATABASE_URL: db.raw,
  AUTH_SECRET: process.env.AUTH_SECRET || "e2e-secret-0123456789abcdef",
  NODE_ENV: "production",
  PORT: String(PORT),
};

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env, shell: process.platform === "win32", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

(async () => {
  if (!process.env.E2E_SKIP_BUILD) {
    run("npx", ["drizzle-kit", "push"]);
    run("npm", ["run", "build"]);
  }
  await db.seed();
  const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  server.stdout.on("data", (d) => process.env.E2E_VERBOSE && process.stdout.write(d));
  server.stderr.on("data", (d) => process.stderr.write(d));
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + "/login");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  let code = 1;
  try {
    const r = spawnSync("node", [path.join(__dirname, "e2e.js")], { cwd: root, stdio: "inherit", env: { ...env, BASE: base } });
    code = r.status ?? 1;
  } finally {
    server.kill();
    await db.cleanup().catch((e) => console.error("cleanup failed:", e.message));
  }
  process.exit(code);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
