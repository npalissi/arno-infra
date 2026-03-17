'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

// =============================================================
// Types
// =============================================================

export type StockAnalytics = {
  avgDaysInStock: number;
  oldestVehicle: {
    id: string;
    brand: string;
    model: string;
    daysInStock: number;
  } | null;
  vehiclesOver30Days: number;
  avgMarginPercent: number;
  totalInvested: number;
  estimatedRevenue: number;
};

export type StockAlertType =
  | 'old_stock'
  | 'no_photos'
  | 'no_target_price'
  | 'negative_margin';

export type StockAlertSeverity = 'info' | 'warning' | 'critical';

export type StockAlert = {
  type: StockAlertType;
  severity: StockAlertSeverity;
  vehicleId: string;
  brand: string;
  model: string;
  message: string;
  daysInStock?: number;
};

// =============================================================
// Helpers
// =============================================================

function daysBetween(from: string, to: string | null): number {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

// =============================================================
// 1. getStockAnalytics
// =============================================================

export async function getStockAnalytics(): Promise<ActionResult<StockAnalytics>> {
  const supabase = await createClient();

  // Véhicules non vendus (en stock)
  const { data: inStockVehicles, error: inStockError } = await supabase
    .from('vehicles')
    .select('id, brand, model, purchase_price, purchase_date, target_sale_price, status')
    .neq('status', 'vendu') as unknown as {
    data: {
      id: string;
      brand: string;
      model: string;
      purchase_price: number;
      purchase_date: string;
      target_sale_price: number | null;
      status: string;
    }[] | null;
    error: { message: string } | null;
  };

  if (inStockError) return { data: null, error: inStockError.message };
  const vehicles = inStockVehicles ?? [];

  // Véhicules vendus (pour marge moyenne)
  const { data: soldVehicles } = await supabase
    .from('vehicles')
    .select('id, purchase_price, sale_price')
    .eq('status', 'vendu')
    .not('sale_price', 'is', null) as unknown as {
    data: { id: string; purchase_price: number; sale_price: number }[] | null;
  };

  // Frais pour véhicules non vendus + vendus
  const allIds = [
    ...vehicles.map((v) => v.id),
    ...(soldVehicles ?? []).map((v) => v.id),
  ];

  const expensesByVehicle = new Map<string, number>();
  if (allIds.length > 0) {
    const { data: expenses } = await supabase
      .from('vehicle_expenses')
      .select('vehicle_id, amount')
      .in('vehicle_id', allIds) as unknown as {
      data: { vehicle_id: string; amount: number }[] | null;
    };

    if (expenses) {
      for (const e of expenses) {
        const current = expensesByVehicle.get(e.vehicle_id) ?? 0;
        expensesByVehicle.set(e.vehicle_id, current + e.amount);
      }
    }
  }

  // Calculs sur véhicules en stock
  let totalDays = 0;
  let oldestVehicle: StockAnalytics['oldestVehicle'] = null;
  let maxDays = 0;
  let vehiclesOver30Days = 0;
  let totalInvested = 0;
  let estimatedRevenue = 0;

  for (const v of vehicles) {
    const days = daysBetween(v.purchase_date, null);
    totalDays += days;

    if (days > maxDays) {
      maxDays = days;
      oldestVehicle = { id: v.id, brand: v.brand, model: v.model, daysInStock: days };
    }

    if (days > 30) vehiclesOver30Days++;

    const vehicleExpenses = expensesByVehicle.get(v.id) ?? 0;
    totalInvested += v.purchase_price + vehicleExpenses;

    if (v.status === 'en_vente' && v.target_sale_price) {
      estimatedRevenue += v.target_sale_price;
    }
  }

  const avgDaysInStock = vehicles.length > 0 ? Math.round(totalDays / vehicles.length) : 0;

  // Marge nette moyenne sur véhicules vendus
  let avgMarginPercent = 0;
  if (soldVehicles && soldVehicles.length > 0) {
    let totalMarginPercent = 0;

    for (const v of soldVehicles) {
      const totalExpenses = expensesByVehicle.get(v.id) ?? 0;
      const totalCost = v.purchase_price + totalExpenses;
      const margeBrute = v.sale_price - totalCost;
      const tva = margeBrute > 0 ? Math.round((margeBrute * 20) / 120) : 0;
      const margeNette = margeBrute - tva;
      const percent = totalCost > 0 ? (margeNette / totalCost) * 100 : 0;
      totalMarginPercent += percent;
    }

    avgMarginPercent = Math.round((totalMarginPercent / soldVehicles.length) * 100) / 100;
  }

  return {
    data: {
      avgDaysInStock,
      oldestVehicle,
      vehiclesOver30Days,
      avgMarginPercent,
      totalInvested,
      estimatedRevenue,
    },
    error: null,
  };
}

// =============================================================
// 2. getStockAlerts
// =============================================================

export async function getStockAlerts(): Promise<ActionResult<StockAlert[]>> {
  const supabase = await createClient();

  // Véhicules non vendus
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, brand, model, status, purchase_price, purchase_date, target_sale_price')
    .neq('status', 'vendu') as unknown as {
    data: {
      id: string;
      brand: string;
      model: string;
      status: string;
      purchase_price: number;
      purchase_date: string;
      target_sale_price: number | null;
    }[] | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  if (!vehicles || vehicles.length === 0) return { data: [], error: null };

  const vehicleIds = vehicles.map((v) => v.id);

  // Fetch photos count and expenses in parallel
  const [photosResult, expensesResult] = await Promise.all([
    supabase
      .from('vehicle_photos')
      .select('vehicle_id')
      .in('vehicle_id', vehicleIds) as unknown as {
      data: { vehicle_id: string }[] | null;
    },
    supabase
      .from('vehicle_expenses')
      .select('vehicle_id, amount')
      .in('vehicle_id', vehicleIds) as unknown as {
      data: { vehicle_id: string; amount: number }[] | null;
    },
  ]);

  // Photos par véhicule (juste le count)
  const photoCounts = new Map<string, number>();
  if (photosResult.data) {
    for (const p of photosResult.data) {
      photoCounts.set(p.vehicle_id, (photoCounts.get(p.vehicle_id) ?? 0) + 1);
    }
  }

  // Frais par véhicule
  const expensesByVehicle = new Map<string, number>();
  if (expensesResult.data) {
    for (const e of expensesResult.data) {
      const current = expensesByVehicle.get(e.vehicle_id) ?? 0;
      expensesByVehicle.set(e.vehicle_id, current + e.amount);
    }
  }

  const alerts: StockAlert[] = [];

  for (const v of vehicles) {
    const days = daysBetween(v.purchase_date, null);
    const label = `${v.brand} ${v.model}`;

    // Stock > 60 jours = critical
    if (days > 60) {
      alerts.push({
        type: 'old_stock',
        severity: 'critical',
        vehicleId: v.id,
        brand: v.brand,
        model: v.model,
        message: `${label} en stock depuis ${days} jours`,
        daysInStock: days,
      });
    } else if (days > 45) {
      // Stock > 45 jours = warning
      alerts.push({
        type: 'old_stock',
        severity: 'warning',
        vehicleId: v.id,
        brand: v.brand,
        model: v.model,
        message: `${label} en stock depuis ${days} jours`,
        daysInStock: days,
      });
    }

    // Pas de photos
    if ((photoCounts.get(v.id) ?? 0) === 0) {
      alerts.push({
        type: 'no_photos',
        severity: 'warning',
        vehicleId: v.id,
        brand: v.brand,
        model: v.model,
        message: `${label} n'a aucune photo`,
      });
    }

    // En vente sans target_sale_price
    if (v.status === 'en_vente' && !v.target_sale_price) {
      alerts.push({
        type: 'no_target_price',
        severity: 'warning',
        vehicleId: v.id,
        brand: v.brand,
        model: v.model,
        message: `${label} en vente sans prix cible`,
      });
    }

    // Marge projetée négative
    if (v.target_sale_price) {
      const totalExpenses = expensesByVehicle.get(v.id) ?? 0;
      const totalCost = v.purchase_price + totalExpenses;
      if (v.target_sale_price < totalCost) {
        alerts.push({
          type: 'negative_margin',
          severity: 'critical',
          vehicleId: v.id,
          brand: v.brand,
          model: v.model,
          message: `${label} : marge projetée négative (cible ${(v.target_sale_price / 100).toFixed(0)} € < coût ${(totalCost / 100).toFixed(0)} €)`,
        });
      }
    }
  }

  return { data: alerts, error: null };
}
