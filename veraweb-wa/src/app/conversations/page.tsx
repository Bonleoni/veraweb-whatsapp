"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Search, User } from "lucide-react"
import { toast } from "sonner"

interface Business {
  id: string
  name: string
  owner_name?: string | null
}

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

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export default function ConversationsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(
    null
  )
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedIdRef = useRef<string | null>(null)
  const selectedBusinessIdRef = useRef<string | null>(null)
  const messagesFpRef = useRef("0")

  useEffect(() => {
    selectedIdRef.current = selectedCustomer?.id ?? null
  }, [selectedCustomer?.id])

  useEffect(() => {
    selectedBusinessIdRef.current = selectedBusiness?.id ?? null
  }, [selectedBusiness?.id])

  const loadBusinesses = useCallback(async () => {
    try {
      const res = await fetch("/api/businesses")
      const data = await res.json()
      if (data.success) {
        const list = (data.data ?? []) as Business[]
        setBusinesses(list)
        setSelectedBusiness((prev) => {
          if (prev) {
            const still = list.find((b) => b.id === prev.id)
            return still ?? list[0] ?? null
          }
          return list[0] ?? null
        })
      }
    } catch (error) {
      console.error("İşletmeler yüklenemedi:", error)
    }
  }, [])

  const loadCustomers = useCallback(async (businessId?: string) => {
    try {
      const id = businessId ?? selectedBusinessIdRef.current
      const url = id
        ? `/api/conversations?businessId=${encodeURIComponent(id)}`
        : "/api/conversations"
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        const list = (data.data ?? []) as Customer[]
        setCustomers(list)
        setSelectedCustomer((prev) => {
          if (!prev) return prev
          const updated = list.find((c) => c.id === prev.id)
          return updated ?? null
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
          loadCustomers(selectedBusiness?.id),
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

  const selectBusiness = (business: Business) => {
    if (selectedBusiness?.id === business.id) return
    setSelectedBusiness(business)
    selectedIdRef.current = null
    messagesFpRef.current = "0"
    setSelectedCustomer(null)
    setMessages([])
    setCustomers([])
  }

  const selectCustomer = (customer: Customer) => {
    selectedIdRef.current = customer.id
    messagesFpRef.current = "0"
    setSelectedCustomer(customer)
    setMessages([])
    void loadMessages(customer.id)
  }

  useEffect(() => {
    void loadBusinesses()
  }, [loadBusinesses])

  useEffect(() => {
    if (!selectedBusiness?.id) {
      setCustomers([])
      return
    }
    void loadCustomers(selectedBusiness.id)
  }, [selectedBusiness?.id, loadCustomers])

  useEffect(() => {
    if (!selectedCustomer?.id) return
    void loadMessages(selectedCustomer.id)
    const interval = setInterval(() => {
      void loadMessages(selectedCustomer.id)
    }, 3000)
    return () => clearInterval(interval)
  }, [selectedCustomer?.id, loadMessages])

  useEffect(() => {
    if (!selectedBusiness?.id) return
    const interval = setInterval(() => {
      void loadCustomers(selectedBusiness.id)
    }, 8000)
    return () => clearInterval(interval)
  }, [selectedBusiness?.id, loadCustomers])

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
    <div className="-m-8 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden p-8">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Mesajlaşma
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Müşterilerinizle WhatsApp mesaj geçmişinizi görüntüleyin
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* SOL PANEL — işletmeler + müşteriler */}
          <div className="flex w-96 shrink-0 flex-col border-r border-zinc-200 bg-white">
            {/* KATMAN 1: İşletmeler */}
            <div className="shrink-0 border-b border-zinc-200">
              <div className="bg-zinc-50/50 p-3">
                <p className="mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                  Pilates İşletmeleri
                </p>
                <ScrollArea className="h-32">
                  {businesses.map((business) => (
                    <div
                      key={business.id}
                      onClick={() => selectBusiness(business)}
                      className={`flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-zinc-100 ${
                        selectedBusiness?.id === business.id
                          ? "bg-zinc-100"
                          : ""
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 text-xs font-semibold text-white">
                        {initials(business.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {business.name}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {business.owner_name || "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {businesses.length === 0 && (
                    <p className="p-2 text-xs text-zinc-500">
                      İşletme bulunamadı
                    </p>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* KATMAN 2: Müşteriler */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-zinc-200 p-3">
                <p className="mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                  Müşteriler
                  {selectedBusiness ? ` • ${selectedBusiness.name}` : ""}
                </p>
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input placeholder="Müşteri ara..." className="pl-9" />
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1">
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
                        {initials(customer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {customer.name}
                        </p>
                        {customer.lastMessageTime && (
                          <span className="shrink-0 text-xs text-zinc-400">
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
                    {selectedBusiness
                      ? "Bu işletmede müşteri yok"
                      : "Önce bir işletme seçin"}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* SAĞ PANEL */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-50/50">
            {selectedCustomer ? (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-zinc-100 text-zinc-700">
                        {initials(selectedCustomer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {selectedCustomer.phone}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <User className="h-4 w-4" />
                  </Button>
                </div>

                <ScrollArea className="min-h-0 flex-1 p-4">
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
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>
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

                <div className="shrink-0 border-t border-zinc-200 bg-white p-4">
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
