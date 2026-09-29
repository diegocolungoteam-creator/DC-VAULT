export type ClientStatus = "activo" | "inactivo" | "baja";
export type BillingCycle = "mensual" | "trimestral" | "semestral" | "anual";
export type RevisionStatus = "pendiente" | "realizada" | "cancelada";

export interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  enrollment_date: string | null;
  plan: string | null;
  fee: number | null;
  billing_cycle: BillingCycle;
  renewal_date: string | null;
  source: string | null;
  created_at: string;
}

export interface AdSpendEntry {
  id: number;
  date: string;
  source: string;
  amount: number;
  leads: number;
  calls_scheduled: number;
  closes: number;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  client_id: number;
  date: string;
  amount: number;
  method: string | null;
  concept: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
}

export interface Revision {
  id: number;
  client_id: number;
  scheduled_date: string;
  done_date: string | null;
  status: RevisionStatus;
  notes: string | null;
  created_at: string;
}

export const EXPENSE_CATEGORIES = [
  "alquiler",
  "suministros",
  "material",
  "marketing",
  "nominas",
  "impuestos",
  "seguros",
  "software",
  "otros",
] as const;

export const PAYMENT_METHODS = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "bizum",
  "domiciliacion",
  "otro",
] as const;

export const REVISION_ALERT_THRESHOLD_DAYS = 60;

export const LEAD_SOURCES = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "Orgánico",
  "Referidos",
  "Otro",
] as const;

export type CallOutcome = "pendiente" | "cerrada" | "seguimiento" | "perdida" | "no_venta";

export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "cerrada", label: "Cerrada" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "perdida", label: "Perdida" },
  { value: "no_venta", label: "No es venta" },
  { value: "pendiente", label: "Sin analizar" },
];

export interface SalesCall {
  id: number;
  fathom_recording_id: string;
  title: string;
  date: string;
  started_at: string | null;
  duration_min: number | null;
  url: string | null;
  closer_name: string | null;
  closer_email: string | null;
  prospect_name: string | null;
  prospect_email: string | null;
  client_id: number | null;
  summary: string | null;
  transcript: string | null;
  closer_talk_pct: number | null;
  closer_questions: number | null;
  outcome: CallOutcome;
  outcome_source: "auto" | "claude" | "manual";
  amount: number | null;
  score: number | null;
  analysis: string | null;
  analyzed_at: string | null;
  notes: string | null;
  created_at: string;
}
