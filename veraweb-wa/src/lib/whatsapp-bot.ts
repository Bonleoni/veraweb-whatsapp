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

function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, "")
}

function extractTextContent(message: {
  message?: {
    conversation?: string | null
    extendedTextMessage?: { text?: string | null } | null
    imageMessage?: { caption?: string | null } | null
  } | null
}) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    null
  )
}

function toIsoFromWaTimestamp(timestamp: unknown) {
  const raw =
    typeof timestamp === "number"
      ? timestamp
      : typeof timestamp === "bigint"
        ? Number(timestamp)
        : timestamp &&
            typeof timestamp === "object" &&
            "low" in timestamp &&
            typeof (timestamp as { low: number }).low === "number"
          ? (timestamp as { low: number }).low
          : Date.now() / 1000
  const seconds = raw > 1e12 ? raw / 1000 : raw
  return new Date(seconds * 1000).toISOString()
}

/** Gelen WhatsApp mesajını müşteriye eşleyip chat_messages'a yazar */
export async function persistInboundWhatsAppMessage(params: {
  remoteJid?: string | null
  content: string
  timestamp?: unknown
  fromMe?: boolean
}) {
  const { remoteJid, content, timestamp, fromMe } = params

  if (fromMe) return
  if (!remoteJid || !content.trim()) return
  if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) return

  const senderPhone = normalizePhone(remoteJid.split("@")[0] || "")
  if (!senderPhone) return

  console.log(`📨 Gelen mesaj: ${senderPhone} -> ${content}`)

  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, phone")

  if (customersError) {
    console.error("❌ Müşteriler okunamadı:", customersError)
    return
  }

  const customer = (customers ?? []).find((c) => {
    const phone = normalizePhone(c.phone || "")
    if (!phone) return false
    return (
      phone === senderPhone ||
      phone.endsWith(senderPhone) ||
      senderPhone.endsWith(phone) ||
      phone.slice(-10) === senderPhone.slice(-10)
    )
  })

  if (!customer) {
    console.log(`⚠️ Müşteri bulunamadı: ${senderPhone}`)
    return
  }

  const { error } = await supabase.from("chat_messages").insert({
    customer_id: customer.id,
    direction: "inbound",
    content: content.trim(),
    status: "received",
    created_at: toIsoFromWaTimestamp(timestamp),
  })

  if (error) {
    console.error("❌ Mesaj kaydedilemedi:", error)
  } else {
    console.log("✅ Mesaj kaydedildi:", customer.id)
  }
}

/** Baileys socket'ine gelen mesaj dinleyicisini bağla */
export function attachIncomingMessageListener(sock: WASocket) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return

    for (const message of messages) {
      try {
        const content = extractTextContent(message)
        if (!content) continue

        await persistInboundWhatsAppMessage({
          remoteJid: message.key.remoteJid,
          content,
          timestamp: message.messageTimestamp,
          fromMe: Boolean(message.key.fromMe),
        })
      } catch (error) {
        console.error("❌ Gelen mesaj işlenemedi:", error)
      }
    }
  })
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

    // 📨 Gelen mesajları dinle → Supabase chat_messages
    attachIncomingMessageListener(sock)

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
  // Bot Ayarları (/api/bot/qr) oturumu ile eski whatsapp-bot oturumunu destekle
  const qrGlobal = globalThis as typeof globalThis & {
    baileysSocket?: WASocket | null
    baileysState?: string
  }

  const activeSocket =
    (g.waConnectionState === "connected" && g.waSocket) ||
    (qrGlobal.baileysState === "connected" && qrGlobal.baileysSocket) ||
    null

  if (!activeSocket) {
    throw new Error("WhatsApp bağlantısı aktif değil")
  }

  const formattedPhone = phone.replace(/[^0-9]/g, "")
  const jid = `${formattedPhone}@s.whatsapp.net`

  try {
    await activeSocket.sendMessage(jid, { text: message })
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
