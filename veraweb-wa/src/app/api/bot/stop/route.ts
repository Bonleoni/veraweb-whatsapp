import { connection, NextResponse } from "next/server"
import { stopWhatsAppBot } from "@/lib/whatsapp-bot"

export async function POST() {
  try {
    await connection()
    await stopWhatsAppBot()
    return NextResponse.json({
      success: true,
      message: "Bot durduruldu",
    })
  } catch (error) {
    console.error("Bot durdurulamadı:", error)
    return NextResponse.json(
      { success: false, error: "Bot durdurulamadı" },
      { status: 500 }
    )
  }
}
