import "dotenv/config";
import crypto from "crypto";

const nodeEnv = process.env.NODE_ENV || "development";

function required(key: string, value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value;
  if (fallback !== undefined) {
    if (nodeEnv === "production") {
      console.warn(`[config] ${key} not set, using fallback (NOT recommended for production)`);
    }
    return fallback;
  }
  throw new Error(`[config] Missing required env var: ${key}`);
}

const jwtSecret = required(
  "JWT_SECRET",
  process.env.JWT_SECRET,
  nodeEnv === "production"
    ? crypto.randomBytes(48).toString("hex")
    : "dev-secret-change-me"
);

if (nodeEnv === "production" && jwtSecret.length < 32) {
  console.warn(
    "[config] JWT_SECRET is shorter than 32 chars — generate a longer random string"
  );
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};

// Print non-sensitive boot summary
console.log(
  `[config] env=${config.nodeEnv} port=${config.port} db=${process.env.DATABASE_URL || "./data/app.db"}`
);
