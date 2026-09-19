import { createAdSpendAction, deleteAdSpendAction } from "@/lib/actions";
import { getMarketingStats, listAdSpend } from "@/lib/queries";
import { StatCard } from "@/components/StatCard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatCurrencyEs, formatDateEs, monthStartISO, subtractDays, todayISO } from "@/lib/dates";
import { LEAD_SOURCES } from "@/lib/types";

export const dynamic = "force-dynamic";

type Period = "mes" | "7d" | "30d" | "custom";

function resolveRange(period: Period, fromParam?: string, toParam?: string) {
  const today = todayISO();
  if (period === "7d") return { from: subtractDays(today, 6), to: today };
  if (period === "30d") return { from: subtractDays(today, 29), to: today };
  if (period === "custom" && fromParam && toParam) return { from: fromParam, to: toParam };
  return { from: monthStartISO(today), to: today };
}

export default async function PublicidadPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = (params.period as Period) || "mes";
  const { from, to } = resolveRange(period, params.from, params.to);

  const stats = getMarketingStats({ from, to });
  const recentEntries = listAdSpend({ from, to });
  const maxSourceAmount = Math.max(1, ...stats.bySource.map((s) => s.amount));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Centro de mando · Publicidad</h1>
          <p className="text-sm text-[var(--muted)]">
            {formatDateEs(from)} — {formatDateEs(to)}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <select name="period" defaultValue={period} className="input w-auto">
            <option value="mes">Este mes</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Personalizado...</option>
          </select>
          <input type="date" name="from" defaultValue={from} className="input w-auto" />
          <input type="date" name="to" defaultValue={to} className="input w-auto" />
          <button type="submit" className="btn btn-secondary">
            Ver
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Gasto en ads" value={formatCurrencyEs(stats.totalSpend)} tone="danger" />
        <StatCard label="Leads" value={String(stats.totalLeads)} />
        <StatCard
          label="Coste / lead"
          value={stats.costPerLead != null ? formatCurrencyEs(stats.costPerLead) : "—"}
        />
        <StatCard label="Llamadas agendadas" value={String(stats.totalCalls)} />
        <StatCard
          label="Coste / llamada"
          value={stats.costPerCall != null ? formatCurrencyEs(stats.costPerCall) : "—"}
        />
        <StatCard label="Cierres" value={String(stats.totalCloses)} tone="success" />
        <StatCard
          label="Coste / cierre"
          value={stats.costPerClose != null ? formatCurrencyEs(stats.costPerClose) : "—"}
        />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Registrar inversión publicitaria</h2>
        <form action={createAdSpendAction} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Fecha</label>
            <input type="date" name="date" defaultValue={todayISO()} required className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Fuente</label>
            <select name="source" defaultValue={LEAD_SOURCES[0]} className="input">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Invertido (€)</label>
            <input type="number" step="0.01" name="amount" required className="input w-28" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Leads</label>
            <input type="number" name="leads" min="0" defaultValue={0} className="input w-20" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Llamadas</label>
            <input type="number" name="calls_scheduled" min="0" defaultValue={0} className="input w-20" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Cierres</label>
            <input type="number" name="closes" min="0" defaultValue={0} className="input w-20" />
          </div>
          <div className="flex flex-1 min-w-[140px] flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Notas</label>
            <input name="notes" className="input" />
          </div>
          <button type="submit" className="btn btn-primary">
            Registrar
          </button>
        </form>
      </div>

      <div className="card p-4">
        <h2 className="mb-4 font-medium">En qué se va el dinero de publicidad</h2>
        {stats.bySource.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin inversión registrada en este periodo.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.bySource.map((s) => (
              <div key={s.source} className="flex items-center gap-3 text-sm">
                <div className="w-28 shrink-0">{s.source}</div>
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded bg-[var(--border)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${(s.amount / maxSourceAmount) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 shrink-0 text-right text-[var(--muted)]">{s.pctOfSpend.toFixed(0)}%</div>
                <div className="w-24 shrink-0 text-right font-medium">{formatCurrencyEs(s.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-x-auto p-4">
        <h2 className="mb-3 font-medium">Coste por cliente según de dónde viene</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="py-2 pr-4 font-medium">Fuente</th>
              <th className="py-2 pr-4 font-medium">Invertido</th>
              <th className="py-2 pr-4 font-medium">% gasto</th>
              <th className="py-2 pr-4 font-medium">Leads</th>
              <th className="py-2 pr-4 font-medium">Coste/lead</th>
              <th className="py-2 pr-4 font-medium">Llamadas</th>
              <th className="py-2 pr-4 font-medium">Coste/llamada</th>
              <th className="py-2 pr-4 font-medium">Clientes nuevos</th>
              <th className="py-2 font-medium">Coste/cliente</th>
            </tr>
          </thead>
          <tbody>
            {stats.bySource.map((s) => (
              <tr key={s.source} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-4">{s.source}</td>
                <td className="py-2 pr-4">{formatCurrencyEs(s.amount)}</td>
                <td className="py-2 pr-4">{s.pctOfSpend.toFixed(1)}%</td>
                <td className="py-2 pr-4">{s.leads}</td>
                <td className="py-2 pr-4">{s.costPerLead != null ? formatCurrencyEs(s.costPerLead) : "—"}</td>
                <td className="py-2 pr-4">{s.calls}</td>
                <td className="py-2 pr-4">{s.costPerCall != null ? formatCurrencyEs(s.costPerCall) : "—"}</td>
                <td className="py-2 pr-4">{s.clientCount}</td>
                <td className="py-2">{s.costPerClient != null ? formatCurrencyEs(s.costPerClient) : "—"}</td>
              </tr>
            ))}
            {stats.bySource.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--muted)]">
                  Sin datos en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Invertido</th>
              <th className="px-4 py-3 font-medium">Leads</th>
              <th className="px-4 py-3 font-medium">Llamadas</th>
              <th className="px-4 py-3 font-medium">Cierres</th>
              <th className="px-4 py-3 font-medium">Notas</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {recentEntries.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">{formatDateEs(e.date)}</td>
                <td className="px-4 py-3">{e.source}</td>
                <td className="px-4 py-3 font-medium">{formatCurrencyEs(e.amount)}</td>
                <td className="px-4 py-3">{e.leads}</td>
                <td className="px-4 py-3">{e.calls_scheduled}</td>
                <td className="px-4 py-3">{e.closes}</td>
                <td className="px-4 py-3">{e.notes ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteAdSpendAction.bind(null, e.id)}>
                    <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar este registro?">
                      Eliminar
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {recentEntries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--muted)]">
                  No hay inversión registrada en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
