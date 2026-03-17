'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type {
  Vehicle,
  VehiclePhoto,
  VehicleDocument,
  VehicleExpense,
  VehicleHistory,
  VehicleUpdate,
  VehicleStatus,
} from '@/types/database';

// =============================================================
// Schemas Zod
// =============================================================

const vehicleInsertSchema = z.object({
  stock_number: z.string().nullable().optional(),
  registration: z.string().min(1),
  vin: z.string().nullable().optional(),
  brand: z.string().min(1),
  model: z.string().min(1),
  sub_type: z.string().nullable().optional(),
  year: z.int().min(1900).max(2100),
  fuel_type: z.string().min(1),
  gearbox: z.string().min(1),
  mileage: z.int().min(0),
  power_hp: z.int().min(0).nullable().optional(),
  color: z.string().nullable().optional(),
  doors: z.int().min(0).nullable().optional(),
  seats: z.int().min(0).nullable().optional(),
  body_type: z.string().nullable().optional(),
  euro_norm: z.string().nullable().optional(),
  total_owners: z.int().min(0).nullable().optional(),
  status: z.enum(['en_stock', 'en_preparation', 'en_vente', 'vendu']).optional(),
  condition: z.string().nullable().optional(),
  is_accident: z.boolean().nullable().optional(),
  damages: z.string().nullable().optional(),
  ct_status: z.string().nullable().optional(),
  ct_date: z.string().nullable().optional(),
  purchase_price: z.int().min(0),
  purchase_date: z.string().min(1),
  purchase_source: z.string().min(1),
  seller_name: z.string().nullable().optional(),
  purchase_notes: z.string().nullable().optional(),
  target_sale_price: z.int().min(0).nullable().optional(),
  sale_price: z.int().min(0).nullable().optional(),
  sale_date: z.string().nullable().optional(),
  buyer_name: z.string().nullable().optional(),
  sale_notes: z.string().nullable().optional(),
});

const vehicleUpdateSchema = vehicleInsertSchema.partial();

// =============================================================
// Types retour
// =============================================================

type VehicleListItem = Vehicle & {
  total_expenses: number;
  primary_photo_url: string | null;
};

type VehicleDetail = Vehicle & {
  photos: VehiclePhoto[];
  documents: VehicleDocument[];
  expenses: VehicleExpense[];
  history: VehicleHistory[];
  total_expenses: number;
  total_cost: number;
  margin: number | null;
  margin_percent: number | null;
  tva_on_margin: number | null;
};

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// =============================================================
// Filters
// =============================================================

type VehicleFilters = {
  status?: VehicleStatus;
  brand?: string;
  search?: string;
};

// =============================================================
// 1. getVehicles
// =============================================================

export async function getVehicles(
  filters?: VehicleFilters,
): Promise<ActionResult<VehicleListItem[]>> {
  const supabase = await createClient();

  // Récupérer les véhicules
  let query = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.brand) {
    query = query.eq('brand', filters.brand);
  }
  if (filters?.search) {
    query = query.or(
      `brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%,registration.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  const vehicles = (data ?? []) as Vehicle[];
  if (vehicles.length === 0) return { data: [], error: null };

  // Enrichir chaque véhicule avec expenses total + photo principale
  const vehicleIds = vehicles.map((v) => v.id);

  const [expensesResult, photosResult] = await Promise.all([
    supabase
      .from('vehicle_expenses')
      .select('vehicle_id, amount')
      .in('vehicle_id', vehicleIds) as unknown as { data: { vehicle_id: string; amount: number }[] | null },
    supabase
      .from('vehicle_photos')
      .select('vehicle_id, url')
      .in('vehicle_id', vehicleIds)
      .eq('is_primary', true) as unknown as { data: { vehicle_id: string; url: string }[] | null },
  ]);

  // Agréger expenses par véhicule
  const expensesByVehicle = new Map<string, number>();
  if (expensesResult.data) {
    for (const e of expensesResult.data) {
      const current = expensesByVehicle.get(e.vehicle_id) ?? 0;
      expensesByVehicle.set(e.vehicle_id, current + e.amount);
    }
  }

  // Map photos principales
  const primaryPhotos = new Map<string, string>();
  if (photosResult.data) {
    for (const p of photosResult.data) {
      primaryPhotos.set(p.vehicle_id, p.url);
    }
  }

  const result: VehicleListItem[] = vehicles.map((v) => ({
    ...v,
    total_expenses: expensesByVehicle.get(v.id) ?? 0,
    primary_photo_url: primaryPhotos.get(v.id) ?? null,
  }));

  return { data: result, error: null };
}

// =============================================================
// 2. getVehicle
// =============================================================

export async function getVehicle(
  id: string,
): Promise<ActionResult<VehicleDetail>> {
  const supabase = await createClient();

  const [vehicleResult, photosResult, documentsResult, expensesResult, historyResult] =
    await Promise.all([
      supabase.from('vehicles').select('*').eq('id', id).single() as unknown as { data: Vehicle | null; error: { message: string } | null },
      supabase.from('vehicle_photos').select('*').eq('vehicle_id', id).order('position', { ascending: true }) as unknown as { data: VehiclePhoto[] | null; error: null },
      supabase.from('vehicle_documents').select('*').eq('vehicle_id', id).order('uploaded_at', { ascending: false }) as unknown as { data: VehicleDocument[] | null; error: null },
      supabase.from('vehicle_expenses').select('*').eq('vehicle_id', id).order('date', { ascending: false }) as unknown as { data: VehicleExpense[] | null; error: null },
      supabase.from('vehicle_history').select('*').eq('vehicle_id', id).order('date', { ascending: false }) as unknown as { data: VehicleHistory[] | null; error: null },
    ]);

  if (vehicleResult.error) return { data: null, error: vehicleResult.error.message };

  const vehicle = vehicleResult.data!;
  const photos = photosResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const history = historyResult.data ?? [];

  // Calculs financiers
  const total_expenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const total_cost = vehicle.purchase_price + total_expenses;

  let margin: number | null = null;
  let margin_percent: number | null = null;
  let tva_on_margin: number | null = null;

  if (vehicle.sale_price !== null) {
    margin = vehicle.sale_price - total_cost;
    margin_percent = total_cost > 0 ? (margin / total_cost) * 100 : null;
    // TVA sur marge : marge_brute × 20/120
    tva_on_margin = margin > 0 ? Math.round((margin * 20) / 120) : 0;
  }

  return {
    data: {
      ...vehicle,
      photos,
      documents,
      expenses,
      history,
      total_expenses,
      total_cost,
      margin,
      margin_percent,
      tva_on_margin,
    },
    error: null,
  };
}

// =============================================================
// 3. createVehicle
// =============================================================

export async function createVehicle(
  data: unknown,
): Promise<ActionResult<Vehicle>> {
  const parsed = vehicleInsertSchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({ ...parsed.data, created_by: user?.id ?? null } as Vehicle)
    .select()
    .single() as unknown as { data: Vehicle | null; error: { message: string } | null };

  if (error) return { data: null, error: error.message };
  if (!vehicle) return { data: null, error: 'Erreur création véhicule' };

  // Entrée historique : achat
  await supabase.from('vehicle_history').insert({
    vehicle_id: vehicle.id,
    action: 'achat',
    description: `Véhicule acheté — ${vehicle.brand} ${vehicle.model} (${vehicle.registration})`,
    created_by: user?.id ?? null,
  } as VehicleHistory);

  revalidatePath('/vehicles');
  return { data: vehicle, error: null };
}

// =============================================================
// 4. updateVehicle
// =============================================================

export async function updateVehicle(
  id: string,
  data: unknown,
): Promise<ActionResult<Vehicle>> {
  const parsed = vehicleUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Récupérer l'ancien état pour détecter les changements
  const { data: oldVehicle } = await supabase
    .from('vehicles')
    .select('status, sale_price')
    .eq('id', id)
    .single() as unknown as { data: { status: string; sale_price: number | null } | null };

  const updateData = parsed.data as VehicleUpdate;

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single() as unknown as { data: Vehicle | null; error: { message: string } | null };

  if (error) return { data: null, error: error.message };
  if (!vehicle) return { data: null, error: 'Erreur mise à jour véhicule' };

  // Historique si changement de status
  if (updateData.status && oldVehicle && updateData.status !== oldVehicle.status) {
    await supabase.from('vehicle_history').insert({
      vehicle_id: id,
      action: 'changement_status',
      description: `Status changé : ${oldVehicle.status} → ${updateData.status}`,
      created_by: user?.id ?? null,
    } as VehicleHistory);
  }

  // Historique si prix de vente ajouté
  if (
    updateData.sale_price !== undefined &&
    updateData.sale_price !== null &&
    oldVehicle &&
    oldVehicle.sale_price === null
  ) {
    await supabase.from('vehicle_history').insert({
      vehicle_id: id,
      action: 'vente',
      description: `Véhicule vendu — prix : ${(updateData.sale_price / 100).toFixed(2)} €`,
      created_by: user?.id ?? null,
    } as VehicleHistory);
  }

  revalidatePath('/vehicles');
  revalidatePath(`/vehicles/${id}`);
  return { data: vehicle, error: null };
}

// =============================================================
// 5. deleteVehicle
// =============================================================

export async function deleteVehicle(
  id: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.from('vehicles').delete().eq('id', id);

  if (error) return { data: null, error: error.message };

  revalidatePath('/vehicles');
  return { data: null, error: null };
}
