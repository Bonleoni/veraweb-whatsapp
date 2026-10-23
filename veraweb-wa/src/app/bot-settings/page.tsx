"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Loader2,
  Power,
  PowerOff,
  Send,
  Wifi,
  WifiOff,
  QrCode,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type BotUiStatus = "connected" | "connecting" | "disconnected"

type StatusPayload = {
  status?: BotUiStatus | string
  qr_code?: string | null
  connected?: boolean
}

const statusMeta: Record<
  BotUiStatus,
  { label: string; badge: string; dot: string; hint: string }
> = {
  connected: {
    label: "Bağlı",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    hint: "WhatsApp oturumu aktif.",
  },
  connecting: {
    label: "QR kod okunuyor...",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    hint: "Telefonunuzdaki WhatsApp ile QR kodu okutun.",
  },
  disconnected: {
    label: "Bağlı değil",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    hint: "Botu başlatarak bağlantıyı kurun.",
  },
}

function normalizeStatus(raw?: string | null, connected?: boolean): BotUiStatus {
  if (connected || raw === "connected" || raw === "open") return "connected"
  if (raw === "connecting") return "connecting"
  return "disconnected"
}

export default function BotSettingsPage() {
  const [status, setStatus] = useState<BotUiStatus>("disconnected")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState<"start" | "stop" | "send" | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch("/api/bot/status", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !data.success) return

      const payload = (data.status || data.live || {}) as StatusPayload
      const next = normalizeStatus(
        payload.status,
        payload.connected ?? data.live?.connected
      )
      setStatus(next)
      setQrCode(
        next === "connecting"
          ? payload.qr_code || data.live?.qrCode || null
          : null
      )
    } catch (error) {
      console.error("Durum alınamadı:", error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    const id = setInterval(() => {
      void fetchStatus()
    }, 3000)
    return () => clearInterval(id)
  }, [fetchStatus])

  async function handleStart() {
    setLoading("start")
    try {
      const res = await fetch("/api/bot/start", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Bot başlatılamadı")
        return
      }
      toast.success("Bot başlatılıyor...")
      setStatus("connecting")
      await fetchStatus()
    } catch {
      toast.error("Bot başlatılamadı")
    } finally {
      setLoading(null)
    }
  }

  async function handleStop() {
    setLoading("stop")
    try {
      const res = await fetch("/api/bot/stop", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Bot durdurulamadı")
        return
      }
      toast.success("Bot durduruldu")
      setStatus("disconnected")
      setQrCode(null)
      await fetchStatus()
    } catch {
      toast.error("Bot durdurulamadı")
    } finally {
      setLoading(null)
    }
  }

  async function handleSendQueue() {
    setLoading("send")
    try {
      const res = await fetch("/api/bot/send-queue", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Mesajlar gönderilemedi")
        return
      }
      toast.success(data.message ?? `${data.count ?? 0} mesaj gönderildi`)
    } catch {
      toast.error("Mesajlar gönderilemedi")
    } finally {
      setLoading(null)
    }
  }

  const meta = statusMeta[status]

  return (
    <div className="font-sans space-y-6 max-w-3xl">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Bot Ayarları
          </h1>
          {refreshing && (
            <Loader2 className="size-4 animate-spin text-zinc-400" />
          )}
        </div>
        <p className="text-zinc-500 text-sm">
          WhatsApp bağlantınızı yönetin
        </p>
      </div>

      <Card className="bg-white border border-zinc-200 rounded-xl shadow-sm ring-0 py-0 gap-0">
        <CardHeader className="border-b border-zinc-100 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-zinc-950 tracking-tight">
                Bağlantı Durumu
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500">
                {meta.hint}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium gap-1.5",
                meta.badge
              )}
            >
              <span className={cn("size-1.5 rounded-full", meta.dot)} />
              {meta.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="px-6 py-6 space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
            {status === "connected" ? (
              <Wifi className="size-5 text-emerald-600" />
            ) : status === "connecting" ? (
              <QrCode className="size-5 text-amber-600" />
            ) : (
              <WifiOff className="size-5 text-red-600" />
            )}
            <div>
              <p className="text-sm font-medium text-zinc-950">
                MyVera WhatsApp Bot
              </p>
              <p className="text-sm text-zinc-500">
                {process.env.NEXT_PUBLIC_WHATSAPP_PHONE_DISPLAY ||
                  "Oturum Baileys ile yönetilir"}
              </p>
            </div>
          </div>

          {status === "connecting" && qrCode && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="WhatsApp QR kodu"
                className="size-64 rounded-lg border border-zinc-100"
              />
              <p className="text-sm text-zinc-500">Telefonunuzla okutun</p>
            </div>
          )}

          {status === "connecting" && !qrCode && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 p-8 text-center">
              <Loader2 className="size-6 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">
                QR kod bekleniyor...
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              className="h-9 rounded-lg gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800"
              onClick={() => void handleStart()}
              disabled={loading !== null || status === "connected"}
            >
              {loading === "start" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Power className="size-4" />
              )}
              Botu Başlat
            </Button>

            <Button
              variant="outline"
              className="h-9 rounded-lg gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => void handleStop()}
              disabled={loading !== null || status === "disconnected"}
            >
              {loading === "stop" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PowerOff className="size-4" />
              )}
              Botu Durdur
            </Button>

            <Button
              className="h-9 rounded-lg gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800"
              onClick={() => void handleSendQueue()}
              disabled={loading !== null || status !== "connected"}
            >
              {loading === "send" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Kuyruktaki Mesajları Gönder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
