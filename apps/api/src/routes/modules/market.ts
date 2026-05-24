import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { EmailEngine } from "@oumar/email-engine";
import { baileysManager } from "@oumar/whatsapp-baileys";
import { prisma } from "../../db/prisma.js";
import { sendBusinessPushNotificationSafe } from "./notifications.js";
import { getRuntimeEmailAccount } from "./settings.js";
import { resolveAuthenticatedAdmin } from "./admin-auth.js";

export const marketRouter = Router();

// ─── Protection admin (toutes les routes sauf /public-apps) ──────────────────
marketRouter.use(async (req, res, next) => {
  if (req.path.startsWith("/public-apps")) return next();
  try {
    const admin = await resolveAuthenticatedAdmin(req);
    if (!admin) return res.status(401).json({ error: "Acces non autorise. Connectez-vous en tant qu'admin." });
    next();
  } catch (error) {
    next(error);
  }
});

const marketAppsKey = "marketplace_apps";
const marketplaceAssetsDir = path.resolve(process.env.UPLOADS_DIR ?? "/data/uploads", "marketplace", "apps");

type ProjectCategory = "agent" | "website" | "marketing" | "automation";
type AppStatus = "draft" | "private" | "published" | "archived";
type Currency = "XOF" | "EUR" | "USD";
type LicenseType = "single" | "extended" | "enterprise" | "internal";

type FinishedProjectOption = {
  id: string;
  name: string;
  category: ProjectCategory;
  market: string;
  summary: string;
  deliverables: string[];
};

type MarketplaceApp = {
  id: string;
  sourceProjectId?: string;
  sourceProjectName?: string;
  appName: string;
  slug: string;
  category: ProjectCategory;
  tagline: string;
  shortDescription: string;
  fullDescription: string;
  targetClient: string;
  marketScope: string;
  priceFrom: number;
  currency: Currency;
  licenseType: LicenseType;
  licenseName: string;
  licenseSummary: string;
  supportWindowDays: number;
  demoUrl: string;
  adminDemoUrl?: string;
  demoLogin?: string;
  demoPassword?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  downloadUrl?: string;
  galleryUrls: string[];
  features: string[];
  deliverables: string[];
  techStack: string[];
  tags: string[];
  featured: boolean;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
};

type ConfirmationStatus = "sent" | "failed" | "skipped";
type ConfirmationResult = {
  status: ConfirmationStatus;
  detail: string;
};

type LeadStateUpdate = {
  status?: string;
  hot?: boolean;
  followup?: boolean;
  assignedToId?: string | null;
};

const finishedProjects: FinishedProjectOption[] = [
  {
    id: "audit-seo-nimba",
    name: "Audit SEO Nimba",
    category: "marketing",
    market: "Afrique de l'Ouest / Europe francophone",
    summary: "Audit SEO structuré avec recommandations actionnables, scoring et plan d'exécution.",
    deliverables: ["Audit PDF", "Plan d'action 90 jours", "Checklist optimisation"]
  },
  {
    id: "portail-client-baobab",
    name: "Portail client Baobab",
    category: "website",
    market: "Afrique / Europe",
    summary: "Portail client sécurisé avec suivi projet, validations, espace documents et factures.",
    deliverables: ["Portail web", "Tableau de bord client", "Workflow approbation"]
  },
  {
    id: "agent-whatsapp-clinicai",
    name: "Agent WhatsApp ClinicAI",
    category: "agent",
    market: "Afrique / USA / Europe",
    summary: "Agent WhatsApp autonome pour qualification, réponses automatiques et escalade humaine.",
    deliverables: ["Prompt métier", "Flows WhatsApp", "Base FAQ", "Journal agent"]
  },
  {
    id: "automation-leads-kora",
    name: "Automation Leads Kora",
    category: "automation",
    market: "Côte d'Ivoire / Sénégal / France",
    summary: "Pipeline automatisé de capture, qualification CRM et relances multi-canal.",
    deliverables: ["Pipeline CRM", "Règles relance", "Rapport conversion"]
  }
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCategory(value: unknown): ProjectCategory | null {
  return value === "agent" || value === "website" || value === "marketing" || value === "automation" ? value : null;
}

function parseStatus(value: unknown): AppStatus | null {
  return value === "draft" || value === "private" || value === "published" || value === "archived" ? value : null;
}

function parseCurrency(value: unknown): Currency | null {
  return value === "XOF" || value === "EUR" || value === "USD" ? value : null;
}

function parseLicenseType(value: unknown): LicenseType | null {
  return value === "single" || value === "extended" || value === "enterprise" || value === "internal" ? value : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function extractDataUrlPayload(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  const mimeType = match?.[1];
  const base64Payload = match?.[2];

  if (!mimeType || !base64Payload) {
    throw new Error("Format de fichier invalide.");
  }

  return {
    mimeType,
    bytes: Buffer.from(base64Payload, "base64")
  };
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "application/zip" || mimeType === "application/x-zip-compressed") return "zip";
  if (mimeType === "application/pdf") return "pdf";
  return "mp4";
}

function sanitizeExtension(filenameHint?: string) {
  const extension = path.extname(filenameHint ?? "").replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{2,8}$/.test(extension) ? extension : "";
}

async function storeMarketplaceAsset(options: { dataUrl: string; prefix: string; filenameHint?: string }) {
  const { mimeType, bytes } = extractDataUrlPayload(options.dataUrl);
  const extension = sanitizeExtension(options.filenameHint) || extensionFromMime(mimeType);
  const filename = `${options.prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;

  await fs.mkdir(marketplaceAssetsDir, { recursive: true });
  await fs.writeFile(path.join(marketplaceAssetsDir, filename), bytes);

  return `/uploads/marketplace/apps/${filename}`;
}

function parseApp(value: unknown): MarketplaceApp | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const sourceProjectId = typeof value.sourceProjectId === "string" ? value.sourceProjectId : undefined;
  const sourceProjectName = typeof value.sourceProjectName === "string" ? value.sourceProjectName : undefined;
  const appName = typeof value.appName === "string" ? value.appName : "";
  const slug = typeof value.slug === "string" ? value.slug : "";
  const category = parseCategory(value.category);
  const tagline = typeof value.tagline === "string" ? value.tagline : "";
  const shortDescription = typeof value.shortDescription === "string" ? value.shortDescription : "";
  const fullDescription = typeof value.fullDescription === "string" ? value.fullDescription : "";
  const targetClient = typeof value.targetClient === "string" ? value.targetClient : "";
  const marketScope = typeof value.marketScope === "string" ? value.marketScope : "";
  const priceFrom = typeof value.priceFrom === "number" ? value.priceFrom : 0;
  const currency = parseCurrency(value.currency);
  const licenseType = parseLicenseType(value.licenseType);
  const licenseName = typeof value.licenseName === "string" ? value.licenseName : "";
  const licenseSummary = typeof value.licenseSummary === "string" ? value.licenseSummary : "";
  const supportWindowDays = typeof value.supportWindowDays === "number" ? value.supportWindowDays : 0;
  const demoUrl = typeof value.demoUrl === "string" ? value.demoUrl : "";
  const adminDemoUrl = typeof value.adminDemoUrl === "string" ? value.adminDemoUrl : undefined;
  const demoLogin = typeof value.demoLogin === "string" ? value.demoLogin : undefined;
  const demoPassword = typeof value.demoPassword === "string" ? value.demoPassword : undefined;
  const thumbnailUrl = typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : undefined;
  const videoUrl = typeof value.videoUrl === "string" ? value.videoUrl : undefined;
  const downloadUrl = typeof value.downloadUrl === "string" ? value.downloadUrl : undefined;
  const galleryUrls = toStringArray(value.galleryUrls);
  const features = toStringArray(value.features);
  const deliverables = toStringArray(value.deliverables);
  const techStack = toStringArray(value.techStack);
  const tags = toStringArray(value.tags);
  const featured = typeof value.featured === "boolean" ? value.featured : false;
  const status = parseStatus(value.status);
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;

  if (!id || !appName || !slug || !category || !tagline || !shortDescription || !fullDescription || !targetClient || !marketScope || !currency || !licenseType || !licenseName || !licenseSummary || !demoUrl || !status) {
    return null;
  }

  return {
    id,
    sourceProjectId,
    sourceProjectName,
    appName,
    slug,
    category,
    tagline,
    shortDescription,
    fullDescription,
    targetClient,
    marketScope,
    priceFrom,
    currency,
    licenseType,
    licenseName,
    licenseSummary,
    supportWindowDays,
    demoUrl,
    adminDemoUrl,
    demoLogin,
    demoPassword,
    thumbnailUrl,
    videoUrl,
    downloadUrl,
    galleryUrls,
    features,
    deliverables,
    techStack,
    tags,
    featured,
    status,
    createdAt,
    updatedAt
  };
}

async function readApps() {
  const stored = await prisma.appSetting.findUnique({ where: { key: marketAppsKey } }).catch(() => null);
  const raw = stored?.value;
  if (!Array.isArray(raw)) return [] as MarketplaceApp[];
  return raw.map(parseApp).filter((item): item is MarketplaceApp => Boolean(item));
}

async function writeApps(items: MarketplaceApp[]) {
  await prisma.appSetting.upsert({
    where: { key: marketAppsKey },
    update: { value: items as never },
    create: { key: marketAppsKey, value: items as never }
  });
}

function sortApps(items: MarketplaceApp[]) {
  return [...items].sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

function extractAssignedAgentId(tags: string[]) {
  return tags.find((tag) => tag.startsWith("assigned_"))?.replace(/^assigned_/, "") ?? null;
}

function appTagLooksLikeSlug(tag: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(tag) && !tag.startsWith("lead-");
}

function mergeLeadTags(currentTags: string[], update: LeadStateUpdate) {
  const next = new Set(
    currentTags.filter((tag) => !tag.startsWith("assigned_") && tag !== "lead_hot" && tag !== "needs_followup")
  );

  if (update.hot === true) next.add("lead_hot");
  if (update.followup === true) next.add("needs_followup");
  if (update.assignedToId) next.add(`assigned_${update.assignedToId}`);

  return Array.from(next);
}

function buildMarketplaceEmailText(input: {
  name: string;
  appName: string;
  demoUrl: string;
  budget?: string;
}) {
  return [
    `Bonjour ${input.name},`,
    "",
    `Nous avons bien recu votre demande pour l'application "${input.appName}".`,
    input.budget ? `Budget indique: ${input.budget}.` : "Nous allons analyser votre besoin et revenir vers vous rapidement.",
    "",
    "Vous pouvez deja revoir la demo ici :",
    input.demoUrl,
    "",
    "Notre equipe va vous contacter pour la suite sur le canal le plus adapte.",
    "",
    "Merci,",
    "Oumar Business"
  ].join("\n");
}

function buildMarketplaceWhatsAppText(input: {
  name: string;
  appName: string;
  demoUrl: string;
}) {
  return [
    `Bonjour ${input.name},`,
    `Nous avons bien recu votre demande pour ${input.appName}.`,
    "Merci pour votre interet.",
    `Demo: ${input.demoUrl}`,
    "Notre equipe vous recontacte tres vite."
  ].join("\n");
}

function buildInternalLeadEmailText(input: {
  name: string;
  company?: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  budget?: string;
  message?: string;
  appName: string;
  appSlug: string;
}) {
  return [
    "Nouveau lead marketplace recu.",
    "",
    `Application demandee: ${input.appName}`,
    `Slug: ${input.appSlug}`,
    `Nom: ${input.name}`,
    `Entreprise: ${input.company || "Non renseignee"}`,
    `Email: ${input.email || "Non renseigne"}`,
    `WhatsApp: ${input.whatsapp || "Non renseigne"}`,
    `Pays: ${input.country || "Non renseigne"}`,
    `Budget: ${input.budget || "Non renseigne"}`,
    "",
    "Message:",
    input.message || "Aucun message.",
    "",
    "Source CRM: marketplace"
  ].join("\n");
}

function buildInternalLeadWhatsAppText(input: {
  name: string;
  appName: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  budget?: string;
}) {
  return [
    "Nouveau lead marketplace.",
    `App: ${input.appName}`,
    `Nom: ${input.name}`,
    `Email: ${input.email || "non renseigne"}`,
    `WhatsApp: ${input.whatsapp || "non renseigne"}`,
    `Pays: ${input.country || "non renseigne"}`,
    `Budget: ${input.budget || "non renseigne"}`
  ].join("\n");
}

function buildLeadFollowupEmailText(input: {
  name: string;
  appName: string;
  demoUrl: string;
  customMessage?: string;
}) {
  return [
    `Bonjour ${input.name},`,
    "",
    input.customMessage || `Je reviens vers vous au sujet de votre demande pour ${input.appName}.`,
    "",
    `Vous pouvez revoir la demo ici : ${input.demoUrl}`,
    "",
    "Si vous voulez, nous pouvons vous proposer la version la plus adaptee a votre besoin.",
    "",
    "Oumar Business"
  ].join("\n");
}

function buildLeadFollowupWhatsAppText(input: {
  name: string;
  appName: string;
  demoUrl: string;
  customMessage?: string;
}) {
  return [
    `Bonjour ${input.name},`,
    input.customMessage || `Je reviens vers vous pour ${input.appName}.`,
    `Demo: ${input.demoUrl}`,
    "Souhaitez-vous que nous vous preparions une proposition rapide ?"
  ].join("\n");
}

async function createMarketplaceLog(input: {
  action: string;
  clientId?: string;
  target?: string;
  output?: string;
  error?: string;
}) {
  await prisma.agentLog.create({
    data: {
      agentType: "sales",
      action: input.action,
      input: input.target,
      output: input.output,
      clientId: input.clientId,
      error: input.error,
      escalated: false
    }
  });
}

async function sendMarketplaceEmailConfirmation(input: {
  clientId: string;
  to?: string;
  name: string;
  appName: string;
  demoUrl: string;
  budget?: string;
}): Promise<ConfirmationResult> {
  if (!input.to) {
    return { status: "skipped", detail: "Aucun email fourni." };
  }

  try {
    const account = await getRuntimeEmailAccount("main");
    const engine = new EmailEngine();
    await engine.send({
      account,
      from: `${account.name ?? "Oumar Business"} <${account.email}>`,
      to: [input.to],
      subject: `Nous avons bien recu votre demande - ${input.appName}`,
      text: buildMarketplaceEmailText(input)
    });
    await createMarketplaceLog({
      action: "marketplace_confirmation_email_sent",
      clientId: input.clientId,
      target: input.to,
      output: "sent"
    });
    return { status: "sent", detail: "Email de confirmation envoye." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await createMarketplaceLog({
      action: "marketplace_confirmation_email_failed",
      clientId: input.clientId,
      target: input.to,
      error: detail
    });
    return { status: "failed", detail };
  }
}

async function sendMarketplaceWhatsAppConfirmation(input: {
  clientId: string;
  to?: string;
  name: string;
  appName: string;
  demoUrl: string;
}): Promise<ConfirmationResult> {
  if (!input.to) {
    return { status: "skipped", detail: "Aucun numero WhatsApp fourni." };
  }

  const sessions = await prisma.wASession.findMany({
    where: { type: "baileys", status: "connected" },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const session of sessions) {
    const client = baileysManager.get(session.id);
    if (!client || client.status !== "open") continue;

    try {
      await client.sendText(
        input.to,
        buildMarketplaceWhatsAppText({
          name: input.name,
          appName: input.appName,
          demoUrl: input.demoUrl
        })
      );
      await createMarketplaceLog({
        action: "marketplace_confirmation_whatsapp_sent",
        clientId: input.clientId,
        target: input.to,
        output: "sent"
      });
      return { status: "sent", detail: "WhatsApp de confirmation envoye." };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await createMarketplaceLog({
        action: "marketplace_confirmation_whatsapp_failed",
        clientId: input.clientId,
        target: input.to,
        error: detail
      });
      return { status: "failed", detail };
    }
  }

  await createMarketplaceLog({
    action: "marketplace_confirmation_whatsapp_blocked",
    clientId: input.clientId,
    target: input.to,
    output: "no_active_session"
  });
  return { status: "failed", detail: "Aucune session WhatsApp Baileys active." };
}

async function sendInternalLeadEmailNotification(input: {
  clientId: string;
  name: string;
  company?: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  budget?: string;
  message?: string;
  appName: string;
  appSlug: string;
}): Promise<ConfirmationResult> {
  try {
    const account = await getRuntimeEmailAccount("main");
    const engine = new EmailEngine();
    await engine.send({
      account,
      from: `${account.name ?? "Oumar Business"} <${account.email}>`,
      to: [account.email],
      subject: `Nouveau lead marketplace - ${input.appName}`,
      text: buildInternalLeadEmailText(input)
    });
    await createMarketplaceLog({
      action: "marketplace_internal_email_sent",
      clientId: input.clientId,
      target: account.email,
      output: "sent"
    });
    return { status: "sent", detail: "Notification email interne envoyee." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await createMarketplaceLog({
      action: "marketplace_internal_email_failed",
      clientId: input.clientId,
      error: detail
    });
    return { status: "failed", detail };
  }
}

async function sendInternalLeadWhatsAppNotification(input: {
  clientId: string;
  name: string;
  appName: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  budget?: string;
}): Promise<ConfirmationResult> {
  const target = process.env.OUMAR_WHATSAPP_NUMBER?.trim();
  if (!target) {
    return { status: "skipped", detail: "OUMAR_WHATSAPP_NUMBER non configure." };
  }

  const sessions = await prisma.wASession.findMany({
    where: { type: "baileys", status: "connected" },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const session of sessions) {
    const client = baileysManager.get(session.id);
    if (!client || client.status !== "open") continue;

    try {
      await client.sendText(
        target,
        buildInternalLeadWhatsAppText(input)
      );
      await createMarketplaceLog({
        action: "marketplace_internal_whatsapp_sent",
        clientId: input.clientId,
        target,
        output: "sent"
      });
      return { status: "sent", detail: "Notification WhatsApp interne envoyee." };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await createMarketplaceLog({
        action: "marketplace_internal_whatsapp_failed",
        clientId: input.clientId,
        target,
        error: detail
      });
      return { status: "failed", detail };
    }
  }

  await createMarketplaceLog({
    action: "marketplace_internal_whatsapp_blocked",
    clientId: input.clientId,
    target,
    output: "no_active_session"
  });
  return { status: "failed", detail: "Aucune session WhatsApp Baileys active pour notifier Oumar." };
}

async function sendLeadFollowupEmail(input: {
  clientId: string;
  to?: string;
  name: string;
  appName: string;
  demoUrl: string;
  customMessage?: string;
}): Promise<ConfirmationResult> {
  if (!input.to) {
    return { status: "skipped", detail: "Aucun email sur ce lead." };
  }

  try {
    const account = await getRuntimeEmailAccount("main");
    const engine = new EmailEngine();
    await engine.send({
      account,
      from: `${account.name ?? "Oumar Business"} <${account.email}>`,
      to: [input.to],
      subject: `Suite a votre demande - ${input.appName}`,
      text: buildLeadFollowupEmailText(input)
    });
    await createMarketplaceLog({
      action: "marketplace_followup_email_sent",
      clientId: input.clientId,
      target: input.to,
      output: "sent"
    });
    return { status: "sent", detail: "Relance email envoyee." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await createMarketplaceLog({
      action: "marketplace_followup_email_failed",
      clientId: input.clientId,
      target: input.to,
      error: detail
    });
    return { status: "failed", detail };
  }
}

async function sendLeadFollowupWhatsApp(input: {
  clientId: string;
  to?: string;
  name: string;
  appName: string;
  demoUrl: string;
  customMessage?: string;
}): Promise<ConfirmationResult> {
  if (!input.to) {
    return { status: "skipped", detail: "Aucun numero WhatsApp sur ce lead." };
  }

  const sessions = await prisma.wASession.findMany({
    where: { type: "baileys", status: "connected" },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const session of sessions) {
    const client = baileysManager.get(session.id);
    if (!client || client.status !== "open") continue;

    try {
      await client.sendText(
        input.to,
        buildLeadFollowupWhatsAppText(input)
      );
      await createMarketplaceLog({
        action: "marketplace_followup_whatsapp_sent",
        clientId: input.clientId,
        target: input.to,
        output: "sent"
      });
      return { status: "sent", detail: "Relance WhatsApp envoyee." };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await createMarketplaceLog({
        action: "marketplace_followup_whatsapp_failed",
        clientId: input.clientId,
        target: input.to,
        error: detail
      });
      return { status: "failed", detail };
    }
  }

  await createMarketplaceLog({
    action: "marketplace_followup_whatsapp_blocked",
    clientId: input.clientId,
    target: input.to,
    output: "no_active_session"
  });
  return { status: "failed", detail: "Aucune session WhatsApp Baileys active." };
}

marketRouter.get("/source-projects", (_req, res) => {
  res.json({ items: finishedProjects });
});

marketRouter.get("/apps", async (_req, res) => {
  const items = await readApps();
  res.json({ items: sortApps(items) });
});

marketRouter.get("/leads", async (_req, res, next) => {
  try {
    const apps = await readApps();
    const appMap = new Map(apps.map((item) => [item.slug, item]));

    const leads = await prisma.client.findMany({
      where: {
        OR: [
          { source: "marketplace" },
          { tags: { has: "marketplace_order" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        whatsapp: true,
        country: true,
        status: true,
        source: true,
        tags: true,
        createdAt: true,
        lastContact: true
      }
    });

    res.json({
      items: leads.map((lead: (typeof leads)[number]) => {
        const requestedAppSlug = lead.tags.find((tag: string) => appMap.has(tag)) ?? null;
        const requestedApp = requestedAppSlug ? appMap.get(requestedAppSlug) ?? null : null;
        const budgetTag = lead.tags.find((tag: string) => tag.startsWith("budget_")) ?? null;

        return {
          ...lead,
          assignedAgentId: extractAssignedAgentId(lead.tags),
          requestedAppSlug,
          requestedAppName: requestedApp?.appName ?? null,
          requestedAppCategory: requestedApp?.category ?? null,
          budgetHint: budgetTag ? budgetTag.replace(/^budget_/, "").replace(/_/g, " ") : null,
          leadChannel: lead.email && lead.whatsapp ? "email + whatsapp" : lead.email ? "email" : lead.whatsapp ? "whatsapp" : "inconnu",
          isHot: lead.tags.includes("lead_hot") || lead.tags.includes("needs_followup") || Boolean(budgetTag),
          needsFollowup: lead.tags.includes("needs_followup")
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

marketRouter.patch("/leads/:id", async (req, res, next) => {
  try {
    const clientId = String(req.params.id ?? "").trim();
    const current = await prisma.client.findUnique({ where: { id: clientId } });
    if (!current) {
      res.status(404).json({ error: "Lead introuvable." });
      return;
    }

    const update: LeadStateUpdate = {
      status: typeof req.body.status === "string" && req.body.status.trim() ? req.body.status.trim() : undefined,
      hot: typeof req.body.hot === "boolean" ? req.body.hot : undefined,
      followup: typeof req.body.followup === "boolean" ? req.body.followup : undefined,
      assignedToId:
        typeof req.body.assignedToId === "string"
          ? req.body.assignedToId.trim() || null
          : req.body.assignedToId === null
            ? null
            : undefined
    };

    const nextTags = mergeLeadTags(current.tags, {
      hot: update.hot ?? current.tags.includes("lead_hot"),
      followup: update.followup ?? current.tags.includes("needs_followup"),
      assignedToId:
        update.assignedToId === undefined ? extractAssignedAgentId(current.tags) : update.assignedToId
    });

    const saved = await prisma.client.update({
      where: { id: clientId },
      data: {
        status: update.status ?? current.status,
        tags: nextTags,
        lastContact: new Date()
      },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        whatsapp: true,
        country: true,
        status: true,
        source: true,
        tags: true,
        createdAt: true,
        lastContact: true
      }
    });

    res.json({
      ok: true,
      item: {
        ...saved,
        assignedAgentId: extractAssignedAgentId(saved.tags),
        budgetHint: saved.tags.find((tag: string) => tag.startsWith("budget_"))?.replace(/^budget_/, "").replace(/_/g, " ") ?? null,
        leadChannel: saved.email && saved.whatsapp ? "email + whatsapp" : saved.email ? "email" : saved.whatsapp ? "whatsapp" : "inconnu",
        isHot: saved.tags.includes("lead_hot") || saved.tags.includes("needs_followup"),
        needsFollowup: saved.tags.includes("needs_followup")
      }
    });
  } catch (error) {
    next(error);
  }
});

marketRouter.post("/leads/:id/contact", async (req, res, next) => {
  try {
    const clientId = String(req.params.id ?? "").trim();
    const channel = typeof req.body.channel === "string" ? req.body.channel.trim() : "";
    const customMessage = typeof req.body.message === "string" ? req.body.message.trim() : "";
    const lead = await prisma.client.findUnique({ where: { id: clientId } });

    if (!lead) {
      res.status(404).json({ error: "Lead introuvable." });
      return;
    }

    const requestedAppSlug = lead.tags.find((tag: string) => !tag.startsWith("budget_") && !tag.startsWith("assigned_") && appTagLooksLikeSlug(tag)) ?? null;
    const apps = await readApps();
    const app = requestedAppSlug ? apps.find((item) => item.slug === requestedAppSlug) ?? null : null;

    if (!app) {
      res.status(400).json({ error: "Application liee au lead introuvable." });
      return;
    }

    const result =
      channel === "whatsapp"
        ? await sendLeadFollowupWhatsApp({
            clientId,
            to: lead.whatsapp ?? undefined,
            name: lead.name,
            appName: app.appName,
            demoUrl: app.demoUrl,
            customMessage: customMessage || undefined
          })
        : channel === "email"
          ? await sendLeadFollowupEmail({
              clientId,
              to: lead.email ?? undefined,
              name: lead.name,
              appName: app.appName,
              demoUrl: app.demoUrl,
              customMessage: customMessage || undefined
            })
          : null;

    if (!result) {
      res.status(400).json({ error: "Canal invalide." });
      return;
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        lastContact: new Date(),
        tags: mergeLeadTags(lead.tags, {
          hot: lead.tags.includes("lead_hot"),
          followup: true,
          assignedToId: extractAssignedAgentId(lead.tags)
        })
      }
    }).catch(() => null);

    res.json({
      ok: result.status === "sent",
      result
    });
  } catch (error) {
    next(error);
  }
});

marketRouter.get("/public-apps", async (_req, res) => {
  const items = await readApps();
  res.json({
    items: sortApps(items.filter((item) => item.status === "published"))
  });
});

marketRouter.get("/public-apps/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  const items = await readApps();
  const item = items.find((entry) => entry.slug === slug && entry.status === "published");

  if (!item) {
    res.status(404).json({ error: "Application introuvable." });
    return;
  }

  res.json({ item });
});

marketRouter.post("/public-apps/:slug/order", async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "").trim();
    const items = await readApps();
    const app = items.find((entry) => entry.slug === slug && entry.status === "published");

    if (!app) {
      res.status(404).json({ error: "Application introuvable." });
      return;
    }

    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const whatsapp = typeof req.body.whatsapp === "string" ? req.body.whatsapp.trim() : "";
    const company = typeof req.body.company === "string" ? req.body.company.trim() : "";
    const country = typeof req.body.country === "string" ? req.body.country.trim() : "";
    const budget = typeof req.body.budget === "string" ? req.body.budget.trim() : "";
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    const language = typeof req.body.language === "string" && req.body.language.trim() ? req.body.language.trim() : "fr";

    if (!name) {
      res.status(400).json({ error: "Le nom est obligatoire." });
      return;
    }

    if (!email && !whatsapp) {
      res.status(400).json({ error: "Ajoute au moins un email ou un numéro WhatsApp." });
      return;
    }

    const tags = Array.from(
      new Set(
        [
          "marketplace",
          "marketplace_order",
          app.category,
          app.slug,
          budget ? `budget_${budget.toLowerCase().replace(/\s+/g, "_")}` : "",
          message ? "needs_followup" : ""
        ].filter(Boolean)
      )
    );

    const existing = await prisma.client.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          whatsapp ? { whatsapp } : undefined,
          company ? { company } : undefined
        ].filter(Boolean) as Array<{ email?: string; whatsapp?: string; company?: string }>
      }
    });

    const client = existing
      ? await prisma.client.update({
          where: { id: existing.id },
          data: {
            name,
            company: company || existing.company,
            email: email || existing.email,
            whatsapp: whatsapp || existing.whatsapp,
            country: country || existing.country,
            language,
            source: "marketplace",
            status: "prospect",
            lastContact: new Date(),
            tags: Array.from(new Set([...existing.tags, ...tags]))
          }
        })
      : await prisma.client.create({
          data: {
            name,
            company: company || undefined,
            email: email || undefined,
            whatsapp: whatsapp || undefined,
            country: country || undefined,
            language,
            source: "marketplace",
            status: "prospect",
            lastContact: new Date(),
            tags
          }
        });

    const [emailConfirmation, whatsappConfirmation, internalEmailNotification, internalWhatsAppNotification] = await Promise.all([
      sendMarketplaceEmailConfirmation({
        clientId: client.id,
        to: email || undefined,
        name,
        appName: app.appName,
        demoUrl: app.demoUrl,
        budget: budget || undefined
      }),
      sendMarketplaceWhatsAppConfirmation({
        clientId: client.id,
        to: whatsapp || undefined,
        name,
        appName: app.appName,
        demoUrl: app.demoUrl
      }),
      sendInternalLeadEmailNotification({
        clientId: client.id,
        name,
        company: company || undefined,
        email: email || undefined,
        whatsapp: whatsapp || undefined,
        country: country || undefined,
        budget: budget || undefined,
        message: message || undefined,
        appName: app.appName,
        appSlug: app.slug
      }),
      sendInternalLeadWhatsAppNotification({
        clientId: client.id,
        name,
        appName: app.appName,
        email: email || undefined,
        whatsapp: whatsapp || undefined,
        country: country || undefined,
        budget: budget || undefined
      })
    ]);

    await sendBusinessPushNotificationSafe({
      title: "Nouveau lead marketplace",
      body: `${name} a demande ${app.appName}${budget ? ` - budget ${budget}` : ""}.`,
      url: "/market/leads",
      tag: `marketplace-lead-${client.id}`,
      source: "marketplace"
    });

    const confirmationSummary = [
      emailConfirmation.status === "sent" ? "email de confirmation envoye" : "",
      whatsappConfirmation.status === "sent" ? "WhatsApp de confirmation envoye" : ""
    ].filter(Boolean);

    res.status(existing ? 200 : 201).json({
      ok: true,
      created: !existing,
      client,
      app: {
        slug: app.slug,
        name: app.appName
      },
      confirmations: {
        email: emailConfirmation,
        whatsapp: whatsappConfirmation
      },
      internalNotifications: {
        email: internalEmailNotification,
        whatsapp: internalWhatsAppNotification
      },
      message: confirmationSummary.length > 0
        ? `Demande enregistree dans le CRM, ${confirmationSummary.join(" et ")}.`
        : "Demande enregistree dans le CRM."
    });
  } catch (error) {
    next(error);
  }
});

marketRouter.post("/apps", async (req, res) => {
  const sourceProjectId = String(req.body.sourceProjectId ?? "").trim() || undefined;
  const appName = String(req.body.appName ?? "").trim();
  const category = parseCategory(req.body.category);
  const tagline = String(req.body.tagline ?? "").trim();
  const shortDescription = String(req.body.shortDescription ?? "").trim();
  const fullDescription = String(req.body.fullDescription ?? "").trim();
  const targetClient = String(req.body.targetClient ?? "").trim();
  const marketScope = String(req.body.marketScope ?? "").trim();
  const priceFrom = Number(req.body.priceFrom ?? 0);
  const currency = parseCurrency(req.body.currency) ?? "XOF";
  const licenseType = parseLicenseType(req.body.licenseType);
  const licenseName = String(req.body.licenseName ?? "").trim();
  const licenseSummary = String(req.body.licenseSummary ?? "").trim();
  const supportWindowDays = Number(req.body.supportWindowDays ?? 30);
  const demoUrl = String(req.body.demoUrl ?? "").trim();
  const adminDemoUrl = String(req.body.adminDemoUrl ?? "").trim() || undefined;
  const demoLogin = String(req.body.demoLogin ?? "").trim() || undefined;
  const demoPassword = String(req.body.demoPassword ?? "").trim() || undefined;
  const thumbnailUrl = String(req.body.thumbnailUrl ?? "").trim() || undefined;
  const videoUrl = String(req.body.videoUrl ?? "").trim() || undefined;
  const downloadUrl = String(req.body.downloadUrl ?? "").trim() || undefined;
  const galleryUrls = toStringArray(req.body.galleryUrls);
  const thumbnailAssetDataUrl = String(req.body.thumbnailAssetDataUrl ?? "").trim() || undefined;
  const videoAssetDataUrl = String(req.body.videoAssetDataUrl ?? "").trim() || undefined;
  const downloadAssetDataUrl = String(req.body.downloadAssetDataUrl ?? "").trim() || undefined;
  const downloadAssetFilename = String(req.body.downloadAssetFilename ?? "").trim() || undefined;
  const galleryAssetDataUrls = Array.isArray(req.body.galleryAssetDataUrls)
    ? req.body.galleryAssetDataUrls.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const features = toStringArray(req.body.features);
  const deliverables = toStringArray(req.body.deliverables);
  const techStack = toStringArray(req.body.techStack);
  const tags = toStringArray(req.body.tags);
  const featured = Boolean(req.body.featured);
  const status = parseStatus(req.body.status) ?? "draft";

  const sourceProject = sourceProjectId ? finishedProjects.find((item) => item.id === sourceProjectId) : undefined;
  const finalCategory = category ?? sourceProject?.category ?? null;

  if (!appName || !finalCategory || !tagline || !shortDescription || !fullDescription || !targetClient || !marketScope || !demoUrl || !licenseType || !licenseName || !licenseSummary) {
    res.status(400).json({ error: "Nom, catégorie, tagline, description, client cible, marché, licence et URL demo sont obligatoires." });
    return;
  }

  if (!Number.isFinite(priceFrom) || priceFrom < 0 || !Number.isFinite(supportWindowDays) || supportWindowDays < 0) {
    res.status(400).json({ error: "Prix de départ invalide." });
    return;
  }

  const apps = await readApps();
  const baseSlug = slugify(String(req.body.slug ?? "").trim() || appName);
  if (!baseSlug) {
    res.status(400).json({ error: "Slug invalide." });
    return;
  }

  const slug = apps.some((item) => item.slug === baseSlug) ? `${baseSlug}-${randomUUID().slice(0, 6)}` : baseSlug;
  const now = new Date().toISOString();
  const storedThumbnailUrl = thumbnailAssetDataUrl
    ? await storeMarketplaceAsset({ dataUrl: thumbnailAssetDataUrl, prefix: `${slug}-cover` })
    : thumbnailUrl;
  const storedVideoUrl = videoAssetDataUrl
    ? await storeMarketplaceAsset({ dataUrl: videoAssetDataUrl, prefix: `${slug}-video` })
    : videoUrl;
  const storedDownloadUrl = downloadAssetDataUrl
    ? await storeMarketplaceAsset({
        dataUrl: downloadAssetDataUrl,
        prefix: `${slug}-package`,
        filenameHint: downloadAssetFilename
      })
    : downloadUrl;
  const storedGalleryUrls = [
    ...galleryUrls,
    ...(await Promise.all(
      galleryAssetDataUrls.map((dataUrl: string, index: number) =>
        storeMarketplaceAsset({
          dataUrl,
          prefix: `${slug}-gallery-${index + 1}`
        })
      )
    ))
  ];

  const app: MarketplaceApp = {
    id: randomUUID(),
    sourceProjectId,
    sourceProjectName: sourceProject?.name,
    appName,
    slug,
    category: finalCategory,
    tagline,
    shortDescription,
    fullDescription,
    targetClient,
    marketScope,
    priceFrom,
    currency,
    licenseType,
    licenseName,
    licenseSummary,
    supportWindowDays,
    demoUrl,
    adminDemoUrl,
    demoLogin,
    demoPassword,
    thumbnailUrl: storedThumbnailUrl,
    videoUrl: storedVideoUrl,
    downloadUrl: storedDownloadUrl,
    galleryUrls: storedGalleryUrls,
    features,
    deliverables: deliverables.length > 0 ? deliverables : sourceProject?.deliverables ?? [],
    techStack,
    tags,
    featured,
    status,
    createdAt: now,
    updatedAt: now
  };

  await writeApps([app, ...apps].slice(0, 400));

  res.status(201).json({
    item: app,
    message: status === "published" ? "Application publiée dans le marketplace." : "Application enregistrée."
  });
});

marketRouter.put("/apps/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const apps = await readApps();
  const index = apps.findIndex((item) => item.id === id);

  if (index < 0) {
    res.status(404).json({ error: "Application introuvable." });
    return;
  }

  const current = apps[index];
  if (!current) {
    res.status(404).json({ error: "Application introuvable." });
    return;
  }

  const sourceProjectId = String(req.body.sourceProjectId ?? "").trim() || undefined;
  const appName = String(req.body.appName ?? "").trim();
  const category = parseCategory(req.body.category) ?? current.category;
  const tagline = String(req.body.tagline ?? "").trim();
  const shortDescription = String(req.body.shortDescription ?? "").trim();
  const fullDescription = String(req.body.fullDescription ?? "").trim();
  const targetClient = String(req.body.targetClient ?? "").trim();
  const marketScope = String(req.body.marketScope ?? "").trim();
  const priceFrom = Number(req.body.priceFrom ?? 0);
  const currency = parseCurrency(req.body.currency) ?? current.currency;
  const licenseType = parseLicenseType(req.body.licenseType) ?? current.licenseType;
  const licenseName = String(req.body.licenseName ?? "").trim();
  const licenseSummary = String(req.body.licenseSummary ?? "").trim();
  const supportWindowDays = Number(req.body.supportWindowDays ?? current.supportWindowDays);
  const demoUrl = String(req.body.demoUrl ?? "").trim();
  const adminDemoUrl = String(req.body.adminDemoUrl ?? "").trim() || undefined;
  const demoLogin = String(req.body.demoLogin ?? "").trim() || undefined;
  const demoPassword = String(req.body.demoPassword ?? "").trim() || undefined;
  const thumbnailUrl = String(req.body.thumbnailUrl ?? "").trim() || undefined;
  const videoUrl = String(req.body.videoUrl ?? "").trim() || undefined;
  const downloadUrl = String(req.body.downloadUrl ?? "").trim() || undefined;
  const galleryUrls = toStringArray(req.body.galleryUrls);
  const thumbnailAssetDataUrl = String(req.body.thumbnailAssetDataUrl ?? "").trim() || undefined;
  const videoAssetDataUrl = String(req.body.videoAssetDataUrl ?? "").trim() || undefined;
  const downloadAssetDataUrl = String(req.body.downloadAssetDataUrl ?? "").trim() || undefined;
  const downloadAssetFilename = String(req.body.downloadAssetFilename ?? "").trim() || undefined;
  const galleryAssetDataUrls = Array.isArray(req.body.galleryAssetDataUrls)
    ? req.body.galleryAssetDataUrls.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const features = toStringArray(req.body.features);
  const deliverables = toStringArray(req.body.deliverables);
  const techStack = toStringArray(req.body.techStack);
  const tags = toStringArray(req.body.tags);
  const featured = Boolean(req.body.featured);
  const status = parseStatus(req.body.status) ?? current.status;

  if (!appName || !tagline || !shortDescription || !fullDescription || !targetClient || !marketScope || !demoUrl || !licenseName || !licenseSummary) {
    res.status(400).json({ error: "Nom, tagline, description, client cible, marché, licence et URL demo sont obligatoires." });
    return;
  }

  if (!Number.isFinite(priceFrom) || priceFrom < 0 || !Number.isFinite(supportWindowDays) || supportWindowDays < 0) {
    res.status(400).json({ error: "Prix de départ invalide." });
    return;
  }

  const sourceProject = sourceProjectId ? finishedProjects.find((item) => item.id === sourceProjectId) : undefined;
  const storedThumbnailUrl = thumbnailAssetDataUrl
    ? await storeMarketplaceAsset({ dataUrl: thumbnailAssetDataUrl, prefix: `${current.slug}-cover` })
    : thumbnailUrl;
  const storedVideoUrl = videoAssetDataUrl
    ? await storeMarketplaceAsset({ dataUrl: videoAssetDataUrl, prefix: `${current.slug}-video` })
    : videoUrl;
  const storedDownloadUrl = downloadAssetDataUrl
    ? await storeMarketplaceAsset({
        dataUrl: downloadAssetDataUrl,
        prefix: `${current.slug}-package`,
        filenameHint: downloadAssetFilename
      })
    : downloadUrl;
  const storedGalleryUrls = [
    ...galleryUrls,
    ...(await Promise.all(
      galleryAssetDataUrls.map((dataUrl: string, galleryIndex: number) =>
        storeMarketplaceAsset({
          dataUrl,
          prefix: `${current.slug}-gallery-${galleryIndex + 1}`
        })
      )
    ))
  ];

  const updated: MarketplaceApp = {
    ...current,
    sourceProjectId,
    sourceProjectName: sourceProject?.name ?? current.sourceProjectName,
    appName,
    category,
    tagline,
    shortDescription,
    fullDescription,
    targetClient,
    marketScope,
    priceFrom,
    currency,
    licenseType,
    licenseName,
    licenseSummary,
    supportWindowDays,
    demoUrl,
    adminDemoUrl,
    demoLogin,
    demoPassword,
    thumbnailUrl: storedThumbnailUrl,
    videoUrl: storedVideoUrl,
    downloadUrl: storedDownloadUrl,
    galleryUrls: storedGalleryUrls,
    features,
    deliverables,
    techStack,
    tags,
    featured,
    status,
    updatedAt: new Date().toISOString()
  };

  const nextItems = [...apps];
  nextItems[index] = updated;
  await writeApps(nextItems);

  res.json({
    item: updated,
    message: "Application mise à jour."
  });
});

marketRouter.post("/apps/:id/duplicate", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const apps = await readApps();
  const current = apps.find((item) => item.id === id);

  if (!current) {
    res.status(404).json({ error: "Application introuvable." });
    return;
  }

  const now = new Date().toISOString();
  const duplicateName = `${current.appName} Copy`;
  const baseSlug = slugify(`${current.slug}-copy`);
  const slug = apps.some((item) => item.slug === baseSlug) ? `${baseSlug}-${randomUUID().slice(0, 6)}` : baseSlug;

  const duplicated: MarketplaceApp = {
    ...current,
    id: randomUUID(),
    appName: duplicateName,
    slug,
    featured: false,
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  await writeApps([duplicated, ...apps].slice(0, 500));

  res.status(201).json({
    item: duplicated,
    message: "Application dupliquée en brouillon."
  });
});

marketRouter.patch("/apps/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const apps = await readApps();
  const index = apps.findIndex((item) => item.id === id);

  if (index < 0) {
    res.status(404).json({ error: "Application introuvable." });
    return;
  }

  const current = apps[index];
  if (!current) {
    res.status(404).json({ error: "Application introuvable." });
    return;
  }

  const nextStatus = parseStatus(req.body.status) ?? current.status;
  const nextFeatured = typeof req.body.featured === "boolean" ? req.body.featured : current.featured;

  const updated: MarketplaceApp = {
    ...current,
    status: nextStatus,
    featured: nextFeatured,
    updatedAt: new Date().toISOString()
  };

  const nextItems = [...apps];
  nextItems[index] = updated;
  await writeApps(nextItems);

  res.json({
    item: updated,
    message:
      nextStatus === "published"
        ? "Application publiée."
        : nextStatus === "private"
          ? "Application passée en privé."
          : nextStatus === "archived"
            ? "Application archivée."
            : "Application remise en brouillon."
  });
});
