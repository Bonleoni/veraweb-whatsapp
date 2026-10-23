"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Search,
  Send,
  UserRound,
  Check,
  CheckCheck,
  ChevronDown,
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

type ReadStatus = "read" | "delivered" | "unread"
type FilterStatus = "all" | "sent" | "pending" | "read"

type ChatMessage = {
  id: string
  direction: "out" | "in"
  text: string
  time: string
  readStatus?: "sent" | "delivered" | "read"
  day: "Bugün" | "Dün"
}

type Conversation = {
  id: string
  name: string
  phone: string
  online: boolean
  lastMessage: string
  lastAt: string
  lastRank: number
  unread: number
  status: ReadStatus
  avatarColor: string
  messages: ChatMessage[]
}

const CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Ayşe Yılmaz",
    phone: "+90 532 111 22 33",
    online: true,
    lastMessage: "Merhaba, ders saatini öğrenebilir miyim?",
    lastAt: "2 dk önce",
    lastRank: 1,
    unread: 1,
    status: "unread",
    avatarColor: "bg-violet-100 text-violet-700",
    messages: [
      {
        id: "a1",
        direction: "out",
        text: "Merhaba Ayşe! Yarın saat 14:00'teki pilates dersinizi hatırlatmak istedik.",
        time: "14:30",
        readStatus: "read",
        day: "Bugün",
      },
      {
        id: "a2",
        direction: "in",
        text: "Merhaba! Evet, hatırlıyorum.",
        time: "14:32",
        day: "Bugün",
      },
      {
        id: "a3",
        direction: "out",
        text: "Harika! Sizi saat 14:00'te bekliyor olacağız.",
        time: "14:33",
        readStatus: "delivered",
        day: "Bugün",
      },
      {
        id: "a4",
        direction: "in",
        text: "Teşekkürler, görüşürüz!",
        time: "14:35",
        day: "Bugün",
      },
      {
        id: "a5",
        direction: "out",
        text: "Rica ederiz, iyi sporlar! 💪",
        time: "14:36",
        readStatus: "read",
        day: "Bugün",
      },
      {
        id: "a6",
        direction: "out",
        text: "Sizi stüdyoda görmek için sabırsızlanıyoruz! 💪",
        time: "14:32",
        readStatus: "read",
        day: "Bugün",
      },
      {
        id: "a7",
        direction: "in",
        text: "Merhaba, ders saatini öğrenebilir miyim?",
        time: "16:40",
        day: "Bugün",
      },
    ],
  },
  {
    id: "2",
    name: "Mehmet Demir",
    phone: "+90 533 222 33 44",
    online: false,
    lastMessage: "Teşekkürler, harika bir dersti!",
    lastAt: "1 saat önce",
    lastRank: 2,
    unread: 0,
    status: "read",
    avatarColor: "bg-sky-100 text-sky-700",
    messages: [
      {
        id: "b1",
        direction: "out",
        text: "Merhaba Mehmet! Bugünkü ilk dersinizi umarız beğendiniz.",
        time: "10:00",
        readStatus: "read",
        day: "Bugün",
      },
      {
        id: "b2",
        direction: "in",
        text: "Teşekkürler, harika bir dersti!",
        time: "10:15",
        day: "Bugün",
      },
    ],
  },
  {
    id: "3",
    name: "Canan Yıldız",
    phone: "+90 534 333 44 55",
    online: true,
    lastMessage: "Bir sonraki randevumu almak istiyorum",
    lastAt: "3 saat önce",
    lastRank: 3,
    unread: 2,
    status: "unread",
    avatarColor: "bg-rose-100 text-rose-700",
    messages: [
      {
        id: "c1",
        direction: "out",
        text: "Merhaba Canan! Sizi özledik!",
        time: "09:00",
        readStatus: "delivered",
        day: "Bugün",
      },
      {
        id: "c2",
        direction: "in",
        text: "Bir sonraki randevumu almak istiyorum",
        time: "11:20",
        day: "Bugün",
      },
      {
        id: "c3",
        direction: "in",
        text: "Bu hafta uygun bir saat var mı?",
        time: "11:21",
        day: "Bugün",
      },
    ],
  },
  {
    id: "4",
    name: "Ali Kaya",
    phone: "+90 535 444 55 66",
    online: false,
    lastMessage: "İptal etmek istiyorum",
    lastAt: "Dün",
    lastRank: 4,
    unread: 0,
    status: "read",
    avatarColor: "bg-amber-100 text-amber-700",
    messages: [
      {
        id: "d1",
        direction: "out",
        text: "Merhaba Ali! Yarın saat 10:00'da dersiniz var.",
        time: "18:00",
        readStatus: "read",
        day: "Dün",
      },
      {
        id: "d2",
        direction: "in",
        text: "İptal etmek istiyorum",
        time: "18:40",
        day: "Dün",
      },
    ],
  },
  {
    id: "5",
    name: "Zeynep Şahin",
    phone: "+90 536 555 66 77",
    online: false,
    lastMessage: "Fiyat bilgisi alabilir miyim?",
    lastAt: "2 gün önce",
    lastRank: 5,
    unread: 0,
    status: "read",
    avatarColor: "bg-emerald-100 text-emerald-700",
    messages: [
      {
        id: "e1",
        direction: "in",
        text: "Fiyat bilgisi alabilir miyim?",
        time: "15:10",
        day: "Dün",
      },
      {
        id: "e2",
        direction: "out",
        text: "Tabii Zeynep! Paketlerimizi paylaşabilirim.",
        time: "15:20",
        readStatus: "read",
        day: "Dün",
      },
    ],
  },
  {
    id: "6",
    name: "Burak Özkan",
    phone: "+90 537 666 77 88",
    online: true,
    lastMessage: "Yeni başlayanlar için uygun mu?",
    lastAt: "3 gün önce",
    lastRank: 6,
    unread: 1,
    status: "unread",
    avatarColor: "bg-indigo-100 text-indigo-700",
    messages: [
      {
        id: "f1",
        direction: "out",
        text: "Merhaba Burak! Stüdyomuza hoş geldiniz.",
        time: "12:00",
        readStatus: "delivered",
        day: "Dün",
      },
      {
        id: "f2",
        direction: "in",
        text: "Yeni başlayanlar için uygun mu?",
        time: "12:30",
        day: "Dün",
      },
    ],
  },
  {
    id: "7",
    name: "Elif Kara",
    phone: "+90 538 777 88 99",
    online: false,
    lastMessage: "Hoşçakalın",
    lastAt: "1 hafta önce",
    lastRank: 7,
    unread: 0,
    status: "read",
    avatarColor: "bg-fuchsia-100 text-fuchsia-700",
    messages: [
      {
        id: "g1",
        direction: "out",
        text: "Merhaba Elif, iyi çalışmalar dileriz.",
        time: "09:00",
        readStatus: "read",
        day: "Dün",
      },
      {
        id: "g2",
        direction: "in",
        text: "Hoşçakalın",
        time: "09:05",
        day: "Dün",
      },
    ],
  },
  {
    id: "8",
    name: "Emre Çelik",
    phone: "+90 539 888 99 00",
    online: false,
    lastMessage: "Teşekkür ederim",
    lastAt: "2 hafta önce",
    lastRank: 8,
    unread: 0,
    status: "read",
    avatarColor: "bg-teal-100 text-teal-700",
    messages: [
      {
        id: "h1",
        direction: "out",
        text: "Merhaba Emre! Randevunuz onaylandı.",
        time: "16:00",
        readStatus: "read",
        day: "Dün",
      },
      {
        id: "h2",
        direction: "in",
        text: "Teşekkür ederim",
        time: "16:10",
        day: "Dün",
      },
    ],
  },
]

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: "Tüm Durumlar",
  sent: "Gönderildi",
  pending: "Bekliyor",
  read: "Okundu",
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
  const [selectedId, setSelectedId] = useState(CONVERSATIONS[0].id)
  const [draft, setDraft] = useState("")
  const [threads, setThreads] = useState(CONVERSATIONS)
  const bottomRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return threads.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.phone.includes(q)
      const matchesFilter =
        filter === "all" ||
        (filter === "read" && c.status === "read") ||
        (filter === "sent" && c.status === "delivered") ||
        (filter === "pending" && c.status === "unread")
      return matchesQuery && matchesFilter
    })
  }, [threads, query, filter])

  const selected =
    filtered.find((c) => c.id === selectedId) ||
    threads.find((c) => c.id === selectedId) ||
    filtered[0] ||
    threads[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selected?.id, selected?.messages.length])

  function handleSelect(id: string) {
    setSelectedId(id)
    setThreads((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, unread: 0, status: c.status === "unread" ? "delivered" : c.status } : c
      )
    )
  }

  function handleSend() {
    const text = draft.trim()
    if (!text || !selected) return

    console.log("Mesaj gönder (UI only):", {
      to: selected.phone,
      text,
    })

    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    setThreads((prev) =>
      prev.map((c) => {
        if (c.id !== selected.id) return c
        return {
          ...c,
          lastMessage: text,
          lastAt: "Az önce",
          lastRank: 0,
          status: "delivered" as const,
          messages: [
            ...c.messages,
            {
              id: `local-${Date.now()}`,
              direction: "out" as const,
              text,
              time,
              readStatus: "sent" as const,
              day: "Bugün" as const,
            },
          ],
        }
      })
    )
    setDraft("")
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messagesByDay = useMemo(() => {
    const groups: { day: string; items: ChatMessage[] }[] = []
    for (const msg of selected?.messages ?? []) {
      const last = groups[groups.length - 1]
      if (!last || last.day !== msg.day) {
        groups.push({ day: msg.day, items: [msg] })
      } else {
        last.items.push(msg)
      }
    }
    return groups
  }, [selected])

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
        {/* Sol: müşteri listesi */}
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
            {filtered.length === 0 ? (
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
                        className={cn(
                          "text-xs font-medium",
                          c.avatarColor
                        )}
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
                          ) : c.status === "delivered" ? (
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

        {/* Sağ: sohbet */}
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
                {messagesByDay.map((group) => (
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
                          msg.direction === "out" ? "justify-end" : "justify-start"
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
                ))}
                <div ref={bottomRef} />
              </div>

              <Separator />
              <div className="border-t border-zinc-200 bg-white p-4">
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
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    className="h-10 shrink-0 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
                    aria-label="Gönder"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Enter ile gönder, Shift+Enter ile yeni satır
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              Bir sohbet seçin
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
