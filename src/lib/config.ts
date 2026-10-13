import path from "node:path";
export function config() {
  return {
    appUrl:
      process.env.APP_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://localhost:3000",
    dataDir: path.resolve(process.env.DATA_DIR || ".data"),
    production: process.env.NODE_ENV === "production",
    demo: process.env.DEPLOYMENT_MODE === "demo",
    vps: process.env.DEPLOYMENT_MODE === "vps",
    databaseUrl: process.env.DATABASE_URL,
    bucket: process.env.S3_BUCKET,
    publishBucket: process.env.PUBLIC_BUCKET,
    region: process.env.AWS_REGION || "ap-southeast-1",
    assetUrl: process.env.PUBLIC_ASSET_URL,
    secret: process.env.SESSION_SECRET,
  };
}
export function assertProductionConfig() {
  if (!config().production) return;
  if (![undefined, "", "demo", "vps"].includes(process.env.DEPLOYMENT_MODE))
    throw new Error(
      "Unknown DEPLOYMENT_MODE. Use vps, demo, or leave blank for AWS.",
    );
  const retention = Number(process.env.RELEASE_RETENTION || 0);
  if (
    !Number.isInteger(retention) ||
    (retention !== 0 && (retention < 3 || retention > 100))
  )
    throw new Error(
      "RELEASE_RETENTION must be 0 (unlimited) or an integer from 3 to 100.",
    );
  if (config().demo) {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "The hosted demo requires PostgreSQL; local files are not durable on free hosting.",
      );
    if (
      process.env.S3_BUCKET ||
      process.env.PUBLIC_BUCKET ||
      process.env.DATABASE_SECRET_ARN
    )
      throw new Error(
        "Use an isolated demo database. Do not attach production AWS resources to demo mode.",
      );
    if (
      !config().appUrl.startsWith("https://") ||
      (config().secret?.length || 0) < 32
    )
      throw new Error(
        "The hosted demo requires an HTTPS APP_URL and a SESSION_SECRET of at least 32 characters.",
      );
    return;
  }
  const required = [
    "SESSION_SECRET",
    "APP_URL",
    "PUBLIC_ASSET_URL",
    "CLAMAV_HOST",
    "EMAIL_FROM",
    ...(config().vps
      ? ["DATA_DIR", "DATABASE_URL"]
      : ["S3_BUCKET", "PUBLIC_BUCKET"]),
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (
    !process.env.DATABASE_URL &&
    !(process.env.DATABASE_SECRET_ARN && process.env.DATABASE_HOST)
  )
    missing.push("DATABASE_URL or DATABASE_SECRET_ARN + DATABASE_HOST");
  if (missing.length)
    throw new Error(`Production configuration missing: ${missing.join(", ")}`);
  if (!config().appUrl.startsWith("https://"))
    throw new Error("APP_URL must use HTTPS in production.");
  if ((config().secret?.length || 0) < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  for (const key of ["APP_URL", "PUBLIC_ASSET_URL"]) {
    const url = new URL(process.env[key]!);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(
        `${key} must be an HTTPS origin without credentials or a path.`,
      );
  }
  if (new URL(config().appUrl).origin === new URL(config().assetUrl!).origin)
    throw new Error(
      "Use a separate PUBLIC_ASSET_URL origin for uploaded files.",
    );
  if (
    config().vps &&
    (config().bucket ||
      config().publishBucket ||
      !path.isAbsolute(process.env.DATA_DIR!))
  )
    throw new Error(
      "VPS mode requires an absolute persistent DATA_DIR and no S3 buckets.",
    );
}
