"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { addCycle, todayISO } from "./dates";
import { getClient } from "./queries";
import type { BillingCycle, ClientStatus } from "./types";

// ---------- Clients ----------

export interface ClientInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status: ClientStatus;
  enrollment_date?: string | null;
  plan?: string | null;
  fee?: number | null;
  billing_cycle: BillingCycle;
  renewal_date?: string | null;
  source?: string | null;
}

export async function createClientAction(formData: FormData) {
  const db = getDb();
  const input = parseClientForm(formData);
  db.prepare(
    `INSERT INTO clients (name, email, phone, address, notes, status, enrollment_date, plan, fee, billing_cycle, renewal_date, source)
     VALUES (:name, :email, :phone, :address, :notes, :status, :enrollment_date, :plan, :fee, :billing_cycle, :renewal_date, :source)`
  ).run(input as unknown as Record<string, string | number | null>);
  revalidatePath("/clientes");
  revalidatePath("/");
  redirect("/clientes");
}

export async function updateClientAction(id: number, formData: FormData) {
  const db = getDb();
  const input = parseClientForm(formData);
  db.prepare(
    `UPDATE clients SET name=:name, email=:email, phone=:phone, address=:address, notes=:notes,
     status=:status, enrollment_date=:enrollment_date, plan=:plan, fee=:fee,
     billing_cycle=:billing_cycle, renewal_date=:renewal_date, source=:source WHERE id=:id`
  ).run({ ...(input as unknown as Record<string, string | number | null>), id });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/");
  redirect(`/clientes/${id}`);
}

export async function deleteClientAction(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  revalidatePath("/clientes");
  revalidatePath("/");
  redirect("/clientes");
}

function parseClientForm(formData: FormData): ClientInput {
  const feeRaw = formData.get("fee") as string;
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
    notes: (formData.get("notes") as string) || null,
    status: (formData.get("status") as ClientStatus) || "activo",
    enrollment_date: (formData.get("enrollment_date") as string) || null,
    plan: (formData.get("plan") as string) || null,
    fee: feeRaw ? Number(feeRaw) : null,
    billing_cycle: (formData.get("billing_cycle") as BillingCycle) || "mensual",
    renewal_date: (formData.get("renewal_date") as string) || null,
    source: (formData.get("source") as string) || null,
  };
}

// ---------- Payments ----------

export async function createPaymentAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get("client_id"));
  const date = String(formData.get("date") ?? todayISO());
  const amount = Number(formData.get("amount"));
  const method = (formData.get("method") as string) || null;
  const concept = (formData.get("concept") as string) || null;
  const advanceRenewal = formData.get("advance_renewal") === "on";

  db.prepare(
    `INSERT INTO payments (client_id, date, amount, method, concept)
     VALUES (:client_id, :date, :amount, :method, :concept)`
  ).run({ client_id: clientId, date, amount, method, concept });

  if (advanceRenewal) {
    const client = getClient(clientId);
    if (client) {
      const base = client.renewal_date && client.renewal_date > date ? client.renewal_date : date;
      const nextRenewal = addCycle(base, client.billing_cycle);
      db.prepare("UPDATE clients SET renewal_date = ? WHERE id = ?").run(nextRenewal, clientId);
    }
  }

  revalidatePath("/pagos");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  revalidatePath("/contabilidad");
  redirect(`/clientes/${clientId}`);
}

export async function deletePaymentAction(id: number, clientId: number) {
  const db = getDb();
  db.prepare("DELETE FROM payments WHERE id = ?").run(id);
  revalidatePath("/pagos");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  revalidatePath("/contabilidad");
}

// ---------- Expenses ----------

export async function createExpenseAction(formData: FormData) {
  const db = getDb();
  const date = String(formData.get("date") ?? todayISO());
  const amount = Number(formData.get("amount"));
  const category = String(formData.get("category") ?? "general");
  const description = (formData.get("description") as string) || null;
  db.prepare(
    `INSERT INTO expenses (date, amount, category, description) VALUES (?, ?, ?, ?)`
  ).run(date, amount, category, description);
  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/contabilidad");
  redirect("/gastos");
}

export async function deleteExpenseAction(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/contabilidad");
}

// ---------- Revisions ----------

export async function createRevisionAction(formData: FormData) {
  const db = getDb();
  const clientId = Number(formData.get("client_id"));
  const scheduledDate = String(formData.get("scheduled_date"));
  const notes = (formData.get("notes") as string) || null;
  db.prepare(
    `INSERT INTO revisions (client_id, scheduled_date, notes, status) VALUES (?, ?, ?, 'pendiente')`
  ).run(clientId, scheduledDate, notes);
  revalidatePath("/revisiones");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  redirect("/revisiones");
}

export async function markRevisionDoneAction(id: number, clientId: number) {
  const db = getDb();
  db.prepare("UPDATE revisions SET status = 'realizada', done_date = ? WHERE id = ?").run(todayISO(), id);
  revalidatePath("/revisiones");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
}

export async function cancelRevisionAction(id: number, clientId: number) {
  const db = getDb();
  db.prepare("UPDATE revisions SET status = 'cancelada' WHERE id = ?").run(id);
  revalidatePath("/revisiones");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
}

export async function deleteRevisionAction(id: number, clientId: number) {
  const db = getDb();
  db.prepare("DELETE FROM revisions WHERE id = ?").run(id);
  revalidatePath("/revisiones");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
}

// ---------- Ad spend / marketing ----------

export async function createAdSpendAction(formData: FormData) {
  const db = getDb();
  const date = String(formData.get("date") ?? todayISO());
  const source = String(formData.get("source") ?? "Otro");
  const amount = Number(formData.get("amount"));
  const leads = Number(formData.get("leads") ?? 0) || 0;
  const callsScheduled = Number(formData.get("calls_scheduled") ?? 0) || 0;
  const closes = Number(formData.get("closes") ?? 0) || 0;
  const notes = (formData.get("notes") as string) || null;

  db.prepare(
    `INSERT INTO ad_spend (date, source, amount, leads, calls_scheduled, closes, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(date, source, amount, leads, callsScheduled, closes, notes);

  revalidatePath("/publicidad");
  redirect("/publicidad");
}

export async function deleteAdSpendAction(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM ad_spend WHERE id = ?").run(id);
  revalidatePath("/publicidad");
}
