import { invariant } from "./errors";

const mib = 1024 * 1024;
function integerSetting(
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}
export function capacityLimits() {
  return {
    mediaBytes:
      integerSetting("PORTFOLIO_MEDIA_LIMIT_MB", 100, 10, 10240) * mib,
    reserveBytes:
      integerSetting("STORAGE_MIN_FREE_MB", 2048, 256, 1048576) * mib,
    concurrentUploads: integerSetting("MAX_CONCURRENT_UPLOADS", 2, 1, 4),
  };
}

// Admission is per application process, before buffering multipart bodies.
// Do not queue document buffers in memory when converters are already busy.
let activeUploads = 0;
export async function withUploadCapacity<T>(
  work: () => Promise<T>,
): Promise<T> {
  invariant(
    activeUploads < capacityLimits().concurrentUploads,
    503,
    "The document processor is busy. Please retry your upload shortly.",
  );
  activeUploads++;
  try {
    return await work();
  } finally {
    activeUploads--;
  }
}
