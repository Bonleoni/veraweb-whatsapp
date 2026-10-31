/**
 * Username'i olan ama profil fotoğrafı boş lead'ler için Apify details ile avatar çeker.
 * Çalıştır: npm run fetch:missing-avatars
 *
 * Not: CDN URL'leri geçicidir. Kalıcı yapmak için ardından:
 *   npm run download:avatars
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
const BATCH_SIZE = 50

type LeadRow = {
  id: string
  instagram_username: string | null
  instagram_profile_pic_url?: string | null
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

async function fetchLeadsMissingAvatar(
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

  const filtered = leads
    .filter((l) => !isJunkUsername(normalizeUsername(l.instagram_username)))
    .filter((l) => !(l.instagram_profile_pic_url || '').trim())

  // Aynı username birden fazla lead'de olabilir — Apify duplicate URL reddeder
  const uniqueByUser = new Map<string, LeadRow>()
  for (const lead of filtered) {
    const username = normalizeUsername(lead.instagram_username)
    if (!uniqueByUser.has(username)) uniqueByUser.set(username, lead)
  }

  return [...uniqueByUser.values()].slice(0, MAX_LEADS)
}

async function fetchMissingAvatars() {
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

  console.log('🔍 Avatarı BOŞ olan Instagram hesapları çekiliyor...')

  let leads: LeadRow[]
  try {
    leads = await fetchLeadsMissingAvatar(supabase)
  } catch (fetchError) {
    console.error('❌ Hata:', fetchError)
    return
  }

  console.log(`✅ ${leads.length} hesabın avatarı eksik. Apify ile çekilecek.`)

  if (leads.length === 0) {
    console.log('🎉 Harika! Eksik avatar kalmamış.')
    return
  }

  console.log(
    `💰 Tahmini maliyet: ~$0.003/hesap = ~$${(leads.length * 0.003).toFixed(2)}`
  )

  const batches = chunk(leads, BATCH_SIZE)
  let totalUpdated = 0
  let totalFailed = 0
  let totalNotFound = 0

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    const leadByUsername = new Map<string, LeadRow>()
    for (const lead of batch) {
      leadByUsername.set(normalizeUsername(lead.instagram_username), lead)
    }

    const urls = batch.map(
      (lead) =>
        `https://www.instagram.com/${normalizeUsername(lead.instagram_username)}/`
    )

    console.log(
      `\n🚀 Batch ${batchIndex + 1}/${batches.length} (${batch.length} hesap)...`
    )

    try {
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
        totalFailed += batch.length
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
          console.log(`⚠️ Bulunamadı (Private/Silinmiş): ${username}`)
          totalNotFound++
          continue
        }

        // Aynı username'e sahip tüm boş avatarlı lead satırlarını güncelle
        const { error: updateError } = await supabase
          .from('leads')
          .update({ instagram_profile_pic_url: pic })
          .ilike('instagram_username', username)
          .or(
            'instagram_profile_pic_url.is.null,instagram_profile_pic_url.eq.'
          )

        if (updateError) {
          console.error(`❌ Güncelleme hatası (${username}):`, updateError.message)
          totalFailed++
        } else {
          console.log(`✅ Çekildi: ${username}`)
          totalUpdated++
        }
      }

      for (const username of leadByUsername.keys()) {
        if (!matched.has(username)) {
          console.log(`⚠️ Apify eşleşmedi: ${username}`)
          totalNotFound++
        }
      }

      if (batchIndex < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`❌ Batch hatası:`, message)
      totalFailed += batch.length
    }
  }

  console.log('\n🎉 === APİFY İŞLEMİ TAMAMLANDI ===')
  console.log(`✅ Yeni URL eklenen: ${totalUpdated}`)
  console.log(`⚠️ Bulunamayan/eşleşmeyen: ${totalNotFound}`)
  console.log(`❌ Hatalı: ${totalFailed}`)
  console.log(
    '💡 Kalıcı Storage için: npm run download:avatars'
  )
}

fetchMissingAvatars().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
