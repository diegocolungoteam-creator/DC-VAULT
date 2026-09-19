import { notFound } from "next/navigation";
import { updateClientAction } from "@/lib/actions";
import { getClient } from "@/lib/queries";
import { ClientForm } from "@/components/ClientForm";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const client = getClient(clientId);
  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Editar cliente</h1>
        <p className="text-sm text-[var(--muted)]">{client.name}</p>
      </div>
      <div className="card max-w-3xl p-6">
        <ClientForm
          action={updateClientAction.bind(null, clientId)}
          defaultValues={client}
          submitLabel="Guardar cambios"
        />
      </div>
    </div>
  );
}
