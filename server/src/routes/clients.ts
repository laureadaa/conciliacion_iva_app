import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { clients } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1).max(160),
  company: z.string().max(160).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(["potential", "active", "recurring", "inactive"]),
});

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(clients)
      .where(eq(clients.userId, req.userId))
      .orderBy(desc(clients.updatedAt))
      .all();
    res.json(rows);
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = clientSchema.parse(req.body);
    const now = new Date().toISOString();
    const inserted = db
      .insert(clients)
      .values({
        userId: req.userId,
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        notes: data.notes || null,
        status: data.status,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    res.status(201).json(inserted[0]);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, req.userId)))
      .all()[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const data = clientSchema.parse(req.body);
    const updated = db
      .update(clients)
      .set({
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        notes: data.notes || null,
        status: data.status,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(clients.id, id), eq(clients.userId, req.userId)))
      .returning()
      .all();
    if (updated.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(updated[0]);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const deleted = db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

export default router;
