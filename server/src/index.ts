import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import proposalRoutes from "./routes/proposals";
import pricingRoutes from "./routes/pricing";
import profileRoutes from "./routes/profiles";
import emailRoutes from "./routes/emails";
import incomeRoutes from "./routes/income";
import dashboardRoutes from "./routes/dashboard";
import settingsRoutes from "./routes/settings";
import invoiceRoutes from "./routes/invoices";
import leadRoutes from "./routes/leads";
import outboxRoutes from "./routes/outbox";
import discoverRoutes from "./routes/discover";
import portfolioRoutes from "./routes/portfolio";
import { applySchema } from "./db/setup";

// Ensure DB schema exists at boot (safe idempotent)
applySchema();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, env: config.nodeEnv }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", authMiddleware, clientRoutes);
app.use("/api/proposals", authMiddleware, proposalRoutes);
app.use("/api/pricing", authMiddleware, pricingRoutes);
app.use("/api/profiles", authMiddleware, profileRoutes);
app.use("/api/emails", authMiddleware, emailRoutes);
app.use("/api/income", authMiddleware, incomeRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);
app.use("/api/invoices", authMiddleware, invoiceRoutes);
app.use("/api/leads", authMiddleware, leadRoutes);
app.use("/api/outbox", authMiddleware, outboxRoutes);
app.use("/api/discover", authMiddleware, discoverRoutes);
// Portfolio: mixed auth — auth handled per-route inside
app.use("/api/portfolio", portfolioRoutes);

// ---- Serve frontend in production ----
if (config.nodeEnv === "production") {
  const candidates = [
    path.resolve(process.cwd(), "client/dist"),
    path.resolve(process.cwd(), "../client/dist"),
    path.resolve(__dirname, "../../../client/dist"),
  ];
  const staticDir = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    console.log(`[server] serving frontend from ${staticDir}`);
  } else {
    console.warn("[server] could not locate client/dist — running API-only");
  }
}

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[server] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
