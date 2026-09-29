import type { CallOutcome, ClientStatus, RevisionStatus } from "@/lib/types";

const CLIENT_STATUS_STYLE: Record<ClientStatus, { bg: string; fg: string; label: string }> = {
  activo: { bg: "#dcfce7", fg: "#166534", label: "Activo" },
  inactivo: { bg: "#fef9c3", fg: "#854d0e", label: "Inactivo" },
  baja: { bg: "#fee2e2", fg: "#991b1b", label: "Baja" },
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const s = CLIENT_STATUS_STYLE[status];
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

const REVISION_STATUS_STYLE: Record<RevisionStatus, { bg: string; fg: string; label: string }> = {
  pendiente: { bg: "#fef9c3", fg: "#854d0e", label: "Pendiente" },
  realizada: { bg: "#dcfce7", fg: "#166534", label: "Realizada" },
  cancelada: { bg: "#f3f4f6", fg: "#4b5563", label: "Cancelada" },
};

export function RevisionStatusBadge({ status }: { status: RevisionStatus }) {
  const s = REVISION_STATUS_STYLE[status];
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

const CALL_OUTCOME_STYLE: Record<CallOutcome, { bg: string; fg: string; label: string }> = {
  cerrada: { bg: "#dcfce7", fg: "#166534", label: "Cerrada" },
  seguimiento: { bg: "#dbeafe", fg: "#1e40af", label: "Seguimiento" },
  perdida: { bg: "#fee2e2", fg: "#991b1b", label: "Perdida" },
  no_venta: { bg: "#f3f4f6", fg: "#4b5563", label: "No es venta" },
  pendiente: { bg: "#fef9c3", fg: "#854d0e", label: "Sin analizar" },
};

export function CallOutcomeBadge({ outcome }: { outcome: CallOutcome }) {
  const s = CALL_OUTCOME_STYLE[outcome] ?? CALL_OUTCOME_STYLE.pendiente;
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
