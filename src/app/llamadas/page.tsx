import Link from "next/link";
import { countUnanalyzedCalls, getSalesCallStats, listSalesCalls } from "@/lib/queries";
import { StatCard } from "@/components/StatCard";
import { CallOutcomeBadge } from "@/components/Badges";
import { CallSyncButtons } from "@/components/CallSyncButtons";
import { OBJECTION_LABELS } from "@/lib/callAnalysis";
import { formatCurrencyEs, formatDateEs, monthStartISO, subtractDays, todayISO } from "@/lib/dates";
import type { CallOutcome } from "@/lib/types";

export const dynamic = "force-dynamic";

type Period = "mes" | "7d" | "30d" | "90d" | "custom";

function resolveRange(period: Period, fromParam?: string, toParam?: string) {
  const today = todayISO();
  if (period === "7d") return { from: subtractDays(today, 6), to: today };
  if (period === "30d") return { from: subtractDays(today, 29), to: today };
  if (period === "90d") return { from: subtractDays(today, 89), to: today };
  if (period === "custom" && fromParam && toParam) return { from: fromParam, to: toParam };
  return { from: monthStartISO(today), to: today };
}

const PHASE_LABELS: Record<string, string> = {
  conexion: "Conexión",
  descubrimiento: "Descubrimiento",
  dolor: "Dolor / urgencia",
  presentacion: "Presentación",
  cierre: "Cierre",
};

const OUTCOME_ORDER: { value: CallOutcome; label: string; color: string }[] = [
  { value: "cerrada", label: "Cerradas", color: "var(--success)" },
  { value: "seguimiento", label: "Seguimiento", color: "var(--accent)" },
  { value: "perdida", label: "Perdidas", color: "var(--danger)" },
  { value: "pendiente", label: "Sin analizar", color: "var(--warning)" },
];

const pct = (v: number | null) => (v != null ? `${v.toFixed(0)}%` : "—");
const mins = (v: number | null) => (v != null ? `${Math.round(v)} min` : "—");
const score = (v: number | null) => (v != null ? v.toFixed(1) : "—");

function talkTone(v: number | null): "default" | "success" | "warning" {
  if (v == null) return "default";
  return v <= 50 ? "success" : "warning";
}

export default async function LlamadasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = (params.period as Period) || "30d";
  const { from, to } = resolveRange(period, params.from, params.to);

  const calls = listSalesCalls({ from, to });
  const stats = getSalesCallStats(calls);
  const unanalyzed = countUnanalyzedCalls();
  const maxObjection = Math.max(1, ...stats.objections.map((o) => o.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Llamadas de venta</h1>
          <p className="text-sm text-[var(--muted)]">
            {formatDateEs(from)} — {formatDateEs(to)} · grabadas con Fathom
          </p>
        </div>
        <CallSyncButtons unanalyzed={unanalyzed} />
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <select name="period" defaultValue={period} className="input" style={{ width: "auto" }}>
          <option value="mes">Este mes</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
          <option value="custom">Personalizado...</option>
        </select>
        <input type="date" name="from" defaultValue={from} className="input" style={{ width: "auto" }} />
        <input type="date" name="to" defaultValue={to} className="input" style={{ width: "auto" }} />
        <button type="submit" className="btn btn-secondary">
          Ver
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Llamadas de venta" value={String(stats.totalCalls)} />
        <StatCard label="Cierres" value={String(stats.closes)} tone="success" />
        <StatCard
          label="Tasa de cierre"
          value={pct(stats.closeRate)}
          hint={`sobre ${stats.decidedCalls} llamadas con resultado`}
          tone="success"
        />
        <StatCard label="Facturación cerrada" value={formatCurrencyEs(stats.revenue)} tone="success" />
        <StatCard label="Ticket medio" value={stats.avgTicket != null ? formatCurrencyEs(stats.avgTicket) : "—"} />
        <StatCard
          label="€ por llamada"
          value={stats.revenuePerCall != null ? formatCurrencyEs(stats.revenuePerCall) : "—"}
          hint="facturación / llamadas con resultado"
        />
        <StatCard
          label="Duración media"
          value={mins(stats.avgDuration)}
          hint={`cerradas: ${mins(stats.avgClosedDuration)}`}
        />
        <StatCard
          label="% que hablas tú"
          value={pct(stats.avgTalkPct)}
          hint="ideal: 30-45%"
          tone={talkTone(stats.avgTalkPct)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-4 font-medium">Resultado de las llamadas</h2>
          {stats.totalCalls === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin llamadas en este periodo.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {OUTCOME_ORDER.map((o) => {
                const n = stats.byOutcome.get(o.value) ?? 0;
                return (
                  <div key={o.value} className="flex items-center gap-3 text-sm">
                    <div className="w-28 shrink-0">{o.label}</div>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-[var(--border)]">
                      <div
                        className="h-full"
                        style={{ width: `${(n / stats.totalCalls) * 100}%`, background: o.color }}
                      />
                    </div>
                    <div className="w-10 shrink-0 text-right font-medium">{n}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-1 font-medium">Nota media por fase</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Nota global: <span className="font-medium text-[var(--foreground)]">{score(stats.avgScore)}</span> / 10 ·
            según el análisis de Claude
          </p>
          {stats.phases.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Analiza las llamadas con Claude para ver dónde flojeas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.keys(PHASE_LABELS).map((phase) => {
                const p = stats.phases.find((x) => x.phase === phase);
                if (!p) return null;
                const color = p.avg >= 7 ? "var(--success)" : p.avg >= 5 ? "var(--warning)" : "var(--danger)";
                return (
                  <div key={phase} className="flex items-center gap-3 text-sm">
                    <div className="w-32 shrink-0">{PHASE_LABELS[phase]}</div>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-[var(--border)]">
                      <div className="h-full" style={{ width: `${p.avg * 10}%`, background: color }} />
                    </div>
                    <div className="w-10 shrink-0 text-right font-medium">{p.avg.toFixed(1)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto p-4">
        <h2 className="mb-3 font-medium">Objeciones más frecuentes</h2>
        {stats.objections.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin objeciones analizadas en este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">Objeción</th>
                <th className="py-2 pr-4 font-medium">Veces</th>
                <th className="py-2 pr-4 font-medium">Resuelta en la llamada</th>
                <th className="py-2 font-medium">Llamadas cerradas igualmente</th>
              </tr>
            </thead>
            <tbody>
              {stats.objections.map((o) => (
                <tr key={o.tipo} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4">
                    <div>{OBJECTION_LABELS[o.tipo as keyof typeof OBJECTION_LABELS] ?? o.tipo}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--border)]">
                      <div className="h-full bg-[var(--accent)]" style={{ width: `${(o.count / maxObjection) * 100}%` }} />
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-medium">{o.count}</td>
                  <td className="py-2 pr-4">{pct((o.overcome / o.count) * 100)}</td>
                  <td className="py-2">{o.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stats.byCloser.length > 1 && (
        <div className="card overflow-x-auto p-4">
          <h2 className="mb-3 font-medium">Por closer</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">Closer</th>
                <th className="py-2 pr-4 font-medium">Llamadas</th>
                <th className="py-2 pr-4 font-medium">Cierres</th>
                <th className="py-2 pr-4 font-medium">Tasa de cierre</th>
                <th className="py-2 pr-4 font-medium">Facturación</th>
                <th className="py-2 pr-4 font-medium">Nota media</th>
                <th className="py-2 font-medium">% habla</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCloser.map((c) => (
                <tr key={c.closer} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4">{c.closer}</td>
                  <td className="py-2 pr-4">{c.calls}</td>
                  <td className="py-2 pr-4">{c.closes}</td>
                  <td className="py-2 pr-4">{pct(c.closeRate)}</td>
                  <td className="py-2 pr-4">{formatCurrencyEs(c.revenue)}</td>
                  <td className="py-2 pr-4">{score(c.avgScore)}</td>
                  <td className="py-2">{pct(c.avgTalkPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Prospecto</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Importe</th>
              <th className="px-4 py-3 font-medium">Nota</th>
              <th className="px-4 py-3 font-medium">Duración</th>
              <th className="px-4 py-3 font-medium">% habla</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateEs(c.date)}</td>
                <td className="px-4 py-3">
                  <Link href={`/llamadas/${c.id}`} className="font-medium hover:underline">
                    {c.prospect_name ?? c.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <CallOutcomeBadge outcome={c.outcome} />
                </td>
                <td className="px-4 py-3">{c.amount != null ? formatCurrencyEs(c.amount) : "—"}</td>
                <td className="px-4 py-3">{score(c.score)}</td>
                <td className="px-4 py-3">{mins(c.duration_min)}</td>
                <td className="px-4 py-3">{pct(c.closer_talk_pct)}</td>
              </tr>
            ))}
            {calls.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  No hay llamadas en este periodo. Pulsa &quot;Sincronizar con Fathom&quot; para traerlas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
