import Link from "next/link";
import { Car } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatPrice, formatMileage, daysInStock } from "@/lib/format";
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

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const totalCost = vehicle.purchase_price + vehicle.total_expenses;
  const days = daysInStock(vehicle.purchase_date);
  const isSold = vehicle.status === "vendu";
  const isForSale = vehicle.status === "en_vente";
  const isPrep = vehicle.status === "en_preparation";

  const netMargin =
    isSold && vehicle.sale_price
      ? vehicle.sale_price - totalCost
      : null;

  return (
    <Link href={`/vehicles/${vehicle.id}`}>
      <article
        className={`group flex flex-col overflow-hidden rounded-2xl bg-white border border-border shadow-[var(--shadow-card)] transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] ${isSold ? "opacity-75" : ""}`}
      >
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
          {/* Days badge */}
          {!isSold && (
            <span className="absolute top-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[12px] font-mono font-semibold text-foreground backdrop-blur-sm shadow-sm tabular-nums">
              {days}j
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Header: title + badge */}
          <div className="flex items-start justify-between gap-2">
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
            <StatusBadge status={vehicle.status} />
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
            <span>{vehicle.year}</span>
            <span className="text-border">·</span>
            <span className="font-mono font-semibold tabular-nums">{formatMileage(vehicle.mileage)}</span>
            <span className="text-border">·</span>
            <span>{vehicle.fuel_type}</span>
          </div>

          {/* Financials */}
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
        </div>
      </article>
    </Link>
  );
}
