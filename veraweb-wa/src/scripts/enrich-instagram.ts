/**
 * Apify Instagram Scraper ile leads tablosunu zenginleştirir.
 *
 * Gereken env (.env.local):
 * - APIFY_API_TOKEN
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (tercihen) veya NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Çalıştır: npm run enrich:ig
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const LEAD_LIMIT = 50
const POSTS_LIMIT = 6

type LeadRow = {
  id: string
  instagram_username: string | null
}

type ScrapedItem = {
  ownerUsername?: string
  username?: string
  ownerFullName?: string
  fullName?: string
  ownerFollowersCount?: number
  followersCount?: number
  ownerPostsCount?: number
  postsCount?: number
  ownerBiography?: string
  biography?: string
  ownerProfilePicUrl?: string
  profilePicUrl?: string
  profilePicUrlHD?: string
  displayUrl?: string
  images?: string[]
  latestPosts?: Array<{ displayUrl?: string; images?: string[] }>
  shortcodeToData?: Record<string, { displayUrl?: string }>
}

type ProfileAgg = {
  followers?: number
  posts?: number
  bio?: string
  profilePic?: string
  photos: string[]
}

function normalizeUsername(raw?: string | null) {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .pop()
    ?.toLowerCase() || ''
}

function usernameFromUrl(url?: string) {
  if (!url) return ''
  try {
    const path = new URL(url).pathname
    return normalizeUsername(path)
  } catch {
    return normalizeUsername(url)
  }
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

function collectPhotos(item: ScrapedItem): string[] {
  const photos: string[] = []

  if (item.displayUrl) photos.push(item.displayUrl)
  if (Array.isArray(item.images)) {
    for (const img of item.images) {
      if (img) photos.push(img)
    }
  }
  if (item.shortcodeToData) {
    for (const post of Object.values(item.shortcodeToData)) {
      if (post?.displayUrl) photos.push(post.displayUrl)
    }
  }
  if (Array.isArray(item.latestPosts)) {
    for (const post of item.latestPosts) {
      if (post?.displayUrl) photos.push(post.displayUrl)
      if (Array.isArray(post?.images)) {
        for (const img of post.images) {
          if (img) photos.push(img)
        }
      }
    }
  }

  return photos
}

async function enrichInstagramData() {
  if (!APIFY_TOKEN) {
    console.error(
      '❌ APIFY_API_TOKEN eksik. .env.local dosyasına ekleyip tekrar dene.'
    )
    process.exit(1)
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      '❌ Supabase URL/KEY eksik. NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.'
    )
    process.exit(1)
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY yok; ANON key kullanılıyor. RLS update engellerse service role ekle.'
    )
  }

  const apifyClient = new ApifyClient({ token: APIFY_TOKEN })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log("🔍 Instagram kullanıcısı olan lead'ler çekiliyor...")

  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, instagram_username')
    .not('instagram_username', 'is', null)
    .neq('instagram_username', '')
    .limit(LEAD_LIMIT)

  if (fetchError || !leads) {
    console.error('❌ Lead çekme hatası:', fetchError)
    process.exit(1)
  }

  const usableLeads = (leads as LeadRow[]).filter(
    (l) => normalizeUsername(l.instagram_username).length > 0
  )

  if (usableLeads.length === 0) {
    console.log('ℹ️ Güncellenecek lead bulunamadı (instagram_username boş).')
    return
  }

  console.log(`✅ ${usableLeads.length} adet lead bulundu.`)

  const leadByUsername = new Map<string, LeadRow>()
  for (const lead of usableLeads) {
    leadByUsername.set(normalizeUsername(lead.instagram_username), lead)
  }

  const urls = usableLeads.map(
    (lead) =>
      `https://www.instagram.com/${normalizeUsername(lead.instagram_username)}/`
  )

  console.log('🚀 Apify Instagram Scraper başlatılıyor...')
  console.log(`   Actor: apify/instagram-scraper | URL: ${urls.length}`)

  const run = await apifyClient.actor('apify/instagram-scraper').call(
    {
      directUrls: urls,
      resultsType: 'posts',
      resultsLimit: POSTS_LIMIT,
      searchLimit: POSTS_LIMIT,
      addParentData: true,
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

  console.log(`📦 Apify'dan ${items.length} kayıt geldi, eşleştiriliyor...`)

  const aggregates = new Map<string, ProfileAgg>()

  for (const raw of items as ScrapedItem[]) {
    const username = normalizeUsername(
      raw.ownerUsername || raw.username || usernameFromUrl((raw as { url?: string }).url)
    )
    if (!username || !leadByUsername.has(username)) continue

    const agg = aggregates.get(username) || { photos: [] }

    agg.followers = firstNumber(
      agg.followers,
      raw.ownerFollowersCount,
      raw.followersCount
    )
    agg.posts = firstNumber(agg.posts, raw.ownerPostsCount, raw.postsCount)
    agg.bio = firstString(agg.bio, raw.ownerBiography, raw.biography)
    agg.profilePic = firstString(
      agg.profilePic,
      raw.ownerProfilePicUrl,
      raw.profilePicUrlHD,
      raw.profilePicUrl
    )

    for (const photo of collectPhotos(raw)) {
      if (!agg.photos.includes(photo) && agg.photos.length < POSTS_LIMIT) {
        agg.photos.push(photo)
      }
    }

    aggregates.set(username, agg)
  }

  if (aggregates.size === 0) {
    console.warn(
      '⚠️ Hiçbir Apify sonucu lead ile eşleşmedi. resultsType=details deneniyor...'
    )

    const detailsRun = await apifyClient.actor('apify/instagram-scraper').call(
      {
        directUrls: urls,
        resultsType: 'details',
        resultsLimit: 1,
      },
      { waitSecs: 60 * 15 }
    )

    if (detailsRun?.defaultDatasetId) {
      const { items: detailItems } = await apifyClient
        .dataset(detailsRun.defaultDatasetId)
        .listItems({ limit: 10_000 })

      for (const raw of detailItems as ScrapedItem[]) {
        const username = normalizeUsername(raw.username || raw.ownerUsername)
        if (!username || !leadByUsername.has(username)) continue

        aggregates.set(username, {
          followers: firstNumber(raw.followersCount, raw.ownerFollowersCount),
          posts: firstNumber(raw.postsCount, raw.ownerPostsCount),
          bio: firstString(raw.biography, raw.ownerBiography),
          profilePic: firstString(
            raw.profilePicUrlHD,
            raw.profilePicUrl,
            raw.ownerProfilePicUrl
          ),
          photos: collectPhotos(raw).slice(0, POSTS_LIMIT),
        })
      }
    }
  }

  let updated = 0
  let failed = 0

  for (const [username, agg] of aggregates) {
    const lead = leadByUsername.get(username)
    if (!lead) continue

    const updateData: Record<string, unknown> = {}
    if (agg.followers != null) updateData.instagram_followers = agg.followers
    if (agg.posts != null) updateData.instagram_post_count = agg.posts
    if (agg.bio) updateData.instagram_bio = agg.bio
    if (agg.profilePic) updateData.instagram_profile_pic_url = agg.profilePic
    if (agg.photos.length > 0) updateData.photo_urls = agg.photos

    if (Object.keys(updateData).length === 0) {
      console.warn(`⚠️ Veri yok, atlandı: ${username}`)
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
        `✅ Güncellendi: ${username} (followers=${agg.followers ?? '-'}, posts=${agg.posts ?? '-'}, photos=${agg.photos.length})`
      )
    }
  }

  const missing = usableLeads
    .map((l) => normalizeUsername(l.instagram_username))
    .filter((u) => !aggregates.has(u))

  if (missing.length > 0) {
    console.warn(`⚠️ Apify sonucu gelmeyen ${missing.length} kullanıcı:`)
    for (const u of missing.slice(0, 20)) console.warn(`   - ${u}`)
    if (missing.length > 20) console.warn(`   ... +${missing.length - 20} daha`)
  }

  console.log(
    `🎉 Instagram zenginleştirme bitti. Güncellenen: ${updated}, Hata: ${failed}, Eşleşmeyen: ${missing.length}`
  )
}

enrichInstagramData().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
