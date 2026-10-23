"use client"

import { useEffect, useRef, useState } from "react"
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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const connectedToastShown = useRef(false)

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  async function fetchStatus() {
    try {
      const res = await fetch("/api/bot/status", { cache: "no-store" })
      const data = await res.json()
      if (!data.success) return

      const nextStatus = (data.status?.status ||
        "disconnected") as BotUiStatus
      const nextQr = (data.status?.qr_code as string | null) || null

      setStatus(nextStatus)
      setQrCode(nextQr)

      if (nextStatus === "connected") {
        stopPolling()
        if (!connectedToastShown.current) {
          connectedToastShown.current = true
          toast.success("WhatsApp bağlantısı kuruldu!")
        }
      }
    } catch (error) {
      console.error("Durum alınamadı:", error)
    }
  }

  function startPolling() {
    if (pollingRef.current) return
    pollingRef.current = setInterval(() => {
      void fetchStatus()
    }, 3000)
  }

  useEffect(() => {
    void fetchStatus()
    startPolling()
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStart() {
    setLoading("start")
    setStatus("connecting")
    setQrCode(null)
    connectedToastShown.current = false
    toast.message("QR kod oluşturuluyor, sayfayı yenilemeyin...")
    startPolling()

    try {
      const res = await fetch("/api/bot/start", { method: "POST" })
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Bot başlatılamadı")
        setStatus("disconnected")
        return
      }

      const nextStatus = (data.status?.status ||
        "connecting") as BotUiStatus
      const nextQr = (data.status?.qr_code as string | null) || null

      setStatus(nextStatus)
      setQrCode(nextQr)

      if (nextQr) {
        toast.success("QR kod hazır — telefonunuzla okutun")
      } else if (nextStatus === "connected") {
        toast.success("WhatsApp bağlantısı kuruldu!")
        connectedToastShown.current = true
        stopPolling()
      }

      await fetchStatus()
    } catch {
      toast.error("Bot başlatılamadı")
      setStatus("disconnected")
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
      connectedToastShown.current = false
      startPolling()
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

  const starting = loading === "start" || (status === "connecting" && !qrCode)

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
          <Card className="p-8 mt-6 flex flex-col items-center bg-white border border-zinc-200 rounded-xl shadow-sm ring-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="QR Code"
              className="w-64 h-64 border border-zinc-200 rounded-lg"
            />
            <p className="text-sm text-zinc-500 text-center mt-4">
              Telefonunuzla WhatsApp&apos;ı açın → Ayarlar → Bağlı Cihazlar →
              Cihaz Bağla → QR kodu okutun
            </p>
          </Card>
        )}

        {status === "connecting" && !qrCode && (
          <Card className="p-8 mt-6 flex flex-col items-center bg-white border border-zinc-200 rounded-xl shadow-sm ring-0">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500 text-center mt-4">
              QR kod oluşturuluyor, lütfen bekleyin...
            </p>
          </Card>
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
            disabled={
              loading !== null ||
              status === "connected" ||
              status === "connecting"
            }
          >
            {starting ? (
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
