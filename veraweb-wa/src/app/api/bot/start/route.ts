import { connection, NextResponse } from "next/server"
import { getBotStatus, startWhatsAppBot } from "@/lib/whatsapp-bot"

export async function POST() {
  try {
    await connection()
    console.log("POST /api/bot/start — startWhatsAppBot çağrılıyor")
    const status = await startWhatsAppBot()
    console.log(
      "POST /api/bot/start — bitti:",
      status.status,
      "qr?",
      Boolean(status.qrCode)
    )

    return NextResponse.json({
      success: true,
      message: status.qrCode
        ? "QR kod hazır"
        : status.connected
          ? "WhatsApp bağlantısı aktif"
          : "Bot başlatılıyor...",
      status: {
        status: status.status,
        qr_code: status.qrCode,
        connected: status.connected,
      },
    })
  } catch (error) {
    console.error("Bot başlatılamadı:", error)
    const fallback = getBotStatus()
    return NextResponse.json(
      {
        success: false,
        error: "Bot başlatılamadı",
        detail: error instanceof Error ? error.message : String(error),
        status: {
          status: fallback.status,
          qr_code: fallback.qrCode,
          connected: fallback.connected,
        },
      },
      { status: 500 }
    )
  }
}
