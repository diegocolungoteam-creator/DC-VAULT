import { createExpenseAction, deleteExpenseAction } from "@/lib/actions";
import { listExpenses } from "@/lib/queries";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatCurrencyEs, formatDateEs, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GastosPage() {
  const expenses = listExpenses();
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Gastos</h1>
        <p className="text-sm text-[var(--muted)]">
          {expenses.length} gastos registrados · Total: {formatCurrencyEs(total)}
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Registrar gasto</h2>
        <form action={createExpenseAction} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Fecha</label>
            <input type="date" name="date" defaultValue={todayISO()} required className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Importe (€)</label>
            <input type="number" step="0.01" name="amount" required className="input w-32" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Categoría</label>
            <select name="category" defaultValue="general" className="input">
              <option value="general">general</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Descripción</label>
            <input name="description" className="input" />
          </div>
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
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Importe</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">{formatDateEs(e.date)}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-[var(--accent-soft)]">{e.category}</span>
                </td>
                <td className="px-4 py-3 font-medium text-[var(--danger)]">{formatCurrencyEs(e.amount)}</td>
                <td className="px-4 py-3">{e.description ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteExpenseAction.bind(null, e.id)}>
                    <ConfirmButton className="text-xs text-[var(--danger)]" confirmMessage="¿Eliminar este gasto?">
                      Eliminar
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">
                  No hay gastos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
