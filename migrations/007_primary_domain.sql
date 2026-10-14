ALTER TABLE domains ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Preserve the actual published address when possible, then the previous oldest-domain choice.
WITH selected AS (
  SELECT DISTINCT ON (d.site_id) d.id
  FROM domains d
  JOIN sites s ON s.id=d.site_id
  LEFT JOIN releases r ON r.id=s.published_release_id AND r.site_id=s.id
  WHERE d.verified_at IS NOT NULL AND d.activated_at IS NOT NULL
  ORDER BY d.site_id,
    CASE WHEN r.manifest->>'baseUrl' IN ('https://' || d.hostname, 'https://' || d.hostname || '/') THEN 0 ELSE 1 END,
    d.created_at,d.id
)
UPDATE domains SET is_primary=true WHERE id IN (SELECT id FROM selected);

CREATE UNIQUE INDEX domains_one_primary_per_site ON domains(site_id) WHERE is_primary;
