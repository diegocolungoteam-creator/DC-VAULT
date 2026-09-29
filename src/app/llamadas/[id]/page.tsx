import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient, getSalesCall } from "@/lib/queries";
import { reanalyzeCallAction, updateCallOutcomeAction } from "@/lib/callActions";
import { OBJECTION_LABELS, type CallAnalysis } from "@/lib/callAnalysis";
import type { FathomTranscriptItem } from "@/lib/fathom";
import { CallOutcomeBadge } from "@/components/Badges";
import { formatCurrencyEs, formatDateEs } from "@/lib/dates";
import { CALL_OUTCOMES } from "@/lib/types";

export const dynamic = "force-dynamic";

const PHASE_LABELS: Record<keyof CallAnalysis["fases"], string> = {
  conexion: "Conexión",
  descubrimiento: "Descubrimiento",
  dolor: "Dolor / urgencia",
  presentacion: "Presentación",
  cierre: "Cierre",
};

export default async function LlamadaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = getSalesCall(Number(id));
  if (!call) notFound();

  const analysis = call.analysis ? (JSON.parse(call.analysis) as CallAnalysis) : null;
  const transcript = call.transcript ? (JSON.parse(call.transcript) as FathomTranscriptItem[]) : [];
  const client = call.client_id ? getClient(call.client_id) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/llamadas" className="text-sm text-[var(--muted)] hover:underline">
            ← Llamadas
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            {call.prospect_name ?? call.title} <CallOutcomeBadge outcome={call.outcome} />
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {formatDateEs(call.date)}
            {call.duration_min != null && ` · ${Math.round(call.duration_min)} min`}
            {call.closer_name && ` · closer: ${call.closer_name}`}
            {call.prospect_email && ` · ${call.prospect_email}`}
          </p>
          {client && (
            <p className="text-sm">
              Cliente en el CRM:{" "}
              <Link href={`/clientes/${client.id}`} className="text-[var(--accent)] hover:underline">
                {client.name}
              </Link>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {call.url && (
            <a href={call.url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Ver en Fathom
            </a>
          )}
          {transcript.length > 0 && (
            <form action={reanalyzeCallAction.bind(null, call.id)}>
              <button type="submit" className="btn btn-primary">
                {analysis ? "Volver a analizar" : "Analizar con Claude"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Resultado</h2>
        <form action={updateCallOutcomeAction.bind(null, call.id)} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Resultado</label>
            <select name="outcome" defaultValue={call.outcome} className="input">
              {CALL_OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Importe (€)</label>
            <input type="number" step="0.01" name="amount" defaultValue={call.amount ?? ""} className="input w-32" />
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Notas</label>
            <input name="notes" defaultValue={call.notes ?? ""} className="input" />
          </div>
          <button type="submit" className="btn btn-secondary">
            Guardar
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {call.outcome_source === "manual"
            ? "Resultado fijado a mano: volver a analizar no lo cambia."
            : call.outcome_source === "claude"
              ? "Resultado detectado por Claude. Si no es correcto, cámbialo aquí."
              : "Aún sin analizar."}
        </p>
      </div>

      {analysis && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-1 font-medium">Análisis · {analysis.puntuacion_global}/10</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">{analysis.resumen}</p>
            <div className="flex flex-col gap-2">
              {(Object.keys(PHASE_LABELS) as (keyof CallAnalysis["fases"])[]).map((phase) => {
                const v = analysis.fases[phase];
                const color = v >= 7 ? "var(--success)" : v >= 5 ? "var(--warning)" : "var(--danger)";
                return (
                  <div key={phase} className="flex items-center gap-3 text-sm">
                    <div className="w-32 shrink-0">{PHASE_LABELS[phase]}</div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded bg-[var(--border)]">
                      <div className="h-full" style={{ width: `${v * 10}%`, background: color }} />
                    </div>
                    <div className="w-8 shrink-0 text-right font-medium">{v}</div>
                  </div>
                );
              })}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-[var(--muted)]">Plan</dt>
              <dd>{analysis.plan ?? "—"}</dd>
              <dt className="text-[var(--muted)]">Importe</dt>
              <dd>{analysis.importe != null ? formatCurrencyEs(analysis.importe) : "—"}</dd>
              <dt className="text-[var(--muted)]">Forma de pago</dt>
              <dd>{analysis.forma_de_pago ?? "—"}</dd>
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="mb-2 font-medium">Objeciones</h2>
            {analysis.objeciones.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Ninguna.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-2 text-sm">
                {analysis.objeciones.map((o, i) => (
                  <li key={i}>
                    <span className="font-medium">{OBJECTION_LABELS[o.tipo]}</span>{" "}
                    <span style={{ color: o.superada ? "var(--success)" : "var(--danger)" }}>
                      {o.superada ? "· resuelta" : "· sin resolver"}
                    </span>
                    <div className="text-[var(--muted)]">{o.detalle}</div>
                  </li>
                ))}
              </ul>
            )}
            <h2 className="mb-2 font-medium">Lo que hiciste bien</h2>
            <ul className="mb-4 list-disc pl-5 text-sm">
              {analysis.puntos_fuertes.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <h2 className="mb-2 font-medium">Qué mejorar</h2>
            <ul className="list-disc pl-5 text-sm">
              {analysis.mejoras.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-medium">Métricas de la conversación</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-[var(--muted)]">% que habla el closer</dt>
            <dd>{call.closer_talk_pct != null ? `${call.closer_talk_pct.toFixed(0)}%` : "—"}</dd>
            <dt className="text-[var(--muted)]">Preguntas del closer</dt>
            <dd>{call.closer_questions ?? "—"}</dd>
          </dl>
          {call.summary && (
            <>
              <h2 className="mb-2 mt-4 font-medium">Resumen de Fathom</h2>
              <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--muted)]">
                {call.summary}
              </div>
            </>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-2 font-medium">Transcripción</h2>
          {transcript.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Fathom no ha devuelto transcripción para esta llamada.</p>
          ) : (
            <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto text-sm">
              {transcript.map((t, i) => (
                <p key={i}>
                  <span className="text-xs text-[var(--muted)]">{t.timestamp} </span>
                  <span className="font-medium">{t.speaker?.display_name ?? "?"}:</span> {t.text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
