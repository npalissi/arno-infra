"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutGrid,
  TrendingUp,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/vehicles", label: "Véhicules", icon: LayoutGrid },
  { href: "/cote", label: "Cote", icon: TrendingUp },
  { href: "/reports", label: "Rapports", icon: BarChart3 },
];

const systemNavItems = [
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-border px-4 py-6">
      {/* Brand */}
      <div className="mb-10 flex items-center gap-3 px-2">
        <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#1A1A1A] text-white text-[14px] font-bold tracking-tight">
          A
        </div>
        <span className="text-[18px] font-bold tracking-tight">Arno</span>
      </div>

      {/* Main nav */}
      <div className="mb-8">
        <p className="mb-3 px-2 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          Principal
        </p>
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                  active
                    ? "bg-white text-foreground font-semibold shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[4px] bg-brand" />
                )}
                <item.icon
                  className={cn(
                    "size-[18px] shrink-0",
                    active ? "text-brand" : ""
                  )}
                  strokeWidth={2}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* System nav */}
      <div>
        <p className="mb-3 px-2 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          Système
        </p>
        <nav className="space-y-1">
          {systemNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                  active
                    ? "bg-white text-foreground font-semibold shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[4px] bg-brand" />
                )}
                <item.icon
                  className={cn(
                    "size-[18px] shrink-0",
                    active ? "text-brand" : ""
                  )}
                  strokeWidth={2}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
