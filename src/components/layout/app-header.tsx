"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";

type AppHeaderProps = {
  title: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-[var(--brand-navy)] px-4 text-white">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Menüyü aç"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64 max-w-none gap-0 p-0 sm:max-w-none"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menü</SheetTitle>
          </SheetHeader>
          <AppSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
          {title}
        </h1>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="rounded-full bg-primary/20 px-2.5 py-1 text-xs font-medium text-emerald-300">
          Pilates
        </span>
      </div>
    </header>
  );
}
