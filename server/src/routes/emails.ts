import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { emails } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { complete } from "../services/anthropic";

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

const intent: Record<(typeof TYPES)[number], { es: string; en: string }> = {
  first_contact: {
    es: "Primer contacto profesional, tono cercano, presenta brevemente quién eres y abre conversación.",
    en: "Professional first contact, warm tone, brief introduction and open conversation.",
  },
  follow_up: {
    es: "Seguimiento educado de una propuesta o conversación anterior, sin presionar.",
    en: "Polite follow-up of a previous proposal or conversation, no pressure.",
  },
  delivery: {
    es: "Email de entrega de un trabajo terminado, claro y profesional, con próximos pasos.",
    en: "Delivery email for a finished job, clear and professional, with next steps.",
  },
  review_request: {
    es: "Pedir una reseña/testimonio al cliente de forma natural y agradecida.",
    en: "Ask the client for a review/testimonial naturally and gratefully.",
  },
  payment_reminder: {
    es: "Recordatorio de pago educado, firme pero respetuoso.",
    en: "Polite payment reminder, firm but respectful.",
  },
};

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
    const isEs = data.language === "es";
    const guide = intent[data.type][data.language];

    const system = isEs
      ? "Eres una experta en redacción de emails profesionales para freelancers. Devuelves SIEMPRE el resultado en JSON exacto con las claves \"subject\" y \"body\". No añadas texto fuera del JSON."
      : "You are an expert at writing professional emails for freelancers. ALWAYS return the result as exact JSON with keys \"subject\" and \"body\". No text outside the JSON.";

    const user = isEs
      ? `Tipo de email: ${data.type}. Cliente: ${data.clientName}. Contexto: ${data.context}. Estilo: ${guide}. Devuelve SOLO JSON: {"subject":"...","body":"..."}`
      : `Email type: ${data.type}. Client: ${data.clientName}. Context: ${data.context}. Style: ${guide}. Return ONLY JSON: {"subject":"...","body":"..."}`;

    const raw = await complete({ system, user, maxTokens: 800 });
    let subject = "";
    let body = "";
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : null;
      subject = (json?.subject || "").toString().trim();
      body = (json?.body || "").toString().trim();
    } catch {
      // fallback if model didn't return JSON
      subject = (isEs ? "Email para " : "Email for ") + data.clientName;
      body = raw;
    }
    if (!subject) subject = (isEs ? "Email para " : "Email for ") + data.clientName;
    if (!body) body = raw;

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
