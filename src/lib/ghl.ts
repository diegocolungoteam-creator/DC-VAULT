const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  dateAdded?: string;
}

export class GhlConfigError extends Error {}
export class GhlApiError extends Error {}

function getGhlConfig() {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    throw new GhlConfigError(
      "Faltan las variables de entorno GHL_API_TOKEN y/o GHL_LOCATION_ID. Configúralas en .env.local y reinicia el servidor."
    );
  }
  return { token, locationId };
}

/** Fetches every contact from the configured GoHighLevel sub-account, paginating as needed. */
export async function fetchAllGhlContacts(): Promise<GhlContact[]> {
  const { token, locationId } = getGhlConfig();
  const contacts: GhlContact[] = [];
  let startAfter: string | undefined;
  let startAfterId: string | undefined;

  for (let page = 0; page < 200; page++) {
    const params = new URLSearchParams({ locationId, limit: "100" });
    if (startAfter) params.set("startAfter", startAfter);
    if (startAfterId) params.set("startAfterId", startAfterId);

    const res = await fetch(`${GHL_API_BASE}/contacts/?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GHL_API_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new GhlApiError(`GoHighLevel respondió ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      contacts?: GhlContact[];
      meta?: { startAfter?: string; startAfterId?: string; total?: number };
    };
    const batch = data.contacts ?? [];
    contacts.push(...batch);

    if (batch.length < 100 || !data.meta?.startAfterId) break;
    startAfter = String(data.meta.startAfter ?? "");
    startAfterId = data.meta.startAfterId;
  }

  return contacts;
}

export function ghlContactFullName(c: GhlContact): string {
  if (c.name) return c.name.trim();
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}
