'use server';

import { createClient } from '@/lib/supabase/server';

// =============================================================
// Types
// =============================================================

export type MonthlyReportItem = {
  id: string;
  brand: string;
  model: string;
  registration: string;
  sale_date: string | null;
  purchase_price: number;
  total_expenses: number;
  sale_price: number;
  marge_brute: number;
  tva: number;
  marge_nette: number;
};

export type MonthlyReportSummary = {
  totalSold: number;
  totalRevenue: number;
  totalExpenses: number;
  totalGrossMargin: number;
  totalTva: number;
  totalNetMargin: number;
};

export type MonthlyReport = {
  soldVehicles: MonthlyReportItem[];
  summary: MonthlyReportSummary;
};

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// =============================================================
// getMonthlyReport
// =============================================================

export async function getMonthlyReport(
  year: number,
  month: number,
): Promise<ActionResult<MonthlyReport>> {
  const supabase = await createClient();

  // Bornes du mois (dates ISO sans heure pour comparaison avec sale_date qui est un date)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  // Véhicules vendus dans le mois
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, brand, model, registration, sale_date, purchase_price, sale_price')
    .eq('status', 'vendu')
    .not('sale_price', 'is', null)
    .gte('sale_date', startDate)
    .lt('sale_date', endDate)
    .order('sale_date', { ascending: true }) as unknown as {
    data: {
      id: string;
      brand: string;
      model: string;
      registration: string;
      sale_date: string | null;
      purchase_price: number;
      sale_price: number;
    }[] | null;
    error: { message: string } | null;
  };

  if (error) return { data: null, error: error.message };
  if (!vehicles || vehicles.length === 0) {
    return {
      data: {
        soldVehicles: [],
        summary: {
          totalSold: 0,
          totalRevenue: 0,
          totalExpenses: 0,
          totalGrossMargin: 0,
          totalTva: 0,
          totalNetMargin: 0,
        },
      },
      error: null,
    };
  }

  // Batch expenses
  const vehicleIds = vehicles.map((v) => v.id);

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

  // Calculs par véhicule
  const soldVehicles: MonthlyReportItem[] = vehicles.map((v) => {
    const total_expenses = expensesByVehicle.get(v.id) ?? 0;
    const marge_brute = v.sale_price - v.purchase_price - total_expenses;
    const tva = marge_brute > 0 ? Math.round((marge_brute * 20) / 120) : 0;
    const marge_nette = marge_brute - tva;

    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      registration: v.registration,
      sale_date: v.sale_date,
      purchase_price: v.purchase_price,
      total_expenses,
      sale_price: v.sale_price,
      marge_brute,
      tva,
      marge_nette,
    };
  });

  // Summary
  const summary: MonthlyReportSummary = {
    totalSold: soldVehicles.length,
    totalRevenue: soldVehicles.reduce((sum, v) => sum + v.sale_price, 0),
    totalExpenses: soldVehicles.reduce((sum, v) => sum + v.total_expenses, 0),
    totalGrossMargin: soldVehicles.reduce((sum, v) => sum + v.marge_brute, 0),
    totalTva: soldVehicles.reduce((sum, v) => sum + v.tva, 0),
    totalNetMargin: soldVehicles.reduce((sum, v) => sum + v.marge_nette, 0),
  };

  return { data: { soldVehicles, summary }, error: null };
}
