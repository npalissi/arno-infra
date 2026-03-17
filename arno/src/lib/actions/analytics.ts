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
  capitalInvested: number; // alias for totalInvested (compat with dashboard UI)
  estimatedRevenue: number;
};

export type StockAlertType =
  | 'old_stock'
  | 'no_photos'
  | 'no_target_price'
  | 'negative_margin';

export type StockAlertSeverity = 'info' | 'warning' | 'critical';

export type StockAlert = {
  id: string;
  type: StockAlertType;
  severity: StockAlertSeverity;
  vehicleId: string;
  vehicleName: string;
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
      capitalInvested: totalInvested,
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

  let alertCounter = 0;

  for (const v of vehicles) {
    const days = daysBetween(v.purchase_date, null);
    const label = `${v.brand} ${v.model}`;

    // Stock > 60 jours = critical
    if (days > 60) {
      alerts.push({
        id: `critical-${v.id}-${alertCounter++}`,
        type: 'old_stock',
        severity: 'critical',
        vehicleId: v.id,
        vehicleName: label,
        brand: v.brand,
        model: v.model,
        message: `${days} jours en stock — envisagez une baisse de prix`,
        daysInStock: days,
      });
    } else if (days > 45) {
      // Stock > 45 jours = warning
      alerts.push({
        id: `warning-${v.id}-${alertCounter++}`,
        type: 'old_stock',
        severity: 'warning',
        vehicleId: v.id,
        vehicleName: label,
        brand: v.brand,
        model: v.model,
        message: `${days} jours en stock`,
        daysInStock: days,
      });
    }

    // Pas de photos
    if ((photoCounts.get(v.id) ?? 0) === 0) {
      alerts.push({
        id: `no-photos-${v.id}-${alertCounter++}`,
        type: 'no_photos',
        severity: 'warning',
        vehicleId: v.id,
        vehicleName: label,
        brand: v.brand,
        model: v.model,
        message: `Aucune photo`,
      });
    }

    // En vente sans target_sale_price
    if (v.status === 'en_vente' && !v.target_sale_price) {
      alerts.push({
        id: `no-target-${v.id}-${alertCounter++}`,
        type: 'no_target_price',
        severity: 'info',
        vehicleId: v.id,
        vehicleName: label,
        brand: v.brand,
        model: v.model,
        message: `En vente sans prix affiché`,
      });
    }

    // Marge projetée négative
    if (v.target_sale_price) {
      const totalExpenses = expensesByVehicle.get(v.id) ?? 0;
      const totalCost = v.purchase_price + totalExpenses;
      if (v.target_sale_price < totalCost) {
        alerts.push({
          id: `neg-margin-${v.id}-${alertCounter++}`,
          type: 'negative_margin',
          severity: 'critical',
          vehicleId: v.id,
          vehicleName: label,
          brand: v.brand,
          model: v.model,
          message: `Marge projetée négative (cible ${(v.target_sale_price / 100).toFixed(0)} € < coût ${(totalCost / 100).toFixed(0)} €)`,
        });
      }
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return { data: alerts, error: null };
}

// =============================================================
// 3. getRecommendedPrice
// =============================================================

export type RecommendedPrice = {
  recommendedPrice: number;
  costTotal: number;
  projectedGrossMargin: number;
  projectedTva: number;
  projectedNetMargin: number;
  projectedNetMarginPercent: number;
};

/**
 * Calcule le prix de vente recommandé pour atteindre une marge nette cible.
 *
 * Formule : prix = costTotal × 120 / (100 - targetMarginPercent)
 * Cela garantit que la marge nette après TVA sur marge = targetMarginPercent du coût total.
 *
 * Vérification :
 *   marge_brute = prix - costTotal
 *   tva = marge_brute × 20 / 120
 *   marge_nette = marge_brute - tva = marge_brute × 100/120
 *   On veut marge_nette = costTotal × targetMarginPercent / 100
 *   Donc marge_brute × 100/120 = costTotal × target/100
 *   marge_brute = costTotal × target × 120 / (100 × 100) = costTotal × target × 1.2 / 100
 *   prix = costTotal + marge_brute = costTotal × (1 + target × 1.2 / 100)
 *        = costTotal × (100 + target × 1.2) / 100
 *        = costTotal × 120 / (100 - target) — en réarrangeant pour l'exactitude
 */
export async function getRecommendedPrice(
  vehicleId: string,
  targetMarginPercent: number = 15,
): Promise<ActionResult<RecommendedPrice>> {
  const supabase = await createClient();

  // Récupérer le véhicule
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, purchase_price')
    .eq('id', vehicleId)
    .single() as unknown as {
    data: { id: string; purchase_price: number } | null;
    error: { message: string } | null;
  };

  if (vehicleError) return { data: null, error: vehicleError.message };
  if (!vehicle) return { data: null, error: 'Véhicule introuvable' };

  // Récupérer les frais
  const { data: expenses } = await supabase
    .from('vehicle_expenses')
    .select('amount')
    .eq('vehicle_id', vehicleId) as unknown as {
    data: { amount: number }[] | null;
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const costTotal = vehicle.purchase_price + totalExpenses;

  if (targetMarginPercent >= 100) {
    return { data: null, error: 'La marge cible doit être inférieure à 100%' };
  }

  // Prix recommandé : costTotal × 120 / (100 - targetMarginPercent)
  const recommendedPrice = Math.round(costTotal * 120 / (100 - targetMarginPercent));

  // Vérification des projections
  const projectedGrossMargin = recommendedPrice - costTotal;
  const projectedTva = projectedGrossMargin > 0
    ? Math.round((projectedGrossMargin * 20) / 120)
    : 0;
  const projectedNetMargin = projectedGrossMargin - projectedTva;
  const projectedNetMarginPercent = costTotal > 0
    ? Math.round((projectedNetMargin / costTotal) * 10000) / 100
    : 0;

  return {
    data: {
      recommendedPrice,
      costTotal,
      projectedGrossMargin,
      projectedTva,
      projectedNetMargin,
      projectedNetMarginPercent,
    },
    error: null,
  };
}

// =============================================================
// 4. simulateSale
// =============================================================

export type SaleSimulation = {
  salePrice: number;
  costTotal: number;
  grossMargin: number;
  tvaOnMargin: number;
  netMargin: number;
  netMarginPercent: number;
  profitPerDay: number;
};

export async function simulateSale(
  vehicleId: string,
  salePrice: number,
): Promise<ActionResult<SaleSimulation>> {
  if (salePrice <= 0) return { data: null, error: 'Le prix de vente doit être positif' };

  const supabase = await createClient();

  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, purchase_price, purchase_date')
    .eq('id', vehicleId)
    .single() as unknown as {
    data: { id: string; purchase_price: number; purchase_date: string } | null;
    error: { message: string } | null;
  };

  if (vehicleError) return { data: null, error: vehicleError.message };
  if (!vehicle) return { data: null, error: 'Véhicule introuvable' };

  const { data: expenses } = await supabase
    .from('vehicle_expenses')
    .select('amount')
    .eq('vehicle_id', vehicleId) as unknown as {
    data: { amount: number }[] | null;
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;
  const costTotal = vehicle.purchase_price + totalExpenses;

  const grossMargin = salePrice - costTotal;
  const tvaOnMargin = grossMargin > 0 ? Math.round((grossMargin * 20) / 120) : 0;
  const netMargin = grossMargin - tvaOnMargin;
  const netMarginPercent = costTotal > 0
    ? Math.round((netMargin / costTotal) * 10000) / 100
    : 0;

  const daysInStock = daysBetween(vehicle.purchase_date, null);
  const profitPerDay = daysInStock > 0 ? Math.round(netMargin / daysInStock) : netMargin;

  return {
    data: {
      salePrice,
      costTotal,
      grossMargin,
      tvaOnMargin,
      netMargin,
      netMarginPercent,
      profitPerDay,
    },
    error: null,
  };
}
