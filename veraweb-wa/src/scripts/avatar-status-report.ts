/**
 * Leads avatar + sektör raporu
 * Kategoriler: Tesisat | Pilates | Fizyoterapist | Diyetisyen
 * (DB sector + işletme adı / IG kullanıcı adı ile sınıflandırılır)
 *
 * Çalıştır: npm run report:avatars
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const PAGE = 1000

type LeadRow = {
  id: string
  business_name: string | null
  sector: string | null
  instagram_username: string | null
  whatsapp_profile_pic_url: string | null
  instagram_profile_pic_url: string | null
  phone: string | null
}

type Category =
  | 'tesisat'
  | 'pilates'
  | 'fizyoterapist'
  | 'diyetisyen'
  | 'diger'

const CATEGORY_ORDER: Category[] = [
  'tesisat',
  'pilates',
  'fizyoterapist',
  'diyetisyen',
  'diger',
]

const CATEGORY_LABEL: Record<Category, string> = {
  tesisat: 'TESİSAT',
  pilates: 'PİLATES',
  fizyoterapist: 'FİZYOTERAPİST',
  diyetisyen: 'DİYETİSYEN',
  diger: 'DİĞER',
}

type Bucket = {
  total: number
  withPhone: number
  whatsappOnly: number
  instagramOnly: number
  both: number
  none: number
  /** en az bir avatar (WA veya IG) */
  anyAvatar: number
  /** WA URL’si olan (both + only) */
  whatsapp: number
  /** IG URL’si olan (both + only) */
  instagram: number
}

function emptyBucket(): Bucket {
  return {
    total: 0,
    withPhone: 0,
    whatsappOnly: 0,
    instagramOnly: 0,
    both: 0,
    none: 0,
    anyAvatar: 0,
    whatsapp: 0,
    instagram: 0,
  }
}

function hasUrl(value: string | null | undefined) {
  return Boolean((value || '').trim())
}

function hasPhone(value: string | null | undefined) {
  return Boolean((value || '').trim())
}

/** Öncelik: tesisat → diyetisyen → fizyoterapist → pilates → diğer */
function classifyLead(lead: LeadRow): Category {
  const sector = (lead.sector || '').toLowerCase().trim()
  const name = (lead.business_name || '').toLowerCase()
  const ig = (lead.instagram_username || '').toLowerCase()
  const text = `${sector} ${name} ${ig}`

  if (
    sector === 'tesisat' ||
    /tesisat|kombi|petek|tıkan|tikan|kacak|kaçak|vidanj|pimaş|pimas|sıhhi|sihhi|klima\s*servis/.test(
      text
    )
  ) {
    return 'tesisat'
  }

  if (
    sector === 'diyetisyen' ||
    sector === 'diyet' ||
    /diyetisyen|diyet|beslenme|nutri/.test(text)
  ) {
    return 'diyetisyen'
  }

  if (
    sector === 'fizyoterapist' ||
    sector === 'fizyoterapi' ||
    /fizyoterapist|fizyoterapi|fizyo|fizik\s*tedavi|physiotherap|rehabilit/.test(
      text
    )
  ) {
    return 'fizyoterapist'
  }

  if (
    sector === 'pilates' ||
    /pilates|reformer/.test(text)
  ) {
    return 'pilates'
  }

  // Eski varsayılan: sector boş ama sağlık dışı değilse pilates kovasına alma
  if (!sector || sector === 'belirtilmemiş') {
    return 'diger'
  }

  return 'pilates'
}

function pct(n: number, total: number) {
  if (!total) return '0.0'
  return ((n / total) * 100).toFixed(1)
}

async function fetchAllLeads(
  supabase: ReturnType<typeof createClient>
): Promise<LeadRow[]> {
  const rows: LeadRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('leads')
      .select(
        'id, business_name, sector, instagram_username, whatsapp_profile_pic_url, instagram_profile_pic_url, phone'
      )
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...(data as LeadRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

function printBucket(label: string, b: Bucket) {
  console.log(`\n📌 ${label} (${b.total} lead, telefonlu: ${b.withPhone}):`)
  console.log(
    `   WA+IG: ${b.both} (%${pct(b.both, b.total)}) | Sadece WA: ${b.whatsappOnly} (%${pct(b.whatsappOnly, b.total)}) | Sadece IG: ${b.instagramOnly} (%${pct(b.instagramOnly, b.total)}) | Yok: ${b.none} (%${pct(b.none, b.total)})`
  )
  console.log(
    `   WhatsApp kaplama: ${b.whatsapp} (%${pct(b.whatsapp, b.total)}) | Instagram kaplama: ${b.instagram} (%${pct(b.instagram, b.total)}) | Herhangi avatar: ${b.anyAvatar} (%${pct(b.anyAvatar, b.total)})`
  )
}

async function generateAvatarStatusReport() {
  console.log('🔍 Avatar + sektör araştırma raporu oluşturuluyor...\n')

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase URL/KEY eksik (.env.local).')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  let allLeads: LeadRow[]
  try {
    allLeads = await fetchAllLeads(supabase)
  } catch (fetchError) {
    console.error('❌ Veri çekme hatası:', fetchError)
    return
  }

  const byCategory: Record<Category, Bucket> = {
    tesisat: emptyBucket(),
    pilates: emptyBucket(),
    fizyoterapist: emptyBucket(),
    diyetisyen: emptyBucket(),
    diger: emptyBucket(),
  }

  const overall = emptyBucket()
  overall.total = allLeads.length

  for (const lead of allLeads) {
    const cat = classifyLead(lead)
    const bucket = byCategory[cat]
    const wa = hasUrl(lead.whatsapp_profile_pic_url)
    const ig = hasUrl(lead.instagram_profile_pic_url)
    const phone = hasPhone(lead.phone)

    bucket.total++
    if (phone) bucket.withPhone++
    if (wa) bucket.whatsapp++
    if (ig) bucket.instagram++

    if (wa && ig) {
      bucket.both++
      bucket.anyAvatar++
    } else if (wa) {
      bucket.whatsappOnly++
      bucket.anyAvatar++
    } else if (ig) {
      bucket.instagramOnly++
      bucket.anyAvatar++
    } else {
      bucket.none++
    }

    if (phone) overall.withPhone++
    if (wa) overall.whatsapp++
    if (ig) overall.instagram++
    if (wa && ig) {
      overall.both++
      overall.anyAvatar++
    } else if (wa) {
      overall.whatsappOnly++
      overall.anyAvatar++
    } else if (ig) {
      overall.instagramOnly++
      overall.anyAvatar++
    } else {
      overall.none++
    }
  }

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║     MYVERA SEKTÖR + AVATAR ARAŞTIRMA RAPORU                 ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  console.log('📚 Araştırma kategorileri (DB sector + işletme adı):')
  console.log('   Tesisat → Pilates → Fizyoterapist → Diyetisyen\n')

  console.log('📱 GENEL DURUM (tüm lead’ler):')
  console.log('─────────────────────────────────────────────────────────────')
  console.log(`📊 Toplam lead:              ${overall.total}`)
  console.log(`📞 Telefonu olan:            ${overall.withPhone}`)
  console.log(
    `✅ WhatsApp + Instagram:     ${overall.both} (%${pct(overall.both, overall.total)})`
  )
  console.log(
    `📱 Sadece WhatsApp:          ${overall.whatsappOnly} (%${pct(overall.whatsappOnly, overall.total)})`
  )
  console.log(
    `📷 Sadece Instagram:         ${overall.instagramOnly} (%${pct(overall.instagramOnly, overall.total)})`
  )
  console.log(
    `❌ Avatar Yok (Fallback):    ${overall.none} (%${pct(overall.none, overall.total)})`
  )
  console.log(
    `🖼️  UI fotoğraf (WA→IG):     ${overall.anyAvatar} (%${pct(overall.anyAvatar, overall.total)}) — baş harf: ${overall.none}`
  )

  console.log('\n🏭 SEKTÖREL DAĞILIM:')
  console.log('─────────────────────────────────────────────────────────────')

  for (const key of CATEGORY_ORDER) {
    const b = byCategory[key]
    if (b.total === 0) continue
    printBucket(CATEGORY_LABEL[key], b)
  }

  // Özet tablo
  console.log('\n─────────────────────────────────────────────────────────────')
  console.log('📋 ÖZET TABLO')
  console.log('─────────────────────────────────────────────────────────────')
  console.log(
    'Sektör'.padEnd(16) +
      'Toplam'.padStart(8) +
      'Tel'.padStart(7) +
      'WA%'.padStart(8) +
      'IG%'.padStart(8) +
      'Yok%'.padStart(8)
  )
  for (const key of CATEGORY_ORDER) {
    const b = byCategory[key]
    if (b.total === 0) continue
    console.log(
      CATEGORY_LABEL[key].padEnd(16) +
        String(b.total).padStart(8) +
        String(b.withPhone).padStart(7) +
        `${pct(b.whatsapp, b.total)}%`.padStart(8) +
        `${pct(b.instagram, b.total)}%`.padStart(8) +
        `${pct(b.none, b.total)}%`.padStart(8)
    )
  }

  console.log('\n─────────────────────────────────────────────────────────────')
  console.log('💡 ÖNERİLER:')
  console.log('─────────────────────────────────────────────────────────────')

  const fizyo = byCategory.fizyoterapist
  const diyet = byCategory.diyetisyen
  const pilates = byCategory.pilates
  const tesisat = byCategory.tesisat

  if (fizyo.none > 0) {
    console.log(
      `🩺 Fizyoterapist: ${fizyo.none}/${fizyo.total} avatar yok — WA: npm run fetch:wa-avatars:health | IG: npm run fetch:missing-avatars`
    )
  }
  if (diyet.none > 0) {
    console.log(
      `🥗 Diyetisyen: ${diyet.none}/${diyet.total} avatar yok — aynı komutlar`
    )
  }
  if (pilates.none > 0) {
    console.log(`🧘 Pilates: ${pilates.none}/${pilates.total} avatar yok`)
  }
  if (tesisat.none > 0) {
    console.log(
      `🔧 Tesisat: ${tesisat.none}/${tesisat.total} avatar yok (IG neredeyse yok → WA öncelikli)`
    )
  }

  console.log('\n🎉 Rapor tamamlandı!')
}

generateAvatarStatusReport().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
