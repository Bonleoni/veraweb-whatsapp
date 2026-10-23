import { NextResponse } from "next/server"
import { getBotStatus } from "@/lib/whatsapp-bot"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const live = getBotStatus()

    const { data } = await supabase
      .from("bot_sessions")
      .select("*")
      .eq("phone_number", process.env.WHATSAPP_PHONE || "default")
      .maybeSingle()

    return NextResponse.json({
      success: true,
      status: {
        ...(data || { status: "disconnected" }),
        status: live.status === "connected" ? "connected" : data?.status || live.status,
        qr_code: live.qrCode || data?.qr_code || null,
        connected: live.connected,
      },
      live,
    })
  } catch (error) {
    console.error("Durum alınamadı:", error)
    const live = getBotStatus()
    return NextResponse.json({
      success: true,
      status: {
        status: live.status,
        qr_code: live.qrCode,
        connected: live.connected,
      },
      live,
    })
  }
}
