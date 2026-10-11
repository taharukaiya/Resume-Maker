import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(".env");
if (!existsSync(target))
  throw new Error("Run npm run setup first to create local configuration.");
const contents = await readFile(target, "utf8");
const setting = "AI_PROVIDER=huggingface-browser";
const updated = /^AI_PROVIDER=.*$/m.test(contents)
  ? contents.replace(/^AI_PROVIDER=.*$/m, setting)
  : `${contents.trimEnd()}\n${setting}\n`;
await writeFile(target, updated, { mode: 0o600 });
console.log(
  "Free Hugging Face browser AI selected locally. Restart npm run dev. Existing data and other configuration are unchanged.",
);
