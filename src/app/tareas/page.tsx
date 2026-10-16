import Link from "next/link";
import {
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  reopenTaskAction,
} from "@/lib/actions";
import { listClients, listTasks } from "@/lib/queries";
import { TaskStatusBadge } from "@/components/Badges";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateEs, todayISO } from "@/lib/dates";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as TaskStatus | undefined) || undefined;
  const tasks = listTasks({ status });
  const clients = listClients({ status: "todos" });
  const today = todayISO();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Avisos / Tareas pendientes</h1>
        <p className="text-sm text-[var(--muted)]">
          Recordatorios sueltos: avisar a un lead, llamar a alguien, hacer un seguimiento...
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Nueva tarea</h2>
        <form action={createTaskAction} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 min-w-[200px] flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Título</label>
            <input name="title" required placeholder="Avisar a Juan por el lead" className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Fecha límite</label>
            <input type="date" name="due_date" defaultValue={today} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Cliente/lead (opcional)</label>
            <select name="client_id" className="input min-w-[180px]">
              <option value="">-- ninguno --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 min-w-[160px] flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Notas</label>
            <input name="notes" className="input" />
          </div>
          <button type="submit" className="btn btn-primary">
            Añadir
          </button>
        </form>
      </div>

      <div className="flex gap-2 text-sm">
        <Link href="/tareas" className={`btn ${!status ? "btn-primary" : "btn-secondary"}`}>
          Todas
        </Link>
        <Link
          href="/tareas?status=pendiente"
          className={`btn ${status === "pendiente" ? "btn-primary" : "btn-secondary"}`}
        >
          Pendientes
        </Link>
        <Link
          href="/tareas?status=completada"
          className={`btn ${status === "completada" ? "btn-primary" : "btn-secondary"}`}
        >
          Completadas
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Fecha límite</th>
              <th className="px-4 py-3 font-medium">Tarea</th>
              <th className="px-4 py-3 font-medium">Cliente/lead</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Notas</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                <td
                  className={`px-4 py-3 ${
                    t.status === "pendiente" && t.due_date && t.due_date < today
                      ? "text-[var(--danger)] font-medium"
                      : ""
                  }`}
                >
                  {t.due_date ? formatDateEs(t.due_date) : "—"}
                </td>
                <td className="px-4 py-3">{t.title}</td>
                <td className="px-4 py-3">
                  {t.client_id && t.client_name ? (
                    <Link href={`/clientes/${t.client_id}`} className="hover:underline">
                      {t.client_name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <TaskStatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3">{t.notes ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {t.status === "pendiente" ? (
                      <form action={completeTaskAction.bind(null, t.id)}>
                        <button type="submit" className="text-xs text-[var(--success)]">
                          Completar
                        </button>
                      </form>
                    ) : (
                      <form action={reopenTaskAction.bind(null, t.id)}>
                        <button type="submit" className="text-xs text-[var(--muted)]">
                          Reabrir
                        </button>
                      </form>
                    )}
                    <form action={deleteTaskAction.bind(null, t.id)}>
                      <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar esta tarea?">
                        Eliminar
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No hay tareas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
