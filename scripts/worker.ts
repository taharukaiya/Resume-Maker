import "dotenv/config";
import { assertProductionConfig } from "../src/lib/config";
import { closeDb } from "../src/lib/db";
import { processOneJob } from "../src/modules/jobs/worker";
if (!process.env.DATABASE_URL && !process.env.DATABASE_SECRET_ARN)
  throw new Error(
    "A separate worker requires PostgreSQL. Use RUN_WORKER=true for embedded local development.",
  );
assertProductionConfig();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
while (!stopping) {
  try {
    if (!(await processOneJob()))
      await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    console.error(error);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
await closeDb();
