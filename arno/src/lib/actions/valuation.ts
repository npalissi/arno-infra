'use server';

import { createClient } from '@/lib/supabase/server';
import { getMarketValuation } from '@/lib/leboncoin/valuation';
import { fuelToLbcCode, gearboxToLbcCode, normalizeModel } from '@/lib/leboncoin/client';
import type { MarketValuation } from '@/lib/leboncoin/types';
import type { ActionResult } from '@/lib/types';
import type { VehicleValuation } from '@/types/database';
import { revalidatePath } from 'next/cache';

/**
 * Get market valuation for a vehicle by searching Leboncoin for similar cars.
 * Builds search params from the vehicle's data: brand, model, year ±1, mileage ±20000.
 */
export async function getVehicleValuation(
  vehicleId: string,
): Promise<ActionResult<MarketValuation>> {
  const supabase = await createClient();

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select('brand, model, year, mileage, fuel_type, gearbox, purchase_price')
    .eq('id', vehicleId)
    .single() as unknown as {
    data: {
      brand: string;
      model: string;
      year: number;
      mileage: number;
      fuel_type: string;
      gearbox: string;
      purchase_price: number;
    } | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  if (!vehicle) return { data: null, error: 'Véhicule introuvable' };

  const model = normalizeModel(vehicle.model);
  const fuel = fuelToLbcCode(vehicle.fuel_type);
  const gearbox = gearboxToLbcCode(vehicle.gearbox);

  console.log("[LBC ACTION] getVehicleValuation pour:", vehicle.brand, vehicle.model, "→ model normalise:", model, "| fuel:", vehicle.fuel_type, "→", fuel, "| gearbox:", vehicle.gearbox, "→", gearbox);

  try {
    const valuation = await getMarketValuation(
      {
        brand: vehicle.brand,
        model,
        yearMin: vehicle.year - 1,
        yearMax: vehicle.year + 1,
        mileageMin: Math.max(0, vehicle.mileage - 20000),
        mileageMax: vehicle.mileage + 20000,
        fuel,
        gearbox,
      },
      vehicle.purchase_price,
    );

    console.log("[LBC ACTION] Resultat:", valuation.totalAds, "annonces, median:", valuation.medianPrice, "€");
    return { data: valuation, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur recherche Leboncoin';
    console.error("[LBC ACTION] ERREUR:", msg);
    return { data: null, error: msg };
  }
}

// =============================================================
// saveValuation — persist to DB
// =============================================================

export async function saveValuation(
  vehicleId: string,
  valuation: MarketValuation,
  geo?: { lat: number; lng: number; radiusKm: number; label: string },
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Convert euros → centimes for DB storage
  const { error } = await supabase
    .from('vehicle_valuations')
    .insert({
      vehicle_id: vehicleId,
      median_price: Math.round(valuation.medianPrice * 100),
      min_price: Math.round(valuation.minPrice * 100),
      max_price: Math.round(valuation.maxPrice * 100),
      avg_price: Math.round(valuation.avgPrice * 100),
      p25: Math.round(valuation.p25 * 100),
      p75: Math.round(valuation.p75 * 100),
      total_ads: valuation.totalAds,
      total_excluded: valuation.totalExcluded,
      search_params: valuation.searchParams as Record<string, unknown>,
      geo_lat: geo?.lat ?? null,
      geo_lng: geo?.lng ?? null,
      geo_radius_km: geo?.radiusKm ?? null,
      geo_label: geo?.label ?? null,
    });

  if (error) return { data: null, error: error.message };

  revalidatePath(`/vehicles/${vehicleId}`);
  return { data: null, error: null };
}

// =============================================================
// getLastValuation — fetch latest saved valuation
// =============================================================

export type SavedValuation = VehicleValuation;

export async function getLastValuation(
  vehicleId: string,
): Promise<ActionResult<SavedValuation | null>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vehicle_valuations')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as {
    data: VehicleValuation | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  return { data: data ?? null, error: null };
}
