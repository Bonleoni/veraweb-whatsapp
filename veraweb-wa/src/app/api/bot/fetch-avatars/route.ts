import { connection, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { WASocket } from "@whiskeysockets/baileys"

export const maxDuration = 300

type AvatarJob = {
  running: boolean
  finished: boolean
  total: number
  done: number
  success: number
  fail: number
  notFound: number
  filter?: string
  current?: string
  error?: string
  startedAt?: string
  finishedAt?: string
}

type FetchOptions = {
  /** health = pilates + fizyo + diyet (tesisat hariç) */
  filter?: "all" | "health"
  /** true: ne WA ne IG avatarı olmayanlar */
  onlyMissingAny?: boolean
  skipExisting?: boolean
}

type FetchGlobal = {
  baileysSocket?: WASocket | null
  baileysState?: string
  waSocket?: WASocket | null
  waConnectionState?: string
  avatarFetchJob?: AvatarJob
  avatarFetchOptions?: FetchOptions
}

const PAGE = 1000
const DELAY_MS = 500

const HEALTH_NAME_RE =
  /pilates|fizyo|fizik\s*tedavi|physiotherap|diyet|beslenme|nutri/i

function getActiveSocket(): WASocket | null {
  const g = globalThis as typeof globalThis & FetchGlobal
  if (g.baileysState === "connected" && g.baileysSocket) return g.baileysSocket
  if (g.waConnectionState === "connected" && g.waSocket) return g.waSocket
  return null
}

function toWhatsAppDigits(phone: string): string | null {
  let digits = phone.replace(/\D+/g, "")
  if (!digits) return null
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `90${digits.slice(1)}`
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    digits = `90${digits}`
  }
  if (digits.length < 11 || digits.length > 15) return null
  return digits
}

function isHealthLead(lead: {
  sector?: string | null
  business_name?: string | null
}): boolean {
  const sector = (lead.sector || "").toLowerCase().trim()
  if (sector === "tesisat") return false
  if (
    sector === "pilates" ||
    sector === "fizyoterapist" ||
    sector === "fizyoterapi" ||
    sector === "diyetisyen" ||
    sector === "diyet"
  ) {
    return true
  }
  // sector boş/null ama isimde sağlık sinyali
  return HEALTH_NAME_RE.test(lead.business_name || "")
}

function jobState(): AvatarJob {
  const g = globalThis as typeof globalThis & FetchGlobal
  if (!g.avatarFetchJob) {
    g.avatarFetchJob = {
      running: false,
      finished: false,
      total: 0,
      done: 0,
      success: 0,
      fail: 0,
      notFound: 0,
    }
  }
  return g.avatarFetchJob
}

async function fetchAllLeads(
  supabase: ReturnType<typeof createClient>
) {
  const rows: Array<{
    id: string
    phone: string | null
    business_name: string | null
    sector: string | null
    whatsapp_profile_pic_url: string | null
    instagram_profile_pic_url: string | null
  }> = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, phone, business_name, sector, whatsapp_profile_pic_url, instagram_profile_pic_url"
      )
      .not("phone", "is", null)
      .neq("phone", "")
      .range(from, from + PAGE - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }

  return rows
}

async function runAvatarFetch() {
  const g = globalThis as typeof globalThis & FetchGlobal
  const job = jobState()
  const opts: FetchOptions = g.avatarFetchOptions || {}
  const sock = getActiveSocket()

  if (!sock) {
    job.running = false
    job.finished = true
    job.error = "WhatsApp bağlantısı aktif değil (Bot Ayarları’ndan bağlanın)"
    job.finishedAt = new Date().toISOString()
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    job.running = false
    job.finished = true
    job.error = "Supabase env eksik"
    job.finishedAt = new Date().toISOString()
    return
  }

  const supabase = createClient(url, key)
  const skipExisting = opts.skipExisting !== false

  try {
    let leads = await fetchAllLeads(supabase)

    if (opts.filter === "health") {
      leads = leads.filter(isHealthLead)
    }

    let pending = skipExisting
      ? leads.filter((l) => !(l.whatsapp_profile_pic_url || "").trim())
      : leads

    if (opts.onlyMissingAny) {
      pending = pending.filter(
        (l) =>
          !(l.whatsapp_profile_pic_url || "").trim() &&
          !(l.instagram_profile_pic_url || "").trim()
      )
    }

    job.total = pending.length
    job.filter = [
      opts.filter || "all",
      opts.onlyMissingAny ? "no-any-avatar" : "no-wa-avatar",
    ].join("+")
    console.log(
      `📸 WA avatar [${job.filter}]: ${pending.length} lead işlenecek`
    )

    for (const lead of pending) {
      if (!getActiveSocket()) {
        job.error = "WhatsApp bağlantısı koptu"
        break
      }

      const label = lead.business_name || lead.phone || lead.id
      job.current = label
      job.done++

      try {
        const digits = toWhatsAppDigits(lead.phone || "")
        if (!digits) {
          job.notFound++
          continue
        }

        const jid = `${digits}@s.whatsapp.net`
        let profilePicUrl: string | undefined
        try {
          profilePicUrl = await sock.profilePictureUrl(jid, "image")
        } catch {
          profilePicUrl = undefined
        }

        if (!profilePicUrl) {
          console.log(`⚠️ Fotoğraf yok: ${label}`)
          job.notFound++
          await new Promise((r) => setTimeout(r, DELAY_MS))
          continue
        }

        const { error: updateError } = await supabase
          .from("leads")
          .update({ whatsapp_profile_pic_url: profilePicUrl })
          .eq("id", lead.id)

        if (updateError) {
          console.error(`❌ DB (${label}):`, updateError.message)
          job.fail++
        } else {
          console.log(`✅ ${label}`)
          job.success++
        }
      } catch (err) {
        console.error(`❌ ${label}:`, err)
        job.fail++
      }

      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  } catch (err) {
    job.error = err instanceof Error ? err.message : String(err)
  } finally {
    job.running = false
    job.finished = true
    job.current = undefined
    job.finishedAt = new Date().toISOString()
    g.avatarFetchJob = job
    console.log(
      `🎉 WA avatar bitti — ok:${job.success} yok:${job.notFound} hata:${job.fail}`
    )
  }
}

export async function GET() {
  await connection()
  const job = jobState()
  return NextResponse.json({
    success: true,
    connected: Boolean(getActiveSocket()),
    job,
  })
}

export async function POST(req: Request) {
  await connection()

  if (!getActiveSocket()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "WhatsApp bağlı değil. Bot Ayarları sayfasından bağlantıyı açık tutun.",
      },
      { status: 400 }
    )
  }

  const job = jobState()
  if (job.running) {
    return NextResponse.json({
      success: true,
      message: "Zaten çalışıyor",
      job,
    })
  }

  let body: FetchOptions = {}
  try {
    body = (await req.json()) as FetchOptions
  } catch {
    body = {}
  }

  const g = globalThis as typeof globalThis & FetchGlobal
  g.avatarFetchOptions = {
    filter: body.filter || "all",
    onlyMissingAny: Boolean(body.onlyMissingAny),
    skipExisting: body.skipExisting !== false,
  }

  g.avatarFetchJob = {
    running: true,
    finished: false,
    total: 0,
    done: 0,
    success: 0,
    fail: 0,
    notFound: 0,
    filter: g.avatarFetchOptions.filter,
    startedAt: new Date().toISOString(),
  }

  void runAvatarFetch()

  return NextResponse.json({
    success: true,
    message: `Avatar çekimi başladı (${g.avatarFetchOptions.filter}${
      g.avatarFetchOptions.onlyMissingAny ? ", sadece avatarı olmayanlar" : ""
    })`,
    job: g.avatarFetchJob,
  })
}
