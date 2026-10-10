export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { assertProductionConfig } = await import("./lib/config");
    assertProductionConfig();
    if (process.env.RUN_WORKER === "true") {
      const { startWorker } = await import("./modules/jobs/worker");
      startWorker();
    }
  }
}
