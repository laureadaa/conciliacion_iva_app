import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { incomes } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();

const incomeSchema = z.object({
  clientId: z.number().int().nullable().optional(),
  amount: z.number().positive(),
  currency: z.string().default("EUR"),
  description: z.string().nullable().optional(),
  receivedAt: z.string().min(1),
});

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(incomes)
      .where(eq(incomes.userId, req.userId))
      .orderBy(desc(incomes.receivedAt))
      .all();
    res.json(rows);
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = incomeSchema.parse(req.body);
    const inserted = db
      .insert(incomes)
      .values({
        userId: req.userId,
        clientId: data.clientId ?? null,
        amount: data.amount,
        currency: data.currency || "EUR",
        description: data.description || null,
        receivedAt: data.receivedAt,
      })
      .returning()
      .all();
    res.status(201).json(inserted[0]);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const deleted = db
      .delete(incomes)
      .where(and(eq(incomes.id, id), eq(incomes.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

export default router;
