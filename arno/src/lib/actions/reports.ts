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

// =============================================================
// get12MonthTrends
// =============================================================

export type MonthTrend = {
  month: string; // "2026-03"
  label: string; // "Mars"
  purchased: number;
  sold: number;
  netMargin: number;
};

export async function get12MonthTrends(): Promise<ActionResult<MonthTrend[]>> {
  const supabase = await createClient();

  const trends: MonthTrend[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const startDate = `${monthStr}-01`;
    const nextMonth = d.getMonth() === 11 ? 1 : d.getMonth() + 2;
    const nextYear = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

    // Count purchased
    const { count: purchased } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .gte('purchase_date', startDate)
      .lt('purchase_date', endDate);

    // Get sold vehicles with margin data
    const { data: sold } = await supabase
      .from('vehicles')
      .select('id, purchase_price, sale_price')
      .eq('status', 'vendu')
      .not('sale_price', 'is', null)
      .gte('sale_date', startDate)
      .lt('sale_date', endDate) as unknown as {
      data: { id: string; purchase_price: number; sale_price: number }[] | null;
    };

    let netMargin = 0;
    if (sold && sold.length > 0) {
      const vehicleIds = sold.map((v) => v.id);
      const { data: expenses } = await supabase
        .from('vehicle_expenses')
        .select('vehicle_id, amount')
        .in('vehicle_id', vehicleIds) as unknown as {
        data: { vehicle_id: string; amount: number }[] | null;
      };

      const expMap = new Map<string, number>();
      if (expenses) {
        for (const e of expenses) {
          expMap.set(e.vehicle_id, (expMap.get(e.vehicle_id) ?? 0) + e.amount);
        }
      }

      for (const v of sold) {
        const exp = expMap.get(v.id) ?? 0;
        const gross = v.sale_price - v.purchase_price - exp;
        const tva = gross > 0 ? Math.round((gross * 20) / 120) : 0;
        netMargin += gross - tva;
      }
    }

    trends.push({
      month: monthStr,
      label,
      purchased: purchased ?? 0,
      sold: sold?.length ?? 0,
      netMargin,
    });
  }

  return { data: trends, error: null };
}

// =============================================================
// getTopVehicles
// =============================================================

export type TopVehicle = {
  id: string;
  brand: string;
  model: string;
  netMargin: number;
};

export async function getTopVehicles(): Promise<ActionResult<{ mostProfitable: TopVehicle[]; leastProfitable: TopVehicle[] }>> {
  const supabase = await createClient();

  const { data: sold } = await supabase
    .from('vehicles')
    .select('id, brand, model, purchase_price, sale_price')
    .eq('status', 'vendu')
    .not('sale_price', 'is', null) as unknown as {
    data: { id: string; brand: string; model: string; purchase_price: number; sale_price: number }[] | null;
  };

  if (!sold || sold.length === 0) {
    return { data: { mostProfitable: [], leastProfitable: [] }, error: null };
  }

  const vehicleIds = sold.map((v) => v.id);
  const { data: expenses } = await supabase
    .from('vehicle_expenses')
    .select('vehicle_id, amount')
    .in('vehicle_id', vehicleIds) as unknown as {
    data: { vehicle_id: string; amount: number }[] | null;
  };

  const expMap = new Map<string, number>();
  if (expenses) {
    for (const e of expenses) {
      expMap.set(e.vehicle_id, (expMap.get(e.vehicle_id) ?? 0) + e.amount);
    }
  }

  const ranked: TopVehicle[] = sold.map((v) => {
    const exp = expMap.get(v.id) ?? 0;
    const gross = v.sale_price - v.purchase_price - exp;
    const tva = gross > 0 ? Math.round((gross * 20) / 120) : 0;
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      netMargin: gross - tva,
    };
  });

  ranked.sort((a, b) => b.netMargin - a.netMargin);

  return {
    data: {
      mostProfitable: ranked.slice(0, 5),
      leastProfitable: ranked.slice(-5).reverse().filter((v) => v.netMargin < ranked[0]?.netMargin),
    },
    error: null,
  };
}
