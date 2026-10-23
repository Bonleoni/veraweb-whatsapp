import { connection, NextResponse } from "next/server"
import { getBotStatus } from "@/lib/whatsapp-bot"

export async function GET() {
  try {
    await connection()
    const status = getBotStatus()
    return NextResponse.json({
      success: true,
      status: {
        status: status.status,
        qr_code: status.qrCode,
        connected: status.connected,
      },
    })
  } catch (error) {
    console.error("Durum alınamadı:", error)
    return NextResponse.json(
      { success: false, error: "Durum alınamadı" },
      { status: 500 }
    )
  }
}
