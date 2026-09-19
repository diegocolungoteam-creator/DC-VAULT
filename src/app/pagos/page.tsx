import Link from "next/link";
import { createPaymentAction, deletePaymentAction } from "@/lib/actions";
import { listClients, listPaymentsWithClient } from "@/lib/queries";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatCurrencyEs, formatDateEs, todayISO } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PagosPage() {
  const payments = listPaymentsWithClient();
  const clients = listClients({ status: "todos" });
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Pagos</h1>
        <p className="text-sm text-[var(--muted)]">
          {payments.length} pagos registrados · Total: {formatCurrencyEs(total)}
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Registrar pago</h2>
        <form action={createPaymentAction} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Cliente</label>
            <select name="client_id" required className="input min-w-[180px]">
              <option value="">Selecciona...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Fecha</label>
            <input type="date" name="date" defaultValue={todayISO()} required className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Importe (€)</label>
            <input type="number" step="0.01" name="amount" required className="input w-32" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Método</label>
            <select name="method" defaultValue="" className="input">
              <option value="">...</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Concepto</label>
            <input name="concept" className="input" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs text-[var(--muted)]">
            <input type="checkbox" name="advance_renewal" defaultChecked />
            Actualizar renovación
          </label>
          <button type="submit" className="btn btn-primary">
            Registrar
          </button>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Importe</th>
              <th className="px-4 py-3 font-medium">Método</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">{formatDateEs(p.date)}</td>
                <td className="px-4 py-3">
                  <Link href={`/clientes/${p.client_id}`} className="hover:underline">
                    {p.client_name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium text-[var(--success)]">{formatCurrencyEs(p.amount)}</td>
                <td className="px-4 py-3">{p.method ?? "—"}</td>
                <td className="px-4 py-3">{p.concept ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deletePaymentAction.bind(null, p.id, p.client_id)}>
                    <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar este pago?">
                      Eliminar
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No hay pagos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
