import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { clients, incomes, proposals } from "../db/schema";
import { AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";

const router = Router();

router.get(
  "/metrics",
  asyncHandler(async (req: AuthedRequest, res) => {
    const allIncomes = db
      .select()
      .from(incomes)
      .where(eq(incomes.userId, req.userId))
      .all();

    const now = new Date();
    const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const monthlyTotals: Record<string, number> = {};
    for (const inc of allIncomes) {
      const d = new Date(inc.receivedAt);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyTotals[key] = (monthlyTotals[key] || 0) + inc.amount;
    }
    const monthlyIncome = monthlyTotals[currentMonthKey] || 0;

    // build last 12 months series
    const series: Array<{ month: string; total: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      series.push({ month: key, total: Math.round(monthlyTotals[key] || 0) });
    }

    // projected: if month elapsed by 40%, project total/0.4
    const dayOfMonth = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const ratio = dayOfMonth / daysInMonth;
    const projectedMonthly = ratio > 0 ? Math.round(monthlyIncome / ratio) : 0;

    const allProposals = db
      .select()
      .from(proposals)
      .where(eq(proposals.userId, req.userId))
      .all();
    const sent = allProposals.filter((p) => p.status !== "draft").length;
    const accepted = allProposals.filter((p) => p.status === "accepted").length;
    const conversionRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;

    const allClients = db
      .select()
      .from(clients)
      .where(eq(clients.userId, req.userId))
      .orderBy(desc(clients.updatedAt))
      .all();
    const activeProjects = allClients.filter((c) => c.status === "active").length;

    res.json({
      monthlyIncome: Math.round(monthlyIncome),
      monthlyIncomeCurrency: "EUR",
      activeProjects,
      proposalsSent: sent,
      conversionRate,
      projectedMonthly,
      recentClients: allClients.slice(0, 5),
      monthlyIncomeSeries: series,
    });
  })
);

export default router;
