import { connection, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    await connection()
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("name", { ascending: true })

    if (error) throw error

    if (data && data.length > 0) {
      return NextResponse.json({ success: true, data })
    }

    // businesses tablosu boşsa customers.business_id'lerden sentetik liste üret
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("business_id")

    if (customersError) throw customersError

    const uniqueIds = Array.from(
      new Set(
        (customers ?? [])
          .map((c) => c.business_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    const synthetic = uniqueIds.map((id, index) => ({
      id,
      name: `Pilates İşletmesi ${index + 1}`,
      owner_name: null,
    }))

    return NextResponse.json({ success: true, data: synthetic })
  } catch (error) {
    console.error("İşletmeler alınamadı:", error)
    return NextResponse.json(
      { success: false, error: "İşletmeler alınamadı" },
      { status: 500 }
    )
  }
}
