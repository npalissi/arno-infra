'use server';

import { createClient } from '@/lib/supabase/server';
import { getMarketValuation } from '@/lib/leboncoin/valuation';
import { fuelToLbcCode, gearboxToLbcCode, normalizeModel } from '@/lib/leboncoin/client';
import { fetchAuto1Vehicle } from '@/lib/auto1/client';
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

  // Progressive search: start strict, widen if 0 results
  const searchStrategies = [
    // 1. Strict: year ±1, km ±20k, fuel + gearbox
    {
      label: "strict",
      params: {
        brand: vehicle.brand, model,
        yearMin: vehicle.year - 1, yearMax: vehicle.year + 1,
        mileageMin: Math.max(0, vehicle.mileage - 20000), mileageMax: vehicle.mileage + 20000,
        fuel, gearbox,
      },
    },
    // 2. Medium: year ±3, km ±50k, fuel only (no gearbox)
    {
      label: "medium",
      params: {
        brand: vehicle.brand, model,
        yearMin: vehicle.year - 3, yearMax: vehicle.year + 3,
        mileageMin: Math.max(0, vehicle.mileage - 50000), mileageMax: vehicle.mileage + 50000,
        fuel,
      },
    },
    // 3. Wide: year ±5, no km filter, no gearbox, no fuel
    {
      label: "wide",
      params: {
        brand: vehicle.brand, model,
        yearMin: vehicle.year - 5, yearMax: vehicle.year + 5,
      },
    },
  ];

  try {
    for (const strategy of searchStrategies) {
      console.log(`[LBC ACTION] Essai ${strategy.label}:`, JSON.stringify(strategy.params));
      const valuation = await getMarketValuation(strategy.params, vehicle.purchase_price);

      if (valuation.totalAds > 0) {
        console.log(`[LBC ACTION] ${strategy.label} OK:`, valuation.totalAds, "annonces, median:", valuation.medianPrice, "€");
        // Auto-save to DB
        saveValuation(vehicleId, valuation).catch((e) =>
          console.error("[LBC ACTION] Auto-save failed:", e),
        );
        return { data: valuation, error: null };
      }

      console.log(`[LBC ACTION] ${strategy.label}: 0 annonces, elargissement...`);
    }

    // All strategies returned 0
    console.log("[LBC ACTION] Aucune annonce trouvee meme en elargissant");
    return {
      data: {
        medianPrice: 0, minPrice: 0, maxPrice: 0, avgPrice: 0,
        p25: 0, p75: 0, totalAds: 0, totalBeforeFilter: 0, totalExcluded: 0,
        ads: [], searchParams: searchStrategies[2]!.params, fetchedAt: new Date().toISOString(),
      },
      error: null,
    };
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

// =============================================================
// getAuto1Valuation — fetch Auto1 vehicle + LBC market valuation
// =============================================================

export type Auto1ValuationResult = {
  vehicle: {
    stockNumber: string;
    brand: string;
    model: string;
    year: number;
    mileage: number;
    fuel_type: string;
    gearbox: string;
    price: number; // Auto1 price in centimes
    photos: string[];
  };
  valuation: MarketValuation;
};

export async function getAuto1Valuation(
  stockNumber: string,
): Promise<ActionResult<Auto1ValuationResult>> {
  try {
    // 1. Fetch vehicle details from Auto1
    const auto1 = await fetchAuto1Vehicle(stockNumber);

    const model = normalizeModel(auto1.model);
    const fuel = fuelToLbcCode(auto1.fuelType);
    const gearbox = gearboxToLbcCode(auto1.gearbox);
    const purchasePrice = auto1.price.priceWithoutDiscount * 100; // euros → centimes

    console.log(
      "[AUTO1 VALUATION] getAuto1Valuation pour:",
      auto1.brand, auto1.model,
      "→ model normalise:", model,
      "| fuel:", auto1.fuelType, "→", fuel,
      "| gearbox:", auto1.gearbox, "→", gearbox,
      "| prix:", auto1.price.priceWithoutDiscount, "€",
    );

    // 2. Progressive search: strict → medium → wide (same as getVehicleValuation)
    const searchStrategies = [
      // 1. Strict: year ±1, km ±20k, fuel + gearbox
      {
        label: "strict",
        params: {
          brand: auto1.brand, model,
          yearMin: auto1.year - 1, yearMax: auto1.year + 1,
          mileageMin: Math.max(0, auto1.mileage - 20000), mileageMax: auto1.mileage + 20000,
          fuel, gearbox,
        },
      },
      // 2. Medium: year ±3, km ±50k, fuel only (no gearbox)
      {
        label: "medium",
        params: {
          brand: auto1.brand, model,
          yearMin: auto1.year - 3, yearMax: auto1.year + 3,
          mileageMin: Math.max(0, auto1.mileage - 50000), mileageMax: auto1.mileage + 50000,
          fuel,
        },
      },
      // 3. Wide: year ±5, no km filter, no gearbox, no fuel
      {
        label: "wide",
        params: {
          brand: auto1.brand, model,
          yearMin: auto1.year - 5, yearMax: auto1.year + 5,
        },
      },
    ];

    let valuation: MarketValuation | null = null;

    for (const strategy of searchStrategies) {
      console.log(`[AUTO1 VALUATION] Essai ${strategy.label}:`, JSON.stringify(strategy.params));
      const result = await getMarketValuation(strategy.params, purchasePrice);

      if (result.totalAds > 0) {
        console.log(`[AUTO1 VALUATION] ${strategy.label} OK:`, result.totalAds, "annonces, median:", result.medianPrice, "€");
        valuation = result;
        break;
      }

      console.log(`[AUTO1 VALUATION] ${strategy.label}: 0 annonces, elargissement...`);
    }

    // All strategies returned 0
    if (!valuation) {
      console.log("[AUTO1 VALUATION] Aucune annonce trouvee meme en elargissant");
      valuation = {
        medianPrice: 0, minPrice: 0, maxPrice: 0, avgPrice: 0,
        p25: 0, p75: 0, totalAds: 0, totalBeforeFilter: 0, totalExcluded: 0,
        ads: [], searchParams: searchStrategies[2]!.params, fetchedAt: new Date().toISOString(),
      };
    }

    // 3. Build result
    const vehicleInfo: Auto1ValuationResult['vehicle'] = {
      stockNumber: auto1.stockNumber,
      brand: auto1.brand,
      model: auto1.model,
      year: auto1.year,
      mileage: auto1.mileage,
      fuel_type: auto1.fuelType,
      gearbox: auto1.gearbox,
      price: purchasePrice, // centimes
      photos: auto1.photos.map((p) => p.url),
    };

    return { data: { vehicle: vehicleInfo, valuation }, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur Auto1 valuation';
    console.error("[AUTO1 VALUATION] ERREUR:", msg);
    return { data: null, error: msg };
  }
}
