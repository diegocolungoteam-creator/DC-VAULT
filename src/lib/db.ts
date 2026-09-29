import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "crm.db");

declare global {
  var __crmDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'activo',
      enrollment_date TEXT,
      plan TEXT,
      fee REAL,
      billing_cycle TEXT NOT NULL DEFAULT 'mensual',
      renewal_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT,
      concept TEXT,
      period_start TEXT,
      period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      scheduled_date TEXT NOT NULL,
      done_date TEXT,
      status TEXT NOT NULL DEFAULT 'pendiente',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ad_spend (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      leads INTEGER NOT NULL DEFAULT 0,
      calls_scheduled INTEGER NOT NULL DEFAULT 0,
      closes INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fathom_recording_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      started_at TEXT,
      duration_min REAL,
      url TEXT,
      closer_name TEXT,
      closer_email TEXT,
      prospect_name TEXT,
      prospect_email TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      summary TEXT,
      transcript TEXT,
      closer_talk_pct REAL,
      closer_questions INTEGER,
      outcome TEXT NOT NULL DEFAULT 'pendiente',
      outcome_source TEXT NOT NULL DEFAULT 'auto',
      amount REAL,
      score REAL,
      analysis TEXT,
      analyzed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sales_calls_date ON sales_calls(date);
    CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
    CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_revisions_client ON revisions(client_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_scheduled ON revisions(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_clients_renewal ON clients(renewal_date);
    CREATE INDEX IF NOT EXISTS idx_ad_spend_date ON ad_spend(date);
    CREATE INDEX IF NOT EXISTS idx_ad_spend_source ON ad_spend(source);
  `);

  const clientColumns = db.prepare("PRAGMA table_info(clients)").all() as { name: string }[];
  if (!clientColumns.some((c) => c.name === "source")) {
    db.exec("ALTER TABLE clients ADD COLUMN source TEXT");
  }
}

export function getDb(): DatabaseSync {
  if (!globalThis.__crmDb) {
    globalThis.__crmDb = createConnection();
  }
  return globalThis.__crmDb;
}
