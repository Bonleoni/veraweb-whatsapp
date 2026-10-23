import Link from "next/link"
import { Users, CheckCircle, Settings, ScrollText } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const navItems = [
  { href: "/", label: "Onay Kuyruğu", icon: CheckCircle },
  { href: "/customers", label: "Müşteriler", icon: Users },
  { href: "/logs", label: "Loglar", icon: ScrollText },
  { href: "/bot-settings", label: "Bot Ayarları", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="p-4 text-zinc-950 font-semibold tracking-tight">
          MyVera WA
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 rounded-md"
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-zinc-200 bg-white px-6">
          <Avatar size="sm">
            <AvatarFallback className="bg-zinc-100 text-zinc-700 text-xs font-medium">
              AD
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-zinc-950">Admin</span>
        </header>
        <main className="min-h-screen flex-1 bg-zinc-50/50 p-8">{children}</main>
      </div>
    </div>
  )
}
