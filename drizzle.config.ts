import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:local.db";
const remote = url.startsWith("libsql://") || url.startsWith("https://");

export default defineConfig(
  remote
    ? {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN ?? "" },
      }
    : {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: { url },
      },
);
