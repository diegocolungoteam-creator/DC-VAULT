"use client";

import { useState, useTransition } from "react";

export function DedupeButton({
  label,
  pendingLabel = "Buscando duplicados...",
  confirmMessage,
  action,
  // Use "{n}" as a placeholder for the deleted count.
  successTemplate = "{n} duplicado(s) eliminado(s)",
  emptyMessage = "No había duplicados",
  dangerous = false,
}: {
  label: string;
  pendingLabel?: string;
  confirmMessage: string;
  action: () => Promise<number>;
  successTemplate?: string;
  emptyMessage?: string;
  dangerous?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary"
        style={dangerous ? { color: "var(--danger)", borderColor: "var(--danger)" } : undefined}
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(confirmMessage)) return;
          startTransition(async () => {
            const deleted = await action();
            setResult(deleted);
          });
        }}
      >
        {isPending ? pendingLabel : label}
      </button>
      {result !== null && (
        <p className="max-w-xs text-right text-xs text-[var(--muted)]">
          {result > 0 ? successTemplate.replace("{n}", String(result)) : emptyMessage}
        </p>
      )}
    </div>
  );
}
