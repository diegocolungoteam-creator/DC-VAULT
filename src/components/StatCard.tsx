export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneColor = {
    default: "var(--foreground)",
    success: "var(--success)",
    danger: "var(--danger)",
    warning: "var(--warning)",
  }[tone];

  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: toneColor }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}
