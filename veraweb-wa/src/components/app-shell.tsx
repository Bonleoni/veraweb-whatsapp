'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users,
  CheckCircle,
  Settings,
  ScrollText,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Onay Kuyruğu', icon: CheckCircle },
  { href: '/customers', label: 'Müşteriler', icon: Users },
  { href: '/conversations', label: 'Mesajlaşma', icon: MessageSquare },
  { href: '/logs', label: 'Loglar', icon: ScrollText },
  { href: '/bot-settings', label: 'Bot Ayarları', icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-linear',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-zinc-200',
            sidebarOpen ? 'justify-between gap-2 px-4' : 'justify-center px-2'
          )}
        >
          {sidebarOpen && (
            <span className="truncate font-semibold tracking-tight text-zinc-950">
              MyVera WA
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-zinc-500 hover:text-zinc-900"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Menüyü daralt' : 'Menüyü genişlet'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
        </div>

        <nav
          className={cn(
            'flex flex-col gap-1 pb-4',
            sidebarOpen ? 'px-3' : 'items-center px-2'
          )}
        >
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  'flex items-center rounded-md text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900',
                  sidebarOpen
                    ? 'gap-3 px-3 py-2'
                    : 'size-9 justify-center'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
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
