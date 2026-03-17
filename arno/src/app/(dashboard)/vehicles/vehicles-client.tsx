"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Car, LayoutGrid, List, TrendingUp, X, ChevronDown, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
import { VehicleCard, type VehicleCardData } from "@/components/vehicles/vehicle-card";
import { updateVehicle } from "@/lib/actions/vehicles";
import { formatPrice } from "@/lib/format";
import type { VehicleStatus } from "@/types/database";

const statusOptions = [
  { value: "all", label: "Tous les statuts" },
  { value: "en_stock", label: "En stock" },
  { value: "en_preparation", label: "En préparation" },
  { value: "en_vente", label: "En vente" },
  { value: "vendu", label: "Vendu" },
];

interface VehiclesClientProps {
  vehicles: VehicleCardData[];
}

const BATCH_STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "en_stock", label: "En stock" },
  { value: "en_preparation", label: "En prépa" },
  { value: "en_vente", label: "En vente" },
];

export function VehiclesClient({ vehicles }: VehiclesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("Toutes les marques");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "price" | "days" | "margin">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isPending, startTransition] = useTransition();
  const { success: toastSuccess, error: toastError } = useToast();

  useEffect(() => setMounted(true), []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBatchStatus(newStatus: VehicleStatus) {
    const ids = Array.from(selected);
    startTransition(async () => {
      let failed = 0;
      for (const id of ids) {
        const result = await updateVehicle(id, { status: newStatus });
        if (result.error) failed++;
      }
      if (failed === 0) {
        const statusLabels: Record<string, string> = { en_stock: "En stock", en_preparation: "En prépa", en_vente: "En vente" };
        toastSuccess(`${ids.length} véhicule${ids.length > 1 ? "s" : ""} → ${statusLabels[newStatus]}`);
      } else {
        toastError(`${failed} erreur${failed > 1 ? "s" : ""} lors du changement de statut`);
      }
      setSelected(new Set());
    });
  }

  const brandOptions = useMemo(
    () => [
      "Toutes les marques",
      ...Array.from(new Set(vehicles.map((v) => v.brand))).sort(),
    ],
    [vehicles],
  );

  const fuelOptions = useMemo(
    () => ["all", ...Array.from(new Set(vehicles.map((v) => v.fuel_type))).sort()],
    [vehicles],
  );

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (minPrice) count++;
    if (maxPrice) count++;
    if (minYear) count++;
    if (maxYear) count++;
    if (fuelFilter !== "all") count++;
    if (sortBy !== "date") count++;
    return count;
  }, [minPrice, maxPrice, minYear, maxYear, fuelFilter, sortBy]);

  const filteredVehicles = useMemo(() => {
    const minP = minPrice ? parseFloat(minPrice) * 100 : null;
    const maxP = maxPrice ? parseFloat(maxPrice) * 100 : null;
    const minY = minYear ? parseInt(minYear) : null;
    const maxY = maxYear ? parseInt(maxYear) : null;

    let result = vehicles.filter((v) => {
      const matchesSearch =
        search === "" ||
        `${v.brand} ${v.model} ${v.sub_type ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || v.status === statusFilter;
      const matchesBrand =
        brandFilter === "Toutes les marques" || v.brand === brandFilter;
      const matchesFuel = fuelFilter === "all" || v.fuel_type === fuelFilter;
      const matchesMinPrice = minP === null || v.purchase_price >= minP;
      const matchesMaxPrice = maxP === null || v.purchase_price <= maxP;
      const matchesMinYear = minY === null || v.year >= minY;
      const matchesMaxYear = maxY === null || v.year <= maxY;
      return matchesSearch && matchesStatus && matchesBrand && matchesFuel && matchesMinPrice && matchesMaxPrice && matchesMinYear && matchesMaxYear;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "price":
          cmp = a.purchase_price - b.purchase_price;
          break;
        case "days": {
          const dA = Date.now() - new Date(a.purchase_date).getTime();
          const dB = Date.now() - new Date(b.purchase_date).getTime();
          cmp = dA - dB;
          break;
        }
        case "margin": {
          const mA = (a.sale_price ?? a.target_sale_price ?? 0) - a.purchase_price - a.total_expenses;
          const mB = (b.sale_price ?? b.target_sale_price ?? 0) - b.purchase_price - b.total_expenses;
          cmp = mA - mB;
          break;
        }
        default: // date
          cmp = new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime();
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [vehicles, search, statusFilter, brandFilter, fuelFilter, minPrice, maxPrice, minYear, maxYear, sortBy, sortOrder]);

  const kpis = useMemo(() => {
    const inStock = vehicles.filter(v => v.status !== "vendu").length;
    const now = new Date();
    const thisMonth = (d: string) => {
      const date = new Date(d);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    };
    const purchased = vehicles.filter(v => thisMonth(v.purchase_date)).length;
    const sold = vehicles.filter(v => v.status === "vendu").length;
    const netMargin = vehicles
      .filter(v => v.status === "vendu" && v.sale_price)
      .reduce((sum, v) => {
        const totalCost = v.purchase_price + v.total_expenses;
        const gross = (v.sale_price ?? 0) - totalCost;
        const tva = gross * 20 / 120;
        return sum + (gross - tva);
      }, 0);
    return { inStock, purchased, sold, netMargin };
  }, [vehicles]);

  return (
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiCard label="En stock" value={String(kpis.inStock)} />
        <KpiCard label="Achetés" value={String(kpis.purchased)} />
        <KpiCard label="Vendus" value={String(kpis.sold)} />
        <KpiCard label="Marge nette" value={formatPrice(kpis.netMargin)} valueColor="text-positive" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white px-5 py-3 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher marque, modèle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[10px] border border-border bg-white py-2.5 pl-9 pr-4 text-[14px] font-medium text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Status filter — client-only to avoid base-ui hydration mismatch */}
          {mounted && (
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="h-[40px] w-auto gap-2 rounded-[10px] border-border bg-white text-[14px] font-medium shadow-none">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Brand filter */}
          {mounted && (
            <Select value={brandFilter} onValueChange={(v) => v && setBrandFilter(v)}>
              <SelectTrigger className="h-[40px] w-auto gap-2 rounded-[10px] border-border bg-white text-[14px] font-medium shadow-none">
                <SelectValue placeholder="Marque" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {/* Advanced filters */}
          {mounted && (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger
                render={
                  <button className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-white px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent">
                    <SlidersHorizontal className="size-4" />
                    Filtres
                    {activeAdvancedCount > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                        {activeAdvancedCount}
                      </span>
                    )}
                  </button>
                }
              />
              <SheetContent side="right" className="w-[320px] overflow-y-auto">
                <SheetTitle className="text-[16px] font-semibold tracking-tight mb-6">Filtres avancés</SheetTitle>

                <div className="space-y-5">
                  {/* Price range */}
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold">Prix d&apos;achat (€)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number" step="100" min="0" placeholder="Min"
                        value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                        className="h-9 text-[13px] tabular-nums"
                      />
                      <Input
                        type="number" step="100" min="0" placeholder="Max"
                        value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                        className="h-9 text-[13px] tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Year range */}
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold">Année</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number" min="1990" max="2030" placeholder="Min"
                        value={minYear} onChange={(e) => setMinYear(e.target.value)}
                        className="h-9 text-[13px] tabular-nums"
                      />
                      <Input
                        type="number" min="1990" max="2030" placeholder="Max"
                        value={maxYear} onChange={(e) => setMaxYear(e.target.value)}
                        className="h-9 text-[13px] tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Fuel type */}
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold">Carburant</Label>
                    <Select value={fuelFilter} onValueChange={(v) => v && setFuelFilter(v)}>
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        {fuelOptions.filter((f) => f !== "all").map((fuel) => (
                          <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sort */}
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold">Trier par</Label>
                    <Select value={sortBy} onValueChange={(v) => v && setSortBy(v as typeof sortBy)}>
                      <SelectTrigger className="h-9 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date d&apos;ajout</SelectItem>
                        <SelectItem value="price">Prix d&apos;achat</SelectItem>
                        <SelectItem value="days">Jours en stock</SelectItem>
                        <SelectItem value="margin">Marge estimée</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => setSortOrder((o) => o === "asc" ? "desc" : "asc")}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <ArrowUpDown className="size-3.5" />
                      {sortOrder === "asc" ? "Croissant" : "Décroissant"}
                    </button>
                  </div>

                  {/* Reset */}
                  <Button
                    variant="outline"
                    className="w-full text-[13px]"
                    onClick={() => {
                      setMinPrice(""); setMaxPrice(""); setMinYear(""); setMaxYear("");
                      setFuelFilter("all"); setSortBy("date"); setSortOrder("desc");
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* View toggle */}
          <div className="flex rounded-[10px] bg-muted p-1 gap-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-[7px] p-1.5 transition-all duration-200 ${
                viewMode === "grid"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-[7px] p-1.5 transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>

          {/* Add button */}
          <Link
            href="/vehicles/new"
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#1A1A1A] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-black"
          >
            <Plus className="size-4" />
            Ajouter
          </Link>
        </div>
      </div>

      {/* Grid */}
      {filteredVehicles.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="relative">
              {/* Selection checkbox */}
              <div
                className={`absolute top-3 right-3 z-10 flex size-6 items-center justify-center rounded-md border-2 cursor-pointer transition-all ${
                  selected.has(vehicle.id)
                    ? "bg-brand border-brand"
                    : "bg-white/90 border-border backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:opacity-100"
                }`}
                style={selected.size > 0 ? { opacity: 1 } : undefined}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(vehicle.id); }}
              >
                {selected.has(vehicle.id) && (
                  <svg className="size-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <VehicleCard vehicle={vehicle} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white py-20">
          <Car className="size-16 text-muted-foreground/15 mb-4" strokeWidth={1} />
          {vehicles.length === 0 ? (
            <>
              <h3 className="text-[16px] font-semibold text-foreground">Aucun véhicule</h3>
              <p className="mt-1 text-[14px] text-muted-foreground max-w-xs text-center">
                Commencez par ajouter votre premier véhicule pour gérer votre stock.
              </p>
              <Link
                href="/vehicles/new"
                className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#1A1A1A] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-black"
              >
                <Plus className="size-4" />
                Ajouter un véhicule
              </Link>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-muted-foreground">
                Aucun véhicule trouvé
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Essayez de modifier vos filtres
              </p>
            </>
          )}
        </div>
      )}

      {/* Floating batch action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-4 rounded-2xl bg-white px-6 py-3 shadow-lg border border-border">
          <span className="text-[14px] font-semibold tabular-nums">
            {selected.size} véhicule{selected.size > 1 ? "s" : ""}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-black"
              disabled={isPending}
            >
              Changer statut
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" sideOffset={8}>
              {BATCH_STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => handleBatchStatus(opt.value)}>
                  <StatusBadge status={opt.value} className="scale-90" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <p className={`mt-2 font-mono text-[28px] font-bold tracking-tight tabular-nums ${valueColor ?? ""}`}>{value}</p>
    </div>
  );
}
