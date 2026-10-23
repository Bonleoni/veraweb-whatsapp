"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Power, X, Loader2, Send, AlertCircle } from "lucide-react"

export default function BotSettingsPage() {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  async function fetchQRCode() {
    try {
      const res = await fetch("/api/bot/qr", { cache: "no-store" })
      const data = await res.json()

      console.log("📱 QR yanıtı:", data)

      if (!data.success) {
        toast.error(data.error || "QR alınamadı")
        return
      }

      if (data.connected) {
        setConnected(true)
        setQrCode(null)
        setLoading(false)
        stopPolling()
        toast.success("WhatsApp bağlantısı kuruldu!")
        return
      }

      if (data.qrCode) {
        setQrCode(data.qrCode)
        setConnected(false)
        setLoading(false)
      }
    } catch (error) {
      console.error("❌ QR alınamadı:", error)
    }
  }

  async function handleStartBot() {
    setLoading(true)
    setQrCode(null)
    setConnected(false)

    toast.info("Bot başlatılıyor...")

    // Önce eski oturumu temizle, taze QR için
    try {
      await fetch("/api/bot/qr", { method: "POST" })
    } catch {
      // ignore
    }

    await fetchQRCode()

    stopPolling()
    pollingRef.current = setInterval(() => {
      void fetchQRCode()
    }, 3000)
  }

  async function handleStopBot() {
    try {
      const res = await fetch("/api/bot/qr", { method: "POST" })
      const data = await res.json()

      if (data.success) {
        setQrCode(null)
        setConnected(false)
        setLoading(false)
        stopPolling()
        toast.success("Bot durduruldu")
      } else {
        toast.error("Bot durdurulamadı")
      }
    } catch {
      toast.error("Bot durdurulamadı")
    }
  }

  async function handleSendQueue() {
    setSending(true)
    try {
      const res = await fetch("/api/bot/send-queue", { method: "POST" })
      const data = await res.json()

      if (data.success) {
        toast.success(`${data.count || 0} mesaj başarıyla gönderildi!`)
      } else {
        toast.error(data.error || "Mesajlar gönderilemedi")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  return (
    <div className="font-sans space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          WhatsApp Ayarları
        </h1>
        <p className="text-sm text-zinc-500">
          WhatsApp bağlantınızı yönetin
        </p>
      </div>

      <Card className="bg-white border border-zinc-200 rounded-xl shadow-sm ring-0 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-medium text-zinc-950">
              Bağlantı Durumu
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              {connected
                ? "WhatsApp bağlantınız aktif"
                : "Botu başlatarak bağlantıyı kurun"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              connected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-medium gap-1.5"
                : "bg-red-50 text-red-700 border-red-200 rounded-full px-2.5 py-0.5 text-xs font-medium gap-1.5"
            }
          >
            <span
              className={`size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
            />
            {connected ? "Bağlı" : "Bağlı değil"}
          </Badge>
        </div>

        {loading && !qrCode && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500 mt-4">
              QR kod oluşturuluyor...
            </p>
          </div>
        )}

        {qrCode && (
          <div className="flex flex-col items-center justify-center py-8 border border-zinc-200 rounded-lg bg-zinc-50/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrCode}
              alt="QR Code"
              className="w-64 h-64 border border-zinc-200 rounded-lg bg-white p-2"
            />
            <p className="text-sm text-zinc-500 text-center mt-4 max-w-md">
              Telefonunuzla WhatsApp&apos;ı açın → Ayarlar → Bağlı Cihazlar →
              Cihaz Bağla → QR kodu okutun
            </p>
          </div>
        )}

        {connected && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              WhatsApp bağlantınız aktif
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => void handleStartBot()}
            disabled={loading || connected}
            className="bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Power className="w-4 h-4 mr-2" />
            )}
            {loading ? "Başlatılıyor..." : "Botu Başlat"}
          </Button>

          <Button
            onClick={() => void handleStopBot()}
            variant="outline"
            disabled={!connected && !loading && !qrCode}
            className="text-red-600 border-red-200 hover:bg-red-50 rounded-lg"
          >
            <X className="w-4 h-4 mr-2" />
            Botu Durdur
          </Button>
        </div>
      </Card>

      <Card className="bg-white border border-zinc-200 rounded-xl shadow-sm ring-0 p-6 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-zinc-950">
              Mesaj Gönderimi
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Onaylanmış (yeşil) bekleyen mesajları WhatsApp üzerinden gönder.
            </p>
          </div>
          <Button
            onClick={() => void handleSendQueue()}
            disabled={sending || !connected}
            className="bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Kuyruktaki Mesajları Gönder
              </>
            )}
          </Button>
        </div>
        {!connected && (
          <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Bu işlemi yapmak için önce WhatsApp bağlantısını kurmalısınız.
          </p>
        )}
      </Card>
    </div>
  )
}
