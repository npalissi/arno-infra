'use server';

import { createClient } from '@/lib/supabase/server';
import type { VehicleHistory } from '@/types/database';
import type { ActionResult } from '@/lib/types';

// =============================================================
// Types
// =============================================================

export type DashboardStats = {
  inStock: number;
  forSale: number;
  soldThisMonth: number;
  netMarginThisMonth: number;
};

export type RecentActivityItem = VehicleHistory & {
  vehicle_brand: string;
  vehicle_model: string;
};

// =============================================================
// getDashboardStats
// =============================================================

export async function getDashboardStats(): Promise<ActionResult<DashboardStats>> {
  const supabase = await createClient();

  // Début du mois courant en ISO
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Count véhicules en stock (en_stock + en_preparation + en_vente)
  const { count: inStock } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .in('status', ['en_stock', 'en_preparation', 'en_vente']);

  // Count véhicules en vente
  const { count: forSale } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'en_vente');

  // Véhicules vendus ce mois (status vendu + sale_date >= début du mois)
  const { data: soldVehicles } = await supabase
    .from('vehicles')
    .select('id, purchase_price, sale_price')
    .eq('status', 'vendu')
    .gte('sale_date', startOfMonth.split('T')[0]) as unknown as {
    data: { id: string; purchase_price: number; sale_price: number | null }[] | null;
  };

  const soldThisMonth = soldVehicles?.length ?? 0;

  // Calcul marge nette du mois
  let netMarginThisMonth = 0;

  if (soldVehicles && soldVehicles.length > 0) {
    const vehicleIds = soldVehicles.map((v) => v.id);

    // Récupérer les frais pour chaque véhicule vendu
    const { data: expenses } = await supabase
      .from('vehicle_expenses')
      .select('vehicle_id, amount')
      .in('vehicle_id', vehicleIds) as unknown as {
      data: { vehicle_id: string; amount: number }[] | null;
    };

    // Agréger frais par véhicule
    const expensesByVehicle = new Map<string, number>();
    if (expenses) {
      for (const e of expenses) {
        const current = expensesByVehicle.get(e.vehicle_id) ?? 0;
        expensesByVehicle.set(e.vehicle_id, current + e.amount);
      }
    }

    // Calculer marge nette pour chaque véhicule
    for (const v of soldVehicles) {
      if (v.sale_price === null) continue;
      const totalExpenses = expensesByVehicle.get(v.id) ?? 0;
      const margeBrute = v.sale_price - v.purchase_price - totalExpenses;
      const tva = margeBrute > 0 ? Math.round((margeBrute * 20) / 120) : 0;
      const margeNette = margeBrute - tva;
      netMarginThisMonth += margeNette;
    }
  }

  return {
    data: {
      inStock: inStock ?? 0,
      forSale: forSale ?? 0,
      soldThisMonth,
      netMarginThisMonth,
    },
    error: null,
  };
}

// =============================================================
// getRecentActivity
// =============================================================

export async function getRecentActivity(
  limit: number = 5,
): Promise<ActionResult<RecentActivityItem[]>> {
  const supabase = await createClient();

  // Récupérer les dernières entrées d'historique
  const { data: history, error } = await supabase
    .from('vehicle_history')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit) as unknown as {
    data: VehicleHistory[] | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  if (!history || history.length === 0) return { data: [], error: null };

  // Récupérer les véhicules associés pour brand + model
  const vehicleIds = [...new Set(history.map((h) => h.vehicle_id))];

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model')
    .in('id', vehicleIds) as unknown as {
    data: { id: string; brand: string; model: string }[] | null;
  };

  const vehicleMap = new Map<string, { brand: string; model: string }>();
  if (vehicles) {
    for (const v of vehicles) {
      vehicleMap.set(v.id, { brand: v.brand, model: v.model });
    }
  }

  const result: RecentActivityItem[] = history.map((h) => {
    const vehicle = vehicleMap.get(h.vehicle_id);
    return {
      ...h,
      vehicle_brand: vehicle?.brand ?? 'Inconnu',
      vehicle_model: vehicle?.model ?? '',
    };
  });

  return { data: result, error: null };
}
