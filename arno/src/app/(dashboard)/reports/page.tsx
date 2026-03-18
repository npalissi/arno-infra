import { getMonthlyReport, getAnnualTrends } from "@/lib/actions/reports";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [result, trendsResult] = await Promise.all([
    getMonthlyReport(year, month),
    getAnnualTrends(),
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

  const annualData = trendsResult.data ?? {
    months: [],
    avgMarginPerVehicle: 0,
    topProfitable: [],
    leastProfitable: [],
  };

  return (
    <ReportsClient
      initialMonth={`${year}-${String(month).padStart(2, "0")}`}
      initialData={initialData}
      annualTrends={annualData}
    />
  );
}
