import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  notes: text("notes"),
  status: text("status").notNull().default("potential"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  projectType: text("project_type").notNull(),
  description: text("description").notNull(),
  budget: real("budget"),
  deadline: text("deadline"),
  language: text("language").notNull().default("es"),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  language: text("language").notNull(),
  niche: text("niche").notNull(),
  technologies: text("technologies").notNull(),
  yearsExperience: integer("years_experience").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const emails = sqliteTable("emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  clientName: text("client_name").notNull(),
  language: text("language").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  fullName: text("full_name"),
  taxId: text("tax_id"),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  iban: text("iban"),
  hourlyRate: real("hourly_rate").notNull().default(45),
  currency: text("currency").notNull().default("EUR"),
  defaultLanguage: text("default_language").notNull().default("es"),
  signature: text("signature"),
  vatRate: real("vat_rate").notNull().default(21),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  number: text("number").notNull(),
  status: text("status").notNull().default("draft"),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  currency: text("currency").notNull().default("EUR"),
  itemsJson: text("items_json").notNull(),
  subtotal: real("subtotal").notNull().default(0),
  vatRate: real("vat_rate").notNull().default(21),
  vatAmount: real("vat_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  city: text("city"),
  niche: text("niche"),
  source: text("source"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  auditJson: text("audit_json"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const incomes = sqliteTable("incomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("EUR"),
  description: text("description"),
  receivedAt: text("received_at").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
