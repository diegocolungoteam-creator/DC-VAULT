"use client";

import { useActionState, useMemo, useState } from "react";
import { parseHeaderLine } from "@/lib/importParsers";
import type { ImportResult } from "@/lib/importActions";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ["nombre", "cliente", "name", "nombrecompleto"],
  email: ["email", "correo", "correoelectronico", "mail"],
  phone: ["telefono", "movil", "phone", "celular"],
  address: ["direccion", "address", "domicilio"],
  status: ["estado", "status"],
  source: ["fuente", "origen", "canal", "source"],
  enrollment_date: ["fechainscripcion", "fechaalta", "inscripcion", "alta", "fecharegistro"],
  plan: ["plan", "tarifa", "servicio"],
  fee: ["cuota", "importecuota", "precio", "tarifa", "importe"],
  billing_cycle: ["periodicidad", "ciclo", "frecuencia", "periodo"],
  renewal_date: ["fecharenovacion", "renovacion", "proximarenovacion", "vencimiento"],
  notes: ["notas", "observaciones", "comentarios"],
  client_match: ["cliente", "nombre", "email", "correo"],
  date: ["fecha"],
  amount: ["importe", "cantidad", "monto", "total"],
  method: ["metodo", "metodopago", "formapago"],
  concept: ["concepto", "descripcion"],
  category: ["categoria", "tipo"],
  description: ["descripcion", "detalle", "concepto"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function ImportWizard({
  fields,
  action,
  sampleHeader,
}: {
  fields: ImportField[];
  action: (prev: ImportResult | null, formData: FormData) => Promise<ImportResult>;
  sampleHeader: string;
}) {
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [state, formAction, isPending] = useActionState(action, null);

  const rowCount = useMemo(() => {
    if (!csvText) return 0;
    return Math.max(0, csvText.trim().split("\n").length - 1);
  }, [csvText]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    setCsvText(text);
    const firstLine = text.split("\n")[0] ?? "";
    const detected = parseHeaderLine(firstLine);
    setHeaders(detected);

    const autoMapping: Record<string, string> = {};
    for (const field of fields) {
      const candidates = [field.key, ...(FIELD_SYNONYMS[field.key] ?? [])].map(normalize);
      const found = detected.find((h) => candidates.includes(normalize(h)));
      if (found) autoMapping[field.key] = found;
    }
    setMapping(autoMapping);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">1. Selecciona el archivo CSV exportado de Google Sheets</label>
        <p className="text-xs text-[var(--muted)]">
          En Google Sheets: Archivo → Descargar → Valores separados por comas (.csv). Ejemplo de columnas
          esperadas: <code>{sampleHeader}</code>
        </p>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="input" />
        {fileName && (
          <p className="text-xs text-[var(--muted)]">
            {fileName} · {rowCount} fila(s) detectada(s)
          </p>
        )}
      </div>

      {headers.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">2. Relaciona cada campo con una columna del CSV</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--muted)]">
                    {field.label}
                    {field.required && <span className="text-[var(--danger)]"> *</span>}
                  </label>
                  <select
                    className="input"
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  >
                    <option value="">-- no usar --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <form action={formAction}>
            <input type="hidden" name="csv_text" value={csvText} />
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            <button type="submit" disabled={isPending} className="btn btn-primary">
              {isPending ? "Importando..." : "3. Importar"}
            </button>
          </form>
        </>
      )}

      {state && (
        <div className="card p-4">
          <p className="text-sm font-medium">
            {state.inserted} importado(s), {state.skipped} omitido(s)
          </p>
          {state.errors.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-[var(--muted)]">
              {state.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
