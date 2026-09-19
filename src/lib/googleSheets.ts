import { getGoogleAccessToken } from "./googleAuth";

export class GoogleSheetsConfigError extends Error {}
export class GoogleSheetsApiError extends Error {}

/** Reads a range of cell values from a Google Sheet using a service account. */
export async function fetchSheetValues(range?: string): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new GoogleSheetsConfigError("Falta GOOGLE_SHEETS_SPREADSHEET_ID en .env.local.");
  }
  const effectiveRange = range || process.env.GOOGLE_SHEETS_RANGE || "A:Z";

  const accessToken = await getGoogleAccessToken("https://www.googleapis.com/auth/spreadsheets.readonly");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(effectiveRange)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GoogleSheetsApiError(`Google Sheets respondió ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/** Converts a header row + data rows into an array of {header: value} objects. */
export function sheetRowsToRecords(values: string[][]): Record<string, string>[] {
  if (values.length === 0) return [];
  const [header, ...rows] = values;
  return rows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      if (key) record[key.trim()] = (row[i] ?? "").trim();
    });
    return record;
  });
}
