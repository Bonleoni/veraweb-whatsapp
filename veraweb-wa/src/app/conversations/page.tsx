"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  Send,
  UserRound,
  Check,
  CheckCheck,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type FilterStatus = "all" | "sent" | "pending" | "read"
type ReadStatus = "read" | "delivered" | "unread" | "sent"

type Conversation = {
  id: string
  name: string
  phone: string
  online: boolean
  lastMessage: string
  lastAt: string
  lastMessageTime: string | null
  unread: number
  status: ReadStatus
  avatarColor: string
}

type ChatMessage = {
  id: string
  direction: "out" | "in"
  text: string
  time: string
  readStatus?: "sent" | "delivered" | "read"
  day: string
  createdAt: string
}

type ApiCustomer = {
  id: string
  name: string
  phone: string
  lastMessage: string
  lastMessageTime: string | null
  direction: string | null
  status: string | null
  unreadCount: number
}

type ApiMessage = {
  id: string
  customer_id: string
  direction: string
  content: string
  status: string | null
  created_at: string
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
]

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: "Tüm Durumlar",
  sent: "Gönderildi",
  pending: "Bekliyor",
  read: "Okundu",
}

function avatarColorFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function truncate(text: string, max = 30) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

function relativeTime(iso: string | null) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return "Az önce"
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Dün"
  if (days < 7) return `${days} gün önce`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} hafta önce`
  return new Date(iso).toLocaleDateString("tr-TR")
}

function dayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(date, today)) return "Bugün"
  if (sameDay(date, yesterday)) return "Dün"
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatClock(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function mapListStatus(
  status: string | null,
  unreadCount: number
): ReadStatus {
  if (unreadCount > 0) return "unread"
  if (status === "read") return "read"
  if (status === "delivered" || status === "sent") return "delivered"
  return "sent"
}

function mapMessageStatus(
  status: string | null
): "sent" | "delivered" | "read" {
  if (status === "read") return "read"
  if (status === "delivered") return "delivered"
  return "sent"
}

function mapApiCustomer(row: ApiCustomer): Conversation {
  return {
    id: row.id,
    name: row.name || "İsimsiz",
    phone: row.phone || "—",
    online: false,
    lastMessage: row.lastMessage || "Henüz mesaj yok",
    lastAt: relativeTime(row.lastMessageTime),
    lastMessageTime: row.lastMessageTime,
    unread: row.unreadCount ?? 0,
    status: mapListStatus(row.status, row.unreadCount ?? 0),
    avatarColor: avatarColorFor(row.id),
  }
}

function mapApiMessage(row: ApiMessage): ChatMessage {
  const outbound = row.direction === "outbound" || row.direction === "out"
  return {
    id: row.id,
    direction: outbound ? "out" : "in",
    text: row.content,
    time: formatClock(row.created_at),
    readStatus: outbound ? mapMessageStatus(row.status) : undefined,
    day: dayLabel(row.created_at),
    createdAt: row.created_at,
  }
}

function ReadTicks({ status }: { status?: "sent" | "delivered" | "read" }) {
  if (status === "read") {
    return <CheckCheck className="size-3.5 text-sky-300" />
  }
  if (status === "delivered") {
    return <CheckCheck className="size-3.5 text-emerald-100/80" />
  }
  return <Check className="size-3.5 text-emerald-100/80" />
}

export default function ConversationsPage() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterStatus>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [customers, setCustomers] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadCustomers = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch("/api/conversations")
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Veriler alınamadı")
      }
      const mapped = ((json.data ?? []) as ApiCustomer[]).map(mapApiCustomer)
      setCustomers(mapped)
      setSelectedId((prev) => prev ?? mapped[0]?.id ?? null)
    } catch (err) {
      console.error(err)
      setListError(
        err instanceof Error ? err.message : "Müşteri listesi alınamadı"
      )
      setCustomers([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    let cancelled = false
    async function loadHistory() {
      setMessagesLoading(true)
      setSendError(null)
      try {
        const res = await fetch(
          `/api/messages/history?customerId=${encodeURIComponent(selectedId!)}`
        )
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Mesaj geçmişi alınamadı")
        }
        if (!cancelled) {
          setMessages(((json.data ?? []) as ApiMessage[]).map(mapApiMessage))
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setMessages([])
      } finally {
        if (!cancelled) setMessagesLoading(false)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.phone.includes(q)
      const matchesFilter =
        filter === "all" ||
        (filter === "read" && c.status === "read") ||
        (filter === "sent" &&
          (c.status === "delivered" || c.status === "sent")) ||
        (filter === "pending" && c.status === "unread")
      return matchesQuery && matchesFilter
    })
  }, [customers, query, filter])

  const selected =
    filtered.find((c) => c.id === selectedId) ||
    customers.find((c) => c.id === selectedId) ||
    null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selected?.id, messages.length])

  function handleSelect(id: string) {
    setSelectedId(id)
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              unread: 0,
              status: c.status === "unread" ? "delivered" : c.status,
            }
          : c
      )
    )
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected || sending) return

    setSending(true)
    setSendError(null)
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected.id, content: text }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Mesaj gönderilemedi")
      }

      const saved = json.data as ApiMessage
      const mapped = mapApiMessage(saved)
      setMessages((prev) => [...prev, mapped])
      setCustomers((prev) =>
        prev
          .map((c) =>
            c.id === selected.id
              ? {
                  ...c,
                  lastMessage: text,
                  lastAt: "Az önce",
                  lastMessageTime: saved.created_at,
                  status: "sent" as const,
                }
              : c
          )
          .sort((a, b) => {
            const aTime = a.lastMessageTime
              ? new Date(a.lastMessageTime).getTime()
              : 0
            const bTime = b.lastMessageTime
              ? new Date(b.lastMessageTime).getTime()
              : 0
            return bTime - aTime
          })
      )
      setDraft("")
    } catch (err) {
      console.error(err)
      setSendError(
        err instanceof Error ? err.message : "Mesaj gönderilemedi"
      )
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const messagesByDay = useMemo(() => {
    const groups: { day: string; items: ChatMessage[] }[] = []
    for (const msg of messages) {
      const last = groups[groups.length - 1]
      if (!last || last.day !== msg.day) {
        groups.push({ day: msg.day, items: [msg] })
      } else {
        last.items.push(msg)
      }
    }
    return groups
  }, [messages])

  return (
    <div className="font-sans space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Mesajlaşma
        </h1>
        <p className="text-sm text-zinc-500">
          Müşterilerinizle WhatsApp mesaj geçmişinizi görüntüleyin
        </p>
      </div>

      <div className="flex h-[calc(100vh-200px)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <aside className="flex w-96 shrink-0 flex-col border-r border-zinc-200 bg-white">
          <div className="space-y-2 border-b border-zinc-100 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Müşteri ara..."
                className="h-8 rounded-lg border-zinc-200 pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-8 w-full justify-between rounded-lg border-zinc-200"
                  />
                }
              >
                {FILTER_LABELS[filter]}
                <ChevronDown className="size-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {(Object.keys(FILTER_LABELS) as FilterStatus[]).map((key) => (
                  <DropdownMenuItem key={key} onClick={() => setFilter(key)}>
                    {FILTER_LABELS[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500">
                <Loader2 className="size-4 animate-spin" />
                Yükleniyor...
              </div>
            ) : listError ? (
              <div className="space-y-2 p-4 text-sm">
                <p className="text-red-600">{listError}</p>
                <p className="text-zinc-500">
                  Supabase&apos;de <code>chat_messages</code> tablosunu
                  oluşturduğunuzdan emin olun.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => void loadCustomers()}
                >
                  Tekrar dene
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Müşteri bulunamadı.</p>
            ) : (
              filtered.map((c) => {
                const active = selected?.id === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50",
                      active && "bg-zinc-50"
                    )}
                  >
                    <Avatar className="size-10">
                      <AvatarFallback
                        className={cn("text-xs font-medium", c.avatarColor)}
                      >
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-zinc-950">
                          {c.name}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {c.lastAt}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-zinc-500">
                          {truncate(c.lastMessage)}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          {c.status === "read" ? (
                            <CheckCheck className="size-3.5 text-sky-500" />
                          ) : c.status === "delivered" ||
                            c.status === "sent" ? (
                            <Check className="size-3.5 text-zinc-400" />
                          ) : null}
                          {c.unread > 0 && (
                            <Badge className="h-5 min-w-5 rounded-full border-0 bg-red-500 px-1.5 text-[10px] text-white hover:bg-red-500">
                              {c.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-zinc-50/50">
          {selected ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback
                      className={cn("text-xs font-medium", selected.avatarColor)}
                    >
                      {initials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-semibold tracking-tight text-zinc-950">
                        {selected.name}
                      </h2>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0 text-[10px] font-medium",
                          selected.online
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-500"
                        )}
                      >
                        {selected.online ? "WhatsApp'ta" : "Çevrimdışı"}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-500">{selected.phone}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg border-zinc-200"
                  aria-label="Profil"
                >
                  <UserRound className="size-4" />
                </Button>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="size-4 animate-spin" />
                    Mesajlar yükleniyor...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    Henüz mesaj yok. İlk mesajı gönderin.
                  </div>
                ) : (
                  messagesByDay.map((group) => (
                    <div key={group.day} className="space-y-3">
                      <div className="flex justify-center">
                        <span className="rounded-full bg-zinc-200/80 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {group.day}
                        </span>
                      </div>
                      {group.items.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.direction === "out"
                              ? "justify-end"
                              : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-md p-3 text-sm leading-relaxed shadow-sm",
                              msg.direction === "out"
                                ? "ml-auto rounded-2xl rounded-tr-sm bg-emerald-500 text-white"
                                : "mr-auto rounded-2xl rounded-tl-sm border border-zinc-200 bg-white text-zinc-900"
                            )}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <div
                              className={cn(
                                "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                msg.direction === "out"
                                  ? "text-emerald-50/90"
                                  : "text-zinc-400"
                              )}
                            >
                              <span>{msg.time}</span>
                              {msg.direction === "out" && (
                                <ReadTicks status={msg.readStatus} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <Separator />
              <div className="border-t border-zinc-200 bg-white p-4">
                {sendError && (
                  <p className="mb-2 text-xs text-red-600">{sendError}</p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                    placeholder="Mesajınızı yazın..."
                    className="min-h-[64px] w-full resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200"
                  />
                  <Button
                    onClick={() => void handleSend()}
                    disabled={!draft.trim() || sending}
                    className="h-10 shrink-0 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
                    aria-label="Gönder"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Enter ile gönder, Shift+Enter ile yeni satır
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              {listLoading ? "Yükleniyor..." : "Bir sohbet seçin"}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
