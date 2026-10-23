import { connection, NextResponse } from "next/server"
import { sendWhatsAppMessage } from "@/lib/whatsapp-bot"
import { supabase } from "@/lib/supabase"

// 🛡️ TEST MODU AYARLARI
const TEST_MODE = true // true ise sadece TEST_PHONE_NUMBER'a mesaj gider. Canlıya geçince false yap.
const TEST_PHONE_NUMBER = "905426133850" // Sadece bu numaraya izin ver (Mehmet Demir)

function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, "")
}

export async function POST() {
  try {
    await connection()

    // Onaylanmış ve henüz gönderilmemiş mesajları al
    const { data: messages, error: fetchError } = await supabase
      .from("message_queue")
      .select(
        `
        id,
        message_content,
        customers (phone)
      `
      )
      .eq("status", "approved")
      .is("sent_at", null)

    if (fetchError) {
      console.error("Supabase hatası:", fetchError)
      return NextResponse.json(
        { success: false, error: "Veritabanı hatası" },
        { status: 500 }
      )
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Gönderilecek onaylı mesaj yok",
        count: 0,
      })
    }

    let sentCount = 0
    let skippedCount = 0

    for (const msg of messages) {
      const customer = Array.isArray(msg.customers)
        ? msg.customers[0]
        : msg.customers
      const customerPhone = customer?.phone as string | undefined

      if (!customerPhone) {
        console.log(`⚠️ Numara bulunamadı, atlandı (ID: ${msg.id})`)
        skippedCount++
        continue
      }

      const normalized = normalizePhone(customerPhone)

      // 🛡️ TEST MODU KONTROLÜ
      if (TEST_MODE && normalized !== TEST_PHONE_NUMBER) {
        console.log(
          `🛡️ TEST MODU: ${customerPhone} numarasına gönderim engellendi. Sadece ${TEST_PHONE_NUMBER} izinli.`
        )

        await supabase
          .from("message_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id)

        skippedCount++
        continue
      }

      // Gerçek gönderim
      console.log(`📤 Mesaj gönderiliyor: ${customerPhone}`)
      const success = await sendWhatsAppMessage(
        customerPhone,
        msg.message_content
      )

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
      message: `${sentCount} mesaj gönderildi, ${skippedCount} mesaj test modu nedeniyle atlandı.`,
      count: sentCount,
      skipped: skippedCount,
    })
  } catch (error) {
    console.error("❌ Kuyruk gönderim hatası:", error)
    return NextResponse.json(
      { success: false, error: "Mesajlar gönderilemedi" },
      { status: 500 }
    )
  }
}
