import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { leads } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { discoverLeads, SECTOR_LABELS, findEmailFromWebsite } from "../services/discover";

const router = Router();

const searchSchema = z.object({
  city: z.string().min(1),
  sectors: z.array(z.string()).min(1),
  onlyWithoutWebsite: z.boolean().default(true),
  limit: z.number().int().min(1).max(800).optional(),
});

const importSchema = z.object({
  hits: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      website: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      city: z.string(),
      address: z.string().nullable(),
      lat: z.number(),
      lon: z.number(),
      osmId: z.string(),
    })
  ),
});

router.get("/sectors", (_req, res) => {
  res.json(SECTOR_LABELS);
});

router.post(
  "/search",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = searchSchema.parse(req.body);
    const hits = await discoverLeads(data);
    res.json({ hits });
  })
);

router.post(
  "/import",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = importSchema.parse(req.body);

    // Skip duplicates by normalized name+city already in user's leads
    const norm = (s: string | null | undefined) =>
      (s || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
    const existing = db
      .select({ name: leads.name, city: leads.city })
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .all();
    const seen = new Set(existing.map((e) => `${norm(e.name)}|${norm(e.city)}`));

    let imported = 0;
    let skipped = 0;
    const now = new Date().toISOString();
    for (const h of data.hits) {
      const key = `${norm(h.name)}|${norm(h.city)}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      db.insert(leads)
        .values({
          userId: req.userId,
          name: h.name,
          website: h.website,
          email: h.email,
          phone: h.phone,
          city: h.city,
          niche: SECTOR_LABELS[h.category] || h.category,
          source: h.osmId,
          status: "new",
          notes: h.address ? `Dirección: ${h.address}` : null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      seen.add(key);
      imported++;
    }
    res.json({ imported, skipped });
  })
);

// Try to find emails for all leads without email but with website
router.post(
  "/enrich-emails",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(leads)
      .where(eq(leads.userId, req.userId))
      .all();
    const candidates = rows.filter((r) => !r.email && r.website);
    let found = 0;
    for (const r of candidates) {
      const email = await findEmailFromWebsite(r.website!);
      if (email) {
        db.update(leads)
          .set({ email, updatedAt: new Date().toISOString() })
          .where(eq(leads.id, r.id))
          .run();
        found++;
      }
    }
    res.json({ checked: candidates.length, found });
  })
);

export default router;
