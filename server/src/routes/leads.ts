import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { leads } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { auditUrl } from "../services/auditor";
import { ensureSettings } from "./settings";
import { signature } from "../services/generator-helpers";
import { outbox } from "../db/schema";

const router = Router();

const leadSchema = z.object({
  name: z.string().min(1),
  website: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  niche: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  status: z
    .enum(["new", "audited", "contacted", "interested", "converted", "rejected"])
    .optional(),
  notes: z.string().nullable().optional(),
});

function rowToLead(row: typeof leads.$inferSelect) {
  const { auditJson, ...rest } = row;
  return {
    ...rest,
    audit: auditJson ? JSON.parse(auditJson) : null,
  };
}

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .orderBy(desc(leads.updatedAt))
      .all();
    res.json(rows.map(rowToLead));
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = leadSchema.parse(req.body);
    const now = new Date().toISOString();
    const inserted = db
      .insert(leads)
      .values({
        userId: req.userId,
        name: data.name,
        website: data.website || null,
        email: data.email || null,
        phone: data.phone || null,
        city: data.city || null,
        niche: data.niche || null,
        source: data.source || null,
        status: data.status || "new",
        notes: data.notes || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    res.status(201).json(rowToLead(inserted[0]));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const data = leadSchema.parse(req.body);
    const updated = db
      .update(leads)
      .set({
        name: data.name,
        website: data.website || null,
        email: data.email || null,
        phone: data.phone || null,
        city: data.city || null,
        niche: data.niche || null,
        source: data.source || null,
        status: data.status || "new",
        notes: data.notes || null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(leads.id, id), eq(leads.userId, req.userId)))
      .returning()
      .all();
    if (updated.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rowToLead(updated[0]));
  })
);

// Delete ALL leads of the current user — must be BEFORE /:id to avoid match
router.delete(
  "/delete-all",
  asyncHandler(async (req: AuthedRequest, res) => {
    const deleted = db
      .delete(leads)
      .where(eq(leads.userId, req.userId))
      .returning({ id: leads.id })
      .all();
    res.json({ deleted: deleted.length });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const deleted = db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

// Audit a lead's website
router.post(
  "/:id/audit",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const row = db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, req.userId)))
      .all()[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!row.website) return res.status(400).json({ error: "Lead has no website" });

    const audit = await auditUrl(row.website);
    const updated = db
      .update(leads)
      .set({
        auditJson: JSON.stringify(audit),
        status: row.status === "new" ? "audited" : row.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leads.id, id))
      .returning()
      .all();
    res.json(rowToLead(updated[0]));
  })
);

// Bulk audit
router.post(
  "/audit-all",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .all();
    const updated: ReturnType<typeof rowToLead>[] = [];
    for (const row of rows) {
      if (!row.website) continue;
      try {
        const audit = await auditUrl(row.website);
        const r = db
          .update(leads)
          .set({
            auditJson: JSON.stringify(audit),
            status: row.status === "new" ? "audited" : row.status,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(leads.id, row.id))
          .returning()
          .all();
        updated.push(rowToLead(r[0]));
      } catch {
        // skip failures
      }
    }
    res.json({ updated: updated.length });
  })
);

// Generate outreach email tailored to the audit findings
router.post(
  "/:id/outreach",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const language = (req.body?.language === "en" ? "en" : "es") as "es" | "en";
    const row = db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, req.userId)))
      .all()[0];
    if (!row) return res.status(404).json({ error: "Not found" });

    const audit = row.auditJson ? JSON.parse(row.auditJson) : null;
    const s = ensureSettings(req.userId);
    const sign = signature({
      fullName: s.fullName,
      businessName: s.businessName,
      website: s.website,
      signature: s.signature,
    }, language);

    const isEs = language === "es";
    const opps: string[] = audit?.opportunities || [];
    const headline = opps[0] || (isEs ? "Mejorar la presencia online de tu negocio." : "Improve your business online presence.");
    const bulletList = (opps.slice(1, 4).length ? opps.slice(1, 4) : [
      isEs ? "Velocidad y rendimiento óptimo en móvil." : "Optimal mobile speed and performance.",
      isEs ? "SEO básico (title, description, Open Graph)." : "Basic SEO (title, description, Open Graph).",
      isEs ? "HTTPS y dominio bien configurados." : "HTTPS and proper domain setup.",
    ])
      .map((o) => `• ${o}`)
      .join("\n");

    const subject = isEs
      ? `Un par de ideas para mejorar ${row.name}`
      : `A couple of ideas to improve ${row.name}`;

    const body = isEs
      ? `Hola,\n\nMe llamo ${s.fullName || s.businessName || "y soy desarrolladora freelance"}, ${s.fullName ? "soy desarrolladora freelance" : ""}. He visto vuestra web${audit?.url ? ` (${audit.url})` : ""} y me he tomado unos minutos para analizarla con detalle, porque me parece que se le puede sacar mucho más.\n\nEn resumen, lo que mejor podría aportar valor:\n${headline ? "• " + headline + "\n" : ""}${bulletList}\n\nNada de "te lo tienes que rehacer todo": son mejoras concretas que se pueden hacer en pocos días y se ven en resultados (más leads, menos tasa de rebote, mejor posicionamiento).\n\n¿Te encajaría una llamada de 15 minutos esta semana para enseñarte exactamente qué cambiaría y un presupuesto orientativo? Sin compromiso.\n\n${sign}`
      : `Hi,\n\nMy name is ${s.fullName || s.businessName || "and I'm a freelance developer"}. I came across your website${audit?.url ? ` (${audit.url})` : ""} and took a few minutes to analyze it in detail — I think there's a lot more value you could get from it.\n\nIn short, where I could add the most value:\n${headline ? "• " + headline + "\n" : ""}${bulletList}\n\nNothing like "you need to redo everything": these are concrete improvements doable in a few days that translate into real results (more leads, lower bounce rate, better ranking).\n\nWould a 15-minute call this week work to walk you through exactly what I'd change and a rough estimate? No commitment.\n\n${sign}`;

    res.json({ subject, body });
  })
);

// Queue ready-to-send outreach into outbox (for leads with email)
router.post(
  "/queue-outreach",
  asyncHandler(async (req: AuthedRequest, res) => {
    const language = (req.body?.language === "en" ? "en" : "es") as "es" | "en";
    const onlyAudited = req.body?.onlyAudited !== false;

    const rows = db
      .select()
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .all();
    const candidates = rows.filter(
      (l) =>
        l.email &&
        l.status === (onlyAudited ? "audited" : l.status) &&
        l.status !== "contacted"
    );

    const s = ensureSettings(req.userId);
    const sign = signature(
      {
        fullName: s.fullName,
        businessName: s.businessName,
        website: s.website,
        signature: s.signature,
      },
      language
    );

    let queued = 0;
    const now = new Date().toISOString();
    for (const lead of candidates) {
      // Skip if there's already a pending/sent outbox entry for this lead
      const existing = db
        .select()
        .from(outbox)
        .where(and(eq(outbox.userId, req.userId), eq(outbox.leadId, lead.id)))
        .all();
      if (existing.length > 0) continue;

      const audit = lead.auditJson ? JSON.parse(lead.auditJson) : null;
      const isEs = language === "es";
      const opps: string[] = audit?.opportunities || [];
      const headline =
        opps[0] ||
        (isEs
          ? "Mejorar la presencia online de tu negocio."
          : "Improve your business online presence.");
      const bulletList = (opps.slice(1, 4).length
        ? opps.slice(1, 4)
        : [
            isEs
              ? "Velocidad y rendimiento óptimo en móvil."
              : "Optimal mobile speed and performance.",
            isEs
              ? "SEO básico (title, description, Open Graph)."
              : "Basic SEO (title, description, Open Graph).",
            isEs
              ? "HTTPS y dominio bien configurados."
              : "HTTPS and proper domain setup.",
          ])
        .map((o) => `• ${o}`)
        .join("\n");

      const subject = isEs
        ? `Un par de ideas para mejorar ${lead.name}`
        : `A couple of ideas to improve ${lead.name}`;

      const intro = isEs
        ? `Soy ${s.fullName || s.businessName || "desarrolladora freelance"}`
        : `My name is ${s.fullName || s.businessName || "and I'm a freelance developer"}`;

      const webRef = audit?.url
        ? isEs
          ? ` (${audit.url})`
          : ` (${audit.url})`
        : "";

      const body = isEs
        ? `Hola,\n\n${intro}. He visto vuestra web${webRef} y me he tomado unos minutos para analizarla con detalle, porque me parece que se le puede sacar mucho más.\n\nEn resumen, lo que mejor podría aportar valor:\n• ${headline}\n${bulletList}\n\nNada de "te lo tienes que rehacer todo": son mejoras concretas que se pueden hacer en pocos días y se ven en resultados (más clientes, menos tasa de rebote, mejor posicionamiento).\n\n¿Te encajaría una llamada de 15 minutos esta semana para enseñarte exactamente qué cambiaría y un presupuesto orientativo? Sin compromiso.\n\n${sign}`
        : `Hi,\n\n${intro}. I came across your website${webRef} and took a few minutes to analyze it in detail — I think there's a lot more value you could get from it.\n\nIn short, where I could add the most value:\n• ${headline}\n${bulletList}\n\nNothing like "you need to redo everything": these are concrete improvements doable in a few days that translate into real results.\n\nWould a 15-minute call this week work to walk you through exactly what I'd change and a rough estimate? No commitment.\n\n${sign}`;

      db.insert(outbox)
        .values({
          userId: req.userId,
          leadId: lead.id,
          recipient: lead.email!,
          recipientName: lead.name,
          subject,
          body,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      queued++;
    }
    res.json({ queued, skipped: candidates.length - queued });
  })
);

function normalize(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Bulk import with deduplication (vs existing + within batch)
router.post(
  "/import",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = z.array(leadSchema).parse(req.body);
    const now = new Date().toISOString();

    // Build a set of existing leads keys for this user
    const existing = db
      .select({ name: leads.name, city: leads.city })
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .all();
    const seen = new Set(
      existing.map((e) => `${normalize(e.name)}|${normalize(e.city)}`)
    );

    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const key = `${normalize(row.name)}|${normalize(row.city)}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      db.insert(leads)
        .values({
          userId: req.userId,
          name: row.name,
          website: row.website || null,
          email: row.email || null,
          phone: row.phone || null,
          city: row.city || null,
          niche: row.niche || null,
          source: row.source || "csv",
          status: row.status || "new",
          notes: row.notes || null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      imported++;
    }
    res.json({ imported, skipped });
  })
);

// Delete duplicates (keep oldest, by name+city normalized)
router.post(
  "/dedupe",
  asyncHandler(async (req: AuthedRequest, res) => {
    const all = db
      .select()
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .all();
    const seen = new Map<string, number>(); // key -> id to keep
    const toDelete: number[] = [];
    // Sort by id ASC so oldest wins
    all.sort((a, b) => a.id - b.id);
    for (const r of all) {
      const key = `${normalize(r.name)}|${normalize(r.city)}`;
      if (seen.has(key)) {
        toDelete.push(r.id);
      } else {
        seen.set(key, r.id);
      }
    }
    for (const id of toDelete) {
      db.delete(leads)
        .where(and(eq(leads.id, id), eq(leads.userId, req.userId)))
        .run();
    }
    res.json({ removed: toDelete.length });
  })
);

export default router;
