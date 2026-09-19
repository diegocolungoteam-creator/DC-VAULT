import { getAvailableYears, getExpensesByCategory, getMonthlyBalance } from "@/lib/queries";
import { StatCard } from "@/components/StatCard";
import { formatCurrencyEs } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const years = getAvailableYears();
  const year = Number(params.year) || years[0] || new Date().getFullYear();

  const rows = getMonthlyBalance(year);
  const categories = getExpensesByCategory(year);

  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalBalance = totalIncome - totalExpense;

  const maxAmount = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense)));
  const maxCategory = Math.max(1, ...categories.map((c) => c.total));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Contabilidad</h1>
          <p className="text-sm text-[var(--muted)]">Ingresos, gastos y balance por año</p>
        </div>
        <form className="flex items-center gap-2" method="get">
          <select name="year" defaultValue={year} className="input w-auto">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            Ver
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label={`Ingresos ${year}`} value={formatCurrencyEs(totalIncome)} tone="success" />
        <StatCard label={`Gastos ${year}`} value={formatCurrencyEs(totalExpense)} tone="danger" />
        <StatCard
          label={`Balance ${year}`}
          value={formatCurrencyEs(totalBalance)}
          tone={totalBalance >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="card p-4">
        <h2 className="mb-4 font-medium">Balance mensual</h2>
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div key={r.month} className="flex items-center gap-3 text-sm">
              <div className="w-8 shrink-0 text-[var(--muted)]">{MONTH_LABELS[i]}</div>
              <div className="flex-1">
                <div className="flex h-3 overflow-hidden rounded bg-[var(--border)]">
                  <div
                    className="h-full bg-[var(--success)]"
                    style={{ width: `${(r.income / maxAmount) * 50}%` }}
                  />
                </div>
                <div className="mt-1 flex h-3 overflow-hidden rounded bg-[var(--border)]">
                  <div
                    className="h-full bg-[var(--danger)]"
                    style={{ width: `${(r.expense / maxAmount) * 50}%` }}
                  />
                </div>
              </div>
              <div className="w-24 shrink-0 text-right font-medium" style={{ color: r.balance >= 0 ? "var(--success)" : "var(--danger)" }}>
                {formatCurrencyEs(r.balance)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Ingresos
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--danger)]" /> Gastos
          </span>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">Mes</th>
                <th className="py-2 pr-4 font-medium">Ingresos</th>
                <th className="py-2 pr-4 font-medium">Gastos</th>
                <th className="py-2 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.month} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4">{MONTH_LABELS[i]}</td>
                  <td className="py-2 pr-4 text-[var(--success)]">{formatCurrencyEs(r.income)}</td>
                  <td className="py-2 pr-4 text-[var(--danger)]">{formatCurrencyEs(r.expense)}</td>
                  <td className="py-2 font-medium">{formatCurrencyEs(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-4 font-medium">Gastos por categoría ({year})</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin gastos registrados este año.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3 text-sm">
                <div className="w-28 shrink-0 capitalize">{c.category}</div>
                <div className="flex-1">
                  <div className="h-3 overflow-hidden rounded bg-[var(--border)]">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${(c.total / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right font-medium">{formatCurrencyEs(c.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
