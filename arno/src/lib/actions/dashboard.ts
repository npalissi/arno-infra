'use server';

import { createClient } from '@/lib/supabase/server';
import type { VehicleHistory } from '@/types/database';

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

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

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
// getStockAlerts
// =============================================================

export type StockAlert = {
  id: string;
  severity: 'warning' | 'critical' | 'info';
  message: string;
  vehicleId: string;
  vehicleName: string;
};

export async function getStockAlerts(): Promise<ActionResult<StockAlert[]>> {
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, purchase_date, status, target_sale_price')
    .in('status', ['en_stock', 'en_preparation', 'en_vente']) as unknown as {
    data: { id: string; brand: string; model: string; purchase_date: string; status: string; target_sale_price: number | null }[] | null;
  };

  if (!vehicles) return { data: [], error: null };

  const alerts: StockAlert[] = [];
  const now = Date.now();

  for (const v of vehicles) {
    const days = Math.ceil((now - new Date(v.purchase_date).getTime()) / 86400000);
    const name = `${v.brand} ${v.model}`;

    if (days > 60) {
      alerts.push({
        id: `critical-${v.id}`,
        severity: 'critical',
        message: `${days} jours en stock — envisagez une baisse de prix`,
        vehicleId: v.id,
        vehicleName: name,
      });
    } else if (days > 30) {
      alerts.push({
        id: `warning-${v.id}`,
        severity: 'warning',
        message: `${days} jours en stock`,
        vehicleId: v.id,
        vehicleName: name,
      });
    }

    if (v.status === 'en_vente' && !v.target_sale_price) {
      alerts.push({
        id: `info-price-${v.id}`,
        severity: 'info',
        message: `En vente sans prix affiché`,
        vehicleId: v.id,
        vehicleName: name,
      });
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { data: alerts, error: null };
}

// =============================================================
// getStockAnalytics
// =============================================================

export type StockAnalytics = {
  avgDaysInStock: number;
  capitalInvested: number;
  estimatedRevenue: number;
  vehiclesOver30Days: number;
};

export async function getStockAnalytics(): Promise<ActionResult<StockAnalytics>> {
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, purchase_date, purchase_price, target_sale_price, status')
    .in('status', ['en_stock', 'en_preparation', 'en_vente']) as unknown as {
    data: { id: string; purchase_date: string; purchase_price: number; target_sale_price: number | null; status: string }[] | null;
  };

  if (!vehicles || vehicles.length === 0) {
    return {
      data: { avgDaysInStock: 0, capitalInvested: 0, estimatedRevenue: 0, vehiclesOver30Days: 0 },
      error: null,
    };
  }

  const vehicleIds = vehicles.map((v) => v.id);

  // Get expenses for capital invested calculation
  const { data: expenses } = await supabase
    .from('vehicle_expenses')
    .select('vehicle_id, amount')
    .in('vehicle_id', vehicleIds) as unknown as {
    data: { vehicle_id: string; amount: number }[] | null;
  };

  const expensesByVehicle = new Map<string, number>();
  if (expenses) {
    for (const e of expenses) {
      const current = expensesByVehicle.get(e.vehicle_id) ?? 0;
      expensesByVehicle.set(e.vehicle_id, current + e.amount);
    }
  }

  const now = Date.now();
  let totalDays = 0;
  let capitalInvested = 0;
  let estimatedRevenue = 0;
  let vehiclesOver30Days = 0;

  for (const v of vehicles) {
    const days = Math.ceil((now - new Date(v.purchase_date).getTime()) / 86400000);
    totalDays += days;
    if (days > 30) vehiclesOver30Days++;

    const vehicleExpenses = expensesByVehicle.get(v.id) ?? 0;
    capitalInvested += v.purchase_price + vehicleExpenses;

    if (v.status === 'en_vente' && v.target_sale_price) {
      estimatedRevenue += v.target_sale_price;
    }
  }

  return {
    data: {
      avgDaysInStock: Math.round(totalDays / vehicles.length),
      capitalInvested,
      estimatedRevenue,
      vehiclesOver30Days,
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
