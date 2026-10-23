"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { navItems } from "@/lib/nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current =
    navItems.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    )?.title ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="hidden md:block">
        <div className="fixed inset-y-0 left-0 z-30">
          <AppSidebar />
        </div>
      </div>

      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        <AppHeader title={current} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
