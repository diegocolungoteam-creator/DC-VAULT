import type { Client } from "@/lib/types";

export function ClientForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  defaultValues?: Partial<Client>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nombre" name="name" required defaultValue={defaultValues?.name} />
        <Field label="Email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        <Field label="Teléfono" name="phone" defaultValue={defaultValues?.phone ?? ""} />
        <Field label="Dirección" name="address" defaultValue={defaultValues?.address ?? ""} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Estado</label>
          <select name="status" defaultValue={defaultValues?.status ?? "activo"} className="input">
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        <Field
          label="Fecha de inscripción"
          name="enrollment_date"
          type="date"
          defaultValue={defaultValues?.enrollment_date ?? ""}
        />

        <Field label="Plan / cuota" name="plan" defaultValue={defaultValues?.plan ?? ""} />
        <Field
          label="Importe cuota (€)"
          name="fee"
          type="number"
          step="0.01"
          defaultValue={defaultValues?.fee != null ? String(defaultValues.fee) : ""}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Periodicidad de cobro</label>
          <select name="billing_cycle" defaultValue={defaultValues?.billing_cycle ?? "mensual"} className="input">
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>

        <Field
          label="Próxima fecha de renovación"
          name="renewal_date"
          type="date"
          defaultValue={defaultValues?.renewal_date ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Notas</label>
        <textarea name="notes" defaultValue={defaultValues?.notes ?? ""} rows={4} className="input" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-[var(--danger)]"> *</span>}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className="input"
      />
    </div>
  );
}
