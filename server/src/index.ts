import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import proposalRoutes from "./routes/proposals";
import pricingRoutes from "./routes/pricing";
import profileRoutes from "./routes/profiles";
import emailRoutes from "./routes/emails";
import incomeRoutes from "./routes/income";
import dashboardRoutes from "./routes/dashboard";
import settingsRoutes from "./routes/settings";
import invoiceRoutes from "./routes/invoices";
import leadRoutes from "./routes/leads";
import { sqlite } from "./db";

// Ensure DB schema exists at boot (safe idempotent)
const schemaStatements = [
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
for (const stmt of schemaStatements) sqlite.exec(stmt);

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, env: config.nodeEnv }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", authMiddleware, clientRoutes);
app.use("/api/proposals", authMiddleware, proposalRoutes);
app.use("/api/pricing", authMiddleware, pricingRoutes);
app.use("/api/profiles", authMiddleware, profileRoutes);
app.use("/api/emails", authMiddleware, emailRoutes);
app.use("/api/income", authMiddleware, incomeRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);
app.use("/api/invoices", authMiddleware, invoiceRoutes);
app.use("/api/leads", authMiddleware, leadRoutes);

// ---- Serve frontend in production ----
if (config.nodeEnv === "production") {
  const candidates = [
    path.resolve(process.cwd(), "client/dist"),
    path.resolve(process.cwd(), "../client/dist"),
    path.resolve(__dirname, "../../../client/dist"),
  ];
  const staticDir = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    console.log(`[server] serving frontend from ${staticDir}`);
  } else {
    console.warn("[server] could not locate client/dist — running API-only");
  }
}

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
