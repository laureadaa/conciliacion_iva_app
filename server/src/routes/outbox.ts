import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { leads, outbox } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { ensureSettings } from "./settings";
import { sendEmail } from "../services/mailer";

const router = Router();

const queueSchema = z.object({
  leadId: z.number().int().nullable().optional(),
  recipient: z.string().email(),
  recipientName: z.string().nullable().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

const sendSchema = z.object({
  ids: z.array(z.number().int()).min(1),
});

// List
router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const rows = db
      .select()
      .from(outbox)
      .where(eq(outbox.userId, req.userId))
      .orderBy(desc(outbox.createdAt))
      .all();
    res.json(rows);
  })
);

// Add a single message
router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = queueSchema.parse(req.body);
    const now = new Date().toISOString();
    const inserted = db
      .insert(outbox)
      .values({
        userId: req.userId,
        leadId: data.leadId ?? null,
        recipient: data.recipient,
        recipientName: data.recipientName ?? null,
        subject: data.subject,
        body: data.body,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    res.status(201).json(inserted[0]);
  })
);

// Delete
router.delete(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const deleted = db
      .delete(outbox)
      .where(and(eq(outbox.id, id), eq(outbox.userId, req.userId)))
      .returning()
      .all();
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  })
);

// Send selected messages via Gmail SMTP
router.post(
  "/send",
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = sendSchema.parse(req.body);
    const s = ensureSettings(req.userId);
    if (!s.smtpUser || !s.smtpAppPassword) {
      return res.status(400).json({
        error:
          "Falta configurar SMTP (Gmail) en Ajustes: usuario + App password.",
      });
    }

    // Enforce daily limit (sent today, across all outbox entries)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const sentTodayRows = db
      .select()
      .from(outbox)
      .where(
        and(
          eq(outbox.userId, req.userId),
          eq(outbox.status, "sent"),
          gte(outbox.sentAt, startOfDay.toISOString())
        )
      )
      .all();
    const remaining = Math.max(0, s.smtpDailyLimit - sentTodayRows.length);
    if (remaining === 0) {
      return res.status(429).json({
        error: `Límite diario alcanzado (${s.smtpDailyLimit}). Mañana puedes enviar más.`,
      });
    }

    const idsToSend = data.ids.slice(0, remaining);

    const messages = db
      .select()
      .from(outbox)
      .where(
        and(eq(outbox.userId, req.userId), inArray(outbox.id, idsToSend))
      )
      .all();

    const results: Array<{ id: number; ok: boolean; error?: string }> = [];
    for (const m of messages) {
      if (m.status === "sent") {
        results.push({ id: m.id, ok: true });
        continue;
      }
      try {
        await sendEmail(
          {
            user: s.smtpUser,
            appPassword: s.smtpAppPassword,
            fromName: s.smtpFromName || s.fullName || s.businessName,
          },
          { to: m.recipient, subject: m.subject, text: m.body }
        );
        const now = new Date().toISOString();
        db.update(outbox)
          .set({ status: "sent", sentAt: now, errorMessage: null, updatedAt: now })
          .where(eq(outbox.id, m.id))
          .run();
        if (m.leadId) {
          db.update(leads)
            .set({ status: "contacted", updatedAt: now })
            .where(eq(leads.id, m.leadId))
            .run();
        }
        results.push({ id: m.id, ok: true });
        // throttle ~5s between sends so Gmail doesn't flag the burst
        if (messages.indexOf(m) < messages.length - 1) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        db.update(outbox)
          .set({
            status: "failed",
            errorMessage: errorMsg,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(outbox.id, m.id))
          .run();
        results.push({ id: m.id, ok: false, error: errorMsg });
      }
    }
    const skipped = data.ids.length - idsToSend.length;
    res.json({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      skippedByLimit: skipped,
      results,
    });
  })
);

export default router;
