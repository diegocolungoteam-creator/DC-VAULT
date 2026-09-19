import type { BillingCycle } from "./types";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addCycle(dateISO: string, cycle: BillingCycle): string {
  const d = new Date(dateISO + "T00:00:00");
  const months = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }[cycle];
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00");
  const to = new Date(toISO + "T00:00:00");
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function formatDateEs(dateISO: string | null): string {
  if (!dateISO) return "—";
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatCurrencyEs(amount: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7); // YYYY-MM
}
