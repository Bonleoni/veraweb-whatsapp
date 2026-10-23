import { connection, NextResponse } from "next/server"
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import { toDataURL } from "qrcode"
import path from "path"
import fs from "fs"

type QrGlobal = {
  baileysSocket: WASocket | null
  baileysQr: string | null
  baileysState: "connecting" | "connected" | "disconnected"
  baileysStarting: boolean
}

const g = globalThis as typeof globalThis & QrGlobal

if (typeof g.baileysState === "undefined") {
  g.baileysSocket = null
  g.baileysQr = null
  g.baileysState = "disconnected"
  g.baileysStarting = false
}

function authDir() {
  return path.join(process.cwd(), "auth_info_baileys")
}

async function persistQr(qr: string) {
  console.log("📱 QR Kod ALINDI!")
  try {
    g.baileysQr = await toDataURL(qr, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
    g.baileysState = "connecting"
    console.log("✅ QR DataURL oluşturuldu")
  } catch (error) {
    console.error("❌ QR DataURL hatası:", error)
  }
}

async function ensureSocket() {
  if (g.baileysSocket && g.baileysState !== "disconnected") return
  if (g.baileysStarting) {
    // Başka request init ederken bekle
    const start = Date.now()
    while (g.baileysStarting && Date.now() - start < 10000) {
      await new Promise((r) => setTimeout(r, 200))
    }
    return
  }

  g.baileysStarting = true
  console.log("🔵 Yeni socket oluşturuluyor (Auth State ile)...")

  try {
    const dir = authDir()
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(dir)

    const sock = makeWASocket({
      auth: state,
      browser: ["MyVera WA", "Chrome", "1.0.0"],
      syncFullHistory: false,
    })

    g.baileysSocket = sock
    g.baileysState = "connecting"
    g.baileysQr = null

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection: conn, lastDisconnect, qr } = update
      console.log("🔄 Connection update:", conn, "hasQr:", Boolean(qr))

      // Baileys 7: QR burada gelir (ayrı 'qr' event yok)
      if (qr) {
        await persistQr(qr)
      }

      if (conn === "close") {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
          ?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        console.log(
          "❌ Bağlantı kapandı. Yeniden bağlanmalı mı?",
          shouldReconnect,
          "code=",
          statusCode
        )

        g.baileysState = "disconnected"
        g.baileysSocket = null
        g.baileysQr = null
        g.baileysStarting = false
      } else if (conn === "open") {
        console.log("✅ WhatsApp bağlantısı BAŞARIYLA KURULDU!")
        g.baileysState = "connected"
        g.baileysQr = null
        g.baileysStarting = false
      }
    })
  } catch (error) {
    console.error("❌ Socket init hatası:", error)
    g.baileysSocket = null
    g.baileysState = "disconnected"
    g.baileysQr = null
    throw error
  } finally {
    g.baileysStarting = false
  }
}

export async function GET() {
  try {
    await connection()
    await ensureSocket()

    // QR event'i gecikebilir
    if (!g.baileysQr && g.baileysState !== "connected") {
      await new Promise((r) => setTimeout(r, 2000))
    }

    if (g.baileysState === "connected") {
      return NextResponse.json({
        success: true,
        qrCode: null,
        connected: true,
      })
    }

    if (g.baileysQr) {
      return NextResponse.json({
        success: true,
        qrCode: g.baileysQr,
        connected: false,
      })
    }

    return NextResponse.json({
      success: true,
      qrCode: null,
      connected: false,
      message:
        "QR kod oluşturuluyor, lütfen 5 saniye bekleyip tekrar deneyin...",
    })
  } catch (error) {
    console.error("❌ Bot Hatası:", error)
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

    if (g.baileysSocket) {
      try {
        g.baileysSocket.end(undefined)
      } catch (error) {
        console.error("Socket end:", error)
      }
      g.baileysSocket = null
    }

    g.baileysQr = null
    g.baileysState = "disconnected"
    g.baileysStarting = false

    const dir = authDir()
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }

    // Eski klasör kalıntısı
    const legacy = path.join(process.cwd(), ".wa-auth")
    if (fs.existsSync(legacy)) {
      fs.rmSync(legacy, { recursive: true, force: true })
    }

    console.log("🔄 Bot ve session tamamen sıfırlandı")
    return NextResponse.json({ success: true, message: "Bot sıfırlandı" })
  } catch (error) {
    console.error("❌ Sıfırlama başarısız:", error)
    return NextResponse.json(
      { success: false, error: "Sıfırlama başarısız" },
      { status: 500 }
    )
  }
}
