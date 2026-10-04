"use client";

import { useState, useTransition } from "react";

export function DedupeButton({
  label,
  confirmMessage,
  action,
}: {
  label: string;
  confirmMessage: string;
  action: () => Promise<number>;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(confirmMessage)) return;
          startTransition(async () => {
            const deleted = await action();
            setResult(deleted);
          });
        }}
      >
        {isPending ? "Buscando duplicados..." : label}
      </button>
      {result !== null && (
        <p className="text-xs text-[var(--muted)]">
          {result > 0 ? `${result} duplicado(s) eliminado(s)` : "No había duplicados"}
        </p>
      )}
    </div>
  );
}
