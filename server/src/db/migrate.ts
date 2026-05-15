import "dotenv/config";
import { sqlite } from "./index";

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'potential',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    project_type TEXT NOT NULL,
    description TEXT NOT NULL,
    budget REAL,
    deadline TEXT,
    language TEXT NOT NULL DEFAULT 'es',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    language TEXT NOT NULL,
    niche TEXT NOT NULL,
    technologies TEXT NOT NULL,
    years_experience INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    client_name TEXT NOT NULL,
    language TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT,
    full_name TEXT,
    tax_id TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    iban TEXT,
    hourly_rate REAL NOT NULL DEFAULT 45,
    currency TEXT NOT NULL DEFAULT 'EUR',
    default_language TEXT NOT NULL DEFAULT 'es',
    signature TEXT,
    vat_rate REAL NOT NULL DEFAULT 21,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    next_invoice_number INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    issue_date TEXT NOT NULL,
    due_date TEXT,
    currency TEXT NOT NULL DEFAULT 'EUR',
    items_json TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    vat_rate REAL NOT NULL DEFAULT 21,
    vat_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website TEXT,
    email TEXT,
    phone TEXT,
    city TEXT,
    niche TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    audit_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    description TEXT,
    received_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
];

for (const sql of migrations) {
  sqlite.exec(sql);
}

console.log("✓ Database migrations applied");
sqlite.close();
