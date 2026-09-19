import { createClientAction } from "@/lib/actions";
import { ClientForm } from "@/components/ClientForm";

export default function NuevoClientePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Nuevo cliente</h1>
        <p className="text-sm text-[var(--muted)]">Da de alta un nuevo cliente</p>
      </div>
      <div className="card max-w-3xl p-6">
        <ClientForm action={createClientAction} submitLabel="Guardar cliente" />
      </div>
    </div>
  );
}
