"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Search, User } from "lucide-react"
import { toast } from "sonner"

interface Customer {
  id: string
  name: string
  phone: string
  lastMessage?: string
  lastMessageTime?: string
}

interface Message {
  id: string
  customer_id: string
  direction: "inbound" | "outbound"
  content: string
  status: string
  created_at: string
}

function messagesFingerprint(list: Message[]) {
  if (list.length === 0) return "0"
  const last = list[list.length - 1]
  return `${list.length}:${last.id}:${last.content}`
}

export default function ConversationsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<string | null>(null)
  const messagesFpRef = useRef("0")

  useEffect(() => {
    selectedIdRef.current = selectedCustomer?.id ?? null
  }, [selectedCustomer?.id])

  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations")
      const data = await res.json()
      if (data.success) {
        const list = (data.data ?? []) as Customer[]
        setCustomers(list)
        // Seçili müşterinin son mesaj önizlemesini güncel tut
        setSelectedCustomer((prev) => {
          if (!prev) return prev
          const updated = list.find((c) => c.id === prev.id)
          return updated ? { ...prev, ...updated } : prev
        })
      }
    } catch (error) {
      console.error("Müşteriler yüklenemedi:", error)
    }
  }, [])

  const loadMessages = useCallback(async (customerId: string) => {
    try {
      const res = await fetch(
        `/api/messages/history?customerId=${customerId}`
      )
      const data = await res.json()
      if (!data.success) return
      // Polling sırasında başka sohbete geçildiyse eski cevabı yutma
      if (selectedIdRef.current !== customerId) return

      const next = (data.data ?? []) as Message[]
      const fp = messagesFingerprint(next)
      if (fp === messagesFpRef.current) return

      messagesFpRef.current = fp
      setMessages(next)
    } catch (error) {
      console.error("Mesajlar yüklenemedi:", error)
    }
  }, [])

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedCustomer || sending) return

    setSending(true)
    const tempMessage = messageInput
    setMessageInput("")

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          content: tempMessage,
        }),
      })

      const data = await res.json()

      if (data.success) {
        const newMsg: Message = {
          id: data.data?.id || Date.now().toString(),
          customer_id: selectedCustomer.id,
          direction: "outbound",
          content: tempMessage,
          status: data.data?.status || "sent",
          created_at: data.data?.created_at || new Date().toISOString(),
        }
        setMessages((prev) => {
          const next = [...prev, newMsg]
          messagesFpRef.current = messagesFingerprint(next)
          return next
        })

        await Promise.all([
          loadCustomers(),
          loadMessages(selectedCustomer.id),
        ])

        toast.success(
          typeof data.message === "string" ? data.message : "Mesaj gönderildi"
        )
      } else {
        toast.error(data.error || "Mesaj gönderilemedi")
        setMessageInput(tempMessage)
      }
    } catch (error) {
      console.error("Gönderim hatası:", error)
      toast.error("Bir hata oluştu")
      setMessageInput(tempMessage)
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const selectCustomer = (customer: Customer) => {
    selectedIdRef.current = customer.id
    messagesFpRef.current = "0"
    setSelectedCustomer(customer)
    setMessages([])
    void loadMessages(customer.id)
  }

  // İlk yükleme
  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  // Seçili sohbet mesajlarını her 3 sn yenile
  useEffect(() => {
    if (!selectedCustomer?.id) return
    void loadMessages(selectedCustomer.id)
    const interval = setInterval(() => {
      void loadMessages(selectedCustomer.id)
    }, 3000)
    return () => clearInterval(interval)
  }, [selectedCustomer?.id, loadMessages])

  // Müşteri listesini her 8 sn yenile
  useEffect(() => {
    const interval = setInterval(() => {
      void loadCustomers()
    }, 8000)
    return () => clearInterval(interval)
  }, [loadCustomers])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Mesajlaşma
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Müşterilerinizle WhatsApp mesaj geçmişinizi görüntüleyin
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex h-[calc(100vh-280px)]">
          <div className="flex w-96 flex-col border-r border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 p-4">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input placeholder="Müşteri ara..." className="pl-9" />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => selectCustomer(customer)}
                  className={`flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-zinc-50 ${
                    selectedCustomer?.id === customer.id ? "bg-zinc-50" : ""
                  }`}
                >
                  <Avatar>
                    <AvatarFallback className="bg-zinc-100 text-zinc-700">
                      {customer.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {customer.name}
                      </p>
                      {customer.lastMessageTime && (
                        <span className="text-xs text-zinc-400">
                          {new Date(
                            customer.lastMessageTime
                          ).toLocaleDateString("tr-TR")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {customer.lastMessage || "Henüz mesaj yok"}
                    </p>
                  </div>
                </div>
              ))}
              {customers.length === 0 && (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Müşteri bulunamadı
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex flex-1 flex-col bg-zinc-50/50">
            {selectedCustomer ? (
              <>
                <div className="flex items-center justify-between border-b border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-zinc-100 text-zinc-700">
                        {selectedCustomer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-zinc-950">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {selectedCustomer.phone}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <User className="h-4 w-4" />
                  </Button>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.direction === "outbound"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2 ${
                            msg.direction === "outbound"
                              ? "rounded-br-sm bg-emerald-500 text-white"
                              : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p
                            className={`mt-1 text-xs ${
                              msg.direction === "outbound"
                                ? "text-emerald-100"
                                : "text-zinc-400"
                            }`}
                          >
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-zinc-200 bg-white p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Mesajınızı yazın..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={sending}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => void handleSend()}
                      disabled={!messageInput.trim() || sending}
                      className="bg-zinc-950 text-white hover:bg-zinc-800"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    Enter ile gönder, Shift+Enter ile yeni satır
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <User className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
                  <p className="text-sm text-zinc-500">
                    Sohbet başlatmak için soldan bir müşteri seçin
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
