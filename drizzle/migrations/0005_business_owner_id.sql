-- Tenant isolation: each user owns their businesses (operations cascade via business_id).

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses (owner_id);

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_owner_slug ON businesses (owner_id, slug);

-- Assign legacy LH Hub data to the primary operator account.
UPDATE businesses
SET owner_id = (SELECT id FROM users WHERE email = 'lucashcampos667@gmail.com' LIMIT 1)
WHERE owner_id IS NULL;
