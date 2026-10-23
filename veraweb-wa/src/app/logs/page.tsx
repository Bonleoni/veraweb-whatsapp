"use client"

import { useMemo, useState } from "react"
import {
  Search,
  ChevronDown,
  Download,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SCENARIOS, type ScenarioType } from "@/lib/scenarios"
import { cn } from "@/lib/utils"

type LogStatus = "Gönderildi" | "Başarısız" | "Bekliyor"
type SortKey = "customer" | "scenario" | "status" | "sentAt"

type LogRow = {
  id: string
  customer: string
  phone: string
  scenario: ScenarioType
  message: string
  status: LogStatus
  sentAt: string
  sentRank: number
  error: string | null
  avatarColor: string
}

const LOGS: LogRow[] = [
  {
    id: "1",
    customer: "Ayşe Yılmaz",
    phone: "+90 532 111 22 33",
    scenario: "REMINDER",
    message:
      "Merhaba Ayşe! Yarın saat 14:00'teki pilates dersinizi hatırlatmak istedik. Sizi stüdyoda görmek için sabırsızlanıyoruz!",
    status: "Gönderildi",
    sentAt: "2 dakika önce",
    sentRank: 1,
    error: null,
    avatarColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "2",
    customer: "Mehmet Demir",
    phone: "+90 533 222 33 44",
    scenario: "FOLLOW_UP",
    message:
      "Merhaba Mehmet! Bugünkü ilk dersinizi umarız beğendiniz. Herhangi bir sorunuz varsa buradayız.",
    status: "Gönderildi",
    sentAt: "1 saat önce",
    sentRank: 3,
    error: null,
    avatarColor: "bg-sky-100 text-sky-700",
  },
  {
    id: "3",
    customer: "Canan Yıldız",
    phone: "+90 534 333 44 55",
    scenario: "ABSENCE",
    message:
      "Merhaba Canan! Sizi özledik! Uzun süredir stüdyomuzda göremedik. Tekrar aramıza katılmanızı isteriz.",
    status: "Başarısız",
    sentAt: "3 saat önce",
    sentRank: 4,
    error: "Numara geçersiz",
    avatarColor: "bg-rose-100 text-rose-700",
  },
  {
    id: "4",
    customer: "Ali Kaya",
    phone: "+90 535 444 55 66",
    scenario: "REMINDER",
    message:
      "Merhaba Ali! Yarın saat 10:00'da pilates dersiniz var. Sizi stüdyoda görmek için sabırsızlanıyoruz!",
    status: "Gönderildi",
    sentAt: "Dün",
    sentRank: 5,
    error: null,
    avatarColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "5",
    customer: "Zeynep Şahin",
    phone: "+90 536 555 66 77",
    scenario: "FOLLOW_UP",
    message:
      "Merhaba Zeynep! İlk dersinizi umarız beğendiniz. Geri bildiriminiz varsa buradayız.",
    status: "Bekliyor",
    sentAt: "5 dakika önce",
    sentRank: 2,
    error: null,
    avatarColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "6",
    customer: "Burak Özkan",
    phone: "+90 537 666 77 88",
    scenario: "ABSENCE",
    message:
      "Merhaba Burak! Uzun süredir sizi göremedik. Kendinize zaman ayırıp tekrar aramıza katılmanızı çok isteriz.",
    status: "Gönderildi",
    sentAt: "2 gün önce",
    sentRank: 6,
    error: null,
    avatarColor: "bg-indigo-100 text-indigo-700",
  },
]

const statusBadgeClass: Record<LogStatus, string> = {
  Gönderildi: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Başarısız: "bg-red-50 text-red-700 border-red-200",
  Bekliyor: "bg-amber-50 text-amber-700 border-amber-200",
}

const scenarioBadgeClass: Record<ScenarioType, string> = {
  REMINDER: "bg-violet-50 text-violet-700 border-violet-200",
  FOLLOW_UP: "bg-sky-50 text-sky-700 border-sky-200",
  ABSENCE: "bg-orange-50 text-orange-700 border-orange-200",
}

const STATUS_OPTIONS: LogStatus[] = ["Gönderildi", "Başarısız", "Bekliyor"]
const PAGE_SIZE = 10
const TOTAL_DEMO_ROWS = 50

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function truncate(text: string, max = 80) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}...`
}

function SortableHead({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/sort inline-flex items-center gap-1.5 text-zinc-500 font-medium text-xs uppercase tracking-wider"
    >
      {label}
      <ChevronsUpDown
        className={cn(
          "size-3.5 text-zinc-300 transition-colors group-hover/sort:text-zinc-700",
          active && "text-zinc-700"
        )}
      />
    </button>
  )
}

export default function LogsPage() {
  const [query, setQuery] = useState("")
  const [statusFilters, setStatusFilters] = useState<LogStatus[]>([])
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = LOGS.filter((row) => {
      const matchesQuery =
        !q ||
        row.customer.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        row.message.toLowerCase().includes(q) ||
        SCENARIOS[row.scenario].name.toLowerCase().includes(q)
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(row.status)
      return matchesQuery && matchesStatus
    })

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const dir = sortAsc ? 1 : -1
        if (sortKey === "sentAt") return (a.sentRank - b.sentRank) * dir
        if (sortKey === "customer") {
          return a.customer.localeCompare(b.customer, "tr") * dir
        }
        if (sortKey === "scenario") {
          return (
            SCENARIOS[a.scenario].name.localeCompare(
              SCENARIOS[b.scenario].name,
              "tr"
            ) * dir
          )
        }
        return a.status.localeCompare(b.status, "tr") * dir
      })
    }

    return rows
  }, [query, statusFilters, sortKey, sortAsc])

  const pageCount = Math.max(1, Math.ceil(TOTAL_DEMO_ROWS / PAGE_SIZE))
  const showingFrom = (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, TOTAL_DEMO_ROWS)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
      return
    }
    setSortKey(key)
    setSortAsc(true)
  }

  return (
    <div className="font-sans space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Mesaj Logları
            </h1>
            <span className="rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">
              {LOGS.length}
            </span>
          </div>
          <p className="text-zinc-500 text-sm">
            Gönderilen WhatsApp mesajlarının geçmişi
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 py-1">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Loglarda ara..."
              className="h-8 w-64 rounded-lg border-zinc-200 pl-8 focus-visible:ring-2 focus-visible:ring-zinc-200"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="h-8 rounded-lg gap-1.5 border-zinc-200 hover:bg-zinc-50"
                />
              }
            >
              Filters
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Durum</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilters.includes(status)}
                  onCheckedChange={() => {
                    setStatusFilters((prev) =>
                      prev.includes(status)
                        ? prev.filter((s) => s !== status)
                        : [...prev, status]
                    )
                    setPage(1)
                  }}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            className="h-8 rounded-lg gap-1.5 border-zinc-200 hover:bg-zinc-50"
          >
            <Download className="size-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-zinc-200 hover:bg-transparent">
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Müşteri"
                  active={sortKey === "customer"}
                  onClick={() => toggleSort("customer")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Senaryo"
                  active={sortKey === "scenario"}
                  onClick={() => toggleSort("scenario")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur text-zinc-500 font-medium text-xs uppercase tracking-wider">
                Mesaj
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Durum"
                  active={sortKey === "status"}
                  onClick={() => toggleSort("status")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Gönderim tarihi"
                  active={sortKey === "sentAt"}
                  onClick={() => toggleSort("sentAt")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur text-zinc-500 font-medium text-xs uppercase tracking-wider">
                Hata
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 px-4 text-center text-sm text-zinc-500"
                >
                  Log bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                >
                  <TableCell className="h-16 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-full text-xs font-medium",
                            row.avatarColor
                          )}
                        >
                          {initials(row.customer)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-950 truncate">
                          {row.customer}
                        </div>
                        <div className="text-sm text-zinc-500 truncate">
                          {row.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        scenarioBadgeClass[row.scenario]
                      )}
                    >
                      {SCENARIOS[row.scenario].name}
                    </Badge>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700 max-w-sm">
                    <span title={row.message}>{truncate(row.message)}</span>
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusBadgeClass[row.status]
                      )}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-500">
                    {row.sentAt}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm">
                    {row.error ? (
                      <span className="text-red-600">{row.error}</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
          <p className="text-sm text-zinc-500">
            {showingFrom}-{showingTo} arası {TOTAL_DEMO_ROWS} kayıt gösteriliyor
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg gap-1 border-zinc-200"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
              </PaginationItem>
              {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => i + 1).map(
                (n) => (
                  <PaginationItem key={n}>
                    <Button
                      variant={page === n ? "outline" : "ghost"}
                      size="icon-sm"
                      className={cn(
                        "size-8 rounded-lg",
                        page === n && "border-zinc-200 bg-white"
                      )}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </Button>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg gap-1 border-zinc-200"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}
