/**
 * Instagram'ı olmayan lead'ler için Google Search (site:instagram.com) ile username bulur.
 * Çalıştır: npm run search:ig
 */

import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const LIMIT = 100
const ACTOR_ID = 'apify/google-search-scraper'
const MAX_RESULTS_TO_CHECK = 3

const INVALID_USERNAMES = new Set([
  'login',
  'accounts',
  'p',
  'reel',
  'reels',
  'explore',
  'stories',
  'direct',
  'tv',
  'about',
  'developer',
  'legal',
  'privacy',
  'help',
  'web',
  'directory',
  'nametag',
  'popular',
  'tags',
  'locations',
  'share',
])

type LeadRow = {
  id: string
  business_name: string | null
  city: string | null
  district: string | null
}

type OrganicResult = {
  url?: string
  displayedUrl?: string
  title?: string
  description?: string
}

type SearchItem = {
  query?: string
  searchQuery?: string | { term?: string }
  organicResults?: OrganicResult[]
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

function buildQuery(lead: LeadRow) {
  const name = (lead.business_name || '').trim()
  const city = (lead.city || '').trim()
  return `"${name}" ${city} site:instagram.com`
}

function getItemQuery(item: SearchItem): string {
  if (typeof item.query === 'string') return item.query
  if (typeof item.searchQuery === 'string') return item.searchQuery
  if (
    item.searchQuery &&
    typeof item.searchQuery === 'object' &&
    typeof item.searchQuery.term === 'string'
  ) {
    return item.searchQuery.term
  }
  return ''
}

function isValidUsername(username: string) {
  return Boolean(username) && !INVALID_USERNAMES.has(username) && username.length >= 2
}

function extractUsernameFromUrl(url: string): string | null {
  // Sadece profil URL'leri: /username veya /username/
  // /reel/, /p/, /popular/... reddedilir
  const match = url.match(
    /instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#]|$)/i
  )
  if (!match) return null
  const username = normalizeUsername(match[1])
  return isValidUsername(username) ? username : null
}

function extractUsernameFromText(text: string): string | null {
  // Başlıkta "@username" veya "instagram.com/username"
  const at = text.match(/@([A-Za-z0-9._]{2,30})\b/)
  if (at) {
    const username = normalizeUsername(at[1])
    if (isValidUsername(username)) return username
  }
  const urlish = text.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/i)
  if (urlish) {
    const username = normalizeUsername(urlish[1])
    if (isValidUsername(username)) return username
  }
  return null
}

function pickUsername(results: OrganicResult[]): string | null {
  // 1) Temiz profil URL'leri
  for (const result of results.slice(0, MAX_RESULTS_TO_CHECK)) {
    const fromUrl = extractUsernameFromUrl(result.url || '')
    if (fromUrl) return fromUrl
  }
  // 2) displayedUrl içinde profil
  for (const result of results.slice(0, MAX_RESULTS_TO_CHECK)) {
    const fromDisplayed = extractUsernameFromUrl(result.displayedUrl || '')
    if (fromDisplayed) return fromDisplayed
  }
  // 3) Title / description içindeki @handle (reel/post sonuçları için)
  for (const result of results.slice(0, MAX_RESULTS_TO_CHECK)) {
    const fromTitle = extractUsernameFromText(
      `${result.title || ''} ${result.description || ''}`
    )
    if (fromTitle) return fromTitle
  }
  return null
}

async function googleSearchForInstagram() {
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

  console.log("🔍 Instagram bilgisi olmayan lead'ler çekiliyor...")

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
  console.log(`✅ ${leads.length} işletme bulundu.`)
  console.log(
    `💰 Tahmini maliyet: ~$0.015/hesap = ~$${(leads.length * 0.015).toFixed(2)}`
  )

  if (leads.length === 0) {
    console.log('🎉 Instagram eksik işletme kalmamış.')
    return
  }

  const leadByQuery = new Map<string, LeadRow>()
  const searchQueries = leads.map((lead) => {
    const q = buildQuery(lead)
    leadByQuery.set(q.toLowerCase(), lead)
    return q
  })

  console.log('🚀 Apify Google Search Scraper başlatılıyor...')
  console.log('📝 Örnek query:', searchQueries[0])

  const run = await apifyClient.actor(ACTOR_ID).call(
    {
      queries: searchQueries.join('\n'),
      maxPagesPerQuery: 1,
      countryCode: 'tr',
      searchLanguage: 'tr',
      languageCode: 'tr',
      site: 'instagram.com',
      forceExactMatch: false,
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false,
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
  const foundUsernames: string[] = []
  const usedLeadIds = new Set<string>()

  for (const raw of items as SearchItem[]) {
    const query = getItemQuery(raw)
    const organic = Array.isArray(raw.organicResults) ? raw.organicResults : []

    if (organic.length === 0) continue

    const username = pickUsername(organic)
    if (!username) continue

    let lead =
      (query && leadByQuery.get(query.toLowerCase())) ||
      leads.find((l) => {
        const name = (l.business_name || '').trim()
        return name && query.includes(name)
      })

    if (!lead && query) {
      const qLower = query.toLowerCase()
      for (const l of leads) {
        const name = (l.business_name || '').toLowerCase()
        if (name && qLower.includes(name)) {
          lead = l
          break
        }
      }
    }

    if (!lead || usedLeadIds.has(lead.id)) continue

    const { error: updateError } = await supabase
      .from('leads')
      .update({ instagram_username: username })
      .eq('id', lead.id)
      .or('instagram_username.is.null,instagram_username.eq.')

    if (updateError) {
      console.error(
        `❌ DB hatası (${lead.business_name}):`,
        updateError.message
      )
      continue
    }

    console.log(`✅ ${lead.business_name} → @${username}`)
    foundUsernames.push(username)
    updatedCount++
    usedLeadIds.add(lead.id)
  }

  const stillMissing = leads.length - updatedCount

  console.log('\n🎉 === TARAMA TAMAMLANDI ===')
  console.log(`✅ Instagram bulunan: ${updatedCount}`)
  console.log(`❌ Bulunamayan: ${stillMissing}`)
  console.log(
    `📊 Başarı oranı: %${((updatedCount / leads.length) * 100).toFixed(1)}`
  )
  console.log(`💰 Gerçekleşen maliyet: Apify Dashboard'dan kontrol et`)

  if (foundUsernames.length > 0) {
    console.log('\n📋 Bulunan kullanıcı adları:')
    for (const u of foundUsernames) console.log(`  - @${u}`)
  }

  console.log(
    '\n💡 Sonraki adım: npm run fetch:missing-avatars && npm run download:avatars'
  )
}

googleSearchForInstagram().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
