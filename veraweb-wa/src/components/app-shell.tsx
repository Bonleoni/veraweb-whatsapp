'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Users,
  CheckCircle,
  Settings,
  ScrollText,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  ChevronDown,
  ChevronRight,
  Inbox,
  Clock,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const conversationFilters = [
  {
    filter: 'open',
    label: 'Açık',
    icon: Inbox,
    activeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    filter: 'snoozed',
    label: 'Ertelenen',
    icon: Clock,
    activeClass: 'bg-amber-100 text-amber-700',
  },
  {
    filter: 'done',
    label: 'Tamamlanan',
    icon: CheckCircle,
    activeClass: 'bg-zinc-100 text-zinc-700',
  },
] as const

const simpleNavItems = [
  { href: '/', label: 'Onay Kuyruğu', icon: CheckCircle },
  { href: '/customers', label: 'Müşteriler', icon: Users },
  { href: '/leads', label: 'Adaylar', icon: Target },
  { href: '/logs', label: 'Loglar', icon: ScrollText },
  { href: '/bot-settings', label: 'Bot Ayarları', icon: Settings },
]

function AppShellNav({ sidebarOpen }: { sidebarOpen: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  useEffect(() => {
    if (pathname === '/conversations') {
      setExpandedMenus((prev) =>
        prev.includes('conversations') ? prev : [...prev, 'conversations']
      )
    }
  }, [pathname])

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    )
  }

  const isConversationsActive = pathname === '/conversations'
  const currentFilter = searchParams.get('filter')

  const isConversationFilterActive = (filter: string) => {
    if (!isConversationsActive) return false
    if (filter === 'open') return currentFilter === 'open' || !currentFilter
    return currentFilter === filter
  }

  const isSimpleActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav
      className={cn(
        'flex flex-col gap-1 pb-4',
        sidebarOpen ? 'px-3' : 'items-center px-2'
      )}
    >
      {simpleNavItems.slice(0, 3).map((item) => {
        const Icon = item.icon
        const active = isSimpleActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'flex items-center rounded-md text-sm transition-colors',
              active
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
              sidebarOpen ? 'gap-3 px-3 py-2' : 'size-9 justify-center'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {sidebarOpen && <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}

      <div className={cn('w-full', !sidebarOpen && 'flex justify-center')}>
        {sidebarOpen ? (
          <>
            <button
              type="button"
              onClick={() => toggleMenu('conversations')}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isConversationsActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              )}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="size-4 shrink-0" />
                <span className="truncate">Mesajlaşma</span>
              </div>
              {expandedMenus.includes('conversations') ? (
                <ChevronDown className="size-4 shrink-0" />
              ) : (
                <ChevronRight className="size-4 shrink-0" />
              )}
            </button>

            {expandedMenus.includes('conversations') && (
              <div className="mt-1 ml-4 space-y-0.5 border-l border-zinc-200 pl-2">
                {conversationFilters.map((item) => {
                  const Icon = item.icon
                  const active = isConversationFilterActive(item.filter)
                  return (
                    <Link
                      key={item.filter}
                      href={`/conversations?filter=${item.filter}`}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                        active
                          ? item.activeClass
                          : 'text-zinc-600 hover:bg-zinc-50'
                      )}
                    >
                      <Icon className="size-3 shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <Link
            href="/conversations?filter=open"
            title="Mesajlaşma"
            className={cn(
              'flex size-9 items-center justify-center rounded-md transition-colors',
              isConversationsActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            )}
          >
            <MessageSquare className="size-4 shrink-0" />
          </Link>
        )}
      </div>

      {simpleNavItems.slice(3).map((item) => {
        const Icon = item.icon
        const active = isSimpleActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              'flex items-center rounded-md text-sm transition-colors',
              active
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
              sidebarOpen ? 'gap-3 px-3 py-2' : 'size-9 justify-center'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {sidebarOpen && <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-linear',
          sidebarOpen ? 'w-48' : 'w-16'
        )}
      >
        <div
          className={cn(
            'flex h-12 items-center border-b border-zinc-200',
            sidebarOpen ? 'justify-between gap-2 px-3' : 'justify-center px-2'
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

        <Suspense fallback={null}>
          <AppShellNav sidebarOpen={sidebarOpen} />
        </Suspense>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end gap-3 border-b border-zinc-200 bg-white px-4">
          <Avatar size="sm">
            <AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-700">
              AD
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-zinc-950">Admin</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-zinc-50/50 p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
