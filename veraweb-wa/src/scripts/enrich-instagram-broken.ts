/**
 * Eksik/bozuk Instagram profil verilerini (0 followers, pic yok vb.) yeniden çeker.
 * Çalıştır: npm run enrich:broken
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const BATCH_LIMIT = 50
const PRIORITY = ['nowpilatesstudio', 'ubapilates']

type LeadRow = {
  id: string
  business_name: string | null
  instagram_username: string | null
  instagram_followers: number | null
  instagram_post_count: number | null
  instagram_bio: string | null
  instagram_profile_pic_url: string | null
  photo_urls: unknown
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
  latestPosts?: Array<{ displayUrl?: string }>
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

function photoCount(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).length
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0
    } catch {
      return 0
    }
  }
  return 0
}

function isJunkUsername(username: string) {
  return (
    !username ||
    username === 'instagram_not_found' ||
    username === 'doktortakvimi' ||
    username.includes(' ') ||
    username.length < 2
  )
}

function isBroken(lead: LeadRow) {
  const username = normalizeUsername(lead.instagram_username)
  if (isJunkUsername(username)) return false

  const hasPic = Boolean((lead.instagram_profile_pic_url || '').trim())
  const followers = lead.instagram_followers
  const posts = lead.instagram_post_count
  const photos = photoCount(lead.photo_urls)
  const badFollowers = followers == null || followers === 0
  const badPosts = posts == null || posts === 0

  // UBA tipi: post görselleri var ama istatistik 0
  if (photos > 0 && (badFollowers || badPosts || !hasPic)) return true
  // Tamamen boş profil
  if (badFollowers && badPosts && !hasPic) return true
  return false
}

function score(lead: LeadRow) {
  const username = normalizeUsername(lead.instagram_username)
  if (PRIORITY.includes(username)) return 1000
  const photos = photoCount(lead.photo_urls)
  const name = (lead.business_name || '').toLowerCase()
  let s = 0
  if (photos > 0) s += 50 + photos
  if (name.includes('pilates')) s += 20
  if (!(lead.instagram_profile_pic_url || '').trim()) s += 10
  return s
}

async function enrichBroken() {
  if (!APIFY_TOKEN) {
    console.error('❌ APIFY_API_TOKEN eksik.')
    process.exit(1)
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase URL/KEY eksik.')
    process.exit(1)
  }

  const apify = new ApifyClient({ token: APIFY_TOKEN })
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('🔍 Bozuk Instagram kayıtları taranıyor...')

  const { data, error } = await supabase
    .from('leads')
    .select(
      'id, business_name, instagram_username, instagram_followers, instagram_post_count, instagram_bio, instagram_profile_pic_url, photo_urls'
    )
    .not('instagram_username', 'is', null)
    .neq('instagram_username', '')

  if (error || !data) {
    console.error('❌ Lead çekme hatası:', error)
    process.exit(1)
  }

  const broken = (data as LeadRow[])
    .filter(isBroken)
    .sort((a, b) => score(b) - score(a))
    .slice(0, BATCH_LIMIT)

  console.log(`✅ ${broken.length} aday seçildi (öncelikli batch).`)
  for (const lead of broken.slice(0, 15)) {
    console.log(
      `   - ${normalizeUsername(lead.instagram_username)} | f=${lead.instagram_followers} p=${lead.instagram_post_count} pic=${lead.instagram_profile_pic_url ? 'Y' : 'N'} photos=${photoCount(lead.photo_urls)}`
    )
  }
  if (broken.length > 15) console.log(`   ... +${broken.length - 15} daha`)

  if (broken.length === 0) {
    console.log('🎉 Bozuk kayıt yok.')
    return
  }

  const leadByUsername = new Map<string, LeadRow>()
  for (const lead of broken) {
    leadByUsername.set(normalizeUsername(lead.instagram_username), lead)
  }

  const urls = broken.map(
    (lead) =>
      `https://www.instagram.com/${normalizeUsername(lead.instagram_username)}/`
  )

  console.log('🚀 Apify details batch başlıyor...')
  const run = await apify.actor('apify/instagram-scraper').call(
    {
      directUrls: urls,
      resultsType: 'details',
      resultsLimit: 1,
    },
    { waitSecs: 60 * 20 }
  )

  if (!run?.defaultDatasetId) {
    console.error('❌ Dataset yok')
    process.exit(1)
  }

  const { items } = await apify
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 10_000 })

  console.log(`📦 ${items.length} Apify kaydı`)

  let updated = 0
  let failed = 0
  let skipped = 0
  const matched = new Set<string>()

  for (const raw of items as ScrapedItem[]) {
    const username = normalizeUsername(raw.username || raw.ownerUsername)
    const lead = leadByUsername.get(username)
    if (!lead) continue
    matched.add(username)

    const pic =
      raw.profilePicUrlHD || raw.profilePicUrl || raw.ownerProfilePicUrl
    const followers = raw.followersCount ?? raw.ownerFollowersCount
    const posts = raw.postsCount ?? raw.ownerPostsCount
    const bio = raw.biography || raw.ownerBiography
    const latestPhotos = (raw.latestPosts || [])
      .map((p) => p.displayUrl)
      .filter(Boolean)
      .slice(0, 6) as string[]

    const updateData: Record<string, unknown> = {}
    if (pic) updateData.instagram_profile_pic_url = pic
    if (typeof followers === 'number') {
      updateData.instagram_followers = followers
    }
    if (typeof posts === 'number') {
      updateData.instagram_post_count = posts
    }
    if (bio) updateData.instagram_bio = bio
    if (latestPhotos.length > 0 && photoCount(lead.photo_urls) === 0) {
      updateData.photo_urls = latestPhotos
    }

    if (Object.keys(updateData).length === 0) {
      skipped += 1
      console.log(`⚠️ Veri yok: ${username}`)
      continue
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', lead.id)

    if (updateError) {
      failed += 1
      console.error(`❌ ${username}:`, updateError.message)
    } else {
      updated += 1
      console.log(
        `✅ ${username} → f=${followers ?? '-'} p=${posts ?? '-'} pic=${pic ? '✓' : '✗'}`
      )
    }
  }

  const missing = [...leadByUsername.keys()].filter((u) => !matched.has(u))
  if (missing.length) {
    console.warn(`⚠️ Eşleşmeyen: ${missing.join(', ')}`)
  }

  console.log(
    `🎉 Bitti. Güncellenen: ${updated}, Atlanan: ${skipped}, Hata: ${failed}, Eşleşmeyen: ${missing.length}`
  )
}

enrichBroken().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
