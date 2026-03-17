'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type { Vehicle } from '@/types/database';

// =============================================================
// Schemas Zod
// =============================================================

const vehicleFormSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  sub_type: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2030),
  mileage: z.coerce.number().int().min(0),
  fuel_type: z.string().min(1),
  gearbox: z.string().min(1),
  color: z.string().optional(),
  vin: z
    .string()
    .optional()
    .refine((v) => !v || v.length === 17, {
      message: 'Le VIN doit contenir exactement 17 caractères',
    }),
  registration: z.string().optional(),
  purchase_price: z.coerce.number().int().min(1),
  target_sale_price: z.coerce.number().int().min(0).optional(),
  sale_price: z.coerce.number().int().min(0).optional(),
  status: z.enum(['en_stock', 'en_preparation', 'en_vente', 'vendu']).default('en_stock'),
  purchase_date: z.string().min(1),
  sale_date: z.string().optional(),
  purchase_source: z.string().min(1).default('direct'),
  purchase_notes: z.string().optional(),
  sale_notes: z.string().optional(),
});

const vehicleFormUpdateSchema = vehicleFormSchema.partial();

// =============================================================
// Types
// =============================================================

type FormActionResult = { error: string } | null;

// =============================================================
// Helpers
// =============================================================

function parseFormData(formData: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      // Champs vides → undefined (ignorés par Zod optional)
      data[key] = value.trim() === '' ? undefined : value.trim();
    }
  }
  return data;
}

// =============================================================
// 1. createVehicleFromForm
// =============================================================

export async function createVehicleFromForm(
  formData: FormData,
): Promise<FormActionResult> {
  const raw = parseFormData(formData);
  const parsed = vehicleFormSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const insertData = {
    ...parsed.data,
    registration: parsed.data.registration ?? '',
    purchase_source: parsed.data.purchase_source ?? 'direct',
    vin: parsed.data.vin ?? null,
    sub_type: parsed.data.sub_type ?? null,
    color: parsed.data.color ?? null,
    target_sale_price: parsed.data.target_sale_price ?? null,
    sale_price: parsed.data.sale_price ?? null,
    sale_date: parsed.data.sale_date ?? null,
    purchase_notes: parsed.data.purchase_notes ?? null,
    sale_notes: parsed.data.sale_notes ?? null,
    created_by: user?.id ?? null,
  };

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert(insertData)
    .select()
    .single() as unknown as {
    data: Vehicle | null;
    error: { message: string } | null;
  };

  if (error) return { error: error.message };
  if (!vehicle) return { error: 'Erreur création véhicule' };

  // Entrée historique : achat
  await supabase.from('vehicle_history').insert({
    vehicle_id: vehicle.id,
    action: 'achat',
    description: `Véhicule acheté — ${vehicle.brand} ${vehicle.model} (${vehicle.registration || 'sans immat'})`,
    created_by: user?.id ?? null,
  });

  revalidatePath('/vehicles');
  redirect(`/vehicles/${vehicle.id}`);
}

// =============================================================
// 2. updateVehicleFromForm
// =============================================================

export async function updateVehicleFromForm(
  id: string,
  formData: FormData,
): Promise<FormActionResult> {
  const raw = parseFormData(formData);
  const parsed = vehicleFormUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.message };
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
    .single() as unknown as {
    data: { status: string; sale_price: number | null } | null;
  };

  // Construire les données de mise à jour (convertir undefined → null pour les champs nullable)
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single() as unknown as {
    data: Vehicle | null;
    error: { message: string } | null;
  };

  if (error) return { error: error.message };
  if (!vehicle) return { error: 'Erreur mise à jour véhicule' };

  // Historique si changement de status
  if (
    parsed.data.status &&
    oldVehicle &&
    parsed.data.status !== oldVehicle.status
  ) {
    await supabase.from('vehicle_history').insert({
      vehicle_id: id,
      action: 'changement_status',
      description: `Status changé : ${oldVehicle.status} → ${parsed.data.status}`,
      created_by: user?.id ?? null,
    });
  }

  // Historique si prix de vente ajouté
  if (
    parsed.data.sale_price !== undefined &&
    parsed.data.sale_price !== null &&
    parsed.data.sale_price > 0 &&
    oldVehicle &&
    oldVehicle.sale_price === null
  ) {
    await supabase.from('vehicle_history').insert({
      vehicle_id: id,
      action: 'vente',
      description: `Véhicule vendu — prix : ${(parsed.data.sale_price / 100).toFixed(2)} €`,
      created_by: user?.id ?? null,
    });
  }

  revalidatePath('/vehicles');
  revalidatePath(`/vehicles/${id}`);
  return null;
}
