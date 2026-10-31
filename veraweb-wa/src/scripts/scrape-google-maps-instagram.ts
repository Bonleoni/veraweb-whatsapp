/**
 * Instagram'ı olmayan lead'ler için Google Maps + website contacts ile IG username çeker.
 * Çalıştır: npm run scrape:gmaps-ig
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const LIMIT = 100
const ACTOR_ID = 'compass/crawler-google-places'

type LeadRow = {
  id: string
  business_name: string | null
  city: string | null
  district: string | null
}

type GmapsItem = {
  title?: string
  searchString?: string
  website?: string | null
  url?: string
  instagrams?: string[] | string | null
  instagram?: string | null
  socialMedia?: Record<string, unknown> | null
  [key: string]: unknown
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

function buildSearchQuery(lead: LeadRow) {
  return `${lead.business_name} ${lead.district || ''} ${lead.city}`
    .replace(/\s+/g, ' ')
    .trim()
}

function extractInstagramUsername(item: GmapsItem): string | null {
  const candidates: string[] = []

  const push = (v: unknown) => {
    if (!v) return
    if (typeof v === 'string') candidates.push(v)
    else if (Array.isArray(v)) {
      for (const x of v) if (typeof x === 'string') candidates.push(x)
    }
  }

  push(item.instagrams)
  push(item.instagram)
  push(item.website)

  // contacts enrichment / socialMedia objeleri
  push(item.socialMedia)
  const social = item.socialMedia
  if (social && typeof social === 'object') {
    for (const val of Object.values(social)) push(val)
  }

  // Bazı run'larda düz alanlar: facebook, linkedin, twitter, instagrams vs.
  for (const [key, val] of Object.entries(item)) {
    if (/instagram/i.test(key)) push(val)
  }

  for (const raw of candidates) {
    const match = raw.match(
      /(?:instagram\.com\/|^@?)([A-Za-z0-9._]{2,30})(?:\/|$|\?)/i
    )
    if (!match) continue
    const username = normalizeUsername(match[1])
    if (
      !username ||
      ['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(username)
    ) {
      continue
    }
    return username
  }

  return null
}

function firstToken(name: string) {
  return name.toLowerCase().trim().split(/\s+/)[0] || ''
}

function matchLead(leads: LeadRow[], item: GmapsItem, queryByLeadId: Map<string, string>) {
  // 1) searchString ile birebir eşle
  if (item.searchString) {
    const needle = item.searchString.trim().toLowerCase()
    for (const lead of leads) {
      const q = queryByLeadId.get(lead.id)?.toLowerCase()
      if (q && q === needle) return lead
    }
  }

  // 2) title ↔ business_name benzerliği
  const title = (item.title || '').toLowerCase()
  if (!title) return null

  let best: LeadRow | null = null
  let bestScore = 0

  for (const lead of leads) {
    const name = (lead.business_name || '').toLowerCase()
    if (!name) continue

    let score = 0
    if (title === name) score = 100
    else if (title.includes(name) || name.includes(title)) score = 80
    else {
      const t0 = firstToken(title)
      const n0 = firstToken(name)
      if (t0 && n0 && (title.includes(n0) || name.includes(t0))) score = 40
    }

    if (score > bestScore) {
      bestScore = score
      best = lead
    }
  }

  return bestScore >= 40 ? best : null
}

async function scrapeGoogleMapsForInstagram() {
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

  console.log('🔍 Instagram bilgisi olmayan 100 işletme çekiliyor...')

  const { data: leadsRaw, error: fetchError } = await supabase
    .from('leads')
    .select('id, business_name, city, district')
    .or('instagram_username.is.null,instagram_username.eq.')
    .not('business_name', 'is', null)
    .neq('business_name', '')
    .not('city', 'is', null)
    .neq('city', '')
    .limit(LIMIT)

  if (fetchError || !leadsRaw) {
    console.error('❌ Lead çekme hatası:', fetchError)
    return
  }

  const leads = leadsRaw as LeadRow[]
  console.log(
    `✅ ${leads.length} işletme bulundu. Google Maps taraması başlıyor...`
  )
  console.log(
    `💰 Tahmini maliyet: ~$0.03/hesap = ~$${(leads.length * 0.03).toFixed(2)}`
  )

  if (leads.length === 0) {
    console.log('🎉 Instagram eksik işletme kalmamış.')
    return
  }

  const queryByLeadId = new Map<string, string>()
  const searchStringsArray = leads.map((lead) => {
    const q = buildSearchQuery(lead)
    queryByLeadId.set(lead.id, q)
    return q
  })

  console.log('🚀 Apify Google Maps Scraper başlatılıyor...')
  console.log(`   Actor: ${ACTOR_ID}`)
  console.log(`   Query sayısı: ${searchStringsArray.length}`)

  const run = await apifyClient.actor(ACTOR_ID).call(
    {
      searchStringsArray,
      maxCrawledPlacesPerSearch: 1,
      language: 'tr',
      skipClosedPlaces: false,
      scrapeContacts: true, // website'den social/instagram linkleri
      scrapeSocialMediaProfiles: {
        facebooks: false,
        instagrams: true,
        youtubes: false,
        tiktoks: false,
        twitters: false,
      },
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

  console.log('⏳ Tarama tamamlandı, sonuçlar işleniyor...')

  const { items } = await apifyClient
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 10_000 })

  console.log(`📦 Apify sonuç sayısı: ${items.length}`)

  let updatedCount = 0
  let notFoundCount = 0
  const usedLeadIds = new Set<string>()

  for (const raw of items as GmapsItem[]) {
    const lead = matchLead(leads, raw, queryByLeadId)
    if (!lead || usedLeadIds.has(lead.id)) {
      notFoundCount++
      continue
    }

    const instagramUsername = extractInstagramUsername(raw)
    if (!instagramUsername) {
      console.log(
        `⚠️ Instagram bulunamadı: ${lead.business_name} (${raw.title || '—'})`
      )
      notFoundCount++
      usedLeadIds.add(lead.id)
      continue
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        instagram_username: instagramUsername,
        instagram: `https://www.instagram.com/${instagramUsername}/`,
      })
      .eq('id', lead.id)
      .or('instagram_username.is.null,instagram_username.eq.')

    if (updateError) {
      console.error(
        `❌ DB hatası (${lead.business_name}):`,
        updateError.message
      )
      notFoundCount++
    } else {
      console.log(`✅ ${lead.business_name} → @${instagramUsername}`)
      updatedCount++
      usedLeadIds.add(lead.id)
    }
  }

  // Hiç sonuç dönmeyen lead'ler
  for (const lead of leads) {
    if (!usedLeadIds.has(lead.id)) {
      console.log(`⚠️ Maps sonucu yok: ${lead.business_name}`)
      notFoundCount++
    }
  }

  console.log('\n🎉 === TARAMA TAMAMLANDI ===')
  console.log(`✅ Instagram bulunan: ${updatedCount}`)
  console.log(`❌ Bulunamayan: ${notFoundCount}`)
  console.log(`💰 Gerçekleşen maliyet: Apify Dashboard'dan kontrol et`)
  console.log(
    '💡 Sonraki adım: npm run fetch:missing-avatars && npm run download:avatars'
  )
}

scrapeGoogleMapsForInstagram().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
