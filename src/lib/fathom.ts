const FATHOM_API_BASE = "https://api.fathom.ai/external/v1";

export interface FathomInvitee {
  name?: string | null;
  email?: string | null;
  is_external?: boolean;
}

export interface FathomTranscriptItem {
  speaker?: { display_name?: string | null; matched_calendar_invitee_email?: string | null };
  text?: string;
  timestamp?: string;
}

export interface FathomMeeting {
  recording_id: number | string;
  title?: string | null;
  meeting_title?: string | null;
  url?: string | null;
  share_url?: string | null;
  created_at?: string | null;
  scheduled_start_time?: string | null;
  recording_start_time?: string | null;
  recording_end_time?: string | null;
  calendar_invitees?: FathomInvitee[] | null;
  recorded_by?: { name?: string | null; email?: string | null } | null;
  transcript?: FathomTranscriptItem[] | null;
  default_summary?: { markdown_formatted?: string | null } | null;
}

export class FathomConfigError extends Error {}
export class FathomApiError extends Error {}

function getFathomApiKey(): string {
  const key = process.env.FATHOM_API_KEY;
  if (!key) {
    throw new FathomConfigError(
      "Falta la variable de entorno FATHOM_API_KEY. Configúrala en .env.local y reinicia el servidor."
    );
  }
  return key;
}

/** Fetches every meeting (with summary and transcript) recorded after `createdAfter`, paginating as needed. */
export async function fetchFathomMeetings(createdAfter?: string): Promise<FathomMeeting[]> {
  const apiKey = getFathomApiKey();
  const meetings: FathomMeeting[] = [];
  let cursor: string | undefined;
  let rateLimitRetries = 0;

  for (let page = 0; page < 200; page++) {
    const params = new URLSearchParams({ include_summary: "true", include_transcript: "true" });
    if (createdAfter) params.set("created_after", createdAfter);
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${FATHOM_API_BASE}/meetings?${params.toString()}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });

    if (res.status === 429 && rateLimitRetries < 30) {
      // Fathom limita las peticiones (p. ej. 10 seguidas) y dice cuánto esperar en Retry-After.
      rateLimitRetries++;
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10;
      await new Promise((r) => setTimeout(r, (waitSeconds + 1) * 1000));
      page--;
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FathomApiError(`Fathom respondió ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { items?: FathomMeeting[]; next_cursor?: string | null };
    meetings.push(...(data.items ?? []));
    if (!data.next_cursor) break;
    cursor = data.next_cursor;
  }

  return meetings;
}
