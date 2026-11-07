/**
 * Leads avatar durum raporu (WhatsApp / Instagram / fallback).
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
  whatsapp_profile_pic_url: string | null
  instagram_profile_pic_url: string | null
  phone: string | null
}

function hasUrl(value: string | null | undefined) {
  return Boolean((value || '').trim())
}

async function fetchAllLeads(
  supabase: ReturnType<typeof createClient>
): Promise<LeadRow[]> {
  const rows: LeadRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('leads')
      .select(
        'id, business_name, sector, whatsapp_profile_pic_url, instagram_profile_pic_url, phone'
      )
      .not('phone', 'is', null)
      .neq('phone', '')
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...(data as LeadRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

async function generateAvatarStatusReport() {
  console.log('🔍 Avatar durum raporu oluşturuluyor...\n')

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

  console.log(`📊 Toplam lead sayısı (telefonu olan): ${allLeads.length}\n`)

  const stats = {
    whatsappOnly: 0,
    instagramOnly: 0,
    both: 0,
    none: 0,
    total: allLeads.length,
  }

  const sectorStats: Record<
    string,
    { whatsapp: number; instagram: number; none: number; total: number }
  > = {}

  for (const lead of allLeads) {
    const hasWhatsApp = hasUrl(lead.whatsapp_profile_pic_url)
    const hasInstagram = hasUrl(lead.instagram_profile_pic_url)
    const sector = lead.sector || 'belirtilmemiş'

    if (!sectorStats[sector]) {
      sectorStats[sector] = { whatsapp: 0, instagram: 0, none: 0, total: 0 }
    }
    sectorStats[sector].total++

    if (hasWhatsApp && hasInstagram) {
      stats.both++
      sectorStats[sector].whatsapp++
      sectorStats[sector].instagram++
    } else if (hasWhatsApp) {
      stats.whatsappOnly++
      sectorStats[sector].whatsapp++
    } else if (hasInstagram) {
      stats.instagramOnly++
      sectorStats[sector].instagram++
    } else {
      stats.none++
      sectorStats[sector].none++
    }
  }

  const withAnyAvatar = stats.both + stats.whatsappOnly + stats.instagramOnly
  const uiWhatsAppFirst = stats.both + stats.whatsappOnly
  const uiInstagramFallback = stats.instagramOnly

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           MYVERA AVATAR DURUM RAPORU                        ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  console.log('📱 GENEL DURUM:')
  console.log('─────────────────────────────────────────────────────────────')
  console.log(
    `✅ WhatsApp + Instagram:  ${stats.both} lead (%${((stats.both / stats.total) * 100).toFixed(1)})`
  )
  console.log(
    `📱 Sadece WhatsApp:       ${stats.whatsappOnly} lead (%${((stats.whatsappOnly / stats.total) * 100).toFixed(1)})`
  )
  console.log(
    `📷 Sadece Instagram:      ${stats.instagramOnly} lead (%${((stats.instagramOnly / stats.total) * 100).toFixed(1)})`
  )
  console.log(
    `❌ Avatar Yok (Fallback): ${stats.none} lead (%${((stats.none / stats.total) * 100).toFixed(1)})`
  )
  console.log('─────────────────────────────────────────────────────────────')
  console.log(`📊 TOPLAM:                ${stats.total} lead`)
  console.log(
    `🖼️  UI'da fotoğraf gösteren: ${withAnyAvatar} (%${((withAnyAvatar / stats.total) * 100).toFixed(1)}) — WA önce: ${uiWhatsAppFirst}, IG fallback: ${uiInstagramFallback}, baş harf: ${stats.none}\n`
  )

  console.log('🏭 SEKTÖREL DAĞILIM:')
  console.log('─────────────────────────────────────────────────────────────')
  const sectorsSorted = Object.entries(sectorStats).sort(
    (a, b) => b[1].total - a[1].total
  )
  for (const [sector, data] of sectorsSorted) {
    const whatsappRate = ((data.whatsapp / data.total) * 100).toFixed(1)
    const instagramRate = ((data.instagram / data.total) * 100).toFixed(1)
    const noneRate = ((data.none / data.total) * 100).toFixed(1)

    console.log(`\n📌 ${sector.toUpperCase()} (${data.total} lead):`)
    console.log(
      `   WhatsApp: ${data.whatsapp} (${whatsappRate}%) | Instagram: ${data.instagram} (${instagramRate}%) | Yok: ${data.none} (${noneRate}%)`
    )
  }

  console.log('\n─────────────────────────────────────────────────────────────')
  console.log('💡 ÖNERİLER:')
  console.log('─────────────────────────────────────────────────────────────')

  if (stats.none > 0) {
    console.log(`⚠️  ${stats.none} lead'de avatar yok. Bunlar için:`)
    console.log(
      `   - WhatsApp profil fotoğraflarını çek: npm run fetch:wa-avatars`
    )
    console.log(
      `   - Sağlık sektörü (avatarı olmayanlar): npm run fetch:wa-avatars:health`
    )
    console.log(
      `   - Instagram avatarlarını çek: npm run fetch:missing-avatars`
    )
  }

  if (stats.instagramOnly > stats.whatsappOnly) {
    console.log(
      `📱 Instagram'da ${stats.instagramOnly} lead var ama WhatsApp'ta yok.`
    )
    console.log(
      `   WhatsApp fotoğraflarını çekmek için: npm run fetch:wa-avatars`
    )
  }

  console.log('\n🎉 Rapor tamamlandı!')
}

generateAvatarStatusReport().catch((err) => {
  console.error('❌ Script çöktü:', err)
  process.exit(1)
})
