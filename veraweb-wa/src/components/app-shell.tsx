import Link from "next/link"
import {
  Users,
  CheckCircle,
  Settings,
  ScrollText,
  MessageSquare,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const navItems = [
  { href: "/", label: "Onay Kuyruğu", icon: CheckCircle },
  { href: "/customers", label: "Müşteriler", icon: Users },
  { href: "/conversations", label: "Mesajlaşma", icon: MessageSquare },
  { href: "/logs", label: "Loglar", icon: ScrollText },
  { href: "/bot-settings", label: "Bot Ayarları", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="p-4 font-semibold tracking-tight text-zinc-950">
          MyVera WA
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-zinc-200 bg-white px-6">
          <Avatar size="sm">
            <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-700">
              AD
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-zinc-950">Admin</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/50 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
