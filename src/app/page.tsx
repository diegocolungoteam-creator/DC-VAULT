import Link from "next/link";
import { getDashboardStats } from "@/lib/queries";
import { StatCard } from "@/components/StatCard";
import { formatCurrencyEs, formatDateEs } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Resumen</h1>
        <p className="text-sm text-[var(--muted)]">Estado general de tu operación</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Clientes activos" value={String(stats.activeClients)} hint={`${stats.totalClients} en total`} />
        <StatCard
          label="Renovaciones próximas (30 días)"
          value={String(stats.upcomingRenewals.length)}
          tone={stats.upcomingRenewals.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Renovaciones vencidas"
          value={String(stats.overdueRenewals.length)}
          tone={stats.overdueRenewals.length > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Revisiones pendientes"
          value={String(stats.pendingRevisions.length)}
          hint={stats.overdueRevisionsCount > 0 ? `${stats.overdueRevisionsCount} vencidas` : undefined}
          tone={stats.overdueRevisionsCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Ingresos del mes" value={formatCurrencyEs(stats.monthIncome)} tone="success" />
        <StatCard label="Gastos del mes" value={formatCurrencyEs(stats.monthExpense)} tone="danger" />
        <StatCard
          label="Balance del mes"
          value={formatCurrencyEs(stats.monthBalance)}
          tone={stats.monthBalance >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Renovaciones vencidas o próximas</h2>
            <Link href="/clientes" className="text-xs text-[var(--accent)]">
              Ver clientes
            </Link>
          </div>
          {stats.overdueRenewals.length === 0 && stats.upcomingRenewals.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No hay renovaciones pendientes en los próximos 30 días.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {[...stats.overdueRenewals, ...stats.upcomingRenewals].slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/clientes/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                  <span
                    className={
                      c.renewal_date && c.renewal_date < new Date().toISOString().slice(0, 10)
                        ? "text-[var(--danger)]"
                        : "text-[var(--muted)]"
                    }
                  >
                    {formatDateEs(c.renewal_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Revisiones pendientes</h2>
            <Link href="/revisiones" className="text-xs text-[var(--accent)]">
              Ver revisiones
            </Link>
          </div>
          {stats.pendingRevisions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No hay revisiones pendientes.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {stats.pendingRevisions.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/clientes/${r.client_id}`} className="hover:underline">
                    {r.client_name}
                  </Link>
                  <span
                    className={
                      r.scheduled_date < new Date().toISOString().slice(0, 10)
                        ? "text-[var(--danger)]"
                        : "text-[var(--muted)]"
                    }
                  >
                    {formatDateEs(r.scheduled_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
