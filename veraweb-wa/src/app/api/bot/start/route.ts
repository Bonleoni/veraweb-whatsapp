import { connection, NextResponse } from "next/server"
import { startWhatsAppBot } from "@/lib/whatsapp-bot"

export async function POST() {
  console.log("🚀 /api/bot/start - POST isteği alındı")

  try {
    await connection()
    const result = await startWhatsAppBot()
    console.log("✅ Bot başlatma sonucu:", {
      success: result.success,
      message: result.message,
      status: result.status?.status,
      hasQr: Boolean(result.status?.qr_code),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Bot başlatma hatası:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 }
    )
  }
}
