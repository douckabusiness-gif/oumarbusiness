import type { Express } from "express";
import { agentsRouter } from "./modules/agents.js";
import { adminAuthRouter, requireAuthenticatedAdmin } from "./modules/admin-auth.js";
import { billingRouter } from "./modules/billing.js";
import { clientPortalRouter } from "./modules/client-portal.js";
import { crmRouter } from "./modules/crm.js";
import { emailRouter } from "./modules/email.js";
import { healthRouter } from "./modules/health.js";
import { intelligenceRouter } from "./modules/intelligence.js";
import { marketingRouter } from "./modules/marketing.js";
import { marketRouter } from "./modules/market.js";
import { memoryRouter } from "./modules/memory.js";
import { messagingRouter } from "./modules/messaging.js";
import { notificationsRouter } from "./modules/notifications.js";
import { projectsRouter } from "./modules/projects.js";
import { quotesRouter } from "./modules/quotes.js";
import { saasRouter } from "./modules/saas.js";
import { settingsRouter } from "./modules/settings.js";
import { whatsappRouter } from "./modules/whatsapp.js";

export function registerRoutes(app: Express) {
  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "oumar-api",
      message: `API Oumar Business active. Interface web: ${process.env.APP_URL ?? "http://localhost:1010"}`,
      health: "/health",
    });
  });

  app.use("/health", healthRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/admin-auth", adminAuthRouter);
  app.use("/api/agents", requireAuthenticatedAdmin, agentsRouter);
  app.use("/api/whatsapp", whatsappRouter);
  app.use("/api/email", requireAuthenticatedAdmin, emailRouter);
  app.use("/api/crm", requireAuthenticatedAdmin, crmRouter);
  app.use("/api/projects", requireAuthenticatedAdmin, projectsRouter);
  app.use("/api/quotes", requireAuthenticatedAdmin, quotesRouter);
  app.use("/api/billing", requireAuthenticatedAdmin, billingRouter);
  app.use("/api/client-portal", clientPortalRouter);
  app.use("/api/sourcing", saasRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/marketing", requireAuthenticatedAdmin, marketingRouter);
  app.use("/api/market", marketRouter);
  app.use("/api/messaging", requireAuthenticatedAdmin, messagingRouter);
  app.use("/api/memory", requireAuthenticatedAdmin, memoryRouter);
  app.use("/api/intelligence", requireAuthenticatedAdmin, intelligenceRouter);
  app.use("/api/settings/notifications", requireAuthenticatedAdmin, notificationsRouter);
}
