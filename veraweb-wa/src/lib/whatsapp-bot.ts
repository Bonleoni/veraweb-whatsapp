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

const globalForWa = globalThis as typeof globalThis & WhatsAppGlobal

if (typeof globalForWa.waConnectionState === "undefined") {
  globalForWa.waSocket = null
  globalForWa.waQrCode = null
  globalForWa.waConnectionState = "disconnected"
  globalForWa.waStarting = false
}

function phoneKey() {
  return process.env.WHATSAPP_PHONE || "default"
}

async function upsertSession(patch: Record<string, unknown>) {
  const { error } = await supabase.from("bot_sessions").upsert({
    phone_number: phoneKey(),
    updated_at: new Date().toISOString(),
    ...patch,
  })
  if (error) console.error("bot_sessions upsert:", error)
}

async function waitForQrOrConnected(timeoutMs = 12000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (globalForWa.waQrCode || globalForWa.waConnectionState === "connected") {
      return getBotStatus()
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return getBotStatus()
}

async function teardownSocket() {
  if (!globalForWa.waSocket) return
  try {
    globalForWa.waSocket.end(undefined)
  } catch (error) {
    console.error("Socket teardown:", error)
  }
  globalForWa.waSocket = null
}

export async function startWhatsAppBot() {
  // Zaten bağlıysa yeniden başlatma
  if (
    globalForWa.waConnectionState === "connected" &&
    globalForWa.waSocket
  ) {
    console.log("Bot zaten bağlı")
    return getBotStatus()
  }

  // Connecting takılı kaldıysa temizle ve taze QR al
  if (globalForWa.waSocket || globalForWa.waStarting) {
    console.log("Mevcut oturum temizleniyor, yeniden başlatılıyor...")
    await teardownSocket()
    globalForWa.waStarting = false
  }

  globalForWa.waStarting = true
  globalForWa.waQrCode = null
  globalForWa.waConnectionState = "connecting"

  try {
    console.log("startWhatsAppBot: başlıyor...")
    await upsertSession({ status: "connecting", qr_code: null })

    const authDir = path.join(process.cwd(), ".wa-auth")
    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const sock = makeWASocket({
      auth: state,
      browser: ["MyVera WA", "Chrome", "1.0.0"],
      syncFullHistory: false,
    })

    globalForWa.waSocket = sock
    console.log("startWhatsAppBot: socket oluşturuldu, QR bekleniyor...")

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          const dataUrl = await toDataURL(qr, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "M",
          })
          globalForWa.waQrCode = dataUrl
          globalForWa.waConnectionState = "connecting"
          globalForWa.waStarting = false
          console.log("QR Kod hazır (length:", dataUrl.length, ")")
          await upsertSession({
            qr_code: dataUrl,
            status: "connecting",
          })
        } catch (error) {
          console.error("QR kod oluşturulamadı:", error)
        }
      }

      if (connection === "close") {
        globalForWa.waConnectionState = "disconnected"
        globalForWa.waSocket = null
        globalForWa.waStarting = false
        globalForWa.waQrCode = null

        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
          ?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        console.log(
          "Bağlantı kapandı. statusCode=",
          statusCode,
          "reconnect=",
          shouldReconnect
        )

        await upsertSession({
          status: "disconnected",
          qr_code: null,
        })

        if (shouldReconnect) {
          console.log("Bağlantı koptu, yeniden bağlanılıyor...")
          // Kısa gecikme ile yeniden dene (stack overflow önle)
          setTimeout(() => {
            void startWhatsAppBot()
          }, 1500)
        }
      } else if (connection === "open") {
        globalForWa.waConnectionState = "connected"
        globalForWa.waQrCode = null
        globalForWa.waStarting = false

        await upsertSession({
          status: "connected",
          qr_code: null,
          last_active_at: new Date().toISOString(),
        })

        console.log("✅ WhatsApp bağlantısı kuruldu!")
      }
    })
  } catch (error) {
    console.error("startWhatsAppBot hata:", error)
    globalForWa.waStarting = false
    globalForWa.waConnectionState = "disconnected"
    globalForWa.waSocket = null
    globalForWa.waQrCode = null
    throw error
  }

  // QR veya connected gelene kadar bekle (API yanıtında dönebilmek için)
  const status = await waitForQrOrConnected(12000)
  globalForWa.waStarting = false
  console.log("startWhatsAppBot: dönüş status=", status.status, "qr=", !!status.qrCode)
  return status
}

export async function stopWhatsAppBot() {
  if (globalForWa.waSocket) {
    try {
      await globalForWa.waSocket.logout()
    } catch {
      try {
        globalForWa.waSocket.end(undefined)
      } catch (error) {
        console.error("Socket kapatılamadı:", error)
      }
    }
    globalForWa.waSocket = null
  }

  globalForWa.waConnectionState = "disconnected"
  globalForWa.waQrCode = null
  globalForWa.waStarting = false

  await upsertSession({
    status: "disconnected",
    qr_code: null,
  })
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
) {
  if (
    !globalForWa.waSocket ||
    globalForWa.waConnectionState !== "connected"
  ) {
    throw new Error("WhatsApp bağlantısı aktif değil")
  }

  const formattedPhone = phoneNumber.replace(/[^0-9]/g, "")
  const jid = `${formattedPhone}@s.whatsapp.net`

  try {
    await globalForWa.waSocket.sendMessage(jid, { text: message })
    console.log(`✓ Mesaj gönderildi: ${phoneNumber}`)
    return true
  } catch (error) {
    console.error("Mesaj gönderilemedi:", error)
    return false
  }
}

export function getBotStatus() {
  return {
    connected: globalForWa.waConnectionState === "connected",
    qrCode: globalForWa.waQrCode,
    status: globalForWa.waConnectionState,
  }
}
