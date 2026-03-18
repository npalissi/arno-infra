"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Car } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
import { formatPrice, formatMileage, daysInStock } from "@/lib/format";
import { updateVehicle } from "@/lib/actions/vehicles";
import type { VehicleStatus } from "@/types/database";

export interface VehicleCardData {
  id: string;
  brand: string;
  model: string;
  sub_type?: string | null;
  year: number;
  mileage: number;
  fuel_type: string;
  gearbox: string;
  purchase_price: number;
  total_expenses: number;
  purchase_date: string;
  status: VehicleStatus;
  primary_photo_url?: string | null;
  sale_price?: number | null;
  target_sale_price?: number | null;
}

interface VehicleCardProps {
  vehicle: VehicleCardData;
}

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "en_stock", label: "En stock" },
  { value: "en_preparation", label: "En prépa" },
  { value: "en_vente", label: "En vente" },
  { value: "vendu", label: "Vendu" },
];

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const [currentStatus, setCurrentStatus] = useState(vehicle.status);
  const [isPending, startTransition] = useTransition();
  const { success: toastSuccess, error: toastError } = useToast();

  const totalCost = vehicle.purchase_price + vehicle.total_expenses;
  const days = daysInStock(vehicle.purchase_date);
  const isSold = currentStatus === "vendu";
  const isForSale = currentStatus === "en_vente";
  const isPrep = currentStatus === "en_preparation";

  const netMargin =
    isSold && vehicle.sale_price
      ? vehicle.sale_price - totalCost
      : null;

  function handleStatusChange(newStatus: VehicleStatus) {
    if (newStatus === currentStatus) return;
    if (newStatus === "vendu") {
      toastError("Passez par la page détail pour renseigner le prix de vente");
      return;
    }
    const statusLabels: Record<string, string> = { en_stock: "En stock", en_preparation: "En prépa", en_vente: "En vente" };
    setCurrentStatus(newStatus);
    startTransition(async () => {
      const result = await updateVehicle(vehicle.id, { status: newStatus });
      if (result.error) {
        setCurrentStatus(vehicle.status);
        toastError(result.error);
      } else {
        toastSuccess(`Statut changé : ${statusLabels[newStatus] ?? newStatus}`);
      }
    });
  }

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-border shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] ${isSold ? "opacity-75" : ""}`}
    >
      <Link href={`/vehicles/${vehicle.id}`} className="cursor-pointer">
        {/* Image */}
        <div className="relative h-[180px] bg-muted overflow-hidden">
          {vehicle.primary_photo_url ? (
            <img
              src={vehicle.primary_photo_url}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              style={isSold ? { filter: "grayscale(40%)" } : undefined}
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Car className="size-12 text-muted-foreground/15" strokeWidth={1} />
            </div>
          )}
          {/* Days badge — color-coded by age */}
          {!isSold && (
            <span className={`absolute top-3 left-3 rounded-md px-2 py-1 text-[12px] font-mono font-bold backdrop-blur-sm shadow-sm tabular-nums ${
              days > 30
                ? "bg-red-500/90 text-white"
                : days >= 15
                  ? "bg-amber-500/90 text-white"
                  : "bg-emerald-500/90 text-white"
            }`}>
              {days}j
            </span>
          )}
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header: title + status dropdown */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/vehicles/${vehicle.id}`} className="min-w-0 flex-1">
            <h4 className="text-[15px] font-semibold leading-snug tracking-tight">
              {vehicle.brand} {vehicle.model}
              {vehicle.sub_type && (
                <>
                  <br />
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {vehicle.sub_type}
                  </span>
                </>
              )}
            </h4>
          </Link>
          {/* Quick status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 focus:outline-none"
              disabled={isPending}
            >
              <StatusBadge status={currentStatus} className={isPending ? "opacity-50" : "cursor-pointer hover:ring-2 hover:ring-ring/30 transition-shadow"} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={opt.value === currentStatus ? "font-bold text-brand" : ""}
                >
                  <StatusBadge status={opt.value} className="scale-90" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta */}
        <Link href={`/vehicles/${vehicle.id}`}>
          <div className="flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
            <span>{vehicle.year}</span>
            <span className="text-border">·</span>
            <span className="font-mono font-semibold tabular-nums">{formatMileage(vehicle.mileage)}</span>
            <span className="text-border">·</span>
            <span>{vehicle.fuel_type}</span>
          </div>
        </Link>

        {/* Financials */}
        <Link href={`/vehicles/${vehicle.id}`}>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3">
            {isSold && netMargin !== null ? (
              <>
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">Coût total</span>
                  <p className="text-[14px] font-mono font-semibold tabular-nums">{formatPrice(totalCost)}</p>
                </div>
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">Marge nette</span>
                  <p className={`text-[14px] font-mono font-bold tabular-nums ${netMargin >= 0 ? "text-positive" : "text-destructive"}`}>
                    {formatPrice(netMargin)}
                  </p>
                </div>
              </>
            ) : isForSale && vehicle.target_sale_price ? (
              <>
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">Achat</span>
                  <p className="text-[14px] font-mono font-semibold tabular-nums">{formatPrice(vehicle.purchase_price)}</p>
                </div>
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">Prix affiché</span>
                  <p className="text-[14px] font-mono font-bold tabular-nums">{formatPrice(vehicle.target_sale_price)}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">Achat</span>
                  <p className="text-[14px] font-mono font-semibold tabular-nums">{formatPrice(vehicle.purchase_price)}</p>
                </div>
                <div>
                  <span className="text-[12px] font-medium text-muted-foreground">{isPrep ? "Total est." : "Total"}</span>
                  <p className="text-[14px] font-mono font-bold tabular-nums">{formatPrice(totalCost)}</p>
                </div>
              </>
            )}
          </div>
        </Link>
      </div>
    </article>
  );
}
