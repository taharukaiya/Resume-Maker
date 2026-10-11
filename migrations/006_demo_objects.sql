CREATE TABLE demo_objects (
  key text PRIMARY KEY,
  body bytea NOT NULL,
  bytes integer NOT NULL CHECK (bytes >= 0),
  content_type text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
