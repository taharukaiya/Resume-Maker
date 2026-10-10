import "dotenv/config";
import { closeDb, db, migrate } from "../src/lib/db";
import { configureRuntimeRole } from "./runtime-database";
const database = await db();
await migrate(database);
await configureRuntimeRole(database);
await closeDb();
console.log("Database migrations applied.");
