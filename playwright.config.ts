import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3100",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      BRILLIANCY_E2E: "true",
      APP_URL: "http://localhost:3100",
      // Keep repeated runs isolated, including real login rate limits and uploads.
      DATA_DIR: path.resolve(`.test-data/browser-${Date.now()}-${process.pid}`),
      SETUP_TOKEN: "browser-test-bootstrap-only",
      SESSION_SECRET: "browser-test-only-secret-with-at-least-32-characters",
      RUN_WORKER: "true",
      DATABASE_URL: "",
      S3_BUCKET: "",
      PUBLIC_BUCKET: "",
      PUBLIC_ASSET_URL: "",
      DATABASE_SECRET_ARN: "",
      DATABASE_HOST: "",
      EMAIL_FROM: "",
      CLAMAV_HOST: "",
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      AI_PROVIDER: "openai",
      DEPLOYMENT_MODE: "",
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
