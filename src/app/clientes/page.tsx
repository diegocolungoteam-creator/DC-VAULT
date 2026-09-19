import Link from "next/link";
import { listClients } from "@/lib/queries";
import { ClientStatusBadge } from "@/components/Badges";
import { formatCurrencyEs, formatDateEs } from "@/lib/dates";
import type { ClientStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as ClientStatus | "todos") || "todos";
  const q = params.q ?? "";
  const clients = listClients({ status, search: q || undefined });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-[var(--muted)]">{clients.length} resultado(s)</p>
        </div>
        <Link href="/clientes/nuevo" className="btn btn-primary">
          + Nuevo cliente
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, email o teléfono..."
          className="input max-w-sm"
        />
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="todos">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
          <option value="baja">Baja</option>
        </select>
        <button type="submit" className="btn btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Cuota</th>
              <th className="px-4 py-3 font-medium">Inscripción</th>
              <th className="px-4 py-3 font-medium">Renovación</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-soft)]">
                <td className="px-4 py-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  {c.email && <div className="text-xs text-[var(--muted)]">{c.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <ClientStatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3">{c.plan ?? "—"}</td>
                <td className="px-4 py-3">{c.fee != null ? formatCurrencyEs(c.fee) : "—"}</td>
                <td className="px-4 py-3">{formatDateEs(c.enrollment_date)}</td>
                <td className="px-4 py-3">{formatDateEs(c.renewal_date)}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  No se encontraron clientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
