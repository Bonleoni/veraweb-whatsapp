import { connection, NextResponse } from "next/server"
import makeWASocket, {
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys"
import { toDataURL } from "qrcode"
import path from "path"

type QrGlobal = {
  qrSocket: WASocket | null
  qrCodeData: string | null
  qrConnected: boolean
  qrInitPromise: Promise<void> | null
}

const g = globalThis as typeof globalThis & QrGlobal

if (typeof g.qrConnected === "undefined") {
  g.qrSocket = null
  g.qrCodeData = null
  g.qrConnected = false
  g.qrInitPromise = null
}

async function ensureSocket() {
  if (g.qrSocket || g.qrInitPromise) {
    if (g.qrInitPromise) await g.qrInitPromise
    return
  }

  g.qrInitPromise = (async () => {
    console.log("🔵 Yeni socket oluşturuluyor...")

    const authDir = path.join(process.cwd(), ".wa-auth")
    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    // Baileys 7: auth zorunlu; QR connection.update içinde gelir
    const sock = makeWASocket({
      auth: state,
      browser: ["MyVera WA", "Chrome", "1.0.0"],
      syncFullHistory: false,
    })

    g.qrSocket = sock
    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection: conn, qr } = update
      console.log("🔄 Connection:", conn, "hasQr:", Boolean(qr))

      if (qr) {
        console.log("📱 QR alındı:", qr.substring(0, 30) + "...")
        try {
          g.qrCodeData = await toDataURL(qr, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
          })
          g.qrConnected = false
          console.log(
            "✅ QR DataURL:",
            g.qrCodeData.substring(0, 50) + "..."
          )
        } catch (error) {
          console.error("❌ QR DataURL hatası:", error)
        }
      }

      if (conn === "open") {
        console.log("✅ Bağlandı!")
        g.qrConnected = true
        g.qrCodeData = null
      }

      if (conn === "close") {
        console.log("❌ Bağlantı kapandı")
        g.qrConnected = false
        g.qrSocket = null
        g.qrInitPromise = null
      }
    })
  })()

  try {
    await g.qrInitPromise
  } finally {
    // init bitti; yeniden tetiklenebilsin diye null ama socket ayakta
    g.qrInitPromise = null
  }
}

export async function GET() {
  try {
    await connection()
    await ensureSocket()

    // QR event'i biraz gecikebilir
    if (!g.qrCodeData && !g.qrConnected) {
      await new Promise((r) => setTimeout(r, 1500))
    }

    if (g.qrConnected) {
      return NextResponse.json({
        success: true,
        qrCode: null,
        connected: true,
      })
    }

    if (g.qrCodeData) {
      console.log("📤 QR kod döndürülüyor...")
      return NextResponse.json({
        success: true,
        qrCode: g.qrCodeData,
        connected: false,
      })
    }

    console.log("⏳ QR kod henüz hazır değil")
    return NextResponse.json({
      success: true,
      qrCode: null,
      connected: false,
      message: "QR kod oluşturuluyor, 5 saniye sonra tekrar deneyin",
    })
  } catch (error) {
    console.error("❌ Hata:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    await connection()

    if (g.qrSocket) {
      try {
        g.qrSocket.end(undefined)
      } catch (error) {
        console.error("Socket end:", error)
      }
      g.qrSocket = null
      g.qrCodeData = null
      g.qrConnected = false
      g.qrInitPromise = null
      console.log("🔴 Bot sıfırlandı")
    }

    return NextResponse.json({ success: true, message: "Bot sıfırlandı" })
  } catch (error) {
    console.error("❌ Sıfırlama hatası:", error)
    return NextResponse.json(
      { success: false, error: "Sıfırlama başarısız" },
      { status: 500 }
    )
  }
}
