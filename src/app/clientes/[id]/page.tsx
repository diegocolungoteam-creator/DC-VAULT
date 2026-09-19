import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createPaymentAction,
  createRevisionAction,
  deleteClientAction,
  deletePaymentAction,
  deleteRevisionAction,
  markRevisionDoneAction,
  cancelRevisionAction,
} from "@/lib/actions";
import { getClient, listPayments, listRevisions } from "@/lib/queries";
import { ClientStatusBadge, RevisionStatusBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { daysBetween, formatCurrencyEs, formatDateEs, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS, REVISION_ALERT_THRESHOLD_DAYS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const client = getClient(clientId);
  if (!client) notFound();

  const payments = listPayments({ clientId });
  const revisions = listRevisions({ clientId });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const lastRevisionDate = revisions
    .filter((r) => r.status === "realizada" && r.done_date)
    .map((r) => r.done_date as string)
    .sort()
    .at(-1);
  const daysSinceRevision = lastRevisionDate ? daysBetween(lastRevisionDate, todayISO()) : null;
  const revisionOverdue = client.status === "activo" && (daysSinceRevision == null || daysSinceRevision >= REVISION_ALERT_THRESHOLD_DAYS);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{client.name}</h1>
            <ClientStatusBadge status={client.status} />
          </div>
          <p className="text-sm text-[var(--muted)]">
            {client.email ?? "Sin email"} · {client.phone ?? "Sin teléfono"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clientes/${client.id}/editar`} className="btn btn-secondary">
            Editar
          </Link>
          <form action={deleteClientAction.bind(null, client.id)}>
            <ConfirmButton
              className="btn btn-danger"
              confirmMessage={`¿Eliminar a ${client.name}? Se borrarán también sus pagos y revisiones.`}
            >
              Eliminar
            </ConfirmButton>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoBox label="Fecha inscripción" value={formatDateEs(client.enrollment_date)} />
        <InfoBox label="Plan" value={client.plan ?? "—"} />
        <InfoBox
          label="Cuota"
          value={client.fee != null ? `${formatCurrencyEs(client.fee)} / ${client.billing_cycle}` : "—"}
        />
        <InfoBox label="Próxima renovación" value={formatDateEs(client.renewal_date)} />
        <InfoBox label="Fuente" value={client.source ?? "—"} />
        <InfoBox
          label="Última revisión"
          value={
            lastRevisionDate
              ? `${formatDateEs(lastRevisionDate)} (hace ${daysSinceRevision} días)`
              : "Nunca revisado"
          }
          danger={revisionOverdue}
        />
      </div>

      {client.address && <InfoBox label="Dirección" value={client.address} />}
      {client.notes && (
        <div className="card p-4">
          <div className="text-xs font-medium text-[var(--muted)]">Notas</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{client.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Pagos</h2>
            <span className="text-sm text-[var(--muted)]">Total: {formatCurrencyEs(totalPaid)}</span>
          </div>

          <form action={createPaymentAction} className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-4">
            <input type="hidden" name="client_id" value={client.id} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="date" defaultValue={todayISO()} required className="input" />
              <input type="number" step="0.01" name="amount" placeholder="Importe (€)" required className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select name="method" defaultValue="" className="input">
                <option value="">Método...</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input name="concept" placeholder="Concepto (opcional)" className="input" />
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" name="advance_renewal" defaultChecked />
              Actualizar próxima fecha de renovación según periodicidad
            </label>
            <button type="submit" className="btn btn-primary self-start">
              Registrar pago
            </button>
          </form>

          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="font-medium">{formatCurrencyEs(p.amount)}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {formatDateEs(p.date)} {p.method && `· ${p.method}`} {p.concept && `· ${p.concept}`}
                  </div>
                </div>
                <form action={deletePaymentAction.bind(null, p.id, client.id)}>
                  <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar este pago?">
                    Eliminar
                  </ConfirmButton>
                </form>
              </li>
            ))}
            {payments.length === 0 && <p className="py-4 text-sm text-[var(--muted)]">Sin pagos registrados.</p>}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-medium">Revisiones</h2>

          <form
            action={createRevisionAction}
            className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-4"
          >
            <input type="hidden" name="client_id" value={client.id} />
            <input type="date" name="scheduled_date" required className="input" />
            <input name="notes" placeholder="Notas (opcional)" className="input" />
            <button type="submit" className="btn btn-primary self-start">
              Programar revisión
            </button>
          </form>

          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatDateEs(r.scheduled_date)}</span>
                    <RevisionStatusBadge status={r.status} />
                  </div>
                  {r.notes && <div className="text-xs text-[var(--muted)]">{r.notes}</div>}
                  {r.done_date && (
                    <div className="text-xs text-[var(--muted)]">Realizada: {formatDateEs(r.done_date)}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "pendiente" && (
                    <>
                      <form action={markRevisionDoneAction.bind(null, r.id, client.id)}>
                        <button type="submit" className="text-xs text-[var(--success)]">
                          Marcar hecha
                        </button>
                      </form>
                      <form action={cancelRevisionAction.bind(null, r.id, client.id)}>
                        <button type="submit" className="text-xs text-[var(--muted)]">
                          Cancelar
                        </button>
                      </form>
                    </>
                  )}
                  <form action={deleteRevisionAction.bind(null, r.id, client.id)}>
                    <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar esta revisión?">
                      Eliminar
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
            {revisions.length === 0 && <p className="py-4 text-sm text-[var(--muted)]">Sin revisiones programadas.</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function InfoBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-sm font-medium ${danger ? "text-[var(--danger)]" : ""}`}>{value}</div>
    </div>
  );
}
