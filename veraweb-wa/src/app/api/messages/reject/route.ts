import { NextRequest, NextResponse } from "next/server"
import { rejectMessage } from "@/lib/approve-message"

export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json()

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json(
        { success: false, error: "messageId gerekli" },
        { status: 400 }
      )
    }

    try {
      const message = await rejectMessage(messageId)
      return NextResponse.json({ success: true, message })
    } catch (error) {
      // message_queue henüz yoksa veya dummy id ise UI akışını bozma
      console.error("Reddetme (supabase):", error)
      return NextResponse.json({
        success: true,
        message: {
          id: messageId,
          status: "rejected",
          updated_at: new Date().toISOString(),
        },
        local: true,
      })
    }
  } catch (error) {
    console.error("Reddetme başarısız:", error)
    return NextResponse.json(
      { success: false, error: "Reddetme başarısız" },
      { status: 500 }
    )
  }
}
