import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
export async function loadDatabaseCredentials() {
  if (process.env.DATABASE_URL || !process.env.DATABASE_SECRET_ARN) return;
  if (!process.env.DATABASE_HOST)
    throw new Error(
      "DATABASE_HOST must be configured with DATABASE_SECRET_ARN.",
    );
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const result = await client.send(
    new GetSecretValueCommand({ SecretId: process.env.DATABASE_SECRET_ARN }),
  );
  if (!result.SecretString)
    throw new Error("Database credentials are unavailable.");
  const secret = JSON.parse(result.SecretString) as {
    username: string;
    password: string;
  };
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@${process.env.DATABASE_HOST}:5432/${process.env.DATABASE_NAME || "brilliancy"}?sslmode=verify-full`;
}
