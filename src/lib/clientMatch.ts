import { getDb } from "./db";

export function normalizeMatchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Accent- and case-insensitive lookup of a client by name or email, built once per run. */
export function buildClientMatcher(db: ReturnType<typeof getDb>) {
  const clients = db.prepare("SELECT id, name, email FROM clients").all() as {
    id: number;
    name: string;
    email: string | null;
  }[];
  const byKey = new Map<string, number>();
  for (const c of clients) {
    byKey.set(normalizeMatchKey(c.name), c.id);
    if (c.email) byKey.set(normalizeMatchKey(c.email), c.id);
  }
  return (value: string): number | undefined => byKey.get(normalizeMatchKey(value));
}
