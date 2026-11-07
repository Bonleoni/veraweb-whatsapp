-- WhatsApp profil fotoğrafı URL'si
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS whatsapp_profile_pic_url TEXT;
