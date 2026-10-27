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

/** Sıkı telefon eşlemesi — kısa/eksik numaralarla yanlış eşleşmeyi engeller */
function phonesMatch(a: string, b: string) {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  // En az 10 hane (TR cep) — kısa string endsWith felaketine karşı
  if (na.length < 10 || nb.length < 10) return false
  return na === nb || na.slice(-10) === nb.slice(-10)
}

function jidUserPart(jid?: string | null) {
  if (!jid) return ""
  return normalizePhone(jid.split("@")[0] || "")
}

type SocketWithLid = WASocket & {
  store?: {
    contacts?: Record<
      string,
      { id?: string; notify?: string; name?: string } | undefined
    >
  }
  signalRepository?: {
    lidMapping?: {
      getPNForLID: (lid: string) => Promise<string | null>
    }
  }
  onWhatsApp?: (
    ...jids: string[]
  ) => Promise<Array<{ jid: string; exists: boolean; lid?: string }> | undefined>
}

/** LID / alt JID alanlarından gerçek telefon numarasını çöz */
async function resolveSenderPhone(
  sock: SocketWithLid,
  params: {
    remoteJid?: string | null
    remoteJidAlt?: string | null
    participant?: string | null
    participantAlt?: string | null
  }
) {
  const { remoteJid, remoteJidAlt, participant, participantAlt } = params
  const rawJid = remoteJid || ""
  const senderRaw = jidUserPart(rawJid)

  console.log(`📨 Gelen mesaj ham JID: ${rawJid}`)

  // 1) Baileys'in verdiği PN alternatifleri (en güvenilir)
  const altCandidates = [
    remoteJidAlt,
    participantAlt,
    participant,
    remoteJid,
  ]
    .filter(Boolean)
    .map((j) => String(j))

  for (const jid of altCandidates) {
    // @s.whatsapp.net veya hosted PN → telefon
    if (jid.includes("@s.whatsapp.net") || jid.includes("@hosted")) {
      const phone = jidUserPart(jid)
      if (phone) {
        console.log(`🔍 LID Çözümlendi (message.key alt): ${phone}`)
        return phone
      }
    }
  }

  let resolvedPhone = senderRaw

  try {
    // 2) signalRepository LID → PN mapping
    const lidJid = rawJid.endsWith("@lid")
      ? rawJid
      : senderRaw
        ? `${senderRaw}@lid`
        : ""
    if (lidJid && sock.signalRepository?.lidMapping?.getPNForLID) {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(lidJid)
      if (pn) {
        const phone = jidUserPart(pn)
        if (phone) {
          console.log(`🔍 LID Çözümlendi (lidMapping): ${phone}`)
          return phone
        }
      }
    }

    // 3) Store contacts
    const contact =
      sock.store?.contacts?.[rawJid] ||
      (senderRaw ? sock.store?.contacts?.[`${senderRaw}@lid`] : undefined)
    if (contact) {
      const fromNotify = normalizePhone(contact.notify || "")
      const fromId = jidUserPart(contact.id)
      const candidate = fromId || fromNotify
      if (candidate && candidate !== senderRaw) {
        console.log(`🔍 LID Çözümlendi (Store): ${candidate}`)
        return candidate
      }
    }

    // 4) onWhatsApp fallback
    if (typeof sock.onWhatsApp === "function" && rawJid) {
      const waContacts = await sock.onWhatsApp(rawJid)
      const hit = waContacts?.[0]
      if (hit?.exists && hit.jid) {
        const phone = jidUserPart(hit.jid)
        if (phone) {
          console.log(`🔍 LID Çözümlendi (onWhatsApp): ${phone}`)
          return phone
        }
      }
    }
  } catch (err) {
    console.log("⚠️ LID çözümleme hatası:", err)
  }

  console.log(`🎯 Kullanılacak Telefon (fallback): ${resolvedPhone}`)
  return resolvedPhone
}

type PhoneContact = { id: string; phone: string | null }

function findByPhone(
  rows: PhoneContact[],
  candidates: string[]
): PhoneContact | undefined {
  const phones = candidates.map(normalizePhone).filter((p) => p.length >= 10)
  if (phones.length === 0) return undefined

  // 1) Tam eşleşme (normalize)
  for (const row of rows) {
    const rowPhone = normalizePhone(row.phone || "")
    if (rowPhone.length < 10) continue
    if (phones.some((p) => p === rowPhone)) return row
  }

  // 2) Son 10 hane (ülke kodu farkı)
  for (const row of rows) {
    const rowPhone = normalizePhone(row.phone || "")
    if (rowPhone.length < 10) continue
    if (phones.some((p) => phonesMatch(rowPhone, p))) return row
  }

  return undefined
}

/** Gelen WhatsApp mesajını doğru lead/customer'a yaz */
export async function persistInboundWhatsAppMessage(params: {
  sock: WASocket
  remoteJid?: string | null
  remoteJidAlt?: string | null
  participant?: string | null
  participantAlt?: string | null
  content: string
  timestamp?: unknown
  fromMe?: boolean
}) {
  const {
    sock,
    remoteJid,
    remoteJidAlt,
    participant,
    participantAlt,
    content,
    timestamp,
    fromMe,
  } = params

  if (fromMe) return
  if (!remoteJid || !content.trim()) return
  if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) return

  const senderPhone = jidUserPart(remoteJid)
  if (!senderPhone) return

  const resolvedPhone = await resolveSenderPhone(sock as SocketWithLid, {
    remoteJid,
    remoteJidAlt,
    participant,
    participantAlt,
  })

  const phoneCandidates = Array.from(
    new Set(
      [resolvedPhone, senderPhone]
        .map(normalizePhone)
        .filter((p) => p.length >= 10)
    )
  )

  console.log("📨 Gelen mesaj:", {
    ham: senderPhone,
    cozulen: resolvedPhone,
    candidates: phoneCandidates,
    content,
  })

  if (phoneCandidates.length === 0) {
    console.warn("⚠️ Geçerli telefon çözülemedi, mesaj atlandı")
    return
  }

  const [{ data: leads }, { data: customers }] = await Promise.all([
    supabase.from("leads").select("id, phone"),
    supabase.from("customers").select("id, phone"),
  ])

  // Önce lead, sonra customer — outreach cevapları adaya düşsün
  const lead = findByPhone(leads ?? [], phoneCandidates)
  const customer = findByPhone(customers ?? [], phoneCandidates)

  console.log("🔎 Eşleşme:", {
    leadId: lead?.id ?? null,
    leadPhone: lead?.phone ?? null,
    customerId: customer?.id ?? null,
    customerPhone: customer?.phone ?? null,
  })

  const createdAt = toIsoFromWaTimestamp(timestamp)

  if (lead) {
    const { error: leadMsgError } = await supabase.from("lead_messages").insert({
      lead_id: lead.id,
      content: content.trim(),
      status: "received",
      created_at: createdAt,
    })

    if (leadMsgError) {
      console.error("❌ Aday mesajı kaydedilemedi:", leadMsgError)
      return
    }

    await supabase
      .from("leads")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", lead.id)

    console.log("✅ Aday mesajı kaydedildi:", {
      leadId: lead.id,
      phone: lead.phone,
    })
    return
  }

  if (customer) {
    const { error } = await supabase.from("chat_messages").insert({
      customer_id: customer.id,
      direction: "inbound",
      content: content.trim(),
      status: "received",
      created_at: createdAt,
    })

    if (error) {
      console.error("❌ Müşteri mesajı kaydedilemedi:", error)
    } else {
      console.log("✅ Müşteri mesajı kaydedildi:", {
        customerId: customer.id,
        phone: customer.phone,
      })
    }
    return
  }

  console.warn("⚠️ Eşleşen lead/customer bulunamadı:", phoneCandidates)
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
          sock,
          remoteJid: message.key.remoteJid,
          remoteJidAlt: message.key.remoteJidAlt,
          participant: message.key.participant,
          participantAlt: message.key.participantAlt,
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
