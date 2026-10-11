ALTER TABLE media ADD COLUMN cv_import jsonb;
ALTER TABLE jobs DROP CONSTRAINT jobs_kind_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_kind_check CHECK (kind IN ('publish', 'abstract', 'cv-import'));
CREATE UNIQUE INDEX jobs_one_cv_import ON jobs(site_id, (payload->>'mediaId')) WHERE kind='cv-import' AND status IN ('queued','running');
