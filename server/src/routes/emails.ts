import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { emails } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { generateEmail } from "../services/generator";

const router = Router();

const TYPES = [
  "first_contact",
  "follow_up",
  "delivery",
  "review_request",
  "payment_reminder",
] as const;

const generateSchema = z.object({
  type: z.enum(TYPES),
  clientName: z.string().min(1),
  context: z.string().min(1),
  language: z.enum(["es", "en"]),
});

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(emails)
      .where(eq(emails.userId, req.userId))
      .orderBy(desc(emails.createdAt))
      .all();
    res.json(rows);
  })
);

router.post(
  "/generate",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = generateSchema.parse(req.body);
    const { subject, body } = generateEmail({
      type: data.type,
      clientName: data.clientName,
      context: data.context,
      language: data.language,
    });

    const inserted = db
      .insert(emails)
      .values({
        userId: req.userId,
        type: data.type,
        subject,
        body,
        clientName: data.clientName,
        language: data.language,
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
      .delete(emails)
      .where(and(eq(emails.id, id), eq(emails.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

export default router;
