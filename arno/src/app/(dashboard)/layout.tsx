"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Home, LayoutGrid, TrendingUp, BarChart3, Settings, Plus } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/shared/toast";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vehicles": "Inventaire",
  "/vehicles/new": "Nouveau véhicule",
  "/cote": "Estimation Cote",
  "/reports": "Rapports",
  "/settings": "Paramètres",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.endsWith("/edit")) return "Modifier le véhicule";
  if (pathname.startsWith("/vehicles/")) return "Détail véhicule";
  return "Arno";
}

const bottomNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/vehicles", label: "Véhicules", icon: LayoutGrid },
  { href: "/vehicles/new", label: "Ajouter", icon: Plus, accent: true },
  { href: "/cote", label: "Cote", icon: TrendingUp },
  { href: "/reports", label: "Rapports", icon: BarChart3 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  }

  return (
    <ToastProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white/80 px-4 sm:px-6 lg:px-8 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Mobile brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex size-7 items-center justify-center rounded-[8px] bg-[#1A1A1A] text-white text-[12px] font-bold">A</div>
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-5">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="size-[18px]" strokeWidth={2} />
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand border-2 border-white" />
            </button>
            <div className="size-8 rounded-full bg-gradient-to-br from-muted to-border" />
          </div>
        </header>

        {/* Page content — extra padding-bottom on mobile for bottom nav */}
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-20 sm:px-6 md:pb-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-white/95 px-2 py-2 backdrop-blur-md md:hidden">
        {bottomNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors",
                item.accent
                  ? "text-white"
                  : active
                    ? "text-brand"
                    : "text-muted-foreground"
              )}
            >
              {item.accent ? (
                <div className="flex size-9 items-center justify-center rounded-full bg-brand text-white shadow-md">
                  <item.icon className="size-5" strokeWidth={2} />
                </div>
              ) : (
                <item.icon className="size-5" strokeWidth={2} />
              )}
              <span className={cn(
                "text-[10px] font-semibold",
                item.accent ? "text-brand" : ""
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
    </ToastProvider>
  );
}
