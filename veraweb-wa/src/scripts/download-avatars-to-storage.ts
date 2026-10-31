/**
 * Instagram CDN avatar URL'lerini indirip Supabase Storage'a kalıcı olarak yükler.
 * Çalıştır: npm run download:avatars
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'avatars'
const MAX_LEADS = 1500
const DELAY_MS = 300

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function isAlreadyStored(url: string | null | undefined) {
  if (!url?.trim()) return true
  return url.includes('supabase.co/storage')
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error('❌ Bucket listesi alınamadı:', error.message)
    return false
  }

  if (buckets?.some((b) => b.name === BUCKET)) {
    console.log(`✅ Storage bucket hazır: ${BUCKET}`)
    return true
  }

  console.log(`📦 Bucket yok, oluşturuluyor: ${BUCKET}`)
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })

  if (createError) {
    console.error('❌ Bucket oluşturulamadı:', createError.message)
    console.error(
      '💡 Supabase Dashboard > Storage > New bucket > adı "avatars", Public açık.'
    )
    return false
  }

  console.log(`✅ Bucket oluşturuldu: ${BUCKET}`)
  return true
}

async function downloadAvatarsToStorage() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      '❌ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local).'
    )
    process.exit(1)
  }

  console.log("🔍 Instagram avatar URL'si olan lead'ler çekiliyor...")

  const ok = await ensureBucket()
  if (!ok) return

  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, instagram_username, instagram_profile_pic_url')
    .not('instagram_profile_pic_url', 'is', null)
    .neq('instagram_profile_pic_url', '')
    .limit(MAX_LEADS)

  if (fetchError || !leads) {
    console.error('❌ Lead çekme hatası:', fetchError)
    return
  }

  const pending = leads.filter(
    (l) => !isAlreadyStored(l.instagram_profile_pic_url)
  )
  const skipped = leads.length - pending.length

  console.log(
    `✅ ${leads.length} lead bulundu (${skipped} zaten Storage'da). İndirme başlıyor: ${pending.length}...`
  )

  let successCount = 0
  let failCount = 0

  for (const lead of pending) {
    try {
      const label = lead.instagram_username || lead.id
      console.log(`⬇️ İndiriliyor: ${label}...`)

      const response = await fetch(lead.instagram_profile_pic_url!, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://www.instagram.com/',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })

      if (!response.ok) {
        console.log(`⚠️ İndirilemedi (HTTP ${response.status}): ${label}`)
        failCount++
        continue
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        console.log(`⚠️ Geçersiz içerik tipi (${contentType}): ${label}`)
        failCount++
        continue
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (buffer.byteLength < 200) {
        console.log(`⚠️ Çok küçük dosya (${buffer.byteLength}B): ${label}`)
        failCount++
        continue
      }

      const ext = contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
          ? 'webp'
          : 'jpg'
      const fileName = `${lead.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
        })

      if (uploadError) {
        console.error(`❌ Upload hatası (${label}):`, uploadError.message)
        failCount++
        continue
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('leads')
        .update({ instagram_profile_pic_url: publicUrl })
        .eq('id', lead.id)

      if (updateError) {
        console.error(`❌ DB Güncelleme hatası (${label}):`, updateError.message)
        failCount++
      } else {
        console.log(`✅ KALICI OLARAK KAYDEDİLDİ: ${label}`)
        successCount++
      }

      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`❌ Genel hata (${lead.instagram_username}):`, message)
      failCount++
    }
  }

  console.log('\n🎉 === İŞLEM TAMAMLANDI ===')
  console.log(`✅ Başarıyla Storage'a kaydedilen: ${successCount}`)
  console.log(`⏭ Zaten Storage'da (atlandı): ${skipped}`)
  console.log(`❌ Başarısız olan: ${failCount}`)
  console.log('💡 Artık bu resimler asla süresi dolmayacak!')
}

downloadAvatarsToStorage()
