import type { getDb } from "./db";

/**
 * Inserts a revision, or updates an existing one for the same client on the same
 * scheduled/done date instead of creating a duplicate. Returns whether it inserted or updated.
 */
export function upsertRevision(
  db: ReturnType<typeof getDb>,
  params: {
    clientId: number;
    scheduledDate: string;
    doneDate: string | null;
    status: string;
    notes: string | null;
  }
): "inserted" | "updated" {
  const { clientId, scheduledDate, doneDate, status, notes } = params;
  const existing = db
    .prepare(`SELECT id FROM revisions WHERE client_id = ? AND (scheduled_date = ? OR done_date = ?) LIMIT 1`)
    .get(clientId, scheduledDate, doneDate) as { id: number } | undefined;

  if (existing) {
    db.prepare(`UPDATE revisions SET scheduled_date=?, done_date=?, status=?, notes=COALESCE(?, notes) WHERE id=?`).run(
      scheduledDate,
      doneDate,
      status,
      notes,
      existing.id
    );
    return "updated";
  }

  db.prepare(`INSERT INTO revisions (client_id, scheduled_date, done_date, status, notes) VALUES (?, ?, ?, ?, ?)`).run(
    clientId,
    scheduledDate,
    doneDate,
    status,
    notes
  );
  return "inserted";
}
