import {
  importClientsAction,
  importExpensesAction,
  importPaymentsAction,
  importRevisionsAction,
} from "@/lib/importActions";
import { ImportWizard, type ImportField } from "@/components/ImportWizard";

const CLIENT_FIELDS: ImportField[] = [
  { key: "name", label: "Nombre", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Teléfono" },
  { key: "address", label: "Dirección" },
  { key: "status", label: "Estado (activo/inactivo/baja)" },
  { key: "enrollment_date", label: "Fecha de inscripción" },
  { key: "plan", label: "Plan / cuota" },
  { key: "fee", label: "Importe cuota" },
  { key: "billing_cycle", label: "Periodicidad (mensual/trimestral/semestral/anual)" },
  { key: "renewal_date", label: "Próxima renovación" },
  { key: "source", label: "Fuente / cómo llegó" },
  { key: "notes", label: "Notas" },
];

const PAYMENT_FIELDS: ImportField[] = [
  { key: "client_match", label: "Cliente (nombre o email exacto)", required: true },
  { key: "date", label: "Fecha", required: true },
  { key: "amount", label: "Importe", required: true },
  { key: "method", label: "Método de pago" },
  { key: "concept", label: "Concepto" },
];

const EXPENSE_FIELDS: ImportField[] = [
  { key: "date", label: "Fecha", required: true },
  { key: "amount", label: "Importe", required: true },
  { key: "category", label: "Categoría" },
  { key: "description", label: "Descripción" },
];

const REVISION_FIELDS: ImportField[] = [
  { key: "client_match", label: "Cliente (nombre o email exacto)", required: true },
  { key: "scheduled_date", label: "Fecha programada" },
  { key: "done_date", label: "Fecha realizada" },
  { key: "status", label: "Estado (pendiente/realizada/cancelada)" },
  { key: "notes", label: "Notas" },
];

export default function ImportarPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Importar desde Google Sheets</h1>
        <p className="text-sm text-[var(--muted)]">
          Exporta cada hoja como CSV y súbela aquí para unificarla en el CRM. Los clientes deben importarse
          primero para poder relacionar sus pagos.
        </p>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Clientes</h2>
        <ImportWizard
          fields={CLIENT_FIELDS}
          action={importClientsAction}
          sampleHeader="nombre, email, telefono, fecha_inscripcion, plan, cuota, renovacion"
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Pagos</h2>
        <ImportWizard
          fields={PAYMENT_FIELDS}
          action={importPaymentsAction}
          sampleHeader="cliente, fecha, importe, metodo, concepto"
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Gastos</h2>
        <ImportWizard
          fields={EXPENSE_FIELDS}
          action={importExpensesAction}
          sampleHeader="fecha, importe, categoria, descripcion"
        />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">Revisiones</h2>
        <ImportWizard
          fields={REVISION_FIELDS}
          action={importRevisionsAction}
          sampleHeader="cliente, fecha_programada, fecha_realizada, estado, notas"
        />
      </section>
    </div>
  );
}
