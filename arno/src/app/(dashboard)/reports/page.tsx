import { getMonthlyReport, get12MonthTrends, getTopVehicles } from "@/lib/actions/reports";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [result, trendsResult, topResult] = await Promise.all([
    getMonthlyReport(year, month),
    get12MonthTrends(),
    getTopVehicles(),
  ]);

  const initialData = result.data ?? {
    soldVehicles: [],
    summary: {
      totalSold: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      totalGrossMargin: 0,
      totalTva: 0,
      totalNetMargin: 0,
    },
  };

  return (
    <ReportsClient
      initialMonth={`${year}-${String(month).padStart(2, "0")}`}
      initialData={initialData}
      trends={trendsResult.data ?? []}
      topVehicles={topResult.data ?? { mostProfitable: [], leastProfitable: [] }}
    />
  );
}
