import Link from "next/link";
import {
  cancelRevisionAction,
  createRevisionAction,
  deleteRevisionAction,
  markRevisionDoneAction,
} from "@/lib/actions";
import { listClients, listRevisions } from "@/lib/queries";
import { RevisionStatusBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateEs, todayISO } from "@/lib/dates";
import type { RevisionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RevisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as RevisionStatus | undefined) || undefined;
  const revisions = listRevisions({ status });
  const clients = listClients({ status: "activo" });
  const today = todayISO();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Revisiones</h1>
        <p className="text-sm text-[var(--muted)]">Control de revisiones y seguimientos de clientes</p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Programar revisión</h2>
        <form action={createRevisionAction} className="flex flex-wrap items-end gap-2">
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
            <input type="date" name="scheduled_date" required className="input" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Notas</label>
            <input name="notes" className="input" />
          </div>
          <button type="submit" className="btn btn-primary">
            Programar
          </button>
        </form>
      </div>

      <div className="flex gap-2 text-sm">
        <Link href="/revisiones" className={`btn ${!status ? "btn-primary" : "btn-secondary"}`}>
          Todas
        </Link>
        <Link href="/revisiones?status=pendiente" className={`btn ${status === "pendiente" ? "btn-primary" : "btn-secondary"}`}>
          Pendientes
        </Link>
        <Link href="/revisiones?status=realizada" className={`btn ${status === "realizada" ? "btn-primary" : "btn-secondary"}`}>
          Realizadas
        </Link>
        <Link href="/revisiones?status=cancelada" className={`btn ${status === "cancelada" ? "btn-primary" : "btn-secondary"}`}>
          Canceladas
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Notas</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                <td className={`px-4 py-3 ${r.status === "pendiente" && r.scheduled_date < today ? "text-[var(--danger)] font-medium" : ""}`}>
                  {formatDateEs(r.scheduled_date)}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/clientes/${r.client_id}`} className="hover:underline">
                    {r.client_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <RevisionStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">{r.notes ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {r.status === "pendiente" && (
                      <>
                        <form action={markRevisionDoneAction.bind(null, r.id, r.client_id)}>
                          <button type="submit" className="text-xs text-[var(--success)]">
                            Marcar hecha
                          </button>
                        </form>
                        <form action={cancelRevisionAction.bind(null, r.id, r.client_id)}>
                          <button type="submit" className="text-xs text-[var(--muted)]">
                            Cancelar
                          </button>
                        </form>
                      </>
                    )}
                    <form action={deleteRevisionAction.bind(null, r.id, r.client_id)}>
                      <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar esta revisión?">
                        Eliminar
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {revisions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No hay revisiones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
