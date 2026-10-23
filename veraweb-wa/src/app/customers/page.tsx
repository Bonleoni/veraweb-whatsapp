"use client"

import { useMemo, useState } from "react"
import {
  Search,
  ChevronDown,
  Upload,
  Plus,
  ChevronsUpDown,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
import { cn } from "@/lib/utils"

type CustomerStatus = "Aktif" | "Pasif" | "Yeni"
type SortKey = "name" | "email" | "lastLesson" | "status" | "totalLessons"

type Customer = {
  id: string
  name: string
  phone: string
  email: string
  lastLesson: string
  lastLessonRank: number
  status: CustomerStatus
  totalLessons: number
  avatarColor: string
}

const CUSTOMERS: Customer[] = [
  {
    id: "1",
    name: "Ayşe Yılmaz",
    phone: "+90 532 111 22 33",
    email: "ayse@email.com",
    lastLesson: "2 gün önce",
    lastLessonRank: 3,
    status: "Aktif",
    totalLessons: 24,
    avatarColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "2",
    name: "Mehmet Demir",
    phone: "+90 533 222 33 44",
    email: "mehmet@email.com",
    lastLesson: "1 hafta önce",
    lastLessonRank: 6,
    status: "Aktif",
    totalLessons: 18,
    avatarColor: "bg-sky-100 text-sky-700",
  },
  {
    id: "3",
    name: "Canan Yıldız",
    phone: "+90 534 333 44 55",
    email: "canan@email.com",
    lastLesson: "3 gün önce",
    lastLessonRank: 4,
    status: "Yeni",
    totalLessons: 2,
    avatarColor: "bg-rose-100 text-rose-700",
  },
  {
    id: "4",
    name: "Ali Kaya",
    phone: "+90 535 444 55 66",
    email: "ali@email.com",
    lastLesson: "2 hafta önce",
    lastLessonRank: 7,
    status: "Pasif",
    totalLessons: 12,
    avatarColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "5",
    name: "Zeynep Şahin",
    phone: "+90 536 555 66 77",
    email: "zeynep@email.com",
    lastLesson: "1 gün önce",
    lastLessonRank: 2,
    status: "Aktif",
    totalLessons: 36,
    avatarColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "6",
    name: "Burak Özkan",
    phone: "+90 537 666 77 88",
    email: "burak@email.com",
    lastLesson: "5 gün önce",
    lastLessonRank: 5,
    status: "Aktif",
    totalLessons: 8,
    avatarColor: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "7",
    name: "Elif Kara",
    phone: "+90 538 777 88 99",
    email: "elif@email.com",
    lastLesson: "1 ay önce",
    lastLessonRank: 8,
    status: "Pasif",
    totalLessons: 45,
    avatarColor: "bg-fuchsia-100 text-fuchsia-700",
  },
  {
    id: "8",
    name: "Emre Çelik",
    phone: "+90 539 888 99 00",
    email: "emre@email.com",
    lastLesson: "Bugün",
    lastLessonRank: 1,
    status: "Yeni",
    totalLessons: 1,
    avatarColor: "bg-teal-100 text-teal-700",
  },
]

const statusBadgeClass: Record<CustomerStatus, string> = {
  Aktif: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pasif: "bg-zinc-50 text-zinc-700 border-zinc-200",
  Yeni: "bg-blue-50 text-blue-700 border-blue-200",
}

const STATUS_OPTIONS: CustomerStatus[] = ["Aktif", "Pasif", "Yeni"]
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

export default function CustomersPage() {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilters, setRoleFilters] = useState<CustomerStatus[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = CUSTOMERS.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      const matchesSelect =
        statusFilter === "all" || c.status === statusFilter
      const matchesDropdown =
        roleFilters.length === 0 || roleFilters.includes(c.status)
      return matchesQuery && matchesSelect && matchesDropdown
    })

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const dir = sortAsc ? 1 : -1
        if (sortKey === "lastLesson") {
          return (a.lastLessonRank - b.lastLessonRank) * dir
        }
        if (sortKey === "totalLessons") {
          return (a.totalLessons - b.totalLessons) * dir
        }
        if (sortKey === "name") {
          return a.name.localeCompare(b.name, "tr") * dir
        }
        if (sortKey === "email") {
          return a.email.localeCompare(b.email, "tr") * dir
        }
        return a.status.localeCompare(b.status, "tr") * dir
      })
    }

    return rows
  }, [query, statusFilter, roleFilters, sortKey, sortAsc])

  const pageCount = Math.max(1, Math.ceil(TOTAL_DEMO_ROWS / PAGE_SIZE))
  const visibleIds = filtered.map((c) => c.id)
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected =
    visibleIds.some((id) => selected.has(id)) && !allSelected

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

  function toggleStatusFilter(status: CustomerStatus) {
    setRoleFilters((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
    setPage(1)
  }

  const showingFrom = (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, TOTAL_DEMO_ROWS)

  return (
    <div className="font-sans space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Müşteriler
            </h1>
            <span className="rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">
              {CUSTOMERS.length}
            </span>
          </div>
          <p className="text-zinc-500 text-sm">
            Pilates stüdyosu müşterilerinizi yönetin.
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
              placeholder="Müşteri ara..."
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
              <SelectItem value="Aktif">Aktif</SelectItem>
              <SelectItem value="Pasif">Pasif</SelectItem>
              <SelectItem value="Yeni">Yeni</SelectItem>
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Durum</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={roleFilters.includes(status)}
                  onCheckedChange={() => toggleStatusFilter(status)}
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
            <Upload className="size-4" />
            Import
          </Button>

          <Button className="h-8 rounded-lg gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800">
            <Plus className="size-4" />
            Yeni müşteri
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
                  active={sortKey === "name"}
                  onClick={() => toggleSort("name")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Email"
                  active={sortKey === "email"}
                  onClick={() => toggleSort("email")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Son ders"
                  active={sortKey === "lastLesson"}
                  onClick={() => toggleSort("lastLesson")}
                />
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
                  label="Toplam ders"
                  active={sortKey === "totalLessons"}
                  onClick={() => toggleSort("totalLessons")}
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
                  Müşteri bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="group border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                  data-state={
                    selected.has(customer.id) ? "selected" : undefined
                  }
                >
                  <TableCell className="h-16 px-4">
                    <Checkbox
                      checked={selected.has(customer.id)}
                      onCheckedChange={(checked) =>
                        toggleOne(customer.id, checked === true)
                      }
                      aria-label={`${customer.name} seç`}
                    />
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-full text-xs font-medium",
                            customer.avatarColor
                          )}
                        >
                          {initials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-950 truncate">
                          {customer.name}
                        </div>
                        <div className="text-sm text-zinc-500 truncate">
                          {customer.phone}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {customer.email}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {customer.lastLesson}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusBadgeClass[customer.status]
                      )}
                    >
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {customer.totalLessons} ders
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-500 hover:text-zinc-950"
                        aria-label="Düzenle"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-500 hover:text-red-600"
                        aria-label="Sil"
                      >
                        <Trash2 className="size-4" />
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
