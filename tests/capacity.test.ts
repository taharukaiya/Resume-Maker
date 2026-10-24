import { afterEach, describe, expect, it, vi } from "vitest";
import { capacityLimits, withUploadCapacity } from "../src/lib/capacity";
const { space } = vi.hoisted(() => ({ space: vi.fn() }));
vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof import("node:fs/promises")>()),
  statfs: space,
}));
import { putObject } from "../src/lib/storage";
import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";

afterEach(() => {
  vi.unstubAllEnvs();
  space.mockReset();
});
describe("Capacity safeguards", () => {
  it("supports explicit quotas and rejects invalid settings instead of removing limits", () => {
    vi.stubEnv("PORTFOLIO_MEDIA_LIMIT_MB", "512");
    expect(capacityLimits().mediaBytes).toBe(512 * 1024 * 1024);
    for (const value of ["0", "-1", "Infinity", "NaN", "1.2", "999999"]) {
      vi.stubEnv("PORTFOLIO_MEDIA_LIMIT_MB", value);
      expect(() => capacityLimits()).toThrow("PORTFOLIO_MEDIA_LIMIT_MB");
    }
  });
  it("rejects excess work before buffering and releases a slot after failure", async () => {
    vi.stubEnv("MAX_CONCURRENT_UPLOADS", "1");
    let finish!: () => void;
    const first = withUploadCapacity(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const excess = vi.fn();
    await expect(withUploadCapacity(excess)).rejects.toMatchObject({
      status: 503,
    });
    expect(excess).not.toHaveBeenCalled();
    finish();
    await first;
    await expect(
      withUploadCapacity(async () => {
        throw new Error("conversion failed");
      }),
    ).rejects.toThrow("conversion failed");
    expect(await withUploadCapacity(async () => "next upload")).toBe(
      "next upload",
    );
  });
  it("blocks VPS writes before the shared disk reserve is exhausted", async () => {
    await mkdir(".test-data", { recursive: true });
    const directory = await mkdtemp(path.resolve(".test-data/capacity-"));
    vi.stubEnv("DATA_DIR", directory);
    vi.stubEnv("DEPLOYMENT_MODE", "vps");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("STORAGE_MIN_FREE_MB", "256");
    try {
      space.mockResolvedValue({ bsize: 1n, bavail: 256n * 1024n * 1024n });
      await expect(
        putObject("private/test.txt", "content", "text/plain"),
      ).rejects.toMatchObject({ status: 507 });
      await expect(
        readFile(path.join(directory, "storage/private/test.txt")),
      ).rejects.toThrow();
      space.mockResolvedValue({ bsize: 4096n, bavail: 100000n });
      await putObject("private/test.txt", "content", "text/plain");
      expect(
        await readFile(
          path.join(directory, "storage/private/test.txt"),
          "utf8",
        ),
      ).toBe("content");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
