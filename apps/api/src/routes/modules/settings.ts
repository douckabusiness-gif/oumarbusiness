import { Router, type NextFunction, type Response } from "express";
import { EmailEngine, type EmailAccountConfig } from "@oumar/email-engine";
import type { AgentType } from "@oumar/shared";
import { prisma } from "../../db/prisma.js";
import {
  BRANDING_LOGO_CLEANUP_VERSION,
  normalizeAndStoreBrandingLogoFromDataUrl,
  normalizeAndStoreBrandingPwaIconFromDataUrl,
  normalizeExistingBrandingLogoAsset
} from "../../services/brandingLogo.js";
import { decryptSecret, encryptSecret } from "../../services/encryption.js";
import { callProviderChat, providerChatErrorMessage } from "../../services/providerChatClient.js";
import { testSearchProvider } from "../../services/searchIntelligence.js";
import { requireAuthenticatedAdmin } from "./admin-auth.js";

export const settingsRouter = Router();

type JsonObject = Record<string, unknown>;

type AgentConfigPayload = {
  type: AgentType;
  name: string;
  provider: string;
  model: string;
  missionKind: string;
  description: string;
  systemPrompt: string;
  hitlRequired: boolean;
  temperature: number;
  escalationThreshold: number;
  config: JsonObject;
};

type StoredAgentConfig = {
  type: string;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  temperature: number;
  maxTokens: number;
  escalationThreshold: number;
  config: unknown;
  updatedAt: Date;
};

class SettingsRouteError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const missionPresets = {
  sales: {
    missionName: "Agent de Vente",
    missionTab: {
      tone: "Professionnel & Formel",
      pitch:
        "Oumar Business automatise votre acquisition, vos reponses WhatsApp et vos ventes avec des agents IA connectes a votre CRM.",
      conversionObjective: "Lien de paiement (Stripe)",
      channels: ["whatsapp", "email", "crm", "billing"]
    },
    brainTab: {
      bootstrap: "Analyser le besoin, presenter la valeur, lever les objections et proposer l'action suivante.",
      soul: "Professionnel, clair, confiant, jamais forceur.",
      identity: "Commercial digital de Oumar Business specialise marketing, sites web et agents IA.",
      hitl: true
    }
  },
  sourcing: {
    missionName: "Agent de Sourcing",
    missionTab: {
      prospectSource: "LinkedIn Pro",
      searchKeywords: "PME, decideurs, Cote d'Ivoire, Senegal, services locaux",
      qualificationInstructions:
        "Prioriser les entreprises actives qui ont besoin de marketing, site web ou automatisation WhatsApp.",
      marketingEnrollment: "Pipeline CRM Prospect"
    },
    brainTab: {
      bootstrap: "Chercher des prospects selon source, mots-cles et pays, puis appliquer les regles de qualification.",
      soul: "Curieux, precis, non agressif, oriente opportunites business.",
      identity: "Agent de sourcing B2B pour l'agence Oumar Business.",
      hitl: true
    }
  }
} as const;

const defaultAgentConfigs: AgentConfigPayload[] = [
  agentConfig("autonomous", "Agent d'Accueil", "claude", "claude-sonnet-4-20250514", "operations", "Premier contact WhatsApp, Email et portail client.", false),
  agentConfig("prospection", "Agent de Sourcing", "gemini", "gemini-2.5-pro", "sourcing", "Trouve les prospects, les qualifie et les ajoute aux campagnes.", true),
  agentConfig("sales", "Agent de Vente", "openai", "gpt-4.1", "sales", "Convertit les prospects en clients, devis et paiements.", true),
  agentConfig("project", "Agent Projet", "claude", "claude-sonnet-4-20250514", "operations", "Pilote les milestones, retards, validations et livrables.", false),
  agentConfig("web", "Agent Site Web", "gemini", "gemini-2.5-pro", "operations", "Transforme les briefs web en cahiers de charge et taches.", true),
  agentConfig("ai-builder", "Agent Builder IA", "qwen", "qwen-plus", "operations", "Cree des agents IA clients avec prompts, outils et workflows.", true),
  agentConfig("marketing", "Agent Marketing", "kimi-k2", "kimi-k2", "operations", "Cree contenus, campagnes Meta/Google et briefs fal.ai.", true),
  agentConfig("email", "Agent Email", "claude", "claude-sonnet-4-20250514", "operations", "Classe, resume et repond aux emails professionnels.", true),
  agentConfig("whatsapp", "Agent WhatsApp", "groq", "llama-3.3-70b-versatile", "operations", "Gere conversations, relances et qualification WhatsApp.", true),
  agentConfig("billing", "Agent Facturation", "openai", "gpt-4.1", "operations", "Cree factures, relances et instructions de paiement.", true),
  agentConfig("freelance", "Agent Freelance", "glm", "glm-4.5", "operations", "Evalue candidats, suit missions et controle livrables.", true),
  agentConfig("report", "Boss Agent", "claude", "claude-sonnet-4-20250514", "operations", "Compile le rapport quotidien pour Oumar.", false)
];

function agentConfig(
  type: AgentType,
  name: string,
  provider: string,
  model: string,
  missionKind: string,
  description: string,
  hitlRequired: boolean
): AgentConfigPayload {
  const preset = missionKind === "sales" ? missionPresets.sales : missionKind === "sourcing" ? missionPresets.sourcing : null;
  const bootstrap = preset?.brainTab.bootstrap ?? description;
  const soul = preset?.brainTab.soul ?? "Professionnel, clair et oriente resultat.";
  const identity = preset?.brainTab.identity ?? `${name} de Oumar Business.`;

  return {
    type,
    name,
    provider,
    model,
    missionKind,
    description,
    systemPrompt: `${bootstrap}\n\n${soul}\n\n${identity}`,
    hitlRequired,
    temperature: 0.7,
    escalationThreshold: 0.3,
    config: {
      provider,
      model,
      missionKind,
      description,
      missionTab: preset?.missionTab ?? {
        objective: description,
        channels: ["whatsapp", "email", "crm", "marketing"]
      },
      tools: {
        searchIntelligence: ["autonomous", "prospection", "sales", "web", "ai-builder", "marketing", "report"].includes(type),
        providers: ["serper", "tavily"]
      },
      brainTab: {
        bootstrap,
        soul,
        identity,
        hitl: hitlRequired
      }
    }
  };
}

function asConfigObject(config: unknown): JsonObject {
  return config && typeof config === "object" && !Array.isArray(config) ? (config as JsonObject) : {};
}

function serializeAgentConfig(agent: {
  type: string;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  temperature: number;
  maxTokens: number;
  escalationThreshold: number;
  config: unknown;
  updatedAt: Date;
}) {
  const config = asConfigObject(agent.config);
  const brainTab = asConfigObject(config.brainTab);
  const providerId = String(config.provider ?? "claude");
  const resolvedModel = getResolvedModelForProvider(
    providerId,
    String(config.model ?? "claude-sonnet-4-20250514")
  );

  return {
    type: agent.type,
    name: agent.name,
    enabled: agent.isActive,
    systemPrompt: agent.systemPrompt,
    provider: providerId,
    model: resolvedModel,
    missionPreset: String(config.missionKind ?? "operations"),
    description: String(config.description ?? ""),
    hitlRequired: Boolean(brainTab.hitl),
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    escalationThreshold: agent.escalationThreshold,
    config,
    updatedAt: agent.updatedAt
  };
}

async function ensureAgentConfigs(): Promise<StoredAgentConfig[]> {
  await Promise.all(
    defaultAgentConfigs.map((agent) =>
      prisma.agentConfig.upsert({
        where: { type: agent.type },
        update: {},
        create: {
          type: agent.type,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          escalationThreshold: agent.escalationThreshold,
          config: agent.config as never
        }
      })
    )
  );

  const agents = await prisma.agentConfig.findMany({
    orderBy: { type: "asc" }
  });

  return agents as StoredAgentConfig[];
}

const aiProviders = [
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "",
    enabled: false
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "",
    enabled: false
  },
  {
    id: "claude",
    name: "Claude",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "",
    enabled: Boolean(process.env.ANTHROPIC_API_KEY)
  },
  {
    id: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "",
    enabled: false
  },
  {
    id: "glm",
    name: "GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "",
    enabled: false
  },
  {
    id: "kimi-k2",
    name: "Kimi K2",
    baseUrl: "https://api.moonshot.ai/v1",
    defaultModel: "",
    enabled: false
  },
  {
    id: "qwen",
    name: "Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "",
    enabled: false
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "",
    enabled: false
  },
  {
    id: "fal-ai",
    name: "fal.ai",
    baseUrl: "https://queue.fal.run",
    defaultModel: "",
    enabled: Boolean(process.env.FAL_KEY)
  },
  {
    id: "tavily",
    name: "Tavily",
    baseUrl: "https://api.tavily.com",
    defaultModel: "",
    enabled: Boolean(process.env.TAVILY_API_KEY)
  },
  {
    id: "serper",
    name: "Serper",
    baseUrl: "https://google.serper.dev",
    defaultModel: "",
    enabled: Boolean(process.env.SERPER_API_KEY)
  }
];

type AiProviderSettings = {
  id: string;
  name: string;
  apiKey?: string;
  apiKeySource: "database" | "env" | "none";
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  budget: string;
  models: string[];
};

export type EmbeddingProviderConfig = {
  providerId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ChatProviderConfig = {
  providerId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackFrom?: string;
};

type StoredAiProviderSettings = {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled?: boolean;
  budget?: string;
  models?: string[];
};

type IncomingAiProviderSettings = StoredAiProviderSettings & {
  clearApiKey?: boolean;
};


const AI_PROVIDERS_SETTINGS_KEY = "ai-providers";
const chatCapableProviderIds = new Set(["groq", "openai", "claude", "gemini", "glm", "kimi-k2", "qwen", "nvidia-nim"]);
let storedAiProviderOverrides: StoredAiProviderSettings[] = [];
let storedAiProviders: AiProviderSettings[] = buildRuntimeAiProviders([]);
let aiProvidersLoaded = false;

function serializeAiProvider(provider: AiProviderSettings) {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    enabled: provider.enabled,
    budget: provider.budget,
    models: provider.models,
    apiKeyConfigured: Boolean(provider.apiKey),
    apiKeySource: provider.apiKeySource
  };
}

function getProviderEnvApiKey(providerId: string) {
  switch (providerId) {
    case "groq":
      return process.env.GROQ_API_KEY ?? "";
    case "openai":
      return process.env.OPENAI_API_KEY ?? "";
    case "claude":
      return process.env.ANTHROPIC_API_KEY ?? "";
    case "gemini":
      return process.env.GEMINI_API_KEY ?? "";
    case "glm":
      return process.env.GLM_API_KEY ?? "";
    case "kimi-k2":
      return process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY ?? "";
    case "qwen":
      return process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? "";
    case "nvidia-nim":
      return process.env.NVIDIA_NIM_API_KEY ?? process.env.NVIDIA_API_KEY ?? "";
    case "fal-ai":
      return process.env.FAL_KEY ?? "";
    case "tavily":
      return process.env.TAVILY_API_KEY ?? "";
    case "serper":
      return process.env.SERPER_API_KEY ?? "";
    default:
      return "";
  }
}

function normalizeStoredAiProviders(value: unknown): StoredAiProviderSettings[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: StoredAiProviderSettings[] = [];

  for (const item of value) {
    const source = asRecord(item);
    const id = typeof source.id === "string" ? source.id : "";
    if (!id || !aiProviders.some((provider) => provider.id === id)) {
      continue;
    }

    const apiKey = typeof source.apiKey === "string" && source.apiKey.trim() ? source.apiKey.trim() : undefined;
    const baseUrl = typeof source.baseUrl === "string" && source.baseUrl.trim() ? source.baseUrl.trim() : undefined;
    const defaultModel =
      typeof source.defaultModel === "string" && source.defaultModel.trim() ? source.defaultModel.trim() : undefined;
    const enabled = typeof source.enabled === "boolean" ? source.enabled : undefined;
    const budget = typeof source.budget === "string" && source.budget.trim() ? source.budget.trim() : undefined;
    const models = Array.isArray(source.models)
      ? source.models.map((model) => String(model).trim()).filter(Boolean)
      : undefined;

    normalized.push({
      id,
      apiKey,
      baseUrl,
      defaultModel,
      enabled,
      budget,
      models
    });
  }

  return normalized;
}

function buildRuntimeAiProviders(overrides: StoredAiProviderSettings[]): AiProviderSettings[] {
  return aiProviders.map((provider) => {
    const override = overrides.find((item) => item.id === provider.id);
    const envApiKey = getProviderEnvApiKey(provider.id);
    const databaseApiKey = override?.apiKey?.trim() ?? "";
    const apiKey = databaseApiKey || envApiKey || "";
    const apiKeySource = databaseApiKey ? "database" : envApiKey ? "env" : "none";
    const models =
      override?.models && override.models.length > 0
        ? override.models
        : [];
    const desiredDefaultModel = override?.defaultModel?.trim() ?? "";
    const defaultModel = desiredDefaultModel && models.includes(desiredDefaultModel) ? desiredDefaultModel : "";

    return {
      ...provider,
      apiKey,
      apiKeySource,
      baseUrl: override?.baseUrl?.trim() || provider.baseUrl,
      defaultModel,
      enabled: typeof override?.enabled === "boolean" ? override.enabled : provider.enabled || Boolean(apiKey),
      budget: override?.budget?.trim() || "100 USD",
      models
    };
  });
}

async function persistAiProviderOverrides(overrides: StoredAiProviderSettings[]) {
  await prisma.appSetting.upsert({
    where: { key: AI_PROVIDERS_SETTINGS_KEY },
    update: { value: overrides as never },
    create: {
      key: AI_PROVIDERS_SETTINGS_KEY,
      value: overrides as never
    }
  });
}

async function ensureAiProvidersLoaded(force = false) {
  if (aiProvidersLoaded && !force) {
    return storedAiProviders;
  }

  const stored = await prisma.appSetting.findUnique({
    where: { key: AI_PROVIDERS_SETTINGS_KEY }
  });

  storedAiProviderOverrides = normalizeStoredAiProviders(stored?.value);
  storedAiProviders = buildRuntimeAiProviders(storedAiProviderOverrides);
  aiProvidersLoaded = true;

  return storedAiProviders;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function findAiProvider(providerId: string) {
  return storedAiProviders.find((provider) => provider.id === providerId);
}

function isAiProviderReady(provider: AiProviderSettings) {
  return provider.enabled && Boolean(provider.apiKey);
}

function resolveChatModel(provider: AiProviderSettings, requestedModel?: string) {
  const trimmedModel = requestedModel?.trim();
  if (trimmedModel && provider.models.includes(trimmedModel)) {
    return trimmedModel;
  }

  if (provider.defaultModel && provider.models.includes(provider.defaultModel)) {
    return provider.defaultModel;
  }

  return "";
}

export async function getChatProviderConfig(providerId?: string, requestedModel?: string): Promise<ChatProviderConfig | null> {
  await ensureAiProvidersLoaded();

  const preferred = providerId ? findAiProvider(providerId) : null;
  if (preferred && chatCapableProviderIds.has(preferred.id) && isAiProviderReady(preferred)) {
    return {
      providerId: preferred.id,
      name: preferred.name,
      apiKey: preferred.apiKey ?? "",
      baseUrl: preferred.baseUrl,
      model: resolveChatModel(preferred, requestedModel)
    };
  }

  const fallback = storedAiProviders.find((provider) => chatCapableProviderIds.has(provider.id) && isAiProviderReady(provider));
  if (!fallback) {
    return null;
  }

  return {
    providerId: fallback.id,
    name: fallback.name,
    apiKey: fallback.apiKey ?? "",
    baseUrl: fallback.baseUrl,
    model: resolveChatModel(fallback),
    fallbackFrom: preferred && preferred.id !== fallback.id ? preferred.id : providerId
  };
}

export function getEmbeddingProviderConfig(): EmbeddingProviderConfig | null {
  const openai = storedAiProviders.find((provider) => provider.id === "openai");
  if (openai && openai.enabled && openai.apiKey) {
    return {
      providerId: openai.id,
      name: openai.name,
      apiKey: openai.apiKey,
      baseUrl: openai.baseUrl,
      model: "text-embedding-3-small"
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      providerId: "openai",
      name: "OpenAI",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"
    };
  }

  return null;
}

function getResolvedModelForProvider(providerId: string, fallbackModel: string) {
  const provider = findAiProvider(providerId);
  if (!provider) return fallbackModel;

  if (provider.models.includes(fallbackModel)) {
    return fallbackModel;
  }

  if (provider.defaultModel && provider.models.includes(provider.defaultModel)) {
    return provider.defaultModel;
  }

  return fallbackModel;
}

function requireReadyAiProvider(providerId: string) {
  const provider = findAiProvider(providerId);
  if (!provider) {
    throw new SettingsRouteError(400, "Choisis un fournisseur IA valide dans Gestion des cles API.");
  }

  if (!provider.enabled || !provider.apiKey) {
    throw new SettingsRouteError(
      400,
      `Le fournisseur ${provider.name} doit etre actif avec une cle configuree dans Gestion des cles API.`
    );
  }

  return provider;
}

function resolveAgentModel(provider: AiProviderSettings, requestedModel: string | undefined) {
  const trimmedModel = requestedModel?.trim();
  if (!trimmedModel) {
    if (provider.defaultModel && provider.models.includes(provider.defaultModel)) {
      return provider.defaultModel;
    }
    throw new SettingsRouteError(
      400,
      `Choisis d'abord un modele par defaut pour le fournisseur ${provider.name} dans Parametres API.`,
    );
  }

  if (!provider.models.includes(trimmedModel)) {
    throw new SettingsRouteError(
      400,
      `Le modele ${trimmedModel} n'est pas disponible pour le fournisseur ${provider.name}.`
    );
  }

  return trimmedModel;
}

function handleSettingsError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof SettingsRouteError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  next(error);
}

function modelNamesFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const value = payload as { data?: unknown; models?: unknown };
  const list = Array.isArray(value.data) ? value.data : Array.isArray(value.models) ? value.models : [];

  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const model = item as { id?: unknown; name?: unknown; model?: unknown };
        return String(model.id ?? model.name ?? model.model ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

async function fetchModels(provider: string, apiKey: string, baseUrl: string): Promise<string[]> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const timeout = AbortSignal.timeout(15_000);

  if (provider === "gemini") {
    const response = await fetch(`${normalizedBaseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`, { signal: timeout });
    if (!response.ok) throw new Error(`Gemini a refuse la cle (${response.status})`);
    const payload = (await response.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    return (payload.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
      .map((model) => String(model.name ?? "").replace("models/", ""))
      .filter(Boolean);
  }

  if (provider === "claude") {
    const response = await fetch(`${normalizedBaseUrl}/v1/models`, {
      signal: timeout,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    if (!response.ok) throw new Error(`Claude a refuse la cle (${response.status})`);
    return modelNamesFromPayload(await response.json());
  }

  if (provider === "fal-ai" || provider === "tavily" || provider === "serper") {
    return [];
  }

  const response = await fetch(`${normalizedBaseUrl}/models`, {
    signal: timeout,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) throw new Error(`Le fournisseur a refuse la cle (${response.status})`);
  return modelNamesFromPayload(await response.json());
}

const WHATSAPP_SETTINGS_KEY = "whatsapp-settings";

const whatsappDefaults = {
  cloud: {
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? "",
    businessAccountId: process.env.META_WHATSAPP_BUSINESS_ID ?? "",
    accessToken: "",
    verifyToken: "",
    webhookPath: "/api/whatsapp/cloud/webhook"
  },
  baileys: {
    defaultSessionName: "Oumar personnel",
    phoneNumber: "",
    sessionStorage: "postgresql-encrypted",
    dailyBroadcastLimit: 200,
    minDelayMs: 1000,
    maxDelayMs: 3000
  }
};

type WhatsAppSettingsPayload = typeof whatsappDefaults;

function normalizeWhatsAppSettings(value: unknown): WhatsAppSettingsPayload {
  const source = asRecord(value);
  const cloud = asRecord(source.cloud);
  const baileys = asRecord(source.baileys);

  return {
    cloud: {
      phoneNumberId: asSettingString(cloud.phoneNumberId, whatsappDefaults.cloud.phoneNumberId),
      businessAccountId: asSettingString(cloud.businessAccountId, whatsappDefaults.cloud.businessAccountId),
      accessToken: asSettingString(cloud.accessToken, whatsappDefaults.cloud.accessToken),
      verifyToken: asSettingString(cloud.verifyToken, whatsappDefaults.cloud.verifyToken),
      webhookPath: whatsappDefaults.cloud.webhookPath
    },
    baileys: {
      defaultSessionName: asSettingString(baileys.defaultSessionName, whatsappDefaults.baileys.defaultSessionName),
      phoneNumber: asSettingString(baileys.phoneNumber, whatsappDefaults.baileys.phoneNumber),
      sessionStorage: whatsappDefaults.baileys.sessionStorage,
      dailyBroadcastLimit: asSettingNumber(baileys.dailyBroadcastLimit, whatsappDefaults.baileys.dailyBroadcastLimit),
      minDelayMs: asSettingNumber(baileys.minDelayMs, whatsappDefaults.baileys.minDelayMs),
      maxDelayMs: asSettingNumber(baileys.maxDelayMs, whatsappDefaults.baileys.maxDelayMs)
    }
  };
}

function serializeWhatsAppSettings(settings: WhatsAppSettingsPayload) {
  return {
    cloud: {
      ...settings.cloud,
      webhookVerifyTokenConfigured: Boolean(settings.cloud.verifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN),
      accessTokenConfigured: Boolean(settings.cloud.accessToken || process.env.META_ACCESS_TOKEN)
    },
    baileys: settings.baileys
  };
}

async function loadWhatsAppSettings() {
  const stored = await prisma.appSetting.findUnique({
    where: { key: WHATSAPP_SETTINGS_KEY }
  });

  return normalizeWhatsAppSettings(stored?.value);
}

async function saveWhatsAppSettings(input: unknown) {
  const current = await loadWhatsAppSettings();
  const body = asRecord(input);
  const next = normalizeWhatsAppSettings({
    ...current,
    ...body,
    cloud: {
      ...current.cloud,
      ...asRecord(body.cloud)
    },
    baileys: {
      ...current.baileys,
      ...asRecord(body.baileys)
    }
  });

  await prisma.appSetting.upsert({
    where: { key: WHATSAPP_SETTINGS_KEY },
    update: { value: next as never },
    create: {
      key: WHATSAPP_SETTINGS_KEY,
      value: next as never
    }
  });

  return next;
}

const EMAIL_SETTINGS_KEY = "email-settings";

type StoredEmailAccountSettings = {
  id: string;
  name: string;
  fromName: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  password?: string;
  isActive: boolean;
  syncMode: string;
  pollingSeconds: number;
  sentFolder: string;
  signature: string;
  signatureEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  autoReplyEnabled: boolean;
};

type EmailSettingsPayload = {
  accounts: StoredEmailAccountSettings[];
  templates: string[];
  security: {
    encryptPasswords: boolean;
    hitlBeforeSending: boolean;
    spamCleanupEnabled: boolean;
  };
  deliverability: {
    spf: string;
    dkim: string;
    dmarc: string;
    warmupLimitPerDay: number;
  };
};

type IncomingEmailAccountSettings = Partial<StoredEmailAccountSettings> & {
  clearPassword?: boolean;
};

const emailTemplates = [
  "Accuse reception devis",
  "Relance douce J+3",
  "Validation livrable",
  "Confirmation paiement"
];

const emailSecurity = {
  encryptPasswords: true,
  hitlBeforeSending: true,
  spamCleanupEnabled: true
};

const emailDeliverability = {
  spf: "Ajouter/valider un SPF autorisant le serveur mail LWS.",
  dkim: "Activer DKIM dans LWS et publier la cle DNS fournie.",
  dmarc: "Publier un DMARC au minimum en mode monitoring: p=none.",
  warmupLimitPerDay: 50
};

function defaultEmailAccount(): StoredEmailAccountSettings {
  const email = process.env.MAIN_SMTP_USER ?? "oumarbusiness@oumarbusiness.online";
  const imapPort = Number(process.env.MAIN_IMAP_PORT ?? 993);
  const smtpPort = Number(process.env.MAIN_SMTP_PORT ?? 465);

  return {
    id: "main",
    name: "Oumar Business",
    fromName: "Oumar Business",
    email,
    imapHost: process.env.MAIN_IMAP_HOST ?? "mail.oumarbusiness.online",
    imapPort,
    imapSecure: imapPort === 993,
    smtpHost: process.env.MAIN_SMTP_HOST ?? "mail.oumarbusiness.online",
    smtpPort,
    smtpSecure: smtpPort === 465,
    username: email,
    isActive: true,
    syncMode: "idle_plus_polling",
    pollingSeconds: 30,
    sentFolder: "Sent",
    signature: "Oumar Business\nMarketing digital - Sites web - Agents IA\nWhatsApp: +225 07 57 32 56 95",
    signatureEnabled: true,
    aiSuggestionsEnabled: true,
    autoReplyEnabled: false
  };
}

function normalizeEmailAccount(value: unknown, current?: StoredEmailAccountSettings): StoredEmailAccountSettings {
  const source = asRecord(value);
  const fallback = current ?? defaultEmailAccount();
  const imapPort = asSettingNumber(source.imapPort, fallback.imapPort);
  const smtpPort = asSettingNumber(source.smtpPort, fallback.smtpPort);

  return {
    id: asSettingString(source.id, fallback.id),
    name: asSettingString(source.name, fallback.name),
    fromName: asSettingString(source.fromName, fallback.fromName),
    email: asSettingString(source.email, fallback.email),
    imapHost: asSettingString(source.imapHost, fallback.imapHost),
    imapPort,
    imapSecure: asSettingBoolean(source.imapSecure, imapPort === 993),
    smtpHost: asSettingString(source.smtpHost, fallback.smtpHost),
    smtpPort,
    smtpSecure: asSettingBoolean(source.smtpSecure, smtpPort === 465),
    username: asSettingString(source.username, fallback.username),
    password: typeof source.password === "string" && source.password ? source.password : fallback.password,
    isActive: asSettingBoolean(source.isActive, fallback.isActive),
    syncMode: asSettingString(source.syncMode, fallback.syncMode),
    pollingSeconds: asSettingNumber(source.pollingSeconds, fallback.pollingSeconds),
    sentFolder: asSettingString(source.sentFolder, fallback.sentFolder),
    signature: typeof source.signature === "string" ? source.signature : fallback.signature,
    signatureEnabled: asSettingBoolean(source.signatureEnabled, fallback.signatureEnabled),
    aiSuggestionsEnabled: asSettingBoolean(source.aiSuggestionsEnabled, fallback.aiSuggestionsEnabled),
    autoReplyEnabled: asSettingBoolean(source.autoReplyEnabled, fallback.autoReplyEnabled)
  };
}

function normalizeEmailSettings(value: unknown): EmailSettingsPayload {
  const source = asRecord(value);
  const accounts = Array.isArray(source.accounts)
    ? source.accounts.map((account) => normalizeEmailAccount(account))
    : [defaultEmailAccount()];

  return {
    accounts: accounts.length > 0 ? accounts : [defaultEmailAccount()],
    templates: Array.isArray(source.templates) ? source.templates.map(String).filter(Boolean) : emailTemplates,
    security: emailSecurity,
    deliverability: emailDeliverability
  };
}

function serializeEmailSettings(settings: EmailSettingsPayload) {
  return {
    ...settings,
    accounts: settings.accounts.map((account) => ({
      ...account,
      password: undefined,
      usernameConfigured: Boolean(account.username),
      passwordConfigured: Boolean(account.password || process.env.MAIN_SMTP_PASS),
      passwordSource: account.password ? "database" : process.env.MAIN_SMTP_PASS ? "env" : "none"
    }))
  };
}

async function loadEmailSettings() {
  const stored = await prisma.appSetting.findUnique({
    where: { key: EMAIL_SETTINGS_KEY }
  });

  return normalizeEmailSettings(stored?.value);
}

async function saveEmailSettings(input: unknown) {
  const current = await loadEmailSettings();
  const body = asRecord(input);
  const incomingAccounts = Array.isArray(body.accounts) ? body.accounts : [];
  const accounts = (incomingAccounts.length > 0 ? incomingAccounts : current.accounts).map((rawAccount) => {
    const incoming = asRecord(rawAccount) as IncomingEmailAccountSettings;
    const currentAccount =
      current.accounts.find((account) => account.id === incoming.id) ??
      current.accounts.find((account) => account.id === "main") ??
      defaultEmailAccount();
    const next = normalizeEmailAccount(incoming, currentAccount);
    const typedPassword = typeof incoming.password === "string" ? incoming.password : "";

    if (incoming.clearPassword) {
      delete next.password;
    } else if (typedPassword) {
      next.password = encryptSecret(typedPassword);
    } else {
      next.password = currentAccount.password;
    }

    return next;
  });

  const nextSettings: EmailSettingsPayload = {
    accounts,
    templates: Array.isArray(body.templates) ? body.templates.map(String).filter(Boolean) : current.templates,
    security: emailSecurity,
    deliverability: emailDeliverability
  };

  await prisma.appSetting.upsert({
    where: { key: EMAIL_SETTINGS_KEY },
    update: { value: nextSettings as never },
    create: {
      key: EMAIL_SETTINGS_KEY,
      value: nextSettings as never
    }
  });

  return nextSettings;
}

export async function getRuntimeEmailAccount(accountId = "main"): Promise<EmailAccountConfig> {
  const settings = await loadEmailSettings();
  const account = settings.accounts.find((item) => item.id === accountId) ?? settings.accounts[0];
  if (!account) {
    throw new SettingsRouteError(400, "Aucun compte email n'est configure.");
  }

  const password = account.password ? decryptSecret(account.password) : process.env.MAIN_SMTP_PASS;
  if (!password) {
    throw new SettingsRouteError(400, "Ajoute le mot de passe du compte email LWS avant de tester la connexion.");
  }

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecure: account.imapSecure,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecure: account.smtpSecure,
    username: account.username,
    password,
    sentFolder: account.sentFolder
  };
}

function emailConnectionErrorMessage(type: "imap" | "smtp", error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const label = type === "imap" ? "IMAP entrant" : "SMTP sortant";

  if (/Invalid login|Authentication|AUTH|LOGIN/i.test(raw)) {
    return `${label}: authentification refusee. Verifie l'adresse email complete et le mot de passe LWS.`;
  }

  if (/certificate|self signed|TLS|SSL/i.test(raw)) {
    return `${label}: probleme SSL/TLS. Essaie le port SMTP 465 en SSL ou 587 en STARTTLS selon LWS.`;
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(raw)) {
    return `${label}: serveur inaccessible. Verifie mail.oumarbusiness.online, le port et la connexion Docker.`;
  }

  return `${label}: ${raw}`;
}

const billingSettings = {
  methods: {
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    paypalEnabled: Boolean(process.env.PAYPAL_CLIENT_ID),
    waveEnabled: Boolean(process.env.WAVE_API_KEY),
    orangeMoneyEnabled: Boolean(process.env.ORANGE_MONEY_API_KEY),
    bankTransferEnabled: true
  },
  accounts: {
    stripePublicLabel: "Stripe Checkout",
    paypalHandle: "paypal.me/oumarbusiness",
    waveNumber: "+225 07 57 32 56 95",
    orangeMoneyNumber: "+225 07 57 32 56 95",
    bankName: "Banque Atlantique CI",
    iban: "CI00 0000 0000 0000 0000 0000 000",
    swift: "ATCIXXXX"
  },
  invoicing: {
    invoicePrefix: "OB",
    defaultCurrency: "XOF",
    defaultDueDays: 7,
    depositPercent: 60,
    lateReminderDays: "7,14,30"
  }
};

const BILLING_SETTINGS_KEY = "billing-settings";

type BillingSettingsPayload = typeof billingSettings;

const ASSISTANT_SETTINGS_KEY = "landing-assistant-settings";
const landingAssistantDefaults = {
  enabled: true,
  assistantName: "Assistant Oumar Business",
  launcherTitle: "Besoin d'aide ?",
  launcherSubtitle: "Discute avec l'assistant",
  welcomeMessage: "Bonjour, je suis l'assistant Oumar Business. Ecris ton besoin et je t'oriente.",
  inputPlaceholder: "Ecris ton besoin...",
  defaultDraft: "Bonjour, je veux un site web avec agent IA.",
  quickPrompts: [
    "Je veux un devis pour un site web.",
    "Je veux un agent WhatsApp.",
    "Je veux automatiser mes relances."
  ]
};

type LandingAssistantSettings = typeof landingAssistantDefaults;

const BRANDING_SETTINGS_KEY = "branding";
const BRANDING_LOGO_META_KEY = "branding-logo-meta";
const brandingAssetsDir = process.env.UPLOADS_DIR ?? "/data/uploads";
const brandingAssetFolder = "branding";
const brandingAssetBaseName = "logo";
const brandingPwaIconBaseName = "pwa-icon";

const brandingDefaults = {
  agencyName: "Oumar Business",
  legalName: "Oumar Business SARL",
  logoUrl: "/logo-ob.svg",
  pwaIconUrl: "",
  primaryColor: "#F5A623",
  secondaryColor: "#080808",
  invoicePrefix: "OB",
  clientPortalTitle: "Portail client Oumar Business",
  supportEmail: "support@oumar-business.com",
  contactEmail: "",
  phone: "",
  footerText: "Marketing, sites web et agents IA pour la croissance."
};

type BrandingSettings = typeof brandingDefaults;
type BrandingLogoMeta = {
  cleanupVersion: number;
  processedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asSettingString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asSettingNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asSettingBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeQuickPrompts(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const prompts = value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 3);
  return prompts.length > 0 ? prompts : fallback;
}

function normalizeLandingAssistantSettings(value: unknown): LandingAssistantSettings {
  const source = asRecord(value);

  return {
    enabled: asSettingBoolean(source.enabled, landingAssistantDefaults.enabled),
    assistantName: asSettingString(source.assistantName, landingAssistantDefaults.assistantName),
    launcherTitle: asSettingString(source.launcherTitle, landingAssistantDefaults.launcherTitle),
    launcherSubtitle: asSettingString(source.launcherSubtitle, landingAssistantDefaults.launcherSubtitle),
    welcomeMessage: asSettingString(source.welcomeMessage, landingAssistantDefaults.welcomeMessage),
    inputPlaceholder: asSettingString(source.inputPlaceholder, landingAssistantDefaults.inputPlaceholder),
    defaultDraft: asSettingString(source.defaultDraft, landingAssistantDefaults.defaultDraft),
    quickPrompts: normalizeQuickPrompts(source.quickPrompts, landingAssistantDefaults.quickPrompts)
  };
}

function normalizeBrandingSettings(value: unknown): BrandingSettings {
  const source = asRecord(value);

  return {
    agencyName: asSettingString(source.agencyName, brandingDefaults.agencyName),
    legalName: asSettingString(source.legalName, brandingDefaults.legalName),
    logoUrl: asSettingString(source.logoUrl, brandingDefaults.logoUrl),
    pwaIconUrl: typeof source.pwaIconUrl === "string" ? source.pwaIconUrl : brandingDefaults.pwaIconUrl,
    primaryColor: asSettingString(source.primaryColor, brandingDefaults.primaryColor),
    secondaryColor: asSettingString(source.secondaryColor, brandingDefaults.secondaryColor),
    invoicePrefix: asSettingString(source.invoicePrefix, brandingDefaults.invoicePrefix),
    clientPortalTitle: asSettingString(source.clientPortalTitle, brandingDefaults.clientPortalTitle),
    supportEmail: asSettingString(source.supportEmail, brandingDefaults.supportEmail),
    contactEmail: typeof source.contactEmail === "string" ? source.contactEmail : brandingDefaults.contactEmail,
    phone: typeof source.phone === "string" ? source.phone : brandingDefaults.phone,
    footerText: asSettingString(source.footerText, brandingDefaults.footerText)
  };
}

function normalizeBillingSettings(value: unknown): BillingSettingsPayload {
  const source = asRecord(value);
  const methods = asRecord(source.methods);
  const accounts = asRecord(source.accounts);
  const invoicing = asRecord(source.invoicing);

  return {
    methods: {
      stripeEnabled: asSettingBoolean(methods.stripeEnabled, billingSettings.methods.stripeEnabled),
      paypalEnabled: asSettingBoolean(methods.paypalEnabled, billingSettings.methods.paypalEnabled),
      waveEnabled: asSettingBoolean(methods.waveEnabled, billingSettings.methods.waveEnabled),
      orangeMoneyEnabled: asSettingBoolean(methods.orangeMoneyEnabled, billingSettings.methods.orangeMoneyEnabled),
      bankTransferEnabled: asSettingBoolean(methods.bankTransferEnabled, billingSettings.methods.bankTransferEnabled)
    },
    accounts: {
      stripePublicLabel: asSettingString(accounts.stripePublicLabel, billingSettings.accounts.stripePublicLabel),
      paypalHandle: asSettingString(accounts.paypalHandle, billingSettings.accounts.paypalHandle),
      waveNumber: asSettingString(accounts.waveNumber, billingSettings.accounts.waveNumber),
      orangeMoneyNumber: asSettingString(accounts.orangeMoneyNumber, billingSettings.accounts.orangeMoneyNumber),
      bankName: asSettingString(accounts.bankName, billingSettings.accounts.bankName),
      iban: asSettingString(accounts.iban, billingSettings.accounts.iban),
      swift: asSettingString(accounts.swift, billingSettings.accounts.swift)
    },
    invoicing: {
      invoicePrefix: asSettingString(invoicing.invoicePrefix, billingSettings.invoicing.invoicePrefix),
      defaultCurrency: asSettingString(invoicing.defaultCurrency, billingSettings.invoicing.defaultCurrency),
      defaultDueDays: asSettingNumber(invoicing.defaultDueDays, billingSettings.invoicing.defaultDueDays),
      depositPercent: asSettingNumber(invoicing.depositPercent, billingSettings.invoicing.depositPercent),
      lateReminderDays: asSettingString(invoicing.lateReminderDays, billingSettings.invoicing.lateReminderDays)
    }
  };
}

export async function loadBillingSettings(): Promise<BillingSettingsPayload> {
  const stored = await prisma.appSetting.findUnique({ where: { key: BILLING_SETTINGS_KEY } }).catch(() => null);
  return stored ? normalizeBillingSettings(stored.value) : billingSettings;
}

export async function loadLandingAssistantSettings(): Promise<LandingAssistantSettings> {
  const stored = await prisma.appSetting.findUnique({ where: { key: ASSISTANT_SETTINGS_KEY } }).catch(() => null);
  return stored ? normalizeLandingAssistantSettings(stored.value) : landingAssistantDefaults;
}

async function saveLandingAssistantSettings(value: unknown): Promise<LandingAssistantSettings> {
  const normalized = normalizeLandingAssistantSettings(value);

  await prisma.appSetting.upsert({
    where: { key: ASSISTANT_SETTINGS_KEY },
    update: { value: normalized as never },
    create: { key: ASSISTANT_SETTINGS_KEY, value: normalized as never }
  });

  return normalized;
}

async function saveBillingSettings(value: unknown): Promise<BillingSettingsPayload> {
  const normalized = normalizeBillingSettings(value);

  await prisma.appSetting.upsert({
    where: { key: BILLING_SETTINGS_KEY },
    update: { value: normalized as never },
    create: { key: BILLING_SETTINGS_KEY, value: normalized as never }
  });

  return normalized;
}

export async function loadBrandingSettings() {
  const [stored, storedMeta] = await Promise.all([
    prisma.appSetting.findUnique({
      where: { key: BRANDING_SETTINGS_KEY }
    }),
    prisma.appSetting.findUnique({
      where: { key: BRANDING_LOGO_META_KEY }
    })
  ]);

  const normalized = normalizeBrandingSettings(stored?.value);
  const meta = normalizeBrandingLogoMeta(storedMeta?.value);

  if (normalized.logoUrl.startsWith("data:image/")) {
    const migrated = await persistBrandingLogo(normalized.logoUrl, brandingAssetBaseName);
    const next = {
      ...normalized,
      logoUrl: migrated
    };

    await saveBrandingSettingsRecord(next, createBrandingLogoMeta());

    return next;
  }

  if (normalized.pwaIconUrl.startsWith("data:image/")) {
    const migrated = await persistBrandingLogo(normalized.pwaIconUrl, brandingPwaIconBaseName);
    const next = {
      ...normalized,
      pwaIconUrl: migrated
    };

    await saveBrandingSettingsRecord(next, null);
    return next;
  }

  if (shouldNormalizeStoredBrandingAsset(normalized.logoUrl, meta)) {
    const migrated = await normalizeExistingBrandingLogoAsset(normalized.logoUrl, {
      assetsDir: brandingAssetsDir,
      assetFolder: brandingAssetFolder,
      assetBaseName: brandingAssetBaseName
    });

    if (migrated) {
      const next = {
        ...normalized,
        logoUrl: migrated
      };

      await saveBrandingSettingsRecord(next, createBrandingLogoMeta());
      return next;
    }
  }

  return normalized;
}

async function saveBrandingSettings(input: unknown) {
  const current = await loadBrandingSettings();
  const merged = normalizeBrandingSettings({
    ...current,
    ...asRecord(input)
  });
  const next = {
    ...merged,
    logoUrl: merged.logoUrl.startsWith("data:image/")
      ? await persistBrandingLogo(merged.logoUrl, brandingAssetBaseName)
      : merged.logoUrl
  };
  const finalSettings = {
    ...next,
    pwaIconUrl: merged.pwaIconUrl.startsWith("data:image/")
      ? await persistBrandingLogo(merged.pwaIconUrl, brandingPwaIconBaseName)
      : merged.pwaIconUrl
  };

  await saveBrandingSettingsRecord(
    finalSettings,
    merged.logoUrl.startsWith("data:image/") ? createBrandingLogoMeta() : null
  );

  return finalSettings;
}

async function persistBrandingLogo(dataUrl: string, assetBaseName: string) {
  const result =
    assetBaseName === brandingPwaIconBaseName
      ? await normalizeAndStoreBrandingPwaIconFromDataUrl(dataUrl, {
          assetsDir: brandingAssetsDir,
          assetFolder: brandingAssetFolder,
          assetBaseName
        })
      : await normalizeAndStoreBrandingLogoFromDataUrl(dataUrl, {
          assetsDir: brandingAssetsDir,
          assetFolder: brandingAssetFolder,
          assetBaseName
        });

  return result ?? dataUrl;
}

async function saveBrandingSettingsRecord(settings: BrandingSettings, meta: BrandingLogoMeta | null) {
  await prisma.appSetting.upsert({
    where: { key: BRANDING_SETTINGS_KEY },
    update: { value: settings as never },
    create: {
      key: BRANDING_SETTINGS_KEY,
      value: settings as never
    }
  });

  if (!meta) {
    return;
  }

  await prisma.appSetting.upsert({
    where: { key: BRANDING_LOGO_META_KEY },
    update: { value: meta as never },
    create: {
      key: BRANDING_LOGO_META_KEY,
      value: meta as never
    }
  });
}

function normalizeBrandingLogoMeta(value: unknown): BrandingLogoMeta | null {
  const source = asRecord(value);
  const cleanupVersion = Number(source.cleanupVersion);
  const processedAt = typeof source.processedAt === "string" ? source.processedAt : "";

  if (!Number.isFinite(cleanupVersion) || !processedAt) {
    return null;
  }

  return {
    cleanupVersion,
    processedAt
  };
}

function createBrandingLogoMeta(): BrandingLogoMeta {
  return {
    cleanupVersion: BRANDING_LOGO_CLEANUP_VERSION,
    processedAt: new Date().toISOString()
  };
}

function shouldNormalizeStoredBrandingAsset(logoUrl: string, meta: BrandingLogoMeta | null) {
  return logoUrl.startsWith("/uploads/branding/") && meta?.cleanupVersion !== BRANDING_LOGO_CLEANUP_VERSION;
}

void ensureAiProvidersLoaded().catch(() => {
  aiProvidersLoaded = false;
});

const teamSettings = {
  inviteDefaults: {
    role: "SALES_AGENT",
    sendWelcomeEmail: true,
    notifyAdmin: true
  },
  members: [
    {
      id: "team-1",
      name: "Oumar Konate",
      email: "oumar@oumar-business.com",
      role: "SUPER_ADMIN",
      status: "active",
      lastLogin: "Aujourd'hui 07:15"
    },
    {
      id: "team-2",
      name: "Awa Support",
      email: "support@oumar-business.com",
      role: "WHATSAPP_OPERATOR",
      status: "active",
      lastLogin: "Hier 22:41"
    },
    {
      id: "team-3",
      name: "Moussa Sales",
      email: "sales@oumar-business.com",
      role: "SALES_AGENT",
      status: "suspended",
      lastLogin: "Lun 18:20"
    }
  ]
};

const securitySettings = {
  twoFactor: {
    requiredForAdmins: true,
    requiredForOperators: false
  },
  sessions: {
    sessionTimeoutMinutes: 15,
    refreshTokenDays: 7,
    allowMultipleSessions: true
  },
  protection: {
    loginAttempts: 5,
    lockoutMinutes: 15,
    auditLogEnabled: true,
    ipAlertEnabled: true
  }
};

const languagesSettings = {
  defaultLanguage: "fr",
  defaultDirection: "ltr",
  clientPortalLanguage: "fr",
  available: [
    { code: "fr", label: "Francais", enabled: true, rtl: false },
    { code: "en", label: "English", enabled: true, rtl: false },
    { code: "ar", label: "Arabic", enabled: true, rtl: true }
  ],
  customLabels: {
    dashboardTitle: "Vue globale",
    clientPortalTitle: "Portail client",
    invoiceLabel: "Facture"
  }
};

settingsRouter.use((req, res, next) => {
  const publicGetRoutes = new Set(["/branding", "/assistant"]);
  if (req.method === "GET" && publicGetRoutes.has(req.path)) {
    next();
    return;
  }

  void requireAuthenticatedAdmin(req, res, next);
});

settingsRouter.get("/ai-providers", async (_req, res, next) => {
  try {
    const providers = await ensureAiProvidersLoaded();
    res.json({ providers: providers.map(serializeAiProvider) });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/ai-providers", async (req, res, next) => {
  try {
    await ensureAiProvidersLoaded();
    const incoming: IncomingAiProviderSettings[] = Array.isArray(req.body.providers) ? req.body.providers : [];
    const nextOverrides: StoredAiProviderSettings[] = aiProviders.map((provider) => {
      const currentRuntime = storedAiProviders.find((item) => item.id === provider.id);
      const currentOverride = storedAiProviderOverrides.find((item) => item.id === provider.id);
      const next = incoming.find((item) => item.id === provider.id);

      if (!currentRuntime) {
        return { id: provider.id };
      }

      const nextApiKey = typeof next?.apiKey === "string" ? next.apiKey.trim() : "";
      const persistedApiKey = next?.clearApiKey ? undefined : nextApiKey || currentOverride?.apiKey;
      const nextModels = Array.isArray(next?.models) ? next.models.map(String).filter(Boolean) : currentRuntime.models;
      const requestedDefaultModel =
        typeof next?.defaultModel === "string" && next.defaultModel.trim()
          ? next.defaultModel.trim()
          : "";
      const persistedDefaultModel = requestedDefaultModel && nextModels.includes(requestedDefaultModel)
        ? requestedDefaultModel
        : "";

      return {
        id: provider.id,
        ...(persistedApiKey ? { apiKey: persistedApiKey } : {}),
        baseUrl: String(next?.baseUrl ?? currentRuntime.baseUrl),
        defaultModel: persistedDefaultModel,
        enabled: next ? Boolean(next.enabled) : currentRuntime.enabled,
        budget: String(next?.budget ?? currentRuntime.budget),
        models: nextModels
      };
    });

    await persistAiProviderOverrides(nextOverrides);
    storedAiProviderOverrides = nextOverrides;
    storedAiProviders = buildRuntimeAiProviders(storedAiProviderOverrides);

    res.json({
      ok: true,
      saved: true,
      providers: storedAiProviders.map(serializeAiProvider)
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/ai-providers/:provider/models", async (req, res) => {
  await ensureAiProvidersLoaded();
  const provider = String(req.params.provider);
  const configured = storedAiProviders.find((item) => item.id === provider);
  if (!configured) return res.status(404).json({ error: "Fournisseur inconnu" });

  const typedApiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  const apiKey = typedApiKey || configured.apiKey || "";
  const baseUrl = String(req.body.baseUrl ?? configured.baseUrl);

  if (!apiKey && !["fal-ai", "tavily", "serper"].includes(provider)) {
    return res.status(400).json({
      ok: false,
      error: "Ajoute d'abord la cle API pour recuperer les modeles.",
      models: []
    });
  }

  try {
    const models = await fetchModels(provider, apiKey, baseUrl);
    const finalModels = models;
    const existingOverride = storedAiProviderOverrides.find((item) => item.id === provider);
    const nextOverrides = storedAiProviderOverrides
      .filter((item) => item.id !== provider)
      .concat({
        id: provider,
        ...(typedApiKey ? { apiKey: typedApiKey } : existingOverride?.apiKey ? { apiKey: existingOverride.apiKey } : {}),
        baseUrl,
        models: finalModels,
        defaultModel:
          configured.defaultModel && finalModels.includes(configured.defaultModel)
            ? configured.defaultModel
            : "",
        enabled: configured.enabled,
        budget: configured.budget
      });

    await persistAiProviderOverrides(nextOverrides);
    storedAiProviderOverrides = nextOverrides;
    storedAiProviders = buildRuntimeAiProviders(storedAiProviderOverrides);
    res.json({ ok: true, verified: Boolean(apiKey), models: finalModels });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Impossible de recuperer les modeles.",
      models: []
    });
  }
});

settingsRouter.post("/ai-providers/:provider/test-chat", async (req, res) => {
  await ensureAiProvidersLoaded();
  const providerId = String(req.params.provider);
  const configured = storedAiProviders.find((item) => item.id === providerId);
  if (!configured) return res.status(404).json({ ok: false, error: "Fournisseur inconnu" });

  if (!chatCapableProviderIds.has(providerId)) {
    return res.status(400).json({
      ok: false,
      error: "Ce fournisseur n'est pas un modele de chat pour les agents."
    });
  }

  const typedApiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  const apiKey = typedApiKey || configured.apiKey || "";
  const baseUrl = String(req.body.baseUrl ?? configured.baseUrl);
  const requestedModel = typeof req.body.model === "string" && req.body.model.trim()
    ? req.body.model.trim()
    : "";
  const requestedMessage = typeof req.body.message === "string" ? req.body.message.trim() : "";
  const testMessage = requestedMessage || "Test de connexion chat. Reponds: test ok";
  const systemPrompt = requestedMessage
    ? "Tu es un assistant de test pour la configuration IA du produit sourcing. Reponds normalement, clairement et uniquement au message recu."
    : "Reponds uniquement par: test ok";

  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      error: "Ajoute d'abord la cle API pour tester le chat."
    });
  }

  const model = resolveChatModel(configured, requestedModel);
  if (!model) {
    return res.status(400).json({
      ok: false,
      error: "Recupere d'abord les modeles depuis ta cle API avant de tester le chat."
    });
  }

  try {
    const reply = await callProviderChat(
      {
        providerId,
        apiKey,
        baseUrl,
        model
      },
      {
        systemPrompt,
        messages: [{ role: "user", content: testMessage }],
        temperature: 0,
        maxTokens: requestedMessage ? 220 : 24
      }
    );

    res.json({
      ok: true,
      provider: providerId,
      model,
      message: "Chat IA fonctionnel",
      replyPreview: reply.slice(0, 160)
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: providerId,
      model,
      error: providerChatErrorMessage(providerId, error)
    });
  }
});

settingsRouter.post("/ai-providers/:provider/test-search", async (req, res) => {
  await ensureAiProvidersLoaded();
  const providerId = String(req.params.provider);
  if (providerId !== "serper" && providerId !== "tavily") {
    return res.status(400).json({
      ok: false,
      error: "Ce fournisseur n'est pas un moteur de recherche sourcing."
    });
  }

  const configured = storedAiProviders.find((item) => item.id === providerId);
  if (!configured) {
    return res.status(404).json({
      ok: false,
      error: "Fournisseur inconnu"
    });
  }

  const typedApiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  const apiKey = typedApiKey || configured.apiKey || "";
  const baseUrl = String(req.body.baseUrl ?? configured.baseUrl);
  const query = typeof req.body.query === "string" ? req.body.query.trim() : "";

  if (!apiKey) {
    return res.status(400).json({
      ok: false,
      error: `Ajoute d'abord la cle API ${configured.name} pour tester la recherche.`
    });
  }

  if (!query) {
    return res.status(400).json({
      ok: false,
      error: "Ecris d'abord une requete de test."
    });
  }

  try {
    const result = await testSearchProvider({
      provider: providerId,
      query,
      apiKey,
      baseUrl,
      limit: 3,
      language: "fr"
    });

    res.json({
      ok: true,
      provider: configured.name,
      message: `${configured.name} repond correctement a la requete de test.`,
      resultCount: result.results.length,
      results: result.results
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      provider: configured.name,
      error: error instanceof Error ? error.message : "Recherche de test indisponible."
    });
  }
});

settingsRouter.get("/whatsapp", async (_req, res, next) => {
  try {
    res.json(serializeWhatsAppSettings(await loadWhatsAppSettings()));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/whatsapp", async (req, res, next) => {
  try {
    const settings = await saveWhatsAppSettings(req.body);
    res.json({
      ok: true,
      saved: true,
      settings: serializeWhatsAppSettings(settings)
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/email", async (_req, res, next) => {
  try {
    res.json(serializeEmailSettings(await loadEmailSettings()));
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/email", async (req, res, next) => {
  try {
    const settings = await saveEmailSettings(req.body);
    res.json({
      ok: true,
      saved: true,
      settings: serializeEmailSettings(settings)
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/email/test", async (req, res, next) => {
  const type = req.body?.type === "smtp" ? "smtp" : "imap";

  try {
    const account = await getRuntimeEmailAccount(String(req.body?.accountId ?? "main"));
    const engine = new EmailEngine();

    if (type === "smtp") {
      await engine.testSmtp(account);
    } else {
      await engine.testImap(account);
    }

    res.json({
      ok: true,
      type,
      message: type === "smtp" ? "Envoi SMTP OK" : "Connexion entrante OK"
    });
  } catch (error) {
    if (error instanceof SettingsRouteError) {
      res.status(error.status).json({ ok: false, type, error: error.message });
      return;
    }

    res.status(502).json({
      ok: false,
      type,
      error: emailConnectionErrorMessage(type, error)
    });
  }
});

settingsRouter.get("/billing", async (_req, res, next) => {
  try {
    res.json(await loadBillingSettings());
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/billing", async (req, res, next) => {
  try {
    const settings = await saveBillingSettings(req.body);
    res.json({
      ok: true,
      saved: true,
      settings
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/assistant", async (_req, res, next) => {
  try {
    res.json(await loadLandingAssistantSettings());
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/assistant", async (req, res, next) => {
  try {
    const settings = await saveLandingAssistantSettings(req.body);
    res.json({
      ok: true,
      saved: true,
      settings
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/branding", async (_req, res, next) => {
  try {
    res.json(await loadBrandingSettings());
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/branding", async (req, res, next) => {
  try {
    const settings = await saveBrandingSettings(req.body);
    res.json({
      ok: true,
      saved: true,
      settings
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/team", (_req, res) => {
  res.json(teamSettings);
});

settingsRouter.put("/team", (req, res) => {
  res.json({
    ok: true,
    saved: true,
    settings: req.body
  });
});

settingsRouter.get("/security", (_req, res) => {
  res.json(securitySettings);
});

settingsRouter.put("/security", (req, res) => {
  res.json({
    ok: true,
    saved: true,
    settings: req.body
  });
});

settingsRouter.get("/languages", (_req, res) => {
  res.json(languagesSettings);
});

settingsRouter.put("/languages", (req, res) => {
  res.json({
    ok: true,
    saved: true,
    settings: req.body
  });
});

settingsRouter.get("/agents", async (_req, res, next) => {
  try {
    await ensureAiProvidersLoaded();
    const agents = await ensureAgentConfigs();

    res.json({
      missionPresets,
      agents: agents.map((agent) => serializeAgentConfig(agent))
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put("/agents", async (req, res, next) => {
  try {
    await ensureAiProvidersLoaded();
    const agents = Array.isArray(req.body.agents) ? req.body.agents : [];
    const saved = await Promise.all(agents.map((agent: Record<string, unknown>) => saveAgentConfig(agent)));

    res.json({
      ok: true,
      saved: true,
      agents: saved.map(serializeAgentConfig)
    });
  } catch (error) {
    handleSettingsError(error, res, next);
  }
});

settingsRouter.put("/agents/:type", async (req, res, next) => {
  try {
    await ensureAiProvidersLoaded();
    const saved = await saveAgentConfig({
      ...req.body,
      type: req.params.type
    });

    res.json({
      ok: true,
      saved: true,
      agent: serializeAgentConfig(saved)
    });
  } catch (error) {
    handleSettingsError(error, res, next);
  }
});

async function saveAgentConfig(raw: Record<string, unknown>) {
  const defaultConfig = defaultAgentConfigs.find((agent) => agent.type === raw.type);
  if (!defaultConfig) {
    throw new Error(`Unknown agent type: ${String(raw.type)}`);
  }

  const bodyConfig = asConfigObject(raw.config);
  const providerId = String(raw.provider ?? bodyConfig.provider ?? defaultConfig.provider).trim();
  if (!providerId) {
    throw new SettingsRouteError(400, "Choisis un fournisseur IA dans Gestion des cles API.");
  }

  const provider = requireReadyAiProvider(providerId);
  const model = resolveAgentModel(
    provider,
    raw.model === undefined ? String(bodyConfig.model ?? "") : String(raw.model ?? "")
  );
  const config: JsonObject = {
    ...defaultConfig.config,
    ...bodyConfig,
    provider: provider.id,
    model,
    missionKind: String(raw.missionKind ?? bodyConfig.missionKind ?? defaultConfig.missionKind),
    description: String(raw.description ?? bodyConfig.description ?? defaultConfig.description)
  };

  return prisma.agentConfig.upsert({
    where: { type: defaultConfig.type },
    update: {
      name: String(raw.name ?? defaultConfig.name),
      systemPrompt: String(raw.systemPrompt ?? defaultConfig.systemPrompt),
      isActive: raw.enabled === undefined ? true : Boolean(raw.enabled),
      temperature: Number(raw.temperature ?? defaultConfig.temperature),
      maxTokens: Number(raw.maxTokens ?? 1000),
      escalationThreshold: Number(raw.escalationThreshold ?? defaultConfig.escalationThreshold),
      config: config as never
    },
    create: {
      type: defaultConfig.type,
      name: String(raw.name ?? defaultConfig.name),
      systemPrompt: String(raw.systemPrompt ?? defaultConfig.systemPrompt),
      isActive: raw.enabled === undefined ? true : Boolean(raw.enabled),
      temperature: Number(raw.temperature ?? defaultConfig.temperature),
      maxTokens: Number(raw.maxTokens ?? 1000),
      escalationThreshold: Number(raw.escalationThreshold ?? defaultConfig.escalationThreshold),
      config: config as never
    }
  });
}
