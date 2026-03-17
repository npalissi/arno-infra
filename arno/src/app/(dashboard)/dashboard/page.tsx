import Link from 'next/link';
import { Car, ShoppingCart, TrendingUp, History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats, getRecentActivity } from '@/lib/actions/dashboard';

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [statsResult, activityResult] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(5),
  ]);

  const stats = statsResult.data;
  const activity = activityResult.data;

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

      {/* KPI Cards */}
      {stats && (
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
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]">
      <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <p className={`mt-2 font-mono text-[28px] font-bold tracking-tight tabular-nums ${positive !== undefined ? (positive ? 'text-positive' : 'text-destructive') : ''}`}>
        {value}
      </p>
    </div>
  );
}
