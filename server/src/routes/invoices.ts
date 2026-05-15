import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { invoices, settings, incomes } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { ensureSettings } from "./settings";

const router = Router();

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

const invoiceSchema = z.object({
  clientId: z.number().int().nullable(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  issueDate: z.string().min(1),
  dueDate: z.string().nullable(),
  currency: z.string().min(1),
  items: z.array(itemSchema).min(1),
  vatRate: z.number().min(0).max(100),
  notes: z.string().nullable(),
});

function rowToInvoice(row: typeof invoices.$inferSelect) {
  const items = JSON.parse(row.itemsJson || "[]");
  const { itemsJson: _omit, ...rest } = row;
  return { ...rest, items };
}

function calcTotals(items: { quantity: number; unitPrice: number }[], vatRate: number) {
  const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const vatAmount = +(subtotal * (vatRate / 100)).toFixed(2);
  const total = +(subtotal + vatAmount).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), vatAmount, total };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, req.userId))
      .orderBy(desc(invoices.issueDate))
      .all();
    res.json(rows.map(rowToInvoice));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, req.userId)))
      .all()[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(rowToInvoice(row));
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = invoiceSchema.parse(req.body);
    const s = ensureSettings(req.userId);

    const number = `${s.invoicePrefix}-${String(s.nextInvoiceNumber).padStart(4, "0")}`;
    db.update(settings)
      .set({ nextInvoiceNumber: s.nextInvoiceNumber + 1, updatedAt: new Date().toISOString() })
      .where(eq(settings.userId, req.userId))
      .run();

    const totals = calcTotals(data.items, data.vatRate);
    const now = new Date().toISOString();
    const paidAt = data.status === "paid" ? now : null;

    const inserted = db
      .insert(invoices)
      .values({
        userId: req.userId,
        clientId: data.clientId,
        number,
        status: data.status,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        currency: data.currency,
        itemsJson: JSON.stringify(data.items),
        ...totals,
        vatRate: data.vatRate,
        notes: data.notes,
        paidAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    const created = inserted[0];

    if (data.status === "paid") {
      db.insert(incomes)
        .values({
          userId: req.userId,
          clientId: data.clientId,
          amount: totals.total,
          currency: data.currency,
          description: `Factura ${number}`,
          receivedAt: data.issueDate,
        })
        .run();
    }

    res.status(201).json(rowToInvoice(created));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const data = invoiceSchema.parse(req.body);
    const existing = db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, req.userId)))
      .all()[0];
    if (!existing) return res.status(404).json({ error: "Not found" });

    const totals = calcTotals(data.items, data.vatRate);
    const now = new Date().toISOString();
    const wasPaid = existing.status === "paid";
    const isPaid = data.status === "paid";

    const updated = db
      .update(invoices)
      .set({
        clientId: data.clientId,
        status: data.status,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        currency: data.currency,
        itemsJson: JSON.stringify(data.items),
        ...totals,
        vatRate: data.vatRate,
        notes: data.notes,
        paidAt: isPaid ? existing.paidAt || now : null,
        updatedAt: now,
      })
      .where(eq(invoices.id, id))
      .returning()
      .all();

    if (!wasPaid && isPaid) {
      db.insert(incomes)
        .values({
          userId: req.userId,
          clientId: data.clientId,
          amount: totals.total,
          currency: data.currency,
          description: `Factura ${existing.number}`,
          receivedAt: data.issueDate,
        })
        .run();
    }

    res.json(rowToInvoice(updated[0]));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const deleted = db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

export default router;
