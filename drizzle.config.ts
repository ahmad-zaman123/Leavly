import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "pglite://./pgdata";
const remote = /^postgres(ql)?:\/\//.test(url);

export default defineConfig(
  remote
    ? { schema: "./src/backend/db/schema.ts", out: "./drizzle", dialect: "postgresql", dbCredentials: { url } }
    : { schema: "./src/backend/db/schema.ts", out: "./drizzle", dialect: "postgresql", driver: "pglite", dbCredentials: { url: url.replace(/^pglite:\/\//, "") } },
);
