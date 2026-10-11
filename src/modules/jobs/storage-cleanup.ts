import { db } from "@/lib/db";
import { deletePortfolioFiles } from "@/lib/storage";

export async function processStorageCleanup() {
  return (await db()).transaction(async (tx) => {
    const [item] = await tx.query<{ prefix: string }>(
      "SELECT prefix FROM storage_cleanup WHERE available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    if (!item) return false;
    try {
      await deletePortfolioFiles(item.prefix, tx);
      await tx.query("DELETE FROM storage_cleanup WHERE prefix=$1", [
        item.prefix,
      ]);
    } catch (error) {
      await tx.query(
        "UPDATE storage_cleanup SET attempts=attempts+1,error=$2,available_at=now()+interval '1 minute' WHERE prefix=$1",
        [
          item.prefix,
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Storage cleanup failed",
        ],
      );
      console.error("Portfolio storage cleanup deferred", item.prefix);
    }
    return true;
  });
}
