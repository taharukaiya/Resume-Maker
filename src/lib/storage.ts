import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
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
) {
  keyPath(key);
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
export async function deleteObject(key: string) {
  keyPath(key);
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
