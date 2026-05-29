import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import QRCode from "qrcode";
import { WhatsAppCloudClient } from "@oumar/whatsapp-cloud";
import { WhatsAppBaileysClient, baileysManager, type SessionSummary } from "@oumar/whatsapp-baileys";
import { prisma } from "../../db/prisma.js";
import { extractPageContent, getSearchProviderStatus, searchSerper, searchTavily } from "../../services/searchIntelligence.js";
import { EmailEngine } from "@oumar/email-engine";
import { getRuntimeEmailAccount } from "./settings.js";
import { resolveAuthenticatedAdmin } from "./admin-auth.js";
import { createRateLimiter, secureCookieEnabled } from "../../services/httpSecurity.js";

export const saasRouter = Router();

const SAAS_COMPANIES_KEY = "saas_companies";
const SAAS_USERS_KEY = "saas_users";
const SAAS_SESSIONS_KEY = "saas_sessions";
const SAAS_AGENT_PROFILES_KEY = "saas_agent_profiles";
const SAAS_SUBSCRIPTIONS_KEY = "saas_subscriptions";
const SAAS_INVOICES_KEY = "saas_invoices";
const SAAS_CRM_LEADS_KEY = "saas_crm_leads";
const SAAS_SOURCING_RUNS_KEY = "saas_sourcing_runs";
const SAAS_SOURCING_LIVE_SESSIONS_KEY = "saas_sourcing_live_sessions";
const SAAS_SOURCING_LIVE_EVENTS_KEY = "saas_sourcing_live_events";
const SAAS_WHATSAPP_ACTIVITY_KEY = "saas_whatsapp_activity";
const SAAS_WHATSAPP_BINDINGS_KEY = "saas_whatsapp_bindings";
const SAAS_WHATSAPP_META_CONFIGS_KEY = "saas_whatsapp_meta_configs";
const SAAS_WHATSAPP_SETTINGS_KEY = "saas_whatsapp_settings";
const SAAS_EMAIL_CONFIGS_KEY = "saas_email_configs";
const SAAS_SOURCING_PLANS_KEY = "saas_sourcing_plans";
const SAAS_GLOBAL_AGENTS_KEY = "saas_global_agents";
const SAAS_RESET_TOKENS_KEY = "saas_password_reset_tokens";
const SAAS_VERIFY_TOKENS_KEY = "saas_email_verify_tokens";
const SAAS_PAYMENT_METHODS_KEY = "saas_payment_methods";
const SAAS_PAYMENT_REQUESTS_KEY = "saas_payment_requests";
const SAAS_COOKIE = "ob_saas_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const userDashboardUrl = `${(process.env.APP_URL ?? "http://localhost:1010").replace(/\/$/, "")}/user/dashboard`;

const moduleCatalog = [
  {
    key: "whatsapp-business",
    title: "Agent WhatsApp business",
    description: "Qualification, reponses automatiques, relances et transfert humain.",
    accent: "emerald",
    monthlyPrice: 35000
  },
  {
    key: "crm-intelligent",
    title: "CRM intelligent",
    description: "Scoring leads, relances, pipeline et priorites commerciales.",
    accent: "sky",
    monthlyPrice: 45000
  },
  {
    key: "billing-intelligent",
    title: "Facturation intelligente",
    description: "Devis, factures, relances et suivi des paiements.",
    accent: "amber",
    monthlyPrice: 30000
  },
  {
    key: "sourcing-commercial",
    title: "Agent sourcing commercial",
    description: "Recherche prospects, qualification et preparation outreach.",
    accent: "violet",
    monthlyPrice: 55000
  }
] as const;

type ModuleKey = (typeof moduleCatalog)[number]["key"];
type SubscriptionStatus = "trial" | "active" | "past_due" | "paused" | "cancelled";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type LeadStatus = "new" | "warm" | "hot" | "won";
type SourcingRunStatus = "draft" | "running" | "completed";
type SourcingLiveSessionStatus = "idle" | "running" | "paused" | "stopped" | "blocked" | "completed";
type SourcingLiveEventType =
  | "session_started"
  | "session_stopped"
  | "session_paused"
  | "session_resumed"
  | "cycle_started"
  | "cycle_completed"
  | "prospects_retained"
  | "prospect_rejected"
  | "quota_reached"
  | "provider_error"
  | "agent_blocked"
  | "no_results";
type WhatsAppConversationStatus = "open" | "pending" | "qualified";
type WhatsAppSessionMode = "baileys" | "cloud";
type SearchProviderMode = "live" | "waiting_api";

type SaasModuleActivation = {
  moduleKey: ModuleKey;
  active: boolean;
  activatedAt: string;
};

type SaasCompany = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  description: string;
  businessEmail: string;
  businessPhone: string;
  industry: string;
  serviceCatalog: string;
  targetCustomers: string;
  agentSkills: string[];
  agentInstructions: string;
  status: "active" | "inactive";
  modules: SaasModuleActivation[];
  createdAt: string;
  updatedAt: string;
};

type SaasUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  passwordHash: string;
  verifiedAt: string;
  role: "owner" | "member";
  createdAt: string;
  updatedAt: string;
};

type SaasSession = {
  id: string;
  userId: string;
  companyId: string;
  createdAt: string;
  expiresAt: string;
};

type SaasAgentProfile = {
  id: string;
  companyId: string;
  moduleKey: ModuleKey;
  agentKey: string;
  displayName: string;
  isEnabled: boolean;
  tone: string;
  modelProvider: string;
  modelId: string;
  systemPrompt: string;
  personality: string;
  identity: string;
  userContext: string;
  welcomeMessage: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  faq: string[];
  activeHours: string;
  simpleRules: string;
  escalationThreshold: string;
  requireApproval: boolean;
  allowedTools: string[];
  missionConfig: {
    source: "serper" | "tavily";
    keywords: string;
    qualificationInstructions: string;
    enrollmentMode: "none";
    defaultSector: string;
    defaultZone: string;
    defaultTargetCount: number;
  };
  createdAt: string;
  updatedAt: string;
};

type SaasSubscription = {
  id: string;
  companyId: string;
  moduleKey: ModuleKey;
  planName: string;
  monthlyPrice: number;
  currency: "XOF";
  status: SubscriptionStatus;
  startDate: string;
  nextBillingDate: string;
  lastPaymentDate?: string;
  lastInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
};

type SaasInvoice = {
  id: string;
  companyId: string;
  subscriptionId: string;
  moduleKey: ModuleKey;
  number: string;
  amount: number;
  currency: "XOF";
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  issuedAt: string;
  paidAt?: string;
  createdAt: string;
};

type SaasCrmLead = {
  id: string;
  companyId: string;
  name: string;
  company: string;
  source: string;
  score: number;
  status: LeadStatus;
  updatedAt: string;
};

type SaasSourcingRun = {
  id: string;
  companyId: string;
  moduleKey: Extract<ModuleKey, "sourcing-commercial">;
  sessionId?: string;
  cycleIndex?: number;
  agentKey: string;
  agentName: string;
  objective: string;
  brief: string;
  sector: string;
  zone: string;
  targetCount: number;
  foundCount: number;
  status: SourcingRunStatus;
  providerMode: SearchProviderMode;
  providers: {
    serperConfigured: boolean;
    tavilyConfigured: boolean;
  };
  prospects: Array<{
    id: string;
    name: string;
    company: string;
    website: string;
    email?: string;
    phone?: string;
    snippet: string;
    summary: string;
    source: "serper" | "tavily";
    score: number;
    pushedToCrmAt?: string;
    crmLeadId?: string;
  }>;
  error?: string;
  createdAt: string;
};

type SaasSourcingSession = {
  id: string;
  companyId: string;
  moduleKey: Extract<ModuleKey, "sourcing-commercial">;
  status: SourcingLiveSessionStatus;
  startedAt: string;
  updatedAt: string;
  stoppedAt?: string;
  activeAgentKeys: string[];
  pausedAgentKeys?: string[];
  brief?: string;
  agentBriefs?: Partial<Record<"sourcing-serper" | "sourcing-tavily", string>>;
  stopReason?: string;
  cycleCount: number;
  lastCycleAt?: string;
  currentAgentKey?: string;
};

type SaasSourcingLiveEvent = {
  id: string;
  sessionId: string;
  companyId: string;
  agentKey?: string;
  agentName?: string;
  type: SourcingLiveEventType;
  level: "info" | "success" | "warning" | "error";
  message: string;
  runId?: string;
  prospectCount?: number;
  createdAt: string;
};

type SaasWhatsAppActivity = {
  id: string;
  companyId: string;
  moduleKey: Extract<ModuleKey, "whatsapp-business">;
  contactName: string;
  lastMessage: string;
  direction: "inbound" | "outbound";
  status: WhatsAppConversationStatus;
  updatedAt: string;
};

type SaasWhatsAppBinding = {
  id: string;
  companyId: string;
  sessionId: string;
  mode: WhatsAppSessionMode;
  label: string;
  createdAt: string;
  updatedAt: string;
};

type SaasWhatsAppMetaConfig = {
  id: string;
  companyId: string;
  sessionId: string;
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  displayPhoneNumber: string;
  createdAt: string;
  updatedAt: string;
};

type SaasWhatsAppSettings = {
  id: string;
  companyId: string;
  awayMessage: string;
  preferredConnectionMode: WhatsAppSessionMode;
  createdAt: string;
  updatedAt: string;
};

type SourcingPlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  currency: "XOF";
  maxRunsPerMonth: number;
  maxProspectsPerRun: number;
  agents: ("serper" | "tavily")[];
  isActive: boolean;
  isPopular: boolean;
  createdAt: string;
  updatedAt: string;
};

type SourcingGlobalAgent = {
  agentKey: "sourcing-serper" | "sourcing-tavily";
  displayName: string;
  isEnabled: boolean;
  source: "serper" | "tavily";
  modelProvider: string;
  modelId: string;
  defaultKeywords: string;
  qualificationInstructions: string;
  defaultSector: string;
  defaultZone: string;
  defaultTargetCount: number;
  systemPrompt: string;
  personality: string;
  identity: string;
  userContext: string;
  allowedTools: string[];
  updatedAt: string;
};

type SaasEmailConfig = {
  id: string;
  companyId: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  signature: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  smtpValidatedAt?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword: string;
  imapValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;

  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function parseCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getSessionIdFromRequest(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[SAAS_COOKIE] ?? "";
}

function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(SAAS_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/",
    maxAge: SESSION_DURATION_MS
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SAAS_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/"
  });
}

function isModuleKey(value: string): value is ModuleKey {
  return moduleCatalog.some((module) => module.key === value);
}

function moduleByKey(moduleKey: ModuleKey) {
  return moduleCatalog.find((item) => item.key === moduleKey)!;
}

function normalizeModuleKeys(raw: unknown) {
  if (!Array.isArray(raw)) return [] as ModuleKey[];
  const unique = new Set<ModuleKey>();
  for (const value of raw) {
    if (typeof value === "string" && isModuleKey(value)) {
      unique.add(value);
    }
  }
  return Array.from(unique);
}

function isAccessibleSubscriptionStatus(status: SubscriptionStatus) {
  return status === "active";
}

const sourcingAuthRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Trop de tentatives. Reessayez dans quelques minutes.",
  keyPrefix: "sourcing-auth"
});

function parseModuleActivation(value: unknown): SaasModuleActivation | null {
  if (!isObject(value)) return null;
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const active = typeof value.active === "boolean" ? value.active : false;
  const activatedAt = typeof value.activatedAt === "string" ? value.activatedAt : "";
  if (!isModuleKey(moduleKey) || !activatedAt) return null;
  return { moduleKey, active, activatedAt };
}

function parseCompany(value: unknown): SaasCompany | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  const slug = typeof value.slug === "string" ? value.slug : "";
  const ownerEmail = typeof value.ownerEmail === "string" ? value.ownerEmail : "";
  const description = typeof value.description === "string" ? value.description : "";
  const businessEmail = typeof value.businessEmail === "string" ? value.businessEmail : "";
  const businessPhone = typeof value.businessPhone === "string" ? value.businessPhone : "";
  const industry = typeof value.industry === "string" ? value.industry : "";
  const serviceCatalog = typeof value.serviceCatalog === "string" ? value.serviceCatalog : "";
  const targetCustomers = typeof value.targetCustomers === "string" ? value.targetCustomers : "";
  const agentSkills = Array.isArray(value.agentSkills)
    ? value.agentSkills.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
  const agentInstructions = typeof value.agentInstructions === "string" ? value.agentInstructions : "";
  const status = value.status === "inactive" ? "inactive" : "active";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  const modules = Array.isArray(value.modules)
    ? value.modules.map(parseModuleActivation).filter((item): item is SaasModuleActivation => Boolean(item))
    : [];

  if (!id || !name || !slug || !ownerEmail || !createdAt || !updatedAt) return null;
  return {
    id,
    name,
    slug,
    ownerEmail,
    description,
    businessEmail,
    businessPhone,
    industry,
    serviceCatalog,
    targetCustomers,
    agentSkills,
    agentInstructions,
    status,
    modules,
    createdAt,
    updatedAt
  };
}

function parseUser(value: unknown): SaasUser | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const name = typeof value.name === "string" ? value.name : "";
  const email = typeof value.email === "string" ? value.email : "";
  const passwordHash = typeof value.passwordHash === "string" ? value.passwordHash : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const verifiedAt =
    typeof value.verifiedAt === "string"
      ? value.verifiedAt
      : Object.prototype.hasOwnProperty.call(value, "verifiedAt")
        ? ""
        : createdAt;
  const role = value.role === "member" ? "member" : "owner";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !name || !email || !passwordHash || !createdAt || !updatedAt) return null;
  return {
    id,
    companyId,
    name,
    email,
    passwordHash,
    verifiedAt,
    role,
    createdAt,
    updatedAt
  };
}

function parseSession(value: unknown): SaasSession | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const userId = typeof value.userId === "string" ? value.userId : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : "";
  if (!id || !userId || !companyId || !createdAt || !expiresAt) return null;
  return { id, userId, companyId, createdAt, expiresAt };
}

function parseAgentProfile(value: unknown): SaasAgentProfile | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const agentKey = typeof value.agentKey === "string" ? value.agentKey : "";
  const displayName = typeof value.displayName === "string" ? value.displayName : "";
  const isEnabled = typeof value.isEnabled === "boolean" ? value.isEnabled : true;
  const tone = typeof value.tone === "string" ? value.tone : "";
  const rawModelProvider = typeof value.modelProvider === "string" ? value.modelProvider.trim() : "";
  const hasStoredModelProvider = rawModelProvider.length > 0;
  const modelProvider = hasStoredModelProvider ? rawModelProvider : "openai";
  const modelId = hasStoredModelProvider && typeof value.modelId === "string" ? value.modelId : "";
  const systemPrompt = typeof value.systemPrompt === "string" ? value.systemPrompt : "";
  const personality = typeof value.personality === "string" ? value.personality : "";
  const identity = typeof value.identity === "string" ? value.identity : "";
  const userContext = typeof value.userContext === "string" ? value.userContext : "";
  const welcomeMessage = typeof value.welcomeMessage === "string" ? value.welcomeMessage : "";
  const businessName = typeof value.businessName === "string" ? value.businessName : "";
  const businessEmail = typeof value.businessEmail === "string" ? value.businessEmail : "";
  const businessPhone = typeof value.businessPhone === "string" ? value.businessPhone : "";
  const faq = Array.isArray(value.faq) ? value.faq.map(String).filter(Boolean) : [];
  const activeHours = typeof value.activeHours === "string" ? value.activeHours : "";
  const simpleRules = typeof value.simpleRules === "string" ? value.simpleRules : "";
  const escalationThreshold = typeof value.escalationThreshold === "string" ? value.escalationThreshold : "";
  const requireApproval = Boolean(value.requireApproval);
  const allowedTools = Array.isArray(value.allowedTools) ? value.allowedTools.map(String).filter(Boolean) : [];
  const missionConfig: SaasAgentProfile["missionConfig"] = isObject(value.missionConfig)
    ? {
        source: value.missionConfig.source === "tavily" ? "tavily" : "serper",
        keywords: typeof value.missionConfig.keywords === "string" ? value.missionConfig.keywords : "",
        qualificationInstructions:
          typeof value.missionConfig.qualificationInstructions === "string" ? value.missionConfig.qualificationInstructions : "",
        enrollmentMode: "none" as const,
        defaultSector: typeof value.missionConfig.defaultSector === "string" ? value.missionConfig.defaultSector : "",
        defaultZone: typeof value.missionConfig.defaultZone === "string" ? value.missionConfig.defaultZone : "",
        defaultTargetCount: Math.min(Math.max(Number(value.missionConfig.defaultTargetCount ?? 6), 1), 10)
      }
    : {
        source: "serper" as const,
        keywords: "",
        qualificationInstructions: "",
        enrollmentMode: "none" as const,
        defaultSector: "",
        defaultZone: "",
        defaultTargetCount: 6
      };
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !isModuleKey(moduleKey) || !agentKey || !displayName || !createdAt || !updatedAt) return null;

  return {
    id,
    companyId,
    moduleKey,
    agentKey,
    displayName,
    isEnabled,
    tone,
    modelProvider,
    modelId,
    systemPrompt,
    personality,
    identity,
    userContext,
    welcomeMessage,
    businessName,
    businessEmail,
    businessPhone,
    faq,
    activeHours,
    simpleRules,
    escalationThreshold,
    requireApproval,
    allowedTools,
    missionConfig,
    createdAt,
    updatedAt
  };
}

function parseSubscription(value: unknown): SaasSubscription | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const planName = typeof value.planName === "string" ? value.planName : "";
  const monthlyPrice = typeof value.monthlyPrice === "number" ? value.monthlyPrice : 0;
  const currency = value.currency === "XOF" ? "XOF" : null;
  const status = typeof value.status === "string" ? value.status : "";
  const startDate = typeof value.startDate === "string" ? value.startDate : "";
  const nextBillingDate = typeof value.nextBillingDate === "string" ? value.nextBillingDate : "";
  const lastPaymentDate = typeof value.lastPaymentDate === "string" ? value.lastPaymentDate : undefined;
  const lastInvoiceId = typeof value.lastInvoiceId === "string" ? value.lastInvoiceId : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !isModuleKey(moduleKey) || !planName || !currency || !isSubscriptionStatus(status) || !startDate || !nextBillingDate || !createdAt || !updatedAt) {
    return null;
  }
  return {
    id,
    companyId,
    moduleKey,
    planName,
    monthlyPrice,
    currency,
    status,
    startDate,
    nextBillingDate,
    lastPaymentDate,
    lastInvoiceId,
    createdAt,
    updatedAt
  };
}

function parseInvoice(value: unknown): SaasInvoice | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const subscriptionId = typeof value.subscriptionId === "string" ? value.subscriptionId : "";
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const number = typeof value.number === "string" ? value.number : "";
  const amount = typeof value.amount === "number" ? value.amount : 0;
  const currency = value.currency === "XOF" ? "XOF" : null;
  const status = typeof value.status === "string" ? value.status : "";
  const periodStart = typeof value.periodStart === "string" ? value.periodStart : "";
  const periodEnd = typeof value.periodEnd === "string" ? value.periodEnd : "";
  const dueDate = typeof value.dueDate === "string" ? value.dueDate : "";
  const issuedAt = typeof value.issuedAt === "string" ? value.issuedAt : "";
  const paidAt = typeof value.paidAt === "string" ? value.paidAt : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!id || !companyId || !subscriptionId || !isModuleKey(moduleKey) || !number || !currency || !isInvoiceStatus(status) || !periodStart || !periodEnd || !dueDate || !issuedAt || !createdAt) {
    return null;
  }
  return {
    id,
    companyId,
    subscriptionId,
    moduleKey,
    number,
    amount,
    currency,
    status,
    periodStart,
    periodEnd,
    dueDate,
    issuedAt,
    paidAt,
    createdAt
  };
}

function parseLead(value: unknown): SaasCrmLead | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const name = typeof value.name === "string" ? value.name : "";
  const company = typeof value.company === "string" ? value.company : "";
  const source = typeof value.source === "string" ? value.source : "";
  const score = typeof value.score === "number" ? value.score : 0;
  const status = typeof value.status === "string" ? value.status : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  if (!id || !companyId || !name || !company || !source || !isLeadStatus(status) || !updatedAt) return null;
  return { id, companyId, name, company, source, score, status, updatedAt };
}

function parseSourcingRun(value: unknown): SaasSourcingRun | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const agentKey = typeof value.agentKey === "string" ? value.agentKey : "";
  const agentName = typeof value.agentName === "string" ? value.agentName : "";
  const sessionId = typeof value.sessionId === "string" ? value.sessionId : undefined;
  const cycleIndex = typeof value.cycleIndex === "number" ? value.cycleIndex : undefined;
  const objective = typeof value.objective === "string" ? value.objective : "";
  const brief = typeof value.brief === "string" ? value.brief : "";
  const sector = typeof value.sector === "string" ? value.sector : "";
  const zone = typeof value.zone === "string" ? value.zone : "";
  const targetCount = typeof value.targetCount === "number" ? value.targetCount : 0;
  const foundCount = typeof value.foundCount === "number" ? value.foundCount : 0;
  const status = typeof value.status === "string" ? value.status : "";
  const providerMode = value.providerMode === "live" ? "live" : value.providerMode === "waiting_api" ? "waiting_api" : "waiting_api";
  const providers = isObject(value.providers)
    ? {
        serperConfigured: Boolean(value.providers.serperConfigured),
        tavilyConfigured: Boolean(value.providers.tavilyConfigured)
      }
    : {
        serperConfigured: false,
        tavilyConfigured: false
      };
  const prospects = Array.isArray(value.prospects)
    ? value.prospects.reduce<SaasSourcingRun["prospects"]>((accumulator, item) => {
        if (!isObject(item)) return accumulator;
        const prospectId = typeof item.id === "string" ? item.id : "";
        const name = typeof item.name === "string" ? item.name : "";
        const company = typeof item.company === "string" ? item.company : "";
        const website = typeof item.website === "string" ? item.website : "";
        const email = typeof item.email === "string" ? item.email : "";
        const phone = typeof item.phone === "string" ? item.phone : "";
        const snippet = typeof item.snippet === "string" ? item.snippet : "";
        const summary = typeof item.summary === "string" ? item.summary : "";
        const source = item.source === "tavily" ? "tavily" : item.source === "serper" ? "serper" : null;
        const score = typeof item.score === "number" ? item.score : 0;
        const pushedToCrmAt = typeof item.pushedToCrmAt === "string" ? item.pushedToCrmAt : undefined;
        const crmLeadId = typeof item.crmLeadId === "string" ? item.crmLeadId : undefined;
        if (!prospectId || !name || !company || !source) return accumulator;
        const prospect: SaasSourcingRun["prospects"][number] = {
          id: prospectId,
          name,
          company,
          website,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          snippet,
          summary,
          source,
          score,
          ...(pushedToCrmAt ? { pushedToCrmAt } : {}),
          ...(crmLeadId ? { crmLeadId } : {})
        };
        accumulator.push(prospect);
        return accumulator;
      }, [])
    : [];
  const error = typeof value.error === "string" ? value.error : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (
    !id ||
    !companyId ||
    moduleKey !== "sourcing-commercial" ||
    !agentKey ||
    !agentName ||
    !brief ||
    !isSourcingRunStatus(status) ||
    !createdAt
  ) {
    return null;
  }
  return {
    id,
    companyId,
    moduleKey,
    ...(sessionId ? { sessionId } : {}),
    ...(typeof cycleIndex === "number" ? { cycleIndex } : {}),
    agentKey,
    agentName,
    objective,
    brief,
    sector,
    zone,
    targetCount,
    foundCount,
    status,
    providerMode,
    providers,
    prospects,
    error,
    createdAt
  };
}

function parseSourcingSession(value: unknown): SaasSourcingSession | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const status = typeof value.status === "string" ? value.status : "";
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  const stoppedAt = typeof value.stoppedAt === "string" ? value.stoppedAt : undefined;
  const activeAgentKeys = Array.isArray(value.activeAgentKeys) ? value.activeAgentKeys.map(String).map((item) => item.trim()).filter(Boolean) : [];
  const pausedAgentKeys = Array.isArray(value.pausedAgentKeys) ? value.pausedAgentKeys.map(String).map((item) => item.trim()).filter(Boolean) : [];
  const brief = typeof value.brief === "string" ? value.brief : undefined;
  const agentBriefs = isObject(value.agentBriefs)
    ? {
        ...(typeof value.agentBriefs["sourcing-serper"] === "string" ? { "sourcing-serper": value.agentBriefs["sourcing-serper"] } : {}),
        ...(typeof value.agentBriefs["sourcing-tavily"] === "string" ? { "sourcing-tavily": value.agentBriefs["sourcing-tavily"] } : {})
      }
    : undefined;
  const stopReason = typeof value.stopReason === "string" ? value.stopReason : undefined;
  const cycleCount = typeof value.cycleCount === "number" ? value.cycleCount : 0;
  const lastCycleAt = typeof value.lastCycleAt === "string" ? value.lastCycleAt : undefined;
  const currentAgentKey = typeof value.currentAgentKey === "string" ? value.currentAgentKey : undefined;
  if (!id || !companyId || moduleKey !== "sourcing-commercial" || !isSourcingLiveSessionStatus(status) || !startedAt || !updatedAt) {
    return null;
  }
  return {
    id,
    companyId,
    moduleKey,
    status,
    startedAt,
    updatedAt,
    ...(stoppedAt ? { stoppedAt } : {}),
    activeAgentKeys,
    ...(pausedAgentKeys.length ? { pausedAgentKeys } : {}),
    ...(brief ? { brief } : {}),
    ...(agentBriefs && Object.keys(agentBriefs).length ? { agentBriefs } : {}),
    ...(stopReason ? { stopReason } : {}),
    cycleCount,
    ...(lastCycleAt ? { lastCycleAt } : {}),
    ...(currentAgentKey ? { currentAgentKey } : {})
  };
}

function parseSourcingLiveEvent(value: unknown): SaasSourcingLiveEvent | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const sessionId = typeof value.sessionId === "string" ? value.sessionId : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const agentKey = typeof value.agentKey === "string" ? value.agentKey : undefined;
  const agentName = typeof value.agentName === "string" ? value.agentName : undefined;
  const type = typeof value.type === "string" ? value.type : "";
  const level =
    value.level === "success" || value.level === "warning" || value.level === "error" || value.level === "info"
      ? value.level
      : null;
  const message = typeof value.message === "string" ? value.message : "";
  const runId = typeof value.runId === "string" ? value.runId : undefined;
  const prospectCount = typeof value.prospectCount === "number" ? value.prospectCount : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!id || !sessionId || !companyId || !isSourcingLiveEventType(type) || !level || !message || !createdAt) {
    return null;
  }
  return {
    id,
    sessionId,
    companyId,
    ...(agentKey ? { agentKey } : {}),
    ...(agentName ? { agentName } : {}),
    type,
    level,
    message,
    ...(runId ? { runId } : {}),
    ...(typeof prospectCount === "number" ? { prospectCount } : {}),
    createdAt
  };
}

function parseWhatsAppActivity(value: unknown): SaasWhatsAppActivity | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const moduleKey = typeof value.moduleKey === "string" ? value.moduleKey : "";
  const contactName = typeof value.contactName === "string" ? value.contactName : "";
  const lastMessage = typeof value.lastMessage === "string" ? value.lastMessage : "";
  const direction = value.direction === "outbound" ? "outbound" : value.direction === "inbound" ? "inbound" : "";
  const status = typeof value.status === "string" ? value.status : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  if (!id || !companyId || moduleKey !== "whatsapp-business" || !contactName || !lastMessage || !direction || !isWhatsAppConversationStatus(status) || !updatedAt) {
    return null;
  }
  return { id, companyId, moduleKey, contactName, lastMessage, direction, status, updatedAt };
}

function parseWhatsAppBinding(value: unknown): SaasWhatsAppBinding | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const sessionId = typeof value.sessionId === "string" ? value.sessionId : "";
  const mode = value.mode === "cloud" ? "cloud" : value.mode === "baileys" ? "baileys" : "";
  const label = typeof value.label === "string" ? value.label : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !sessionId || !mode || !createdAt || !updatedAt) return null;
  return { id, companyId, sessionId, mode, label, createdAt, updatedAt };
}

function parseWhatsAppMetaConfig(value: unknown): SaasWhatsAppMetaConfig | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const sessionId = typeof value.sessionId === "string" ? value.sessionId : "";
  const accessToken = typeof value.accessToken === "string" ? value.accessToken : "";
  const phoneNumberId = typeof value.phoneNumberId === "string" ? value.phoneNumberId : "";
  const verifyToken = typeof value.verifyToken === "string" ? value.verifyToken : "";
  const displayPhoneNumber = typeof value.displayPhoneNumber === "string" ? value.displayPhoneNumber : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !sessionId || !accessToken || !phoneNumberId || !verifyToken || !createdAt || !updatedAt) return null;
  return { id, companyId, sessionId, accessToken, phoneNumberId, verifyToken, displayPhoneNumber, createdAt, updatedAt };
}

function parseWhatsAppSettings(value: unknown): SaasWhatsAppSettings | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const awayMessage = typeof value.awayMessage === "string" ? value.awayMessage : "";
  const preferredConnectionMode = value.preferredConnectionMode === "cloud" ? "cloud" : "baileys";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !createdAt || !updatedAt) return null;
  return { id, companyId, awayMessage, preferredConnectionMode, createdAt, updatedAt };
}

function parseEmailConfig(value: unknown): SaasEmailConfig | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const companyId = typeof value.companyId === "string" ? value.companyId : "";
  const senderName = typeof value.senderName === "string" ? value.senderName : "";
  const senderEmail = typeof value.senderEmail === "string" ? value.senderEmail : "";
  const replyToEmail = typeof value.replyToEmail === "string" ? value.replyToEmail : "";
  const signature = typeof value.signature === "string" ? value.signature : "";
  const smtpHost = typeof value.smtpHost === "string" ? value.smtpHost : "";
  const smtpPort = typeof value.smtpPort === "number" ? value.smtpPort : 587;
  const smtpSecure = typeof value.smtpSecure === "boolean" ? value.smtpSecure : false;
  const smtpUsername = typeof value.smtpUsername === "string" ? value.smtpUsername : "";
  const smtpPassword = typeof value.smtpPassword === "string" ? value.smtpPassword : "";
  const smtpValidatedAt = typeof value.smtpValidatedAt === "string" ? value.smtpValidatedAt : undefined;
  const imapHost = typeof value.imapHost === "string" ? value.imapHost : "";
  const imapPort = typeof value.imapPort === "number" ? value.imapPort : 993;
  const imapSecure = typeof value.imapSecure === "boolean" ? value.imapSecure : true;
  const imapUsername = typeof value.imapUsername === "string" ? value.imapUsername : "";
  const imapPassword = typeof value.imapPassword === "string" ? value.imapPassword : "";
  const imapValidatedAt = typeof value.imapValidatedAt === "string" ? value.imapValidatedAt : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !companyId || !createdAt || !updatedAt) return null;
  return {
    id,
    companyId,
    senderName,
    senderEmail,
    replyToEmail,
    signature,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUsername,
    smtpPassword,
    smtpValidatedAt,
    imapHost,
    imapPort,
    imapSecure,
    imapUsername,
    imapPassword,
    imapValidatedAt,
    createdAt,
    updatedAt
  };
}

function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return ["trial", "active", "past_due", "paused", "cancelled"].includes(value);
}

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return ["draft", "sent", "paid", "overdue"].includes(value);
}

function isLeadStatus(value: string): value is LeadStatus {
  return ["new", "warm", "hot", "won"].includes(value);
}

function isSourcingRunStatus(value: string): value is SourcingRunStatus {
  return ["draft", "running", "completed"].includes(value);
}

function isSourcingLiveSessionStatus(value: string): value is SourcingLiveSessionStatus {
  return ["idle", "running", "paused", "stopped", "blocked", "completed"].includes(value);
}

function isSourcingLiveEventType(value: string): value is SourcingLiveEventType {
  return [
    "session_started",
    "session_stopped",
    "session_paused",
    "session_resumed",
    "cycle_started",
    "cycle_completed",
    "prospects_retained",
    "prospect_rejected",
    "quota_reached",
    "provider_error",
    "agent_blocked",
    "no_results"
  ].includes(value);
}

function isWhatsAppConversationStatus(value: string): value is WhatsAppConversationStatus {
  return ["open", "pending", "qualified"].includes(value);
}

function slugifyCompanyName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function agentRank(agentKey: string) {
  if (agentKey === "sourcing-serper") return 0;
  if (agentKey === "sourcing-tavily") return 1;
  return 2;
}

function agentLabel(agentKey: string) {
  if (agentKey === "sourcing-serper") return "Agent Découverte";
  if (agentKey === "sourcing-tavily") return "Agent Qualification";
  return "Agent sourcing";
}

function addDays(source: string | Date, days: number) {
  const next = new Date(source);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

async function loadStoredArray<T>(key: string, parser: (value: unknown) => T | null) {
  const stored = await prisma.appSetting.findUnique({ where: { key } }).catch(() => null);
  if (!stored) return [] as T[];
  const raw: unknown[] = Array.isArray(stored.value) ? stored.value : [];
  return raw.map(parser).filter((item: T | null): item is T => Boolean(item));
}

async function saveStoredArray<T>(key: string, items: T[]) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: items as unknown as object },
    create: { key, value: items as unknown as object }
  });
}

function parseSourcingPlan(value: unknown): SourcingPlan | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  const description = typeof value.description === "string" ? value.description : "";
  const monthlyPrice = typeof value.monthlyPrice === "number" ? value.monthlyPrice : 0;
  const maxRunsPerMonth = typeof value.maxRunsPerMonth === "number" ? value.maxRunsPerMonth : 10;
  const maxProspectsPerRun = typeof value.maxProspectsPerRun === "number" ? value.maxProspectsPerRun : 20;
  const agents = Array.isArray(value.agents)
    ? (value.agents as unknown[]).filter((a): a is "serper" | "tavily" => a === "serper" || a === "tavily")
    : (["serper"] as ("serper" | "tavily")[]);
  const isActive = typeof value.isActive === "boolean" ? value.isActive : true;
  const isPopular = typeof value.isPopular === "boolean" ? value.isPopular : false;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  if (!id || !name || !createdAt) return null;
  return { id, name, description, monthlyPrice, currency: "XOF", maxRunsPerMonth, maxProspectsPerRun, agents, isActive, isPopular, createdAt, updatedAt };
}

function parseSourcingGlobalAgent(value: unknown): SourcingGlobalAgent | null {
  if (!isObject(value)) return null;
  const agentKey =
    value.agentKey === "sourcing-serper" ? "sourcing-serper" : value.agentKey === "sourcing-tavily" ? "sourcing-tavily" : null;
  if (!agentKey) return null;
  const rawDisplayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
  const displayName =
    rawDisplayName && rawDisplayName !== "Agent Serper" && rawDisplayName !== "Agent Tavily"
      ? rawDisplayName
      : agentKey === "sourcing-serper"
        ? "Agent Découverte"
        : "Agent Qualification";
  const isEnabled = typeof value.isEnabled === "boolean" ? value.isEnabled : true;
  const source: "serper" | "tavily" = agentKey === "sourcing-serper" ? "serper" : "tavily";
  const rawModelProvider = typeof value.modelProvider === "string" ? value.modelProvider.trim() : "";
  const hasStoredModelProvider = rawModelProvider.length > 0;
  const modelProvider = hasStoredModelProvider
    ? rawModelProvider
    : agentKey === "sourcing-serper"
      ? "openai"
      : "claude";
  const defaultKeywords = typeof value.defaultKeywords === "string" ? value.defaultKeywords : "";
  const qualificationInstructions = typeof value.qualificationInstructions === "string" ? value.qualificationInstructions : "";
  const defaultSector = typeof value.defaultSector === "string" ? value.defaultSector : "";
  const defaultZone = typeof value.defaultZone === "string" ? value.defaultZone : "";
  const defaultTargetCount = typeof value.defaultTargetCount === "number" ? value.defaultTargetCount : 20;
  const modelId = hasStoredModelProvider && typeof value.modelId === "string" && value.modelId ? value.modelId : "";
  const systemPrompt =
    typeof value.systemPrompt === "string" && value.systemPrompt
      ? value.systemPrompt
      : agentKey === "sourcing-serper"
        ? "Tu es l'agent Serper. Tu trouves rapidement des entreprises, annuaires et pages utiles depuis la recherche web publique. Tu privilegies la decouverte rapide et la pertinence locale."
        : "Tu es l'agent Tavily. Tu analyses les pages trouvees, extrais les signaux utiles et qualifies les prospects avec plus de profondeur. Tu ne resumes que ce qui est visible dans les sources reelles.";
  const personality =
    typeof value.personality === "string" && value.personality
      ? value.personality
      : agentKey === "sourcing-serper"
        ? "Rapide, methodique, oriente decouverte et tri initial."
        : "Analytique, rigoureux, oriente qualification et synthese.";
  const identity =
    typeof value.identity === "string" && value.identity
      ? value.identity
      : agentKey === "sourcing-serper"
        ? "Template global Serper pour ouvrir le terrain et proposer une premiere liste de prospects."
        : "Template global Tavily pour enrichir les pistes et mettre en avant les meilleurs prospects.";
  const userContext =
    typeof value.userContext === "string" && value.userContext
      ? value.userContext
      : agentKey === "sourcing-serper"
        ? "Tu identifies des pistes web visibles et prepares une premiere selection exploitable."
        : "Tu lis les contenus publics, resumes les points utiles et aides a prioriser les prospects.";
  const allowedTools = Array.isArray(value.allowedTools)
    ? value.allowedTools.map(String).map((entry) => entry.trim()).filter(Boolean)
    : agentKey === "sourcing-serper"
      ? ["webScraper", "searchKnowledge"]
      : ["webScraper", "searchKnowledge", "summarizeThread"];
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString();
  return {
    agentKey,
    displayName,
    isEnabled,
    source,
    modelProvider,
    modelId,
    defaultKeywords,
    qualificationInstructions,
    defaultSector,
    defaultZone,
    defaultTargetCount,
    systemPrompt,
    personality,
    identity,
    userContext,
    allowedTools,
    updatedAt
  };
}

const loadSourcingPlans = () => loadStoredArray(SAAS_SOURCING_PLANS_KEY, parseSourcingPlan);
const saveSourcingPlans = (items: SourcingPlan[]) => saveStoredArray(SAAS_SOURCING_PLANS_KEY, items);
const loadGlobalAgentsRaw = () => loadStoredArray(SAAS_GLOBAL_AGENTS_KEY, parseSourcingGlobalAgent);
const saveGlobalAgents = (items: SourcingGlobalAgent[]) => saveStoredArray(SAAS_GLOBAL_AGENTS_KEY, items);

function preferNonEmptyString(value: string | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function mergeGlobalAgentTemplate(base: SourcingGlobalAgent, existing: SourcingGlobalAgent | undefined) {
  if (!existing) return base;
  return {
    ...base,
    ...existing,
    displayName: preferNonEmptyString(existing.displayName, base.displayName),
    source: existing.source || base.source,
    modelProvider: preferNonEmptyString(existing.modelProvider, base.modelProvider),
    modelId: preferNonEmptyString(existing.modelId, base.modelId),
    defaultKeywords: preferNonEmptyString(existing.defaultKeywords, base.defaultKeywords),
    qualificationInstructions: preferNonEmptyString(existing.qualificationInstructions, base.qualificationInstructions),
    defaultSector: typeof existing.defaultSector === "string" ? existing.defaultSector : base.defaultSector,
    defaultZone: typeof existing.defaultZone === "string" ? existing.defaultZone : base.defaultZone,
    defaultTargetCount:
      typeof existing.defaultTargetCount === "number" && existing.defaultTargetCount > 0
        ? existing.defaultTargetCount
        : base.defaultTargetCount,
    systemPrompt: preferNonEmptyString(existing.systemPrompt, base.systemPrompt),
    personality: preferNonEmptyString(existing.personality, base.personality),
    identity: preferNonEmptyString(existing.identity, base.identity),
    userContext: preferNonEmptyString(existing.userContext, base.userContext),
    allowedTools: Array.isArray(existing.allowedTools) && existing.allowedTools.length ? existing.allowedTools : base.allowedTools,
    updatedAt: preferNonEmptyString(existing.updatedAt, base.updatedAt)
  };
}

async function getGlobalAgents(): Promise<SourcingGlobalAgent[]> {
  const stored = await loadGlobalAgentsRaw();
  const now = new Date().toISOString();
  const defaults: SourcingGlobalAgent[] = [
    {
      agentKey: "sourcing-serper",
      displayName: "Agent Découverte",
      isEnabled: true,
      source: "serper",
      modelProvider: "openai",
      modelId: "",
      defaultKeywords:
        "entreprise, societe, PME, B2B, services, commerce, industrie, logistique, immobilier, sante, education, distribution, site officiel, page contact, telephone, email, WhatsApp, dirigeant, gerant, responsable",
      qualificationInstructions:
        "Trouver rapidement des entreprises reelles et actives correspondant a la demande du client. Privilegier les sites officiels, pages contact, pages services et coordonnees visibles. Exclure annuaires, blogs, actualites, offres d'emploi, comparateurs, agregateurs et pages sans identite claire. Ne rien inventer et dedoublonner les resultats.",
      defaultSector: "",
      defaultZone: "",
      defaultTargetCount: 12,
      systemPrompt:
        "Tu es Agent Decouverte. Tu transformes le brief du client en recherche web efficace pour trouver rapidement de vraies entreprises pertinentes. Tu explores large mais tu gardes une exigence minimale de qualite: entreprise reelle, activite claire, presence web exploitable et contact visible si possible. Tu n'inventes jamais d'informations et tu rejettes les pages parasites.",
      personality: "Rapide, methodique, opportuniste mais propre, oriente volume utile et tri initial.",
      identity: "Template produit de decouverte rapide pour ouvrir le terrain sur des secteurs, pays et villes varies.",
      userContext:
        "Tu t'adaptes a toute demande client en combinant le brief, le secteur, la zone et les signaux visibles sur le web pour produire une premiere selection exploitable.",
      allowedTools: ["webScraper", "searchKnowledge"],
      updatedAt: now
    },
    {
      agentKey: "sourcing-tavily",
      displayName: "Agent Qualification",
      isEnabled: true,
      source: "tavily",
      modelProvider: "claude",
      modelId: "",
      defaultKeywords:
        "site officiel, services, a propos, equipe, contact, email, telephone, WhatsApp, clients, references, cas d'usage, coordonnees, presence digitale, decisionnaire",
      qualificationInstructions:
        "Analyser en profondeur les pistes trouvees et ne retenir que les prospects credibles et commercialement utiles. Verifier l'activite reelle, la clarte des services, la presence de coordonnees, la coherence geographique et les signaux de serieux. Ecarter les pages d'information generale, contenus editoriaux, annuaires, offres d'emploi, agregateurs et structures peu claires. Prioriser les prospects faciles a contacter et adaptes au besoin du client.",
      defaultSector: "",
      defaultZone: "",
      defaultTargetCount: 8,
      systemPrompt:
        "Tu es Agent Qualification. Tu prends un brief client et des pistes web, puis tu analyses les pages publiques pour retenir les prospects les plus serieux. Tu privilegies la precision, la verification et la priorisation. Tu ne confirmes que ce qui est visible dans les sources reelles, tu rejettes les signaux faibles et tu n'inventes jamais.",
      personality: "Analytique, rigoureux, selectif, oriente verification et priorisation.",
      identity: "Template produit de qualification approfondie pour transformer des pistes en prospects credibles, quel que soit le secteur.",
      userContext:
        "Tu t'adaptes a toute demande client en evaluant la qualite reelle du prospect, son adequation au besoin et la facilite de prise de contact.",
      allowedTools: ["webScraper", "searchKnowledge", "summarizeThread"],
      updatedAt: now
    }
  ];
  return defaults.map((def) => mergeGlobalAgentTemplate(def, stored.find((s) => s.agentKey === def.agentKey)));
}

const loadCompanies = () => loadStoredArray(SAAS_COMPANIES_KEY, parseCompany);
const saveCompanies = (items: SaasCompany[]) => saveStoredArray(SAAS_COMPANIES_KEY, items);
const loadUsers = () => loadStoredArray(SAAS_USERS_KEY, parseUser);
const saveUsers = (items: SaasUser[]) => saveStoredArray(SAAS_USERS_KEY, items);

type PasswordResetToken = { id: string; userId: string; email: string; expiresAt: string };
type EmailVerifyToken = { id: string; userId: string; email: string; expiresAt: string };

// ─── Paiement manuel Wave / Orange Money ───────────────────────────────────

type PaymentMethods = {
  waveNumber: string;
  waveHolder: string;
  orangeMoneyNumber: string;
  orangeMoneyHolder: string;
  instructions: string;
};

type PaymentRequest = {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyName: string;
  planId: string;
  planName: string;
  amount: number;
  method: "wave" | "orange_money";
  senderPhone: string;
  reference: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
};

type PublicPaymentRequest = {
  id: string;
  planId: string;
  planName: string;
  amount: number;
  method: "wave" | "orange_money";
  senderPhone: string;
  reference: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

async function loadPaymentMethods(): Promise<PaymentMethods> {
  const raw = await prisma.appSetting.findUnique({ where: { key: SAAS_PAYMENT_METHODS_KEY } });
  if (!raw?.value) return { waveNumber: "", waveHolder: "", orangeMoneyNumber: "", orangeMoneyHolder: "", instructions: "" };
  try {
    const parsed = JSON.parse(raw.value as string) as Partial<PaymentMethods>;
    return {
      waveNumber: parsed.waveNumber ?? "",
      waveHolder: parsed.waveHolder ?? "",
      orangeMoneyNumber: parsed.orangeMoneyNumber ?? "",
      orangeMoneyHolder: parsed.orangeMoneyHolder ?? "",
      instructions: parsed.instructions ?? ""
    };
  } catch { return { waveNumber: "", waveHolder: "", orangeMoneyNumber: "", orangeMoneyHolder: "", instructions: "" }; }
}

async function savePaymentMethods(methods: PaymentMethods): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SAAS_PAYMENT_METHODS_KEY },
    create: { key: SAAS_PAYMENT_METHODS_KEY, value: JSON.stringify(methods) },
    update: { value: JSON.stringify(methods) }
  });
}

function parsePaymentRequest(value: unknown): PaymentRequest | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.companyId !== "string" || typeof v.planId !== "string") return null;
  return {
    id: v.id,
    companyId: v.companyId as string,
    userId: typeof v.userId === "string" ? v.userId : "",
    userName: typeof v.userName === "string" ? v.userName : "",
    userEmail: typeof v.userEmail === "string" ? v.userEmail : "",
    companyName: typeof v.companyName === "string" ? v.companyName : "",
    planId: v.planId as string,
    planName: typeof v.planName === "string" ? v.planName : "",
    amount: typeof v.amount === "number" ? v.amount : 0,
    method: v.method === "orange_money" ? "orange_money" : "wave",
    senderPhone: typeof v.senderPhone === "string" ? v.senderPhone : "",
    reference: typeof v.reference === "string" ? v.reference : "",
    status: v.status === "approved" ? "approved" : v.status === "rejected" ? "rejected" : "pending",
    rejectionReason: typeof v.rejectionReason === "string" ? v.rejectionReason : undefined,
    createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : ""
  };
}

const loadPaymentRequests = () => loadStoredArray<PaymentRequest>(SAAS_PAYMENT_REQUESTS_KEY, parsePaymentRequest);
const savePaymentRequests = (items: PaymentRequest[]) => saveStoredArray(SAAS_PAYMENT_REQUESTS_KEY, items);;

function toPublicPaymentRequest(request: PaymentRequest): PublicPaymentRequest {
  return {
    id: request.id,
    planId: request.planId,
    planName: request.planName,
    amount: request.amount,
    method: request.method,
    senderPhone: request.senderPhone,
    reference: request.reference,
    status: request.status,
    rejectionReason: request.rejectionReason ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}

function isResetToken(v: unknown): v is PasswordResetToken {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.userId === "string" && typeof o.email === "string" && typeof o.expiresAt === "string";
}
const loadResetTokens = () => loadStoredArray(SAAS_RESET_TOKENS_KEY, (v) => isResetToken(v) ? v : null);
const saveResetTokens = (items: PasswordResetToken[]) => saveStoredArray(SAAS_RESET_TOKENS_KEY, items);
function isVerifyToken(v: unknown): v is EmailVerifyToken {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.userId === "string" && typeof o.email === "string" && typeof o.expiresAt === "string";
}
const loadVerifyTokens = () => loadStoredArray(SAAS_VERIFY_TOKENS_KEY, (v) => isVerifyToken(v) ? v : null);
const saveVerifyTokens = (items: EmailVerifyToken[]) => saveStoredArray(SAAS_VERIFY_TOKENS_KEY, items);
const loadAgentProfiles = () => loadStoredArray(SAAS_AGENT_PROFILES_KEY, parseAgentProfile);
const saveAgentProfiles = (items: SaasAgentProfile[]) => saveStoredArray(SAAS_AGENT_PROFILES_KEY, items);
const loadSubscriptions = () => loadStoredArray(SAAS_SUBSCRIPTIONS_KEY, parseSubscription);
const saveSubscriptions = (items: SaasSubscription[]) => saveStoredArray(SAAS_SUBSCRIPTIONS_KEY, items);
const loadInvoices = () => loadStoredArray(SAAS_INVOICES_KEY, parseInvoice);
const saveInvoices = (items: SaasInvoice[]) => saveStoredArray(SAAS_INVOICES_KEY, items);
const loadCrmLeads = () => loadStoredArray(SAAS_CRM_LEADS_KEY, parseLead);
const saveCrmLeads = (items: SaasCrmLead[]) => saveStoredArray(SAAS_CRM_LEADS_KEY, items);
const loadSourcingRuns = () => loadStoredArray(SAAS_SOURCING_RUNS_KEY, parseSourcingRun);
const saveSourcingRuns = (items: SaasSourcingRun[]) => saveStoredArray(SAAS_SOURCING_RUNS_KEY, items);
const loadSourcingLiveSessions = () => loadStoredArray(SAAS_SOURCING_LIVE_SESSIONS_KEY, parseSourcingSession);
const saveSourcingLiveSessions = (items: SaasSourcingSession[]) => saveStoredArray(SAAS_SOURCING_LIVE_SESSIONS_KEY, items);
const loadSourcingLiveEvents = () => loadStoredArray(SAAS_SOURCING_LIVE_EVENTS_KEY, parseSourcingLiveEvent);
const saveSourcingLiveEvents = (items: SaasSourcingLiveEvent[]) => saveStoredArray(SAAS_SOURCING_LIVE_EVENTS_KEY, items);
const loadWhatsAppActivity = () => loadStoredArray(SAAS_WHATSAPP_ACTIVITY_KEY, parseWhatsAppActivity);
const saveWhatsAppActivity = (items: SaasWhatsAppActivity[]) => saveStoredArray(SAAS_WHATSAPP_ACTIVITY_KEY, items);
const loadWhatsAppBindings = () => loadStoredArray(SAAS_WHATSAPP_BINDINGS_KEY, parseWhatsAppBinding);
const saveWhatsAppBindings = (items: SaasWhatsAppBinding[]) => saveStoredArray(SAAS_WHATSAPP_BINDINGS_KEY, items);
const loadWhatsAppMetaConfigs = () => loadStoredArray(SAAS_WHATSAPP_META_CONFIGS_KEY, parseWhatsAppMetaConfig);
const saveWhatsAppMetaConfigs = (items: SaasWhatsAppMetaConfig[]) => saveStoredArray(SAAS_WHATSAPP_META_CONFIGS_KEY, items);
const loadWhatsAppSettings = () => loadStoredArray(SAAS_WHATSAPP_SETTINGS_KEY, parseWhatsAppSettings);
const saveWhatsAppSettings = (items: SaasWhatsAppSettings[]) => saveStoredArray(SAAS_WHATSAPP_SETTINGS_KEY, items);
const loadEmailConfigs = () => loadStoredArray(SAAS_EMAIL_CONFIGS_KEY, parseEmailConfig);
const saveEmailConfigs = (items: SaasEmailConfig[]) => saveStoredArray(SAAS_EMAIL_CONFIGS_KEY, items);

async function loadSessions() {
  const sessions = await loadStoredArray(SAAS_SESSIONS_KEY, parseSession);
  const now = Date.now();
  return sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
}

async function saveSessions(items: SaasSession[]) {
  await saveStoredArray(SAAS_SESSIONS_KEY, items);
}

const sourcingLiveTimers = new Map<string, NodeJS.Timeout>();
const sourcingLiveLocks = new Set<string>();
const SOURCING_LIVE_INTERVAL_MS = Math.max(Number(process.env.SOURCING_LIVE_INTERVAL_MS ?? 15000), 5000);
const SOURCING_LIVE_EVENTS_LIMIT = 300;

function getCurrentMonthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function buildProspectDedupKey(prospect: { website?: string; company?: string; name?: string }) {
  return normalizeSearchText(prospect.website || prospect.company || prospect.name || "");
}

function getCurrentLiveSession(sessions: SaasSourcingSession[]) {
  return (
    sessions
      .filter((session) => session.status === "running" || session.status === "paused")
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null
  );
}

async function appendSourcingLiveEvent(event: SaasSourcingLiveEvent) {
  const events = await loadSourcingLiveEvents();
  const nextEvents = [event, ...events]
    .filter((entry, index, collection) => index === collection.findIndex((candidate) => candidate.id === entry.id))
    .slice(0, SOURCING_LIVE_EVENTS_LIMIT);
  await saveSourcingLiveEvents(nextEvents);
}

async function saveSourcingLiveSession(session: SaasSourcingSession) {
  const sessions = await loadSourcingLiveSessions();
  const nextSessions = [session, ...sessions.filter((item) => item.id !== session.id)];
  await saveSourcingLiveSessions(nextSessions);
}

async function updateSourcingLiveSession(
  sessionId: string,
  mutate: (session: SaasSourcingSession) => SaasSourcingSession | null
) {
  const sessions = await loadSourcingLiveSessions();
  const current = sessions.find((session) => session.id === sessionId) ?? null;
  if (!current) return null;
  const next = mutate(current);
  if (!next) return null;
  const nextSessions = sessions.map((session) => (session.id === sessionId ? next : session));
  await saveSourcingLiveSessions(nextSessions);
  return next;
}

function clearSourcingLiveTimer(sessionId: string) {
  const timer = sourcingLiveTimers.get(sessionId);
  if (timer) clearTimeout(timer);
  sourcingLiveTimers.delete(sessionId);
}

function scheduleSourcingLiveTick(sessionId: string, delayMs = SOURCING_LIVE_INTERVAL_MS) {
  clearSourcingLiveTimer(sessionId);
  const timer = setTimeout(() => {
    void processSourcingLiveSession(sessionId);
  }, delayMs);
  sourcingLiveTimers.set(sessionId, timer);
}

async function resolveSourcingPlanLimits(subscription: SaasSubscription | null) {
  if (!subscription) return null;
  const allPlans = await loadSourcingPlans();
  const subPlanName = (subscription as { planName?: string }).planName ?? "";
  const matchedPlan = allPlans.find((plan) => plan.name.toLowerCase() === subPlanName.toLowerCase() || plan.id === subPlanName) ?? null;
  if (!matchedPlan) return null;
  return {
    planName: matchedPlan.name,
    maxRunsPerMonth: matchedPlan.maxRunsPerMonth,
    maxProspectsPerRun: matchedPlan.maxProspectsPerRun
  };
}

function computeSourcingQuota(
  runs: SaasSourcingRun[],
  planLimits: { planName: string; maxRunsPerMonth: number; maxProspectsPerRun: number } | null,
  options?: {
    accessible?: boolean;
    prospectsKeptThisMonth?: number;
  }
) {
  const monthStart = getCurrentMonthStartIso();
  const runsThisMonth = runs.filter((run) => run.createdAt >= monthStart).length;
  const runsRemaining = planLimits ? Math.max(planLimits.maxRunsPerMonth - runsThisMonth, 0) : null;
  const accessible = options?.accessible ?? true;
  const prospectsKeptThisMonth = options?.prospectsKeptThisMonth ?? 0;
  return {
    planName: planLimits?.planName ?? null,
    maxRunsPerMonth: planLimits?.maxRunsPerMonth ?? null,
    maxProspectsPerRun: planLimits?.maxProspectsPerRun ?? null,
    runsThisMonth,
    runsRemaining,
    monthlyRunLimit: planLimits?.maxRunsPerMonth ?? null,
    monthlyRunsUsed: runsThisMonth,
    monthlyRunsRemaining: runsRemaining,
    monthlyProspectsKept: prospectsKeptThisMonth,
    canRun: accessible && (runsRemaining === null || runsRemaining > 0)
  };
}

async function stopSourcingLiveSession(
  sessionId: string,
  status: Extract<SourcingLiveSessionStatus, "stopped" | "blocked" | "completed">,
  reason: string,
  eventType: Extract<SourcingLiveEventType, "session_stopped" | "quota_reached" | "provider_error">
) {
  clearSourcingLiveTimer(sessionId);
  const updated = await updateSourcingLiveSession(sessionId, (session) => ({
    ...session,
    status,
    activeAgentKeys: [],
    pausedAgentKeys: [],
    stopReason: reason,
    stoppedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentAgentKey: undefined
  }));
  if (updated) {
    await appendSourcingLiveEvent({
      id: randomUUID(),
      sessionId: updated.id,
      companyId: updated.companyId,
      type: eventType,
      level: status === "blocked" ? "warning" : "info",
      message: reason,
      createdAt: new Date().toISOString()
    });
  }
  return updated;
}

function createDefaultAgentProfile(
  company: SaasCompany,
  moduleKey: ModuleKey,
  overrides?: Partial<
    Pick<
      SaasAgentProfile,
      "agentKey" | "displayName" | "systemPrompt" | "personality" | "identity" | "userContext" | "allowedTools" | "modelProvider" | "modelId"
    > & { missionSource: SaasAgentProfile["missionConfig"]["source"] }
  >
): SaasAgentProfile {
  const module = moduleByKey(moduleKey);
  const now = new Date().toISOString();
  const defaultFaq = company.serviceCatalog
    ? [
        "Quels services proposez-vous ?",
        "Comment puis-je vous expliquer mon besoin ?",
        "Comment puis-je parler a un humain ?"
      ]
    : ["Quels services proposez-vous ?", "Quels sont vos delais moyens ?", "Comment puis-je parler a un humain ?"];
  return {
    id: randomUUID(),
    companyId: company.id,
    moduleKey,
    agentKey: overrides?.agentKey ?? moduleKey,
    displayName: overrides?.displayName ?? module.title,
    isEnabled: true,
    tone: "Professionnel, clair et rassurant.",
    modelProvider: overrides?.modelProvider ?? "openai",
    modelId: overrides?.modelId ?? "",
    systemPrompt:
      overrides?.systemPrompt ??
      (moduleKey === "sourcing-commercial"
        ? "Tu es un agent de sourcing commercial. Tu prepares des recherches propres, cibles et utiles. Tu ne dois jamais inventer une entreprise ou une information absente des resultats trouves."
        : ""),
    personality:
      overrides?.personality ??
      (moduleKey === "sourcing-commercial" ? "Methodique, sobre, utile, focalise sur la qualite des prospects." : ""),
    identity:
      overrides?.identity ??
      (moduleKey === "sourcing-commercial"
        ? `Agent de Sourcing de ${company.name}. Tu travailles pour identifier de vrais prospects avec un bon potentiel commercial.`
        : ""),
    userContext:
      overrides?.userContext ??
      (moduleKey === "sourcing-commercial"
        ? "Utilise les informations de l'entreprise, ses services et sa cible pour orienter les recherches."
        : ""),
    welcomeMessage: `Bonjour, ici ${company.name}. Comment puis-je vous aider aujourd'hui ?`,
    businessName: company.name,
    businessEmail: company.businessEmail,
    businessPhone: company.businessPhone,
    faq: defaultFaq,
    activeHours: "Lundi - Vendredi, 08:00 - 18:00",
    simpleRules: "Ne pas inventer. Escalader si demande sensible, paiement, litige ou cas complexe.",
    escalationThreshold: "Escalade des que la demande sort de la FAQ ou touche un engagement commercial.",
    requireApproval: false,
    allowedTools: overrides?.allowedTools ?? (moduleKey === "sourcing-commercial" ? ["webScraper", "searchKnowledge"] : []),
    missionConfig: {
      source: overrides?.missionSource ?? "serper",
      keywords: "",
      qualificationInstructions: "",
      enrollmentMode: "none",
      defaultSector: "",
      defaultZone: "",
      defaultTargetCount: 6
    },
    createdAt: now,
    updatedAt: now
  };
}

function createDefaultAgentProfiles(company: SaasCompany, moduleKey: ModuleKey): SaasAgentProfile[] {
  if (moduleKey !== "sourcing-commercial") {
    return [createDefaultAgentProfile(company, moduleKey)];
  }

  return [
    createDefaultAgentProfile(company, moduleKey, {
      agentKey: "sourcing-serper",
      displayName: "Agent Découverte",
      missionSource: "serper",
      systemPrompt:
        "Tu es Agent Decouverte. Tu transformes le brief du client en recherche web efficace pour trouver rapidement de vraies entreprises pertinentes. Tu explores large mais tu gardes une exigence minimale de qualite: entreprise reelle, activite claire, presence web exploitable et contact visible si possible. Tu n'inventes jamais d'informations et tu rejettes les pages parasites.",
      personality: "Rapide, methodique, opportuniste mais propre, oriente volume utile et tri initial.",
      identity: `Agent Découverte de ${company.name}. Tu ouvres le terrain sur tout type de marche et proposes une premiere liste de prospects utilisables.`,
      userContext:
        "Tu t'adaptes a la demande du client, au secteur et a la zone pour produire une premiere selection de pistes pertinentes.",
      allowedTools: ["webScraper", "searchKnowledge"]
    }),
    createDefaultAgentProfile(company, moduleKey, {
      agentKey: "sourcing-tavily",
      displayName: "Agent Qualification",
      missionSource: "tavily",
      systemPrompt:
        "Tu es Agent Qualification. Tu prends un brief client et des pistes web, puis tu analyses les pages publiques pour retenir les prospects les plus serieux. Tu privilegies la precision, la verification et la priorisation. Tu ne confirmes que ce qui est visible dans les sources reelles, tu rejettes les signaux faibles et tu n'inventes jamais.",
      personality: "Analytique, rigoureux, selectif, oriente verification et priorisation.",
      identity: `Agent Qualification de ${company.name}. Tu enrichis les pistes et aides a retenir les prospects les plus credibles pour toute demande client.`,
      userContext:
        "Tu t'adaptes au brief du client pour verifier la qualite reelle des prospects, leur adequation au besoin et la facilite de prise de contact.",
      allowedTools: ["webScraper", "searchKnowledge", "summarizeThread"]
    })
  ];
}

function isIncompleteSourcingProfile(profile: SaasAgentProfile) {
  if (profile.moduleKey !== "sourcing-commercial") return false;
  return !profile.systemPrompt.trim() ||
    !profile.personality.trim() ||
    !profile.identity.trim() ||
    !profile.userContext.trim() ||
    !profile.missionConfig.keywords.trim() ||
    !profile.missionConfig.qualificationInstructions.trim() ||
    profile.missionConfig.defaultTargetCount <= 0 ||
    profile.allowedTools.length === 0;
}

function applyGlobalAgentTemplateToProfile(
  profile: SaasAgentProfile,
  template: SourcingGlobalAgent,
  company: SaasCompany
): SaasAgentProfile {
  return {
    ...profile,
    displayName: template.displayName,
    isEnabled: template.isEnabled,
    modelProvider: template.modelProvider,
    modelId: template.modelId,
    systemPrompt: template.systemPrompt,
    personality: template.personality,
    identity: template.identity.includes(company.name) ? template.identity : template.identity,
    userContext: template.userContext,
    allowedTools: template.allowedTools,
    missionConfig: {
      ...profile.missionConfig,
      source: template.source,
      keywords: template.defaultKeywords,
      qualificationInstructions: template.qualificationInstructions,
      defaultSector: template.defaultSector,
      defaultZone: template.defaultZone,
      defaultTargetCount: template.defaultTargetCount
    },
    updatedAt: new Date().toISOString()
  };
}

async function createSourcingProfilesFromGlobalAgents(company: SaasCompany) {
  const globalAgents = await getGlobalAgents();
  return globalAgents.map((template) =>
    applyGlobalAgentTemplateToProfile(
      createDefaultAgentProfile(company, "sourcing-commercial", {
        agentKey: template.agentKey,
        displayName: template.displayName,
        modelProvider: template.modelProvider,
        modelId: template.modelId,
        missionSource: template.source,
        systemPrompt: template.systemPrompt,
        personality: template.personality,
        identity: template.identity,
        userContext: template.userContext,
        allowedTools: template.allowedTools
      }),
      template,
      company
    )
  );
}

async function reapplyGlobalAgentTemplateToExistingProfiles(agentKey: "sourcing-serper" | "sourcing-tavily") {
  const [companies, profiles, globalAgents] = await Promise.all([loadCompanies(), loadAgentProfiles(), getGlobalAgents()]);
  const template = globalAgents.find((item) => item.agentKey === agentKey) ?? null;
  if (!template) return 0;

  let changedCount = 0;
  const nextProfiles = profiles.map((profile) => {
    if (profile.moduleKey !== "sourcing-commercial" || profile.agentKey !== agentKey) {
      return profile;
    }

    const company = companies.find((item) => item.id === profile.companyId) ?? null;
    if (!company) {
      return profile;
    }

    changedCount += 1;
    return applyGlobalAgentTemplateToProfile(profile, template, company);
  });

  if (changedCount > 0) {
    await saveAgentProfiles(nextProfiles);
  }

  return changedCount;
}

function createDefaultSubscription(companyId: string, moduleKey: ModuleKey, nowIso: string): SaasSubscription {
  const module = moduleByKey(moduleKey);
  return {
    id: randomUUID(),
    companyId,
    moduleKey,
    planName: `${module.title} Mensuel`,
    monthlyPrice: module.monthlyPrice,
    currency: "XOF",
    status: "trial",
    startDate: nowIso,
    nextBillingDate: addDays(nowIso, 30),
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function nextInvoiceNumber(invoices: SaasInvoice[]) {
  const year = new Date().getFullYear();
  const maxExisting = invoices
    .map((invoice) => {
      const match = invoice.number.match(/-(\d{3,})$/);
      return match ? Number(match[1]) : 0;
    })
    .reduce((max, current) => Math.max(max, current), 0);
  return `SAAS-${year}-${String(maxExisting + 1).padStart(3, "0")}`;
}

function createInvoiceForSubscription(subscription: SaasSubscription, invoices: SaasInvoice[], issuedAt: string) {
  const invoice: SaasInvoice = {
    id: randomUUID(),
    companyId: subscription.companyId,
    subscriptionId: subscription.id,
    moduleKey: subscription.moduleKey,
    number: nextInvoiceNumber(invoices),
    amount: subscription.monthlyPrice,
    currency: "XOF",
    status: "sent",
    periodStart: subscription.startDate,
    periodEnd: subscription.nextBillingDate,
    dueDate: subscription.nextBillingDate,
    issuedAt,
    createdAt: issuedAt
  };
  return invoice;
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

function buildWhatsAppSettingsStatus({
  hasMetaConfig,
  baileysSessions,
  connectedSessions
}: {
  hasMetaConfig: boolean;
  baileysSessions: number;
  connectedSessions: number;
}) {
  if (connectedSessions > 0) return "connected" as const;
  if (hasMetaConfig || baileysSessions > 0) return "configuration_in_progress" as const;
  return "not_configured" as const;
}

function buildCompanySettingsStatus(company: SaasCompany) {
  const hasBusinessIdentity = Boolean(company.businessEmail || company.businessPhone || company.description);
  const hasAutonomyContext = Boolean(
    company.industry || company.serviceCatalog || company.targetCustomers || company.agentSkills.length || company.agentInstructions
  );

  if (hasBusinessIdentity && hasAutonomyContext) return "connected" as const;
  if (hasBusinessIdentity || hasAutonomyContext) return "configuration_in_progress" as const;
  return "not_configured" as const;
}

function sanitizeCompanySkillList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function updateCompanyProfile(companyId: string, body: any) {
  const companies = await loadCompanies();
  const updatedAt = new Date().toISOString();
  const nextCompanies = companies.map((item) =>
    item.id === companyId
      ? {
          ...item,
          name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : item.name,
          description: typeof body?.description === "string" ? body.description.trim() : item.description,
          businessEmail:
            typeof body?.businessEmail === "string" && body.businessEmail.trim()
              ? normalizeEmail(body.businessEmail)
              : item.businessEmail,
          businessPhone: typeof body?.businessPhone === "string" ? body.businessPhone.trim() : item.businessPhone,
          industry: typeof body?.industry === "string" ? body.industry.trim() : item.industry,
          serviceCatalog: typeof body?.serviceCatalog === "string" ? body.serviceCatalog.trim() : item.serviceCatalog,
          targetCustomers: typeof body?.targetCustomers === "string" ? body.targetCustomers.trim() : item.targetCustomers,
          agentSkills: body?.agentSkills !== undefined ? sanitizeCompanySkillList(body.agentSkills) : item.agentSkills,
          agentInstructions:
            typeof body?.agentInstructions === "string" ? body.agentInstructions.trim() : item.agentInstructions,
          updatedAt
        }
      : item
  );

  const nextCompany = nextCompanies.find((item) => item.id === companyId);
  if (!nextCompany) {
    throw new Error("Entreprise SaaS introuvable.");
  }

  await saveCompanies(nextCompanies);
  return nextCompany;
}

function buildCompanyHumanContactLine(company: SaasCompany) {
  const parts = [company.businessPhone, company.businessEmail].filter(Boolean);
  if (!parts.length) return "";
  return `Tu peux joindre l'equipe sur ${parts.join(" ou ")}.`;
}

function buildAutonomousWhatsAppReply({
  company,
  profile,
  incomingText
}: {
  company: SaasCompany;
  profile: SaasAgentProfile | null;
  incomingText: string;
}) {
  const text = incomingText.toLowerCase();
  const intro = profile?.welcomeMessage?.trim() || `Bonjour, ici ${company.name}.`;
  const serviceLine = company.serviceCatalog ? `Services: ${company.serviceCatalog}.` : "";
  const skillLine = company.agentSkills.length ? `Competences: ${company.agentSkills.join(", ")}.` : "";
  const targetLine = company.targetCustomers ? `Nous travaillons surtout avec ${company.targetCustomers}.` : "";
  const contactLine = buildCompanyHumanContactLine(company);

  if (/(humain|conseiller|appel|appeler|contact|personne|equipe)/i.test(text)) {
    return [intro, contactLine || "Je peux aussi transmettre ta demande a l'equipe humaine.", "Dis-moi ton besoin et tes coordonnees."]
      .filter(Boolean)
      .join(" ");
  }

  if (/(service|services|proposez|faites|offre|offres|solution)/i.test(text)) {
    return [
      intro,
      serviceLine || `${company.name} peut t'accompagner selon ton besoin.`,
      skillLine,
      targetLine,
      "Explique-moi ton besoin, ton secteur et ton delai pour que je t'oriente."
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (/(prix|tarif|devis|cout|budget)/i.test(text)) {
    return [
      intro,
      "Pour preparer un chiffrage utile, j'ai besoin de ton besoin exact, de ton secteur et de ton delai.",
      serviceLine,
      contactLine
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (/(bonjour|bonsoir|salut|hello|coucou)/i.test(text)) {
    return [intro, serviceLine, skillLine, "Dis-moi simplement ce que tu cherches et je te guide tout de suite."]
      .filter(Boolean)
      .join(" ");
  }

  return [
    intro,
    serviceLine,
    skillLine,
    targetLine,
    "Decris ton besoin en quelques mots, et je t'aiderai a preparer la suite ou a te rediriger vers la bonne personne."
  ]
    .filter(Boolean)
    .join(" ");
}

async function ensureCloudSessionForCompany(company: SaasCompany, phoneNumberId: string, displayPhoneNumber: string) {
  const bindings = await loadWhatsAppBindings();
  const metaConfigs = await loadWhatsAppMetaConfigs();
  const existingConfig = metaConfigs.find((item) => item.companyId === company.id && item.phoneNumberId === phoneNumberId);
  if (existingConfig) {
    const session = await prisma.wASession.findUnique({ where: { id: existingConfig.sessionId } });
    if (session) return session;
  }

  const session = await prisma.wASession.create({
    data: {
      name: `${company.name} Cloud`,
      type: "saas_cloud",
      phoneNumber: displayPhoneNumber || phoneNumberId,
      status: "configured"
    }
  });

  const now = new Date().toISOString();
  await saveWhatsAppBindings([
    {
      id: randomUUID(),
      companyId: company.id,
      sessionId: session.id,
      mode: "cloud",
      label: `${company.name} Cloud`,
      createdAt: now,
      updatedAt: now
    },
    ...bindings.filter((item) => item.companyId !== company.id || item.sessionId !== session.id)
  ]);

  return session;
}

async function listCompanyOwnedSessionIds(companyId: string) {
  const bindings = await loadWhatsAppBindings();
  return bindings.filter((item) => item.companyId === companyId).map((item) => item.sessionId);
}

async function getCompanyOwnedSession(companyId: string, sessionId: string) {
  const bindings = await loadWhatsAppBindings();
  const binding = bindings.find((item) => item.companyId === companyId && item.sessionId === sessionId);
  if (!binding) return null;
  const session = await prisma.wASession.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  return { binding, session };
}

async function getOrCreateCompanyConversation(sessionId: string, phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  const jid = phone.includes("@") ? phone : `${cleaned}@s.whatsapp.net`;

  const exact = await prisma.wAConversation.findFirst({ where: { sessionId, jid } });
  if (exact) return exact;

  const existing = await prisma.wAConversation.findFirst({
    where: {
      sessionId,
      OR: [{ phoneNumber: cleaned }, { jid: { contains: cleaned } }]
    }
  });

  if (existing && existing.jid !== jid) {
    return prisma.wAConversation.update({
      where: { id: existing.id },
      data: { jid, phoneNumber: cleaned }
    });
  }
  if (existing) return existing;

  return prisma.wAConversation.create({
    data: { sessionId, jid, phoneNumber: cleaned, labels: [] }
  });
}

async function saveCompanyIncomingWhatsAppMessage({
  sessionId,
  from,
  text,
  type,
  timestamp,
  waMessageId,
  mediaUrl,
  mimetype,
  filename,
  caption,
  fileSize
}: {
  sessionId: string;
  from: string;
  text?: string;
  type: string;
  timestamp: string;
  waMessageId: string;
  mediaUrl?: string;
  mimetype?: string;
  filename?: string;
  caption?: string;
  fileSize?: number;
}) {
  const conversation = await getOrCreateCompanyConversation(sessionId, from);
  const message = await prisma.wAMessage.upsert({
    where: { waMessageId },
    create: {
      conversationId: conversation.id,
      waMessageId,
      fromMe: false,
      type,
      content: text ?? null,
      mediaUrl: mediaUrl ?? null,
      mimetype: mimetype ?? null,
      filename: filename ?? null,
      fileSize: fileSize ?? null,
      caption: caption ?? null,
      timestamp: new Date(timestamp)
    },
    update: {}
  });

  await prisma.wAConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: text ?? caption ?? filename ?? `[${type}]`,
      lastMessageAt: new Date(timestamp),
      unreadCount: { increment: 1 }
    }
  });

  return { conversation, message };
}

async function saveCompanyOutgoingWhatsAppMessage(sessionId: string, to: string, content: string, waMessageId?: string | null) {
  const conversation = await getOrCreateCompanyConversation(sessionId, to);
  const messageId = waMessageId ?? `saas_out_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const message = await prisma.wAMessage.upsert({
    where: { waMessageId: messageId },
    create: {
      conversationId: conversation.id,
      waMessageId: messageId,
      fromMe: true,
      type: "text",
      content,
      timestamp: new Date()
    },
    update: {}
  });

  await prisma.wAConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: content,
      lastMessageAt: new Date(),
      unreadCount: 0
    }
  });

  return { conversation, message };
}

async function upsertCompanyLeadFromWhatsApp(companyId: string, phone: string, latestMessage: string) {
  const subscriptions = await loadSubscriptions();
  const crmActive = subscriptions.some(
    (item) => item.companyId === companyId && item.moduleKey === "crm-intelligent" && isAccessibleSubscriptionStatus(item.status)
  );
  if (!crmActive) return null;

  const leads = await loadCrmLeads();
  const normalizedPhone = phone.replace(/\D/g, "");
  const existing = leads.find(
    (lead) =>
      lead.companyId === companyId &&
      (lead.name === normalizedPhone || lead.company === normalizedPhone || lead.source === `WhatsApp:${normalizedPhone}`)
  );

  const updatedAt = new Date().toISOString();
  const lead: SaasCrmLead = existing
    ? {
        ...existing,
        source: `WhatsApp:${normalizedPhone}`,
        updatedAt
      }
    : {
        id: randomUUID(),
        companyId,
        name: normalizedPhone,
        company: normalizedPhone,
        source: `WhatsApp:${normalizedPhone}`,
        score: 65,
        status: latestMessage ? "warm" : "new",
        updatedAt
      };

  await saveCrmLeads([lead, ...leads.filter((item) => item.id !== lead.id)]);
  return lead;
}

function extractProspectName(title: string, url: string) {
  const cleanedTitle = title.split("|")[0]?.split("-")[0]?.trim();
  if (cleanedTitle) return cleanedTitle.slice(0, 120);
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return title;
  }
}

const sourcingExcludedHostPattern =
  /(^|\.)((jobs?|careers?|emploi|recrutement|vacancy|internship|stage|talent|work)(\.|$)|indeed\.|linkedin\.com|glassdoor\.|monster\.|careerjet\.|optioncarriere\.|welcometothejungle\.|jobnetafrica\.|michaelpage\.|businessfrance\.|jobs2\.|europages\.|kompass\.|franchise\.|business\.google\.com|google\.com|gouv\.fr|service-public\.fr)/i;
const sourcingExcludedPathPattern =
  /jobs?|job-|careers?|emploi|offres?-d-emploi|recrut|vacan|hiring|internship|stage|postuler|apply|annuaire|directory|marketplace|market-place|profil-d-entreprise|google-business-profile|actualites?|actus?|blog|guide|category|categorie|article|news|ressources?|salons?|congres|thematique/i;
const sourcingExcludedTextPattern =
  /jobs?|career|careers|emploi|offre d'emploi|recrut|vacan|hiring|internship|stage|postuler|apply now|candidature|annuaire|directory|marketplace|place de marche|franchise|actualite|blog|guide|article|magazine|congres|salon|news|theme|thematique/i;
const sourcingBusinessPathPattern =
  /contact|about|apropos|a-propos|services|solutions|company|entreprise|societe|products|produits|catalogue/i;
const sourcingBusinessTextPattern =
  /contact|services|solutions|a propos|about us|our services|nos services|entreprise|societe|company|clients|produits|catalogue|devis|whatsapp|email|telephone|phone|adresse|bureau/i;
const sourcingDecisionMakerPattern =
  /fondateur|founder|directeur|ceo|gerant|manager|responsable|sales|commercial|contact/i;
const audienceTargetingPattern = /\bpour\s+(les\s+|des\s+|de\s+)?/i;
const genericSectorStopWords = new Set([
  "entreprise",
  "entreprises",
  "societe",
  "societes",
  "services",
  "service",
  "b2b",
  "btob",
  "pme",
  "cabinet",
  "cabinets",
  "business",
  "solutions",
  "france",
  "europe",
  "afrique"
]);

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildSourcingSearchQuery(brief: string, sector: string, zone: string) {
  const sectorPhrase = sector.trim() ? `"${sector.trim()}"` : "";
  const query = [sectorPhrase, brief.trim(), zone.trim(), "site officiel contact services"].filter(Boolean).join(" ").trim();
  const exclusions =
    "-job -jobs -career -careers -emploi -emplois -recrutement -vacancy -internship -stage -annuaire -directory -marketplace -franchise -site:europages.fr -site:kompass.com -site:business.google.com";
  return `${query} ${exclusions}`.trim();
}

function extractSectorKeywords(sector: string, brief: string) {
  return Array.from(
    new Set(
      `${sector} ${brief}`
        .split(/[^a-zA-Z0-9À-ÿ]+/)
        .map((item) => normalizeSearchText(item).trim())
        .filter((item) => item.length >= 4 && !genericSectorStopWords.has(item))
    )
  ).slice(0, 8);
}

function isRejectedSourcingCandidate({
  title,
  url,
  snippet,
  summary
}: {
  title: string;
  url: string;
  snippet: string;
  summary: string;
}) {
  const text = normalizeSearchText(`${title} ${snippet} ${summary}`);

  try {
    const parsed = new URL(url);
    const hostname = normalizeSearchText(parsed.hostname.replace(/^www\./, ""));
    const pathname = normalizeSearchText(parsed.pathname);

    if (sourcingExcludedHostPattern.test(hostname)) return true;
    if (sourcingExcludedPathPattern.test(pathname)) return true;
  } catch {
    return true;
  }

  return sourcingExcludedTextPattern.test(text);
}

function hasStrongBusinessSignals({
  title,
  url,
  snippet,
  summary
}: {
  title: string;
  url: string;
  snippet: string;
  summary: string;
}) {
  const text = normalizeSearchText(`${title} ${snippet} ${summary}`);
  const businessTextSignal = sourcingBusinessTextPattern.test(text);
  const decisionMakerSignal = sourcingDecisionMakerPattern.test(text);

  try {
    const parsed = new URL(url);
    const path = normalizeSearchText(parsed.pathname);
    const segments = path.split("/").filter(Boolean);
    const pathSignal = sourcingBusinessPathPattern.test(path);
    const rootOrShallowPage = segments.length <= 1;
    return businessTextSignal || decisionMakerSignal || pathSignal || rootOrShallowPage;
  } catch {
    return businessTextSignal || decisionMakerSignal;
  }
}

function matchesSectorIntent(
  {
    title,
    url,
    snippet,
    summary
  }: {
    title: string;
    url: string;
    snippet: string;
    summary: string;
  },
  sector: string,
  brief: string
) {
  const sectorKeywords = extractSectorKeywords(sector, brief);
  if (!sectorKeywords.length) return true;

  const text = normalizeSearchText(`${title} ${snippet} ${summary} ${url}`);
  const matches = sectorKeywords.filter((keyword) => text.includes(keyword));

  if (sectorKeywords.length === 1) return matches.length >= 1;
  return matches.length >= Math.min(2, sectorKeywords.length);
}

function looksLikeCompanyOfferPage(
  {
    title,
    url,
    snippet,
    summary
  }: {
    title: string;
    url: string;
    snippet: string;
    summary: string;
  },
  sector: string,
  brief: string
) {
  const text = normalizeSearchText(`${title} ${snippet} ${summary}`);
  const sectorKeywords = extractSectorKeywords(sector, brief);

  if (sourcingExcludedTextPattern.test(text)) return false;
  if (audienceTargetingPattern.test(text)) {
    const targetsSector = sectorKeywords.some((keyword) => text.includes(`pour ${keyword}`) || text.includes(`des ${keyword}`));
    if (targetsSector) return false;
  }

  try {
    const parsed = new URL(url);
    const path = normalizeSearchText(parsed.pathname);
    const segments = path.split("/").filter(Boolean);
    const shallowPath = segments.length <= 1;
    const allowedPath = shallowPath || sourcingBusinessPathPattern.test(path);
    if (!allowedPath) return false;
  } catch {
    return false;
  }

  return true;
}

function dedupeSourcingProspects(prospects: NonNullable<SaasSourcingRun["prospects"][number]>[]) {
  const seen = new Set<string>();
  return prospects.filter((prospect) => {
    const key = normalizeSearchText(prospect.website || prospect.company || prospect.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const sourcingEmailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const sourcingPhonePattern =
  /(?:(?:\+|00)\d{1,4}[\s().-]*)?(?:\d[\s().-]*){7,16}\d/g;

function extractFirstEmail(text: string) {
  if (!text) return null;
  const matches = text.match(sourcingEmailPattern) ?? [];
  for (const match of matches) {
    const email = match.trim().toLowerCase();
    if (/@example\.com$/i.test(email)) continue;
    if (/\.png$|\.jpg$|\.jpeg$|\.webp$|\.svg$/i.test(email)) continue;
    return email;
  }
  return null;
}

function normalizeExtractedPhone(raw: string) {
  const trimmed = raw.replace(/[^\d+]/g, "");
  const digitCount = trimmed.replace(/\D/g, "").length;
  if (digitCount < 8 || digitCount > 15) return null;
  if (!/\d/.test(trimmed)) return null;
  return raw.replace(/\s+/g, " ").trim();
}

function extractFirstPhone(text: string) {
  if (!text) return null;
  const matches = text.match(sourcingPhonePattern) ?? [];
  for (const match of matches) {
    const phone = normalizeExtractedPhone(match);
    if (!phone) continue;
    return phone;
  }
  return null;
}

function buildProspectScore(text: string, summary: string, website: string) {
  const normalizedText = normalizeSearchText(text);
  const normalizedSummary = normalizeSearchText(summary);

  let score = 35;
  if (summary) score += 10;
  if (website) score += 10;
  if (sourcingBusinessTextPattern.test(normalizedText)) score += 18;
  if (sourcingDecisionMakerPattern.test(normalizedText)) score += 10;
  if (/whatsapp|digital|web|crm|automation|marketing|site|service|solution/i.test(normalizedText)) score += 8;
  if (/contact|email|telephone|phone|adresse/i.test(normalizedSummary)) score += 10;
  if (sourcingExcludedTextPattern.test(normalizedText)) score -= 45;

  try {
    const parsed = new URL(website);
    const path = normalizeSearchText(parsed.pathname);
    if (sourcingBusinessPathPattern.test(path)) score += 8;
    if (sourcingExcludedPathPattern.test(path) || sourcingExcludedHostPattern.test(parsed.hostname)) score -= 45;
  } catch {
    score -= 10;
  }

  return Math.max(0, Math.min(score, 95));
}

function buildMissionKeywordBoost(text: string, mission: SaasAgentProfile["missionConfig"]) {
  const candidates = `${mission.keywords} ${mission.qualificationInstructions}`
    .split(/[,\n.;:]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length >= 4)
    .slice(0, 12);

  if (!candidates.length) return 0;

  let score = 0;
  const normalizedText = text.toLowerCase();
  for (const candidate of candidates) {
    if (normalizedText.includes(candidate)) score += 4;
  }
  return Math.min(score, 20);
}

function normalizePhoneForChannel(raw: string) {
  return raw.replace(/@s\.whatsapp\.net$/i, "").trim();
}

function buildSourcingObjective(brief: string, sector: string, zone: string) {
  const parts = [brief.trim()];
  if (sector.trim()) parts.push(`Secteur cible: ${sector.trim()}.`);
  if (zone.trim()) parts.push(`Zone cible: ${zone.trim()}.`);
  return parts.filter(Boolean).join(" ").trim();
}

async function executeSourcingSearch({
  objective,
  searchQuery,
  brief,
  agentSource,
  zone,
  sector,
  targetCount,
  providerStatus
}: {
  objective: string;
  searchQuery: string;
  brief: string;
  agentSource: "serper" | "tavily";
  zone: string;
  sector: string;
  targetCount: number;
  providerStatus: Awaited<ReturnType<typeof getSearchProviderStatus>>;
}) {
  if (agentSource === "serper") {
    if (!providerStatus.serper.configured) {
      throw new Error("Serper n'est pas configure dans les parametres IA.");
      }

      const search = await searchSerper({
        query: searchQuery,
        limit: targetCount,
        country: zone,
        language: "fr"
      });

    return {
      providerMode: search.results.length ? ("live" as const) : ("waiting_api" as const),
      results: search.results,
      providers: {
        serperConfigured: search.configured,
        tavilyConfigured: providerStatus.tavily.configured
      }
    };
  }

  if (!providerStatus.tavily.configured) {
    throw new Error("Tavily n'est pas configure dans les parametres IA.");
  }

    const search = await searchTavily({
      query: searchQuery,
      limit: targetCount,
      language: "fr"
    });

  return {
    providerMode: search.results.length ? ("live" as const) : ("waiting_api" as const),
    results: search.results,
    providers: {
      serperConfigured: providerStatus.serper.configured,
      tavilyConfigured: search.configured
    }
  };
}

function toPublicWhatsAppSession(session: { id: string; name: string; phoneNumber: string; status: string; connected: boolean }, mode: WhatsAppSessionMode) {
  return {
    ...session,
    mode
  };
}

function attachSaasBaileysEvents(client: WhatsAppBaileysClient, sessionId: string, companyId: string) {
  client.removeAllListeners();

  client.on("qr", async ({ qr }: { qr: string }) => {
    const qrDataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: { dark: "#111111", light: "#ffffff" }
    });
    client.setQrDataUrl(qrDataUrl);
    await prisma.wASession.update({ where: { id: sessionId }, data: { status: "qr_pending" } }).catch(() => {});
  });

  client.on("connected", async ({ phoneNumber }: { phoneNumber: string | undefined }) => {
    await prisma.wASession
      .update({
        where: { id: sessionId },
        data: { status: "connected", phoneNumber: phoneNumber ?? "" }
      })
      .catch(() => {});
  });

  client.on("disconnected", async ({ shouldReconnect }: { shouldReconnect: boolean }) => {
    await prisma.wASession
      .update({
        where: { id: sessionId },
        data: { status: shouldReconnect ? "reconnecting" : "disconnected" }
      })
      .catch(() => {});
  });

  client.on("message", async (normalizedMsg: any) => {
    const saved = await saveCompanyIncomingWhatsAppMessage({
      sessionId,
      from: normalizedMsg.from,
      text: normalizedMsg.text,
      type: normalizedMsg.type ?? "text",
      timestamp: normalizedMsg.timestamp ?? new Date().toISOString(),
      waMessageId: normalizedMsg.id ?? `in_${Date.now()}`,
      mediaUrl: normalizedMsg.mediaUrl,
      mimetype: normalizedMsg.mimetype,
      filename: normalizedMsg.filename,
      caption: normalizedMsg.caption,
      fileSize: normalizedMsg.fileSize
    }).catch(() => null);

    if (normalizedMsg.text) {
      await upsertCompanyLeadFromWhatsApp(companyId, normalizedMsg.from, normalizedMsg.text).catch(() => null);
    }

    if (saved) {
      await prisma.wAConversation.update({
        where: { id: saved.conversation.id },
        data: {
          labels: Array.from(new Set([...(saved.conversation.labels ?? []), `saas:${companyId}`]))
        }
      }).catch(() => null);
    }

    if (!normalizedMsg.text || typeof normalizedMsg.from !== "string") return;
    if (/status@broadcast/i.test(normalizedMsg.from)) return;

    const companies = await loadCompanies().catch(() => []);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return;

    const runtime = await getCompanyRuntime(company).catch(() => null);
    if (!runtime) return;

    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "whatsapp-business");
    if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) return;

    const profile = runtime.profiles.find((item) => item.moduleKey === "whatsapp-business") ?? null;
    const reply = buildAutonomousWhatsAppReply({
      company: runtime.company,
      profile,
      incomingText: normalizedMsg.text
    });
    if (!reply) return;

    const sent = await client.sendText(normalizedMsg.from, reply).catch(() => null);
    const sentId = sent?.key?.id ?? null;
    await saveCompanyOutgoingWhatsAppMessage(sessionId, normalizePhoneForChannel(normalizedMsg.from), reply, sentId).catch(() => null);
  });

  client.on("message.update", async (update: { messageId: string; status: string }) => {
    await prisma.wAMessage.update({
      where: { waMessageId: update.messageId },
      data: { status: update.status }
    }).catch(() => null);
  });
}

function ensureSaasBaileysClient(sessionId: string, companyId: string) {
  const client = baileysManager.getOrCreate(sessionId);
  attachSaasBaileysEvents(client, sessionId, companyId);
  if (client.status === "closed") {
    void client.connect().catch(() => null);
  }
  return client;
}

async function ensureAgentProfiles(company: SaasCompany) {
  const profiles = await loadAgentProfiles();
  const nextProfiles = [...profiles];
  let changed = false;

  const legacySourcingProfile = nextProfiles.find(
    (item) => item.companyId === company.id && item.moduleKey === "sourcing-commercial" && item.agentKey === "sourcing-commercial"
  );
  if (legacySourcingProfile) {
    legacySourcingProfile.agentKey = "sourcing-serper";
    legacySourcingProfile.displayName = legacySourcingProfile.displayName && legacySourcingProfile.displayName !== "Agent Serper"
      ? legacySourcingProfile.displayName
      : "Agent Découverte";
    legacySourcingProfile.missionConfig = {
      ...legacySourcingProfile.missionConfig,
      source: "serper"
    };
    legacySourcingProfile.updatedAt = new Date().toISOString();
    changed = true;
  }

  for (const module of company.modules) {
    const existingForModule = nextProfiles.filter((item) => item.companyId === company.id && item.moduleKey === module.moduleKey);
    const defaults =
      module.moduleKey === "sourcing-commercial"
        ? await createSourcingProfilesFromGlobalAgents(company)
        : createDefaultAgentProfiles(company, module.moduleKey);

    for (const defaultProfile of defaults) {
      const existingProfile = existingForModule.find((item) => item.agentKey === defaultProfile.agentKey);
      if (!existingProfile) {
        nextProfiles.push(defaultProfile);
        changed = true;
        continue;
      }

      if (module.moduleKey === "sourcing-commercial" && isIncompleteSourcingProfile(existingProfile)) {
        const index = nextProfiles.findIndex((item) => item.id === existingProfile.id);
        if (index >= 0) {
          nextProfiles[index] = {
            ...existingProfile,
            displayName: existingProfile.displayName.trim() || defaultProfile.displayName,
            modelProvider: existingProfile.modelProvider.trim() || defaultProfile.modelProvider,
            modelId: existingProfile.modelId.trim() || defaultProfile.modelId,
            systemPrompt: existingProfile.systemPrompt.trim() || defaultProfile.systemPrompt,
            personality: existingProfile.personality.trim() || defaultProfile.personality,
            identity: existingProfile.identity.trim() || defaultProfile.identity,
            userContext: existingProfile.userContext.trim() || defaultProfile.userContext,
            allowedTools: existingProfile.allowedTools.length ? existingProfile.allowedTools : defaultProfile.allowedTools,
            missionConfig: {
              ...existingProfile.missionConfig,
              source: existingProfile.missionConfig.source || defaultProfile.missionConfig.source,
              keywords: existingProfile.missionConfig.keywords.trim() || defaultProfile.missionConfig.keywords,
              qualificationInstructions:
                existingProfile.missionConfig.qualificationInstructions.trim() ||
                defaultProfile.missionConfig.qualificationInstructions,
              defaultSector: existingProfile.missionConfig.defaultSector,
              defaultZone: existingProfile.missionConfig.defaultZone,
              defaultTargetCount:
                existingProfile.missionConfig.defaultTargetCount > 0
                  ? existingProfile.missionConfig.defaultTargetCount
                  : defaultProfile.missionConfig.defaultTargetCount
            },
            updatedAt: new Date().toISOString()
          };
          changed = true;
        }
      }
    }
  }

  if (changed) await saveAgentProfiles(nextProfiles);
  return nextProfiles.filter((item) => item.companyId === company.id);
}

async function ensureSubscriptionStateForCompany(company: SaasCompany) {
  const [allSubscriptions, allInvoices, allCompanies] = await Promise.all([loadSubscriptions(), loadInvoices(), loadCompanies()]);
  const nextSubscriptions = [...allSubscriptions];
  const nextInvoices = [...allInvoices];
  const nextCompanies = [...allCompanies];
  let changed = false;

  for (const module of company.modules) {
    let subscription = nextSubscriptions.find((item) => item.companyId === company.id && item.moduleKey === module.moduleKey);
    const nowIso = new Date().toISOString();
    if (!subscription) {
      subscription = createDefaultSubscription(company.id, module.moduleKey, nowIso);
      nextSubscriptions.push(subscription);
      const invoice = createInvoiceForSubscription(subscription, nextInvoices, nowIso);
      nextInvoices.push(invoice);
      subscription.lastInvoiceId = invoice.id;
      changed = true;
    } else {
      const existingSubscription = subscription;
      const hasInvoice =
        Boolean(existingSubscription.lastInvoiceId) &&
        nextInvoices.some((item) => item.id === existingSubscription.lastInvoiceId);
      if (!hasInvoice) {
        const invoice = createInvoiceForSubscription(existingSubscription, nextInvoices, nowIso);
        nextInvoices.push(invoice);
        existingSubscription.lastInvoiceId = invoice.id;
        existingSubscription.updatedAt = nowIso;
        changed = true;
      }
    }
  }

  const usableModuleKeys = new Set(
    nextSubscriptions
      .filter((subscription) => subscription.companyId === company.id && isAccessibleSubscriptionStatus(subscription.status))
      .map((subscription) => subscription.moduleKey)
  );

  const nextCompany = nextCompanies.find((item) => item.id === company.id) ?? company;
  const syncedModules = nextCompany.modules.map((module) => {
    const shouldBeActive = usableModuleKeys.has(module.moduleKey);
    if (module.active !== shouldBeActive) {
      changed = true;
      return { ...module, active: shouldBeActive };
    }
    return module;
  });

  if (changed) {
    const updatedCompany: SaasCompany = { ...nextCompany, modules: syncedModules, updatedAt: new Date().toISOString() };
    await saveCompanies(nextCompanies.map((item) => (item.id === company.id ? updatedCompany : item)));
    await saveSubscriptions(nextSubscriptions);
    await saveInvoices(nextInvoices);
    return {
      company: updatedCompany,
      subscriptions: nextSubscriptions.filter((item) => item.companyId === company.id),
      invoices: nextInvoices.filter((item) => item.companyId === company.id)
    };
  }

  return {
    company: { ...nextCompany, modules: syncedModules },
    subscriptions: nextSubscriptions.filter((item) => item.companyId === company.id),
    invoices: nextInvoices.filter((item) => item.companyId === company.id)
  };
}

function isLegacySeedLead(lead: SaasCrmLead) {
  return (
    (lead.name === "Aminata Coulibaly" && lead.company === "Clinic Horizon" && lead.source === "WhatsApp" && lead.score === 88) ||
    (lead.name === "Moussa Traore" && lead.company === "Kora Market" && lead.source === "Marketplace" && lead.score === 74) ||
    (lead.name === "Sarah D." && lead.company === "Studio Kemi" && lead.source === "Site web" && lead.score === 61)
  );
}

function isLegacySeedRun(run: SaasSourcingRun) {
  return run.brief === "Chercher des cliniques privees et cabinets de sante a fort potentiel." && run.sector === "Sante" && run.zone === "Abidjan";
}

function isLegacySeedActivity(activity: SaasWhatsAppActivity, company: SaasCompany) {
  return (
    (activity.contactName === "Jean Kouadio" &&
      activity.lastMessage === `Bonjour ${company.name}, je veux un devis rapide pour un site vitrine.` &&
      activity.direction === "inbound") ||
    (activity.contactName === "Awa Services" &&
      activity.lastMessage === "Relance envoyee avec proposition de rendez-vous." &&
      activity.direction === "outbound")
  );
}

async function loadCompanyModuleData(company: SaasCompany) {
  const [allLeads, allRuns, allSessions, allEvents, allActivity] = await Promise.all([
    loadCrmLeads(),
    loadSourcingRuns(),
    loadSourcingLiveSessions(),
    loadSourcingLiveEvents(),
    loadWhatsAppActivity()
  ]);

  const cleanedLeads = allLeads.filter((lead) => !isLegacySeedLead(lead));
  const cleanedRuns = allRuns.filter((run) => !isLegacySeedRun(run));
  const cleanedActivity = allActivity.filter((activity) => !isLegacySeedActivity(activity, company));

  const writes: Promise<unknown>[] = [];
  if (cleanedLeads.length !== allLeads.length) writes.push(saveCrmLeads(cleanedLeads));
  if (cleanedRuns.length !== allRuns.length) writes.push(saveSourcingRuns(cleanedRuns));
  if (cleanedActivity.length !== allActivity.length) writes.push(saveWhatsAppActivity(cleanedActivity));
  if (writes.length) await Promise.all(writes);

  return {
    leads: cleanedLeads.filter((lead) => lead.companyId === company.id),
    runs: cleanedRuns.filter((run) => run.companyId === company.id),
    liveSessions: allSessions.filter((session) => session.companyId === company.id),
    liveEvents: allEvents.filter((event) => event.companyId === company.id),
    activity: cleanedActivity.filter((entry) => entry.companyId === company.id)
  };
}

async function resolveAuthenticatedContext(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;

  const [sessions, users, companies] = await Promise.all([loadSessions(), loadUsers(), loadCompanies()]);
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;

  const user = users.find((item) => item.id === session.userId && item.companyId === session.companyId);
  const company = companies.find((item) => item.id === session.companyId);
  if (!user || !company || !user.verifiedAt) return null;
  return { session, user, company };
}

function toPublicCompany(company: SaasCompany, subscriptions: SaasSubscription[] = []) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    ownerEmail: company.ownerEmail,
    description: company.description,
    businessEmail: company.businessEmail,
    businessPhone: company.businessPhone,
    industry: company.industry,
    serviceCatalog: company.serviceCatalog,
    targetCustomers: company.targetCustomers,
    agentSkills: company.agentSkills,
    agentInstructions: company.agentInstructions,
    status: company.status,
    modules: company.modules.map((item) => {
      const module = moduleByKey(item.moduleKey);
      const subscription = subscriptions.find((entry) => entry.moduleKey === item.moduleKey);
      return {
        ...item,
        title: module.title,
        description: module.description,
        monthlyPrice: module.monthlyPrice,
        subscriptionStatus: subscription?.status ?? "trial",
        nextBillingDate: subscription?.nextBillingDate ?? null,
        lastInvoiceId: subscription?.lastInvoiceId ?? null
      };
    }),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt
  };
}

function toPublicUser(user: SaasUser) {
  return {
    id: user.id,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    verified: Boolean(user.verifiedAt),
    role: user.role,
    createdAt: user.createdAt
  };
}

function getPublicAppUrl(req: Request) {
  return (process.env.APP_URL ?? req.get("origin") ?? req.get("referer") ?? "http://localhost:1010").replace(/\/$/, "");
}

async function sendSourcingVerificationEmail(req: Request, user: SaasUser) {
  const tokenId = randomBytes(32).toString("hex");
  const appUrl = getPublicAppUrl(req);
  const verifyUrl = `${appUrl}/user/verify-email?token=${tokenId}`;
  const runtimeEmail = await getRuntimeEmailAccount("main");
  const engine = new EmailEngine();

  await engine.send({
    account: runtimeEmail,
    from: `${runtimeEmail.name ?? "Oumar Business"} <${runtimeEmail.email}>`,
    to: [user.email],
    subject: "Confirmez votre email sourcing",
    text: `Bonjour ${user.name},\n\nConfirmez votre email pour activer votre espace sourcing :\n${verifyUrl}\n\nCe lien expire dans 24 heures.`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#0e0e0e;color:#fff;border-radius:16px">
      <h2 style="color:#d4a020;margin:0 0 16px">Confirmez votre email</h2>
      <p>Bonjour <strong>${user.name}</strong>,</p>
      <p>Confirmez votre email pour activer votre espace sourcing.</p>
      <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#d4a020;color:#000;border-radius:12px;font-weight:bold;text-decoration:none">Confirmer mon email</a>
      <p style="color:#888;font-size:12px">Ce lien expire dans 24 heures.</p>
    </div>`
  });

  return {
    id: tokenId,
    userId: user.id,
    email: user.email,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
  } satisfies EmailVerifyToken;
}

function toPublicAgentProfile(profile: SaasAgentProfile, runs: SaasSourcingRun[] = []) {
  const relatedRuns = runs.filter((run) => run.agentKey === profile.agentKey);
  const lastRun = relatedRuns
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
  return {
    id: profile.id,
    companyId: profile.companyId,
    moduleKey: profile.moduleKey,
    moduleTitle: moduleByKey(profile.moduleKey).title,
    agentKey: profile.agentKey,
    displayName: profile.displayName,
    isEnabled: profile.isEnabled,
    tone: profile.tone,
    modelProvider: profile.modelProvider,
    modelId: profile.modelId,
    systemPrompt: profile.systemPrompt,
    personality: profile.personality,
    identity: profile.identity,
    userContext: profile.userContext,
    welcomeMessage: profile.welcomeMessage,
    businessName: profile.businessName,
    businessEmail: profile.businessEmail,
    businessPhone: profile.businessPhone,
    faq: profile.faq,
    activeHours: profile.activeHours,
    simpleRules: profile.simpleRules,
    escalationThreshold: profile.escalationThreshold,
    requireApproval: profile.requireApproval,
    allowedTools: profile.allowedTools,
    missionConfig: profile.missionConfig,
    metrics: {
      runs: relatedRuns.length,
      prospects: relatedRuns.reduce((sum, run) => sum + run.foundCount, 0),
      conversions: relatedRuns.reduce((sum, run) => sum + run.prospects.filter((prospect) => Boolean(prospect.pushedToCrmAt)).length, 0),
      sources: relatedRuns.length,
      lastRunAt: lastRun?.createdAt ?? null
    },
    updatedAt: profile.updatedAt
  };
}

function toPublicSubscription(subscription: SaasSubscription, invoices: SaasInvoice[]) {
  const module = moduleByKey(subscription.moduleKey);
  const lastInvoice = subscription.lastInvoiceId ? invoices.find((invoice) => invoice.id === subscription.lastInvoiceId) : null;
  return {
    id: subscription.id,
    moduleKey: subscription.moduleKey,
    moduleTitle: module.title,
    planName: subscription.planName,
    monthlyPrice: subscription.monthlyPrice,
    currency: subscription.currency,
    status: subscription.status,
    startDate: subscription.startDate,
    nextBillingDate: subscription.nextBillingDate,
    lastPaymentDate: subscription.lastPaymentDate ?? null,
    lastInvoiceId: subscription.lastInvoiceId ?? null,
    lastInvoiceStatus: lastInvoice?.status ?? null,
    accessible: isAccessibleSubscriptionStatus(subscription.status),
    updatedAt: subscription.updatedAt
  };
}

function toPublicInvoice(invoice: SaasInvoice) {
  return {
    ...invoice,
    moduleTitle: moduleByKey(invoice.moduleKey).title
  };
}

function toPublicLead(lead: SaasCrmLead) {
  return lead;
}

function toPublicSourcingRun(run: SaasSourcingRun) {
  return run;
}

function toPublicSourcingSession(session: SaasSourcingSession) {
  return {
    id: session.id,
    companyId: session.companyId,
    moduleKey: session.moduleKey,
    status: session.status,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    stoppedAt: session.stoppedAt ?? null,
    activeAgentKeys: session.activeAgentKeys,
    pausedAgentKeys: session.pausedAgentKeys ?? [],
    brief: session.brief ?? "",
    agentBriefs: session.agentBriefs ?? {},
    stopReason: session.stopReason ?? null,
    cycleCount: session.cycleCount,
    lastCycleAt: session.lastCycleAt ?? null,
    currentAgentKey: session.currentAgentKey ?? null
  };
}

function toPublicSourcingLiveEvent(event: SaasSourcingLiveEvent) {
  return {
    id: event.id,
    sessionId: event.sessionId,
    companyId: event.companyId,
    agentKey: event.agentKey ?? null,
    agentName: event.agentName ?? null,
    type: event.type,
    level: event.level,
    message: event.message,
    runId: event.runId ?? null,
    prospectCount: event.prospectCount ?? null,
    createdAt: event.createdAt
  };
}

function toPublicWhatsAppActivity(activity: SaasWhatsAppActivity) {
  return activity;
}

function buildDashboardAlerts(subscriptions: SaasSubscription[], profiles: SaasAgentProfile[]) {
  const alerts: Array<{ type: "warning" | "info"; message: string }> = [];
  for (const subscription of subscriptions) {
    if (subscription.status === "past_due") {
      alerts.push({ type: "warning", message: `${moduleByKey(subscription.moduleKey).title} est en retard de paiement.` });
    }
    if (subscription.status === "paused") {
      alerts.push({ type: "info", message: `${moduleByKey(subscription.moduleKey).title} est actuellement en pause.` });
    }
  }
  for (const profile of profiles) {
    if (!profile.businessPhone.trim()) {
      alerts.push({ type: "info", message: `Ajoute un numero business pour ${profile.displayName}.` });
      break;
    }
  }
  return alerts;
}

async function getCompanyRuntime(company: SaasCompany) {
  const [{ company: syncedCompany, subscriptions, invoices }, profiles] = await Promise.all([
    ensureSubscriptionStateForCompany(company),
    ensureAgentProfiles(company)
  ]);
  const moduleData = await loadCompanyModuleData(syncedCompany);
  return { company: syncedCompany, subscriptions, invoices, profiles, ...moduleData };
}

saasRouter.post("/auth/register", sourcingAuthRateLimit, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const companyName = typeof req.body?.company === "string" ? req.body.company.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (name.length < 2) return res.status(400).json({ error: "Le nom est obligatoire." });
    if (companyName.length < 2) return res.status(400).json({ error: "Le nom de l'entreprise est obligatoire." });
    if (!email.includes("@")) return res.status(400).json({ error: "Email invalide." });
    if (password.length < 6) return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caracteres." });

    const [users, companies, subscriptions, verifyTokens] = await Promise.all([
      loadUsers(),
      loadCompanies(),
      loadSubscriptions(),
      loadVerifyTokens()
    ]);
    if (users.some((item) => item.email === email)) {
      return res.status(400).json({ error: "Un compte utilisateur sourcing existe deja avec cet email." });
    }

    const now = new Date().toISOString();
    const baseSlug = slugifyCompanyName(companyName) || `workspace-${randomUUID().slice(0, 6)}`;
    const slug = companies.some((item) => item.slug === baseSlug) ? `${baseSlug}-${randomUUID().slice(0, 6)}` : baseSlug;

    const company: SaasCompany = {
      id: randomUUID(),
      name: companyName,
      slug,
      ownerEmail: email,
      description: "",
      businessEmail: email,
      businessPhone: "",
      industry: "",
      serviceCatalog: "",
      targetCustomers: "",
      agentSkills: [],
      agentInstructions: "",
      status: "active",
      modules: [
        {
          moduleKey: "sourcing-commercial",
          active: true,
          activatedAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    const sourcingSubscription = createDefaultSubscription(company.id, "sourcing-commercial", now);
    sourcingSubscription.status = "active";
    sourcingSubscription.planName = "Test";
    sourcingSubscription.lastPaymentDate = now;
    sourcingSubscription.updatedAt = now;

    const user: SaasUser = {
      id: randomUUID(),
      companyId: company.id,
      name,
      email,
      passwordHash: hashPassword(password),
      verifiedAt: "",
      role: "owner",
      createdAt: now,
      updatedAt: now
    };

    let verifyToken: EmailVerifyToken;
    try {
      verifyToken = await sendSourcingVerificationEmail(req, user);
    } catch {
      return res.status(502).json({ error: "Impossible d'envoyer l'email de confirmation pour le moment." });
    }

    await saveCompanies([company, ...companies]);
    await saveUsers([user, ...users]);
    await saveVerifyTokens([...verifyTokens.filter((item) => item.userId !== user.id), verifyToken]);
    await saveSubscriptions([sourcingSubscription, ...subscriptions]);
    await ensureAgentProfiles(company);
    clearSessionCookie(res);

    res.status(201).json({ ok: true, requiresVerification: true, email: user.email });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/auth/login", sourcingAuthRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const [users, companies, sessions] = await Promise.all([loadUsers(), loadCompanies(), loadSessions()]);
    const user = users.find((item) => item.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Email ou mot de passe invalide." });
    }
    if (!user.verifiedAt) {
      return res.status(403).json({
        error: "Confirmez votre email avant de vous connecter.",
        code: "EMAIL_NOT_VERIFIED"
      });
    }

    const company = companies.find((item) => item.id === user.companyId);
    if (!company) return res.status(404).json({ error: "Entreprise SaaS introuvable." });

    const now = new Date().toISOString();
    const session: SaasSession = {
      id: randomUUID(),
      userId: user.id,
      companyId: company.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    };

    await saveSessions([session, ...sessions.filter((item) => item.userId !== user.id)]);
    const runtime = await getCompanyRuntime(company);
    setSessionCookie(res, session.id);

    res.json({
      ok: true,
      user: toPublicUser(user),
      company: toPublicCompany(runtime.company, runtime.subscriptions)
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/auth/resend-verification", sourcingAuthRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!email.includes("@")) return res.status(400).json({ error: "Email invalide." });

    const [users, verifyTokens] = await Promise.all([loadUsers(), loadVerifyTokens()]);
    const user = users.find((item) => item.email === email);
    if (!user || user.verifiedAt) return res.json({ ok: true });

    const token = await sendSourcingVerificationEmail(req, user);
    await saveVerifyTokens([...verifyTokens.filter((item) => item.userId !== user.id), token]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/auth/verify-email", sourcingAuthRateLimit, async (req, res, next) => {
  try {
    const tokenId = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!tokenId) return res.status(400).json({ error: "Token manquant." });

    const [users, tokens] = await Promise.all([loadUsers(), loadVerifyTokens()]);
    const token = tokens.find((item) => item.id === tokenId);
    if (!token) return res.status(400).json({ error: "Lien invalide ou deja utilise." });

    const index = users.findIndex((item) => item.id === token.userId);
    if (index === -1) {
      await saveVerifyTokens(tokens.filter((item) => item.id !== tokenId));
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    const now = new Date().toISOString();
    users[index] = {
      ...users[index]!,
      verifiedAt: now,
      updatedAt: now
    };

    await saveUsers(users);
    await saveVerifyTokens(tokens.filter((item) => item.id !== tokenId));
    clearSessionCookie(res);

    res.json({ ok: true, user: toPublicUser(users[index]!) });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/auth/logout", async (req, res, next) => {
  try {
    const sessionId = getSessionIdFromRequest(req);
    if (sessionId) {
      const sessions = await loadSessions();
      await saveSessions(sessions.filter((item) => item.id !== sessionId));
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/auth/me", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ authenticated: false });
    }

    const runtime = await getCompanyRuntime(context.company);
    res.json({
      authenticated: true,
      user: toPublicUser(context.user),
      company: toPublicCompany(runtime.company, runtime.subscriptions)
    });
  } catch (error) {
    next(error);
  }
});

// ─── Mot de passe oublié ──────────────────────────────────────────────────

saasRouter.post("/auth/forgot-password", sourcingAuthRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!email.includes("@")) return res.status(400).json({ error: "Email invalide." });

    const users = await loadUsers();
    const user = users.find((u) => u.email === email);
    // Anti-enumeration : on renvoie toujours OK
    if (!user) return res.json({ ok: true });

    const tokenId = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1h
    const tokens = await loadResetTokens();
    await saveResetTokens([...tokens.filter((t) => t.userId !== user.id), { id: tokenId, userId: user.id, email: user.email, expiresAt }]);

    const origin = (req.get("origin") ?? req.get("referer") ?? "http://localhost:3000").replace(/\/$/, "");
    const resetUrl = `${origin}/user/reset-password?token=${tokenId}`;

    try {
      const account = await getRuntimeEmailAccount("main");
      const engine = new EmailEngine();
      await engine.send({
        account,
        from: `${account.name ?? "Oumar Business"} <${account.email}>`,
        to: [user.email],
        subject: "Reinitialisation de votre mot de passe",
        text: `Bonjour ${user.name},\n\nCliquez sur ce lien pour reinitialiser votre mot de passe :\n${resetUrl}\n\nCe lien expire dans 1 heure.\n\nSi vous n'avez pas demande de reinitialisation, ignorez cet email.`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#0e0e0e;color:#fff;border-radius:16px">
          <h2 style="color:#d4a020;margin:0 0 16px">Reinitialisation du mot de passe</h2>
          <p>Bonjour <strong>${user.name}</strong>,</p>
          <p>Cliquez sur le bouton ci-dessous pour reinitialiser votre mot de passe. Ce lien expire dans <strong>1 heure</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#d4a020;color:#000;border-radius:12px;font-weight:bold;text-decoration:none">Reinitialiser mon mot de passe</a>
          <p style="color:#888;font-size:12px">Si vous n'avez pas demande de reinitialisation, ignorez cet email. Ce lien est a usage unique.</p>
        </div>`
      });
    } catch {
      // Email non configure — le token est quand meme sauvegarde
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/auth/reset-password", sourcingAuthRateLimit, async (req, res, next) => {
  try {
    const tokenId = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!tokenId) return res.status(400).json({ error: "Token manquant." });
    if (password.length < 6) return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caracteres." });

    const tokens = await loadResetTokens();
    const token = tokens.find((t) => t.id === tokenId);
    if (!token) return res.status(400).json({ error: "Lien invalide ou deja utilise." });
    if (new Date(token.expiresAt) < new Date()) {
      await saveResetTokens(tokens.filter((t) => t.id !== tokenId));
      return res.status(400).json({ error: "Ce lien a expire. Veuillez en generer un nouveau." });
    }

    const users = await loadUsers();
    const idx = users.findIndex((u) => u.id === token.userId);
    if (idx === -1) return res.status(404).json({ error: "Utilisateur introuvable." });

    users[idx] = { ...users[idx]!, passwordHash: hashPassword(password), updatedAt: new Date().toISOString() };
    await saveUsers(users);
    await saveResetTokens(tokens.filter((t) => t.id !== tokenId));

    res.json({ ok: true, message: "Mot de passe reinitialise avec succes." });
  } catch (error) {
    next(error);
  }
});

// ─── Profil utilisateur ────────────────────────────────────────────────────

saasRouter.patch("/auth/profile", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) return res.status(401).json({ error: "Session invalide." });

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name && name.length < 2) return res.status(400).json({ error: "Le nom doit contenir au moins 2 caracteres." });

    const users = await loadUsers();
    const idx = users.findIndex((u) => u.id === context.user.id);
    if (idx === -1) return res.status(404).json({ error: "Utilisateur introuvable." });

    users[idx] = { ...users[idx]!, ...(name ? { name } : {}), updatedAt: new Date().toISOString() };
    await saveUsers(users);
    res.json({ ok: true, user: toPublicUser(users[idx]!) });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/auth/change-password", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) return res.status(401).json({ error: "Session invalide." });

    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!verifyPassword(currentPassword, context.user.passwordHash)) {
      return res.status(400).json({ error: "Mot de passe actuel incorrect." });
    }
    if (newPassword.length < 6) return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caracteres." });

    const users = await loadUsers();
    const idx = users.findIndex((u) => u.id === context.user.id);
    if (idx === -1) return res.status(404).json({ error: "Utilisateur introuvable." });

    users[idx] = { ...users[idx]!, passwordHash: hashPassword(newPassword), updatedAt: new Date().toISOString() };
    await saveUsers(users);
    res.json({ ok: true, message: "Mot de passe modifie avec succes." });
  } catch (error) {
    next(error);
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────

saasRouter.get("/dashboard", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const activeSubscriptions = runtime.subscriptions.filter((item) => isAccessibleSubscriptionStatus(item.status));
    const alerts = buildDashboardAlerts(runtime.subscriptions, runtime.profiles);

    res.json({
      company: toPublicCompany(runtime.company, runtime.subscriptions),
      user: toPublicUser(context.user),
      stats: {
        activeModules: activeSubscriptions.length,
        pendingInvoices: runtime.invoices.filter((invoice) => invoice.status === "sent" || invoice.status === "overdue").length,
        crmLeads: runtime.leads.length,
        sourcingRuns: runtime.runs.length
      },
      alerts,
      subscriptions: runtime.subscriptions.map((item) => toPublicSubscription(item, runtime.invoices))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/company", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    res.json({ company: toPublicCompany(runtime.company, runtime.subscriptions) });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/subscription", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const [runtime, plans, paymentRequests] = await Promise.all([
      getCompanyRuntime(context.company),
      loadSourcingPlans(),
      loadPaymentRequests()
    ]);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "sourcing-commercial") ?? null;
    const requests = paymentRequests
      .filter((item) => item.companyId === context.company.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const currentPlan = subscription
      ? plans.find((plan) => plan.name === subscription.planName && plan.monthlyPrice === subscription.monthlyPrice) ?? null
      : null;

    res.json({
      subscription: subscription ? toPublicSubscription(subscription, runtime.invoices) : null,
      currentPlan,
      latestRequest: requests[0] ? toPublicPaymentRequest(requests[0]) : null
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/payment-methods", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    void context;

    const methods = await loadPaymentMethods();
    res.json({
      ok: true,
      methods: {
        ...methods,
        configured: Boolean(methods.waveNumber || methods.orangeMoneyNumber)
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/payments/requests/me", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const requests = (await loadPaymentRequests())
      .filter((item) => item.companyId === context.company.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => toPublicPaymentRequest(item));

    res.json({ ok: true, requests });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/payments/requests", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const planId = typeof req.body?.planId === "string" ? req.body.planId.trim() : "";
    const method = req.body?.method === "orange_money" ? "orange_money" : req.body?.method === "wave" ? "wave" : "";
    const senderPhone = typeof req.body?.senderPhone === "string" ? req.body.senderPhone.trim() : "";
    const reference = typeof req.body?.reference === "string" ? req.body.reference.trim() : "";

    if (!planId) return res.status(400).json({ error: "Le plan est obligatoire." });
    if (!method) return res.status(400).json({ error: "La methode de paiement est obligatoire." });
    if (senderPhone.length < 6) {
      return res.status(400).json({ error: "Le numero de l'expediteur est obligatoire." });
    }

    const [plans, methods, requests, runtime] = await Promise.all([
      loadSourcingPlans(),
      loadPaymentMethods(),
      loadPaymentRequests(),
      getCompanyRuntime(context.company)
    ]);
    const plan = plans.find((item) => item.id === planId && item.isActive);
    if (!plan) return res.status(404).json({ error: "Plan sourcing introuvable." });

    const methodConfigured = method === "wave" ? Boolean(methods.waveNumber) : Boolean(methods.orangeMoneyNumber);
    if (!methodConfigured) {
      return res.status(400).json({ error: "Cette methode de paiement n'est pas encore disponible." });
    }

    const currentSubscription = runtime.subscriptions.find((item) => item.moduleKey === "sourcing-commercial") ?? null;
    if (
      currentSubscription?.status === "active" &&
      currentSubscription.planName === plan.name &&
      currentSubscription.monthlyPrice === plan.monthlyPrice
    ) {
      return res.status(400).json({ error: "Ce plan est deja actif pour votre entreprise." });
    }

    const duplicatePending = requests.find(
      (item) => item.companyId === context.company.id && item.planId === plan.id && item.status === "pending"
    );
    if (duplicatePending) {
      return res.status(409).json({ error: "Une demande est deja en attente pour ce plan." });
    }

    const now = new Date().toISOString();
    const paymentRequest: PaymentRequest = {
      id: randomUUID(),
      companyId: context.company.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      companyName: context.company.name,
      planId: plan.id,
      planName: plan.name,
      amount: plan.monthlyPrice,
      method,
      senderPhone,
      reference,
      status: "pending",
      createdAt: now,
      updatedAt: now
    };

    await savePaymentRequests([paymentRequest, ...requests]);
    res.status(201).json({ ok: true, request: toPublicPaymentRequest(paymentRequest) });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/company", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const nextCompany = await updateCompanyProfile(context.company.id, req.body);
    const runtime = await getCompanyRuntime(nextCompany);
    res.json({ ok: true, company: toPublicCompany(runtime.company, runtime.subscriptions) });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/settings", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const [runtime, whatsappSettings, metaConfigs, bindings, emailConfigs] = await Promise.all([
      getCompanyRuntime(context.company),
      loadWhatsAppSettings(),
      loadWhatsAppMetaConfigs(),
      loadWhatsAppBindings(),
      loadEmailConfigs()
    ]);

    const companyMetaConfig = metaConfigs.find((item) => item.companyId === context.company.id) ?? null;
    const companyBindings = bindings.filter((item) => item.companyId === context.company.id);
    const companySessions = await prisma.wASession.findMany({
      where: { id: { in: companyBindings.map((item) => item.sessionId) } }
    });
    const connectedSessions = companySessions.filter((session: { status: string | null }) =>
      session.status === "connected" || session.status === "open" || session.status === "configured"
    ).length;
    const companyEmailConfig = emailConfigs.find((item) => item.companyId === context.company.id) ?? null;

    res.json({
      company: {
        status: buildCompanySettingsStatus(runtime.company),
        companyName: runtime.company.name,
        skillsCount: runtime.company.agentSkills.length,
        industry: runtime.company.industry
      },
      whatsapp: {
        status: buildWhatsAppSettingsStatus({
          hasMetaConfig: Boolean(companyMetaConfig),
          baileysSessions: companyBindings.filter((item) => item.mode === "baileys").length,
          connectedSessions
        }),
        activeMode:
          companyMetaConfig
            ? "cloud"
            : companyBindings.some((item) => item.mode === "baileys")
              ? "baileys"
              : null,
        connectedSessionCount: connectedSessions,
        hasMetaConfig: Boolean(companyMetaConfig),
        hasBaileysSession: companyBindings.some((item) => item.mode === "baileys")
      },
      email: {
        status:
          companyEmailConfig?.smtpValidatedAt || companyEmailConfig?.imapValidatedAt
            ? "connected"
            : companyEmailConfig?.smtpHost || companyEmailConfig?.senderEmail || companyEmailConfig?.imapHost
              ? "configuration_in_progress"
              : "not_configured",
        senderEmail: companyEmailConfig?.senderEmail || runtime.company.businessEmail,
        smtpConfigured: Boolean(companyEmailConfig?.smtpHost && companyEmailConfig?.smtpUsername && companyEmailConfig?.smtpPassword),
        imapConfigured: Boolean(companyEmailConfig?.imapHost && companyEmailConfig?.imapUsername && companyEmailConfig?.imapPassword)
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/settings/company", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    res.json({ company: toPublicCompany(runtime.company, runtime.subscriptions) });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/settings/company", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const nextCompany = await updateCompanyProfile(context.company.id, req.body);
    const runtime = await getCompanyRuntime(nextCompany);
    res.json({ ok: true, company: toPublicCompany(runtime.company, runtime.subscriptions) });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/settings/whatsapp", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const [runtime, settingsList, metaConfigs, bindings] = await Promise.all([
      getCompanyRuntime(context.company),
      loadWhatsAppSettings(),
      loadWhatsAppMetaConfigs(),
      loadWhatsAppBindings()
    ]);

    const profile = runtime.profiles.find((item) => item.moduleKey === "whatsapp-business") ?? null;
    const storedSettings = settingsList.find((item) => item.companyId === context.company.id) ?? null;
    const metaConfig = metaConfigs.find((item) => item.companyId === context.company.id) ?? null;
    const companyBindings = bindings.filter((item) => item.companyId === context.company.id);
    const sessions = await prisma.wASession.findMany({
      where: { id: { in: companyBindings.map((item) => item.sessionId) } },
      orderBy: { createdAt: "desc" }
    });
    const connectedSessionCount = sessions.filter((session: { status: string | null }) =>
      session.status === "connected" || session.status === "open" || session.status === "configured"
    ).length;

    res.json({
      settings: {
        displayName: profile?.displayName || runtime.company.name,
        businessPhone: runtime.company.businessPhone,
        welcomeMessage: profile?.welcomeMessage || "",
        awayMessage: storedSettings?.awayMessage || "",
        activeHours: profile?.activeHours || "",
        simpleRules: profile?.simpleRules || "",
        escalationThreshold: profile?.escalationThreshold || "",
        faq: profile?.faq || [],
        preferredConnectionMode: storedSettings?.preferredConnectionMode || "baileys",
        metaConfig: metaConfig
          ? {
              phoneNumberId: metaConfig.phoneNumberId,
              verifyToken: metaConfig.verifyToken,
              displayPhoneNumber: metaConfig.displayPhoneNumber,
              accessTokenMasked: maskSecret(metaConfig.accessToken),
              webhookUrl: "/api/whatsapp/cloud/webhook",
              sessionId: metaConfig.sessionId
            }
          : null,
        summary: {
          status: buildWhatsAppSettingsStatus({
            hasMetaConfig: Boolean(metaConfig),
            baileysSessions: companyBindings.filter((item) => item.mode === "baileys").length,
            connectedSessions: connectedSessionCount
          }),
          activeMode:
            metaConfig
              ? "cloud"
              : companyBindings.some((item) => item.mode === "baileys")
                ? "baileys"
                : null,
          connectedSessionCount,
          hasMetaConfig: Boolean(metaConfig),
          hasBaileysSession: companyBindings.some((item) => item.mode === "baileys")
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/settings/whatsapp", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const [companies, profiles, settingsList] = await Promise.all([
      loadCompanies(),
      loadAgentProfiles(),
      loadWhatsAppSettings()
    ]);
    const updatedAt = new Date().toISOString();

    const nextCompanies = companies.map((item) =>
      item.id === context.company.id
        ? {
            ...item,
            businessPhone: typeof req.body?.businessPhone === "string" ? req.body.businessPhone.trim() : item.businessPhone,
            updatedAt
          }
        : item
    );

    const nextProfiles = profiles.map((item) =>
      item.companyId === context.company.id && item.moduleKey === "whatsapp-business"
        ? {
            ...item,
            displayName: typeof req.body?.displayName === "string" && req.body.displayName.trim() ? req.body.displayName.trim() : item.displayName,
            welcomeMessage: typeof req.body?.welcomeMessage === "string" ? req.body.welcomeMessage.trim() : item.welcomeMessage,
            businessPhone: typeof req.body?.businessPhone === "string" ? req.body.businessPhone.trim() : item.businessPhone,
            faq: Array.isArray(req.body?.faq) ? req.body.faq.map(String).map((entry: string) => entry.trim()).filter(Boolean) : item.faq,
            activeHours: typeof req.body?.activeHours === "string" ? req.body.activeHours.trim() : item.activeHours,
            simpleRules: typeof req.body?.simpleRules === "string" ? req.body.simpleRules.trim() : item.simpleRules,
            escalationThreshold:
              typeof req.body?.escalationThreshold === "string" ? req.body.escalationThreshold.trim() : item.escalationThreshold,
            updatedAt
          }
        : item
    );

    const existing = settingsList.find((item) => item.companyId === context.company.id) ?? null;
    const nextSetting: SaasWhatsAppSettings = {
      id: existing?.id ?? randomUUID(),
      companyId: context.company.id,
      awayMessage: typeof req.body?.awayMessage === "string" ? req.body.awayMessage.trim() : existing?.awayMessage ?? "",
      preferredConnectionMode: req.body?.preferredConnectionMode === "cloud" ? "cloud" : "baileys",
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt
    };
    const nextSettingsList = [nextSetting, ...settingsList.filter((item) => item.companyId !== context.company.id)];

    await Promise.all([saveCompanies(nextCompanies), saveAgentProfiles(nextProfiles), saveWhatsAppSettings(nextSettingsList)]);
    const nextCompany = nextCompanies.find((item) => item.id === context.company.id)!;
    const runtime = await getCompanyRuntime(nextCompany);
    const profile = runtime.profiles.find((item) => item.moduleKey === "whatsapp-business")!;

    res.json({
      ok: true,
      settings: {
        displayName: profile.displayName,
        businessPhone: runtime.company.businessPhone,
        welcomeMessage: profile.welcomeMessage,
        awayMessage: nextSetting.awayMessage,
        activeHours: profile.activeHours,
        simpleRules: profile.simpleRules,
        escalationThreshold: profile.escalationThreshold,
        faq: profile.faq,
        preferredConnectionMode: nextSetting.preferredConnectionMode
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/settings/email", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const [runtime, emailConfigs] = await Promise.all([getCompanyRuntime(context.company), loadEmailConfigs()]);
    const config = emailConfigs.find((item) => item.companyId === context.company.id) ?? null;

    res.json({
      config: {
        senderName: config?.senderName || runtime.company.name,
        senderEmail: config?.senderEmail || runtime.company.businessEmail,
        replyToEmail: config?.replyToEmail || runtime.company.businessEmail,
        signature: config?.signature || "",
        smtpHost: config?.smtpHost || "",
        smtpPort: config?.smtpPort ?? 587,
        smtpSecure: config?.smtpSecure ?? false,
        smtpUsername: config?.smtpUsername || "",
        smtpPasswordMasked: config?.smtpPassword ? maskSecret(config.smtpPassword) : "",
        smtpConfigured: Boolean(config?.smtpHost && config?.smtpUsername && config?.smtpPassword),
        smtpValidatedAt: config?.smtpValidatedAt ?? null,
        imapHost: config?.imapHost || "",
        imapPort: config?.imapPort ?? 993,
        imapSecure: config?.imapSecure ?? true,
        imapUsername: config?.imapUsername || "",
        imapPasswordMasked: config?.imapPassword ? maskSecret(config.imapPassword) : "",
        imapConfigured: Boolean(config?.imapHost && config?.imapUsername && config?.imapPassword),
        imapValidatedAt: config?.imapValidatedAt ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/settings/email", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const [companies, emailConfigs] = await Promise.all([loadCompanies(), loadEmailConfigs()]);
    const existing = emailConfigs.find((item) => item.companyId === context.company.id) ?? null;
    const updatedAt = new Date().toISOString();

    const senderEmail =
      typeof req.body?.senderEmail === "string" && req.body.senderEmail.trim()
        ? normalizeEmail(req.body.senderEmail)
        : existing?.senderEmail ?? context.company.businessEmail;
    const replyToEmail =
      typeof req.body?.replyToEmail === "string" && req.body.replyToEmail.trim()
        ? normalizeEmail(req.body.replyToEmail)
        : existing?.replyToEmail ?? senderEmail;

    const nextConfig: SaasEmailConfig = {
      id: existing?.id ?? randomUUID(),
      companyId: context.company.id,
      senderName: typeof req.body?.senderName === "string" && req.body.senderName.trim() ? req.body.senderName.trim() : existing?.senderName ?? context.company.name,
      senderEmail,
      replyToEmail,
      signature: typeof req.body?.signature === "string" ? req.body.signature.trim() : existing?.signature ?? "",
      smtpHost: typeof req.body?.smtpHost === "string" ? req.body.smtpHost.trim() : existing?.smtpHost ?? "",
      smtpPort: typeof req.body?.smtpPort === "number" ? req.body.smtpPort : existing?.smtpPort ?? 587,
      smtpSecure: typeof req.body?.smtpSecure === "boolean" ? req.body.smtpSecure : existing?.smtpSecure ?? false,
      smtpUsername: typeof req.body?.smtpUsername === "string" ? req.body.smtpUsername.trim() : existing?.smtpUsername ?? "",
      smtpPassword:
        typeof req.body?.smtpPassword === "string" && req.body.smtpPassword.trim()
          ? req.body.smtpPassword.trim()
          : existing?.smtpPassword ?? "",
      smtpValidatedAt: existing?.smtpValidatedAt,
      imapHost: typeof req.body?.imapHost === "string" ? req.body.imapHost.trim() : existing?.imapHost ?? "",
      imapPort: typeof req.body?.imapPort === "number" ? req.body.imapPort : existing?.imapPort ?? 993,
      imapSecure: typeof req.body?.imapSecure === "boolean" ? req.body.imapSecure : existing?.imapSecure ?? true,
      imapUsername: typeof req.body?.imapUsername === "string" ? req.body.imapUsername.trim() : existing?.imapUsername ?? "",
      imapPassword:
        typeof req.body?.imapPassword === "string" && req.body.imapPassword.trim()
          ? req.body.imapPassword.trim()
          : existing?.imapPassword ?? "",
      imapValidatedAt: existing?.imapValidatedAt,
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt
    };

    const nextCompanies = companies.map((item) =>
      item.id === context.company.id
        ? {
            ...item,
            businessEmail: senderEmail,
            updatedAt
          }
        : item
    );

    await Promise.all([
      saveEmailConfigs([nextConfig, ...emailConfigs.filter((item) => item.companyId !== context.company.id)]),
      saveCompanies(nextCompanies)
    ]);

    res.json({
      ok: true,
      config: {
        senderName: nextConfig.senderName,
        senderEmail: nextConfig.senderEmail,
        replyToEmail: nextConfig.replyToEmail,
        signature: nextConfig.signature,
        smtpHost: nextConfig.smtpHost,
        smtpPort: nextConfig.smtpPort,
        smtpSecure: nextConfig.smtpSecure,
        smtpUsername: nextConfig.smtpUsername,
        smtpPasswordMasked: nextConfig.smtpPassword ? maskSecret(nextConfig.smtpPassword) : "",
        smtpConfigured: Boolean(nextConfig.smtpHost && nextConfig.smtpUsername && nextConfig.smtpPassword),
        smtpValidatedAt: nextConfig.smtpValidatedAt ?? null,
        imapHost: nextConfig.imapHost,
        imapPort: nextConfig.imapPort,
        imapSecure: nextConfig.imapSecure,
        imapUsername: nextConfig.imapUsername,
        imapPasswordMasked: nextConfig.imapPassword ? maskSecret(nextConfig.imapPassword) : "",
        imapConfigured: Boolean(nextConfig.imapHost && nextConfig.imapUsername && nextConfig.imapPassword),
        imapValidatedAt: nextConfig.imapValidatedAt ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const subscriptionsByModule = new Map(runtime.subscriptions.map((item) => [item.moduleKey, item]));
    const modules = moduleCatalog.map((module) => {
      const activation = runtime.company.modules.find((item) => item.moduleKey === module.key);
      const subscription = subscriptionsByModule.get(module.key);
      const invoice = subscription?.lastInvoiceId ? runtime.invoices.find((item) => item.id === subscription.lastInvoiceId) : null;
      return {
        key: module.key,
        title: module.title,
        description: module.description,
        active: activation?.active ?? false,
        activatedAt: activation?.activatedAt ?? null,
        monthlyPrice: module.monthlyPrice,
        currency: "XOF",
        status: subscription?.status ?? "trial",
        nextBillingDate: subscription?.nextBillingDate ?? null,
        lastInvoiceId: subscription?.lastInvoiceId ?? null,
        lastInvoiceStatus: invoice?.status ?? null,
        workspaceHref: `/user/${module.key === "whatsapp-business" ? "whatsapp" : module.key === "crm-intelligent" ? "crm" : module.key === "billing-intelligent" ? "billing" : "sourcing"}`
      };
    });

    res.json({ modules });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/agents", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const allowedModules = new Set(runtime.subscriptions.filter((item) => isAccessibleSubscriptionStatus(item.status)).map((item) => item.moduleKey));
    res.json({
      agents: runtime.profiles
        .filter((item) => allowedModules.has(item.moduleKey))
        .map((item) => toPublicAgentProfile(item, runtime.runs))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/agents/live", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const session = getCurrentLiveSession(runtime.liveSessions);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "sourcing-commercial") ?? null;
    const planLimits = await resolveSourcingPlanLimits(subscription);
    const quota = computeSourcingQuota(runtime.runs, planLimits, {
      accessible: Boolean(subscription && isAccessibleSubscriptionStatus(subscription.status)),
      prospectsKeptThisMonth: runtime.runs
        .filter((run) => run.createdAt >= getCurrentMonthStartIso())
        .reduce((sum, run) => sum + run.foundCount, 0)
    });
    const subscriptionActive = Boolean(subscription && isAccessibleSubscriptionStatus(subscription.status));
    const accessReason = !subscriptionActive
      ? "Active un abonnement sourcing pour lancer les agents."
      : !quota.canRun
        ? "Ton quota mensuel est atteint pour le moment."
        : null;
    const feed = runtime.liveEvents
      .filter((event) => !session || event.sessionId === session.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 40);

    res.json({
      session: session ? toPublicSourcingSession(session) : null,
      feed: feed.map(toPublicSourcingLiveEvent),
      quota,
      access: {
        subscriptionActive,
        canRun: quota.canRun,
        reason: accessReason
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/agents/live/feed", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const session = getCurrentLiveSession(runtime.liveSessions);
    const feed = runtime.liveEvents
      .filter((event) => !session || event.sessionId === session.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 100);

    res.json({
      session: session ? toPublicSourcingSession(session) : null,
      feed: feed.map(toPublicSourcingLiveEvent)
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/prospects", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const prospects = runtime.runs
      .filter((run) => run.moduleKey === "sourcing-commercial")
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .flatMap((run) =>
        run.prospects.map((prospect) => ({
          id: prospect.id,
          name: prospect.company || prospect.name || "Prospect",
          title: prospect.name || prospect.company || "Prospect",
          summary: prospect.summary || prospect.snippet || "",
          sector: run.sector || null,
          zone: run.zone || null,
          url: prospect.website || null,
          email: prospect.email ?? null,
          phone: prospect.phone ?? null,
          score: prospect.score ?? null,
          agentKey: run.agentKey,
          createdAt: run.createdAt,
          sessionId: run.sessionId ?? null,
          cycleIndex: run.cycleIndex ?? null
        }))
      );

    return res.json({ prospects });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/history", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const runs = runtime.runs
      .filter((run) => run.moduleKey === "sourcing-commercial")
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((run) => ({
        id: run.id,
        agentKey: run.agentKey,
        status: run.status,
        keywords: run.brief,
        sector: run.sector || null,
        zone: run.zone || null,
        keptCount: run.foundCount,
        createdAt: run.createdAt,
        sessionId: run.sessionId ?? null,
        cycleIndex: run.cycleIndex ?? null
      }));

    return res.json({ runs });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/agents/live/start", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "sourcing-commercial");
    if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) {
      return res.status(403).json({ error: "Le module sourcing commercial n'est pas actif." });
    }

    const liveAgents = runtime.profiles
      .filter((item) => item.moduleKey === "sourcing-commercial" && item.isEnabled)
      .filter(
        (item) =>
          item.missionConfig.keywords.trim() &&
          item.missionConfig.qualificationInstructions.trim() &&
          Number(item.missionConfig.defaultTargetCount ?? 0) > 0,
      )
      .sort((left, right) => agentRank(left.agentKey) - agentRank(right.agentKey));
    if (!liveAgents.length) {
      return res.status(409).json({ error: "Aucun agent actif n'est pret pour demarrer la session live." });
    }

    const requestedAgentKey =
      typeof req.body?.agentKey === "string" && req.body.agentKey.trim()
        ? req.body.agentKey.trim()
        : null;
    const brief = typeof req.body?.brief === "string" ? req.body.brief.trim() : "";
    const startableAgents = requestedAgentKey
      ? liveAgents.filter((agent) => agent.agentKey === requestedAgentKey)
      : liveAgents;

    if (requestedAgentKey && !startableAgents.length) {
      return res.status(409).json({ error: "Cet agent n'est pas pret ou n'est pas disponible pour le mode live." });
    }

    const currentSession = getCurrentLiveSession(runtime.liveSessions);
    const agentKeysToStart = startableAgents.map((agent) => agent.agentKey);
    const activeBrief = brief || currentSession?.brief || "";

    if (currentSession) {
      const nextActiveKeys = Array.from(new Set([...currentSession.activeAgentKeys, ...agentKeysToStart]));
      const nextPausedKeys = (currentSession.pausedAgentKeys ?? []).filter((agentKey) => !agentKeysToStart.includes(agentKey));

      if (
        currentSession.status === "running" &&
        agentKeysToStart.every((agentKey) => currentSession.activeAgentKeys.includes(agentKey)) &&
        activeBrief === (currentSession.brief ?? "")
      ) {
        return res.json({ ok: true, session: toPublicSourcingSession(currentSession) });
      }

      const resumed = await updateSourcingLiveSession(currentSession.id, (session) => ({
        ...session,
        status: nextActiveKeys.length ? "running" : "paused",
        stopReason: undefined,
        updatedAt: new Date().toISOString(),
        currentAgentKey: undefined,
        activeAgentKeys: nextActiveKeys,
        pausedAgentKeys: nextPausedKeys,
        brief: activeBrief,
        agentBriefs: {
          ...(session.agentBriefs ?? {}),
          ...(requestedAgentKey && brief ? { [requestedAgentKey]: brief } : {})
        }
      }));
      if (!resumed) return res.status(404).json({ error: "Session live introuvable." });

      const message =
        agentKeysToStart.length > 1
          ? "Les agents live ont ete lances."
          : `${agentLabel(agentKeysToStart[0] ?? "")} a ete lance en mode live.`;
      await appendSourcingLiveEvent({
        id: randomUUID(),
        sessionId: resumed.id,
        companyId: resumed.companyId,
        agentKey: agentKeysToStart.length === 1 ? agentKeysToStart[0] : undefined,
        agentName: agentKeysToStart.length === 1 ? startableAgents[0]?.displayName : undefined,
        type: currentSession.status === "paused" ? "session_resumed" : "session_started",
        level: "info",
        message,
        createdAt: new Date().toISOString()
      });
      scheduleSourcingLiveTick(resumed.id, 0);
      return res.json({ ok: true, session: toPublicSourcingSession(resumed) });
    }

    const now = new Date().toISOString();
    const session: SaasSourcingSession = {
      id: randomUUID(),
      companyId: runtime.company.id,
      moduleKey: "sourcing-commercial",
      status: "running",
      startedAt: now,
      updatedAt: now,
      activeAgentKeys: agentKeysToStart,
      pausedAgentKeys: [],
      cycleCount: 0,
      brief: activeBrief,
      agentBriefs: requestedAgentKey && brief ? { [requestedAgentKey]: brief } : {}
    };
    await saveSourcingLiveSession(session);
    await appendSourcingLiveEvent({
      id: randomUUID(),
      sessionId: session.id,
      companyId: session.companyId,
      agentKey: agentKeysToStart.length === 1 ? agentKeysToStart[0] : undefined,
      agentName: agentKeysToStart.length === 1 ? startableAgents[0]?.displayName : undefined,
      type: "session_started",
      level: "info",
      message: agentKeysToStart.length > 1 ? "Les agents live ont ete demarres." : `${agentLabel(agentKeysToStart[0] ?? "")} a ete demarre en mode live.`,
      createdAt: now
    });
    scheduleSourcingLiveTick(session.id, 0);
    res.status(201).json({ ok: true, session: toPublicSourcingSession(session) });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/agents/live/stop", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const session = getCurrentLiveSession(runtime.liveSessions);
    if (!session) return res.status(404).json({ error: "Aucune session live en cours." });
    const agentKey = typeof req.body?.agentKey === "string" && req.body.agentKey.trim() ? req.body.agentKey.trim() : null;

    if (agentKey) {
      const nextActiveKeys = session.activeAgentKeys.filter((key) => key !== agentKey);
      const nextPausedKeys = (session.pausedAgentKeys ?? []).filter((key) => key !== agentKey);

      if (nextActiveKeys.length || nextPausedKeys.length) {
        const updated = await updateSourcingLiveSession(session.id, (current) => ({
          ...current,
          status: nextActiveKeys.length ? "running" : nextPausedKeys.length ? "paused" : "stopped",
          stopReason: nextActiveKeys.length || nextPausedKeys.length ? undefined : "Arret manuel demande par l'utilisateur.",
          updatedAt: new Date().toISOString(),
          currentAgentKey: current.currentAgentKey === agentKey ? undefined : current.currentAgentKey,
          activeAgentKeys: nextActiveKeys,
          pausedAgentKeys: nextPausedKeys
        }));
        if (!updated) return res.status(404).json({ error: "Session live introuvable." });
        await appendSourcingLiveEvent({
          id: randomUUID(),
          sessionId: updated.id,
          companyId: updated.companyId,
          agentKey,
          agentName: runtime.profiles.find((item) => item.agentKey === agentKey)?.displayName,
          type: "session_stopped",
          level: "info",
          message: `${agentLabel(agentKey)} a ete arrete.`,
          createdAt: new Date().toISOString()
        });
        if (updated.status === "running") {
          scheduleSourcingLiveTick(updated.id, 0);
        } else if (updated.status === "paused") {
          clearSourcingLiveTimer(updated.id);
        }
        return res.json({ ok: true, session: toPublicSourcingSession(updated) });
      }
    }

    const updated = await stopSourcingLiveSession(session.id, "stopped", "Arret manuel demande par l'utilisateur.", "session_stopped");
    res.json({ ok: true, session: updated ? toPublicSourcingSession(updated) : null });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/agents/live/pause", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const session = getCurrentLiveSession(runtime.liveSessions);
    if (!session || session.status !== "running") return res.status(404).json({ error: "Aucune session live active a mettre en pause." });
    const agentKey = typeof req.body?.agentKey === "string" && req.body.agentKey.trim() ? req.body.agentKey.trim() : null;

    if (agentKey) {
      const nextActiveKeys = session.activeAgentKeys.filter((key) => key !== agentKey);
      const nextPausedKeys = Array.from(new Set([...(session.pausedAgentKeys ?? []), agentKey]));
      if (!session.activeAgentKeys.includes(agentKey)) {
        return res.status(409).json({ error: "Cet agent n'est pas en cours d'execution." });
      }
      if (!nextActiveKeys.length) {
        clearSourcingLiveTimer(session.id);
      }
      const pausedAgent = await updateSourcingLiveSession(session.id, (current) => ({
        ...current,
        status: nextActiveKeys.length ? "running" : "paused",
        stopReason: nextActiveKeys.length ? undefined : "Session mise en pause par l'utilisateur.",
        updatedAt: new Date().toISOString(),
        currentAgentKey: current.currentAgentKey === agentKey ? undefined : current.currentAgentKey,
        activeAgentKeys: nextActiveKeys,
        pausedAgentKeys: nextPausedKeys
      }));
      if (!pausedAgent) return res.status(404).json({ error: "Session live introuvable." });
      await appendSourcingLiveEvent({
        id: randomUUID(),
        sessionId: pausedAgent.id,
        companyId: pausedAgent.companyId,
        agentKey,
        agentName: runtime.profiles.find((item) => item.agentKey === agentKey)?.displayName,
        type: "session_paused",
        level: "info",
        message: `${agentLabel(agentKey)} est en pause.`,
        createdAt: new Date().toISOString()
      });
      return res.json({ ok: true, session: toPublicSourcingSession(pausedAgent) });
    }

    clearSourcingLiveTimer(session.id);
    const paused = await updateSourcingLiveSession(session.id, (current) => ({
      ...current,
      status: "paused",
      stopReason: "Session mise en pause par l'utilisateur.",
      updatedAt: new Date().toISOString(),
      currentAgentKey: undefined,
      pausedAgentKeys: Array.from(new Set([...(current.pausedAgentKeys ?? []), ...current.activeAgentKeys])),
      activeAgentKeys: []
    }));
    if (!paused) return res.status(404).json({ error: "Session live introuvable." });
    await appendSourcingLiveEvent({
      id: randomUUID(),
      sessionId: paused.id,
      companyId: paused.companyId,
      type: "session_paused",
      level: "info",
      message: "La session live est en pause.",
      createdAt: new Date().toISOString()
    });
    res.json({ ok: true, session: toPublicSourcingSession(paused) });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/agents/live/resume", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const session = getCurrentLiveSession(runtime.liveSessions);
    if (!session || (session.status !== "paused" && session.status !== "running")) {
      return res.status(404).json({ error: "Aucune session live en pause a reprendre." });
    }
    const agentKey = typeof req.body?.agentKey === "string" && req.body.agentKey.trim() ? req.body.agentKey.trim() : null;
    const availableAgentKeys = runtime.profiles
      .filter((item) => item.moduleKey === "sourcing-commercial" && item.isEnabled)
      .filter(
        (item) =>
          item.missionConfig.keywords.trim() &&
          item.missionConfig.qualificationInstructions.trim() &&
          Number(item.missionConfig.defaultTargetCount ?? 0) > 0,
      )
      .map((item) => item.agentKey);

    const agentKeysToResume = agentKey
      ? (session.pausedAgentKeys ?? []).filter((key) => key === agentKey && availableAgentKeys.includes(key))
      : (session.pausedAgentKeys ?? []).filter((key) => availableAgentKeys.includes(key));

    if (agentKey && !agentKeysToResume.length) {
      return res.status(409).json({ error: "Cet agent ne peut pas etre repris pour le moment." });
    }

    const resumed = await updateSourcingLiveSession(session.id, (current) => {
      const nextActiveKeys = Array.from(new Set([...current.activeAgentKeys, ...agentKeysToResume]));
      const nextPausedKeys = (current.pausedAgentKeys ?? []).filter((key) => !agentKeysToResume.includes(key));
      return {
        ...current,
        status: nextActiveKeys.length ? "running" : "paused",
        stopReason: nextActiveKeys.length ? undefined : current.stopReason,
        updatedAt: new Date().toISOString(),
        currentAgentKey: undefined,
        activeAgentKeys: nextActiveKeys,
        pausedAgentKeys: nextPausedKeys
      };
    });
    if (!resumed) return res.status(404).json({ error: "Session live introuvable." });
    await appendSourcingLiveEvent({
      id: randomUUID(),
      sessionId: resumed.id,
      companyId: resumed.companyId,
      agentKey: agentKeysToResume.length === 1 ? agentKeysToResume[0] : undefined,
      agentName: agentKeysToResume.length === 1 ? runtime.profiles.find((item) => item.agentKey === agentKeysToResume[0])?.displayName : undefined,
      type: "session_resumed",
      level: "info",
      message:
        agentKeysToResume.length === 1
          ? `${agentLabel(agentKeysToResume[0] ?? "")} a repris.`
          : "La session live a repris.",
      createdAt: new Date().toISOString()
    });
    scheduleSourcingLiveTick(resumed.id, 0);
    res.json({ ok: true, session: toPublicSourcingSession(resumed) });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/agents/:agentKey", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const agentKey = typeof req.params.agentKey === "string" ? req.params.agentKey : "";
    const profile = runtime.profiles.find((item) => item.companyId === runtime.company.id && item.agentKey === agentKey);
    if (!profile) return res.status(404).json({ error: "Agent utilisateur introuvable." });

    const subscription = runtime.subscriptions.find((item) => item.moduleKey === profile.moduleKey);
    if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) {
      return res.status(403).json({ error: "Ce module n'est pas accessible actuellement." });
    }

    const updatedAt = new Date().toISOString();
    const allProfiles = await loadAgentProfiles();
    const nextProfiles = allProfiles.map((item) =>
      item.id === profile.id
        ? {
            ...item,
            displayName: typeof req.body?.displayName === "string" && req.body.displayName.trim() ? req.body.displayName.trim() : item.displayName,
            isEnabled: typeof req.body?.isEnabled === "boolean" ? req.body.isEnabled : item.isEnabled,
            tone: typeof req.body?.tone === "string" ? req.body.tone.trim() : item.tone,
            modelProvider:
              typeof req.body?.modelProvider === "string" && req.body.modelProvider.trim()
                ? req.body.modelProvider.trim()
                : item.modelProvider,
            modelId: typeof req.body?.modelId === "string" && req.body.modelId.trim() ? req.body.modelId.trim() : item.modelId,
            systemPrompt: typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt.trim() : item.systemPrompt,
            personality: typeof req.body?.personality === "string" ? req.body.personality.trim() : item.personality,
            identity: typeof req.body?.identity === "string" ? req.body.identity.trim() : item.identity,
            userContext: typeof req.body?.userContext === "string" ? req.body.userContext.trim() : item.userContext,
            welcomeMessage: typeof req.body?.welcomeMessage === "string" ? req.body.welcomeMessage.trim() : item.welcomeMessage,
            businessName: typeof req.body?.businessName === "string" ? req.body.businessName.trim() : item.businessName,
            businessEmail: typeof req.body?.businessEmail === "string" ? normalizeEmail(req.body.businessEmail) : item.businessEmail,
            businessPhone: typeof req.body?.businessPhone === "string" ? req.body.businessPhone.trim() : item.businessPhone,
            faq: Array.isArray(req.body?.faq) ? req.body.faq.map(String).map((entry: string) => entry.trim()).filter(Boolean) : item.faq,
            activeHours: typeof req.body?.activeHours === "string" ? req.body.activeHours.trim() : item.activeHours,
            simpleRules: typeof req.body?.simpleRules === "string" ? req.body.simpleRules.trim() : item.simpleRules,
            escalationThreshold:
              typeof req.body?.escalationThreshold === "string" ? req.body.escalationThreshold.trim() : item.escalationThreshold,
            requireApproval: typeof req.body?.requireApproval === "boolean" ? req.body.requireApproval : item.requireApproval,
            allowedTools: Array.isArray(req.body?.allowedTools)
              ? req.body.allowedTools.map(String).map((value: string) => value.trim()).filter(Boolean)
              : item.allowedTools,
            missionConfig:
              item.moduleKey === "sourcing-commercial"
                ? ({
                    source:
                      req.body?.missionConfig?.source === "tavily"
                        ? "tavily"
                        : req.body?.missionConfig?.source === "serper"
                          ? "serper"
                          : item.missionConfig.source,
                    keywords:
                      typeof req.body?.missionConfig?.keywords === "string"
                        ? req.body.missionConfig.keywords.trim()
                        : item.missionConfig.keywords,
                    qualificationInstructions:
                      typeof req.body?.missionConfig?.qualificationInstructions === "string"
                        ? req.body.missionConfig.qualificationInstructions.trim()
                        : item.missionConfig.qualificationInstructions,
                    enrollmentMode: "none",
                    defaultSector:
                      typeof req.body?.missionConfig?.defaultSector === "string"
                        ? req.body.missionConfig.defaultSector.trim()
                        : item.missionConfig.defaultSector,
                    defaultZone:
                      typeof req.body?.missionConfig?.defaultZone === "string"
                        ? req.body.missionConfig.defaultZone.trim()
                        : item.missionConfig.defaultZone,
                    defaultTargetCount: Math.min(
                      Math.max(
                        Number(req.body?.missionConfig?.defaultTargetCount ?? item.missionConfig.defaultTargetCount ?? 6),
                        1
                      ),
                      10
                    )
                  } satisfies SaasAgentProfile["missionConfig"])
                : item.missionConfig,
            updatedAt
          }
        : item
    );
    await saveAgentProfiles(nextProfiles);
    const nextProfile = nextProfiles.find((item) => item.id === profile.id)!;
    res.json({ ok: true, agent: toPublicAgentProfile(nextProfile) });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules/whatsapp-business/meta-config", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const configs = await loadWhatsAppMetaConfigs();
    const config = configs.find((item) => item.companyId === context.company.id) ?? null;
    res.json({
      config: config
        ? {
            phoneNumberId: config.phoneNumberId,
            verifyToken: config.verifyToken,
            displayPhoneNumber: config.displayPhoneNumber,
            accessTokenMasked: maskSecret(config.accessToken),
            webhookUrl: "/api/whatsapp/cloud/webhook",
            sessionId: config.sessionId
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/modules/whatsapp-business/meta-config", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const accessToken = typeof req.body?.accessToken === "string" ? req.body.accessToken.trim() : "";
    const phoneNumberId = typeof req.body?.phoneNumberId === "string" ? req.body.phoneNumberId.trim() : "";
    const verifyToken = typeof req.body?.verifyToken === "string" ? req.body.verifyToken.trim() : "";
    const displayPhoneNumber = typeof req.body?.displayPhoneNumber === "string" ? req.body.displayPhoneNumber.trim() : "";
    if (!accessToken || !phoneNumberId || !verifyToken) {
      return res.status(400).json({ error: "Access token, phone number id et verify token sont obligatoires." });
    }

    const session = await ensureCloudSessionForCompany(context.company, phoneNumberId, displayPhoneNumber);
    const configs = await loadWhatsAppMetaConfigs();
    const now = new Date().toISOString();
    const config: SaasWhatsAppMetaConfig = {
      id: configs.find((item) => item.companyId === context.company.id)?.id ?? randomUUID(),
      companyId: context.company.id,
      sessionId: session.id,
      accessToken,
      phoneNumberId,
      verifyToken,
      displayPhoneNumber,
      createdAt: configs.find((item) => item.companyId === context.company.id)?.createdAt ?? now,
      updatedAt: now
    };
    await saveWhatsAppMetaConfigs([config, ...configs.filter((item) => item.companyId !== context.company.id)]);
    res.json({
      ok: true,
      config: {
        phoneNumberId: config.phoneNumberId,
        verifyToken: config.verifyToken,
        displayPhoneNumber: config.displayPhoneNumber,
        accessTokenMasked: maskSecret(config.accessToken),
        webhookUrl: "/api/whatsapp/cloud/webhook",
        sessionId: config.sessionId
      }
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules/whatsapp-business/baileys/sessions", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const bindings = (await loadWhatsAppBindings()).filter((item) => item.companyId === context.company.id);
    const dbSessions = await prisma.wASession.findMany({
      where: { id: { in: bindings.map((item) => item.sessionId) } },
      orderBy: { createdAt: "desc" }
    });

    const sessions = dbSessions.map((session: { id: string; name: string; phoneNumber: string | null; status: string | null }) => {
      const binding = bindings.find((item) => item.sessionId === session.id)!;
      if (binding.mode === "baileys" && (session.status === "connected" || session.status === "reconnecting" || session.status === "qr_pending")) {
        ensureSaasBaileysClient(session.id, context.company.id);
      }
      const live = binding.mode === "baileys" ? baileysManager.get(session.id) : undefined;
      return toPublicWhatsAppSession(
        {
          id: session.id,
          name: session.name,
          phoneNumber: live?.phoneNumber ?? session.phoneNumber ?? "",
          status: live?.status ?? session.status ?? "disconnected",
          connected: binding.mode === "cloud" ? true : live?.status === "open"
        },
        binding.mode
      );
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/modules/whatsapp-business/baileys/sessions", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const runtime = await getCompanyRuntime(context.company);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "whatsapp-business");
    if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) {
      return res.status(403).json({ error: "Le module WhatsApp n'est pas actif." });
    }

    const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : `${context.company.name} WhatsApp`;
    const session = await prisma.wASession.create({
      data: {
        name,
        type: "saas_baileys",
        phoneNumber: "",
        status: "connecting"
      }
    });
    const now = new Date().toISOString();
    const bindings = await loadWhatsAppBindings();
    await saveWhatsAppBindings([
      {
        id: randomUUID(),
        companyId: context.company.id,
        sessionId: session.id,
        mode: "baileys",
        label: name,
        createdAt: now,
        updatedAt: now
      },
      ...bindings
    ]);

    const client = ensureSaasBaileysClient(session.id, context.company.id);
    await client.connect();
    res.status(201).json({ ok: true, sessionId: session.id, status: client.status });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules/whatsapp-business/baileys/sessions/:id/qr", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const sessionId = String(req.params.id ?? "");
    const owned = await getCompanyOwnedSession(context.company.id, sessionId);
    if (!owned || owned.binding.mode !== "baileys") return res.status(404).json({ error: "Session introuvable." });

    const client = ensureSaasBaileysClient(sessionId, context.company.id);
    if (client.status === "open") {
      return res.json({ status: "connected", connected: true });
    }
    if (client.lastQrDataUrl) {
      return res.json({ status: client.status, connected: false, qrDataUrl: client.lastQrDataUrl });
    }
    return res.json({ status: client.status, connected: false });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/modules/whatsapp-business/baileys/sessions/:id/reconnect", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const sessionId = String(req.params.id ?? "");
    const owned = await getCompanyOwnedSession(context.company.id, sessionId);
    if (!owned || owned.binding.mode !== "baileys") return res.status(404).json({ error: "Session introuvable." });

    await baileysManager.remove(sessionId);
    const client = ensureSaasBaileysClient(sessionId, context.company.id);
    await client.connect();
    res.json({ ok: true, status: client.status });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules/whatsapp-business/conversations", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    const ownedSessionIds = await listCompanyOwnedSessionIds(context.company.id);
    if (sessionId && !ownedSessionIds.includes(sessionId)) {
      return res.status(404).json({ error: "Session introuvable." });
    }
    const conversations = await prisma.wAConversation.findMany({
      where: {
        sessionId: sessionId ? sessionId : { in: ownedSessionIds }
      },
      orderBy: { lastMessageAt: "desc" }
    });
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules/whatsapp-business/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const conversationId = String(req.params.conversationId ?? "");
    const conversation = await prisma.wAConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return res.status(404).json({ error: "Conversation introuvable." });
    const ownedSession = await getCompanyOwnedSession(context.company.id, conversation.sessionId);
    if (!ownedSession) return res.status(404).json({ error: "Conversation introuvable." });
    const messages = await prisma.wAMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
      take: 100
    });
    res.json({ conversation, messages });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/modules/whatsapp-business/sessions/:id/send", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const sessionId = String(req.params.id ?? "");
    const owned = await getCompanyOwnedSession(context.company.id, sessionId);
    if (!owned) return res.status(404).json({ error: "Session introuvable." });

    const rawTo = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!rawTo || !text) return res.status(400).json({ error: "Destinataire et message sont obligatoires." });
    const to = normalizePhoneForChannel(rawTo);

    if (owned.binding.mode === "baileys") {
      const client = ensureSaasBaileysClient(sessionId, context.company.id);
      if (client.status !== "open") return res.status(400).json({ error: "Session non connectee." });
      const sent = await client.sendText(rawTo, text);
      const sentId = sent?.key?.id ?? null;
      await saveCompanyOutgoingWhatsAppMessage(sessionId, to, text, sentId);
      return res.json({ ok: true, mode: "baileys" });
    }

    const metaConfig = (await loadWhatsAppMetaConfigs()).find((item) => item.companyId === context.company.id && item.sessionId === sessionId);
    if (!metaConfig) return res.status(400).json({ error: "Configuration Meta introuvable." });
    const client = new WhatsAppCloudClient({
      accessToken: metaConfig.accessToken,
      phoneNumberId: metaConfig.phoneNumberId,
      verifyToken: metaConfig.verifyToken
    });
    const result = await client.sendText(to, text);
    const sentId = result.messages?.[0]?.id ?? null;
    await saveCompanyOutgoingWhatsAppMessage(sessionId, to, text, sentId);
    return res.json({ ok: true, mode: "cloud" });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/modules/:moduleKey/workspace", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }

    const moduleKey = String(req.params.moduleKey ?? "");
    if (!isModuleKey(moduleKey)) return res.status(404).json({ error: "Module inconnu." });

    const runtime = await getCompanyRuntime(context.company);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === moduleKey);
    const agent = runtime.profiles.find((item) => item.moduleKey === moduleKey);
    const accessible = subscription ? isAccessibleSubscriptionStatus(subscription.status) : false;

    if (moduleKey === "whatsapp-business") {
      const bindings = (await loadWhatsAppBindings()).filter((item) => item.companyId === context.company.id);
      const sessions = await prisma.wASession.findMany({
        where: { id: { in: bindings.map((item) => item.sessionId) } },
        orderBy: { createdAt: "desc" }
      });
      const sessionIds = sessions.map((session: { id: string }) => session.id);
      const conversationCount = await prisma.wAConversation.count({
        where: { sessionId: { in: sessionIds } }
      });
      const openCount = await prisma.wAConversation.count({
        where: { sessionId: { in: sessionIds }, unreadCount: { gt: 0 } }
      });
      const metaConfig = (await loadWhatsAppMetaConfigs()).find((item) => item.companyId === context.company.id) ?? null;
      return res.json({
        module: {
          key: moduleKey,
          title: moduleByKey(moduleKey).title,
          accessible,
          subscription: subscription ? toPublicSubscription(subscription, runtime.invoices) : null
        },
        agent: agent ? toPublicAgentProfile(agent) : null,
        stats: {
          conversations: conversationCount,
          open: openCount,
          qualified: runtime.leads.filter((lead) => /^WhatsApp:/i.test(lead.source)).length
        },
        sessions: sessions.map((session: { id: string; name: string; phoneNumber: string | null; status: string | null }) => {
          const binding = bindings.find((item) => item.sessionId === session.id)!;
          const live = binding.mode === "baileys" ? baileysManager.get(session.id) : undefined;
          return toPublicWhatsAppSession(
            {
              id: session.id,
              name: session.name,
              phoneNumber: live?.phoneNumber ?? session.phoneNumber ?? "",
              status: live?.status ?? session.status ?? "disconnected",
              connected: binding.mode === "cloud" ? true : live?.status === "open"
            },
            binding.mode
          );
        }),
        cloudConfig: metaConfig
          ? {
              phoneNumberId: metaConfig.phoneNumberId,
              verifyToken: metaConfig.verifyToken,
              displayPhoneNumber: metaConfig.displayPhoneNumber,
              accessTokenMasked: maskSecret(metaConfig.accessToken),
              webhookUrl: "/api/whatsapp/cloud/webhook",
              sessionId: metaConfig.sessionId
            }
          : null
      });
    }

    if (moduleKey === "crm-intelligent") {
      const leads = runtime.leads.map(toPublicLead);
      return res.json({
        module: {
          key: moduleKey,
          title: moduleByKey(moduleKey).title,
          accessible,
          subscription: subscription ? toPublicSubscription(subscription, runtime.invoices) : null
        },
        leads,
        stats: {
          total: leads.length,
          hot: leads.filter((lead) => lead.status === "hot").length,
          won: leads.filter((lead) => lead.status === "won").length
        }
      });
    }

    if (moduleKey === "billing-intelligent") {
      return res.json({
        module: {
          key: moduleKey,
          title: moduleByKey(moduleKey).title,
          accessible,
          subscription: subscription ? toPublicSubscription(subscription, runtime.invoices) : null
        },
        subscriptions: runtime.subscriptions.map((item) => toPublicSubscription(item, runtime.invoices)),
        invoices: runtime.invoices.map(toPublicInvoice),
        summary: {
          pending: runtime.invoices.filter((item) => item.status === "sent").length,
          paid: runtime.invoices.filter((item) => item.status === "paid").length,
          overdue: runtime.invoices.filter((item) => item.status === "overdue").length
        }
      });
    }

    const runs = runtime.runs.map(toPublicSourcingRun);
    const providerStatus = await getSearchProviderStatus();

    const monthStart = getCurrentMonthStartIso();
    const runsThisMonth = runs.filter((run) => run.createdAt >= monthStart).length;
    const prospectsThisMonth = runs.filter((run) => run.createdAt >= monthStart).reduce((sum, run) => sum + run.foundCount, 0);
    const planLimits = await resolveSourcingPlanLimits(subscription ?? null);
    const quota = computeSourcingQuota(runtime.runs, planLimits, {
      accessible: accessible,
      prospectsKeptThisMonth: prospectsThisMonth
    });
    const session = getCurrentLiveSession(runtime.liveSessions);
    const feed = runtime.liveEvents
      .filter((event) => !session || event.sessionId === session.id)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 40);

    return res.json({
      module: {
        key: moduleKey,
        title: moduleByKey(moduleKey).title,
        accessible,
        subscription: subscription ? toPublicSubscription(subscription, runtime.invoices) : null
      },
      runs,
      stats: {
        total: runs.length,
        completed: runs.filter((run) => run.status === "completed").length,
        prospectsFound: runs.reduce((sum, run) => sum + run.foundCount, 0),
        runsThisMonth,
        prospectsThisMonth
      },
      planLimits,
      providers: providerStatus,
      liveSession: session ? toPublicSourcingSession(session) : null,
      liveFeed: feed.map(toPublicSourcingLiveEvent),
      quota
    });
  } catch (error) {
    next(error);
  }
});

type SourcingRunExecutionResult =
  | { ok: true; run: SaasSourcingRun }
  | { ok: false; code: "subscription" | "quota" | "agent_not_found" | "agent_paused" | "validation" | "provider" | "no_results"; error: string };

async function executeUserSourcingRun(
  company: SaasCompany,
  params: {
    agentKey: string;
    brief?: string;
    sector?: string;
    zone?: string;
    targetCount?: number;
    sessionId?: string;
    cycleIndex?: number;
    dedupeKeys?: Set<string>;
  }
): Promise<SourcingRunExecutionResult> {
  const runtime = await getCompanyRuntime(company);
  const subscription = runtime.subscriptions.find((item) => item.moduleKey === "sourcing-commercial");
  if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) {
    return { ok: false, code: "subscription", error: "Le module sourcing commercial n'est pas actif." };
  }

  const planLimits = await resolveSourcingPlanLimits(subscription);
  const quota = computeSourcingQuota(runtime.runs, planLimits, {
    accessible: isAccessibleSubscriptionStatus(subscription.status)
  });
  if (planLimits && quota.runsRemaining !== null && quota.runsRemaining <= 0) {
    return { ok: false, code: "quota", error: `Le quota mensuel du plan ${planLimits.planName} est atteint.` };
  }

  const sourcingAgent = runtime.profiles.find(
    (item) => item.moduleKey === "sourcing-commercial" && item.agentKey === params.agentKey
  );
  if (!sourcingAgent) {
    return { ok: false, code: "agent_not_found", error: "Agent de sourcing introuvable." };
  }
  if (!sourcingAgent.isEnabled) {
    return { ok: false, code: "agent_paused", error: `${sourcingAgent.displayName} est actuellement en pause.` };
  }

  const brief = params.brief?.trim() || sourcingAgent.missionConfig.keywords || "";
  const sector = params.sector?.trim() || sourcingAgent.missionConfig.defaultSector || "";
  const zone = params.zone?.trim() || sourcingAgent.missionConfig.defaultZone || "";
  const targetCount = Math.min(
    Math.max(Number(params.targetCount ?? sourcingAgent.missionConfig.defaultTargetCount ?? 6), 1),
    planLimits?.maxProspectsPerRun ?? 10
  );
  if (!brief) {
    return { ok: false, code: "validation", error: "Ajoute au moins une instruction courte pour lancer la recherche." };
  }

  const providerStatus = await getSearchProviderStatus();
  if (sourcingAgent.missionConfig.source === "serper" && !providerStatus.serper.configured) {
    return { ok: false, code: "provider", error: "L'agent Découverte n'est pas pret: configure la source de recherche dans les parametres IA." };
  }
  if (sourcingAgent.missionConfig.source === "tavily" && !providerStatus.tavily.configured) {
    return { ok: false, code: "provider", error: "L'agent Qualification n'est pas pret: configure la source de recherche dans les parametres IA." };
  }

  const missionNotes = [
    sourcingAgent.missionConfig.keywords ? `Mots-cles de mission: ${sourcingAgent.missionConfig.keywords}.` : "",
    sourcingAgent.missionConfig.qualificationInstructions
      ? `Qualification attendue: ${sourcingAgent.missionConfig.qualificationInstructions}.`
      : "",
    sourcingAgent.systemPrompt ? `Cadre agent: ${sourcingAgent.systemPrompt}.` : "",
    sourcingAgent.identity ? `Identite agent: ${sourcingAgent.identity}.` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const objective = `${buildSourcingObjective(brief, sector, zone)}${missionNotes ? ` ${missionNotes}` : ""}`.trim();
  const searchQuery = buildSourcingSearchQuery(brief, sector, zone);
  const research = await executeSourcingSearch({
    objective,
    searchQuery,
    brief,
    agentSource: sourcingAgent.missionConfig.source,
    zone,
    sector,
    targetCount,
    providerStatus
  });

  const persistedKeys = new Set(
    runtime.runs
      .flatMap((run) => run.prospects.map((prospect) => buildProspectDedupKey(prospect)))
      .filter(Boolean)
  );
  const liveKeys = params.dedupeKeys ?? new Set<string>();
  const prospects = await Promise.all(
    research.results.map(async (result) => {
      if (isRejectedSourcingCandidate({ title: result.title, url: result.url, snippet: result.snippet, summary: "" })) {
        return null;
      }

      const summary = (await extractPageContent(result.url)) ?? result.snippet;
      const combinedText = `${result.title} ${result.snippet} ${summary}`;
      if (isRejectedSourcingCandidate({ title: result.title, url: result.url, snippet: result.snippet, summary })) return null;
      if (!matchesSectorIntent({ title: result.title, url: result.url, snippet: result.snippet, summary }, sector, brief)) return null;
      if (!looksLikeCompanyOfferPage({ title: result.title, url: result.url, snippet: result.snippet, summary }, sector, brief)) return null;
      if (!hasStrongBusinessSignals({ title: result.title, url: result.url, snippet: result.snippet, summary })) return null;
      const email = extractFirstEmail(`${result.snippet}\n${summary}`);
      const phone = extractFirstPhone(`${result.snippet}\n${summary}`);

      const prospect = {
        id: randomUUID(),
        name: extractProspectName(result.title, result.url),
        company: extractProspectName(result.title, result.url),
        website: result.url,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        snippet: result.snippet,
        summary: summary.slice(0, 4000),
        source: result.source,
        score: Math.min(99, buildProspectScore(combinedText, summary, result.url) + buildMissionKeywordBoost(combinedText, sourcingAgent.missionConfig))
      };

      const dedupeKey = buildProspectDedupKey(prospect);
      if (!dedupeKey || persistedKeys.has(dedupeKey) || liveKeys.has(dedupeKey)) return null;
      return prospect;
    })
  );

  const filteredProspects = dedupeSourcingProspects(prospects.filter((item): item is NonNullable<typeof item> => Boolean(item)))
    .sort((left, right) => right.score - left.score)
    .slice(0, targetCount);

  if (!filteredProspects.length) {
    return {
      ok: false,
      code: "no_results",
      error:
        "Aucun prospect qualifie n'a ete retenu. Precise davantage le secteur, la zone ou la cible pour eviter les pages emploi et resultats trop generiques."
    };
  }

  for (const prospect of filteredProspects) {
    const dedupeKey = buildProspectDedupKey(prospect);
    if (dedupeKey) liveKeys.add(dedupeKey);
  }

  const run: SaasSourcingRun = {
    id: randomUUID(),
    companyId: runtime.company.id,
    moduleKey: "sourcing-commercial",
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    ...(typeof params.cycleIndex === "number" ? { cycleIndex: params.cycleIndex } : {}),
    agentKey: sourcingAgent.agentKey,
    agentName: sourcingAgent.displayName,
    objective,
    brief,
    sector,
    zone,
    targetCount,
    foundCount: filteredProspects.length,
    status: "completed",
    providerMode: research.providerMode,
    providers: research.providers,
    prospects: filteredProspects,
    createdAt: new Date().toISOString()
  };

  const allRuns = await loadSourcingRuns();
  await saveSourcingRuns([run, ...allRuns]);
  return { ok: true, run };
}

async function processSourcingLiveSession(sessionId: string) {
  if (sourcingLiveLocks.has(sessionId)) return;
  sourcingLiveLocks.add(sessionId);
  try {
    const sessions = await loadSourcingLiveSessions();
    const session = sessions.find((item) => item.id === sessionId) ?? null;
    if (!session || session.status !== "running") {
      clearSourcingLiveTimer(sessionId);
      return;
    }

    const companies = await loadCompanies();
    const company = companies.find((item) => item.id === session.companyId) ?? null;
    if (!company) {
      await stopSourcingLiveSession(sessionId, "blocked", "La session live ne retrouve plus l'entreprise associee.", "provider_error");
      return;
    }

    const runtime = await getCompanyRuntime(company);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "sourcing-commercial");
    if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) {
      await stopSourcingLiveSession(sessionId, "blocked", "L'abonnement sourcing n'est plus actif.", "session_stopped");
      return;
    }

    const planLimits = await resolveSourcingPlanLimits(subscription);
    const quota = computeSourcingQuota(runtime.runs, planLimits, {
      accessible: isAccessibleSubscriptionStatus(subscription.status)
    });
    if (planLimits && quota.runsRemaining !== null && quota.runsRemaining <= 0) {
      await stopSourcingLiveSession(sessionId, "blocked", `Le quota mensuel du plan ${planLimits.planName} est atteint.`, "quota_reached");
      return;
    }

    const orderedAgentKeys = session.activeAgentKeys.length ? session.activeAgentKeys : ["sourcing-serper", "sourcing-tavily"];
    const liveKeys = new Set(
      runtime.runs
        .flatMap((run) => run.prospects.map((prospect) => buildProspectDedupKey(prospect)))
        .filter(Boolean)
    );

    const cycleIndex = session.cycleCount + 1;
    let attemptedAgents = 0;

    for (const agentKey of orderedAgentKeys) {
      const agent = runtime.profiles.find((item) => item.moduleKey === "sourcing-commercial" && item.agentKey === agentKey) ?? null;
      if (!agent || !agent.isEnabled) {
        await appendSourcingLiveEvent({
          id: randomUUID(),
          sessionId: session.id,
          companyId: session.companyId,
          agentKey,
          agentName: agent?.displayName,
          type: "agent_blocked",
          level: "warning",
          message: agent ? `${agent.displayName} est en pause pour cette boucle.` : "Un agent configure n'est plus disponible.",
          createdAt: new Date().toISOString()
        });
        continue;
      }

      attemptedAgents += 1;
      await updateSourcingLiveSession(session.id, (current) => ({
        ...current,
        currentAgentKey: agent.agentKey,
        updatedAt: new Date().toISOString()
      }));
      await appendSourcingLiveEvent({
        id: randomUUID(),
        sessionId: session.id,
        companyId: session.companyId,
        agentKey: agent.agentKey,
        agentName: agent.displayName,
        type: "cycle_started",
        level: "info",
        message: `${agent.displayName} lance un nouveau cycle.`,
        createdAt: new Date().toISOString()
      });

      const result = await executeUserSourcingRun(company, {
        agentKey: agent.agentKey,
        sessionId: session.id,
        cycleIndex,
        dedupeKeys: liveKeys,
        brief: session.agentBriefs?.[agent.agentKey as "sourcing-serper" | "sourcing-tavily"] ?? session.brief ?? ""
      });

      if (result.ok) {
        await appendSourcingLiveEvent({
          id: randomUUID(),
          sessionId: session.id,
          companyId: session.companyId,
          agentKey: agent.agentKey,
          agentName: agent.displayName,
          type: "prospects_retained",
          level: "success",
          message: `${agent.displayName} a retenu ${result.run.foundCount} prospect(s).`,
          runId: result.run.id,
          prospectCount: result.run.foundCount,
          createdAt: new Date().toISOString()
        });
        continue;
      }

      if (result.code === "quota") {
        await stopSourcingLiveSession(session.id, "blocked", result.error, "quota_reached");
        return;
      }

      const eventType = result.code === "provider" ? "provider_error" : result.code === "no_results" ? "no_results" : "agent_blocked";
      const level = result.code === "provider" ? "error" : result.code === "no_results" ? "warning" : "warning";
      await appendSourcingLiveEvent({
        id: randomUUID(),
        sessionId: session.id,
        companyId: session.companyId,
        agentKey: agent.agentKey,
        agentName: agent.displayName,
        type: eventType,
        level,
        message: result.error,
        createdAt: new Date().toISOString()
      });
    }

    if (!attemptedAgents) {
      clearSourcingLiveTimer(session.id);
      const paused = await updateSourcingLiveSession(session.id, (current) => ({
        ...current,
        status: "paused",
        stopReason: "Tous les agents de sourcing sont en pause.",
        updatedAt: new Date().toISOString(),
        currentAgentKey: undefined
      }));
      if (paused) {
        await appendSourcingLiveEvent({
          id: randomUUID(),
          sessionId: paused.id,
          companyId: paused.companyId,
          type: "session_paused",
          level: "warning",
          message: "La session live est en pause car aucun agent actif n'est disponible.",
          createdAt: new Date().toISOString()
        });
      }
      return;
    }

    const updated = await updateSourcingLiveSession(session.id, (current) => ({
      ...current,
      status: "running",
      stopReason: undefined,
      cycleCount: current.cycleCount + 1,
      lastCycleAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentAgentKey: undefined
    }));

    if (updated?.status === "running") {
      scheduleSourcingLiveTick(updated.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le moteur live a rencontre une erreur serveur.";
    await stopSourcingLiveSession(sessionId, "blocked", message, "provider_error");
  } finally {
    sourcingLiveLocks.delete(sessionId);
  }
}

export async function initializeSourcingLiveSessions() {
  const sessions = await loadSourcingLiveSessions();
  sessions
    .filter((session) => session.status === "running")
    .forEach((session) => {
      scheduleSourcingLiveTick(session.id, 1000);
    });
}

saasRouter.post("/modules/crm-intelligent/leads", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const runtime = await getCompanyRuntime(context.company);
    const subscription = runtime.subscriptions.find((item) => item.moduleKey === "crm-intelligent");
    if (!subscription || !isAccessibleSubscriptionStatus(subscription.status)) {
      return res.status(403).json({ error: "Le module CRM intelligent n'est pas actif." });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const companyName = typeof req.body?.company === "string" ? req.body.company.trim() : "";
    const source = typeof req.body?.source === "string" ? req.body.source.trim() : "Manuel";
    const score = Math.min(Math.max(Number(req.body?.score ?? 60), 0), 100);
    if (!name || !companyName) return res.status(400).json({ error: "Nom et entreprise sont obligatoires." });

    const allLeads = await loadCrmLeads();
    const lead: SaasCrmLead = {
      id: randomUUID(),
      companyId: runtime.company.id,
      name,
      company: companyName,
      source,
      score,
      status: "new",
      updatedAt: new Date().toISOString()
    };
    await saveCrmLeads([lead, ...allLeads]);
    res.status(201).json({ ok: true, lead: toPublicLead(lead) });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/modules/crm-intelligent/leads/:leadId", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const leadId = String(req.params.leadId ?? "");
    const status = typeof req.body?.status === "string" && isLeadStatus(req.body.status) ? req.body.status : null;
    if (!leadId || !status) return res.status(400).json({ error: "Mise a jour CRM invalide." });

    const leads = await loadCrmLeads();
    const lead = leads.find((item) => item.id === leadId && item.companyId === context.company.id);
    if (!lead) return res.status(404).json({ error: "Lead introuvable." });

    const updatedAt = new Date().toISOString();
    const nextLeads = leads.map((item) => (item.id === lead.id ? { ...item, status, updatedAt } : item));
    await saveCrmLeads(nextLeads);
    res.json({ ok: true, lead: toPublicLead(nextLeads.find((item) => item.id === lead.id)!) });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/modules/sourcing-commercial/runs", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const agentKeyInput = typeof req.body?.agentKey === "string" ? req.body.agentKey.trim() : "";
    const result = await executeUserSourcingRun(context.company, {
      agentKey: agentKeyInput || "sourcing-serper",
      brief: typeof req.body?.brief === "string" ? req.body.brief : "",
      sector: typeof req.body?.sector === "string" ? req.body.sector : "",
      zone: typeof req.body?.zone === "string" ? req.body.zone : "",
      targetCount: Number(req.body?.targetCount ?? 6)
    });

    if (!result.ok) {
      const status =
        result.code === "subscription" ? 403 :
        result.code === "agent_not_found" ? 404 :
        result.code === "validation" ? 400 :
        result.code === "no_results" ? 422 :
        409;
      return res.status(status).json({ error: result.error });
    }

    res.status(201).json({ ok: true, run: toPublicSourcingRun(result.run) });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/modules/sourcing-commercial/runs/:runId/prospects/:prospectId/push-crm", async (req, res, next) => {
  try {
    const context = await resolveAuthenticatedContext(req);
    if (!context) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session utilisateur invalide." });
    }
    const runtime = await getCompanyRuntime(context.company);
    const crmSubscription = runtime.subscriptions.find((item) => item.moduleKey === "crm-intelligent");
    if (!crmSubscription || !isAccessibleSubscriptionStatus(crmSubscription.status)) {
      return res.status(403).json({ error: "Le CRM intelligent doit etre actif pour recevoir un prospect." });
    }

    const runId = String(req.params.runId ?? "");
    const prospectId = String(req.params.prospectId ?? "");
    const runs = await loadSourcingRuns();
    const run = runs.find((item) => item.id === runId && item.companyId === context.company.id);
    if (!run) return res.status(404).json({ error: "Run introuvable." });
    const prospect = run.prospects.find((item) => item.id === prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect introuvable." });

    const leads = await loadCrmLeads();
    const updatedAt = new Date().toISOString();
    const lead: SaasCrmLead = {
      id: prospect.crmLeadId ?? randomUUID(),
      companyId: context.company.id,
      name: prospect.name,
      company: prospect.company,
      source: `Sourcing:${prospect.website || prospect.source}`,
      score: prospect.score,
      status: prospect.score >= 80 ? "hot" : prospect.score >= 60 ? "warm" : "new",
      updatedAt
    };

    const nextLeads = [lead, ...leads.filter((item) => item.id !== lead.id)];
    await saveCrmLeads(nextLeads);

    const nextRuns = runs.map((item) =>
      item.id === run.id
        ? {
            ...item,
            prospects: item.prospects.map((entry) =>
              entry.id === prospect.id ? { ...entry, crmLeadId: lead.id, pushedToCrmAt: updatedAt } : entry
            )
          }
        : item
    );
    await saveSourcingRuns(nextRuns);

    const nextRun = nextRuns.find((item) => item.id === run.id)!;
    res.json({ ok: true, lead: toPublicLead(lead), run: toPublicSourcingRun(nextRun) });
  } catch (error) {
    next(error);
  }
});

// ─── Middleware : protection de toutes les routes /admin/* ────────────────
saasRouter.use("/admin", async (req, res, next) => {
  try {
    const admin = await resolveAuthenticatedAdmin(req);
    if (!admin) return res.status(401).json({ error: "Acces non autorise. Connectez-vous en tant qu'admin." });
    next();
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/admin/overview", async (_req, res, next) => {
  try {
    const [companies, users, profiles, subscriptions, invoices] = await Promise.all([
      loadCompanies(),
      loadUsers(),
      loadAgentProfiles(),
      loadSubscriptions(),
      loadInvoices()
    ]);

    const companiesPublic = companies.map((company) => ({
      ...toPublicCompany(company, subscriptions.filter((item) => item.companyId === company.id)),
      usersCount: users.filter((user) => user.companyId === company.id).length,
      activeModulesCount: subscriptions.filter((item) => item.companyId === company.id && isAccessibleSubscriptionStatus(item.status)).length,
      nextRenewal: subscriptions
        .filter((item) => item.companyId === company.id)
        .map((item) => item.nextBillingDate)
        .sort()[0] ?? null
    }));

    const modules = moduleCatalog.map((module) => ({
      ...module,
      activeCompanies: subscriptions.filter((subscription) => subscription.moduleKey === module.key && isAccessibleSubscriptionStatus(subscription.status)).length
    }));

    res.json({
      stats: {
        companies: companies.length,
        users: users.length,
        activeModules: subscriptions.filter((item) => isAccessibleSubscriptionStatus(item.status)).length,
        agentProfiles: profiles.length,
        pendingInvoices: invoices.filter((item) => item.status === "sent" || item.status === "overdue").length
      },
      companies: companiesPublic,
      modules
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/admin/companies/:companyId", async (req, res, next) => {
  try {
    const companyId = String(req.params.companyId ?? "");
    const [companies, users, profiles, subscriptions, invoices] = await Promise.all([
      loadCompanies(),
      loadUsers(),
      loadAgentProfiles(),
      loadSubscriptions(),
      loadInvoices()
    ]);

    const company = companies.find((item) => item.id === companyId);
    if (!company) return res.status(404).json({ error: "Entreprise SaaS introuvable." });

    res.json({
      company: toPublicCompany(company, subscriptions.filter((item) => item.companyId === company.id)),
      users: users.filter((item) => item.companyId === company.id).map(toPublicUser),
      subscriptions: subscriptions.filter((item) => item.companyId === company.id).map((item) => toPublicSubscription(item, invoices)),
      invoices: invoices.filter((item) => item.companyId === company.id).map(toPublicInvoice),
      agents: profiles
        .filter((item) => item.companyId === company.id)
        .map((profile) => toPublicAgentProfile(profile))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/admin/subscriptions", async (_req, res, next) => {
  try {
    const [companies, subscriptions, invoices] = await Promise.all([loadCompanies(), loadSubscriptions(), loadInvoices()]);
    res.json({
      subscriptions: subscriptions.map((subscription) => ({
        ...toPublicSubscription(subscription, invoices),
        companyName: companies.find((company) => company.id === subscription.companyId)?.name ?? "Entreprise inconnue"
      }))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/admin/invoices", async (_req, res, next) => {
  try {
    const companies = await loadCompanies();
    const invoices = await loadInvoices();
    res.json({
      invoices: invoices.map((invoice) => ({
        ...toPublicInvoice(invoice),
        companyName: companies.find((company) => company.id === invoice.companyId)?.name ?? "Entreprise inconnue"
      }))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/admin/agents", async (_req, res, next) => {
  try {
    const [companies, profiles, subscriptions, invoices] = await Promise.all([loadCompanies(), loadAgentProfiles(), loadSubscriptions(), loadInvoices()]);
    res.json({
      agents: profiles.map((profile) => ({
        ...toPublicAgentProfile(profile),
        companyName: companies.find((item) => item.id === profile.companyId)?.name ?? "Entreprise inconnue",
        subscription: (() => {
          const subscription = subscriptions.find((item) => item.companyId === profile.companyId && item.moduleKey === profile.moduleKey);
          return subscription ? toPublicSubscription(subscription, invoices) : null;
        })()
      }))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.get("/admin/sourcing", async (_req, res, next) => {
  try {
    const [companies, users, profiles, subscriptions, runs] = await Promise.all([
      loadCompanies(),
      loadUsers(),
      loadAgentProfiles(),
      loadSubscriptions(),
      loadSourcingRuns()
    ]);

    const sourcingCompanies = companies.filter((company) =>
      company.modules.some((module) => module.moduleKey === "sourcing-commercial")
    );
    const sourcingProfiles = profiles.filter((profile) => profile.moduleKey === "sourcing-commercial");
    const recentRuns = runs
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 10);

    res.json({
      stats: {
        workspaces: sourcingCompanies.length,
        activeAgents: sourcingProfiles.filter((profile) => profile.isEnabled).length,
        pausedAgents: sourcingProfiles.filter((profile) => !profile.isEnabled).length,
        runs: runs.length,
        prospects: runs.reduce((sum, run) => sum + run.foundCount, 0)
      },
      workspaces: sourcingCompanies.map((company) => {
        const companyProfiles = sourcingProfiles
          .filter((profile) => profile.companyId === company.id)
          .map((profile) => toPublicAgentProfile(profile));
        const companyRuns = runs.filter((run) => run.companyId === company.id);
        const subscription = subscriptions.find(
          (item) => item.companyId === company.id && item.moduleKey === "sourcing-commercial"
        );
        return {
          companyId: company.id,
          companyName: company.name,
          ownerEmail: company.ownerEmail,
          usersCount: users.filter((user) => user.companyId === company.id).length,
          subscriptionStatus: subscription?.status ?? "paused",
          totalRuns: companyRuns.length,
          totalProspects: companyRuns.reduce((sum, run) => sum + run.foundCount, 0),
          lastRunAt: companyRuns
            .slice()
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]?.createdAt ?? null,
          agents: companyProfiles
        };
      }),
      recentRuns: recentRuns.map((run) => ({
        ...toPublicSourcingRun(run),
        companyName: companies.find((company) => company.id === run.companyId)?.name ?? "Entreprise inconnue"
      }))
    });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/admin/sourcing/agents/:companyId/:agentKey", async (req, res, next) => {
  try {
    const companyId = String(req.params.companyId ?? "");
    const agentKey = String(req.params.agentKey ?? "");
    if (!companyId || !agentKey) {
      return res.status(400).json({ error: "Agent sourcing admin invalide." });
    }

    const isEnabled = typeof req.body?.isEnabled === "boolean" ? req.body.isEnabled : null;
    if (isEnabled === null) {
      return res.status(400).json({ error: "Etat agent invalide." });
    }

    const allProfiles = await loadAgentProfiles();
    const profile = allProfiles.find(
      (item) => item.companyId === companyId && item.moduleKey === "sourcing-commercial" && item.agentKey === agentKey
    );
    if (!profile) {
      return res.status(404).json({ error: "Agent sourcing introuvable." });
    }

    const updatedAt = new Date().toISOString();
    const nextProfiles = allProfiles.map((item) =>
      item.id === profile.id
        ? {
            ...item,
            isEnabled,
            updatedAt
          }
        : item
    );

    await saveAgentProfiles(nextProfiles);
    const nextProfile = nextProfiles.find((item) => item.id === profile.id)!;
    res.json({ ok: true, agent: toPublicAgentProfile(nextProfile) });
  } catch (error) {
    next(error);
  }
});

// ─── Plans sourcing (public) ───────────────────────────────────────────────

saasRouter.get("/public/sourcing/plans", async (_req, res, next) => {
  try {
    const plans = await loadSourcingPlans();
    const active = plans.filter((p) => p.isActive);
    res.json({ ok: true, plans: active });
  } catch (error) {
    next(error);
  }
});

// ─── Plans sourcing (admin) ────────────────────────────────────────────────

saasRouter.get("/admin/sourcing/plans", async (_req, res, next) => {
  try {
    const plans = await loadSourcingPlans();
    res.json({ ok: true, plans });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/admin/sourcing/plans", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const monthlyPrice = typeof req.body?.monthlyPrice === "number" ? req.body.monthlyPrice : 0;
    const maxRunsPerMonth = typeof req.body?.maxRunsPerMonth === "number" ? req.body.maxRunsPerMonth : 10;
    const maxProspectsPerRun = typeof req.body?.maxProspectsPerRun === "number" ? req.body.maxProspectsPerRun : 20;
    const agents = Array.isArray(req.body?.agents)
      ? (req.body.agents as unknown[]).filter((a): a is "serper" | "tavily" => a === "serper" || a === "tavily")
      : (["serper"] as ("serper" | "tavily")[]);
    const isPopular = typeof req.body?.isPopular === "boolean" ? req.body.isPopular : false;

    if (!name) return res.status(400).json({ error: "Le nom du plan est requis." });

    const now = new Date().toISOString();
    const newPlan: SourcingPlan = {
      id: randomUUID(),
      name,
      description,
      monthlyPrice,
      currency: "XOF",
      maxRunsPerMonth,
      maxProspectsPerRun,
      agents,
      isActive: true,
      isPopular,
      createdAt: now,
      updatedAt: now
    };

    const plans = await loadSourcingPlans();
    await saveSourcingPlans([...plans, newPlan]);
    res.status(201).json({ ok: true, plan: newPlan });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/admin/sourcing/plans/:id", async (req, res, next) => {
  try {
    const planId = String(req.params.id ?? "");
    if (!planId) return res.status(400).json({ error: "ID plan invalide." });

    const plans = await loadSourcingPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return res.status(404).json({ error: "Plan sourcing introuvable." });

    const updatedAt = new Date().toISOString();
    const updatedPlan: SourcingPlan = {
      ...plan,
      name: typeof req.body?.name === "string" ? req.body.name.trim() || plan.name : plan.name,
      description: typeof req.body?.description === "string" ? req.body.description.trim() : plan.description,
      monthlyPrice: typeof req.body?.monthlyPrice === "number" ? req.body.monthlyPrice : plan.monthlyPrice,
      maxRunsPerMonth: typeof req.body?.maxRunsPerMonth === "number" ? req.body.maxRunsPerMonth : plan.maxRunsPerMonth,
      maxProspectsPerRun: typeof req.body?.maxProspectsPerRun === "number" ? req.body.maxProspectsPerRun : plan.maxProspectsPerRun,
      agents: Array.isArray(req.body?.agents)
        ? (req.body.agents as unknown[]).filter((a): a is "serper" | "tavily" => a === "serper" || a === "tavily")
        : plan.agents,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : plan.isActive,
      isPopular: typeof req.body?.isPopular === "boolean" ? req.body.isPopular : plan.isPopular,
      updatedAt
    };

    await saveSourcingPlans(plans.map((p) => (p.id === planId ? updatedPlan : p)));
    res.json({ ok: true, plan: updatedPlan });
  } catch (error) {
    next(error);
  }
});

saasRouter.delete("/admin/sourcing/plans/:id", async (req, res, next) => {
  try {
    const planId = String(req.params.id ?? "");
    if (!planId) return res.status(400).json({ error: "ID plan invalide." });

    const plans = await loadSourcingPlans();
    if (!plans.find((p) => p.id === planId)) return res.status(404).json({ error: "Plan sourcing introuvable." });

    await saveSourcingPlans(plans.filter((p) => p.id !== planId));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ─── Agents globaux Serper / Tavily ────────────────────────────────────────

saasRouter.get("/admin/sourcing/global-agents", async (_req, res, next) => {
  try {
    const agents = await getGlobalAgents();
    res.json({ ok: true, agents });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/admin/sourcing/global-agents/:agentKey", async (req, res, next) => {
  try {
    const agentKey = req.params.agentKey;
    if (agentKey !== "sourcing-serper" && agentKey !== "sourcing-tavily") {
      return res.status(400).json({ error: "Cle agent globale invalide." });
    }

    const current = await getGlobalAgents();
    const agent = current.find((a) => a.agentKey === agentKey)!;
    const updatedAt = new Date().toISOString();

    const updated: SourcingGlobalAgent = {
      ...agent,
      displayName: typeof req.body?.displayName === "string" ? req.body.displayName.trim() || agent.displayName : agent.displayName,
      isEnabled: typeof req.body?.isEnabled === "boolean" ? req.body.isEnabled : agent.isEnabled,
      modelProvider:
        typeof req.body?.modelProvider === "string" && req.body.modelProvider.trim()
          ? req.body.modelProvider.trim()
          : agent.modelProvider,
      modelId: typeof req.body?.modelId === "string" && req.body.modelId ? req.body.modelId : agent.modelId,
      defaultKeywords: typeof req.body?.defaultKeywords === "string" ? req.body.defaultKeywords : agent.defaultKeywords,
      qualificationInstructions: typeof req.body?.qualificationInstructions === "string" ? req.body.qualificationInstructions : agent.qualificationInstructions,
      defaultSector: typeof req.body?.defaultSector === "string" ? req.body.defaultSector : agent.defaultSector,
      defaultZone: typeof req.body?.defaultZone === "string" ? req.body.defaultZone : agent.defaultZone,
      defaultTargetCount: typeof req.body?.defaultTargetCount === "number" ? req.body.defaultTargetCount : agent.defaultTargetCount,
      systemPrompt: typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt : agent.systemPrompt,
      personality: typeof req.body?.personality === "string" ? req.body.personality : agent.personality,
      identity: typeof req.body?.identity === "string" ? req.body.identity : agent.identity,
      userContext: typeof req.body?.userContext === "string" ? req.body.userContext : agent.userContext,
      allowedTools: Array.isArray(req.body?.allowedTools)
        ? req.body.allowedTools.map(String).map((entry: string) => entry.trim()).filter(Boolean)
        : agent.allowedTools,
      updatedAt
    };

    await saveGlobalAgents(current.map((a) => (a.agentKey === agentKey ? updated : a)));
    res.json({ ok: true, agent: updated });
  } catch (error) {
    next(error);
  }
});

saasRouter.post("/admin/sourcing/global-agents/:agentKey/reapply", async (req, res, next) => {
  try {
    const agentKey = req.params.agentKey;
    if (agentKey !== "sourcing-serper" && agentKey !== "sourcing-tavily") {
      return res.status(400).json({ error: "Cle agent globale invalide." });
    }

    const updatedProfiles = await reapplyGlobalAgentTemplateToExistingProfiles(agentKey);
    res.json({ ok: true, updatedProfiles });
  } catch (error) {
    next(error);
  }
});

// ─── Abonnés sourcing ──────────────────────────────────────────────────────

saasRouter.get("/admin/sourcing/subscribers", async (_req, res, next) => {
  try {
    const [companies, users, subscriptions, runs] = await Promise.all([
      loadCompanies(),
      loadUsers(),
      loadSubscriptions(),
      loadSourcingRuns()
    ]);

    const subscribers = companies
      .filter((c) => c.modules.some((m) => m.moduleKey === "sourcing-commercial"))
      .map((company) => {
        const sub = subscriptions.find((s) => s.companyId === company.id && s.moduleKey === "sourcing-commercial");
        const companyRuns = runs.filter((r) => r.companyId === company.id);
        const companyUsers = users.filter((u) => u.companyId === company.id);
        return {
          companyId: company.id,
          companyName: company.name,
          ownerEmail: company.ownerEmail,
          industry: company.industry,
          status: company.status,
          usersCount: companyUsers.length,
          subscription: sub
            ? {
                planName: sub.planName,
                monthlyPrice: sub.monthlyPrice,
                currency: sub.currency,
                status: sub.status,
                startDate: sub.startDate,
                nextBillingDate: sub.nextBillingDate
              }
            : null,
          totalRuns: companyRuns.length,
          totalProspects: companyRuns.reduce((sum, r) => sum + r.foundCount, 0),
          lastRunAt:
            companyRuns
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt ?? null,
          createdAt: company.createdAt
        };
      });

    const revenue = subscribers.reduce((sum, s) => sum + (s.subscription?.monthlyPrice ?? 0), 0);
    res.json({ ok: true, subscribers, totalRevenue: revenue });
  } catch (error) {
    next(error);
  }
});

saasRouter.patch("/admin/companies/:companyId/modules/:moduleKey", async (req, res, next) => {
  try {
    const companyId = String(req.params.companyId ?? "");
    const moduleKey = String(req.params.moduleKey ?? "");
    if (!companyId || !isModuleKey(moduleKey)) {
      return res.status(404).json({ error: "Entreprise ou module introuvable." });
    }

    const requestedStatus =
      typeof req.body?.status === "string" && isSubscriptionStatus(req.body.status)
        ? req.body.status
        : typeof req.body?.active === "boolean"
          ? req.body.active
            ? "active"
            : "paused"
          : null;
    if (!requestedStatus) {
      return res.status(400).json({ error: "Statut module invalide." });
    }

    const [companies, subscriptions, invoices] = await Promise.all([loadCompanies(), loadSubscriptions(), loadInvoices()]);
    const company = companies.find((item) => item.id === companyId);
    if (!company) return res.status(404).json({ error: "Entreprise SaaS introuvable." });

    const updatedAt = new Date().toISOString();
    const nextInvoices = [...invoices];
    const nextSubscriptions = subscriptions.map((subscription) => {
      if (subscription.companyId !== companyId || subscription.moduleKey !== moduleKey) return subscription;
      const next = { ...subscription, status: requestedStatus, updatedAt };
      if (requestedStatus === "active") {
        const invoice = createInvoiceForSubscription({ ...next, startDate: updatedAt, nextBillingDate: addDays(updatedAt, 30) }, nextInvoices, updatedAt);
        nextInvoices.push(invoice);
        next.lastInvoiceId = invoice.id;
        next.lastPaymentDate = updatedAt;
        next.startDate = updatedAt;
        next.nextBillingDate = addDays(updatedAt, 30);
      }
      return next;
    });

    const nextCompanies = companies.map((item) =>
      item.id === companyId
        ? {
            ...item,
            modules: item.modules.map((module) =>
              module.moduleKey === moduleKey ? { ...module, active: isAccessibleSubscriptionStatus(requestedStatus) } : module
            ),
            updatedAt
          }
        : item
    );

    await Promise.all([saveSubscriptions(nextSubscriptions), saveInvoices(nextInvoices), saveCompanies(nextCompanies)]);
    const nextCompany = nextCompanies.find((item) => item.id === companyId)!;
    const runtime = await getCompanyRuntime(nextCompany);
    res.json({ ok: true, company: toPublicCompany(runtime.company, runtime.subscriptions) });
  } catch (error) {
    next(error);
  }
});

// ─── Méthodes de paiement (admin config) ──────────────────────────────────

saasRouter.get("/admin/payment-methods", async (_req, res, next) => {
  try {
    const methods = await loadPaymentMethods();
    res.json({ ok: true, methods });
  } catch (error) { next(error); }
});

saasRouter.patch("/admin/payment-methods", async (req, res, next) => {
  try {
    const current = await loadPaymentMethods();
    const updated: PaymentMethods = {
      waveNumber: typeof req.body?.waveNumber === "string" ? req.body.waveNumber.trim() : current.waveNumber,
      waveHolder: typeof req.body?.waveHolder === "string" ? req.body.waveHolder.trim() : current.waveHolder,
      orangeMoneyNumber: typeof req.body?.orangeMoneyNumber === "string" ? req.body.orangeMoneyNumber.trim() : current.orangeMoneyNumber,
      orangeMoneyHolder: typeof req.body?.orangeMoneyHolder === "string" ? req.body.orangeMoneyHolder.trim() : current.orangeMoneyHolder,
      instructions: typeof req.body?.instructions === "string" ? req.body.instructions.trim() : current.instructions
    };
    await savePaymentMethods(updated);
    res.json({ ok: true, methods: updated });
  } catch (error) { next(error); }
});

// ─── Demandes de paiement (admin) ─────────────────────────────────────────

saasRouter.get("/admin/payments/requests", async (_req, res, next) => {
  try {
    const requests = await loadPaymentRequests();
    const sorted = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ ok: true, requests: sorted });
  } catch (error) { next(error); }
});

saasRouter.patch("/admin/payments/requests/:id/approve", async (req, res, next) => {
  try {
    const requestId = String(req.params.id ?? "");
    const requests = await loadPaymentRequests();
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) return res.status(404).json({ error: "Demande introuvable." });

    const paymentReq = requests[idx]!;
    if (paymentReq.status !== "pending")
      return res.status(400).json({ error: "Cette demande a déjà été traitée." });

    const now = new Date().toISOString();
    const updated = { ...paymentReq, status: "approved" as const, updatedAt: now };
    const nextRequests = requests.map((r) => (r.id === requestId ? updated : r));
    await savePaymentRequests(nextRequests);

    // Activer le plan pour l'entreprise
    const subscriptions = await loadSubscriptions();
    const subIdx = subscriptions.findIndex(
      (s) => s.companyId === paymentReq.companyId && s.moduleKey === "sourcing-commercial"
    );
    if (subIdx !== -1) {
      const nextBillingDate = addDays(now, 30);
      const updatedSub = {
        ...subscriptions[subIdx]!,
        planName: paymentReq.planName,
        monthlyPrice: paymentReq.amount,
        status: "active" as const,
        startDate: now,
        nextBillingDate,
        lastPaymentDate: now,
        updatedAt: now
      };
      await saveSubscriptions(subscriptions.map((s, i) => (i === subIdx ? updatedSub : s)));
    }

    // Email de confirmation d'approbation
    try {
      const companyUsers = (await loadUsers()).filter((u) => u.companyId === paymentReq.companyId);
      const account = await getRuntimeEmailAccount("main");
      const engine = new EmailEngine();
      for (const u of companyUsers) {
        await engine.send({
          account,
          from: `${account.name ?? "Oumar Business"} <${account.email}>`,
          to: [u.email],
          subject: `Votre plan ${paymentReq.planName} est active !`,
          text: `Bonjour ${u.name},\n\nVotre demande de paiement pour le plan ${paymentReq.planName} a ete approuvee. Votre plan est maintenant actif.\n\nConnectez-vous pour commencer a utiliser vos agents de sourcing.\n\nOumar Business`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#0e0e0e;color:#fff;border-radius:16px"><h2 style="color:#d4a020;margin:0 0 16px">Plan ${paymentReq.planName} active !</h2><p>Bonjour <strong>${u.name}</strong>,</p><p>Votre demande de paiement a ete <strong style="color:#34d399">approuvee</strong>. Votre plan <strong>${paymentReq.planName}</strong> est maintenant actif.</p><p>Connectez-vous pour commencer a utiliser vos agents de sourcing.</p><a href="${userDashboardUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#d4a020;color:#000;border-radius:12px;font-weight:bold;text-decoration:none">Acceder a mon espace</a><p style="color:#888;font-size:12px">Oumar Business</p></div>`
        });
      }
    } catch { /* Email optionnel */ }

    res.json({ ok: true, request: updated });
  } catch (error) { next(error); }
});

saasRouter.patch("/admin/payments/requests/:id/reject", async (req, res, next) => {
  try {
    const requestId = String(req.params.id ?? "");
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    const requests = await loadPaymentRequests();
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) return res.status(404).json({ error: "Demande introuvable." });

    const paymentReq = requests[idx]!;
    if (paymentReq.status !== "pending")
      return res.status(400).json({ error: "Cette demande a déjà été traitée." });

    const updated = { ...paymentReq, status: "rejected" as const, rejectionReason: reason, updatedAt: new Date().toISOString() };
    await savePaymentRequests(requests.map((r) => (r.id === requestId ? updated : r)));

    // Email de notification de refus
    try {
      const companyUsers = (await loadUsers()).filter((u) => u.companyId === paymentReq.companyId);
      const account = await getRuntimeEmailAccount("main");
      const engine = new EmailEngine();
      const reasonBlock = reason
        ? `<div style="margin:16px 0;padding:12px 16px;background:#1a0000;border-left:3px solid #ef4444;border-radius:8px;color:#fca5a5;font-size:14px">${reason}</div>`
        : "";
      for (const u of companyUsers) {
        await engine.send({
          account,
          from: `${account.name ?? "Oumar Business"} <${account.email}>`,
          to: [u.email],
          subject: `Votre demande de paiement a ete refusee`,
          text: `Bonjour ${u.name},\n\nVotre demande de paiement pour le plan ${paymentReq.planName} a ete refusee.${reason ? `\n\nRaison : ${reason}` : ""}\n\nSi vous avez des questions, contactez notre support.\n\nOumar Business`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#0e0e0e;color:#fff;border-radius:16px"><h2 style="color:#ef4444;margin:0 0 16px">Demande refusee</h2><p>Bonjour <strong>${u.name}</strong>,</p><p>Votre demande de paiement pour le plan <strong>${paymentReq.planName}</strong> a ete <strong style="color:#ef4444">refusee</strong>.</p>${reasonBlock}<p>Si vous avez des questions, contactez notre support.</p><a href="${userDashboardUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#d4a020;color:#000;border-radius:12px;font-weight:bold;text-decoration:none">Acceder a mon espace</a><p style="color:#888;font-size:12px">Oumar Business</p></div>`
        });
      }
    } catch { /* Email optionnel */ }

    res.json({ ok: true, request: updated });
  } catch (error) { next(error); }
});
