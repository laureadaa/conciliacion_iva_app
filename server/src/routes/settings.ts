import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();

const settingsSchema = z.object({
  businessName: z.string().nullable().optional(),
  fullName: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  hourlyRate: z.number().nonnegative(),
  currency: z.string().min(1).max(8),
  defaultLanguage: z.enum(["es", "en"]),
  signature: z.string().nullable().optional(),
  vatRate: z.number().min(0).max(100),
  invoicePrefix: z.string().min(1).max(16),
  nextInvoiceNumber: z.number().int().min(1),
  smtpUser: z.string().email().nullable().optional().or(z.literal("")),
  smtpAppPassword: z.string().nullable().optional(),
  smtpFromName: z.string().nullable().optional(),
  smtpDailyLimit: z.number().int().min(1).max(500).default(30),
});

export function ensureSettings(userId: number) {
  const row = db.select().from(settings).where(eq(settings.userId, userId)).all()[0];
  if (row) return row;
  const inserted = db
    .insert(settings)
    .values({ userId, updatedAt: new Date().toISOString() })
    .returning()
    .all();
  return inserted[0];
}

function maskAppPassword<T extends { smtpAppPassword?: string | null }>(row: T): T {
  if (row.smtpAppPassword) {
    return { ...row, smtpAppPassword: "••••••••••••" };
  }
  return row;
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const row = ensureSettings(req.userId);
    res.json(maskAppPassword(row));
  })
);

router.put(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = settingsSchema.parse(req.body);
    const existing = ensureSettings(req.userId);
    // If the client sent the masked placeholder, keep the existing password
    const appPassword =
      data.smtpAppPassword && data.smtpAppPassword.includes("•")
        ? existing.smtpAppPassword
        : data.smtpAppPassword || null;
    const updated = db
      .update(settings)
      .set({
        businessName: data.businessName || null,
        fullName: data.fullName || null,
        taxId: data.taxId || null,
        address: data.address || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        iban: data.iban || null,
        hourlyRate: data.hourlyRate,
        currency: data.currency,
        defaultLanguage: data.defaultLanguage,
        signature: data.signature || null,
        vatRate: data.vatRate,
        invoicePrefix: data.invoicePrefix,
        nextInvoiceNumber: data.nextInvoiceNumber,
        smtpUser: data.smtpUser || null,
        smtpAppPassword: appPassword,
        smtpFromName: data.smtpFromName || null,
        smtpDailyLimit: data.smtpDailyLimit ?? 30,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(settings.userId, req.userId))
      .returning()
      .all();
    res.json(maskAppPassword(updated[0]));
  })
);

export default router;
