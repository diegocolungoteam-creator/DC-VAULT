"use server";

import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { buildClientMatcher, normalizeMatchKey } from "./clientMatch";
import { upsertRevision } from "./revisionUpsert";
import { parseFlexibleAmount, parseFlexibleDate } from "./importParsers";
import type { BillingCycle, ClientStatus } from "./types";

export interface ImportResult {
  inserted: number;
  updated?: number;
  skipped: number;
  errors: string[];
}

function parseCsv(csvText: string): Record<string, string>[] {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

function getMapped(row: Record<string, string>, mapping: Record<string, string>, field: string): string | undefined {
  const header = mapping[field];
  if (!header) return undefined;
  return row[header];
}

const CLIENT_STATUSES: ClientStatus[] = ["activo", "inactivo", "baja"];
const BILLING_CYCLES: BillingCycle[] = ["mensual", "trimestral", "semestral", "anual"];

export async function importClientsAction(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  const csvText = String(formData.get("csv_text") ?? "");
  const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as Record<string, string>;
  const db = getDb();

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csvText);
  } catch (e) {
    return { inserted: 0, skipped: 0, errors: [`No se pudo leer el CSV: ${(e as Error).message}`] };
  }

  const matchClient = buildClientMatcher(db);
  const localMatches = new Map<string, number>();
  const insert = db.prepare(
    `INSERT INTO clients (name, email, phone, address, notes, status, enrollment_date, plan, fee, billing_cycle, renewal_date, source, contracted_total, pending_amount)
     VALUES (:name, :email, :phone, :address, :notes, :status, :enrollment_date, :plan, :fee, :billing_cycle, :renewal_date, :source, :contracted_total, :pending_amount)`
  );
  const update = db.prepare(
    `UPDATE clients SET name=:name, email=:email, phone=:phone, address=:address, notes=:notes,
     status=:status, enrollment_date=:enrollment_date, plan=:plan, fee=:fee,
     billing_cycle=:billing_cycle, renewal_date=:renewal_date, source=:source,
     contracted_total=:contracted_total, pending_amount=:pending_amount WHERE id=:id`
  );

  result.updated = 0;

  rows.forEach((row, i) => {
    const name = getMapped(row, mapping, "name")?.trim();
    if (!name) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: falta el nombre, se omite.`);
      return;
    }
    const statusRaw = getMapped(row, mapping, "status")?.trim().toLowerCase();
    const status = CLIENT_STATUSES.includes(statusRaw as ClientStatus) ? (statusRaw as ClientStatus) : "activo";

    const cycleRaw = getMapped(row, mapping, "billing_cycle")?.trim().toLowerCase();
    const billing_cycle = BILLING_CYCLES.includes(cycleRaw as BillingCycle) ? (cycleRaw as BillingCycle) : "mensual";

    const email = getMapped(row, mapping, "email")?.trim() || null;
    const fields = {
      name,
      email,
      phone: getMapped(row, mapping, "phone")?.trim() || null,
      address: getMapped(row, mapping, "address")?.trim() || null,
      notes: getMapped(row, mapping, "notes")?.trim() || null,
      status,
      enrollment_date: parseFlexibleDate(getMapped(row, mapping, "enrollment_date")),
      plan: getMapped(row, mapping, "plan")?.trim() || null,
      fee: parseFlexibleAmount(getMapped(row, mapping, "fee")),
      billing_cycle,
      renewal_date: parseFlexibleDate(getMapped(row, mapping, "renewal_date")),
      source: getMapped(row, mapping, "source")?.trim() || null,
      contracted_total: parseFlexibleAmount(getMapped(row, mapping, "contracted_total")),
      pending_amount: parseFlexibleAmount(getMapped(row, mapping, "pending_amount")),
    };

    const existingId = localMatches.get(normalizeMatchKey(name)) ?? matchClient(name) ?? (email ? matchClient(email) : undefined);

    if (existingId) {
      update.run({ ...fields, id: existingId });
      result.updated!++;
      localMatches.set(normalizeMatchKey(name), existingId);
      if (email) localMatches.set(normalizeMatchKey(email), existingId);
      return;
    }

    const info = insert.run(fields);
    const newId = Number(info.lastInsertRowid);
    localMatches.set(normalizeMatchKey(name), newId);
    if (email) localMatches.set(normalizeMatchKey(email), newId);
    result.inserted++;
  });

  revalidatePath("/clientes");
  revalidatePath("/");
  return result;
}

export async function importPaymentsAction(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  const csvText = String(formData.get("csv_text") ?? "");
  const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as Record<string, string>;
  const db = getDb();

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csvText);
  } catch (e) {
    return { inserted: 0, skipped: 0, errors: [`No se pudo leer el CSV: ${(e as Error).message}`] };
  }

  const matchClient = buildClientMatcher(db);
  const insert = db.prepare(
    `INSERT INTO payments (client_id, date, amount, method, concept) VALUES (?, ?, ?, ?, ?)`
  );
  const update = db.prepare(`UPDATE payments SET method = ?, concept = ? WHERE id = ?`);

  // Identify existing payments by client+date+amount only (not concept): a
  // client rarely gets billed the same amount twice on the exact same day,
  // so this triple is treated as "the same payment" even if two exports of
  // the sheet worded the concept differently. Re-importing updates the
  // concept/method on the existing row instead of ever inserting a 2nd row.
  const existingByKey = new Map(
    (db.prepare(`SELECT id, client_id, date, amount FROM payments`).all() as {
      id: number;
      client_id: number;
      date: string;
      amount: number;
    }[]).map((p) => [`${p.client_id}|${p.date}|${p.amount}`, p.id])
  );

  rows.forEach((row, i) => {
    const clientMatch = getMapped(row, mapping, "client_match")?.trim();
    const dateRaw = getMapped(row, mapping, "date");
    const amountRaw = getMapped(row, mapping, "amount");

    if (!clientMatch) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: falta el nombre/email del cliente.`);
      return;
    }
    const clientId = matchClient(clientMatch);
    if (!clientId) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: no se encontró el cliente "${clientMatch}".`);
      return;
    }
    const date = parseFlexibleDate(dateRaw);
    const amount = parseFlexibleAmount(amountRaw);
    if (!date || amount == null) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: fecha o importe inválido.`);
      return;
    }
    const method = getMapped(row, mapping, "method")?.trim() || null;
    const concept = getMapped(row, mapping, "concept")?.trim() || null;
    const key = `${clientId}|${date}|${amount}`;
    const existingId = existingByKey.get(key);
    if (existingId) {
      update.run(method, concept, existingId);
      result.updated = (result.updated ?? 0) + 1;
      return;
    }
    const info = insert.run(clientId, date, amount, method, concept);
    existingByKey.set(key, Number(info.lastInsertRowid));
    result.inserted++;
  });

  revalidatePath("/pagos");
  revalidatePath("/");
  revalidatePath("/contabilidad");
  return result;
}

export async function importExpensesAction(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  const csvText = String(formData.get("csv_text") ?? "");
  const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as Record<string, string>;
  const db = getDb();

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csvText);
  } catch (e) {
    return { inserted: 0, skipped: 0, errors: [`No se pudo leer el CSV: ${(e as Error).message}`] };
  }

  const insert = db.prepare(
    `INSERT INTO expenses (date, amount, category, description) VALUES (?, ?, ?, ?)`
  );
  const update = db.prepare(`UPDATE expenses SET description = ? WHERE id = ?`);

  // Identify existing expenses by date+amount+category only (not
  // description), same reasoning as payments: re-exporting the sheet on a
  // different day can reword the description for what is really the same
  // expense. Re-importing updates the description instead of duplicating.
  const existingByKey = new Map(
    (db.prepare(`SELECT id, date, amount, category FROM expenses`).all() as {
      id: number;
      date: string;
      amount: number;
      category: string;
    }[]).map((e) => [`${e.date}|${e.amount}|${e.category}`, e.id])
  );

  rows.forEach((row, i) => {
    const dateRaw = getMapped(row, mapping, "date");
    const amountRaw = getMapped(row, mapping, "amount");
    const date = parseFlexibleDate(dateRaw);
    const amount = parseFlexibleAmount(amountRaw);
    if (!date || amount == null) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: fecha o importe inválido.`);
      return;
    }
    const category = getMapped(row, mapping, "category")?.trim() || "general";
    const description = getMapped(row, mapping, "description")?.trim() || null;
    const key = `${date}|${amount}|${category}`;
    const existingId = existingByKey.get(key);
    if (existingId) {
      update.run(description, existingId);
      result.updated = (result.updated ?? 0) + 1;
      return;
    }
    const info = insert.run(date, amount, category, description);
    existingByKey.set(key, Number(info.lastInsertRowid));
    result.inserted++;
  });

  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/contabilidad");
  return result;
}

export async function importRevisionsAction(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  const csvText = String(formData.get("csv_text") ?? "");
  const mapping = JSON.parse(String(formData.get("mapping") ?? "{}")) as Record<string, string>;
  const db = getDb();

  const result: ImportResult = { inserted: 0, skipped: 0, errors: [] };
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csvText);
  } catch (e) {
    return { inserted: 0, skipped: 0, errors: [`No se pudo leer el CSV: ${(e as Error).message}`] };
  }

  const matchClient = buildClientMatcher(db);
  result.updated = 0;

  rows.forEach((row, i) => {
    const clientMatch = getMapped(row, mapping, "client_match")?.trim();
    if (!clientMatch) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: falta el nombre/email del cliente.`);
      return;
    }
    const clientId = matchClient(clientMatch);
    if (!clientId) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: no se encontró el cliente "${clientMatch}".`);
      return;
    }
    const scheduledDate = parseFlexibleDate(getMapped(row, mapping, "scheduled_date"));
    const doneDate = parseFlexibleDate(getMapped(row, mapping, "done_date"));
    if (!scheduledDate && !doneDate) {
      result.skipped++;
      result.errors.push(`Fila ${i + 2}: falta la fecha programada o realizada.`);
      return;
    }
    const statusRaw = getMapped(row, mapping, "status")?.trim().toLowerCase();
    const status: string =
      statusRaw && ["pendiente", "realizada", "cancelada"].includes(statusRaw)
        ? statusRaw
        : doneDate
          ? "realizada"
          : "pendiente";

    const effectiveScheduled = (scheduledDate ?? doneDate) as string;
    const notes = getMapped(row, mapping, "notes")?.trim() || null;

    const outcome = upsertRevision(db, { clientId, scheduledDate: effectiveScheduled, doneDate, status, notes });
    if (outcome === "updated") result.updated!++;
    else result.inserted++;
  });

  revalidatePath("/revisiones");
  revalidatePath("/");
  return result;
}
