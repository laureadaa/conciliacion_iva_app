import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { complete } from "../services/anthropic";

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
    const isEs = data.language === "es";

    const platformGuidance: Record<string, { es: string; en: string }> = {
      malt: {
        es: "Optimiza para Malt: bio en primera persona, destaca experiencia y resultados, máx ~600 caracteres, mezcla habilidades técnicas y soft.",
        en: "Optimized for Malt: first-person bio, highlight experience and outcomes, max ~600 chars, mix technical and soft skills.",
      },
      upwork: {
        es: "Optimiza para Upwork: gancho fuerte en la primera frase, beneficios para el cliente, palabras clave SEO, call-to-action al final.",
        en: "Optimized for Upwork: strong hook in the first line, client-focused benefits, SEO keywords, call-to-action at the end.",
      },
      linkedin: {
        es: "Optimiza para LinkedIn: tono profesional pero humano, storytelling breve, métricas si es posible, hashtags al final.",
        en: "Optimized for LinkedIn: professional yet human tone, brief storytelling, metrics if possible, hashtags at the end.",
      },
      other: {
        es: "Bio profesional genérica para portafolio.",
        en: "Generic professional bio for a portfolio.",
      },
    };

    const guidance = platformGuidance[data.platform][data.language];
    const system = isEs
      ? "Eres una copywriter experta en perfiles profesionales para desarrolladoras freelance. Escribes bios claras, persuasivas, sin clichés."
      : "You are a copywriter expert in professional profiles for freelance developers. You write clear, persuasive bios without clichés.";

    const user = isEs
      ? `Genera una bio para ${data.name}, desarrolladora con ${data.yearsExperience} años de experiencia, especializada en "${data.niche}". Stack: ${data.technologies.join(", ")}. Plataforma: ${data.platform}. ${guidance}. Devuelve solo la bio.`
      : `Generate a bio for ${data.name}, a developer with ${data.yearsExperience} years of experience, specialized in "${data.niche}". Stack: ${data.technologies.join(", ")}. Platform: ${data.platform}. ${guidance}. Return only the bio.`;

    const content = await complete({ system, user, maxTokens: 700 });

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
