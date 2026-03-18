"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Download, FileText, TrendingUp, TrendingDown, ShoppingCart, Receipt, CircleDollarSign, ArrowUpRight } from "lucide-react";
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
import type { MonthlyReportItem, MonthlyReportSummary, MonthTrend, TopVehicle } from "@/lib/actions/reports";

// ── Types ───────────────────────────────────────────────────

interface MonthlyReport {
  soldVehicles: MonthlyReportItem[];
  summary: MonthlyReportSummary;
}

interface ReportsClientProps {
  initialMonth: string;
  initialData: MonthlyReport;
  trends: MonthTrend[];
  topVehicles: { mostProfitable: TopVehicle[]; leastProfitable: TopVehicle[] };
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

export function ReportsClient({ initialMonth, initialData, trends, topVehicles }: ReportsClientProps) {
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

      {/* Tendances 12 mois */}
      {trends.length > 0 && <TrendsSection trends={trends} />}

      {/* Top véhicules */}
      {(topVehicles.mostProfitable.length > 0 || topVehicles.leastProfitable.length > 0) && (
        <TopVehiclesSection topVehicles={topVehicles} />
      )}
    </div>
  );
}

// ── Trends Section ──────────────────────────────────────────

function TrendsSection({ trends }: { trends: MonthTrend[] }) {
  const maxPurchased = Math.max(...trends.map((t) => t.purchased), 1);
  const maxSold = Math.max(...trends.map((t) => t.sold), 1);
  const maxMargin = Math.max(...trends.map((t) => Math.abs(t.netMargin)), 1);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="size-4 text-muted-foreground" strokeWidth={2} />
        <span className="text-[15px] font-semibold tracking-tight">Tendances 12 mois</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-2">
            <div />
            {trends.map((t) => (
              <div key={t.month} className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.label}
              </div>
            ))}
          </div>

          {/* Achetés row */}
          <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 items-end mb-2">
            <span className="text-[12px] font-semibold text-muted-foreground">Achetés</span>
            {trends.map((t) => (
              <div key={t.month} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-mono font-semibold tabular-nums text-muted-foreground">
                  {t.purchased || ""}
                </span>
                <div
                  className="w-full rounded-t bg-[#1A73E8]/70"
                  style={{ height: `${Math.max((t.purchased / maxPurchased) * 40, t.purchased > 0 ? 4 : 0)}px` }}
                />
              </div>
            ))}
          </div>

          {/* Vendus row */}
          <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 items-end mb-2">
            <span className="text-[12px] font-semibold text-muted-foreground">Vendus</span>
            {trends.map((t) => (
              <div key={t.month} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-mono font-semibold tabular-nums text-muted-foreground">
                  {t.sold || ""}
                </span>
                <div
                  className="w-full rounded-t bg-[#1E8E3E]/70"
                  style={{ height: `${Math.max((t.sold / maxSold) * 40, t.sold > 0 ? 4 : 0)}px` }}
                />
              </div>
            ))}
          </div>

          {/* Marge nette row */}
          <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 items-end">
            <span className="text-[12px] font-semibold text-muted-foreground">Marge N.</span>
            {trends.map((t) => (
              <div key={t.month} className="flex flex-col items-center gap-1">
                <span className={`text-[11px] font-mono font-semibold tabular-nums ${t.netMargin >= 0 ? "text-positive" : "text-destructive"}`}>
                  {t.netMargin !== 0 ? formatPrice(t.netMargin) : ""}
                </span>
                <div
                  className={`w-full rounded-t ${t.netMargin >= 0 ? "bg-positive/60" : "bg-destructive/60"}`}
                  style={{ height: `${Math.max((Math.abs(t.netMargin) / maxMargin) * 40, t.netMargin !== 0 ? 4 : 0)}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top Vehicles Section ────────────────────────────────────

function TopVehiclesSection({ topVehicles }: { topVehicles: { mostProfitable: TopVehicle[]; leastProfitable: TopVehicle[] } }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Most profitable */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="size-4 text-positive" strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-tight">Top 5 — Plus rentables</span>
        </div>
        {topVehicles.mostProfitable.length > 0 ? (
          <div className="space-y-0">
            {topVehicles.mostProfitable.map((v, i) => (
              <div key={v.id} className={`flex items-center justify-between py-3 ${i < topVehicles.mostProfitable.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-positive/10 text-[12px] font-bold text-positive">
                    {i + 1}
                  </span>
                  <Link href={`/vehicles/${v.id}`} className="text-[14px] font-semibold hover:text-brand transition-colors inline-flex items-center gap-1">
                    {v.brand} {v.model}
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </div>
                <span className="text-[14px] font-mono font-bold tabular-nums text-positive">
                  {formatPrice(v.netMargin)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-[14px] text-muted-foreground">Aucune vente enregistrée</p>
        )}
      </div>

      {/* Least profitable */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="size-4 text-destructive" strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-tight">Top 5 — Moins rentables</span>
        </div>
        {topVehicles.leastProfitable.length > 0 ? (
          <div className="space-y-0">
            {topVehicles.leastProfitable.map((v, i) => (
              <div key={v.id} className={`flex items-center justify-between py-3 ${i < topVehicles.leastProfitable.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-destructive/10 text-[12px] font-bold text-destructive">
                    {i + 1}
                  </span>
                  <Link href={`/vehicles/${v.id}`} className="text-[14px] font-semibold hover:text-brand transition-colors inline-flex items-center gap-1">
                    {v.brand} {v.model}
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </div>
                <span className={`text-[14px] font-mono font-bold tabular-nums ${v.netMargin >= 0 ? "text-positive" : "text-destructive"}`}>
                  {formatPrice(v.netMargin)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-[14px] text-muted-foreground">Aucune vente enregistrée</p>
        )}
      </div>
    </div>
  );
}
