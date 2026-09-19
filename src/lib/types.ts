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

export const LEAD_SOURCES = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "Orgánico",
  "Referidos",
  "Otro",
] as const;
