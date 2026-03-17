'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type { VehicleListing } from '@/types/database';
import type { ActionResult } from '@/lib/types';

// =============================================================
// Schemas Zod
// =============================================================

const listingInsertSchema = z.object({
  vehicle_id: z.string().uuid(),
  platform: z.string().min(1),
  url: z.string().url(),
});

// =============================================================
// 1. getVehicleListings
// =============================================================

export async function getVehicleListings(
  vehicleId: string,
): Promise<ActionResult<VehicleListing[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vehicle_listings')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as VehicleListing[], error: null };
}

// =============================================================
// 2. addListing
// =============================================================

export async function addListing(
  data: unknown,
): Promise<ActionResult<VehicleListing>> {
  const parsed = listingInsertSchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from('vehicle_listings')
    .insert(parsed.data)
    .select()
    .single() as { data: VehicleListing | null; error: { message: string } | null };

  if (error) return { data: null, error: error.message };
  if (!listing) return { data: null, error: 'Erreur création annonce' };

  revalidatePath(`/vehicles/${parsed.data.vehicle_id}`);
  return { data: listing, error: null };
}

// =============================================================
// 3. deleteListing
// =============================================================

export async function deleteListing(
  id: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Récupérer le vehicle_id avant suppression pour revalidate
  const { data: listing } = await supabase
    .from('vehicle_listings')
    .select('vehicle_id')
    .eq('id', id)
    .single() as { data: { vehicle_id: string } | null };

  const { error } = await supabase
    .from('vehicle_listings')
    .delete()
    .eq('id', id);

  if (error) return { data: null, error: error.message };

  if (listing) {
    revalidatePath(`/vehicles/${listing.vehicle_id}`);
  }

  return { data: null, error: null };
}
