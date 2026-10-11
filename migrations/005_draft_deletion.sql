-- Preserve immutable audit events after a portfolio is deleted.
ALTER TABLE audit_events DROP CONSTRAINT audit_events_site_id_fkey;
CREATE TABLE storage_cleanup (
  prefix text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
