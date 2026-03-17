'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import type { AppSettings } from '@/types/database';

// =============================================================
// Schemas Zod
// =============================================================

const categoriesSchema = z.array(z.string().min(1)).min(1);

// =============================================================
// Types
// =============================================================

type ActionResult = { error: string } | null;

// =============================================================
// Defaults (fallback si la row n'existe pas encore)
// =============================================================

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  expense_categories: [
    'Mécanique',
    'Carrosserie',
    'Pneus',
    'Contrôle technique',
    'Nettoyage',
    'Transport',
    'Carte grise',
    'Autre',
  ],
  document_types: [
    'carte_grise',
    'controle_technique',
    'facture',
    'autre',
  ],
  updated_at: new Date().toISOString(),
};

// =============================================================
// 1. getSettings
// =============================================================

export async function getSettings(): Promise<AppSettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .single() as unknown as {
    data: AppSettings | null;
    error: { message: string } | null;
  };

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return data;
}

// =============================================================
// 2. updateExpenseCategories
// =============================================================

export async function updateExpenseCategories(
  categories: string[],
): Promise<ActionResult> {
  const parsed = categoriesSchema.safeParse(categories);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('app_settings')
    .update({
      expense_categories: parsed.data,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('id', 'default');

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return null;
}

// =============================================================
// 3. updateDocumentTypes
// =============================================================

export async function updateDocumentTypes(
  types: string[],
): Promise<ActionResult> {
  const parsed = categoriesSchema.safeParse(types);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('app_settings')
    .update({
      document_types: parsed.data,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('id', 'default');

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return null;
}
