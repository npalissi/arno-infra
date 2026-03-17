import { getMonthlyReport } from "@/lib/actions/reports";
import type { MonthlyReportItem, MonthlyReportSummary } from "@/lib/actions/reports";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const result = await getMonthlyReport(year, month);
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
    />
  );
}
