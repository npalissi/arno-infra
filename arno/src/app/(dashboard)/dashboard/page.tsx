import Link from 'next/link';
import { Car, Plus, ShoppingCart, TrendingUp, History, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, Info, Clock, Wallet, Target, Timer } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats, getRecentActivity, getStockAlerts, getStockAnalytics } from '@/lib/actions/dashboard';
import type { StockAlert } from '@/lib/actions/dashboard';

function formatCentimes(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(centimes / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

const actionLabels: Record<string, string> = {
  achat: 'Achat',
  vente: 'Vente',
  changement_status: 'Changement de statut',
  ajout_frais: 'Frais ajouté',
  ajout_document: 'Document ajouté',
};

const actionDotColors: Record<string, string> = {
  achat: 'bg-[#1A73E8]',
  vente: 'bg-[#1E8E3E]',
  changement_status: 'bg-[#B06000]',
  ajout_frais: 'bg-[#DE5E36]',
  ajout_document: 'bg-[#5F6368]',
};

const alertStyles: Record<StockAlert['severity'], { bg: string; text: string; icon: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500', border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500', border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500', border: 'border-blue-200' },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [statsResult, activityResult, alertsResult, analyticsResult] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(5),
    getStockAlerts(),
    getStockAnalytics(),
  ]);

  const stats = statsResult.data;
  const activity = activityResult.data;
  const alerts = alertsResult.data ?? [];
  const analytics = analyticsResult.data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[24px] font-bold tracking-tight">Tableau de bord</h2>
        {user && (
          <p className="mt-1 text-[14px] text-muted-foreground">
            Bienvenue,{' '}
            <span className="font-semibold text-foreground">{user.email}</span>
          </p>
        )}
      </div>

      {/* Empty state — no vehicles at all */}
      {stats && stats.inStock === 0 && stats.soldThisMonth === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white py-16">
          <Car className="size-16 text-muted-foreground/15 mb-4" strokeWidth={1} />
          <h3 className="text-[16px] font-semibold text-foreground">Aucun véhicule</h3>
          <p className="mt-1 text-[14px] text-muted-foreground max-w-xs text-center">
            Commencez par ajouter votre premier véhicule pour voir les statistiques et l&apos;activité.
          </p>
          <Link
            href="/vehicles/new"
            className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#1A1A1A] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-black"
          >
            <Plus className="size-4" />
            Ajouter un véhicule
          </Link>
        </div>
      )}

      {/* KPI Cards — Row 1 */}
      {stats && (stats.inStock > 0 || stats.soldThisMonth > 0) && (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <KpiCard label="Véhicules en stock" value={String(stats.inStock)} />
          <KpiCard label="En vente" value={String(stats.forSale)} />
          <KpiCard label="Vendus ce mois" value={String(stats.soldThisMonth)} />
          <KpiCard
            label="Marge nette du mois"
            value={formatCentimes(stats.netMarginThisMonth)}
            positive={stats.netMarginThisMonth >= 0}
          />
        </div>
      )}

      {/* KPI Cards — Row 2 (Stock Analytics) */}
      {analytics && stats && (stats.inStock > 0 || stats.soldThisMonth > 0) && (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <KpiCard
            label="Jours en stock moyen"
            value={`${analytics.avgDaysInStock}j`}
            icon={<Timer className="size-4 text-muted-foreground" />}
          />
          <KpiCard
            label="Capital investi"
            value={formatCentimes(analytics.capitalInvested)}
            icon={<Wallet className="size-4 text-muted-foreground" />}
          />
          <KpiCard
            label="CA estimé"
            value={formatCentimes(analytics.estimatedRevenue)}
            icon={<Target className="size-4 text-muted-foreground" />}
          />
          <KpiCard
            label="Véhicules > 30j"
            value={String(analytics.vehiclesOver30Days)}
            highlight={analytics.vehiclesOver30Days > 0}
            icon={<Clock className="size-4 text-muted-foreground" />}
          />
        </div>
      )}

      {/* Alerts Section */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className="size-4 text-muted-foreground" strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-tight">Alertes</span>
          {alerts.length > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive tabular-nums">
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const style = alertStyles[alert.severity];
              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3`}
                >
                  {alert.severity === 'critical' ? (
                    <AlertTriangle className={`size-4 shrink-0 ${style.icon}`} strokeWidth={2} />
                  ) : alert.severity === 'info' ? (
                    <Info className={`size-4 shrink-0 ${style.icon}`} strokeWidth={2} />
                  ) : (
                    <AlertTriangle className={`size-4 shrink-0 ${style.icon}`} strokeWidth={2} />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className={`text-[13px] font-semibold ${style.text}`}>
                      {alert.message}
                    </span>
                  </div>
                  <Link
                    href={`/vehicles/${alert.vehicleId}`}
                    className={`shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold ${style.text} hover:underline`}
                  >
                    {alert.vehicleName}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-positive/20 bg-positive/5 px-4 py-4">
            <CheckCircle2 className="size-5 text-positive" strokeWidth={2} />
            <span className="text-[14px] font-semibold text-positive">
              Tout est en ordre
            </span>
          </div>
        )}
      </div>

      {/* Activité récente */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-5">
          <History className="size-4 text-muted-foreground" strokeWidth={2} />
          <span className="text-[15px] font-semibold tracking-tight">Activité récente</span>
        </div>

        {activity && activity.length > 0 ? (
          <div className="space-y-0">
            {activity.map((item, index) => (
              <div key={item.id} className={`flex items-start justify-between gap-4 py-3.5 ${index < activity.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`mt-1.5 size-2.5 rounded-full shrink-0 ${actionDotColors[item.action] ?? 'bg-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">
                      {actionLabels[item.action] ?? item.action}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                    <Link
                      href={`/vehicles/${item.vehicle_id}`}
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:text-brand/80 transition-colors mt-0.5"
                    >
                      {item.vehicle_brand} {item.vehicle_model}
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-mono font-medium text-muted-foreground tabular-nums">
                  {formatDate(item.date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[14px] text-muted-foreground">Aucune activité récente</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  positive,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  positive?: boolean;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <p className={`mt-2 font-mono text-[28px] font-bold tracking-tight tabular-nums ${
        positive !== undefined
          ? (positive ? 'text-positive' : 'text-destructive')
          : highlight
            ? 'text-destructive'
            : ''
      }`}>
        {value}
      </p>
    </div>
  );
}
