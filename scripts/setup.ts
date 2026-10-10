import { parse } from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const file = path.resolve(".env");
let contents = existsSync(file)
  ? await readFile(file, "utf8")
  : await readFile(".env.example", "utf8");
const values = parse(contents);
for (const key of ["SESSION_SECRET", "SETUP_TOKEN"])
  if (!values[key]) {
    const value = randomBytes(32).toString("base64url");
    contents = new RegExp(`^${key}=.*$`, "m").test(contents)
      ? contents.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`)
      : `${contents}\n${key}=${value}\n`;
  }
await writeFile(file, contents, { mode: 0o600 });
await mkdir(".data", { recursive: true });
const configured = parse(contents);
console.log(
  "Local configuration is ready. Start npm run dev, then open this one-time setup link:",
);
console.log(
  `${configured.APP_URL || "http://localhost:3000"}/setup?token=${configured.SETUP_TOKEN}`,
);
console.log(
  "Keep this link private. It stops working after the first administrator is created.",
);
