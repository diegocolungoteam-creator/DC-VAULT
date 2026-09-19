"use client";

import { useState, useTransition } from "react";
import { syncGhlContactsAction, type GhlSyncResult } from "@/lib/ghlActions";

export function GhlSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GhlSyncResult | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const r = await syncGhlContactsAction();
            setResult(r);
          });
        }}
      >
        {isPending ? "Sincronizando..." : "Sincronizar con GoHighLevel"}
      </button>
      {result && (
        <p className="max-w-xs text-right text-xs text-[var(--muted)]">
          {result.errors.length > 0
            ? result.errors[0]
            : `${result.imported} importado(s), ${result.skipped} ya existían`}
        </p>
      )}
    </div>
  );
}
