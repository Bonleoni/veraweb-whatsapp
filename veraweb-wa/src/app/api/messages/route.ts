import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { SCENARIOS, type ScenarioType } from "@/lib/scenarios"

function mapStatus(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return "Onaylandı"
    case "rejected":
      return "Reddedildi"
    case "sent":
      return "Onaylandı"
    default:
      return "Bekliyor"
  }
}

function mapScenario(type: string | null | undefined): ScenarioType {
  const key = (type ?? "").toUpperCase()
  if (key === "FOLLOW_UP" || key === "ABSENCE" || key === "REMINDER") {
    return key
  }
  return "REMINDER"
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return "Az önce"
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return "Az önce"
  if (minutes < 60) return `${minutes} dakika önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  return `${days} gün önce`
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
]

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("message_queue")
      .select(
        `
        *,
        customers (name, phone)
      `
      )
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Mesaj kuyruğu okunamadı:", error)
      return NextResponse.json({ success: true, messages: [], local: true })
    }

    const messages = (data ?? []).map((row, index) => {
      const customer = Array.isArray(row.customers)
        ? row.customers[0]
        : row.customers

      return {
        id: String(row.id),
        customer: customer?.name ?? "Bilinmeyen müşteri",
        phone: customer?.phone ?? "—",
        scenario: mapScenario(row.scenario_type),
        message:
          row.message_content ??
          SCENARIOS[mapScenario(row.scenario_type)].template(
            customer?.name ?? "Müşteri",
            "14:00"
          ),
        status: mapStatus(row.status),
        created: relativeTime(row.created_at),
        createdRank: index + 1,
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      }
    })

    return NextResponse.json({ success: true, messages })
  } catch (error) {
    console.error("Mesaj listesi başarısız:", error)
    return NextResponse.json({ success: true, messages: [], local: true })
  }
}
