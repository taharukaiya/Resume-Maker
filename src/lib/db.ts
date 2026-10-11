import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { config } from "./config";
import { loadDatabaseCredentials } from "./database-credentials";
export type Sql = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
};
export type Database = Sql & {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};
const globals = globalThis as typeof globalThis & {
  brilliancyDb?: Promise<Database>;
};
export async function migrate(database: Database) {
  await database.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(path.join(process.cwd(), "migrations")))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      path.join(process.cwd(), "migrations", name),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    await database.transaction(async (tx) => {
      await tx.query("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
      const previous = await tx.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (previous.length) {
        if (previous[0].checksum !== checksum)
          throw new Error(`Migration ${name} was modified after application.`);
        return;
      }
      // Migration files are trusted, checked-in source, never user input.
      for (const statement of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.query(statement);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    });
  }
}
async function connect(): Promise<Database> {
  await loadDatabaseCredentials();
  if (config().databaseUrl) {
    const pool = new Pool({
      connectionString: config().databaseUrl,
      max: config().demo ? 3 : 10,
      connectionTimeoutMillis: 10000,
    });
    return {
      query: async <T>(sql: string, params: unknown[] = []) =>
        (await pool.query(sql, params)).rows as T[],
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const value = await fn({
            query: async <T>(sql: string, params: unknown[] = []) =>
              (await client.query(sql, params)).rows as T[],
          });
          await client.query("COMMIT");
          return value;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (config().production)
    throw new Error(
      "Production requires PostgreSQL. Embedded PostgreSQL is for local development only.",
    );
  await mkdir(config().dataDir, { recursive: true });
  const pg = new PGlite(path.join(config().dataDir, "postgres"));
  await pg.waitReady;
  const database: Database = {
    query: async <T>(sql: string, params: unknown[] = []) =>
      (await pg.query<T>(sql, params)).rows,
    transaction: (fn) =>
      pg.transaction(async (tx) =>
        fn({
          query: async <T>(sql: string, params: unknown[] = []) =>
            (await tx.query<T>(sql, params)).rows,
        }),
      ),
    close: () => pg.close(),
  };
  await migrate(database);
  return database;
}
export function db() {
  return (globals.brilliancyDb ||= connect());
}
export async function closeDb() {
  if (globals.brilliancyDb) await (await globals.brilliancyDb).close();
  delete globals.brilliancyDb;
}
