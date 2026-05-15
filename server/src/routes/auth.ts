import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { config } from "../config";
import { asyncHandler } from "../middleware/error";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function sign(userId: number): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const existing = db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .all();
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const inserted = db
      .insert(users)
      .values({ email: data.email, passwordHash, name: data.name })
      .returning()
      .all();
    const u = inserted[0];
    const token = sign(u.id);
    res.json({
      token,
      user: { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt },
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const rows = db.select().from(users).where(eq(users.email, data.email)).all();
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(data.password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = sign(u.id);
    res.json({
      token,
      user: { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt },
    });
  })
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(header.slice(7), config.jwtSecret) as unknown as {
        sub: number;
      };
      const u = db
        .select()
        .from(users)
        .where(eq(users.id, Number(payload.sub)))
        .all()[0];
      if (!u) return res.status(404).json({ error: "User not found" });
      res.json({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
      });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  })
);

export default router;
