import Link from "next/link";
import {
  getAvailableMonths,
  getBillingSummary,
  getBusinessKPIs,
  getDashboardStats,
  getMarketingStats,
} from "@/lib/queries";
import { StatCard } from "@/components/StatCard";
import { formatCurrencyEs, formatDateEs, formatMonthEs } from "@/lib/dates";
import { REVISION_ALERT_THRESHOLD_DAYS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const stats = getDashboardStats(params.mes);
  const kpis = getBusinessKPIs();
  const billing = getBillingSummary();
  const marketing = getMarketingStats({ from: "2000-01-01", to: new Date().toISOString().slice(0, 10) });
  const availableMonths = getAvailableMonths();

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
        <StatCard
          label="Sin revisión reciente"
          value={String(stats.revisionAlerts.length)}
          hint={`+${REVISION_ALERT_THRESHOLD_DAYS} días o nunca`}
          tone={stats.revisionAlerts.length > 0 ? "danger" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{formatMonthEs(stats.month)}</h2>
        <form className="flex items-center gap-2" method="get">
          <select name="mes" defaultValue={stats.month} className="input w-auto">
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthEs(m)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            Ver
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Facturado (nuevas ventas)"
          value={formatCurrencyEs(stats.monthContracted)}
          hint="Contratado por clientes dados de alta este mes"
        />
        <StatCard label="Cobrado" value={formatCurrencyEs(stats.monthIncome)} tone="success" />
        <StatCard label="Gastos" value={formatCurrencyEs(stats.monthExpense)} tone="danger" />
        <StatCard
          label="Balance"
          value={formatCurrencyEs(stats.monthBalance)}
          tone={stats.monthBalance >= 0 ? "success" : "danger"}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Métricas del negocio</h2>
          <Link href="/contabilidad" className="text-xs text-[var(--accent)]">
            Ver histórico completo
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="MRR"
            value={formatCurrencyEs(kpis.mrr)}
            hint={`${kpis.activeWithFee} clientes activos con cuota`}
          />
          <StatCard label="Ticket medio (activos)" value={formatCurrencyEs(kpis.avgTicket)} />
          <StatCard
            label="LTV medio cobrado"
            value={formatCurrencyEs(kpis.ltv)}
            hint={`${kpis.payingClients} clientes con pagos`}
          />
          <StatCard label="% clientes que renuevan" value={`${kpis.renewersPct.toFixed(1)}%`} />
          <StatCard
            label="Churn (30 días)"
            value={`${kpis.churnRatePct.toFixed(1)}%`}
            hint={`${kpis.churnedLast30} baja(s) reciente(s)`}
            tone={kpis.churnedLast30 > 0 ? "danger" : "default"}
          />
          <StatCard
            label="CAC (histórico)"
            value={marketing.cac != null ? formatCurrencyEs(marketing.cac) : "—"}
            hint={`${marketing.totalNewClients} clientes · ${formatCurrencyEs(marketing.totalSpend)} en ads`}
            tone="warning"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium">Facturado vs. cobrado</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Facturado (contratado)"
            value={formatCurrencyEs(billing.totalContracted)}
            hint={`${billing.clientsWithContracted} clientes con importe contratado`}
          />
          <StatCard label="Cobrado (histórico)" value={formatCurrencyEs(billing.totalCollected)} tone="success" />
          <StatCard
            label="Pendiente de cobro"
            value={formatCurrencyEs(billing.totalPending)}
            tone={billing.totalPending > 0 ? "warning" : "default"}
          />
        </div>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Clientes que necesitan revisión</h2>
            <Link href="/revisiones" className="text-xs text-[var(--accent)]">
              Ver revisiones
            </Link>
          </div>
          {stats.revisionAlerts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Todos los clientes activos tienen una revisión reciente o programada.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {stats.revisionAlerts.slice(0, 8).map((a) => (
                <li key={a.client_id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/clientes/${a.client_id}`} className="hover:underline">
                    {a.client_name}
                  </Link>
                  <span className="text-[var(--danger)]">
                    {a.days_since == null ? "Nunca revisado" : `Hace ${a.days_since} días`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Revisiones completadas (últimos 7 días)</h2>
          </div>
          {stats.recentlyCompletedRevisions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ningún cliente ha hecho una revisión esta semana.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {stats.recentlyCompletedRevisions.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/clientes/${r.client_id}`} className="hover:underline">
                    {r.client_name}
                  </Link>
                  <span className="text-[var(--success)]">{formatDateEs(r.done_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
