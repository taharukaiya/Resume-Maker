import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import path from "node:path";
import { assertProductionConfig } from "../src/lib/config";
import { proxy } from "../src/proxy";

afterEach(() => vi.unstubAllEnvs());
function production() {
  for (const [key, value] of Object.entries({
    NODE_ENV: "production",
    DEPLOYMENT_MODE: "vps",
    APP_URL: "https://studio.example.test",
    PUBLIC_ASSET_URL: "https://media.example.test",
    DATA_DIR: path.resolve(".test-data/vps"),
    SESSION_SECRET: "test-secret-with-at-least-32-characters",
    DATABASE_URL: "postgresql://localhost/brilliancy",
    CLAMAV_HOST: "scanner",
    EMAIL_FROM: "test@example.test",
    S3_BUCKET: "",
    PUBLIC_BUCKET: "",
    RELEASE_RETENTION: "3",
  }))
    vi.stubEnv(key, value);
}
describe("VPS production boundaries", () => {
  it("allows explicit persistent VPS storage without weakening AWS requirements", () => {
    production();
    expect(() => assertProductionConfig()).not.toThrow();
    vi.stubEnv("DEPLOYMENT_MODE", "");
    expect(() => assertProductionConfig()).toThrow("S3_BUCKET");
  });
  it.each(["CLAMAV_HOST", "EMAIL_FROM", "DATABASE_URL", "DATA_DIR"])(
    "fails closed without %s",
    (key) => {
      production();
      vi.stubEnv(key, "");
      expect(() => assertProductionConfig()).toThrow();
    },
  );
  it("rejects unsafe origins and relative persistence", () => {
    production();
    vi.stubEnv("PUBLIC_ASSET_URL", "https://studio.example.test");
    expect(() => assertProductionConfig()).toThrow("separate");
    vi.stubEnv("PUBLIC_ASSET_URL", "https://media.example.test/private");
    expect(() => assertProductionConfig()).toThrow("origin");
    vi.stubEnv("PUBLIC_ASSET_URL", "https://media.example.test");
    vi.stubEnv("DATA_DIR", ".data");
    expect(() => assertProductionConfig()).toThrow("absolute");
  });
  it("rejects misspelled deployment mode and unsafe release retention", () => {
    production();
    vi.stubEnv("RELEASE_RETENTION", "1");
    expect(() => assertProductionConfig()).toThrow("RELEASE_RETENTION");
    vi.stubEnv("RELEASE_RETENTION", "3");
    vi.stubEnv("DEPLOYMENT_MODE", "VPS");
    expect(() => assertProductionConfig()).toThrow("Unknown");
  });
  it("gives each studio request a unique nonce without production unsafe-eval or script unsafe-inline", () => {
    production();
    const a = proxy(new NextRequest("https://studio.example.test/login"));
    const b = proxy(new NextRequest("https://studio.example.test/login"));
    const policy = a.headers.get("Content-Security-Policy")!;
    expect(policy).toContain("'nonce-");
    expect(policy).not.toEqual(b.headers.get("Content-Security-Policy"));
    expect(
      policy.split(";").find((value) => value.trim().startsWith("script-src")),
    ).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(a.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
