ALTER TABLE domains ADD COLUMN IF NOT EXISTS distribution_id text;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS cdn_hostname text;
ALTER TABLE domains ADD COLUMN IF NOT EXISTS activated_at timestamptz;
