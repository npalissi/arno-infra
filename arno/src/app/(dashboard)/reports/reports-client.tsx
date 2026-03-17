"use client";

import { useState, useMemo, useCallback } from "react";
import { Download, FileText, TrendingUp, ShoppingCart, Receipt, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice, formatDate } from "@/lib/format";
import { getMonthlyReport } from "@/lib/actions/reports";
import type { MonthlyReportItem, MonthlyReportSummary } from "@/lib/actions/reports";

// ── Types ───────────────────────────────────────────────────

interface MonthlyReport {
  soldVehicles: MonthlyReportItem[];
  summary: MonthlyReportSummary;
}

interface ReportsClientProps {
  initialMonth: string;
  initialData: MonthlyReport;
}

// ── Helpers ─────────────────────────────────────────────────

function generateMonthOptions(): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    months.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return months;
}

function computeMargins(v: MonthlyReportItem) {
  return {
    grossMargin: v.marge_brute,
    tva: v.tva,
    netMargin: v.marge_nette,
  };
}

// ── Page ────────────────────────────────────────────────────

export function ReportsClient({ initialMonth, initialData }: ReportsClientProps) {
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [report, setReport] = useState<MonthlyReport>(initialData);
  const [loading, setLoading] = useState(false);

  const handleMonthChange = useCallback(async (monthValue: string) => {
    if (!monthValue) return;
    setSelectedMonth(monthValue);
    setLoading(true);
    const [yearStr, monthStr] = monthValue.split("-");
    const result = await getMonthlyReport(Number(yearStr), Number(monthStr));
    if (result.data) {
      setReport(result.data);
    }
    setLoading(false);
  }, []);

  const { soldVehicles, summary } = report;

  const marginColor = (value: number) =>
    value >= 0 ? "text-positive" : "text-destructive";

  function handleExportCSV() {
    const BOM = "\uFEFF";
    const header = "Véhicule;Date vente;Prix achat;Frais;Prix vente;Marge brute;TVA;Marge nette";
    const rows = soldVehicles.map((v) =>
      [
        `${v.brand} ${v.model}`,
        v.sale_date ?? "",
        (v.purchase_price / 100).toFixed(2),
        (v.total_expenses / 100).toFixed(2),
        (v.sale_price / 100).toFixed(2),
        (v.marge_brute / 100).toFixed(2),
        (v.tva / 100).toFixed(2),
        (v.marge_nette / 100).toFixed(2),
      ].join(";"),
    );
    const csv = BOM + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPDF() {
    console.log("Export PDF", { month: selectedMonth, vehicles: soldVehicles });
  }

  const kpis = [
    {
      label: "Véhicules vendus",
      value: String(summary.totalSold),
      icon: ShoppingCart,
      iconBg: "bg-[#E8F0FE]",
      iconColor: "text-[#1A73E8]",
    },
    {
      label: "Chiffre d'affaires",
      value: formatPrice(summary.totalRevenue),
      icon: CircleDollarSign,
      iconBg: "bg-[#E6F4EA]",
      iconColor: "text-[#1E8E3E]",
    },
    {
      label: "Total frais",
      value: formatPrice(summary.totalExpenses),
      icon: Receipt,
      iconBg: "bg-[#FEF7E0]",
      iconColor: "text-[#B06000]",
    },
    {
      label: "Marge nette",
      value: formatPrice(summary.totalNetMargin),
      icon: TrendingUp,
      iconBg: summary.totalNetMargin >= 0 ? "bg-[#E6F4EA]" : "bg-red-50",
      iconColor: summary.totalNetMargin >= 0 ? "text-[#1E8E3E]" : "text-destructive",
      colorClass: marginColor(summary.totalNetMargin),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rapports</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Synthèse mensuelle des ventes
          </p>
        </div>
        <Select value={selectedMonth} onValueChange={(v) => v && handleMonthChange(v)}>
          <SelectTrigger className="w-[200px] h-9 bg-white border-black/[0.08]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl bg-white p-5"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.02)" }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                <kpi.icon className={`size-5 ${kpi.iconColor}`} />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold tabular-nums ${kpi.colorClass ?? "text-foreground"}`}>
                  {kpi.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {soldVehicles.length > 0 ? (
        <div
          className="rounded-2xl bg-white p-6"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Véhicule</th>
                  <th className="pb-3 pr-4 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="pb-3 pr-4 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Achat</th>
                  <th className="pb-3 pr-4 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Frais</th>
                  <th className="pb-3 pr-4 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Vente</th>
                  <th className="pb-3 pr-4 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Marge B.</th>
                  <th className="pb-3 pr-4 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">TVA</th>
                  <th className="pb-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Marge N.</th>
                </tr>
              </thead>
              <tbody>
                {soldVehicles.map((v) => {
                  const { grossMargin, tva, netMargin } = computeMargins(v);
                  return (
                    <tr key={v.id} className="border-b border-black/[0.03] hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 font-semibold">{v.brand} {v.model}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-[12px]">{v.sale_date ? formatDate(v.sale_date) : "—"}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatPrice(v.purchase_price)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatPrice(v.total_expenses)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatPrice(v.sale_price)}</td>
                      <td className={`py-3 pr-4 text-right tabular-nums ${marginColor(grossMargin)}`}>{formatPrice(grossMargin)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">- {formatPrice(tva)}</td>
                      <td className={`py-3 text-right tabular-nums font-semibold ${marginColor(netMargin)}`}>{formatPrice(netMargin)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="pt-3 pr-4 font-bold">Total</td>
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pr-4 text-right font-bold tabular-nums">{formatPrice(soldVehicles.reduce((s, v) => s + v.purchase_price, 0))}</td>
                  <td className="pt-3 pr-4 text-right font-bold tabular-nums">{formatPrice(summary.totalExpenses)}</td>
                  <td className="pt-3 pr-4 text-right font-bold tabular-nums">{formatPrice(summary.totalRevenue)}</td>
                  <td className={`pt-3 pr-4 text-right font-bold tabular-nums ${marginColor(summary.totalGrossMargin)}`}>{formatPrice(summary.totalGrossMargin)}</td>
                  <td className="pt-3 pr-4 text-right font-bold tabular-nums text-muted-foreground">- {formatPrice(summary.totalTva)}</td>
                  <td className={`pt-3 text-right font-bold tabular-nums ${marginColor(summary.totalNetMargin)}`}>{formatPrice(summary.totalNetMargin)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.08] py-20">
          <ShoppingCart className="size-10 text-muted-foreground/20 mb-3" strokeWidth={1} />
          <p className="text-[13px] text-muted-foreground">Aucune vente ce mois</p>
        </div>
      )}

      {/* Export buttons */}
      {soldVehicles.length > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportCSV} className="border-black/[0.08]">
            <Download className="size-4" />
            Exporter CSV
          </Button>
          <Button variant="outline" onClick={handleExportPDF} className="border-black/[0.08]">
            <FileText className="size-4" />
            Exporter PDF
          </Button>
        </div>
      )}
    </div>
  );
}
