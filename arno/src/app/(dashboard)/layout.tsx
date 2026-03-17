"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToastProvider } from "@/components/shared/toast";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vehicles": "Inventaire",
  "/vehicles/new": "Nouveau véhicule",
  "/reports": "Rapports",
  "/settings": "Paramètres",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.endsWith("/edit")) return "Modifier le véhicule";
  if (pathname.startsWith("/vehicles/")) return "Détail véhicule";
  return "Arno";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pageTitle = getPageTitle(pathname);

  useEffect(() => setMounted(true), []);

  return (
    <ToastProvider>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar — client-only to avoid base-ui hydration mismatch */}
      {mounted && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden fixed top-3.5 left-3 z-40"
              >
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="left" showCloseButton={false} className="w-[260px] p-0">
            <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white/80 px-8 backdrop-blur-sm">
          {/* Spacer for mobile menu button */}
          <div className="flex items-center gap-4">
            <div className="w-8 lg:hidden" />
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

        {/* Page content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
    </ToastProvider>
  );
}
