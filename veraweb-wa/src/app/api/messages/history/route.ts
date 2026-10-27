import { connection, NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    await connection()
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const isLead = searchParams.get("isLead") === "true"

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "Customer ID gerekli" },
        { status: 400 }
      )
    }

    if (isLead) {
      const { data, error } = await supabase
        .from("lead_messages")
        .select("*")
        .eq("lead_id", customerId)
        .order("created_at", { ascending: true })

      if (error) throw error

      const messages = (data ?? []).map((row) => ({
        id: row.id,
        customer_id: row.lead_id,
        direction:
          row.status === "received" || row.direction === "inbound"
            ? "inbound"
            : "outbound",
        content: row.content,
        status: row.status,
        created_at: row.created_at || row.sent_at || new Date().toISOString(),
      }))

      return NextResponse.json({ success: true, data: messages })
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error("Mesaj geçmişi alınamadı:", error)
    return NextResponse.json(
      { success: false, error: "Mesaj geçmişi alınamadı" },
      { status: 500 }
    )
  }
}
