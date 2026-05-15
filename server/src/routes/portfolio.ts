import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { portfolios, leads, users } from "../db/schema";
import { authMiddleware, AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { ensureSettings } from "./settings";

const router = Router();

const serviceSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  price: z.string(),
  duration: z.string(),
  bullets: z.array(z.string()).default([]),
  featured: z.boolean().optional(),
});

const caseStudySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
  url: z.string(),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().nullable(),
  metric: z.string().nullable().default(null),
  metricLabel: z.string().nullable().default(null),
});

const testimonialSchema = z.object({
  id: z.string(),
  quote: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  company: z.string(),
  avatarUrl: z.string().nullable(),
});

const processStepSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string(),
});

const faqSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string(),
});

const statSchema = z.object({
  id: z.string(),
  value: z.string(),
  label: z.string(),
});

const valuePropSchema = z.object({
  id: z.string(),
  icon: z.string(),
  title: z.string().min(1),
  description: z.string(),
});

const socialsSchema = z.object({
  github: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  malt: z.string().optional(),
  upwork: z.string().optional(),
});

const portfolioSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/i, "slug solo puede tener letras, números y guiones"),
  displayName: z.string().nullable(),
  headline: z.string().nullable(),
  tagline: z.string(),
  bio: z.string().nullable(),
  services: z.array(serviceSchema),
  caseStudies: z.array(caseStudySchema),
  testimonials: z.array(testimonialSchema),
  processSteps: z.array(processStepSchema),
  faqs: z.array(faqSchema),
  stats: z.array(statSchema),
  valueProps: z.array(valuePropSchema),
  availability: z.string().nullable(),
  responseTime: z.string().nullable(),
  socials: socialsSchema,
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  theme: z.enum(["light", "dark"]),
  photoUrl: z.string().nullable(),
  contactEmail: z.string().email().nullable().or(z.literal("")),
  technologies: z.array(z.string()),
  published: z.boolean(),
});

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(4000),
  company: z.string().max(200).optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function rowToPortfolio(row: typeof portfolios.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    slug: row.slug,
    displayName: row.displayName,
    headline: row.headline,
    tagline: row.tagline,
    bio: row.bio,
    services: JSON.parse(row.servicesJson),
    caseStudies: JSON.parse(row.caseStudiesJson),
    testimonials: JSON.parse(row.testimonialsJson || "[]"),
    processSteps: JSON.parse(row.processStepsJson || "[]"),
    faqs: JSON.parse(row.faqsJson || "[]"),
    stats: JSON.parse(row.statsJson || "[]"),
    valueProps: JSON.parse(row.valuePropsJson || "[]"),
    availability: row.availability,
    responseTime: row.responseTime,
    socials: JSON.parse(row.socialsJson),
    accentColor: row.accentColor,
    theme: (row.theme || "light") as "light" | "dark",
    photoUrl: row.photoUrl,
    contactEmail: row.contactEmail,
    technologies: JSON.parse(row.technologiesJson),
    published: !!row.published,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function ensurePortfolio(userId: number) {
  const existing = db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .all()[0];
  if (existing) return existing;

  const user = db.select().from(users).where(eq(users.id, userId)).all()[0];
  const settings = ensureSettings(userId);
  const baseName = settings.fullName || settings.businessName || user?.name || "freelance";
  let slug = slugify(baseName) || `user-${userId}`;
  let counter = 1;
  let final = slug;
  while (db.select().from(portfolios).where(eq(portfolios.slug, final)).all().length > 0) {
    final = `${slug}-${counter++}`;
  }
  const now = new Date().toISOString();
  const inserted = db
    .insert(portfolios)
    .values({
      userId,
      slug: final,
      displayName: baseName,
      headline: null,
      tagline: "",
      bio: null,
      servicesJson: "[]",
      caseStudiesJson: "[]",
      testimonialsJson: "[]",
      processStepsJson: "[]",
      faqsJson: "[]",
      statsJson: "[]",
      valuePropsJson: "[]",
      availability: null,
      responseTime: "Respondo en menos de 48h",
      socialsJson: JSON.stringify({ website: settings.website || undefined }),
      accentColor: "#7c3aed",
      theme: "light",
      photoUrl: null,
      contactEmail: settings.email,
      technologiesJson: "[]",
      published: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .all();
  return inserted[0];
}

router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req: AuthedRequest, res) => {
    const row = ensurePortfolio(req.userId);
    res.json(rowToPortfolio(row));
  })
);

router.put(
  "/me",
  authMiddleware,
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = portfolioSchema.parse(req.body);
    ensurePortfolio(req.userId);
    const others = db
      .select()
      .from(portfolios)
      .where(eq(portfolios.slug, data.slug))
      .all();
    if (others.length > 0 && others[0].userId !== req.userId) {
      return res
        .status(409)
        .json({ error: "Ese slug ya está en uso. Elige otro." });
    }
    const updated = db
      .update(portfolios)
      .set({
        slug: data.slug,
        displayName: data.displayName,
        headline: data.headline,
        tagline: data.tagline,
        bio: data.bio,
        servicesJson: JSON.stringify(data.services),
        caseStudiesJson: JSON.stringify(data.caseStudies),
        testimonialsJson: JSON.stringify(data.testimonials),
        processStepsJson: JSON.stringify(data.processSteps),
        faqsJson: JSON.stringify(data.faqs),
        statsJson: JSON.stringify(data.stats),
        valuePropsJson: JSON.stringify(data.valueProps),
        availability: data.availability,
        responseTime: data.responseTime,
        socialsJson: JSON.stringify(data.socials),
        accentColor: data.accentColor,
        theme: data.theme,
        photoUrl: data.photoUrl,
        contactEmail: data.contactEmail || null,
        technologiesJson: JSON.stringify(data.technologies),
        published: data.published,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(portfolios.userId, req.userId))
      .returning()
      .all();
    res.json(rowToPortfolio(updated[0]));
  })
);

router.get(
  "/public/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const row = db
      .select()
      .from(portfolios)
      .where(eq(portfolios.slug, slug))
      .all()[0];
    if (!row || !row.published) {
      return res.status(404).json({ error: "Portfolio no encontrado" });
    }
    const p = rowToPortfolio(row);
    const pub = {
      slug: p.slug,
      displayName: p.displayName || "Freelance",
      headline: p.headline,
      tagline: p.tagline,
      bio: p.bio,
      services: p.services,
      caseStudies: p.caseStudies,
      testimonials: p.testimonials,
      processSteps: p.processSteps,
      faqs: p.faqs,
      stats: p.stats,
      valueProps: p.valueProps,
      availability: p.availability,
      responseTime: p.responseTime,
      socials: p.socials,
      accentColor: p.accentColor,
      theme: p.theme,
      photoUrl: p.photoUrl,
      contactEmail: p.contactEmail,
      technologies: p.technologies,
    };
    res.json(pub);
  })
);

router.post(
  "/public/:slug/contact",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug.toLowerCase();
    const row = db
      .select()
      .from(portfolios)
      .where(eq(portfolios.slug, slug))
      .all()[0];
    if (!row || !row.published) {
      return res.status(404).json({ error: "Portfolio no encontrado" });
    }
    const data = contactSchema.parse(req.body);
    const now = new Date().toISOString();
    db.insert(leads)
      .values({
        userId: row.userId,
        name: data.company ? `${data.name} (${data.company})` : data.name,
        email: data.email,
        website: null,
        phone: null,
        city: null,
        niche: "portfolio",
        source: "portfolio",
        status: "interested",
        notes: data.message,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    res.json({ ok: true });
  })
);

export default router;
