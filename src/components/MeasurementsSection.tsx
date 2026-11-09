import { createMeasurementAction, deleteMeasurementAction } from "@/lib/actions";
import { formatDateEs, todayISO } from "@/lib/dates";
import { MEASUREMENT_FIELDS, type BodyMeasurement } from "@/lib/types";
import { ConfirmButton } from "./ConfirmButton";

function formatNum(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

export function MeasurementsSection({
  clientId,
  measurements,
}: {
  clientId: number;
  measurements: BodyMeasurement[]; // newest first
}) {
  // Progress per field: first value ever recorded vs. the latest one.
  const progress = MEASUREMENT_FIELDS.map((f) => {
    const withValue = measurements.filter((m) => m[f.key] != null);
    if (withValue.length === 0) return null;
    const latest = withValue[0][f.key] as number;
    const first = withValue[withValue.length - 1][f.key] as number;
    return { ...f, latest, delta: latest - first, points: withValue.length };
  }).filter((p) => p !== null);

  return (
    <section className="card p-4">
      <h2 className="mb-3 font-medium">Cambios físicos</h2>

      <form action={createMeasurementAction} className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-4">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input type="date" name="date" defaultValue={todayISO()} required className="input" />
          {MEASUREMENT_FIELDS.map((f) => (
            <input
              key={f.key}
              name={f.key}
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder={`${f.label} (${f.unit})`}
              className="input"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input name="photos_url" type="url" placeholder="Link a las fotos (Drive, etc.)" className="input" />
          <input name="notes" placeholder="Notas (opcional)" className="input" />
        </div>
        <button type="submit" className="btn btn-primary self-start">
          Guardar medición
        </button>
      </form>

      {progress.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {progress.map((p) => (
            <div key={p.key} className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xs text-[var(--muted)]">{p.label}</div>
              <div className="text-sm font-medium">
                {formatNum(p.latest)} {p.unit}
              </div>
              {p.points > 1 && (
                <div className="text-xs text-[var(--muted)]">
                  {p.delta > 0 ? "+" : ""}
                  {formatNum(p.delta)} {p.unit} desde el inicio
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {measurements.length === 0 ? (
        <p className="py-4 text-sm text-[var(--muted)]">Sin mediciones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">Fecha</th>
                {MEASUREMENT_FIELDS.map((f) => (
                  <th key={f.key} className="py-2 pr-3 font-medium">
                    {f.label}
                  </th>
                ))}
                <th className="py-2 pr-3 font-medium">Fotos / notas</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {measurements.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateEs(m.date)}</td>
                  {MEASUREMENT_FIELDS.map((f) => (
                    <td key={f.key} className="py-2 pr-3">
                      {m[f.key] != null ? formatNum(m[f.key] as number) : "—"}
                    </td>
                  ))}
                  <td className="py-2 pr-3 text-xs text-[var(--muted)]">
                    {m.photos_url && (
                      <a href={m.photos_url} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                        Fotos
                      </a>
                    )}
                    {m.photos_url && m.notes && " · "}
                    {m.notes}
                  </td>
                  <td className="py-2 text-right">
                    <form action={deleteMeasurementAction.bind(null, m.id, clientId)}>
                      <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar esta medición?">
                        Eliminar
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
