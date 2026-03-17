'use server';

import { createClient } from '@/lib/supabase/server';
import type { VehicleHistory } from '@/types/database';
import type { ActionResult } from '@/lib/types';

// =============================================================
// getHistory
// =============================================================

export async function getHistory(
  vehicleId: string,
): Promise<ActionResult<VehicleHistory[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vehicle_history')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false }) as unknown as {
    data: VehicleHistory[] | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
