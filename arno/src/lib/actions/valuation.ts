'use server';

import { createClient } from '@/lib/supabase/server';
import { getMarketValuation } from '@/lib/leboncoin/valuation';
import { fuelToLbcCode, gearboxToLbcCode } from '@/lib/leboncoin/client';
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
    .select('brand, model, year, mileage, fuel_type, gearbox')
    .eq('id', vehicleId)
    .single() as unknown as {
    data: {
      brand: string;
      model: string;
      year: number;
      mileage: number;
      fuel_type: string;
      gearbox: string;
    } | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  if (!vehicle) return { data: null, error: 'Véhicule introuvable' };

  try {
    const valuation = await getMarketValuation({
      brand: vehicle.brand,
      model: vehicle.model,
      yearMin: vehicle.year - 1,
      yearMax: vehicle.year + 1,
      mileageMin: Math.max(0, vehicle.mileage - 20000),
      mileageMax: vehicle.mileage + 20000,
      fuel: fuelToLbcCode(vehicle.fuel_type),
      gearbox: gearboxToLbcCode(vehicle.gearbox),
    });

    return { data: valuation, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur recherche Leboncoin';
    return { data: null, error: msg };
  }
}
