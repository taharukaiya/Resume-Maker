ALTER TABLE media ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'article' CHECK (purpose IN ('article','cv','image'));
