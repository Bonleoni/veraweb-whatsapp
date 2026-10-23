"use client"

import { useMemo, useState } from "react"
import {
  Search,
  Calendar,
  Download,
  Plus,
  List,
  LayoutGrid,
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
  DropdownMenuContent,
  DropdownMenuItem,
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

type Status = "Pending" | "Approved" | "Rejected"
type SortKey = "customer" | "messageType" | "status" | "created"
type SortDir = "asc" | "desc" | null
type ViewMode = "list" | "grid"

type Row = {
  id: string
  customer: string
  messageType: string
  status: Status
  created: string
  createdRank: number
  avatarColor: string
}

const DATA: Row[] = [
  {
    id: "1",
    customer: "Ayşe Yılmaz",
    messageType: "First Lesson Follow-up",
    status: "Pending",
    created: "2 minutes ago",
    createdRank: 1,
    avatarColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "2",
    customer: "Mehmet Demir",
    messageType: "Class Reminder",
    status: "Approved",
    created: "1 hour ago",
    createdRank: 2,
    avatarColor: "bg-sky-100 text-sky-700",
  },
  {
    id: "3",
    customer: "Canan Yıldız",
    messageType: "Absence Warning",
    status: "Pending",
    created: "3 hours ago",
    createdRank: 3,
    avatarColor: "bg-rose-100 text-rose-700",
  },
  {
    id: "4",
    customer: "Ali Kaya",
    messageType: "Campaign Message",
    status: "Approved",
    created: "Yesterday",
    createdRank: 4,
    avatarColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "5",
    customer: "Zeynep Şahin",
    messageType: "Class Reminder",
    status: "Rejected",
    created: "Yesterday",
    createdRank: 5,
    avatarColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "6",
    customer: "Burak Özkan",
    messageType: "First Lesson Follow-up",
    status: "Pending",
    created: "Yesterday",
    createdRank: 6,
    avatarColor: "bg-indigo-100 text-indigo-700",
  },
]

const statusBadgeClass: Record<Status, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
}

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
      className="inline-flex items-center gap-1.5 text-zinc-500 font-medium text-xs uppercase tracking-wider hover:text-zinc-900"
    >
      {label}
      <ChevronsUpDown
        className={cn(
          "size-3.5 text-zinc-300 transition-colors group-hover/th:text-zinc-500",
          active && "text-zinc-700"
        )}
      />
    </button>
  )
}

export default function Home() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [view, setView] = useState<ViewMode>("list")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let rows = DATA.filter((row) => {
      const matchesQuery = row.customer
        .toLowerCase()
        .includes(query.trim().toLowerCase())
      const matchesStatus = status === "all" || row.status === status
      return matchesQuery && matchesStatus
    })

    if (sortKey && sortDir) {
      rows = [...rows].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1
        if (sortKey === "created") {
          return (a.createdRank - b.createdRank) * dir
        }
        return a[sortKey].localeCompare(b[sortKey], "tr") * dir
      })
    }

    return rows
  }, [query, status, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(TOTAL_DEMO_ROWS / PAGE_SIZE))
  const visibleIds = filtered.map((row) => row.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected =
    visibleIds.some((id) => selected.has(id)) && !allVisibleSelected

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
      return
    }
    if (sortDir === "asc") {
      setSortDir("desc")
      return
    }
    setSortKey(null)
    setSortDir(null)
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        visibleIds.forEach((id) => next.add(id))
      } else {
        visibleIds.forEach((id) => next.delete(id))
      }
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

  const showingFrom = (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, TOTAL_DEMO_ROWS)

  return (
    <div className="font-sans space-y-6">
      <div>
        <h1 className="text-2xl text-zinc-950 font-semibold tracking-tight">
          Onay Kuyruğu
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gönderim bekleyen WhatsApp mesaj taslaklarını yönetin.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-4">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected}
              onCheckedChange={(checked) => toggleAll(checked === true)}
              aria-label="Select all"
            />
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Filter customers..."
                className="h-8 w-64 rounded-lg border-zinc-200 pl-8"
              />
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => {
                if (value != null) {
                  setStatus(String(value))
                  setPage(1)
                }
              }}
            >
              <SelectTrigger className="h-8 min-w-36 rounded-lg border-zinc-200">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-8 rounded-lg gap-1.5 border-zinc-200"
            >
              <Calendar className="size-4" />
              Date range
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-8 rounded-lg gap-1.5 border-zinc-200"
                  />
                }
              >
                {view === "list" ? (
                  <List className="size-4" />
                ) : (
                  <LayoutGrid className="size-4" />
                )}
                View
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-36">
                <DropdownMenuItem onClick={() => setView("list")}>
                  <List className="size-4" />
                  List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("grid")}>
                  <LayoutGrid className="size-4" />
                  Grid
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              className="h-8 rounded-lg gap-1.5 border-zinc-200"
            >
              <Download className="size-4" />
              Export
            </Button>

            <Button className="h-8 rounded-lg gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800">
              <Plus className="size-4" />
              Add message
            </Button>
          </div>
        </div>

        <Table className="w-full caption-top">
          <TableHeader>
            <TableRow className="border-b border-zinc-100 hover:bg-transparent">
              <TableHead className="group/th h-12 w-12 px-4 bg-zinc-50/80 backdrop-blur">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead className="group/th h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Customer"
                  active={sortKey === "customer"}
                  onClick={() => toggleSort("customer")}
                />
              </TableHead>
              <TableHead className="group/th h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Message Type"
                  active={sortKey === "messageType"}
                  onClick={() => toggleSort("messageType")}
                />
              </TableHead>
              <TableHead className="group/th h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Status"
                  active={sortKey === "status"}
                  onClick={() => toggleSort("status")}
                />
              </TableHead>
              <TableHead className="group/th h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Created"
                  active={sortKey === "created"}
                  onClick={() => toggleSort("created")}
                />
              </TableHead>
              <TableHead className="group/th h-12 px-4 text-right text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/80 backdrop-blur">
                Actions
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
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="group border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors"
                  data-state={selected.has(row.id) ? "selected" : undefined}
                >
                  <TableCell className="h-16 px-4">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={(checked) =>
                        toggleOne(row.id, checked === true)
                      }
                      aria-label={`Select ${row.customer}`}
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
                      <span className="font-medium text-zinc-950">
                        {row.customer}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-zinc-600">
                    {row.messageType}
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
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-500 hover:text-zinc-950"
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-500 hover:text-red-600"
                        aria-label="Delete"
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
            Showing {showingFrom}-{showingTo} of {TOTAL_DEMO_ROWS} rows
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
