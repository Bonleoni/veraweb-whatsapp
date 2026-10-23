import { connection, NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    await connection()
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "Customer ID gerekli" },
        { status: 400 }
      )
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
