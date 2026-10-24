import { connection, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

type ChatMessageRow = {
  content: string
  direction: string
  status?: string | null
  created_at: string
}

type CustomerRow = {
  id: string
  name: string
  phone: string
  chat_messages?: ChatMessageRow[] | null
}

export async function GET(request: Request) {
  try {
    await connection()
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")

    let query = supabase
      .from("customers")
      .select(
        `
        id,
        name,
        phone,
        chat_messages (
          content,
          direction,
          status,
          created_at
        )
      `
      )
      .order("created_at", { foreignTable: "chat_messages", ascending: false })

    if (businessId) {
      query = query.eq("business_id", businessId)
    }

    const { data: customers, error } = await query

    if (error) throw error

    const formattedCustomers = ((customers as CustomerRow[] | null) ?? []).map(
      (customer) => {
        const messages = [...(customer.chat_messages ?? [])].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const lastMessage = messages[0]

        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          lastMessage: lastMessage?.content || "Henüz mesaj yok",
          lastMessageTime: lastMessage?.created_at || null,
          direction: lastMessage?.direction || null,
          status: lastMessage?.status || null,
          unreadCount: 0,
        }
      }
    )

    formattedCustomers.sort((a, b) => {
      const aTime = a.lastMessageTime
        ? new Date(a.lastMessageTime).getTime()
        : 0
      const bTime = b.lastMessageTime
        ? new Date(b.lastMessageTime).getTime()
        : 0
      return bTime - aTime
    })

    return NextResponse.json({ success: true, data: formattedCustomers })
  } catch (error) {
    console.error("Conversations listesi alınamadı:", error)
    return NextResponse.json(
      { success: false, error: "Veriler alınamadı" },
      { status: 500 }
    )
  }
}
