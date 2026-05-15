import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { generateProfile } from "../services/generator";

const router = Router();

const generateSchema = z.object({
  name: z.string().min(1),
  yearsExperience: z.number().int().min(0).max(60),
  technologies: z.array(z.string()).min(1),
  platform: z.enum(["malt", "upwork", "linkedin", "other"]),
  niche: z.string().min(1),
  language: z.enum(["es", "en"]),
});

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, req.userId))
      .orderBy(desc(profiles.createdAt))
      .all();
    res.json(rows);
  })
);

router.post(
  "/generate",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = generateSchema.parse(req.body);
    const content = generateProfile({
      name: data.name,
      yearsExperience: data.yearsExperience,
      technologies: data.technologies,
      platform: data.platform,
      niche: data.niche,
      language: data.language,
    });

    const inserted = db
      .insert(profiles)
      .values({
        userId: req.userId,
        name: data.name,
        platform: data.platform,
        language: data.language,
        niche: data.niche,
        technologies: JSON.stringify(data.technologies),
        yearsExperience: data.yearsExperience,
        content,
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
      .delete(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

export default router;
