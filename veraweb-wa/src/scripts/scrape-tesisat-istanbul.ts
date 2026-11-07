/**
 * İstanbul su tesisatı / tıkanıklık / kombi firmalarını Google Maps'ten çeker.
 * Çalıştır: npm run scrape:tesisat
 *
 * Önce SQL migration:
 *   supabase/tesisat_sector_columns.sql  (Supabase SQL Editor)
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const ACTOR_ID = 'compass/crawler-google-places'
const MAX_PER_SEARCH = 5

const DISTRICTS = [
  'Ümraniye',
  'Üsküdar',
  'Kadıköy',
  'Maltepe',
  'Kartal',
  'Pendik',
  'Tuzla',
  'Şişli',
  'Kağıthane',
  'Sarıyer',
  'Bahçelievler',
  'Küçükçekmece',
  'Bakırköy',
  'Esenyurt',
  'Başakşehir',
]

const KEYWORDS = [
  'Su Tesisatçısı',
  'Tıkanıklık Açma',
  'Kombi Servisi',
  'Petek Temizleme',
]

type GmapsItem = {
  title?: string
  searchString?: string
  website?: string | null
  phone?: string | null
  phoneUnformatted?: string | null
  phones?: string[] | null
  placeId?: string | null
  address?: string | null
  street?: string | null
  city?: string | null
  neighborhood?: string | null
  totalScore?: number | null
  reviewsCount?: number | null
  rating?: number | null
  reviewCount?: number | null
  [key: string]: unknown
}

function normalizePhoneDigits(raw?: string | null) {
  if (!raw) return ''
  return raw.replace(/\D+/g, '')
}

function phoneLast10(raw?: string | null) {
  const digits = normalizePhoneDigits(raw)
  return digits.slice(-10)
}

function pickPhone(item: GmapsItem): string | null {
  if (item.phone?.trim()) return item.phone.trim()
  if (item.phoneUnformatted?.trim()) return item.phoneUnformatted.trim()
  if (Array.isArray(item.phones) && item.phones[0]?.trim()) {
    return item.phones[0].trim()
  }
  return null
}

function pickWebsite(item: GmapsItem): string | null {
  const w = (item.website || '').trim()
  if (!w || w.length < 8) return null
  if (/instagram\.com|facebook\.com|wa\.me|youtube\.com/i.test(w)) return null
  return w
}

function pickDistrict(item: GmapsItem, searchString?: string): string {
  if (item.neighborhood?.trim()) return item.neighborhood.trim()

  if (searchString) {
    for (const d of DISTRICTS) {
      if (searchString.toLocaleLowerCase('tr-TR').includes(d.toLocaleLowerCase('tr-TR'))) {
        return d
      }
    }
  }

  const addr = item.address || ''
  for (const d of DISTRICTS) {
    if (addr.toLocaleLowerCase('tr-TR').includes(d.toLocaleLowerCase('tr-TR'))) {
      return d
    }
  }

  // "Mahalle, İlçe/İstanbul" kalıbı
  const parts = addr.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 2] || 'İstanbul'
  return 'İstanbul'
}

async function ensureSchema(
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  const { error } = await supabase.from('leads').select('sector, has_website').limit(1)
  if (!error) return true

  console.error('❌ leads tablosunda sector / has_website sütunları yok.')
  console.error('💡 Önce Supabase SQL Editor’de şunu çalıştır:')
  console.error('   supabase/tesisat_sector_columns.sql')
  console.error('   Hata:', error.message)
  return false
}

async function scrapeTesisatIstanbul() {
  if (!APIFY_TOKEN) {
    console.error('❌ APIFY_API_TOKEN eksik.')
    process.exit(1)
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase URL/KEY eksik.')
    process.exit(1)
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY yok; ANON key kullanılıyor. Insert RLS engellerse service role ekle.'
    )
  }

  const apifyClient = new ApifyClient({ token: APIFY_TOKEN })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const ok = await ensureSchema(supabase)
  if (!ok) process.exit(1)

  console.log('🚀 İstanbul Tesisat Firmaları taraması başlıyor...')

  const searchQueries: string[] = []
  for (const district of DISTRICTS) {
    for (const keyword of KEYWORDS) {
      searchQueries.push(`${keyword} ${district} İstanbul`)
    }
  }

  console.log(`📝 Toplam ${searchQueries.length} adet arama sorgusu oluşturuldu.`)
  console.log(
    `💰 Tahmini üst sınır: ${searchQueries.length * MAX_PER_SEARCH} sonuç (max ${MAX_PER_SEARCH}/sorgu)`
  )

  const existingDatasetId = process.env.TESISAT_DATASET_ID?.trim()
  let datasetId = existingDatasetId || ''

  if (datasetId) {
    console.log(`♻️ Mevcut dataset yeniden işleniyor: ${datasetId}`)
  } else {
    console.log('⏳ Apify çalıştırılıyor, bu işlem 5–15 dakika sürebilir...')

    const run = await apifyClient.actor(ACTOR_ID).call(
      {
        searchStringsArray: searchQueries,
        maxCrawledPlacesPerSearch: MAX_PER_SEARCH,
        language: 'tr',
        countryCode: 'tr',
        skipClosedPlaces: true,
        scrapeContacts: false,
        maxReviews: 0,
        maxImages: 0,
        maxQuestions: 0,
      },
      { waitSecs: 60 * 45 }
    )

    if (!run?.defaultDatasetId) {
      console.error('❌ Dataset ID alınamadı')
      process.exit(1)
    }
    datasetId = run.defaultDatasetId
    console.log('✅ Tarama tamamlandı. Sonuçlar çekiliyor...')
  }

  const { items } = await apifyClient
    .dataset(datasetId)
    .listItems({ limit: 10_000 })

  console.log(`📦 Apify sonuç sayısı: ${items.length}`)

  // Mevcut telefon + lead_number dedupe
  const { data: existingRows } = await supabase
    .from('leads')
    .select('phone, lead_number')
    .limit(8000)

  const phoneSet = new Set<string>()
  const leadNumberSet = new Set<string>()
  for (const row of existingRows || []) {
    const last10 = phoneLast10(row.phone)
    if (last10.length >= 10) phoneSet.add(last10)
    const lnLast10 = phoneLast10(row.lead_number)
    if (lnLast10.length >= 10) phoneSet.add(lnLast10)
    if (row.lead_number) leadNumberSet.add(String(row.lead_number))
  }

  let savedCount = 0
  let skippedCount = 0
  let noPhoneCount = 0
  const seenInBatch = new Set<string>()

  for (const raw of items as GmapsItem[]) {
    const title = (raw.title || '').trim()
    const phone = pickPhone(raw)
    if (!title || !phone) {
      noPhoneCount++
      continue
    }

    const last10 = phoneLast10(phone)
    if (last10.length < 10) {
      noPhoneCount++
      continue
    }

    if (phoneSet.has(last10) || seenInBatch.has(last10)) {
      skippedCount++
      continue
    }

    // google_maps importlarıyla uyumlu unique lead_number
    const leadNumber =
      phone ||
      (raw.placeId ? `TESISAT_${raw.placeId}` : `TESISAT_${last10}_${Date.now()}`)

    if (leadNumberSet.has(leadNumber)) {
      skippedCount++
      continue
    }

    const website = pickWebsite(raw)
    const hasWebsite = Boolean(website)
    const district = pickDistrict(raw, raw.searchString)
    const rating =
      typeof raw.totalScore === 'number'
        ? raw.totalScore
        : typeof raw.rating === 'number'
          ? raw.rating
          : null
    const reviewCount =
      typeof raw.reviewsCount === 'number'
        ? raw.reviewsCount
        : typeof raw.reviewCount === 'number'
          ? raw.reviewCount
          : null

    const { error } = await supabase.from('leads').insert({
      lead_number: leadNumber,
      business_name: title,
      phone,
      city: 'İstanbul',
      district,
      address: raw.address || null,
      website,
      rating,
      review_count: reviewCount,
      sector: 'tesisat',
      has_website: hasWebsite,
      status: 'new',
      conversation_status: 'open',
      source: 'google_maps_tesisat',
    })

    if (error) {
      console.error(`❌ Kayıt hatası (${title}):`, error.message)
      continue
    }

    seenInBatch.add(last10)
    phoneSet.add(last10)
    leadNumberSet.add(leadNumber)
    savedCount++
    console.log(
      `✅ Eklendi: ${title}${hasWebsite ? ' (Web Sitesi Var)' : ''}`
    )
  }

  console.log('\n🎉 === İŞLEM TAMAMLANDI ===')
  console.log(`✅ Veritabanına eklenen yeni firma: ${savedCount}`)
  console.log(`⏭️ Zaten olduğu için atlanan: ${skippedCount}`)
  console.log(`⚠️ Telefonu olmayan / geçersiz: ${noPhoneCount}`)
  console.log(
    '💡 İpucu: has_website = true olanlar web sitesi yenileme teklifi için sıcak lead.'
  )
}

scrapeTesisatIstanbul().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
