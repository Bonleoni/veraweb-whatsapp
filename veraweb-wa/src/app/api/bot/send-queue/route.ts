import { connection, NextResponse } from "next/server"
import { sendWhatsAppMessage } from "@/lib/whatsapp-bot"
import { supabase } from "@/lib/supabase"

export async function POST() {
  try {
    await connection()
    const { data: messages, error } = await supabase
      .from("message_queue")
      .select(
        `
        *,
        customers (phone)
      `
      )
      .eq("status", "approved")
      .is("sent_at", null)

    if (error) {
      console.error("Kuyruk okunamadı:", error)
      return NextResponse.json({
        success: true,
        message: "Gönderilecek mesaj yok",
        count: 0,
      })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Gönderilecek mesaj yok",
        count: 0,
      })
    }

    let sentCount = 0

    for (const msg of messages) {
      const customer = Array.isArray(msg.customers)
        ? msg.customers[0]
        : msg.customers
      const phone = customer?.phone as string | undefined
      if (!phone || !msg.message_content) continue

      const success = await sendWhatsAppMessage(phone, msg.message_content)

      if (success) {
        await supabase
          .from("message_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id)

        sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${sentCount} mesaj gönderildi`,
      count: sentCount,
    })
  } catch (error) {
    console.error("Mesajlar gönderilemedi:", error)
    return NextResponse.json(
      { success: false, error: "Mesajlar gönderilemedi" },
      { status: 500 }
    )
  }
}
