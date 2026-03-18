'use server';

import { createClient } from '@/lib/supabase/server';
import { getMarketValuation } from '@/lib/leboncoin/valuation';
import { fuelToLbcCode, gearboxToLbcCode, normalizeModel } from '@/lib/leboncoin/client';
import type { MarketValuation } from '@/lib/leboncoin/types';
import type { ActionResult } from '@/lib/types';

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
