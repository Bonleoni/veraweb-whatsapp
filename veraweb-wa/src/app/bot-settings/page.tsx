"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Power, PowerOff, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
type BotUiStatus = "connected" | "connecting" | "disconnected"

export default function BotSettingsPage() {
  const [status, setStatus] = useState<BotUiStatus>("disconnected")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState<"start" | "stop" | "send" | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/bot/status", { cache: "no-store" })
        const data = await res.json()
        if (data.success) {
          const nextStatus = (data.status?.status ||
            "disconnected") as BotUiStatus
          const nextQr = (data.status?.qr_code as string | null) || null
          setStatus(nextStatus)
          setQrCode(nextQr)
        }
      } catch (error) {
        console.error("Durum alınamadı:", error)
      }
    }

    void poll()
    const interval = setInterval(() => {
      void poll()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

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

      // QR hemen gelsin diye birkaç kez hızlı poll
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const statusRes = await fetch("/api/bot/status", { cache: "no-store" })
        const statusData = await statusRes.json()
        if (statusData.success) {
          setStatus((statusData.status?.status || "connecting") as BotUiStatus)
          setQrCode(statusData.status?.qr_code || null)
          if (statusData.status?.qr_code || statusData.status?.status === "connected") {
            break
          }
        }
      }
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

  return (
    <div className="font-sans space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Bot Ayarları
        </h1>
        <p className="text-zinc-500 text-sm">
          WhatsApp bağlantınızı yönetin
        </p>
      </div>

      <Card className="bg-white border border-zinc-200 rounded-xl shadow-sm ring-0 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-950 tracking-tight">
              Bağlantı Durumu
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              {status === "connected" && "WhatsApp bağlantınız aktif"}
              {status === "connecting" && "QR kod okutulmayı bekliyor"}
              {status === "disconnected" && "Botu başlatarak bağlantıyı kurun"}
            </p>
          </div>

          {status === "connected" && (
            <Badge
              variant="outline"
              className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-medium gap-1.5"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Bağlı
            </Badge>
          )}

          {status === "connecting" && (
            <Badge
              variant="outline"
              className="rounded-full border border-amber-200 bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-medium gap-1.5"
            >
              <span className="size-1.5 rounded-full bg-amber-500" />
              QR kod okunuyor...
            </Badge>
          )}

          {status === "disconnected" && (
            <Badge
              variant="outline"
              className="rounded-full border border-red-200 bg-red-50 text-red-700 px-2.5 py-0.5 text-xs font-medium gap-1.5"
            >
              <span className="size-1.5 rounded-full bg-red-500" />
              Bağlı değil
            </Badge>
          )}
        </div>

        {status === "connecting" && qrCode && (
          <Card className="p-8 flex flex-col items-center bg-white border border-zinc-200 rounded-xl shadow-sm ring-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="QR Code" className="w-64 h-64" />
            <p className="text-sm text-zinc-500 text-center mt-4">
              Telefonunuzla WhatsApp&apos;ı açın → Ayarlar → Bağlı Cihazlar →
              Cihaz Bağla → QR kodu okutun
            </p>
          </Card>
        )}

        {status === "connecting" && !qrCode && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 p-8 text-center">
            <Loader2 className="size-6 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500">QR kod oluşturuluyor...</p>
          </div>
        )}

        {status === "connected" && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800">
            WhatsApp bağlantınız aktif
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
      </Card>
    </div>
  )
}
