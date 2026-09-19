export function parseFlexibleDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  // YYYY-MM-DD
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toISO(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD/MM/YYYY or DD-MM-YYYY (Spanish format, used by Google Sheets es-ES)
  m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return toISO(Number(m[3]), Number(m[2]), Number(m[1]));

  // DD/MM/YY
  m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) return toISO(2000 + Number(m[3]), Number(m[2]), Number(m[1]));

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function toISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseFlexibleAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  let value = raw.trim().replace(/[€\s]/g, "");
  if (!value) return null;
  // Spanish format: 1.234,56 -> 1234.56 ; also handle plain 19,90 -> 19.90
  if (value.includes(",") && value.includes(".")) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (value.includes(",")) {
    value = value.replace(",", ".");
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function parseHeaderLine(line: string): string[] {
  return line
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
}
