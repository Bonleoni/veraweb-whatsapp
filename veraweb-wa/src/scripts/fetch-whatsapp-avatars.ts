/**
 * Bot Ayarları’ndaki Baileys oturumu üzerinden lead WA profil fotoğraflarını çeker.
 * Ayrı QR gerekmez — Next.js’te bot bağlı olmalı.
 *
 * Çalıştır: npm run fetch:wa-avatars
 * Önce: supabase/whatsapp_profile_pic.sql
 */

const BASE =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000"

/** WA_AVATAR_FILTER=health → pilates/fizyo/diyet (tesisat hariç) */
const FILTER = (process.env.WA_AVATAR_FILTER || "all") as "all" | "health"
/** WA_ONLY_MISSING_ANY=1 → ne WA ne IG avatarı olmayanlar */
const ONLY_MISSING_ANY = process.env.WA_ONLY_MISSING_ANY === "1"

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log("⏳ Bot Ayarları oturumu ile avatar çekimi başlatılıyor...")
  console.log(`   API: ${BASE}/api/bot/fetch-avatars`)
  console.log(
    `   filter=${FILTER} onlyMissingAny=${ONLY_MISSING_ANY ? "yes" : "no"}`
  )

  const startRes = await fetch(`${BASE}/api/bot/fetch-avatars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: FILTER,
      onlyMissingAny: ONLY_MISSING_ANY,
    }),
  })
  const startJson = (await startRes.json()) as {
    success?: boolean
    error?: string
    message?: string
    job?: Record<string, unknown>
  }

  if (!startRes.ok || !startJson.success) {
    console.error("❌ Başlatılamadı:", startJson.error || startRes.statusText)
    console.error(
      "💡 Bot Ayarları sayfasında WhatsApp’ın «Bağlı» olduğundan emin olun."
    )
    process.exit(1)
  }

  console.log("✅", startJson.message || "Başladı")

  for (;;) {
    await sleep(3000)
    const statusRes = await fetch(`${BASE}/api/bot/fetch-avatars`)
    const statusJson = (await statusRes.json()) as {
      connected?: boolean
      job?: {
        running?: boolean
        finished?: boolean
        total?: number
        done?: number
        success?: number
        fail?: number
        notFound?: number
        current?: string
        error?: string
      }
    }

    const job = statusJson.job
    if (!job) {
      console.log("… durum bekleniyor")
      continue
    }

    const line = `[${job.done ?? 0}/${job.total ?? 0}] ✅${job.success ?? 0} ⚠️${job.notFound ?? 0} ❌${job.fail ?? 0}`
    if (job.current) {
      console.log(`${line} — ${job.current}`)
    } else {
      console.log(line)
    }

    if (job.error && !job.running) {
      console.error("❌", job.error)
      process.exit(1)
    }

    if (job.finished && !job.running) {
      console.log("\n🎉 === İŞLEM TAMAMLANDI ===")
      console.log(`✅ Fotoğraf çekilen: ${job.success ?? 0}`)
      console.log(`⚠️ Fotoğrafı olmayan / bulunamayan: ${job.notFound ?? 0}`)
      console.log(`❌ Hata olan: ${job.fail ?? 0}`)
      process.exit(0)
    }
  }
}

main().catch((err) => {
  console.error("❌ Script çöktü:", err)
  process.exit(1)
})
