import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { Database } from "../src/lib/db";
export async function configureRuntimeRole(database: Database) {
  if (!process.env.APPLICATION_DATABASE_SECRET_ARN) return;
  const secrets = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const response = await secrets.send(
    new GetSecretValueCommand({
      SecretId: process.env.APPLICATION_DATABASE_SECRET_ARN,
    }),
  );
  if (!response.SecretString)
    throw new Error("Application database secret is missing.");
  const credentials = JSON.parse(response.SecretString) as {
    username: string;
    password: string;
  };
  if (credentials.username !== "brilliancy_app")
    throw new Error("Unexpected application database role.");
  await database.transaction(async (tx) => {
    const exists = await tx.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
      credentials.username,
    ]);
    const [statement] = await tx.query<{ sql: string }>(
      `SELECT format('${exists.length ? "ALTER" : "CREATE"} ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql`,
      [credentials.username, credentials.password],
    );
    await tx.query(statement.sql);
    await tx.query("GRANT CONNECT ON DATABASE brilliancy TO brilliancy_app");
    await tx.query("GRANT USAGE ON SCHEMA public TO brilliancy_app");
    // Runtime may modify application records, but not schema, migration history, or existing audit events.
    await tx.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON settings, users, sessions, account_tokens, sites, revisions, releases, media, jobs, domains, inquiries, rate_limits TO brilliancy_app",
    );
    await tx.query("GRANT SELECT, INSERT ON audit_events TO brilliancy_app");
  });
}
