import { connection, NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { sendWhatsAppMessage } from "@/lib/whatsapp-bot"

// 🛡️ TEST MODU
const TEST_MODE = true
const TEST_PHONE_NUMBER = "905426133850"

function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, "")
}

async function persistLeadMessage(
  leadId: string,
  content: string,
  status: string
) {
  const { data, error } = await supabase
    .from("lead_messages")
    .insert({
      lead_id: leadId,
      content,
      status,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from("leads")
    .update({
      status: "contacted",
      last_contact_at: new Date().toISOString(),
    })
    .eq("id", leadId)

  return {
    id: data.id,
    customer_id: leadId,
    direction: "outbound" as const,
    content: data.content,
    status: data.status,
    created_at: data.created_at || data.sent_at || new Date().toISOString(),
  }
}

export async function POST(request: NextRequest) {
  try {
    await connection()
    const { customerId, content, isLead } = await request.json()

    if (!customerId || !content) {
      return NextResponse.json(
        { success: false, error: "Eksik bilgi" },
        { status: 400 }
      )
    }

    let phone: string | undefined

    if (isLead) {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone")
        .eq("id", customerId)
        .single()
      phone = lead?.phone
    } else {
      const { data: customer } = await supabase
        .from("customers")
        .select("phone")
        .eq("id", customerId)
        .single()
      phone = customer?.phone
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          error: isLead
            ? "Aday telefonu bulunamadı"
            : "Müşteri telefonu bulunamadı",
        },
        { status: 404 }
      )
    }

    // 🛡️ TEST MODU KONTROLÜ
    if (TEST_MODE && normalizePhone(phone) !== TEST_PHONE_NUMBER) {
      console.log(`🛡️ TEST MODE: ${phone} numarasına gönderim engellendi.`)

      if (isLead) {
        const data = await persistLeadMessage(
          customerId,
          content,
          "skipped_test"
        )
        return NextResponse.json({
          success: true,
          data,
          message:
            "Test modu: Mesaj veritabanına kaydedildi ama WhatsApp'tan gönderilmedi.",
        })
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          customer_id: customerId,
          direction: "outbound",
          content,
          status: "skipped_test",
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        data,
        message:
          "Test modu: Mesaj veritabanına kaydedildi ama WhatsApp'tan gönderilmedi.",
      })
    }

    let sent = false
    try {
      sent = await sendWhatsAppMessage(phone, content)
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
      if (isLead) {
        const data = await persistLeadMessage(customerId, content, "sent")
        return NextResponse.json({ success: true, data })
      }

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
