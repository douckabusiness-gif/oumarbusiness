"use client";

export type SaasModuleKey = "whatsapp-business" | "crm-intelligent" | "billing-intelligent" | "sourcing-commercial";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "paused" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type AlertType = "warning" | "info";

export type SaasCompanyModule = {
  moduleKey: SaasModuleKey;
  title: string;
  description: string;
  monthlyPrice: number;
  active: boolean;
  activatedAt: string;
  subscriptionStatus: SubscriptionStatus;
  nextBillingDate: string | null;
  lastInvoiceId: string | null;
};

export type SaasCompany = {
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
  modules: SaasCompanyModule[];
  createdAt: string;
  updatedAt: string;
};

export type SaasUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  createdAt: string;
};

export type SaasSubscription = {
  id: string;
  moduleKey: SaasModuleKey;
  moduleTitle: string;
  planName: string;
  monthlyPrice: number;
  currency: "XOF";
  status: SubscriptionStatus;
  startDate: string;
  nextBillingDate: string;
  lastPaymentDate: string | null;
  lastInvoiceId: string | null;
  lastInvoiceStatus: InvoiceStatus | null;
  accessible: boolean;
  updatedAt: string;
};

export type SaasInvoice = {
  id: string;
  companyId: string;
  subscriptionId: string;
  moduleKey: SaasModuleKey;
  moduleTitle: string;
  number: string;
  amount: number;
  currency: "XOF";
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  issuedAt: string;
  paidAt?: string | null;
  createdAt: string;
  companyName?: string;
};

export type SaasAgentProfile = {
  id: string;
  companyId: string;
  moduleKey: SaasModuleKey;
  moduleTitle: string;
  agentKey: string;
  displayName: string;
  isEnabled: boolean;
  tone: string;
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
  missionConfig: SourcingMissionConfig;
  metrics?: {
    runs: number;
    prospects: number;
    conversions: number;
    sources: number;
    lastRunAt: string | null;
  };
  updatedAt: string;
};

export type SourcingMissionConfig = {
  source: "serper" | "tavily";
  keywords: string;
  qualificationInstructions: string;
  enrollmentMode: "none";
  defaultSector: string;
  defaultZone: string;
  defaultTargetCount: number;
};

export type SaasDashboardAlert = {
  type: AlertType;
  message: string;
};

export type SaasCrmLead = {
  id: string;
  companyId: string;
  name: string;
  company: string;
  source: string;
  score: number;
  status: "new" | "warm" | "hot" | "won";
  updatedAt: string;
};

export type SaasSourcingRun = {
  id: string;
  companyId: string;
  moduleKey: "sourcing-commercial";
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
  status: "draft" | "running" | "completed";
  providerMode: "live" | "waiting_api";
  providers: {
    serperConfigured: boolean;
    tavilyConfigured: boolean;
  };
  prospects: Array<{
    id: string;
    name: string;
    company: string;
    website: string;
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

export type UserSourcingLiveSessionStatus = "idle" | "running" | "paused" | "stopped" | "blocked" | "completed";

export type UserSourcingLiveSession = {
  id: string;
  companyId: string;
  moduleKey: "sourcing-commercial";
  status: UserSourcingLiveSessionStatus;
  startedAt: string;
  updatedAt: string;
  stoppedAt: string | null;
  activeAgentKeys: string[];
  pausedAgentKeys: string[];
  brief: string;
  stopReason: string | null;
  cycleCount: number;
  lastCycleAt: string | null;
  currentAgentKey: string | null;
};

export type UserSourcingLiveEvent = {
  id: string;
  sessionId: string;
  companyId: string;
  agentKey: string | null;
  agentName: string | null;
  type: "session_started" | "session_stopped" | "session_paused" | "session_resumed" | "cycle_started" | "cycle_completed" | "prospects_retained" | "prospect_rejected" | "quota_reached" | "provider_error" | "agent_blocked" | "no_results";
  level: "info" | "success" | "warning" | "error";
  message: string;
  runId: string | null;
  prospectCount: number | null;
  createdAt: string;
};

export type SaasWhatsAppActivity = {
  id: string;
  companyId: string;
  moduleKey: "whatsapp-business";
  contactName: string;
  lastMessage: string;
  direction: "inbound" | "outbound";
  status: "open" | "pending" | "qualified";
  updatedAt: string;
};

export type SaasWhatsAppSession = {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  connected: boolean;
  mode: "baileys" | "cloud";
};

export type SaasSettingsStatus = "not_configured" | "configuration_in_progress" | "connected";

export type SaasWhatsAppSettingsSummary = {
  status: SaasSettingsStatus;
  activeMode: "baileys" | "cloud" | null;
  connectedSessionCount: number;
  hasMetaConfig: boolean;
  hasBaileysSession: boolean;
};

export type SaasWhatsAppSettings = {
  displayName: string;
  businessPhone: string;
  welcomeMessage: string;
  awayMessage: string;
  activeHours: string;
  simpleRules: string;
  escalationThreshold: string;
  faq: string[];
  preferredConnectionMode: "baileys" | "cloud";
  metaConfig: {
    phoneNumberId: string;
    verifyToken: string;
    displayPhoneNumber: string;
    accessTokenMasked: string;
    webhookUrl: string;
    sessionId: string;
  } | null;
  summary: SaasWhatsAppSettingsSummary;
};

export type SaasEmailConfig = {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  signature: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPasswordMasked: string;
  smtpConfigured: boolean;
  smtpValidatedAt: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPasswordMasked: string;
  imapConfigured: boolean;
  imapValidatedAt: string | null;
};

export type SaasSettingsOverview = {
  company: {
    status: Exclude<SaasSettingsStatus, "connected"> | "connected";
    companyName: string;
    skillsCount: number;
    industry: string;
  };
  whatsapp: SaasWhatsAppSettingsSummary;
  email: {
    status: Exclude<SaasSettingsStatus, "connected"> | "connected";
    senderEmail: string;
    smtpConfigured: boolean;
    imapConfigured: boolean;
  };
};

export type UserPaymentMethods = {
  waveNumber: string;
  waveHolder: string;
  orangeMoneyNumber: string;
  orangeMoneyHolder: string;
  instructions: string;
  configured: boolean;
};

export type UserPaymentRequest = {
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

export type SourcingPlan = {
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

export type SourcingGlobalAgent = {
  agentKey: "sourcing-serper" | "sourcing-tavily";
  displayName: string;
  isEnabled: boolean;
  source: "serper" | "tavily";
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

export type SourcingSubscriber = {
  companyId: string;
  companyName: string;
  ownerEmail: string;
  industry: string;
  status: "active" | "inactive";
  usersCount: number;
  subscription: {
    planName: string;
    monthlyPrice: number;
    currency: string;
    status: SubscriptionStatus;
    startDate: string;
    nextBillingDate: string;
  } | null;
  totalRuns: number;
  totalProspects: number;
  lastRunAt: string | null;
  createdAt: string;
};

export type UserSourcingSubscriptionView = {
  subscription: SaasSubscription | null;
  currentPlan: SourcingPlan | null;
  latestRequest: UserPaymentRequest | null;
};

export type UserSourcingLiveWorkspace = {
  session: UserSourcingLiveSession | null;
  feed: UserSourcingLiveEvent[];
  quota: {
    planName: string | null;
    maxRunsPerMonth: number | null;
    maxProspectsPerRun: number | null;
    runsThisMonth: number;
    runsRemaining: number | null;
  };
};

export function formatMoney(value: number, currency = "FCFA") {
  return `${new Intl.NumberFormat("fr-FR").format(value)} ${currency}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function normalizeProspectScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  if (score <= 10) return Math.max(0, Math.min(10, Math.round(score)));
  return Math.max(0, Math.min(10, Math.round(score / 10)));
}

export function subscriptionStatusLabel(status: SubscriptionStatus) {
  switch (status) {
    case "trial":
      return "Essai";
    case "active":
      return "Actif";
    case "past_due":
      return "Paiement en retard";
    case "paused":
      return "En pause";
    case "cancelled":
      return "Annule";
    default:
      return status;
  }
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "sent":
      return "Envoyee";
    case "paid":
      return "Payee";
    case "overdue":
      return "En retard";
    default:
      return status;
  }
}

export function statusBadgeClass(status: SubscriptionStatus | InvoiceStatus) {
  switch (status) {
    case "active":
    case "paid":
      return "bg-emerald-500/15 text-emerald-300";
    case "trial":
      return "bg-sky-500/15 text-sky-300";
    case "past_due":
    case "overdue":
      return "bg-red-500/15 text-red-300";
    case "paused":
      return "bg-amber-500/15 text-amber-200";
    case "cancelled":
    case "draft":
      return "bg-zinc-500/15 text-zinc-300";
    case "sent":
      return "bg-gold/15 text-gold";
    default:
      return "bg-zinc-500/15 text-zinc-300";
  }
}

export function moduleHref(moduleKey: SaasModuleKey) {
  switch (moduleKey) {
    case "sourcing-commercial":
    case "whatsapp-business":
    case "crm-intelligent":
    case "billing-intelligent":
      return "/user/sourcing";
  }
}

export function settingsHref(section?: "company" | "whatsapp" | "email") {
  return "/user/profile";
}

export function settingsStatusLabel(status: SaasSettingsStatus) {
  switch (status) {
    case "connected":
      return "Connecte";
    case "configuration_in_progress":
      return "Configuration en cours";
    case "not_configured":
    default:
      return "Non configure";
  }
}
