import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { db, type Sql } from "./db";
import { putDemoObject } from "./demo-storage";
function keyPath(key: string) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(key) ||
    key.split("/").some((p) => p === ".." || p === ".")
  )
    throw new Error("Invalid storage key");
  return path.join(config().dataDir, "storage", key);
}
const client = () => new S3Client({ region: config().region });
const bucketFor = (key: string) =>
  key.startsWith("releases/")
    ? config().publishBucket || config().bucket
    : config().bucket;
export async function putObject(
  key: string,
  body: Buffer | string,
  contentType: string,
  transaction?: Sql,
) {
  keyPath(key);
  if (config().demo) return putDemoObject(key, body, contentType, transaction);
  if (config().bucket) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucketFor(key),
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
    return;
  }
  const target = keyPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, body);
  await rename(temporary, target);
}
export async function getObject(key: string): Promise<Buffer | null> {
  keyPath(key);
  if (config().demo) {
    const [row] = await (
      await db()
    ).query<{ body: Uint8Array }>(
      "SELECT body FROM demo_objects WHERE key=$1",
      [key],
    );
    return row ? Buffer.from(row.body) : null;
  }
  if (config().bucket) {
    try {
      const object = await client().send(
        new GetObjectCommand({ Bucket: bucketFor(key), Key: key }),
      );
      return object.Body
        ? Buffer.from(await object.Body.transformToByteArray())
        : null;
    } catch (error) {
      if ((error as { name: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }
  try {
    return await readFile(keyPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function deleteObject(key: string, transaction?: Sql) {
  keyPath(key);
  if (config().demo) {
    await (transaction || (await db())).query(
      "DELETE FROM demo_objects WHERE key=$1",
      [key],
    );
    return;
  }
  if (config().bucket) {
    await client().send(
      new DeleteObjectCommand({ Bucket: bucketFor(key), Key: key }),
    );
    return;
  }
  try {
    await unlink(keyPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Only portfolio-scoped prefixes may be removed by the deletion outbox. */
export async function deletePortfolioFiles(prefix: string, transaction?: Sql) {
  if (!/^(private|releases)\/[0-9a-f-]{36}\/$/.test(prefix))
    throw new Error("Invalid portfolio cleanup prefix");
  if (config().demo) {
    await (transaction || (await db())).query(
      "DELETE FROM demo_objects WHERE starts_with(key,$1)",
      [prefix],
    );
    return;
  }
  const target = path.resolve(keyPath(prefix));
  const root = path.resolve(config().dataDir, "storage") + path.sep;
  if (!target.startsWith(root)) throw new Error("Cleanup escaped storage root");
  if (!config().bucket) {
    await rm(target, { recursive: true, force: true });
    return;
  }
  // Re-list the first page after deletion; this also resumes safely after a crash.
  const s3 = client();
  while (true) {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketFor(prefix),
        Prefix: prefix,
        MaxKeys: 100,
      }),
    );
    if (!page.Contents?.length) break;
    for (const object of page.Contents)
      if (object.Key) await deleteObject(object.Key);
  }
}
