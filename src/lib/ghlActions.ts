"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { buildClientMatcher } from "./clientMatch";
import { fetchAllGhlContacts, ghlContactFullName, GhlApiError, GhlConfigError } from "./ghl";
import { todayISO } from "./dates";

export interface GhlSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function syncGhlContactsAction(): Promise<GhlSyncResult> {
  const db = getDb();

  let contacts;
  try {
    contacts = await fetchAllGhlContacts();
  } catch (e) {
    if (e instanceof GhlConfigError || e instanceof GhlApiError) {
      return { imported: 0, skipped: 0, errors: [e.message] };
    }
    return { imported: 0, skipped: 0, errors: [`Error al conectar con GoHighLevel: ${(e as Error).message}`] };
  }

  const matchClient = buildClientMatcher(db);
  const insert = db.prepare(
    `INSERT INTO clients (name, email, phone, status, enrollment_date, source, notes)
     VALUES (:name, :email, :phone, 'inactivo', :enrollment_date, :source, :notes)`
  );

  const result: GhlSyncResult = { imported: 0, skipped: 0, errors: [] };

  for (const contact of contacts) {
    const name = ghlContactFullName(contact);
    if (!name) {
      result.skipped++;
      continue;
    }
    const existingId = matchClient(name) ?? (contact.email ? matchClient(contact.email) : undefined);
    if (existingId) {
      result.skipped++;
      continue;
    }
    insert.run({
      name,
      email: contact.email?.trim() || null,
      phone: contact.phone?.trim() || null,
      enrollment_date: contact.dateAdded ? contact.dateAdded.slice(0, 10) : todayISO(),
      source: (contact.tags && contact.tags[0]) || contact.source || "GoHighLevel",
      notes: "Importado de GoHighLevel (lead)",
    });
    result.imported++;
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  return result;
}
