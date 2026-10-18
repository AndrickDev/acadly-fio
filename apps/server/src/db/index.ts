import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { MIGRATIONS } from "./migrations";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
  kind: "pglite" | "postgres";
}

export interface DbOptions {
  /** Postgres de produção. Sem isso usa PGlite (Postgres embutido). */
  url?: string;
  /** Pasta de dados do PGlite. Vazio = memória (testes). */
  dataDir?: string;
}

export async function openDb(opts: DbOptions = {}): Promise<DbHandle> {
  let handle: DbHandle;
  if (opts.url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: opts.url, max: 10 });
    handle = { db: drizzle(pool, { schema }) as unknown as Db, close: () => pool.end(), kind: "postgres" };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(opts.dataDir);
    handle = { db: drizzle(client, { schema }) as unknown as Db, close: () => client.close(), kind: "pglite" };
  }
  await migrate(handle.db);
  return handle;
}

async function migrate(db: Db): Promise<void> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  for (const m of MIGRATIONS) {
    await db.transaction(async (tx) => {
      // lock evita duas instâncias migrando ao mesmo tempo no Postgres
      await tx.execute(sql`SELECT pg_advisory_xact_lock(7001)`);
      const done = await tx.execute(sql`SELECT 1 FROM _migrations WHERE id = ${m.id}`);
      if (rowsOf(done).length) return;
      // uma instrução por chamada: o protocolo estendido não aceita várias de uma vez
      for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await tx.execute(sql.raw(stmt));
      await tx.execute(sql`INSERT INTO _migrations (id) VALUES (${m.id})`);
    });
  }
}

/** pg devolve {rows}, PGlite também; normaliza. */
export function rowsOf(res: unknown): Record<string, unknown>[] {
  const r = res as { rows?: Record<string, unknown>[] };
  return r.rows ?? (Array.isArray(res) ? (res as Record<string, unknown>[]) : []);
}

export { schema };
