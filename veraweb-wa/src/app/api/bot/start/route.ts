import { connection, NextResponse } from "next/server"
import { startWhatsAppBot } from "@/lib/whatsapp-bot"

export async function POST() {
  try {
    await connection()
    await startWhatsAppBot()
    return NextResponse.json({
      success: true,
      message: "Bot başlatılıyor...",
    })
  } catch (error) {
    console.error("Bot başlatılamadı:", error)
    return NextResponse.json(
      { success: false, error: "Bot başlatılamadı" },
      { status: 500 }
    )
  }
}
