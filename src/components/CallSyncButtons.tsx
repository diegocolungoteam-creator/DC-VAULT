"use client";

import { useState, useTransition } from "react";
import { analyzePendingCallsAction, syncFathomCallsAction } from "@/lib/callActions";

export function CallSyncButtons({ unanalyzed }: { unanalyzed: number }) {
  const [isSyncing, startSync] = useTransition();
  const [isAnalyzing, startAnalyze] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isSyncing || isAnalyzing}
          onClick={() => {
            startSync(async () => {
              const r = await syncFathomCallsAction();
              setMessage(
                r.errors.length > 0 ? r.errors[0] : `${r.imported} llamada(s) nueva(s), ${r.updated} actualizada(s)`
              );
            });
          }}
        >
          {isSyncing ? "Sincronizando..." : "Sincronizar con Fathom"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isSyncing || isAnalyzing || unanalyzed === 0}
          onClick={() => {
            startAnalyze(async () => {
              const r = await analyzePendingCallsAction();
              setMessage(
                r.errors.length > 0
                  ? `${r.analyzed} analizada(s). Error: ${r.errors[0]}`
                  : `${r.analyzed} analizada(s)${r.remaining > 0 ? `, quedan ${r.remaining} (pulsa otra vez)` : ""}`
              );
            });
          }}
        >
          {isAnalyzing ? "Analizando con Claude..." : `Analizar con Claude (${unanalyzed})`}
        </button>
      </div>
      {message && <p className="max-w-sm text-right text-xs text-[var(--muted)]">{message}</p>}
    </div>
  );
}
