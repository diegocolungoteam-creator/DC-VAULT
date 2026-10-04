import { getDb } from "./db";
import { daysBetween, subtractDays, todayISO } from "./dates";
import {
  REVISION_ALERT_THRESHOLD_DAYS,
  type AdSpendEntry,
  type Client,
  type ClientStatus,
  type Expense,
  type Payment,
  type Revision,
  type RevisionStatus,
} from "./types";

// ---------- Clients ----------

export function listClients(opts: { status?: ClientStatus | "todos"; search?: string } = {}): Client[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (opts.status && opts.status !== "todos") {
    clauses.push("status = :status");
    params.status = opts.status;
  }
  if (opts.search) {
    clauses.push("(name LIKE :search OR email LIKE :search OR phone LIKE :search)");
    params.search = `%${opts.search}%`;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const stmt = db.prepare(`SELECT * FROM clients ${where} ORDER BY name ASC`);
  return stmt.all(params) as unknown as Client[];
}

export function getClient(id: number): Client | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Client | undefined;
}

// ---------- Payments ----------

export function listPayments(opts: { clientId?: number; from?: string; to?: string } = {}): Payment[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};
  if (opts.clientId) {
    clauses.push("client_id = :clientId");
    params.clientId = opts.clientId;
  }
  if (opts.from) {
    clauses.push("date >= :from");
    params.from = opts.from;
  }
  if (opts.to) {
    clauses.push("date <= :to");
    params.to = opts.to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM payments ${where} ORDER BY date DESC, id DESC`).all(params) as unknown as Payment[];
}

export function listPaymentsWithClient(opts: { from?: string; to?: string } = {}) {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (opts.from) {
    clauses.push("p.date >= :from");
    params.from = opts.from;
  }
  if (opts.to) {
    clauses.push("p.date <= :to");
    params.to = opts.to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT p.*, c.name as client_name FROM payments p
       JOIN clients c ON c.id = p.client_id ${where}
       ORDER BY p.date DESC, p.id DESC`
    )
    .all(params) as unknown as (Payment & { client_name: string })[];
}

// ---------- Expenses ----------

export function listExpenses(opts: { from?: string; to?: string; category?: string } = {}): Expense[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (opts.from) {
    clauses.push("date >= :from");
    params.from = opts.from;
  }
  if (opts.to) {
    clauses.push("date <= :to");
    params.to = opts.to;
  }
  if (opts.category) {
    clauses.push("category = :category");
    params.category = opts.category;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM expenses ${where} ORDER BY date DESC, id DESC`).all(params) as unknown as Expense[];
}

// ---------- Revisions ----------

export function listRevisions(opts: { clientId?: number; status?: RevisionStatus } = {}) {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};
  if (opts.clientId) {
    clauses.push("r.client_id = :clientId");
    params.clientId = opts.clientId;
  }
  if (opts.status) {
    clauses.push("r.status = :status");
    params.status = opts.status;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT r.*, c.name as client_name FROM revisions r
       JOIN clients c ON c.id = r.client_id ${where}
       ORDER BY r.scheduled_date ASC`
    )
    .all(params) as unknown as (Revision & { client_name: string })[];
}

// ---------- Dashboard / aggregates ----------

export function getDashboardStats(monthKey?: string) {
  const db = getDb();
  const activeClients = (
    db.prepare("SELECT COUNT(*) as n FROM clients WHERE status = 'activo'").get() as { n: number }
  ).n;
  const totalClients = (db.prepare("SELECT COUNT(*) as n FROM clients").get() as { n: number }).n;

  const today = todayISO();
  const in30 = addDaysISO(today, 30);

  const upcomingRenewals = db
    .prepare(
      `SELECT * FROM clients WHERE status = 'activo' AND renewal_date IS NOT NULL AND renewal_date BETWEEN :today AND :in30 ORDER BY renewal_date ASC`
    )
    .all({ today, in30 }) as unknown as Client[];

  const overdueRenewals = db
    .prepare(
      `SELECT * FROM clients WHERE status = 'activo' AND renewal_date IS NOT NULL AND renewal_date < :today ORDER BY renewal_date ASC`
    )
    .all({ today }) as unknown as Client[];

  const pendingRevisions = db
    .prepare(
      `SELECT r.*, c.name as client_name FROM revisions r JOIN clients c ON c.id = r.client_id
       WHERE r.status = 'pendiente' ORDER BY r.scheduled_date ASC LIMIT 20`
    )
    .all() as unknown as (Revision & { client_name: string })[];

  const overdueRevisionsCount = (
    db
      .prepare(`SELECT COUNT(*) as n FROM revisions WHERE status = 'pendiente' AND scheduled_date < ?`)
      .get(today) as { n: number }
  ).n;

  const month = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : today.slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`; // lexicographic date comparison, safe upper bound for any month
  const monthSummary = getPeriodSummary(monthStart, monthEnd);
  const monthIncome = monthSummary.income;
  const monthExpense = monthSummary.expense;
  const monthContracted = monthSummary.contracted;

  const revisionAlerts = getRevisionAlerts(REVISION_ALERT_THRESHOLD_DAYS);
  const recentlyCompletedRevisions = getRecentlyCompletedRevisions(7);

  return {
    activeClients,
    totalClients,
    upcomingRenewals,
    overdueRenewals,
    pendingRevisions,
    overdueRevisionsCount,
    month,
    monthIncome,
    monthExpense,
    monthBalance: monthIncome - monthExpense,
    monthContracted,
    revisionAlerts,
    recentlyCompletedRevisions,
  };
}

export interface PeriodSummary {
  income: number;
  expense: number;
  balance: number;
  contracted: number;
}

function getPeriodSummary(fromISO: string, toISO: string): PeriodSummary {
  const db = getDb();
  const income = (
    db
      .prepare("SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE date BETWEEN :from AND :to")
      .get({ from: fromISO, to: toISO }) as { t: number }
  ).t;
  const expense = (
    db
      .prepare("SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE date BETWEEN :from AND :to")
      .get({ from: fromISO, to: toISO }) as { t: number }
  ).t;
  const contracted = (
    db
      .prepare(
        `SELECT COALESCE(SUM(contracted_total),0) as t FROM clients WHERE enrollment_date BETWEEN :from AND :to`
      )
      .get({ from: fromISO, to: toISO }) as { t: number }
  ).t;
  return { income, expense, balance: income - expense, contracted };
}

export function getYearSummary(year: number): PeriodSummary {
  return getPeriodSummary(`${year}-01-01`, `${year}-12-31`);
}

export function getAvailableMonths(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(date, 1, 7) as m FROM payments
       UNION SELECT DISTINCT substr(date, 1, 7) as m FROM expenses
       UNION SELECT DISTINCT substr(enrollment_date, 1, 7) as m FROM clients WHERE enrollment_date IS NOT NULL`
    )
    .all() as { m: string }[];
  const months = new Set(rows.map((r) => r.m).filter((m) => /^\d{4}-\d{2}$/.test(m)));
  months.add(todayISO().slice(0, 7));
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getMonthlyBalance(year: number) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT strftime('%m', date) as month, SUM(amount) as total FROM payments WHERE strftime('%Y', date) = ? GROUP BY month`
    )
    .all(String(year)) as { month: string; total: number }[];
  const expenseRows = db
    .prepare(
      `SELECT strftime('%m', date) as month, SUM(amount) as total FROM expenses WHERE strftime('%Y', date) = ? GROUP BY month`
    )
    .all(String(year)) as { month: string; total: number }[];

  const income = new Map(rows.map((r) => [r.month, r.total]));
  const expense = new Map(expenseRows.map((r) => [r.month, r.total]));

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  return months.map((m) => ({
    month: m,
    income: income.get(m) ?? 0,
    expense: expense.get(m) ?? 0,
    balance: (income.get(m) ?? 0) - (expense.get(m) ?? 0),
  }));
}

export function getExpensesByCategory(year: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT category, SUM(amount) as total FROM expenses WHERE strftime('%Y', date) = ? GROUP BY category ORDER BY total DESC`
    )
    .all(String(year)) as { category: string; total: number }[];
}

export function getAvailableYears(): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT strftime('%Y', date) as y FROM payments
       UNION SELECT DISTINCT strftime('%Y', date) as y FROM expenses`
    )
    .all() as { y: string }[];
  const years = new Set(rows.map((r) => Number(r.y)).filter(Boolean));
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

// ---------- Ad spend / marketing ----------

export function listAdSpend(opts: { from?: string; to?: string } = {}): AdSpendEntry[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (opts.from) {
    clauses.push("date >= :from");
    params.from = opts.from;
  }
  if (opts.to) {
    clauses.push("date <= :to");
    params.to = opts.to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM ad_spend ${where} ORDER BY date DESC, id DESC`)
    .all(params) as unknown as AdSpendEntry[];
}

export interface MarketingSourceStats {
  source: string;
  amount: number;
  pctOfSpend: number;
  leads: number;
  costPerLead: number | null;
  calls: number;
  costPerCall: number | null;
  closes: number;
  costPerClose: number | null;
  clientCount: number;
  costPerClient: number | null;
}

export function getMarketingStats(opts: { from: string; to: string }) {
  const db = getDb();
  const entries = listAdSpend(opts);

  const totalSpend = entries.reduce((s, e) => s + e.amount, 0);
  const totalLeads = entries.reduce((s, e) => s + e.leads, 0);
  const totalCalls = entries.reduce((s, e) => s + e.calls_scheduled, 0);
  const totalCloses = entries.reduce((s, e) => s + e.closes, 0);

  const clientsBySource = db
    .prepare(
      `SELECT COALESCE(source, 'Otro') as source, COUNT(*) as n FROM clients
       WHERE COALESCE(enrollment_date, substr(created_at, 1, 10)) BETWEEN :from AND :to
       GROUP BY source`
    )
    .all({ from: opts.from, to: opts.to }) as { source: string; n: number }[];
  const clientCountBySource = new Map(clientsBySource.map((c) => [c.source, c.n]));

  const bySourceMap = new Map<string, { amount: number; leads: number; calls: number; closes: number }>();
  for (const e of entries) {
    const cur = bySourceMap.get(e.source) ?? { amount: 0, leads: 0, calls: 0, closes: 0 };
    cur.amount += e.amount;
    cur.leads += e.leads;
    cur.calls += e.calls_scheduled;
    cur.closes += e.closes;
    bySourceMap.set(e.source, cur);
  }

  const bySource: MarketingSourceStats[] = Array.from(bySourceMap.entries())
    .map(([source, v]) => {
      const clientCount = clientCountBySource.get(source) ?? 0;
      return {
        source,
        amount: v.amount,
        pctOfSpend: totalSpend > 0 ? (v.amount / totalSpend) * 100 : 0,
        leads: v.leads,
        costPerLead: v.leads > 0 ? v.amount / v.leads : null,
        calls: v.calls,
        costPerCall: v.calls > 0 ? v.amount / v.calls : null,
        closes: v.closes,
        costPerClose: v.closes > 0 ? v.amount / v.closes : null,
        clientCount,
        costPerClient: clientCount > 0 ? v.amount / clientCount : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalNewClients = bySource.reduce((s, b) => s + b.clientCount, 0);

  return {
    totalSpend,
    totalLeads,
    totalCalls,
    totalCloses,
    costPerLead: totalLeads > 0 ? totalSpend / totalLeads : null,
    costPerCall: totalCalls > 0 ? totalSpend / totalCalls : null,
    costPerClose: totalCloses > 0 ? totalSpend / totalCloses : null,
    totalNewClients,
    cac: totalNewClients > 0 ? totalSpend / totalNewClients : null,
    bySource,
  };
}

// ---------- Revision alerts ----------

export interface RevisionAlert {
  client_id: number;
  client_name: string;
  last_revision_date: string | null;
  days_since: number | null;
  pending_count: number;
}

export function getRevisionAlerts(thresholdDays: number): RevisionAlert[] {
  const db = getDb();
  const today = todayISO();
  const rows = db
    .prepare(
      `SELECT
         c.id as client_id,
         c.name as client_name,
         (SELECT MAX(done_date) FROM revisions r WHERE r.client_id = c.id AND r.status = 'realizada') as last_revision_date,
         (SELECT COUNT(*) FROM revisions r WHERE r.client_id = c.id AND r.status = 'pendiente') as pending_count
       FROM clients c
       WHERE c.status = 'activo'`
    )
    .all() as { client_id: number; client_name: string; last_revision_date: string | null; pending_count: number }[];

  return rows
    .map((r) => ({
      ...r,
      days_since: r.last_revision_date ? daysBetween(r.last_revision_date, today) : null,
    }))
    .filter((r) => r.pending_count === 0 && (r.days_since === null || r.days_since >= thresholdDays))
    .sort((a, b) => {
      if (a.days_since === null && b.days_since === null) return a.client_name.localeCompare(b.client_name);
      if (a.days_since === null) return -1;
      if (b.days_since === null) return 1;
      return b.days_since - a.days_since;
    });
}

export function getRecentlyCompletedRevisions(days: number) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT r.*, c.name as client_name FROM revisions r
       JOIN clients c ON c.id = r.client_id
       WHERE r.status = 'realizada' AND r.done_date >= ?
       ORDER BY r.done_date DESC`
    )
    .all(sinceISO) as unknown as (Revision & { client_name: string })[];
}

export function getRevisionsInRange(fromISO: string, toISO: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.*, c.name as client_name FROM revisions r
       JOIN clients c ON c.id = r.client_id
       WHERE r.scheduled_date BETWEEN :from AND :to
       ORDER BY r.scheduled_date ASC`
    )
    .all({ from: fromISO, to: toISO }) as unknown as (Revision & { client_name: string })[];
}

export function getOverduePendingBefore(dateISO: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.*, c.name as client_name FROM revisions r
       JOIN clients c ON c.id = r.client_id
       WHERE r.status = 'pendiente' AND r.scheduled_date < ?
       ORDER BY r.scheduled_date ASC`
    )
    .all(dateISO) as unknown as (Revision & { client_name: string })[];
}

// ---------- Business KPIs (MRR, LTV, ticket medio...) ----------

export interface BusinessKPIs {
  mrr: number;
  activeWithFee: number;
  avgTicket: number;
  ltv: number;
  payingClients: number;
  renewersPct: number;
  churnedLast30: number;
  churnRatePct: number;
}

const CYCLE_MONTHS: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

export function getBusinessKPIs(): BusinessKPIs {
  const db = getDb();

  // Use each active client's most recent payment (not the cumulative "fee" field,
  // which can be a multi-cycle total for repeat clients) normalized to a monthly
  // amount by their billing cycle, to approximate true recurring revenue.
  const activeClients = db
    .prepare(
      `SELECT c.billing_cycle as billing_cycle, p.amount as last_amount
       FROM clients c
       JOIN payments p ON p.id = (
         SELECT id FROM payments WHERE client_id = c.id ORDER BY date DESC, id DESC LIMIT 1
       )
       WHERE c.status = 'activo'`
    )
    .all() as { billing_cycle: string; last_amount: number }[];

  const mrr = activeClients.reduce((sum, c) => sum + c.last_amount / (CYCLE_MONTHS[c.billing_cycle] ?? 1), 0);
  const avgTicket = activeClients.length > 0 ? mrr / activeClients.length : 0;

  const ltvRow = db
    .prepare(
      `SELECT AVG(total) as avg_ltv, COUNT(*) as n FROM (
         SELECT client_id, SUM(amount) as total FROM payments GROUP BY client_id
       )`
    )
    .get() as { avg_ltv: number | null; n: number };

  const renewRow = db
    .prepare(
      `SELECT COUNT(*) as total_paying, SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) as renewers FROM (
         SELECT client_id, COUNT(*) as cnt FROM payments GROUP BY client_id
       )`
    )
    .get() as { total_paying: number; renewers: number | null };

  // Churn: clients now 'baja' whose paid period lapsed (renewal_date) in the last 30
  // days, used as a proxy for "when they left" since status changes aren't logged.
  const today = todayISO();
  const since30 = subtractDays(today, 30);
  const activeCount = (
    db.prepare(`SELECT COUNT(*) as n FROM clients WHERE status = 'activo'`).get() as { n: number }
  ).n;
  const churnedLast30 = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM clients WHERE status = 'baja' AND renewal_date BETWEEN :since AND :today`
      )
      .get({ since: since30, today }) as { n: number }
  ).n;
  const churnBase = activeCount + churnedLast30;

  return {
    mrr,
    activeWithFee: activeClients.length,
    avgTicket,
    ltv: ltvRow.avg_ltv ?? 0,
    payingClients: ltvRow.n,
    renewersPct: renewRow.total_paying > 0 ? ((renewRow.renewers ?? 0) / renewRow.total_paying) * 100 : 0,
    churnedLast30,
    churnRatePct: churnBase > 0 ? (churnedLast30 / churnBase) * 100 : 0,
  };
}

// ---------- Facturado vs. cobrado ----------

export interface BillingSummary {
  totalContracted: number;
  totalCollected: number;
  totalPending: number;
  clientsWithContracted: number;
}

export function getBillingSummary(): BillingSummary {
  const db = getDb();

  const contractedRow = db
    .prepare(
      `SELECT COALESCE(SUM(contracted_total), 0) as total, COUNT(*) as n
       FROM clients WHERE contracted_total IS NOT NULL`
    )
    .get() as { total: number; n: number };

  const collectedRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments`).get() as {
    total: number;
  };

  const pendingRow = db
    .prepare(`SELECT COALESCE(SUM(pending_amount), 0) as total FROM clients WHERE pending_amount IS NOT NULL`)
    .get() as { total: number };

  return {
    totalContracted: contractedRow.total,
    totalCollected: collectedRow.total,
    totalPending: pendingRow.total,
    clientsWithContracted: contractedRow.n,
  };
}

export function getLastRevisionByClient(): Map<number, string> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT client_id, MAX(done_date) as last_date FROM revisions WHERE status = 'realizada' GROUP BY client_id`
    )
    .all() as { client_id: number; last_date: string }[];
  return new Map(rows.map((r) => [r.client_id, r.last_date]));
}
