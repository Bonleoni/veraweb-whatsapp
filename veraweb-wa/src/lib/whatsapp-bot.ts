import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import { toDataURL } from "qrcode"
import path from "path"
import { supabase } from "./supabase"

type ConnectionState = "connecting" | "connected" | "disconnected"

type WhatsAppGlobal = {
  waSocket: WASocket | null
  waQrCode: string | null
  waConnectionState: ConnectionState
  waStarting: boolean
}

// Next.js route'ları arasında state paylaşımı için globalThis şart
const g = globalThis as typeof globalThis & WhatsAppGlobal

if (typeof g.waConnectionState === "undefined") {
  g.waSocket = null
  g.waQrCode = null
  g.waConnectionState = "disconnected"
  g.waStarting = false
}

function phoneNumber() {
  return process.env.WHATSAPP_PHONE || "default"
}

async function saveSession(patch: Record<string, unknown>) {
  try {
    const { error } = await supabase.from("bot_sessions").upsert({
      phone_number: phoneNumber(),
      updated_at: new Date().toISOString(),
      ...patch,
    })
    if (error) console.error("❌ Session kaydı:", error.message)
  } catch (error) {
    console.error("❌ Session güncellenemedi:", error)
  }
}

async function persistQr(qr: string) {
  console.log("📱 QR Kod alındı:", qr.substring(0, 50) + "...")
  try {
    const dataUrl = await toDataURL(qr, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    })
    g.waQrCode = dataUrl
    g.waConnectionState = "connecting"
    console.log("✅ QR kod DataURL'e dönüştürüldü (len:", dataUrl.length, ")")

    await saveSession({
      qr_code: dataUrl,
      status: "connecting",
    })
    console.log("✅ QR kod Supabase'e kaydedildi (veya denendi)")
  } catch (error) {
    console.error("❌ QR kod işlenemedi:", error)
  }
}

async function waitForQrOrConnected(timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (g.waQrCode || g.waConnectionState === "connected") {
      return getBotStatus()
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return getBotStatus()
}

export async function startWhatsAppBot() {
  console.log("🔵 Bot başlatılıyor...")
  console.log("📱 Telefon numarası:", phoneNumber())

  // Zaten bağlıysa dokunma
  if (g.waConnectionState === "connected" && g.waSocket) {
    console.log("⚠️ Bot zaten bağlı")
    const current = getBotStatus()
    return {
      success: true,
      message: "Bot zaten bağlı",
      status: {
        status: current.status,
        qr_code: current.qrCode,
        connected: current.connected,
      },
    }
  }

  // Takılı socket varsa temizle (taze QR için)
  if (g.waSocket) {
    console.log("⚠️ Eski socket temizleniyor...")
    try {
      g.waSocket.end(undefined)
    } catch (error) {
      console.error("Socket end hatası:", error)
    }
    g.waSocket = null
  }

  g.waStarting = true
  g.waConnectionState = "connecting"
  g.waQrCode = null

  await saveSession({ status: "connecting", qr_code: null })
  console.log('✅ Session durumu "connecting" olarak güncellendi')

  try {
    // Baileys 7: auth zorunlu
    const authDir = path.join(process.cwd(), ".wa-auth")
    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const sock = makeWASocket({
      auth: state,
      browser: ["MyVera WA", "Chrome", "1.0.0"],
      syncFullHistory: false,
      // printQRInTerminal Baileys 7'de kaldırıldı; QR connection.update içinde gelir
    })

    g.waSocket = sock
    console.log("✅ makeWASocket oluşturuldu")

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update
      console.log("🔄 Connection update:", {
        connection,
        hasQr: Boolean(qr),
      })

      if (qr) {
        await persistQr(qr)
      }

      if (connection === "close") {
        g.waConnectionState = "disconnected"
        g.waSocket = null
        g.waStarting = false
        g.waQrCode = null
        console.log("❌ Bağlantı kapandı")

        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
          ?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        await saveSession({ status: "disconnected", qr_code: null })

        if (shouldReconnect) {
          console.log("🔄 Yeniden bağlanılıyor...")
          setTimeout(() => {
            void startWhatsAppBot()
          }, 2000)
        }
      } else if (connection === "open") {
        g.waConnectionState = "connected"
        g.waQrCode = null
        g.waStarting = false
        console.log("✅ WhatsApp bağlantısı KURULDU!")

        await saveSession({
          status: "connected",
          qr_code: null,
          last_active_at: new Date().toISOString(),
        })
      }
    })
  } catch (error) {
    console.error("❌ Bot başlatma hatası:", error)
    g.waStarting = false
    g.waConnectionState = "disconnected"
    g.waSocket = null
    g.waQrCode = null
    throw error
  }

  // UI'nin hemen QR alabilmesi için bekle
  const status = await waitForQrOrConnected(15000)
  g.waStarting = false

  console.log("🔵 startWhatsAppBot bitti:", {
    status: status.status,
    hasQr: Boolean(status.qrCode),
  })

  return {
    success: true,
    message: status.qrCode
      ? "QR kod hazır"
      : status.connected
        ? "WhatsApp bağlantısı aktif"
        : "Bot başlatılıyor...",
    status: {
      status: status.status,
      qr_code: status.qrCode,
      connected: status.connected,
    },
  }
}

export async function stopWhatsAppBot() {
  console.log("🔴 Bot durduruluyor...")

  if (g.waSocket) {
    try {
      g.waSocket.end(undefined)
    } catch (error) {
      console.error("Socket end hatası:", error)
    }
    g.waSocket = null
  }

  g.waConnectionState = "disconnected"
  g.waQrCode = null
  g.waStarting = false

  await saveSession({ status: "disconnected", qr_code: null })
  console.log("✅ Bot durduruldu")

  return { success: true, message: "Bot durduruldu" }
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
) {
  if (!g.waSocket || g.waConnectionState !== "connected") {
    throw new Error("WhatsApp bağlantısı aktif değil")
  }

  const formattedPhone = phone.replace(/[^0-9]/g, "")
  const jid = `${formattedPhone}@s.whatsapp.net`

  try {
    await g.waSocket.sendMessage(jid, { text: message })
    console.log(`✓ Mesaj gönderildi: ${phone}`)
    return true
  } catch (error) {
    console.error("Mesaj gönderilemedi:", error)
    return false
  }
}

export function getBotStatus() {
  return {
    connected: g.waConnectionState === "connected",
    qrCode: g.waQrCode,
    status: g.waConnectionState,
  }
}
