"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "./db";
import { buildClientMatcher, normalizeMatchKey } from "./clientMatch";
import { fetchFathomMeetings, FathomApiError, FathomConfigError, type FathomTranscriptItem } from "./fathom";
import { analyzeCallWithClaude, ClaudeConfigError, computeTranscriptMetrics, formatTranscript } from "./callAnalysis";
import type { CallOutcome, SalesCall } from "./types";
import { CALL_OUTCOMES } from "./types";

export interface CallSyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

export async function syncFathomCallsAction(): Promise<CallSyncResult> {
  const db = getDb();

  // Incremental: solo trae lo grabado desde la última llamada sincronizada (con 2 días de margen).
  const last = db.prepare("SELECT MAX(started_at) as last FROM sales_calls").get() as { last: string | null };
  const createdAfter = last.last
    ? new Date(new Date(last.last).getTime() - 2 * 86400000).toISOString()
    : undefined;

  let meetings;
  try {
    meetings = await fetchFathomMeetings(createdAfter);
  } catch (e) {
    if (e instanceof FathomConfigError || e instanceof FathomApiError) {
      return { imported: 0, updated: 0, errors: [e.message] };
    }
    return { imported: 0, updated: 0, errors: [`Error al conectar con Fathom: ${(e as Error).message}`] };
  }

  const matchClient = buildClientMatcher(db);
  const exists = db.prepare("SELECT id FROM sales_calls WHERE fathom_recording_id = ?");
  const upsert = db.prepare(
    `INSERT INTO sales_calls (fathom_recording_id, title, date, started_at, duration_min, url, closer_name, closer_email,
       prospect_name, prospect_email, client_id, summary, transcript, closer_talk_pct, closer_questions)
     VALUES (:rid, :title, :date, :started_at, :duration_min, :url, :closer_name, :closer_email,
       :prospect_name, :prospect_email, :client_id, :summary, :transcript, :closer_talk_pct, :closer_questions)
     ON CONFLICT(fathom_recording_id) DO UPDATE SET
       title = excluded.title, date = excluded.date, started_at = excluded.started_at,
       duration_min = excluded.duration_min, url = excluded.url, closer_name = excluded.closer_name,
       closer_email = excluded.closer_email, prospect_name = excluded.prospect_name,
       prospect_email = excluded.prospect_email, client_id = COALESCE(sales_calls.client_id, excluded.client_id),
       summary = excluded.summary, transcript = excluded.transcript,
       closer_talk_pct = excluded.closer_talk_pct, closer_questions = excluded.closer_questions`
  );

  const result: CallSyncResult = { imported: 0, updated: 0, errors: [] };

  for (const m of meetings) {
    const rid = String(m.recording_id);
    const startedAt = m.recording_start_time ?? m.scheduled_start_time ?? m.created_at ?? null;
    if (!startedAt) continue;
    const endedAt = m.recording_end_time;
    const durationMin = endedAt ? (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000 : null;

    const closer = m.recorded_by ?? {};
    const closerEmail = closer.email ? normalizeMatchKey(closer.email) : null;
    const prospect =
      (m.calendar_invitees ?? []).find((i) => i.is_external) ??
      (m.calendar_invitees ?? []).find((i) => i.email && normalizeMatchKey(i.email) !== closerEmail);
    // Si Fathom no conoce el nombre del invitado, pone su email como nombre: mejor mostrar el título.
    const rawName = prospect?.name?.trim();
    const prospectName = rawName && !rawName.includes("@") ? rawName : null;
    const prospectEmail = prospect?.email?.trim() || null;
    const clientId =
      (prospectEmail ? matchClient(prospectEmail) : undefined) ??
      (prospectName ? matchClient(prospectName) : undefined) ??
      null;

    const transcript: FathomTranscriptItem[] = m.transcript ?? [];
    const metrics = computeTranscriptMetrics(transcript, closer);

    const wasPresent = exists.get(rid) != null;
    upsert.run({
      rid,
      title: (m.meeting_title || m.title || "Llamada sin título").trim(),
      date: new Date(startedAt).toISOString().slice(0, 10),
      started_at: startedAt,
      duration_min: durationMin,
      url: m.url ?? m.share_url ?? null,
      closer_name: closer.name ?? null,
      closer_email: closer.email ?? null,
      prospect_name: prospectName,
      prospect_email: prospectEmail,
      client_id: clientId,
      summary: m.default_summary?.markdown_formatted ?? null,
      transcript: transcript.length ? JSON.stringify(transcript) : null,
      closer_talk_pct: metrics.closerTalkPct,
      closer_questions: metrics.closerQuestions,
    });
    if (wasPresent) result.updated++;
    else result.imported++;
  }

  revalidatePath("/llamadas");
  return result;
}

export interface CallAnalyzeResult {
  analyzed: number;
  remaining: number;
  errors: string[];
}

function analyzeOne(call: Pick<SalesCall, "id" | "title" | "closer_name" | "duration_min" | "transcript" | "outcome_source">) {
  const transcript = call.transcript ? (JSON.parse(call.transcript) as FathomTranscriptItem[]) : [];
  if (transcript.length === 0) throw new Error(`"${call.title}" no tiene transcripción en Fathom.`);
  return analyzeCallWithClaude({
    title: call.title,
    closerName: call.closer_name,
    durationMin: call.duration_min,
    transcript: formatTranscript(transcript),
  });
}

function saveAnalysis(id: number, keepManualOutcome: boolean, analysis: Awaited<ReturnType<typeof analyzeCallWithClaude>>) {
  const db = getDb();
  const outcome: CallOutcome = analysis.es_llamada_de_venta ? analysis.resultado : "no_venta";
  if (keepManualOutcome) {
    db.prepare(
      "UPDATE sales_calls SET analysis = ?, score = ?, analyzed_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(analysis), analysis.puntuacion_global, id);
  } else {
    db.prepare(
      `UPDATE sales_calls SET analysis = ?, score = ?, outcome = ?, outcome_source = 'claude', amount = ?,
         analyzed_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(analysis), analysis.puntuacion_global, outcome, analysis.importe, id);
  }
}

const ANALYZE_BATCH_SIZE = 5;

/** Analiza con Claude las llamadas aún sin analizar, de 5 en 5 para no bloquear la página demasiado rato. */
export async function analyzePendingCallsAction(): Promise<CallAnalyzeResult> {
  const db = getDb();
  const pending = db
    .prepare(
      `SELECT id, title, closer_name, duration_min, transcript, outcome_source FROM sales_calls
       WHERE analyzed_at IS NULL AND transcript IS NOT NULL ORDER BY date DESC LIMIT ?`
    )
    .all(ANALYZE_BATCH_SIZE) as unknown as SalesCall[];

  const result: CallAnalyzeResult = { analyzed: 0, remaining: 0, errors: [] };
  const outcomes = await Promise.allSettled(pending.map((c) => analyzeOne(c)));
  outcomes.forEach((o, i) => {
    if (o.status === "fulfilled") {
      saveAnalysis(pending[i].id, pending[i].outcome_source === "manual", o.value);
      result.analyzed++;
    } else {
      const err = o.reason;
      result.errors.push(err instanceof ClaudeConfigError ? err.message : `${pending[i].title}: ${(err as Error).message}`);
    }
  });

  const left = db
    .prepare("SELECT COUNT(*) as n FROM sales_calls WHERE analyzed_at IS NULL AND transcript IS NOT NULL")
    .get() as { n: number };
  result.remaining = left.n;
  revalidatePath("/llamadas");
  return result;
}

export async function reanalyzeCallAction(id: number): Promise<void> {
  const db = getDb();
  const call = db.prepare("SELECT * FROM sales_calls WHERE id = ?").get(id) as SalesCall | undefined;
  if (!call) return;
  const analysis = await analyzeOne(call);
  saveAnalysis(id, call.outcome_source === "manual", analysis);
  revalidatePath("/llamadas");
  revalidatePath(`/llamadas/${id}`);
}

export async function updateCallOutcomeAction(id: number, formData: FormData): Promise<void> {
  const outcome = String(formData.get("outcome") ?? "");
  if (!CALL_OUTCOMES.some((o) => o.value === outcome)) return;
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".").trim();
  const amount = amountRaw ? Number(amountRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  getDb()
    .prepare("UPDATE sales_calls SET outcome = ?, outcome_source = 'manual', amount = ?, notes = ? WHERE id = ?")
    .run(outcome, amount != null && Number.isFinite(amount) ? amount : null, notes, id);
  revalidatePath("/llamadas");
  revalidatePath(`/llamadas/${id}`);
}
