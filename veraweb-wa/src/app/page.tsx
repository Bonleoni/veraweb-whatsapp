"use client"

import {
  Search,
  ChevronDown,
  Check,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const rows = [
  {
    customer: "Ayşe Yılmaz",
    message: "İlk Ders Takip",
    status: "Bekliyor" as const,
    time: "10 dk önce",
  },
  {
    customer: "Mehmet Demir",
    message: "Ders Hatırlatma",
    status: "Onaylandı" as const,
    time: "1 saat önce",
  },
  {
    customer: "Canan Yıldız",
    message: "Devamsızlık",
    status: "Bekliyor" as const,
    time: "2 saat önce",
  },
]

const statusBadgeClass: Record<(typeof rows)[number]["status"], string> = {
  Bekliyor:
    "inline-flex items-center border bg-yellow-50 text-yellow-700 border-yellow-200 rounded-full px-2.5 py-0.5 text-xs font-medium",
  Onaylandı:
    "inline-flex items-center border bg-green-50 text-green-700 border-green-200 rounded-full px-2.5 py-0.5 text-xs font-medium",
}

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
        Onay Kuyruğu
      </h1>
      <p className="text-zinc-500 text-sm mb-6">
        Gönderim bekleyen WhatsApp mesaj taslaklarını yönetin.
      </p>

      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex justify-between items-center gap-4">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="w-64 pl-8 rounded-lg border-zinc-200"
              placeholder="Müşteri ara..."
            />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="rounded-lg gap-1.5" />
                }
              >
                Filtrele
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem>Tümü</DropdownMenuItem>
                <DropdownMenuItem>Bekliyor</DropdownMenuItem>
                <DropdownMenuItem>Onaylandı</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button className="rounded-lg bg-zinc-950 text-white hover:bg-zinc-800">
              Yeni Mesaj
            </Button>
          </div>
        </div>

        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b border-zinc-100 hover:bg-transparent">
              <TableHead className="px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/50">
                Müşteri
              </TableHead>
              <TableHead className="px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/50">
                Mesaj
              </TableHead>
              <TableHead className="px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/50">
                Durum
              </TableHead>
              <TableHead className="px-4 text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/50">
                Zaman
              </TableHead>
              <TableHead className="px-4 text-right text-zinc-500 font-medium text-xs uppercase tracking-wider bg-zinc-50/50">
                İşlem
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={`${row.customer}-${row.message}`}
                className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
              >
                <TableCell className="px-4 py-3 font-medium text-zinc-950">
                  {row.customer}
                </TableCell>
                <TableCell className="px-4 py-3 text-zinc-600">
                  {row.message}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className={statusBadgeClass[row.status]}>
                    {row.status}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-zinc-500 text-sm">
                  {row.time}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      aria-label="Onayla"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      aria-label="Reddet"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
