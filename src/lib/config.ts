import path from "node:path";
export function config() {
  return {
    appUrl: process.env.APP_URL || "http://localhost:3000",
    dataDir: path.resolve(process.env.DATA_DIR || ".data"),
    production: process.env.NODE_ENV === "production",
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
  const required = [
    "SESSION_SECRET",
    "APP_URL",
    "S3_BUCKET",
    "PUBLIC_BUCKET",
    "PUBLIC_ASSET_URL",
    "CLAMAV_HOST",
    "EMAIL_FROM",
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
}
