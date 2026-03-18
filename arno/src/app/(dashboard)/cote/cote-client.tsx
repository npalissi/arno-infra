"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  CarFront,
  Calendar,
  Gauge,
  Fuel,
  Cog,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/shared/toast";
import { getAuto1Valuation } from "@/lib/actions/valuation";
import type { Auto1ValuationResult } from "@/lib/actions/valuation";
import type { MarketValuation, LeboncoinAd } from "@/lib/leboncoin/types";

// ── Helpers ─────────────────────────────────────────────────

function fmtEur(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeStats(prices: number[]) {
  if (prices.length === 0) return { median: 0, p25: 0, p75: 0, min: 0, max: 0 };
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ── Main Component ──────────────────────────────────────────

export function CoteClient() {
  const [stockNumber, setStockNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Auto1ValuationResult | null>(null);
  const { error: toastError } = useToast();

  async function handleSearch() {
    if (!stockNumber.trim()) return;
    setSearching(true);
    setError(null);
    setResult(null);

    const res = await getAuto1Valuation(stockNumber.trim());
    if (res.error) {
      setError(res.error);
      toastError(res.error);
    } else if (res.data) {
      setResult(res.data);
    }
    setSearching(false);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[24px] font-bold tracking-tight">Estimation Cote</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Entrez une référence Auto1 pour estimer la valeur marché
        </p>
      </div>

      {/* Search bar */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[13px] font-semibold text-muted-foreground">
              Référence Auto1
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="VM79011"
                value={stockNumber}
                onChange={(e) => setStockNumber(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-12 pl-10 text-[16px] font-mono font-semibold uppercase tracking-wider"
              />
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={searching || !stockNumber.trim()}
            className="h-12 gap-2 bg-[#1A1A1A] px-6 text-[14px] font-semibold text-white hover:bg-black"
          >
            {searching ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Rechercher
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <p className="text-[14px] font-medium text-destructive">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {searching && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)] space-y-4">
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)] space-y-4">
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      )}

      {/* Results — 2 columns */}
      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left — Auto1 vehicle info */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
                <CarFront className="size-4 text-brand" />
                Véhicule Auto1
                <span className="ml-auto text-[12px] font-mono font-medium text-muted-foreground">{result.vehicle.stockNumber}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.vehicle.photos.length > 0 && (
                <div className="overflow-hidden rounded-xl">
                  <img
                    src={result.vehicle.photos[0]}
                    alt={`${result.vehicle.brand} ${result.vehicle.model}`}
                    className="w-full aspect-[16/10] object-cover"
                  />
                </div>
              )}

              <div>
                <h3 className="text-[18px] font-bold tracking-tight">
                  {result.vehicle.brand} {result.vehicle.model}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2 text-[13px] font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{result.vehicle.year}</span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1"><Gauge className="size-3.5" />{new Intl.NumberFormat("fr-FR").format(result.vehicle.mileage)} km</span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1"><Fuel className="size-3.5" />{result.vehicle.fuel_type}</span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1"><Cog className="size-3.5" />{result.vehicle.gearbox}</span>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Prix Auto1
                </p>
                <p className="text-[28px] font-mono font-bold tracking-tight tabular-nums text-foreground">
                  {fmtEur(result.vehicle.price / 100)}
                </p>
              </div>

              {/* Comparison with LBC median */}
              {(() => {
                const delta = result.vehicle.price / 100 - result.valuation.medianPrice;
                return (
                  <div className={`rounded-lg px-3 py-2 text-[13px] font-semibold text-center ${
                    delta <= 0 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"
                  }`}>
                    {delta <= 0
                      ? `Bonne affaire (${fmtEur(Math.abs(delta))} sous le marché)`
                      : `Au-dessus du marché (+${fmtEur(delta)})`}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Right — LBC valuation */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
                <Search className="size-4 text-brand" />
                Cote Marché Leboncoin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CoteLBCContent valuation={result.valuation} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state when no search yet */}
      {!searching && !error && !result && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white py-20">
          <CarFront className="size-16 text-muted-foreground/15 mb-4" strokeWidth={1} />
          <p className="text-[14px] font-semibold text-muted-foreground">
            Recherchez un véhicule Auto1
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground max-w-xs text-center">
            Entrez la référence (ex: VM79011) pour obtenir une estimation de la valeur marché via Leboncoin.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Simplified LBC Content for Cote page ────────────────────

function CoteLBCContent({ valuation }: { valuation: MarketValuation }) {
  const [adsOpen, setAdsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [geoCity, setGeoCity] = useState("");
  const [geoRadius, setGeoRadius] = useState(100);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const adsWithDistance = useMemo(() => {
    return valuation.ads.map((ad) => ({
      ...ad,
      distance: geoCoords && ad.lat && ad.lng
        ? Math.round(haversineKm(geoCoords.lat, geoCoords.lng, ad.lat, ad.lng))
        : null,
    }));
  }, [valuation.ads, geoCoords]);

  const geoFilteredAds = useMemo(() => {
    if (!geoCoords) return adsWithDistance;
    return adsWithDistance.filter((ad) => ad.distance !== null && ad.distance <= geoRadius);
  }, [adsWithDistance, geoCoords, geoRadius]);

  const localStats = useMemo(() => {
    if (!geoCoords || geoFilteredAds.length === 0) return null;
    return computeStats(geoFilteredAds.map((a) => a.price));
  }, [geoCoords, geoFilteredAds]);

  const sortedAds = [...(geoCoords ? geoFilteredAds : adsWithDistance)].sort((a, b) => {
    const aActive = (a as LeboncoinAd & { is_active?: boolean }).is_active !== false;
    const bActive = (b as LeboncoinAd & { is_active?: boolean }).is_active !== false;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.price - b.price;
  });
  const visibleAds = showAll ? sortedAds : sortedAds.slice(0, 20);
  const hasMore = sortedAds.length > 20 && !showAll;

  async function handleGeoFilter() {
    if (!geoCity.trim()) return;
    setGeoLoading(true);
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(geoCity)}&limit=1`);
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        const label = data.features[0].properties.city || data.features[0].properties.label || geoCity;
        setGeoCoords({ lat, lng, label });
        setShowAll(false);
      }
    } catch { /* ignore */ }
    setGeoLoading(false);
  }

  return (
    <>
      {/* Median */}
      <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Prix médian</p>
        <p className="text-[28px] font-mono font-bold tracking-tight tabular-nums">{fmtEur(valuation.medianPrice)}</p>
      </div>

      {/* Local comparison */}
      {localStats && geoCoords && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted/30 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">France</p>
            <p className="text-[15px] font-mono font-bold tabular-nums">{fmtEur(valuation.medianPrice)}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{valuation.totalAds} ann.</p>
          </div>
          <div className="rounded-lg bg-brand/5 border border-brand/20 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">{geoCoords.label} {geoRadius}km</p>
            <p className="text-[15px] font-mono font-bold tabular-nums">{fmtEur(localStats.median)}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{geoFilteredAds.length} ann.</p>
          </div>
        </div>
      )}

      {/* P25-P75 */}
      <div className="flex items-center justify-between text-[13px] font-semibold">
        <span className="text-muted-foreground">Fourchette</span>
        <span className="font-mono tabular-nums">{fmtEur(valuation.p25)} — {fmtEur(valuation.p75)}</span>
      </div>

      {/* Min-Max */}
      <div className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
        <span>Min {fmtEur(valuation.minPrice)}</span>
        <span className="text-border">—</span>
        <span>Max {fmtEur(valuation.maxPrice)}</span>
      </div>

      {/* Count */}
      <p className="text-[13px] font-medium text-muted-foreground">
        {valuation.totalAds} annonce{valuation.totalAds > 1 ? "s" : ""} analysée{valuation.totalAds > 1 ? "s" : ""}
        {valuation.totalExcluded > 0 && <span className="text-[12px]"> ({valuation.totalExcluded} exclue{valuation.totalExcluded > 1 ? "s" : ""})</span>}
      </p>

      {/* Geo filter */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <MapPin className="size-3.5 text-brand" />
          Cote locale
        </div>
        <div className="flex gap-2">
          <Input type="text" placeholder="Ville ou code postal" value={geoCity}
            onChange={(e) => setGeoCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGeoFilter()}
            className="h-8 text-[12px] flex-1" />
          <select value={geoRadius} onChange={(e) => setGeoRadius(Number(e.target.value))}
            className="h-8 rounded-[8px] border border-border bg-white px-2 text-[12px] font-medium">
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
            <option value={200}>200 km</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGeoFilter} disabled={geoLoading || !geoCity.trim()}
            className="h-7 gap-1 text-[11px] bg-primary text-primary-foreground">
            {geoLoading ? <RefreshCw className="size-3 animate-spin" /> : <MapPin className="size-3" />}
            Rechercher
          </Button>
          {geoCoords && (
            <Button size="sm" variant="ghost" onClick={() => { setGeoCoords(null); setShowAll(false); }}
              className="h-7 text-[11px] text-muted-foreground">
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Ads accordion */}
      {sortedAds.length > 0 && (
        <div className="border-t border-border pt-3">
          <button onClick={() => setAdsOpen(!adsOpen)}
            className="flex w-full items-center justify-between py-1 text-[13px] font-semibold text-foreground transition-colors hover:text-brand">
            <span>Voir les {sortedAds.length} annonces{geoCoords ? ` (${geoCoords.label} ${geoRadius}km)` : ""}</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${adsOpen ? "rotate-180" : ""}`} />
          </button>
          {adsOpen && (
            <div className="mt-3 space-y-2">
              {visibleAds.map((ad, idx) => {
                const priceColor = ad.price > valuation.medianPrice * 1.05 ? "text-destructive"
                  : ad.price < valuation.medianPrice * 0.95 ? "text-positive" : "text-foreground";
                return (
                  <div key={`${ad.id}-${idx}`} className="flex items-center gap-3 rounded-xl border border-border bg-white p-2.5 hover:bg-muted/30">
                    <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {ad.image ? <img src={ad.image} alt={ad.title} className="size-full object-cover" /> : (
                        <div className="flex size-full items-center justify-center"><CarFront className="size-6 text-muted-foreground/20" strokeWidth={1} /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{ad.title}</p>
                      <p className={`text-[14px] font-mono font-bold tabular-nums ${priceColor}`}>{fmtEur(ad.price)}</p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {[ad.mileage ? `${new Intl.NumberFormat("fr-FR").format(ad.mileage)} km` : null, ad.year ? String(ad.year) : null,
                          ad.distance != null ? `${ad.location ?? ""} (${ad.distance} km)` : ad.location ?? null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <a href={ad.url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-brand hover:bg-brand/10">Voir</a>
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => setShowAll(true)}
                  className="w-full rounded-xl border border-dashed border-border py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted/30 hover:text-foreground">
                  Voir les {sortedAds.length - 20} annonces restantes
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
