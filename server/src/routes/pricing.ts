import { Router } from "express";
import { z } from "zod";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { generateJustification } from "../services/generator";
import { ensureSettings } from "./settings";

const router = Router();

const calculateSchema = z.object({
  projectType: z.string().min(1),
  complexity: z.enum(["basic", "medium", "advanced"]),
  extras: z.array(z.string()).default([]),
  hourlyRate: z.number().positive().optional(),
});

const justifySchema = z.object({
  projectType: z.string().min(1),
  complexity: z.enum(["basic", "medium", "advanced"]),
  extras: z.array(z.string()).default([]),
  price: z.number().positive(),
  language: z.enum(["es", "en"]),
});

const BASE_HOURS: Record<string, Record<string, number>> = {
  landing: { basic: 12, medium: 24, advanced: 40 },
  webapp: { basic: 40, medium: 90, advanced: 180 },
  ecommerce: { basic: 60, medium: 120, advanced: 220 },
  api: { basic: 25, medium: 60, advanced: 120 },
  mobile: { basic: 80, medium: 160, advanced: 280 },
  dashboard: { basic: 35, medium: 80, advanced: 150 },
  consulting: { basic: 10, medium: 25, advanced: 50 },
  maintenance: { basic: 8, medium: 20, advanced: 40 },
  other: { basic: 30, medium: 60, advanced: 120 },
};

const EXTRA_HOURS: Record<string, number> = {
  seo: 6,
  i18n: 8,
  cms: 12,
  auth: 10,
  payments: 14,
  dashboard: 16,
  tests: 10,
  cicd: 6,
  analytics: 4,
  ai: 18,
  responsive: 6,
  accessibility: 8,
};

router.post(
  "/calculate",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = calculateSchema.parse(req.body);
    const s = ensureSettings(req.userId);
    const key = data.projectType.toLowerCase().trim();
    const baseTable = BASE_HOURS[key] || BASE_HOURS.other;
    const baseHours = baseTable[data.complexity];

    const breakdown: Array<{ label: string; hours: number }> = [
      { label: `Base (${data.projectType} - ${data.complexity})`, hours: baseHours },
    ];
    let extraTotal = 0;
    for (const e of data.extras) {
      const h = EXTRA_HOURS[e.toLowerCase()] ?? 6;
      breakdown.push({ label: `Extra: ${e}`, hours: h });
      extraTotal += h;
    }

    const totalHours = baseHours + extraTotal;
    const rate = data.hourlyRate || s.hourlyRate || 45;

    const recommendedMid = totalHours * rate;
    const result = {
      economic: {
        min: Math.round(recommendedMid * 0.7),
        max: Math.round(recommendedMid * 0.85),
        hours: Math.round(totalHours * 0.9),
      },
      recommended: {
        min: Math.round(recommendedMid * 0.95),
        max: Math.round(recommendedMid * 1.1),
        hours: totalHours,
      },
      premium: {
        min: Math.round(recommendedMid * 1.25),
        max: Math.round(recommendedMid * 1.5),
        hours: Math.round(totalHours * 1.15),
      },
      breakdown,
      currency: s.currency || "EUR",
    };
    res.json(result);
  })
);

router.post(
  "/justify",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = justifySchema.parse(req.body);
    const s = ensureSettings(req.userId);
    const content = generateJustification({
      projectType: data.projectType,
      complexity: data.complexity,
      extras: data.extras,
      price: data.price,
      language: data.language,
      user: { currency: s.currency },
    });
    res.json({ content });
  })
);

export default router;
