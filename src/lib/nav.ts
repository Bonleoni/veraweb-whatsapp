import {
  LayoutDashboard,
  MessageSquareCheck,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Onay Kuyruğu", href: "/onay-kuyrugu", icon: MessageSquareCheck },
  { title: "Müşteriler", href: "/musteriler", icon: Users },
  { title: "Ayarlar", href: "/ayarlar", icon: Settings },
];
