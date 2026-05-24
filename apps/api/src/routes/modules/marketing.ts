import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { prisma } from "../../db/prisma.js";

export const marketingRouter = Router();

const creativeLibraryKey = "marketing_creative_library";
const abTestsKey = "marketing_ab_tests";
const campaignPlansKey = "marketing_campaign_plans";
const marketingAssetsDir = path.resolve(process.env.UPLOADS_DIR ?? "/data/uploads", "marketing", "creatives");

type CreativePlatform = "meta" | "google";
type CreativeMediaType = "image" | "video";

type CreativeLibraryItem = {
  id: string;
  platform: CreativePlatform;
  mediaType: CreativeMediaType;
  name: string;
  campaign: string;
  format: string;
  primaryText: string;
  cta: string;
  prompt: string;
  script?: string;
  voiceover?: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  score: number;
  verdict: "ready" | "optimize" | "revise";
  recommendations: string[];
  createdAt: string;
};

type MarketingAbTestVariant = {
  creativeId: string;
  name: string;
  mediaType: CreativeMediaType;
  format: string;
  fileUrl: string;
  score: number;
  verdict: CreativeLibraryItem["verdict"];
  strengths: string[];
};

type MarketingAbTest = {
  id: string;
  platform: CreativePlatform;
  name: string;
  campaign: string;
  budgetDaily: number;
  status: "draft" | "recommended";
  variants: MarketingAbTestVariant[];
  winnerCreativeId: string;
  winnerName: string;
  winnerScore: number;
  recommendation: string;
  nextVariantIdea: string;
  createdAt: string;
};

type MarketingCampaignStatus = "draft" | "testing" | "active" | "paused" | "completed";

type MarketingCampaignPlan = {
  id: string;
  platform: CreativePlatform;
  name: string;
  objective: string;
  status: MarketingCampaignStatus;
  budgetDaily: number;
  startDate: string;
  channel: string;
  notes: string;
  linkedCreativeIds: string[];
  linkedTestId?: string;
  createdAt: string;
  updatedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseLibraryItem(value: unknown): CreativeLibraryItem | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const platform = value.platform === "meta" || value.platform === "google" ? value.platform : null;
  const mediaType = value.mediaType === "image" || value.mediaType === "video" ? value.mediaType : null;
  const name = typeof value.name === "string" ? value.name : "";
  const campaign = typeof value.campaign === "string" ? value.campaign : "";
  const format = typeof value.format === "string" ? value.format : "";
  const primaryText = typeof value.primaryText === "string" ? value.primaryText : "";
  const cta = typeof value.cta === "string" ? value.cta : "";
  const prompt = typeof value.prompt === "string" ? value.prompt : "";
  const script = typeof value.script === "string" ? value.script : undefined;
  const voiceover = typeof value.voiceover === "string" ? value.voiceover : undefined;
  const fileUrl = typeof value.fileUrl === "string" ? value.fileUrl : "";
  const mimeType = typeof value.mimeType === "string" ? value.mimeType : "application/octet-stream";
  const fileSize = typeof value.fileSize === "number" ? value.fileSize : 0;
  const score = typeof value.score === "number" ? value.score : 0;
  const verdict = value.verdict === "ready" || value.verdict === "optimize" || value.verdict === "revise" ? value.verdict : "revise";
  const recommendations = Array.isArray(value.recommendations) ? value.recommendations.filter((item): item is string => typeof item === "string") : [];
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();

  if (!id || !platform || !mediaType || !name || !campaign || !format || !fileUrl) {
    return null;
  }

  return {
    id,
    platform,
    mediaType,
    name,
    campaign,
    format,
    primaryText,
    cta,
    prompt,
    script,
    voiceover,
    fileUrl,
    mimeType,
    fileSize,
    score,
    verdict,
    recommendations,
    createdAt
  };
}

async function readCreativeLibrary() {
  const stored = await prisma.appSetting.findUnique({ where: { key: creativeLibraryKey } }).catch(() => null);
  const raw = stored?.value;

  if (!Array.isArray(raw)) {
    return [] as CreativeLibraryItem[];
  }

  return raw.map(parseLibraryItem).filter((item): item is CreativeLibraryItem => Boolean(item));
}

async function writeCreativeLibrary(items: CreativeLibraryItem[]) {
  await prisma.appSetting.upsert({
    where: { key: creativeLibraryKey },
    update: { value: items as never },
    create: { key: creativeLibraryKey, value: items as never }
  });
}

function parseAbTestVariant(value: unknown): MarketingAbTestVariant | null {
  if (!isObject(value)) return null;

  const creativeId = typeof value.creativeId === "string" ? value.creativeId : "";
  const name = typeof value.name === "string" ? value.name : "";
  const mediaType = value.mediaType === "image" || value.mediaType === "video" ? value.mediaType : null;
  const format = typeof value.format === "string" ? value.format : "";
  const fileUrl = typeof value.fileUrl === "string" ? value.fileUrl : "";
  const score = typeof value.score === "number" ? value.score : 0;
  const verdict = value.verdict === "ready" || value.verdict === "optimize" || value.verdict === "revise" ? value.verdict : null;
  const strengths = Array.isArray(value.strengths) ? value.strengths.filter((item): item is string => typeof item === "string") : [];

  if (!creativeId || !name || !mediaType || !format || !fileUrl || !verdict) {
    return null;
  }

  return { creativeId, name, mediaType, format, fileUrl, score, verdict, strengths };
}

function parseAbTest(value: unknown): MarketingAbTest | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const platform = value.platform === "meta" || value.platform === "google" ? value.platform : null;
  const name = typeof value.name === "string" ? value.name : "";
  const campaign = typeof value.campaign === "string" ? value.campaign : "";
  const budgetDaily = typeof value.budgetDaily === "number" ? value.budgetDaily : 0;
  const status = value.status === "draft" || value.status === "recommended" ? value.status : null;
  const winnerCreativeId = typeof value.winnerCreativeId === "string" ? value.winnerCreativeId : "";
  const winnerName = typeof value.winnerName === "string" ? value.winnerName : "";
  const winnerScore = typeof value.winnerScore === "number" ? value.winnerScore : 0;
  const recommendation = typeof value.recommendation === "string" ? value.recommendation : "";
  const nextVariantIdea = typeof value.nextVariantIdea === "string" ? value.nextVariantIdea : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const variants = Array.isArray(value.variants) ? value.variants.map(parseAbTestVariant).filter((item): item is MarketingAbTestVariant => Boolean(item)) : [];

  if (!id || !platform || !name || !campaign || !status || !winnerCreativeId || !winnerName || variants.length < 2) {
    return null;
  }

  return {
    id,
    platform,
    name,
    campaign,
    budgetDaily,
    status,
    variants,
    winnerCreativeId,
    winnerName,
    winnerScore,
    recommendation,
    nextVariantIdea,
    createdAt
  };
}

async function readAbTests() {
  const stored = await prisma.appSetting.findUnique({ where: { key: abTestsKey } }).catch(() => null);
  const raw = stored?.value;

  if (!Array.isArray(raw)) {
    return [] as MarketingAbTest[];
  }

  return raw.map(parseAbTest).filter((item): item is MarketingAbTest => Boolean(item));
}

async function writeAbTests(items: MarketingAbTest[]) {
  await prisma.appSetting.upsert({
    where: { key: abTestsKey },
    update: { value: items as never },
    create: { key: abTestsKey, value: items as never }
  });
}

function parseCampaignStatus(value: unknown): MarketingCampaignStatus | null {
  return value === "draft" || value === "testing" || value === "active" || value === "paused" || value === "completed"
    ? value
    : null;
}

function parseCampaignPlan(value: unknown): MarketingCampaignPlan | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const platform = value.platform === "meta" || value.platform === "google" ? value.platform : null;
  const name = typeof value.name === "string" ? value.name : "";
  const objective = typeof value.objective === "string" ? value.objective : "";
  const status = parseCampaignStatus(value.status);
  const budgetDaily = typeof value.budgetDaily === "number" ? value.budgetDaily : 0;
  const startDate = typeof value.startDate === "string" ? value.startDate : "";
  const channel = typeof value.channel === "string" ? value.channel : "";
  const notes = typeof value.notes === "string" ? value.notes : "";
  const linkedCreativeIds = Array.isArray(value.linkedCreativeIds)
    ? value.linkedCreativeIds.filter((item): item is string => typeof item === "string")
    : [];
  const linkedTestId = typeof value.linkedTestId === "string" ? value.linkedTestId : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;

  if (!id || !platform || !name || !objective || !status || !startDate || !channel) {
    return null;
  }

  return {
    id,
    platform,
    name,
    objective,
    status,
    budgetDaily,
    startDate,
    channel,
    notes,
    linkedCreativeIds,
    linkedTestId,
    createdAt,
    updatedAt
  };
}

async function readCampaignPlans() {
  const stored = await prisma.appSetting.findUnique({ where: { key: campaignPlansKey } }).catch(() => null);
  const raw = stored?.value;

  if (!Array.isArray(raw)) {
    return [] as MarketingCampaignPlan[];
  }

  return raw.map(parseCampaignPlan).filter((item): item is MarketingCampaignPlan => Boolean(item));
}

async function writeCampaignPlans(items: MarketingCampaignPlan[]) {
  await prisma.appSetting.upsert({
    where: { key: campaignPlansKey },
    update: { value: items as never },
    create: { key: campaignPlansKey, value: items as never }
  });
}

function extractDataUrlPayload(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  const mimeType = match?.[1];
  const base64Payload = match?.[2];

  if (!mimeType || !base64Payload) {
    throw new Error("Format de fichier invalide");
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
  return "mp4";
}

async function storeCreativeAsset(options: {
  dataUrl: string;
  platform: CreativePlatform;
  mediaType: CreativeMediaType;
}) {
  const { mimeType, bytes } = extractDataUrlPayload(options.dataUrl);
  const extension = extensionFromMime(mimeType);
  const filename = `${options.platform}-${options.mediaType}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;

  await fs.mkdir(marketingAssetsDir, { recursive: true });
  await fs.writeFile(path.join(marketingAssetsDir, filename), bytes);

  return {
    fileUrl: `/uploads/marketing/creatives/${filename}`,
    mimeType,
    fileSize: bytes.byteLength
  };
}

function scoreCreative(input: {
  platform: CreativePlatform;
  mediaType: CreativeMediaType;
  format: string;
  primaryText: string;
  cta: string;
  prompt: string;
  script?: string;
  voiceover?: string;
}) {
  let score = 35;
  const recommendations: string[] = [];

  if (input.primaryText.trim().length >= 24) {
    score += 16;
  } else {
    recommendations.push("Ajoute un message principal plus clair avec bénéfice client.");
  }

  if (input.primaryText.trim().length > 220) {
    score -= 10;
    recommendations.push("Raccourcis le texte principal pour garder une lecture rapide.");
  }

  if (input.cta.trim().length >= 6) {
    score += 12;
  } else {
    recommendations.push("Ajoute un appel à l'action visible.");
  }

  if (input.prompt.trim().length >= 20) {
    score += 12;
  } else {
    recommendations.push("Ajoute un prompt plus précis pour améliorer la créative.");
  }

  if (input.mediaType === "video") {
    if (input.script?.trim().length) {
      score += 12;
    } else {
      recommendations.push("Ajoute un script vidéo pour mieux cadrer le message.");
    }

    if (input.voiceover?.trim().length) {
      score += 6;
    } else {
      recommendations.push("Ajoute un brief voix off pour accélérer la production.");
    }

    if (/9:16|reel|story/i.test(input.format)) {
      score += 8;
    } else {
      recommendations.push("Teste un format vertical 9:16 pour Meta.");
    }
  }

  if (input.mediaType === "image") {
    if (/1:1|display|performance max|landing/i.test(input.format)) {
      score += 8;
    } else {
      recommendations.push("Aligne le format image avec l'usage réel de la campagne.");
    }
  }

  if (input.platform === "meta" && !/message|whatsapp|devis/i.test(input.cta)) {
    recommendations.push("Pour Meta, teste un CTA orienté conversation ou WhatsApp.");
  }

  if (input.platform === "google" && !/devis|appel|site|landing/i.test(input.cta + " " + input.primaryText)) {
    recommendations.push("Pour Google, renforce l'intention d'achat avec devis, appel ou landing page.");
  }

  score = Math.max(20, Math.min(98, score));

  if (recommendations.length === 0) {
    recommendations.push("Créative propre pour un test A/B immédiat.");
  }

  const verdict: CreativeLibraryItem["verdict"] = score >= 80 ? "ready" : score >= 60 ? "optimize" : "revise";
  return { score, verdict, recommendations };
}

function buildVariantStrengths(creative: CreativeLibraryItem) {
  const strengths = [
    `Score IA ${creative.score}/100`,
    creative.format,
    creative.verdict === "ready" ? "Prête à tester" : creative.verdict === "optimize" ? "À optimiser" : "À retravailler"
  ];

  if (creative.mediaType === "video") {
    strengths.push("Format vidéo pour capter l'attention");
  }

  if (/whatsapp|message/i.test(`${creative.cta} ${creative.primaryText}`)) {
    strengths.push("CTA orienté conversation");
  }

  if (/devis|appel|landing|site/i.test(`${creative.cta} ${creative.primaryText}`)) {
    strengths.push("CTA orienté conversion");
  }

  return strengths.slice(0, 4);
}

function buildAbTestRecommendation(platform: CreativePlatform, winner: CreativeLibraryItem, runnerUp: CreativeLibraryItem | undefined, budgetDaily: number) {
  const platformLabel = platform === "meta" ? "Meta" : "Google";
  const budgetText = `${budgetDaily.toLocaleString("fr-FR")} FCFA/jour`;
  const gap = runnerUp ? winner.score - runnerUp.score : winner.score;
  const angle =
    platform === "meta"
      ? "garder un hook très direct dans les 3 premières secondes"
      : "renforcer encore l'intention d'achat sur la landing page";

  const recommendation =
    gap >= 8
      ? `${winner.name} est le gagnant recommandé pour ${platformLabel}. Lance-le avec un budget test de ${budgetText} et garde ${angle}.`
      : `${winner.name} sort légèrement devant. Lance-le en parallèle avec une petite variation de texte pour confirmer le signal sur ${platformLabel}.`;

  const nextVariantIdea =
    platform === "meta"
      ? `Crée une variante de ${winner.name} avec une accroche plus directe, sous-titres plus gros et CTA WhatsApp visible.`
      : `Crée une variante de ${winner.name} avec un titre plus orienté devis rapide et une promesse plus concrète.`;

  return { recommendation, nextVariantIdea };
}

const marketingIntegrations = {
  meta: {
    appId: "",
    appSecretConfigured: false,
    accessTokenConfigured: false,
    businessManagerId: "",
    adAccountId: "",
    pageId: "",
    instagramAccountId: "",
    pixelId: "",
    webhookVerifyTokenConfigured: false,
    permissions: [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_manage_ads",
      "pages_read_engagement",
      "instagram_basic",
      "leads_retrieval"
    ],
    status: "needs_configuration"
  },
  googleAds: {
    developerTokenConfigured: false,
    clientId: "",
    clientSecretConfigured: false,
    refreshTokenConfigured: false,
    managerCustomerId: "",
    customerId: "",
    conversionTagId: "",
    ga4MeasurementId: "",
    oauthRedirectUri: "http://localhost:4000/api/marketing/google/oauth/callback",
    status: "needs_oauth"
  },
  tracking: {
    defaultUtmSource: "oumar-business",
    defaultUtmMedium: "paid_social",
    trackingDomain: "https://app.oumar-business.com",
    conversionWebhookPath: "/api/marketing/conversions/webhook",
    conversionEvents: [
      "lead",
      "quote_requested",
      "invoice_sent",
      "payment_received",
      "client_portal_signup",
      "project_approved"
    ]
  }
};

const falCreativeConfig = {
  provider: "fal.ai",
  apiKeyConfigured: Boolean(process.env.FAL_KEY),
  baseUrl: "https://queue.fal.run",
  defaultModels: {
    image: "fal-ai/flux-pro",
    imageEdit: "fal-ai/flux-kontext-pro",
    video: "fal-ai/kling-video",
    voice: "fal-ai/minimax-speech"
  },
  monthlyBudgetUsd: 100,
  requireApprovalAboveUsd: 5,
  storage: "s3/minio"
};

marketingRouter.get("/ad-accounts", (_req, res) => {
  res.json({
    accounts: [
      {
        id: "meta",
        name: "Meta Ads",
        channels: ["facebook", "instagram", "messenger", "whatsapp"],
        status: "connected",
        monthlySpend: 420000,
        currency: "XOF"
      },
      {
        id: "google",
        name: "Google Ads",
        channels: ["search", "display", "youtube", "performance-max"],
        status: "needs_configuration",
        monthlySpend: 180000,
        currency: "XOF"
      }
    ]
  });
});

marketingRouter.get("/integrations", (_req, res) => {
  res.json({
    ...marketingIntegrations,
    creative: {
      fal: falCreativeConfig
    }
  });
});

marketingRouter.put("/integrations", (req, res) => {
  res.json({
    ok: true,
    saved: true,
    integrations: req.body
  });
});

marketingRouter.post("/integrations/test", (req, res) => {
  const provider = String(req.body.provider ?? "all");

  res.json({
    provider,
    checks: [
      {
        name: "Meta access token",
        ok: false,
        message: "Access token non configure"
      },
      {
        name: "Google Ads OAuth",
        ok: false,
        message: "Refresh token non configure"
      },
      {
        name: "Conversion webhook",
        ok: true,
        message: "Endpoint local pret"
      }
    ]
  });
});

marketingRouter.post("/conversions/webhook", (req, res) => {
  res.json({
    ok: true,
    received: true,
    event: req.body.event ?? "unknown"
  });
});

marketingRouter.get("/google/oauth/callback", (req, res) => {
  res.json({
    ok: true,
    provider: "google_ads",
    codeReceived: Boolean(req.query.code),
    message: "OAuth callback pret a echanger le code contre un refresh token."
  });
});

marketingRouter.post("/campaigns/generate", (req, res) => {
  const offer = String(req.body.offer ?? "Creation de site web professionnel");
  const audience = String(req.body.audience ?? "PME Cote d'Ivoire");

  res.json({
    campaign: {
      name: `${offer} - ${audience}`,
      channels: ["meta", "google"],
      objective: "leads",
      suggestedBudget: {
        daily: 25000,
        currency: "XOF"
      },
      adCopies: [
        {
          channel: "meta",
          headline: "Transformez vos demandes WhatsApp en clients",
          body: "Oumar Business cree votre site et automatise vos reponses avec l'IA."
        },
        {
          channel: "google",
          headline: "Agence digitale en Cote d'Ivoire",
          body: "Sites web, marketing digital et agents IA pour PME ambitieuses."
        }
      ]
    }
  });
});

marketingRouter.get("/creative/fal", (_req, res) => {
  res.json(falCreativeConfig);
});

marketingRouter.get("/creative-library", async (req, res) => {
  const platform = req.query.platform === "meta" || req.query.platform === "google" ? req.query.platform : null;
  const mediaType = req.query.mediaType === "image" || req.query.mediaType === "video" ? req.query.mediaType : null;
  const items = await readCreativeLibrary();

  const filtered = items.filter((item) => {
    if (platform && item.platform !== platform) return false;
    if (mediaType && item.mediaType !== mediaType) return false;
    return true;
  });

  res.json({
    items: filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  });
});

marketingRouter.post("/creative-library", async (req, res) => {
  const platform = req.body.platform === "meta" || req.body.platform === "google" ? req.body.platform : null;
  const mediaType = req.body.mediaType === "image" || req.body.mediaType === "video" ? req.body.mediaType : null;
  const name = String(req.body.name ?? "").trim();
  const campaign = String(req.body.campaign ?? "").trim();
  const format = String(req.body.format ?? "").trim();
  const primaryText = String(req.body.primaryText ?? "").trim();
  const cta = String(req.body.cta ?? "").trim();
  const prompt = String(req.body.prompt ?? "").trim();
  const script = String(req.body.script ?? "").trim();
  const voiceover = String(req.body.voiceover ?? "").trim();
  const assetDataUrl = String(req.body.assetDataUrl ?? "").trim();

  if (!platform || !mediaType) {
    res.status(400).json({ error: "Plateforme ou type de media invalide." });
    return;
  }

  if (!name || !campaign || !format || !assetDataUrl) {
    res.status(400).json({ error: "Nom, campagne, format et fichier sont obligatoires." });
    return;
  }

  try {
    const storedAsset = await storeCreativeAsset({
      dataUrl: assetDataUrl,
      platform,
      mediaType
    });

    const scoring = scoreCreative({
      platform,
      mediaType,
      format,
      primaryText,
      cta,
      prompt,
      script,
      voiceover
    });

    const item: CreativeLibraryItem = {
      id: randomUUID(),
      platform,
      mediaType,
      name,
      campaign,
      format,
      primaryText,
      cta,
      prompt,
      script: script || undefined,
      voiceover: voiceover || undefined,
      fileUrl: storedAsset.fileUrl,
      mimeType: storedAsset.mimeType,
      fileSize: storedAsset.fileSize,
      score: scoring.score,
      verdict: scoring.verdict,
      recommendations: scoring.recommendations,
      createdAt: new Date().toISOString()
    };

    const library = await readCreativeLibrary();
    const nextLibrary = [item, ...library].slice(0, 200);
    await writeCreativeLibrary(nextLibrary);

    res.status(201).json({
      item,
      message: "Créative enregistrée dans la bibliothèque."
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Impossible d'enregistrer la créative."
    });
  }
});

marketingRouter.get("/ab-tests", async (req, res) => {
  const platform = req.query.platform === "meta" || req.query.platform === "google" ? req.query.platform : null;
  const tests = await readAbTests();

  const filtered = tests.filter((test) => (platform ? test.platform === platform : true));
  res.json({
    items: filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  });
});

marketingRouter.post("/ab-tests", async (req, res) => {
  const platform = req.body.platform === "meta" || req.body.platform === "google" ? req.body.platform : null;
  const name = String(req.body.name ?? "").trim();
  const campaign = String(req.body.campaign ?? "").trim();
  const budgetDaily = Number(req.body.budgetDaily ?? 0);
  const rawCreativeIds: unknown[] = Array.isArray(req.body.creativeIds) ? req.body.creativeIds : [];
  const creativeIds = rawCreativeIds.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0);

  if (!platform || !name || !campaign || !Number.isFinite(budgetDaily) || budgetDaily <= 0) {
    res.status(400).json({ error: "Plateforme, nom, campagne et budget test sont obligatoires." });
    return;
  }

  if (creativeIds.length < 2 || creativeIds.length > 4) {
    res.status(400).json({ error: "Choisis entre 2 et 4 créatives pour le test A/B." });
    return;
  }

  const library = await readCreativeLibrary();
  const selectedCreatives = creativeIds
    .map((creativeId: string) => library.find((item: CreativeLibraryItem) => item.id === creativeId))
    .filter((item: CreativeLibraryItem | undefined): item is CreativeLibraryItem => Boolean(item));

  if (selectedCreatives.length !== creativeIds.length) {
    res.status(400).json({ error: "Une ou plusieurs créatives sont introuvables." });
    return;
  }

  if (selectedCreatives.some((creative: CreativeLibraryItem) => creative.platform !== platform)) {
    res.status(400).json({ error: "Toutes les créatives doivent appartenir à la même plateforme." });
    return;
  }

  const sortedCreatives = [...selectedCreatives].sort((left, right) => right.score - left.score);
  const winner = sortedCreatives[0];
  const runnerUp = sortedCreatives[1];

  if (!winner || !runnerUp) {
    res.status(400).json({ error: "Le test A/B a besoin d'au moins 2 créatives valides." });
    return;
  }

  const recommendation = buildAbTestRecommendation(platform, winner, runnerUp, budgetDaily);

  const test: MarketingAbTest = {
    id: randomUUID(),
    platform,
    name,
    campaign,
    budgetDaily,
    status: "recommended",
    variants: selectedCreatives.map((creative: CreativeLibraryItem) => ({
      creativeId: creative.id,
      name: creative.name,
      mediaType: creative.mediaType,
      format: creative.format,
      fileUrl: creative.fileUrl,
      score: creative.score,
      verdict: creative.verdict,
      strengths: buildVariantStrengths(creative)
    })),
    winnerCreativeId: winner.id,
    winnerName: winner.name,
    winnerScore: winner.score,
    recommendation: recommendation.recommendation,
    nextVariantIdea: recommendation.nextVariantIdea,
    createdAt: new Date().toISOString()
  };

  const tests = await readAbTests();
  const nextTests = [test, ...tests].slice(0, 100);
  await writeAbTests(nextTests);

  res.status(201).json({
    item: test,
    message: "Test A/B créé avec un gagnant recommandé."
  });
});

marketingRouter.get("/campaign-plans", async (req, res) => {
  const platform = req.query.platform === "meta" || req.query.platform === "google" ? req.query.platform : null;
  const items = await readCampaignPlans();

  res.json({
    items: items
      .filter((item) => (platform ? item.platform === platform : true))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  });
});

marketingRouter.post("/campaign-plans", async (req, res) => {
  const platform = req.body.platform === "meta" || req.body.platform === "google" ? req.body.platform : null;
  const name = String(req.body.name ?? "").trim();
  const objective = String(req.body.objective ?? "").trim();
  const status = parseCampaignStatus(req.body.status) ?? "draft";
  const budgetDaily = Number(req.body.budgetDaily ?? 0);
  const startDate = String(req.body.startDate ?? "").trim();
  const channel = String(req.body.channel ?? "").trim();
  const notes = String(req.body.notes ?? "").trim();
  const linkedTestId = String(req.body.linkedTestId ?? "").trim() || undefined;
  const linkedCreativeIds = Array.isArray(req.body.linkedCreativeIds)
    ? req.body.linkedCreativeIds.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (!platform || !name || !objective || !startDate || !channel || !Number.isFinite(budgetDaily) || budgetDaily <= 0) {
    res.status(400).json({ error: "Plateforme, nom, objectif, canal, date de lancement et budget sont obligatoires." });
    return;
  }

  const now = new Date().toISOString();
  const plan: MarketingCampaignPlan = {
    id: randomUUID(),
    platform,
    name,
    objective,
    status,
    budgetDaily,
    startDate,
    channel,
    notes,
    linkedCreativeIds,
    linkedTestId,
    createdAt: now,
    updatedAt: now
  };

  const plans = await readCampaignPlans();
  await writeCampaignPlans([plan, ...plans].slice(0, 200));

  res.status(201).json({
    item: plan,
    message: "Campagne planifiée avec succès."
  });
});

marketingRouter.patch("/campaign-plans/:id", async (req, res) => {
  const planId = String(req.params.id ?? "").trim();
  const nextStatus = parseCampaignStatus(req.body.status);
  const nextStartDate = typeof req.body.startDate === "string" ? req.body.startDate.trim() : undefined;
  const nextBudgetDaily = typeof req.body.budgetDaily === "number" ? req.body.budgetDaily : undefined;
  const nextNotes = typeof req.body.notes === "string" ? req.body.notes.trim() : undefined;

  if (!planId) {
    res.status(400).json({ error: "Identifiant campagne invalide." });
    return;
  }

  const plans = await readCampaignPlans();
  const index = plans.findIndex((plan) => plan.id === planId);

  if (index < 0) {
    res.status(404).json({ error: "Campagne introuvable." });
    return;
  }

  const current = plans[index];
  if (!current) {
    res.status(404).json({ error: "Campagne introuvable." });
    return;
  }

  const updated: MarketingCampaignPlan = {
    ...current,
    status: nextStatus ?? current.status,
    startDate: nextStartDate || current.startDate,
    budgetDaily: nextBudgetDaily && Number.isFinite(nextBudgetDaily) && nextBudgetDaily > 0 ? nextBudgetDaily : current.budgetDaily,
    notes: nextNotes ?? current.notes,
    updatedAt: new Date().toISOString()
  };

  const nextPlans = [...plans];
  nextPlans[index] = updated;
  await writeCampaignPlans(nextPlans);

  res.json({
    item: updated,
    message: "Campagne mise à jour."
  });
});

marketingRouter.post("/creative/estimate", (req, res) => {
  const type = String(req.body.type ?? "image");
  const quantity = Number(req.body.quantity ?? 1);
  const durationSeconds = Number(req.body.durationSeconds ?? 8);

  const unitPrice =
    type === "video" ? 0.07 * durationSeconds : type === "voice" ? 0.03 : 0.06;
  const estimatedUsd = Number((unitPrice * quantity).toFixed(2));

  res.json({
    provider: "fal.ai",
    type,
    quantity,
    estimatedUsd,
    requiresApproval: estimatedUsd >= falCreativeConfig.requireApprovalAboveUsd,
    note: "Estimation locale. En production, interroger /v1/models/pricing avant generation."
  });
});

marketingRouter.post("/creative/generate", (req, res) => {
  if (!falCreativeConfig.apiKeyConfigured && process.env.NODE_ENV === "production") {
    res.status(503).json({
      provider: "fal.ai",
      status: "not_configured",
      message: "FAL_KEY doit etre configure pour generer des creatives en production."
    });
    return;
  }

  const type = String(req.body.type ?? "image");
  const prompt = String(req.body.prompt ?? "Marketing visual for Oumar Business");
  const model =
    type === "video"
      ? falCreativeConfig.defaultModels.video
      : type === "voice"
        ? falCreativeConfig.defaultModels.voice
        : falCreativeConfig.defaultModels.image;

  res.status(202).json({
    provider: "fal.ai",
    status: falCreativeConfig.apiKeyConfigured ? "queued" : "local_preview",
    model,
    prompt,
    jobId: `fal_${Date.now()}`,
    outputPreviewUrl: null,
    message: falCreativeConfig.apiKeyConfigured
      ? "Job pret a etre soumis a fal.ai."
      : "FAL_KEY non configure; generation limitee a la previsualisation locale."
  });
});
