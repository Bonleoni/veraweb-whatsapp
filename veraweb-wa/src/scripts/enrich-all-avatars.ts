/**
 * Tüm eksik Instagram profil fotoğraflarını Apify details modu ile çeker.
 * Çalıştır: npm run enrich:avatars
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const PAGE_SIZE = 1000
const MAX_LEADS = 1500
const BATCH_SIZE = 100 // Apify'a tek seferde çok URL basmamak için

type LeadRow = {
  id: string
  instagram_username: string | null
  instagram_profile_pic_url: string | null
}

type ScrapedItem = {
  ownerUsername?: string
  username?: string
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

function isJunkUsername(username: string) {
  return (
    !username ||
    username === 'instagram_not_found' ||
    username === 'doktortakvimi' ||
    username.includes(' ') ||
    username.length < 2
  )
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchLeadsWithoutPhoto(
  supabase: ReturnType<typeof createClient>
) {
  const leads: LeadRow[] = []
  let from = 0

  while (leads.length < MAX_LEADS) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('leads')
      .select('id, instagram_username, instagram_profile_pic_url')
      .not('instagram_username', 'is', null)
      .neq('instagram_username', '')
      .or('instagram_profile_pic_url.is.null,instagram_profile_pic_url.eq.')
      .range(from, to)

    if (error) throw error
    const page = (data as LeadRow[] | null) ?? []
    if (page.length === 0) break
    leads.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return leads
    .filter((l) => !isJunkUsername(normalizeUsername(l.instagram_username)))
    .filter((l) => !(l.instagram_profile_pic_url || '').trim())
    .slice(0, MAX_LEADS)
}

async function enrichAllAvatars() {
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

  console.log('🔍 Profil fotoğrafı eksik Instagram hesapları çekiliyor...')

  let leadsWithoutPhoto: LeadRow[]
  try {
    leadsWithoutPhoto = await fetchLeadsWithoutPhoto(supabase)
  } catch (fetchError) {
    console.error('❌ Lead çekme hatası:', fetchError)
    process.exit(1)
  }

  console.log(`📸 ${leadsWithoutPhoto.length} hesabın fotoğrafı eksik.`)

  if (leadsWithoutPhoto.length === 0) {
    console.log('🎉 Tüm profil fotoğrafları zaten mevcut!')
    return
  }

  console.log('🚀 Apify Instagram Scraper (details mod) başlatılıyor...')
  console.log(
    `💰 Tahmini maliyet: ~$0.003/hesap = ~$${(
      leadsWithoutPhoto.length * 0.003
    ).toFixed(2)}`
  )

  const batches = chunk(leadsWithoutPhoto, BATCH_SIZE)
  let updatedCount = 0
  let failedCount = 0
  let notFoundCount = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const leadByUsername = new Map<string, LeadRow>()
    for (const lead of batch) {
      leadByUsername.set(normalizeUsername(lead.instagram_username), lead)
    }

    const urls = batch.map(
      (lead) =>
        `https://www.instagram.com/${normalizeUsername(lead.instagram_username)}/`
    )

    console.log(
      `\n📦 Batch ${i + 1}/${batches.length} — ${urls.length} URL`
    )

    const run = await apifyClient.actor('apify/instagram-scraper').call(
      {
        directUrls: urls,
        resultsType: 'details',
        resultsLimit: 1,
      },
      { waitSecs: 60 * 20 }
    )

    if (!run?.defaultDatasetId) {
      console.error('❌ Dataset ID alınamadı')
      failedCount += batch.length
      continue
    }

    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 10_000 })

    console.log(`   Apify sonuç: ${items.length}`)
    const matched = new Set<string>()

    for (const raw of items as ScrapedItem[]) {
      const username = normalizeUsername(raw.username || raw.ownerUsername)
      const lead = leadByUsername.get(username)
      if (!lead) continue
      matched.add(username)

      const pic =
        raw.profilePicUrlHD || raw.profilePicUrl || raw.ownerProfilePicUrl

      if (!pic) {
        console.log(`⚠️ Fotoğraf bulunamadı: ${username}`)
        notFoundCount++
        continue
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update({ instagram_profile_pic_url: pic })
        .eq('id', lead.id)

      if (updateError) {
        console.error(`❌ Güncelleme hatası (${username}):`, updateError.message)
        failedCount++
      } else {
        console.log(`✅ ${username}`)
        updatedCount++
      }
    }

    for (const username of leadByUsername.keys()) {
      if (!matched.has(username)) {
        console.log(`⚠️ Apify eşleşmedi: ${username}`)
        notFoundCount++
      }
    }
  }

  console.log('\n🎉 İşlem tamamlandı!')
  console.log(`✅ Güncellenen: ${updatedCount}`)
  console.log(`⚠️ Bulunamayan/eşleşmeyen: ${notFoundCount}`)
  console.log(`❌ DB hatası: ${failedCount}`)
  console.log('💰 Gerçekleşen maliyet: Apify Dashboard’dan kontrol et')
}

enrichAllAvatars().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
