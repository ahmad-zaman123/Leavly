import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * One Postgres-flavoured database, two ways to reach it:
 *  - a real Postgres server (Supabase, Neon, local) when DATABASE_URL starts with postgres:// or postgresql://,
 *    through node-postgres, which behaves well with Supabase's connection pooler under parallel load
 *  - an embedded PGlite database in a local folder otherwise (DATABASE_URL=pglite://./pgdata), so local
 *    development needs no server at all
 */
export type Db = NodePgDatabase<typeof schema>;

const url = process.env.DATABASE_URL ?? "pglite://./pgdata";
export const isRemote = /^postgres(ql)?:\/\//.test(url);

const g = globalThis as unknown as { __leavlyDb?: Db };

function create(): Db {
  if (isRemote) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
    return drizzleNodePg(pool, { schema });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const dir = url.replace(/^pglite:\/\//, "");
  return drizzlePglite(new PGlite(dir), { schema }) as unknown as Db;
}

/** Created on first use, so importing this module (for example during `next build`) opens no connection. */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = g.__leavlyDb ?? (g.__leavlyDb = create());
    const v = Reflect.get(real as object, prop) as unknown;
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
