-- Tesisat lead'leri için sektör + website bayrağı
-- Supabase SQL Editor'de çalıştırın, sonra: npm run scrape:tesisat

ALTER TABLE leads ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'pilates';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_website BOOLEAN DEFAULT false;

UPDATE leads
SET has_website = true
WHERE website IS NOT NULL AND website <> '';

CREATE INDEX IF NOT EXISTS idx_leads_sector ON leads(sector);
CREATE INDEX IF NOT EXISTS idx_leads_has_website ON leads(has_website);
