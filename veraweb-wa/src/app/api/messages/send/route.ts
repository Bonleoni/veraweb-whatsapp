import { connection, NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { sendWhatsAppMessage } from "@/lib/whatsapp-bot"

// send-queue ile aynı güvenlik kapısı
const TEST_MODE = true
const TEST_PHONE_NUMBER = "905426133850"

function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, "")
}

export async function POST(request: NextRequest) {
  try {
    await connection()
    const { customerId, content } = await request.json()

    if (!customerId || !content) {
      return NextResponse.json(
        { success: false, error: "Eksik bilgi" },
        { status: 400 }
      )
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("phone")
      .eq("id", customerId)
      .single()

    if (!customer?.phone) {
      return NextResponse.json(
        { success: false, error: "Müşteri telefonu bulunamadı" },
        { status: 404 }
      )
    }

    const normalized = normalizePhone(customer.phone)
    if (TEST_MODE && normalized !== TEST_PHONE_NUMBER) {
      console.log(
        `🛡️ TEST MODU: ${customer.phone} numarasına gönderim engellendi. Sadece ${TEST_PHONE_NUMBER} izinli.`
      )
      return NextResponse.json(
        {
          success: false,
          error: `TEST MODU: Sadece ${TEST_PHONE_NUMBER} numarasına gönderilebilir`,
        },
        { status: 403 }
      )
    }

    let sent = false
    try {
      sent = await sendWhatsAppMessage(customer.phone, content)
    } catch (err) {
      console.error("WhatsApp gönderim hatası:", err)
      return NextResponse.json(
        {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : "WhatsApp bağlantısı aktif değil",
        },
        { status: 500 }
      )
    }

    if (sent) {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          customer_id: customerId,
          direction: "outbound",
          content,
          status: "sent",
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json(
      { success: false, error: "WhatsApp gönderim başarısız" },
      { status: 500 }
    )
  } catch (error) {
    console.error("Mesaj gönderilemedi:", error)
    return NextResponse.json(
      { success: false, error: "Mesaj gönderilemedi" },
      { status: 500 }
    )
  }
}
