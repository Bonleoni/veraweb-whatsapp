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
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    console.error("İşletmeler alınamadı:", error)
    return NextResponse.json(
      { success: false, error: "İşletmeler alınamadı" },
      { status: 500 }
    )
  }
}
