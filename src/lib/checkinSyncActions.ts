"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { buildClientMatcher } from "./clientMatch";
import { fetchSheetValues, sheetRowsToRecords, GoogleSheetsConfigError, GoogleSheetsApiError } from "./googleSheets";
import { GoogleAuthConfigError } from "./googleAuth";
import { parseFlexibleDate } from "./importParsers";
import { upsertRevision } from "./revisionUpsert";
import { todayISO } from "./dates";

export interface CheckinSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const NAME_HEADER_CANDIDATES = ["nombre", "name", "cliente"];
const CHECKIN_HEADER_CANDIDATES = ["last_checkin_at", "ultimo_checkin", "fecha_checkin", "checkin"];

function findHeader(headers: string[], candidates: string[]): string | undefined {
  return headers.find((h) => candidates.includes(h.trim().toLowerCase()));
}

export async function syncCheckinsFromSheetAction(): Promise<CheckinSyncResult> {
  const db = getDb();
  const result: CheckinSyncResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

  let values: string[][];
  try {
    values = await fetchSheetValues();
  } catch (e) {
    if (e instanceof GoogleAuthConfigError || e instanceof GoogleSheetsConfigError || e instanceof GoogleSheetsApiError) {
      return { ...result, errors: [e.message] };
    }
    return { ...result, errors: [`Error al leer Google Sheets: ${(e as Error).message}`] };
  }

  const records = sheetRowsToRecords(values);
  if (records.length === 0) {
    return { ...result, errors: ["La hoja está vacía o el rango configurado no contiene filas."] };
  }

  const headers = Object.keys(records[0]);
  const nameHeader = findHeader(headers, NAME_HEADER_CANDIDATES);
  const checkinHeader = findHeader(headers, CHECKIN_HEADER_CANDIDATES);
  if (!nameHeader || !checkinHeader) {
    return {
      ...result,
      errors: [
        `No encuentro las columnas de nombre y/o fecha de check-in. Columnas detectadas: ${headers.join(", ")}`,
      ],
    };
  }

  const matchClient = buildClientMatcher(db);
  const today = todayISO();

  for (const record of records) {
    const name = record[nameHeader]?.trim();
    const checkinRaw = record[checkinHeader]?.trim();
    if (!name || !checkinRaw) {
      result.skipped++;
      continue;
    }
    const doneDate = parseFlexibleDate(checkinRaw.split(" ")[0]);
    if (!doneDate) {
      result.skipped++;
      continue;
    }
    const clientId = matchClient(name);
    if (!clientId) {
      result.skipped++;
      result.errors.push(`No se encontró el cliente "${name}".`);
      continue;
    }
    if (doneDate > today) {
      result.skipped++;
      continue;
    }
    const outcome = upsertRevision(db, {
      clientId,
      scheduledDate: doneDate,
      doneDate,
      status: "realizada",
      notes: "Sincronizado desde Google Sheets",
    });
    if (outcome === "updated") result.updated++;
    else result.imported++;
  }

  revalidatePath("/revisiones");
  revalidatePath("/");
  return result;
}
