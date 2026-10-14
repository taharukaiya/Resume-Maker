import { generateArticle } from "./article";
import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { audit } from "@/modules/auth/service";
import {
  activateRelease,
  buildRelease,
  type PublishPayload,
} from "@/modules/publishing/service";
import { randomUUID } from "node:crypto";
import { generateCvImport } from "./cv-import";
import { processStorageCleanup } from "./storage-cleanup";
type Job = {
  id: string;
  site_id: string;
  kind: "publish" | "abstract" | "cv-import";
  payload: Record<string, unknown>;
  attempts: number;
  lease_id: string;
};
async function generateAbstract(job: Job) {
  return generateArticle(job);
}
export async function processOneJob() {
  const database = await db();
  const leaseId = randomUUID();
  const job = await database.transaction(async (tx) => {
    await tx.query(
      "UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error='Worker interrupted; job lease expired.',locked_at=NULL WHERE status='running' AND locked_at<now()-interval '5 minutes'",
    );
    const [next] = await tx.query<Job>(
      "SELECT * FROM jobs WHERE status='queued' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    if (!next) return null;
    await tx.query(
      "UPDATE jobs SET status='running',attempts=attempts+1,locked_at=now(),lease_id=$1 WHERE id=$2",
      [leaseId, next.id],
    );
    return { ...next, lease_id: leaseId, attempts: next.attempts + 1 };
  });
  if (!job) return processStorageCleanup();
  const heartbeat = setInterval(() => {
    void database
      .query(
        "UPDATE jobs SET locked_at=now() WHERE id=$1 AND lease_id=$2 AND status='running'",
        [job.id, leaseId],
      )
      .catch(console.error);
  }, 30000);
  try {
    if (job.kind === "publish") {
      const payload = job.payload as unknown as PublishPayload;
      const manifest = await buildRelease(job.site_id, payload, job.id);
      await database.transaction(async (tx) => {
        const current = await tx.query(
          "SELECT id FROM jobs WHERE id=$1 AND lease_id=$2 AND status='running' FOR UPDATE",
          [job.id, leaseId],
        );
        invariant(current.length, 409, "Job lease expired.");
        await activateRelease(tx, manifest, payload.document);
        await audit(
          null,
          job.site_id,
          "portfolio.published",
          { releaseId: manifest.releaseId, revision: manifest.revision },
          tx,
        );
      });
    } else if (job.kind === "cv-import") await generateCvImport(job);
    else await generateAbstract(job);
    await database.query(
      "UPDATE jobs SET status='done',finished_at=now(),error=NULL WHERE id=$1 AND lease_id=$2",
      [job.id, leaseId],
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing failed.";
    console.error(`Job ${job.id} failed: ${message}`);
    await database.query(
      "UPDATE jobs SET status=$1,error=$2,available_at=now()+interval '30 seconds',finished_at=CASE WHEN $1='failed' THEN now() ELSE NULL END WHERE id=$3 AND lease_id=$4",
      [
        job.attempts >= 3 ? "failed" : "queued",
        message.slice(0, 1000),
        job.id,
        leaseId,
      ],
    );
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
const workerGlobal = globalThis as typeof globalThis & {
  brilliancyWorker?: ReturnType<typeof setInterval>;
  brilliancyBusy?: boolean;
};
export function startWorker() {
  if (workerGlobal.brilliancyWorker) return;
  workerGlobal.brilliancyWorker = setInterval(async () => {
    if (workerGlobal.brilliancyBusy) return;
    workerGlobal.brilliancyBusy = true;
    try {
      await processOneJob();
    } catch (error) {
      console.error(
        "Worker unavailable:",
        error instanceof Error ? error.message : "unknown",
      );
    } finally {
      workerGlobal.brilliancyBusy = false;
    }
  }, 2500);
  workerGlobal.brilliancyWorker.unref();
}
