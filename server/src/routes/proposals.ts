import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { proposals } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { generateProposal } from "../services/generator";

const router = Router();

const generateSchema = z.object({
  clientId: z.number().int().nullable().optional(),
  projectType: z.string().min(1),
  clientDescription: z.string().min(1),
  budget: z.number().nullable().optional(),
  deadline: z.string().nullable().optional(),
  language: z.enum(["es", "en"]),
  title: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(["draft", "sent", "accepted", "rejected"]),
  clientId: z.number().int().nullable().optional(),
});

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const status = (req.query.status as string) || undefined;
    const rows = db
      .select()
      .from(proposals)
      .where(
        status
          ? and(eq(proposals.userId, req.userId), eq(proposals.status, status))
          : eq(proposals.userId, req.userId)
      )
      .orderBy(desc(proposals.createdAt))
      .all();
    res.json(rows);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.userId, req.userId)))
      .all()[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  })
);

router.post(
  "/generate",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = generateSchema.parse(req.body);
    const content = generateProposal({
      projectType: data.projectType,
      clientDescription: data.clientDescription,
      budget: data.budget,
      deadline: data.deadline,
      language: data.language,
    });

    const isEs = data.language === "es";
    const title =
      data.title ||
      `${data.projectType} — ${new Date().toLocaleDateString(isEs ? "es-ES" : "en-US")}`;

    const now = new Date().toISOString();
    const inserted = db
      .insert(proposals)
      .values({
        userId: req.userId,
        clientId: data.clientId ?? null,
        title,
        projectType: data.projectType,
        description: data.clientDescription,
        budget: data.budget ?? null,
        deadline: data.deadline ?? null,
        language: data.language,
        content,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    res.status(201).json(inserted[0]);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const data = updateSchema.parse(req.body);
    const updated = db
      .update(proposals)
      .set({
        title: data.title,
        content: data.content,
        status: data.status,
        clientId: data.clientId ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(proposals.id, id), eq(proposals.userId, req.userId)))
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
      .delete(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

export default router;
