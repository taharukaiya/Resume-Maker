import { db, type Sql } from "./db";
import { invariant } from "./errors";

const maximum = 200 * 1024 * 1024;
/** Small, bounded demo only. Production continues to use object storage. */
export async function putDemoObject(
  key: string,
  body: Buffer | string,
  contentType: string,
  transaction?: Sql,
) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const write = async (tx: Sql) => {
    await tx.query(
      "INSERT INTO settings(key,value) VALUES('demo_storage_quota','{}') ON CONFLICT(key) DO NOTHING",
    );
    await tx.query(
      "SELECT key FROM settings WHERE key='demo_storage_quota' FOR UPDATE",
    );
    const [usage] = await tx.query<{ total: string }>(
      "SELECT COALESCE(SUM(bytes),0) AS total FROM demo_objects WHERE key<>$1",
      [key],
    );
    invariant(
      Number(usage.total) + bytes.length <= maximum,
      413,
      "The demo's 200 MB total file allowance is full (including published copies). Remove unused drafts or move to production storage.",
    );
    await tx.query(
      "INSERT INTO demo_objects(key,body,bytes,content_type) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO UPDATE SET body=EXCLUDED.body,bytes=EXCLUDED.bytes,content_type=EXCLUDED.content_type,updated_at=now()",
      [key, bytes, bytes.length, contentType],
    );
  };
  if (transaction) await write(transaction);
  else await (await db()).transaction(write);
}
