"use client";

import { useState, useTransition } from "react";
import { syncCheckinsFromSheetAction, type CheckinSyncResult } from "@/lib/checkinSyncActions";

export function SheetCheckinSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckinSyncResult | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const r = await syncCheckinsFromSheetAction();
            setResult(r);
          });
        }}
      >
        {isPending ? "Sincronizando..." : "Sincronizar check-ins (Google Sheets)"}
      </button>
      {result && (
        <p className="max-w-xs text-right text-xs text-[var(--muted)]">
          {result.errors.length > 0 && !result.imported && !result.updated
            ? result.errors[0]
            : `${result.imported} nuevo(s), ${result.updated} actualizado(s), ${result.skipped} omitido(s)`}
        </p>
      )}
    </div>
  );
}
