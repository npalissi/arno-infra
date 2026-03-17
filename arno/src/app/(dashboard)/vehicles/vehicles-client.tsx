"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Car, LayoutGrid, List, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleCard, type VehicleCardData } from "@/components/vehicles/vehicle-card";
import { formatPrice } from "@/lib/format";

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

export function VehiclesClient({ vehicles }: VehiclesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("Toutes les marques");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const brandOptions = useMemo(
    () => [
      "Toutes les marques",
      ...Array.from(new Set(vehicles.map((v) => v.brand))).sort(),
    ],
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesSearch =
        search === "" ||
        `${v.brand} ${v.model} ${v.sub_type ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || v.status === statusFilter;
      const matchesBrand =
        brandFilter === "Toutes les marques" || v.brand === brandFilter;
      return matchesSearch && matchesStatus && matchesBrand;
    });
  }, [vehicles, search, statusFilter, brandFilter]);

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
      <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-[280px]">
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

        <div className="flex items-center gap-3">
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
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
          <Car className="size-10 text-muted-foreground/15 mb-4" strokeWidth={1} />
          <p className="text-[14px] font-medium text-muted-foreground">
            Aucun véhicule trouvé
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Essayez de modifier vos filtres
          </p>
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
