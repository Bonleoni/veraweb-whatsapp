-- Konuşma durumu: Açık / Ertelenen / Tamamlanan filtreleri için
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS conversation_status TEXT DEFAULT 'open';

UPDATE leads
SET conversation_status = 'open'
WHERE conversation_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_conversation_status
  ON leads(conversation_status);
