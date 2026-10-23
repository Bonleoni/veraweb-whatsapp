import { NextResponse } from "next/server"
import { generateMessages } from "@/lib/message-generator"

export async function POST() {
  try {
    const messages = await generateMessages()
    return NextResponse.json({
      success: true,
      message: `${messages.length} mesaj kuyruğa eklendi`,
      count: messages.length,
    })
  } catch (error) {
    console.error("Senaryo kontrolü başarısız:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Senaryo kontrolü başarısız",
      },
      { status: 500 }
    )
  }
}
