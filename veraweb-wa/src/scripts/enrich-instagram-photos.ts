/**
 * Eksik Instagram profil fotoğraflarını Apify ile tamamlar.
 *
 * Çalıştır: npm run enrich:photos
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const LEAD_LIMIT = 50

type LeadRow = {
  id: string
  instagram_username: string | null
  instagram_followers?: number | null
  instagram_post_count?: number | null
  instagram_bio?: string | null
}

type ScrapedItem = {
  ownerUsername?: string
  username?: string
  ownerFollowersCount?: number
  followersCount?: number
  ownerPostsCount?: number
  postsCount?: number
  ownerBiography?: string
  biography?: string
  ownerProfilePicUrl?: string
  profilePicUrl?: string
  profilePicUrlHD?: string
}

function normalizeUsername(raw?: string | null) {
  if (!raw) return ''
  return (
    raw
      .trim()
      .replace(/^@+/, '')
      .replace(/\/+$/, '')
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .pop()
      ?.toLowerCase() || ''
  )
}

function firstNumber(...values: Array<number | undefined | null>) {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

function firstString(...values: Array<string | undefined | null>) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

async function enrichMissingPhotos() {
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
      '⚠️ SUPABASE_SERVICE_ROLE_KEY yok; ANON key kullanılıyor. RLS engellerse service role ekle.'
    )
  }

  const apifyClient = new ApifyClient({ token: APIFY_TOKEN })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log("🔍 Profil fotoğrafı eksik olan lead'ler çekiliyor...")

  // Profil fotoğrafı null VEYA boş string
  const { data: leadsNull, error: fetchError } = await supabase
    .from('leads')
    .select(
      'id, instagram_username, instagram_followers, instagram_post_count, instagram_bio'
    )
    .not('instagram_username', 'is', null)
    .neq('instagram_username', '')
    .is('instagram_profile_pic_url', null)
    .limit(LEAD_LIMIT)

  if (fetchError) {
    console.error('❌ Lead çekme hatası:', fetchError)
    process.exit(1)
  }

  let leads = (leadsNull as LeadRow[] | null) ?? []

  // Boş string profil fotoğrafları da yakala (limit dolmadıysa)
  if (leads.length < LEAD_LIMIT) {
    const { data: emptyPic } = await supabase
      .from('leads')
      .select(
        'id, instagram_username, instagram_followers, instagram_post_count, instagram_bio'
      )
      .not('instagram_username', 'is', null)
      .neq('instagram_username', '')
      .eq('instagram_profile_pic_url', '')
      .limit(LEAD_LIMIT - leads.length)

    if (emptyPic?.length) {
      const seen = new Set(leads.map((l) => l.id))
      for (const row of emptyPic as LeadRow[]) {
        if (!seen.has(row.id)) leads.push(row)
      }
    }
  }

  leads = leads.filter((l) => normalizeUsername(l.instagram_username).length > 0)

  console.log(`✅ ${leads.length} adet eksik fotoğraf bulundu.`)

  if (leads.length === 0) {
    console.log('🎉 Tüm profil fotoğrafları zaten çekilmiş!')
    return
  }

  const leadByUsername = new Map<string, LeadRow>()
  for (const lead of leads) {
    leadByUsername.set(normalizeUsername(lead.instagram_username), lead)
  }

  const urls = leads.map(
    (lead) =>
      `https://www.instagram.com/${normalizeUsername(lead.instagram_username)}/`
  )

  console.log(
    '🚀 Apify Instagram Scraper başlatılıyor (sadece profil detayları)...'
  )
  console.log(`   Actor: apify/instagram-scraper | URL: ${urls.length}`)

  const run = await apifyClient.actor('apify/instagram-scraper').call(
    {
      directUrls: urls,
      resultsType: 'details',
      resultsLimit: 1,
    },
    { waitSecs: 60 * 15 }
  )

  if (!run?.defaultDatasetId) {
    console.error('❌ Apify dataset ID alınamadı:', run)
    process.exit(1)
  }

  console.log(`⏳ Dataset okunuyor: ${run.defaultDatasetId}`)
  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 10_000 })

  console.log(`📦 Apify'dan ${items.length} kayıt geldi`)

  let updated = 0
  let failed = 0
  let skipped = 0
  const matched = new Set<string>()

  for (const raw of items as ScrapedItem[]) {
    const username = normalizeUsername(raw.username || raw.ownerUsername)
    if (!username) continue

    const lead = leadByUsername.get(username)
    if (!lead) continue
    matched.add(username)

    const profilePic = firstString(
      raw.profilePicUrlHD,
      raw.profilePicUrl,
      raw.ownerProfilePicUrl
    )
    const followers = firstNumber(raw.followersCount, raw.ownerFollowersCount)
    const posts = firstNumber(raw.postsCount, raw.ownerPostsCount)
    const bio = firstString(raw.biography, raw.ownerBiography)

    const updateData: Record<string, unknown> = {}
    if (profilePic) updateData.instagram_profile_pic_url = profilePic
    if (followers != null && lead.instagram_followers == null) {
      updateData.instagram_followers = followers
    }
    if (posts != null && lead.instagram_post_count == null) {
      updateData.instagram_post_count = posts
    }
    if (bio && !lead.instagram_bio) {
      updateData.instagram_bio = bio
    }

    if (Object.keys(updateData).length === 0) {
      skipped += 1
      console.log(`⚠️ Veri bulunamadı: ${username}`)
      continue
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', lead.id)

    if (updateError) {
      failed += 1
      console.error(`❌ Güncelleme hatası (${username}):`, updateError.message)
    } else {
      updated += 1
      console.log(
        `✅ Güncellendi: ${username} - Fotoğraf: ${profilePic ? '✓' : '✗'}`
      )
    }
  }

  const missing = [...leadByUsername.keys()].filter((u) => !matched.has(u))
  if (missing.length > 0) {
    console.warn(`⚠️ Apify sonucu gelmeyen ${missing.length} kullanıcı:`)
    for (const u of missing.slice(0, 20)) console.warn(`   - ${u}`)
  }

  console.log(
    `🎉 Profil fotoğrafı zenginleştirme bitti. Güncellenen: ${updated}, Atlanan: ${skipped}, Hata: ${failed}, Eşleşmeyen: ${missing.length}`
  )
}

enrichMissingPhotos().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
