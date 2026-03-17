'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type { VehicleExpense } from '@/types/database';

// =============================================================
// Schemas Zod
// =============================================================

const expenseInsertSchema = z.object({
  vehicle_id: z.string().uuid(),
  category: z.string().min(1),
  description: z.string().nullable().default(null),
  amount: z.int().min(0),
  date: z.string().min(1),
  invoice_url: z.string().nullable().default(null),
});

const expenseUpdateSchema = expenseInsertSchema
  .omit({ vehicle_id: true })
  .partial();

// =============================================================
// Types
// =============================================================

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// =============================================================
// 1. getExpenses
// =============================================================

export async function getExpenses(
  vehicleId: string,
): Promise<ActionResult<VehicleExpense[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vehicle_expenses')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as VehicleExpense[], error: null };
}

// =============================================================
// 2. createExpense
// =============================================================

export async function createExpense(
  data: unknown,
): Promise<ActionResult<VehicleExpense>> {
  const parsed = expenseInsertSchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: expense, error } = await supabase
    .from('vehicle_expenses')
    .insert(parsed.data)
    .select()
    .single() as { data: VehicleExpense | null; error: { message: string } | null };

  if (error) return { data: null, error: error.message };
  if (!expense) return { data: null, error: 'Erreur création frais' };

  // Entrée historique
  await supabase.from('vehicle_history').insert({
    vehicle_id: parsed.data.vehicle_id,
    action: 'ajout_frais',
    description: `Frais ajouté : ${parsed.data.category} — ${(parsed.data.amount / 100).toFixed(2)} €`,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/vehicles/${parsed.data.vehicle_id}`);
  return { data: expense, error: null };
}

// =============================================================
// 3. updateExpense
// =============================================================

export async function updateExpense(
  id: string,
  data: unknown,
): Promise<ActionResult<VehicleExpense>> {
  const parsed = expenseUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { data: null, error: parsed.error.message };
  }

  const supabase = await createClient();

  const { data: expense, error } = await supabase
    .from('vehicle_expenses')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single() as { data: VehicleExpense | null; error: { message: string } | null };

  if (error) return { data: null, error: error.message };
  if (!expense) return { data: null, error: 'Erreur mise à jour frais' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('vehicle_history').insert({
    vehicle_id: expense.vehicle_id,
    action: 'modification_frais',
    description: `Frais modifié : ${expense.category} — ${(expense.amount / 100).toFixed(2)} €`,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/vehicles/${expense.vehicle_id}`);
  return { data: expense, error: null };
}

// =============================================================
// 4. deleteExpense
// =============================================================

export async function deleteExpense(
  id: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Récupérer les infos du frais avant suppression
  const { data: expense } = await supabase
    .from('vehicle_expenses')
    .select('vehicle_id, category, amount')
    .eq('id', id)
    .single() as { data: { vehicle_id: string; category: string; amount: number } | null };

  const { error } = await supabase
    .from('vehicle_expenses')
    .delete()
    .eq('id', id);

  if (error) return { data: null, error: error.message };

  if (expense) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Entrée historique de suppression
    await supabase.from('vehicle_history').insert({
      vehicle_id: expense.vehicle_id,
      action: 'suppression_frais',
      description: `Frais supprimé : ${expense.category} — ${(expense.amount / 100).toFixed(2)} €`,
      created_by: user?.id ?? null,
    });

    revalidatePath(`/vehicles/${expense.vehicle_id}`);
  }

  return { data: null, error: null };
}
