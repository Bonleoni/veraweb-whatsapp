/**
 * WhatsApp üzerinden lead profil fotoğraflarını çeker.
 * Çalıştır: npm run fetch:wa-avatars
 *
 * İlk çalıştırmada QR kodu taratman gerekir.
 * Önce: supabase/whatsapp_profile_pic.sql
 */

import { Client, LocalAuth } from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const LIMIT = 1500
const DELAY_MS = 500

function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D+/g, '')
  if (!digits) return null

  // 0532... -> 90532...
  if (digits.startsWith('0') && digits.length === 11) {
    digits = `90${digits.slice(1)}`
  }
  // 532... (10 hane TR mobil) -> 90532...
  if (digits.length === 10 && digits.startsWith('5')) {
    digits = `90${digits}`
  }

  if (digits.length < 11 || digits.length > 15) return null
  return digits
}

async function ensureColumn(
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .select('whatsapp_profile_pic_url')
    .limit(1)
  if (!error) return true
  console.error('❌ whatsapp_profile_pic_url sütunu yok.')
  console.error('💡 Supabase SQL Editor’de çalıştır: supabase/whatsapp_profile_pic.sql')
  console.error('   Hata:', error.message)
  return false
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase URL/KEY eksik (.env.local).')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  if (!(await ensureColumn(supabase))) process.exit(1)

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })

  client.on('qr', (qr) => {
    console.log('\n📱 WhatsApp QR kodunu telefonundan tarat:\n')
    qrcode.generate(qr, { small: true })
    console.log('\n(WhatsApp > Bağlı Cihazlar > Cihaz Bağla)\n')
  })

  client.on('authenticated', () => {
    console.log('🔐 WhatsApp oturumu doğrulandı.')
  })

  client.on('auth_failure', (msg) => {
    console.error('❌ Auth hatası:', msg)
  })

  client.on('ready', async () => {
    console.log('✅ WhatsApp hazır! Profil fotoğrafları çekiliyor...')

    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, phone, business_name, whatsapp_profile_pic_url')
        .not('phone', 'is', null)
        .neq('phone', '')
        .limit(LIMIT)

      if (error || !leads) {
        console.error('❌ Lead çekme hatası:', error)
        await client.destroy()
        process.exit(1)
      }

      // Zaten WA avatarı olanları atla (yeniden çekmek için SKIP_EXISTING=0)
      const skipExisting = process.env.SKIP_EXISTING !== '0'
      const pending = skipExisting
        ? leads.filter((l) => !(l.whatsapp_profile_pic_url || '').trim())
        : leads

      console.log(
        `📊 ${leads.length} lead bulundu, işlenecek: ${pending.length}`
      )

      let successCount = 0
      let failCount = 0
      let notFoundCount = 0

      for (const lead of pending) {
        const label = lead.business_name || lead.phone || lead.id
        try {
          const digits = toWhatsAppDigits(lead.phone || '')
          if (!digits) {
            console.log(`⚠️ Geçersiz telefon: ${label}`)
            notFoundCount++
            continue
          }

          const numberId = await client.getNumberId(digits)
          if (!numberId) {
            console.log(`⚠️ WhatsApp'ta kayıtlı değil: ${label} (${digits})`)
            notFoundCount++
            continue
          }

          const profilePicUrl = await client.getProfilePicUrl(
            numberId._serialized
          )

          if (!profilePicUrl) {
            console.log(`⚠️ Fotoğraf yok / gizli: ${label}`)
            notFoundCount++
            continue
          }

          const { error: updateError } = await supabase
            .from('leads')
            .update({ whatsapp_profile_pic_url: profilePicUrl })
            .eq('id', lead.id)

          if (updateError) {
            console.error(`❌ DB hatası (${label}):`, updateError.message)
            failCount++
          } else {
            console.log(`✅ ${label}`)
            successCount++
          }

          await new Promise((r) => setTimeout(r, DELAY_MS))
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`❌ Hata (${label}):`, message)
          failCount++
        }
      }

      console.log('\n🎉 === İŞLEM TAMAMLANDI ===')
      console.log(`✅ Fotoğraf çekilen: ${successCount}`)
      console.log(`⚠️ Fotoğrafı olmayan / bulunamayan: ${notFoundCount}`)
      console.log(`❌ Hata olan: ${failCount}`)
    } finally {
      await client.destroy()
      process.exit(0)
    }
  })

  console.log('⏳ WhatsApp client başlatılıyor...')
  await client.initialize()
}

main().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
