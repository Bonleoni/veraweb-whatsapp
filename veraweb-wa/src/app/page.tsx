"use client"

import { useMemo, useState } from "react"
import {
  Search,
  ChevronDown,
  Upload,
  Plus,
  ChevronsUpDown,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type BillingStatus =
  | "Past due"
  | "Pending invoice"
  | "Active"
  | "Manual review"

type Member = {
  id: string
  name: string
  handle: string
  email: string
  role: string
  billing: BillingStatus
  auth: string
  joined: string
  joinedRank: number
  avatar: string
}

type SortKey =
  | "name"
  | "email"
  | "role"
  | "billing"
  | "auth"
  | "joined"

const MEMBERS: Member[] = [
  {
    id: "1",
    name: "Avery Quinn",
    handle: "avery",
    email: "avery.quinn@northline.app",
    role: "Security",
    billing: "Past due",
    auth: "Okta SSO",
    joined: "Feb 10, 2026",
    joinedRank: 3,
    avatar: "https://i.pravatar.cc/150?img=1",
  },
  {
    id: "2",
    name: "Dev Rana",
    handle: "dev",
    email: "dev.rana@northline.app",
    role: "Growth",
    billing: "Pending invoice",
    auth: "GitHub",
    joined: "Jan 11, 2026",
    joinedRank: 1,
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "3",
    name: "Imani Brooks",
    handle: "imani",
    email: "imani.brooks@northline.app",
    role: "Support",
    billing: "Active",
    auth: "Passwordless",
    joined: "Mar 29, 2026",
    joinedRank: 6,
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    id: "4",
    name: "Lena Torres",
    handle: "lena",
    email: "lena.torres@northline.app",
    role: "Admin",
    billing: "Active",
    auth: "Google",
    joined: "Apr 17, 2026",
    joinedRank: 8,
    avatar: "https://i.pravatar.cc/150?img=9",
  },
  {
    id: "5",
    name: "Marcus Hale",
    handle: "marcus",
    email: "marcus.hale@northline.app",
    role: "Finance",
    billing: "Pending invoice",
    auth: "Okta SSO",
    joined: "Apr 12, 2026",
    joinedRank: 7,
    avatar: "https://i.pravatar.cc/150?img=15",
  },
  {
    id: "6",
    name: "Noor Hadid",
    handle: "noor",
    email: "noor.hadid@northline.app",
    role: "Product",
    billing: "Active",
    auth: "Google",
    joined: "Feb 27, 2026",
    joinedRank: 4,
    avatar: "https://i.pravatar.cc/150?img=20",
  },
  {
    id: "7",
    name: "Sofia Lane",
    handle: "sofia",
    email: "sofia.lane@northline.app",
    role: "Finance",
    billing: "Active",
    auth: "Google",
    joined: "Jan 23, 2026",
    joinedRank: 2,
    avatar: "https://i.pravatar.cc/150?img=32",
  },
  {
    id: "8",
    name: "Theo Mercer",
    handle: "theo",
    email: "theo.mercer@northline.app",
    role: "Operations",
    billing: "Manual review",
    auth: "GitHub",
    joined: "Mar 18, 2026",
    joinedRank: 5,
    avatar: "https://i.pravatar.cc/150?img=33",
  },
]

const billingDot: Record<BillingStatus, string> = {
  "Past due": "bg-red-500",
  "Pending invoice": "bg-blue-500",
  Active: "bg-emerald-500",
  "Manual review": "bg-amber-500",
}

const ROLES = [
  "Security",
  "Growth",
  "Support",
  "Admin",
  "Finance",
  "Product",
  "Operations",
] as const

const BILLING_FILTERS: BillingStatus[] = [
  "Past due",
  "Pending invoice",
  "Active",
  "Manual review",
]

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

function BillingCell({ status }: { status: BillingStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-700">
      <span
        className={cn("size-1.5 shrink-0 rounded-full", billingDot[status])}
        aria-hidden
      />
      {status}
    </div>
  )
}

export default function Home() {
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [roleFilters, setRoleFilters] = useState<string[]>([])
  const [billingFilters, setBillingFilters] = useState<BillingStatus[]>([])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = MEMBERS.filter((m) => {
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.handle.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      const matchesRole =
        roleFilters.length === 0 || roleFilters.includes(m.role)
      const matchesBilling =
        billingFilters.length === 0 || billingFilters.includes(m.billing)
      return matchesQuery && matchesRole && matchesBilling
    })

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const dir = sortAsc ? 1 : -1
        if (sortKey === "joined") {
          return (a.joinedRank - b.joinedRank) * dir
        }
        if (sortKey === "name") {
          return a.name.localeCompare(b.name) * dir
        }
        if (sortKey === "email") {
          return a.email.localeCompare(b.email) * dir
        }
        if (sortKey === "role") {
          return a.role.localeCompare(b.role) * dir
        }
        if (sortKey === "billing") {
          return a.billing.localeCompare(b.billing) * dir
        }
        return a.auth.localeCompare(b.auth) * dir
      })
    }

    return rows
  }, [query, sortKey, sortAsc, roleFilters, billingFilters])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
      return
    }
    setSortKey(key)
    setSortAsc(true)
  }

  function toggleRole(role: string) {
    setRoleFilters((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  function toggleBilling(status: BillingStatus) {
    setBillingFilters((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
  }

  return (
    <div className="font-sans space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Members
            </h1>
            <span className="rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">
              8
            </span>
          </div>
          <p className="text-zinc-500 text-sm">
            Manage your team members and their account permissions here.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 py-1">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members..."
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Role</DropdownMenuLabel>
              {ROLES.map((role) => (
                <DropdownMenuCheckboxItem
                  key={role}
                  checked={roleFilters.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                >
                  {role}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Billing status</DropdownMenuLabel>
              {BILLING_FILTERS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={billingFilters.includes(status)}
                  onCheckedChange={() => toggleBilling(status)}
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
            Add member
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-zinc-200 hover:bg-transparent">
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Member"
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
                  label="Role"
                  active={sortKey === "role"}
                  onClick={() => toggleSort("role")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Billing status"
                  active={sortKey === "billing"}
                  onClick={() => toggleSort("billing")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Authentication"
                  active={sortKey === "auth"}
                  onClick={() => toggleSort("auth")}
                />
              </TableHead>
              <TableHead className="h-12 px-4 text-left bg-zinc-50/80 backdrop-blur">
                <SortableHead
                  label="Joining date"
                  active={sortKey === "joined"}
                  onClick={() => toggleSort("joined")}
                />
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
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((member) => (
                <TableRow
                  key={member.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                >
                  <TableCell className="h-16 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback className="bg-zinc-100 text-zinc-600 text-xs font-medium">
                          {member.name
                            .split(" ")
                            .map((p) => p[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-950 truncate">
                          {member.name}
                        </div>
                        <div className="text-sm text-zinc-500 truncate">
                          {member.handle}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {member.email}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {member.role}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <BillingCell status={member.billing} />
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {member.auth}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-zinc-700">
                    {member.joined}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
