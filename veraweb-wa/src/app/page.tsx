"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Search,
  ChevronDown,
  Plus,
  ChevronsUpDown,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type QueueStatus = "Bekliyor" | "Onaylandı" | "Reddedildi"

type QueueRow = {
  id: string
  customer: string
  phone: string
  scenario: ScenarioType
  message: string
  status: QueueStatus
  created: string
  createdRank: number
  avatarColor: string
}

type SortKey = "customer" | "scenario" | "status" | "created"

const INITIAL_ROWS: QueueRow[] = [
  {
    id: "1",
    customer: "Ayşe Yılmaz",
    phone: "+90 532 111 22 33",
    scenario: "REMINDER",
    message: SCENARIOS.REMINDER.template("Ayşe Yılmaz", "14:00"),
    status: "Bekliyor",
    created: "2 dakika önce",
    createdRank: 1,
    avatarColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "2",
    customer: "Mehmet Demir",
    phone: "+90 533 222 33 44",
    scenario: "FOLLOW_UP",
    message: SCENARIOS.FOLLOW_UP.template("Mehmet Demir"),
    status: "Bekliyor",
    created: "10 dakika önce",
    createdRank: 2,
    avatarColor: "bg-sky-100 text-sky-700",
  },
  {
    id: "3",
    customer: "Canan Yıldız",
    phone: "+90 534 333 44 55",
    scenario: "ABSENCE",
    message: SCENARIOS.ABSENCE.template("Canan Yıldız"),
    status: "Onaylandı",
    created: "1 saat önce",
    createdRank: 3,
    avatarColor: "bg-rose-100 text-rose-700",
  },
  {
    id: "4",
    customer: "Ali Kaya",
    phone: "+90 535 444 55 66",
    scenario: "REMINDER",
    message: SCENARIOS.REMINDER.template("Ali Kaya", "10:30"),
    status: "Reddedildi",
    created: "3 saat önce",
    createdRank: 4,
    avatarColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "5",
    customer: "Zeynep Şahin",
    phone: "+90 536 555 66 77",
    scenario: "FOLLOW_UP",
    message: SCENARIOS.FOLLOW_UP.template("Zeynep Şahin"),
    status: "Bekliyor",
    created: "5 saat önce",
    createdRank: 5,
    avatarColor: "bg-emerald-100 text-emerald-700",
  },
]

const statusBadgeClass: Record<QueueStatus, string> = {
  Bekliyor: "bg-amber-50 text-amber-700 border-amber-200",
  Onaylandı: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Reddedildi: "bg-red-50 text-red-700 border-red-200",
}

const scenarioBadgeClass: Record<ScenarioType, string> = {
  REMINDER: "bg-violet-50 text-violet-700 border-violet-200",
  FOLLOW_UP: "bg-sky-50 text-sky-700 border-sky-200",
  ABSENCE: "bg-orange-50 text-orange-700 border-orange-200",
}

const STATUS_OPTIONS: QueueStatus[] = ["Bekliyor", "Onaylandı", "Reddedildi"]
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

function truncate(text: string, max = 50) {
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

export default function ApprovalQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>(INITIAL_ROWS)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [scenarioFilters, setScenarioFilters] = useState<ScenarioType[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [checking, setChecking] = useState(false)
  const [actionLoading, setActionLoading] = useState<{
    id: string
    type: "approve" | "reject"
  } | null>(null)

  async function loadMessagesFromSupabase() {
    try {
      const res = await fetch("/api/messages")
      const data = await res.json()
      if (
        res.ok &&
        data.success &&
        Array.isArray(data.messages) &&
        data.messages.length > 0
      ) {
        setRows(data.messages as QueueRow[])
        return true
      }
    } catch (error) {
      console.error("Mesajlar yüklenemedi:", error)
    }
    return false
  }

  useEffect(() => {
    void loadMessagesFromSupabase()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let next = rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.customer.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        row.message.toLowerCase().includes(q) ||
        SCENARIOS[row.scenario].name.toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter
      const matchesScenario =
        scenarioFilters.length === 0 ||
        scenarioFilters.includes(row.scenario)
      return matchesQuery && matchesStatus && matchesScenario
    })

    if (sortKey) {
      next = [...next].sort((a, b) => {
        const dir = sortAsc ? 1 : -1
        if (sortKey === "created") {
          return (a.createdRank - b.createdRank) * dir
        }
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

    return next
  }, [rows, query, statusFilter, scenarioFilters, sortKey, sortAsc])

  const pageCount = Math.max(1, Math.ceil(TOTAL_DEMO_ROWS / PAGE_SIZE))
  const visibleIds = filtered.map((r) => r.id)
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected =
    visibleIds.some((id) => selected.has(id)) && !allSelected

  async function handleCheck() {
    setChecking(true)
    try {
      const res = await fetch("/api/scenarios/check", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Senaryo kontrolü başarısız")
        return
      }

      const count = typeof data.count === "number" ? data.count : 3
      toast.success(`${count} mesaj kuyruğa eklendi`)

      const fromDb = await loadMessagesFromSupabase()

      // Supabase boşsa (tablo yoksa) local kuyruğa dummy ekle
      if (!fromDb) {
        const stamped = Date.now()
        setRows((prev) => [
          {
            id: `gen-${stamped}-1`,
            customer: "Ayşe Yılmaz",
            phone: "+90 532 111 22 33",
            scenario: "REMINDER",
            message: SCENARIOS.REMINDER.template("Ayşe Yılmaz", "14:00"),
            status: "Bekliyor",
            created: "Az önce",
            createdRank: 0,
            avatarColor: "bg-violet-100 text-violet-700",
          },
          {
            id: `gen-${stamped}-2`,
            customer: "Mehmet Demir",
            phone: "+90 533 222 33 44",
            scenario: "FOLLOW_UP",
            message: SCENARIOS.FOLLOW_UP.template("Mehmet Demir"),
            status: "Bekliyor",
            created: "Az önce",
            createdRank: 0,
            avatarColor: "bg-sky-100 text-sky-700",
          },
          {
            id: `gen-${stamped}-3`,
            customer: "Canan Yıldız",
            phone: "+90 534 333 44 55",
            scenario: "ABSENCE",
            message: SCENARIOS.ABSENCE.template("Canan Yıldız"),
            status: "Bekliyor",
            created: "Az önce",
            createdRank: 0,
            avatarColor: "bg-rose-100 text-rose-700",
          },
          ...prev,
        ])
      }
    } catch {
      toast.error("Senaryo kontrolü başarısız")
    } finally {
      setChecking(false)
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
      return
    }
    setSortKey(key)
    setSortAsc(true)
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) visibleIds.forEach((id) => next.add(id))
      else visibleIds.forEach((id) => next.delete(id))
      return next
    })
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleApprove(messageId: string) {
    setActionLoading({ id: messageId, type: "approve" })
    try {
      const res = await fetch("/api/messages/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Onaylama başarısız")
        return
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === messageId ? { ...row, status: "Onaylandı" } : row
        )
      )
      toast.success("✓ Mesaj onaylandı")
    } catch {
      toast.error("Onaylama başarısız")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(messageId: string) {
    setActionLoading({ id: messageId, type: "reject" })
    try {
      const res = await fetch("/api/messages/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Reddetme başarısız")
        return
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === messageId ? { ...row, status: "Reddedildi" } : row
        )
      )
      toast.success("✗ Mesaj reddedildi")
    } catch {
      toast.error("Reddetme başarısız")
    } finally {
      setActionLoading(null)
    }
  }

  const showingFrom = (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, TOTAL_DEMO_ROWS)

  return (
    <div className="font-sans space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Onay Kuyruğu
            </h1>
            <span className="rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">
              {rows.filter((r) => r.status === "Bekliyor").length}
            </span>
          </div>
          <p className="text-zinc-500 text-sm">
            Gönderim bekleyen WhatsApp mesaj taslaklarını yönetin.
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
              placeholder="Müşteri veya mesaj ara..."
              className="h-8 w-64 rounded-lg border-zinc-200 pl-8 focus-visible:ring-2 focus-visible:ring-zinc-200"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value != null) {
                setStatusFilter(String(value))
                setPage(1)
              }
            }}
          >
            <SelectTrigger className="h-8 min-w-32 rounded-lg border-zinc-200">
              <SelectValue placeholder="Tüm durumlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Senaryo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(SCENARIOS) as ScenarioType[]).map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={scenarioFilters.includes(key)}
                  onCheckedChange={() => {
                    setScenarioFilters((prev) =>
                      prev.includes(key)
                        ? prev.filter((s) => s !== key)
                        : [...prev, key]
                    )
                    setPage(1)
                  }}
                >
                  {SCENARIOS[key].name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="h-8 rounded-lg gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Kontrol Et
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-zinc-200 hover:bg-transparent">
              <TableHead className="h-12 w-12 px-4 bg-zinc-50/80 backdrop-blur">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Tümünü seç"
                />
              </TableHead>
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
                  label="Oluşturulma"
                  active={sortKey === "created"}
                  onClick={() => toggleSort("created")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-right text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/80 backdrop-blur">
                İşlemler
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 px-4 text-center text-sm text-zinc-500"
                >
                  Kuyrukta mesaj yok.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="group border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                >
                  <TableCell className="h-16 px-4">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={(checked) =>
                        toggleOne(row.id, checked === true)
                      }
                      aria-label={`${row.customer} seç`}
                    />
                  </TableCell>
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
                  <TableCell className="h-16 px-4 text-sm text-zinc-700 max-w-xs">
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
                    {row.created}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        aria-label="Onayla"
                        disabled={
                          row.status !== "Bekliyor" || actionLoading !== null
                        }
                        onClick={() => void handleApprove(row.id)}
                      >
                        {actionLoading?.id === row.id &&
                        actionLoading.type === "approve" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        aria-label="Reddet"
                        disabled={
                          row.status !== "Bekliyor" || actionLoading !== null
                        }
                        onClick={() => void handleReject(row.id)}
                      >
                        {actionLoading?.id === row.id &&
                        actionLoading.type === "reject" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <X className="size-4" />
                        )}
                      </Button>
                    </div>
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
