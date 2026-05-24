import { Router } from "express";
import { EmailEngine } from "@oumar/email-engine";
import { baileysManager } from "@oumar/whatsapp-baileys";
import { agentDefinitions } from "../../agents/definitions.js";
import { orchestrator } from "../../agents/orchestrator.js";
import { prisma } from "../../db/prisma.js";
import { extractPageContent, getSearchProviderStatus, researchObjective, searchSerper } from "../../services/searchIntelligence.js";
import { isOptedOut, registerOptOut, type OptOutChannel } from "../../services/sourcingOptout.js";
import { getRuntimeEmailAccount } from "./settings.js";
import { getTool } from "../../agents/tools/registry.js";

export const agentsRouter = Router();

type SourcingChannel = "email_whatsapp" | "email" | "whatsapp" | "crm_only";

type SourcingRun = {
  id: string;
  objective: string;
  sector: string;
  location: string;
  service: string;
  channel: SourcingChannel;
  tone: string;
  status: "running" | "completed" | "partial" | "failed";
  mode: "live" | "waiting_api";
  prospects: SourcingProspect[];
  actions: SourcingAction[];
  logs: SourcingLog[];
  parameters: {
    discovery: {
      provider: "serper";
      source: string;
      limit: number;
    };
    qualification: {
      provider: "tavily";
      autoContactScore: number;
      crmOnlyScore: number;
      rules: string;
    };
  };
  limits: {
    emailDailyLimit: number;
    whatsappDailyLimit: number;
    emailSentToday: number;
    whatsappSentToday: number;
  };
  createdAt: string;
};

type SourcingProspect = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  country: string;
  source: string;
  snippet: string;
  score: number;
  decision: "contact_auto" | "crm_only" | "ignored";
  reasons: string[];
  clientId?: string;
};

type SourcingAction = {
  prospectId: string;
  channel: "crm" | "email" | "whatsapp";
  status: "completed" | "blocked" | "failed" | "skipped";
  message: string;
};

type SourcingLog = {
  step: string;
  status: "ok" | "blocked" | "error" | "info";
  message: string;
  at: string;
};

type PendingToolAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  agentType: string;
  channel: string;
  clientId?: string;
  conversationId?: string;
  reason: string;
  originalText?: string;
  createdAt: string;
};

type SourcingAgentsConfig = {
  discovery: {
    name: string;
    provider: "serper";
    source: string;
    keywords: string;
    bootstrap: string;
    soul: string;
    identity: string;
    enrollment: string;
    hitl: boolean;
    limit: number;
    enabled: boolean;
  };
  qualification: {
    name: string;
    provider: "tavily";
    bootstrap: string;
    soul: string;
    identity: string;
    enrollment: string;
    hitl: boolean;
    autoContactScore: number;
    crmOnlyScore: number;
    rules: string;
    enabled: boolean;
  };
};

const sourcingHistoryKey = "sourcing_runs";
const sourcingConfigKey = "sourcing_agents_config";
const emailDailyLimit = 30;
const whatsappDailyLimit = 20;
const defaultSourcingConfig: SourcingAgentsConfig = {
  discovery: {
    name: "Chasseur Sourcing Global",
    provider: "serper",
    source: "Serper Google Search international",
    keywords: "PME Afrique, startups Europe, local businesses USA, agences, e-commerce, SaaS, WhatsApp automation, website redesign, AI agent",
    bootstrap: "Objectif 1: scanner Afrique, Europe et USA pour trouver des entreprises qui ont un besoin visible en marketing digital, site web ou agent IA. Chercher large, ramener des opportunites business exploitables, avec site web, secteur, pays et signaux de besoin.",
    soul: "Chasseur international, rapide, persuasif et tres curieux. Tu ne te limites jamais a un pays: tu compares Afrique, Europe et USA pour trouver les meilleures opportunites.",
    identity: "Agent Alpha Global - Expert acquisition B2B international. Specialite: transformer une recherche web brute en liste de prospects qualifiables.",
    enrollment: "Aucun enrolement",
    hitl: true,
    limit: 12,
    enabled: true
  },
  qualification: {
    name: "Analyste Qualification Elite",
    provider: "tavily",
    bootstrap: "Objectif 2: analyser en profondeur les prospects trouves par Agent Alpha. Lire leur site, verifier pays/secteur/contact, detecter le besoin probable, scorer, puis decider: contact automatique, CRM seulement, ou rejet.",
    soul: "Analyste strict, precis et business. Tu preferes 10 vrais prospects rentables plutot que 100 contacts faibles.",
    identity: "Agent Beta Elite - Expert qualification internationale, scoring, CRM et priorisation commerciale.",
    enrollment: "Aucun enrolement",
    hitl: true,
    autoContactScore: 70,
    crmOnlyScore: 50,
    rules: "Prioriser les entreprises en Afrique, Europe et USA avec contact exploitable, site actif, besoin probable en marketing digital, creation web ou agent IA. Score fort si l'entreprise semble perdre du temps, manquer d'automatisation, avoir un site faible, ou recevoir beaucoup de demandes clients.",
    enabled: true
  }
};

agentsRouter.get("/", (_req, res) => {
  res.json({
    agents: agentDefinitions,
    architecture: orchestrator.describeArchitecture()
  });
});

agentsRouter.get("/architecture", (_req, res) => {
  res.json(orchestrator.describeArchitecture());
});

agentsRouter.post("/route", async (req, res, next) => {
  try {
    const decision = await orchestrator.route(req.body);
    res.json(decision);
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/test-chat", async (req, res, next) => {
  try {
    const response = await orchestrator.chat({
      channel: req.body.channel ?? "system",
      text: req.body.text ?? "",
      clientId: req.body.clientId,
      conversationId: req.body.conversationId,
      requestedAgent: req.body.agent,
      metadata: {
        testMode: true,
        locale: req.body.locale ?? "fr",
        provider: req.body.provider ?? "mock",
        externalRef: req.body.externalRef ?? req.body.conversationId
      }
    });

    res.json({
      ...response,
      architecture: orchestrator.describeArchitecture(),
      testedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/tools/pending", async (_req, res, next) => {
  try {
    res.json({ pending: await readPendingToolActions() });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/tools/pending/:id/approve", async (req, res, next) => {
  try {
    const pending = await readPendingToolActions();
    const action = pending.find((item) => item.id === req.params.id);
    if (!action) {
      res.status(404).json({ error: "pending_action_not_found" });
      return;
    }

    const tool = getTool(action.tool);
    if (!tool) {
      res.status(400).json({ error: "unknown_tool" });
      return;
    }

    if (!tool.allowedAgents.includes(action.agentType as never)) {
      res.status(403).json({ error: "tool_not_allowed_for_agent" });
      return;
    }

    const parsed = tool.schema.safeParse(action.args);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_tool_args", details: parsed.error.issues });
      return;
    }

    const startedAt = Date.now();
    const execution = await tool.execute(parsed.data, {
      agentType: action.agentType as never,
      channel: action.channel as never,
      clientId: action.clientId,
      conversationId: action.conversationId,
      originalText: action.originalText ?? "Action HITL approuvee"
    });

    await prisma.agentLog.create({
      data: {
        agentType: action.agentType,
        action: `tool_approved:${tool.name}`,
        input: JSON.stringify(parsed.data),
        output: JSON.stringify(execution.result),
        clientId: action.clientId,
        conversationId: action.conversationId,
        duration: Date.now() - startedAt
      }
    });

    await writePendingToolActions(pending.filter((item) => item.id !== action.id));
    res.json({ action, execution });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/tools/pending/:id/reject", async (req, res, next) => {
  try {
    const pending = await readPendingToolActions();
    const action = pending.find((item) => item.id === req.params.id);
    if (!action) {
      res.status(404).json({ error: "pending_action_not_found" });
      return;
    }

    await prisma.agentLog.create({
      data: {
        agentType: action.agentType,
        action: `tool_rejected:${action.tool}`,
        input: JSON.stringify(action.args),
        output: typeof req.body?.reason === "string" ? req.body.reason : "rejected_by_human",
        clientId: action.clientId,
        conversationId: action.conversationId,
        escalated: true,
        escalatedTo: "human"
      }
    });

    await writePendingToolActions(pending.filter((item) => item.id !== action.id));
    res.json({ action, rejected: true });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/research-objective", async (req, res, next) => {
  try {
    const objective = String(req.body.objective ?? "");
    if (!objective.trim()) {
      res.status(400).json({ error: "objective_required" });
      return;
    }

    const research = await researchObjective({
      objective,
      country: req.body.country,
      language: req.body.language,
      audience: req.body.audience,
      limit: req.body.limit
    });

    res.json({
      agentTool: "search_intelligence",
      ...research
    });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/sourcing/runs", async (_req, res, next) => {
  try {
    res.json({ runs: await getSourcingRuns() });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/sourcing/status", async (_req, res, next) => {
  try {
    const providers = await getSearchProviderStatus();
    const config = await getSourcingAgentsConfig();
    res.json({
      agents: [
        {
          id: "sourcing-discovery",
          name: config.discovery.name,
          provider: "Serper",
          role: "Trouve les entreprises, sites, concurrents et opportunites depuis Google.",
          ready: providers.serper.configured && config.discovery.enabled,
          keySource: providers.serper.source
        },
        {
          id: "sourcing-qualification",
          name: config.qualification.name,
          provider: "Tavily",
          role: "Analyse les pages trouvees, comprend le contexte et renforce le scoring.",
          ready: providers.tavily.configured && config.qualification.enabled,
          keySource: providers.tavily.source
        }
      ],
      config,
      providers
    });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/sourcing/config", async (_req, res, next) => {
  try {
    res.json({ config: await getSourcingAgentsConfig() });
  } catch (error) {
    next(error);
  }
});

agentsRouter.put("/sourcing/config", async (req, res, next) => {
  try {
    const current = await getSourcingAgentsConfig();
    const nextConfig: SourcingAgentsConfig = {
      discovery: {
        ...current.discovery,
        name: stringField(req.body?.discovery?.name) || current.discovery.name,
        source: stringField(req.body?.discovery?.source) || current.discovery.source,
        keywords: stringField(req.body?.discovery?.keywords) || current.discovery.keywords,
        bootstrap: stringField(req.body?.discovery?.bootstrap) || current.discovery.bootstrap,
        soul: stringField(req.body?.discovery?.soul) || current.discovery.soul,
        identity: stringField(req.body?.discovery?.identity) || current.discovery.identity,
        enrollment: stringField(req.body?.discovery?.enrollment) || current.discovery.enrollment,
        hitl: typeof req.body?.discovery?.hitl === "boolean" ? req.body.discovery.hitl : current.discovery.hitl,
        limit: clampNumber(Number(req.body?.discovery?.limit ?? current.discovery.limit), 1, 20),
        enabled: typeof req.body?.discovery?.enabled === "boolean" ? req.body.discovery.enabled : current.discovery.enabled
      },
      qualification: {
        ...current.qualification,
        name: stringField(req.body?.qualification?.name) || current.qualification.name,
        bootstrap: stringField(req.body?.qualification?.bootstrap) || current.qualification.bootstrap,
        soul: stringField(req.body?.qualification?.soul) || current.qualification.soul,
        identity: stringField(req.body?.qualification?.identity) || current.qualification.identity,
        enrollment: stringField(req.body?.qualification?.enrollment) || current.qualification.enrollment,
        hitl:
          typeof req.body?.qualification?.hitl === "boolean"
            ? req.body.qualification.hitl
            : current.qualification.hitl,
        autoContactScore: clampNumber(
          Number(req.body?.qualification?.autoContactScore ?? current.qualification.autoContactScore),
          0,
          100
        ),
        crmOnlyScore: clampNumber(
          Number(req.body?.qualification?.crmOnlyScore ?? current.qualification.crmOnlyScore),
          0,
          100
        ),
        rules: stringField(req.body?.qualification?.rules) || current.qualification.rules,
        enabled:
          typeof req.body?.qualification?.enabled === "boolean"
            ? req.body.qualification.enabled
            : current.qualification.enabled
      }
    };
    nextConfig.qualification.crmOnlyScore = Math.min(
      nextConfig.qualification.crmOnlyScore,
      nextConfig.qualification.autoContactScore
    );

    await prisma.appSetting.upsert({
      where: { key: sourcingConfigKey },
      create: { key: sourcingConfigKey, value: nextConfig as never },
      update: { value: nextConfig as never }
    });

    res.json({ config: nextConfig, saved: true });
  } catch (error) {
    next(error);
  }
});

type SourcingParams = {
  sector: string;
  location: string;
  service: string;
  tone: string;
  channel: SourcingChannel;
  limit: number;
  discoverySource: string;
  autoContactScore: number;
  crmOnlyScore: number;
  qualificationRules: string;
  objective: string;
};

async function parseSourcingParams(body: Record<string, unknown>): Promise<SourcingParams> {
  const sector = stringField(body.sector) || "PME locales";
  const location = stringField(body.location) || "Afrique, Europe, USA";
  const service = stringField(body.service) || "agent WhatsApp IA";
  const tone = stringField(body.tone) || "professionnel et chaleureux";
  const channel = normalizeChannel(body.channel);
  const sourcingConfig = await getSourcingAgentsConfig();
  const limit = Math.min(Math.max(Number(body.limit ?? sourcingConfig.discovery.limit), 1), 20);
  const discoverySource = stringField(body.discoverySource) || sourcingConfig.discovery.source;
  const autoContactScore = clampNumber(
    Number(body.autoContactScore ?? sourcingConfig.qualification.autoContactScore),
    0,
    100
  );
  const crmOnlyScore = clampNumber(
    Number(body.crmOnlyScore ?? sourcingConfig.qualification.crmOnlyScore),
    0,
    autoContactScore
  );
  const qualificationRules = stringField(body.qualificationRules) || sourcingConfig.qualification.rules;
  const objective = stringField(body.objective) || `${sector} a ${location} pour proposer ${service}`;

  return {
    sector,
    location,
    service,
    tone,
    channel,
    limit,
    discoverySource,
    autoContactScore,
    crmOnlyScore,
    qualificationRules,
    objective
  };
}

function createSourcingRun(params: SourcingParams, firstLog: string): SourcingRun {
  return {
    id: `src_${Date.now()}`,
    objective: params.objective,
    sector: params.sector,
    location: params.location,
    service: params.service,
    channel: params.channel,
    tone: params.tone,
    status: "running",
    mode: "live",
    prospects: [],
    actions: [],
    logs: [logLine("file_attente", "info", firstLog)],
    parameters: {
      discovery: {
        provider: "serper",
        source: params.discoverySource,
        limit: params.limit
      },
      qualification: {
        provider: "tavily",
        autoContactScore: params.autoContactScore,
        crmOnlyScore: params.crmOnlyScore,
        rules: params.qualificationRules
      }
    },
    limits: {
      emailDailyLimit,
      whatsappDailyLimit,
      emailSentToday: 0,
      whatsappSentToday: 0
    },
    createdAt: new Date().toISOString()
  };
}

agentsRouter.post("/sourcing/run", async (req, res, next) => {
  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const params = await parseSourcingParams(body);
    const run = createSourcingRun(params, "Mission acceptee. Les 2 agents demarrent en arriere-plan.");

    await saveSourcingRun(run);
    res.json({ run });

    void processSourcingRun(run, params).catch((error) => finalizeFailedRun(run, error));
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/sourcing/discovery/run", async (req, res, next) => {
  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const params = await parseSourcingParams(body);
    const run = createSourcingRun(params, "Agent 1 demarre: recherche des prospects uniquement.");

    await saveSourcingRun(run);
    res.json({ run });

    void processSourcingDiscoveryRun(run, params).catch((error) => finalizeFailedRun(run, error));
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/sourcing/runs/:id/qualification/run", async (req, res, next) => {
  try {
    const runs = await getSourcingRuns();
    const existingRun = runs.find((run) => run.id === req.params.id);
    if (!existingRun) {
      res.status(404).json({ error: "sourcing_run_not_found" });
      return;
    }
    if (existingRun.prospects.length === 0) {
      res.status(400).json({ error: "Aucun prospect a qualifier. Lance d'abord Agent 1." });
      return;
    }

    const run: SourcingRun = {
      ...existingRun,
      status: "running",
      logs: [...existingRun.logs, logLine("agent_qualification", "info", "Agent 2 demarre: analyse, scoring, CRM et contacts.")]
    };

    await saveSourcingRun(run);
    res.json({ run });

    void processSourcingQualificationRun(run).catch((error) => finalizeFailedRun(run, error));
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/sourcing/optout", async (req, res, next) => {
  try {
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const value = stringField(body.value);
    const channel: OptOutChannel = body.channel === "whatsapp" ? "whatsapp" : "email";
    if (!value) {
      res.status(400).json({ error: "value_required" });
      return;
    }
    const saved = await registerOptOut({ value, channel, reason: stringField(body.reason) || "Ajout manuel" });
    res.json({ saved });
  } catch (error) {
    next(error);
  }
});

async function processSourcingRun(run: SourcingRun, params: SourcingParams) {
  const startedAt = Date.now();
  const logs: SourcingLog[] = [...run.logs];
  const actions: SourcingAction[] = [];

  const providerStatus = await getSearchProviderStatus();
  logs.push(logLine("brief", "ok", `Objectif: ${params.objective}`));
  logs.push(
    logLine(
      "agent_decouverte",
      providerStatus.serper.configured ? "ok" : "blocked",
      providerStatus.serper.configured
        ? "Agent Decouverte actif (Serper)."
        : "Agent Decouverte en attente: ajoute ou active une cle Serper."
    )
  );
  logs.push(
    logLine(
      "agent_qualification",
      providerStatus.tavily.configured ? "ok" : "blocked",
      providerStatus.tavily.configured
        ? "Agent Qualification actif (Tavily)."
        : "Agent Qualification en attente: ajoute ou active une cle Tavily."
    )
  );

  const research = await researchObjective({
    objective: params.objective,
    country: params.location,
    language: "fr",
    audience: params.sector,
    limit: params.limit
  });

  const mode: "live" | "waiting_api" =
    research.providers.serper.mode === "live" || research.providers.tavily.mode === "live"
      ? "live"
      : "waiting_api";

  logs.push(
    logLine(
      "recherche",
      mode === "live" ? "ok" : "blocked",
      mode === "live"
        ? `${research.results.length} resultat(s) trouve(s) par l'Agent Decouverte.`
        : "Recherche impossible: configure une cle Serper ou Tavily pour travailler sur des donnees reelles."
    )
  );

  const prospects: SourcingProspect[] = [];
  let analyzedSites = 0;
  for (let index = 0; index < research.results.length; index += 1) {
    const result = research.results[index];
    if (!result) continue;
    const pageContent = result.url ? await extractPageContent(result.url) : null;
    if (pageContent) analyzedSites += 1;
    prospects.push(
      scoreProspect({
        result,
        index,
        sector: params.sector,
        location: params.location,
        service: params.service,
        autoContactScore: params.autoContactScore,
        crmOnlyScore: params.crmOnlyScore,
        pageContent: pageContent ?? undefined
      })
    );
  }

  logs.push(
    logLine(
      "analyse_sites",
      "ok",
      `Agent Qualification a analyse ${analyzedSites}/${research.results.length} site(s) en profondeur.`
    )
  );

  const activeProspects = prospects.filter((prospect) => prospect.decision !== "ignored");
  const counts = await dailyContactCounts();
  let emailSentToday = counts.email;
  let whatsappSentToday = counts.whatsapp;

  for (const prospect of activeProspects) {
    const client = await upsertSourcingClient(prospect);
    prospect.clientId = client.id;
    actions.push({
      prospectId: prospect.id,
      channel: "crm",
      status: "completed",
      message: `Prospect ajoute au CRM: ${client.name}`
    });
    await createAgentLog({
      action: "sourcing_crm_upsert",
      input: prospect.name,
      output: client.id,
      clientId: client.id
    });

    if (await isOptedOut({ email: prospect.email, whatsapp: prospect.whatsapp })) {
      actions.push({
        prospectId: prospect.id,
        channel: "crm",
        status: "skipped",
        message: "Contact ignore: ce prospect a demande STOP. Aucun message envoye."
      });
      continue;
    }

    if (prospect.decision !== "contact_auto") {
      actions.push({
        prospectId: prospect.id,
        channel: "email",
        status: "skipped",
        message: "Score moyen: ajout CRM sans premier contact automatique."
      });
      continue;
    }

    const message = buildOutreachMessage({
      prospect,
      service: params.service,
      sector: params.sector,
      location: params.location
    });

    if ((params.channel === "email" || params.channel === "email_whatsapp") && prospect.email) {
      if (emailSentToday >= emailDailyLimit) {
        actions.push({
          prospectId: prospect.id,
          channel: "email",
          status: "blocked",
          message: `Limite email atteinte (${emailDailyLimit}/jour).`
        });
      } else {
        const sent = await sendSourcingEmail(prospect.email, params.service, message, client.id);
        emailSentToday += sent ? 1 : 0;
        actions.push({
          prospectId: prospect.id,
          channel: "email",
          status: sent ? "completed" : "failed",
          message: sent ? "Premier email envoye." : "Email bloque: compte SMTP non configure ou erreur d'envoi."
        });
      }
    } else if (params.channel === "email" || params.channel === "email_whatsapp") {
      actions.push({
        prospectId: prospect.id,
        channel: "email",
        status: "blocked",
        message: "Aucun email exploitable trouve, meme apres analyse du site."
      });
    }

    if ((params.channel === "whatsapp" || params.channel === "email_whatsapp") && prospect.whatsapp) {
      if (whatsappSentToday >= whatsappDailyLimit) {
        actions.push({
          prospectId: prospect.id,
          channel: "whatsapp",
          status: "blocked",
          message: `Limite WhatsApp atteinte (${whatsappDailyLimit}/jour).`
        });
      } else {
        const result = await sendSourcingWhatsApp(prospect.whatsapp, message, client.id);
        whatsappSentToday += result.sent ? 1 : 0;
        actions.push({
          prospectId: prospect.id,
          channel: "whatsapp",
          status: result.sent ? "completed" : "blocked",
          message: result.message
        });
      }
    } else if (params.channel === "whatsapp" || params.channel === "email_whatsapp") {
      actions.push({
        prospectId: prospect.id,
        channel: "whatsapp",
        status: "blocked",
        message: "Aucun numero WhatsApp exploitable trouve, meme apres analyse du site."
      });
    }
  }

  const failedActions = actions.filter((action) => action.status === "failed").length;
  const finalRun: SourcingRun = {
    ...run,
    status: mode === "waiting_api" ? "partial" : failedActions > 0 ? "partial" : "completed",
    mode,
    prospects,
    actions,
    logs: [
      ...logs,
      logLine(
        "scoring",
        mode === "live" ? "ok" : "blocked",
        mode === "live"
          ? `${prospects.length} prospect(s) scores, ${activeProspects.length} ajoute(s) au CRM.`
          : "Aucun prospect cree: l'agent attend une cle Serper/Tavily."
      ),
      logLine(
        "limites",
        "info",
        `Email ${emailSentToday}/${emailDailyLimit}, WhatsApp ${whatsappSentToday}/${whatsappDailyLimit}.`
      )
    ],
    limits: {
      emailDailyLimit,
      whatsappDailyLimit,
      emailSentToday,
      whatsappSentToday
    }
  };

  await saveSourcingRun(finalRun);
  await createAgentLog({
    action: "sourcing_run_completed",
    input: params.objective,
    output: JSON.stringify({ prospects: prospects.length, actions: actions.length }),
    duration: Date.now() - startedAt
  });
}

async function processSourcingDiscoveryRun(run: SourcingRun, params: SourcingParams) {
  const startedAt = Date.now();
  const logs: SourcingLog[] = [...run.logs];
  const providerStatus = await getSearchProviderStatus();
  logs.push(logLine("brief", "ok", `Objectif: ${params.objective}`));
  logs.push(
    logLine(
      "agent_decouverte",
      providerStatus.serper.configured ? "ok" : "blocked",
      providerStatus.serper.configured
        ? "Agent 1 actif (Serper): recherche Google en cours."
        : "Agent 1 bloque: ajoute ou active une cle Serper."
    )
  );

  if (!providerStatus.serper.configured) {
    const blockedRun: SourcingRun = {
      ...run,
      status: "partial",
      mode: "waiting_api",
      logs: [...logs, logLine("recherche", "blocked", "Aucune recherche lancee: cle Serper requise.")]
    };
    await saveSourcingRun(blockedRun);
    return;
  }

  const query = `${params.objective} ${params.sector} ${params.location}`;
  const research = await searchSerper({
    query,
    country: params.location,
    language: "fr",
    limit: params.limit
  });

  const prospects = research.results.map((result, index) => createDiscoveryProspect(result, index, params.location));
  const finalRun: SourcingRun = {
    ...run,
    status: "partial",
    mode: "live",
    prospects,
    actions: [],
    logs: [
      ...logs,
      logLine("recherche", "ok", `Agent 1 a trouve ${prospects.length} prospect(s).`),
      logLine("suite", "info", "Lance maintenant Agent 2 pour analyser, scorer et creer les actions.")
    ]
  };

  await saveSourcingRun(finalRun);
  await createAgentLog({
    action: "sourcing_discovery_completed",
    input: params.objective,
    output: JSON.stringify({ prospects: prospects.length }),
    duration: Date.now() - startedAt
  });
}

async function processSourcingQualificationRun(run: SourcingRun) {
  const startedAt = Date.now();
  const params = paramsFromRun(run);
  const logs: SourcingLog[] = [...run.logs];
  const providerStatus = await getSearchProviderStatus();

  if (!providerStatus.tavily.configured) {
    await saveSourcingRun({
      ...run,
      status: "partial",
      mode: "waiting_api",
      logs: [
        ...logs,
        logLine("agent_qualification", "blocked", "Agent 2 bloque: ajoute ou active une cle Tavily.")
      ]
    });
    return;
  }

  const prospects: SourcingProspect[] = [];
  let analyzedSites = 0;
  for (let index = 0; index < run.prospects.length; index += 1) {
    const prospect = run.prospects[index];
    if (!prospect) continue;
    const pageContent = prospect.website ? await extractPageContent(prospect.website) : null;
    if (pageContent) analyzedSites += 1;
    const scored = scoreProspect({
      result: {
        title: prospect.company || prospect.name,
        url: prospect.website ?? "",
        snippet: prospect.snippet,
        source: prospect.source
      },
      index,
      sector: params.sector,
      location: params.location,
      service: params.service,
      autoContactScore: params.autoContactScore,
      crmOnlyScore: params.crmOnlyScore,
      pageContent: pageContent ?? undefined
    });
    prospects.push({ ...scored, id: prospect.id, clientId: prospect.clientId });
  }

  logs.push(
    logLine(
      "analyse_sites",
      "ok",
      `Agent 2 a analyse ${analyzedSites}/${run.prospects.length} site(s), puis rescoring termine.`
    )
  );

  await completeQualifiedProspects({
    run,
    params,
    prospects,
    logs,
    startedAt,
    mode: "live",
    completedAction: "sourcing_qualification_completed"
  });
}

function createDiscoveryProspect(
  result: { title: string; url: string; snippet: string; source: string },
  index: number,
  location: string
): SourcingProspect {
  const text = `${result.title} ${result.snippet}`;
  return {
    id: `prospect_${Date.now()}_${index}`,
    name: cleanName(result.title) || `Prospect ${index + 1}`,
    company: cleanName(result.title),
    email: extractEmail(text),
    whatsapp: extractPhone(text),
    website: result.url,
    country: location,
    source: result.source,
    snippet: result.snippet,
    score: 0,
    decision: "ignored",
    reasons: ["Trouve par Agent 1. En attente Agent 2 pour scoring et qualification."]
  };
}

function paramsFromRun(run: SourcingRun): SourcingParams {
  return {
    sector: run.sector,
    location: run.location,
    service: run.service,
    tone: run.tone,
    channel: run.channel,
    limit: run.parameters.discovery.limit,
    discoverySource: run.parameters.discovery.source,
    autoContactScore: run.parameters.qualification.autoContactScore,
    crmOnlyScore: run.parameters.qualification.crmOnlyScore,
    qualificationRules: run.parameters.qualification.rules,
    objective: run.objective
  };
}

async function completeQualifiedProspects({
  run,
  params,
  prospects,
  logs,
  startedAt,
  mode,
  completedAction
}: {
  run: SourcingRun;
  params: SourcingParams;
  prospects: SourcingProspect[];
  logs: SourcingLog[];
  startedAt: number;
  mode: "live" | "waiting_api";
  completedAction: string;
}) {
  const actions: SourcingAction[] = [];
  const activeProspects = prospects.filter((prospect) => prospect.decision !== "ignored");
  const counts = await dailyContactCounts();
  let emailSentToday = counts.email;
  let whatsappSentToday = counts.whatsapp;

  for (const prospect of activeProspects) {
    const client = await upsertSourcingClient(prospect);
    prospect.clientId = client.id;
    actions.push({
      prospectId: prospect.id,
      channel: "crm",
      status: "completed",
      message: `Prospect ajoute au CRM: ${client.name}`
    });
    await createAgentLog({
      action: "sourcing_crm_upsert",
      input: prospect.name,
      output: client.id,
      clientId: client.id
    });

    if (await isOptedOut({ email: prospect.email, whatsapp: prospect.whatsapp })) {
      actions.push({
        prospectId: prospect.id,
        channel: "crm",
        status: "skipped",
        message: "Contact ignore: ce prospect a demande STOP. Aucun message envoye."
      });
      continue;
    }

    if (prospect.decision !== "contact_auto") {
      actions.push({
        prospectId: prospect.id,
        channel: "email",
        status: "skipped",
        message: "Score moyen: ajout CRM sans premier contact automatique."
      });
      continue;
    }

    const message = buildOutreachMessage({
      prospect,
      service: params.service,
      sector: params.sector,
      location: params.location
    });

    if ((params.channel === "email" || params.channel === "email_whatsapp") && prospect.email) {
      if (emailSentToday >= emailDailyLimit) {
        actions.push({
          prospectId: prospect.id,
          channel: "email",
          status: "blocked",
          message: `Limite email atteinte (${emailDailyLimit}/jour).`
        });
      } else {
        const sent = await sendSourcingEmail(prospect.email, params.service, message, client.id);
        emailSentToday += sent ? 1 : 0;
        actions.push({
          prospectId: prospect.id,
          channel: "email",
          status: sent ? "completed" : "failed",
          message: sent ? "Premier email envoye." : "Email bloque: compte SMTP non configure ou erreur d'envoi."
        });
      }
    } else if (params.channel === "email" || params.channel === "email_whatsapp") {
      actions.push({
        prospectId: prospect.id,
        channel: "email",
        status: "blocked",
        message: "Aucun email exploitable trouve, meme apres analyse du site."
      });
    }

    if ((params.channel === "whatsapp" || params.channel === "email_whatsapp") && prospect.whatsapp) {
      if (whatsappSentToday >= whatsappDailyLimit) {
        actions.push({
          prospectId: prospect.id,
          channel: "whatsapp",
          status: "blocked",
          message: `Limite WhatsApp atteinte (${whatsappDailyLimit}/jour).`
        });
      } else {
        const result = await sendSourcingWhatsApp(prospect.whatsapp, message, client.id);
        whatsappSentToday += result.sent ? 1 : 0;
        actions.push({
          prospectId: prospect.id,
          channel: "whatsapp",
          status: result.sent ? "completed" : "blocked",
          message: result.message
        });
      }
    } else if (params.channel === "whatsapp" || params.channel === "email_whatsapp") {
      actions.push({
        prospectId: prospect.id,
        channel: "whatsapp",
        status: "blocked",
        message: "Aucun numero WhatsApp exploitable trouve, meme apres analyse du site."
      });
    }
  }

  const failedActions = actions.filter((action) => action.status === "failed").length;
  const finalRun: SourcingRun = {
    ...run,
    status: mode === "waiting_api" ? "partial" : failedActions > 0 ? "partial" : "completed",
    mode,
    prospects,
    actions,
    logs: [
      ...logs,
      logLine(
        "scoring",
        mode === "live" ? "ok" : "blocked",
        mode === "live"
          ? `${prospects.length} prospect(s) scores, ${activeProspects.length} ajoute(s) au CRM.`
          : "Aucun prospect cree: l'agent attend une cle Serper/Tavily."
      ),
      logLine(
        "limites",
        "info",
        `Email ${emailSentToday}/${emailDailyLimit}, WhatsApp ${whatsappSentToday}/${whatsappDailyLimit}.`
      )
    ],
    limits: {
      emailDailyLimit,
      whatsappDailyLimit,
      emailSentToday,
      whatsappSentToday
    }
  };

  await saveSourcingRun(finalRun);
  await createAgentLog({
    action: completedAction,
    input: params.objective,
    output: JSON.stringify({ prospects: prospects.length, actions: actions.length }),
    duration: Date.now() - startedAt
  });
}

async function finalizeFailedRun(run: SourcingRun, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await saveSourcingRun({
    ...run,
    status: "failed",
    logs: [...run.logs, logLine("erreur", "error", `Echec du run: ${message}`)]
  }).catch(() => {});
  await createAgentLog({
    action: "sourcing_run_failed",
    input: run.objective,
    error: message
  }).catch(() => {});
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeChannel(value: unknown): SourcingChannel {
  if (value === "email" || value === "whatsapp" || value === "crm_only") return value;
  return "email_whatsapp";
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function logLine(step: string, status: SourcingLog["status"], message: string): SourcingLog {
  return { step, status, message, at: new Date().toISOString() };
}

function scoreProspect({
  result,
  index,
  sector,
  location,
  service,
  autoContactScore,
  crmOnlyScore,
  pageContent
}: {
  result: { title: string; url: string; snippet: string; source: string };
  index: number;
  sector: string;
  location: string;
  service: string;
  autoContactScore: number;
  crmOnlyScore: number;
  pageContent?: string;
}): SourcingProspect {
  const deepText = pageContent ?? "";
  const haystack = `${result.title} ${result.snippet} ${result.url} ${deepText}`.toLowerCase();
  const reasons: string[] = [];
  let score = 30;

  const sectorTokens = tokenize(sector);
  const serviceTokens = tokenize(service);
  const locationTokens = tokenize(location);

  if (sectorTokens.some((token) => haystack.includes(token))) {
    score += 18;
    reasons.push("Secteur cible detecte.");
  }
  if (serviceTokens.some((token) => haystack.includes(token))) {
    score += 14;
    reasons.push("Besoin/service proche de l'offre.");
  }
  if (locationTokens.some((token) => haystack.includes(token))) {
    score += 14;
    reasons.push("Zone geographique coherente.");
  }
  if (result.url && !result.url.includes("example.com")) {
    score += 8;
    reasons.push("Site web exploitable.");
  }
  if (deepText) {
    score += 8;
    reasons.push("Site analyse en profondeur par l'Agent Qualification.");
  }

  const email = extractEmail(`${result.title} ${result.snippet} ${deepText}`);
  const phone =
    extractPhone(`${result.title} ${result.snippet}`) ?? (deepText ? extractPhone(deepText) : undefined);
  if (email) {
    score += 14;
    reasons.push(deepText ? "Email reel trouve sur le site." : "Email public detecte.");
  }
  if (phone) {
    score += 14;
    reasons.push(deepText ? "Numero reel trouve sur le site." : "Numero public detecte.");
  }

  if (reasons.length === 0) reasons.push("Resultat garde pour verification manuelle.");

  const finalScore = Math.min(score, 100);

  return {
    id: `prospect_${Date.now()}_${index}`,
    name: cleanName(result.title) || `Prospect ${index + 1}`,
    company: cleanName(result.title),
    email,
    whatsapp: phone,
    website: result.url,
    country: location,
    source: result.source,
    snippet: result.snippet,
    score: finalScore,
    decision: finalScore >= autoContactScore ? "contact_auto" : finalScore >= crmOnlyScore ? "crm_only" : "ignored",
    reasons
  };
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function extractEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function extractPhone(value: string) {
  const match = value.match(/(?:\+?\d[\s().-]?){8,}/);
  if (!match) return undefined;
  const cleaned = match[0].replace(/[^\d+]/g, "");
  return cleaned.length >= 8 ? cleaned : undefined;
}

function cleanName(value: string) {
  return value.replace(/\s*[-|].*$/, "").trim().slice(0, 90);
}

async function upsertSourcingClient(prospect: SourcingProspect) {
  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        prospect.email ? { email: prospect.email } : undefined,
        prospect.whatsapp ? { whatsapp: prospect.whatsapp } : undefined,
        prospect.website ? { company: prospect.company } : undefined
      ].filter(Boolean) as Array<{ email?: string; whatsapp?: string; company?: string }>
    }
  });

  const data = {
    name: prospect.name,
    company: prospect.company,
    email: prospect.email,
    whatsapp: prospect.whatsapp,
    country: prospect.country,
    language: "fr",
    source: "sourcing_agent",
    status: "prospect",
    tags: ["sourcing", prospect.source, prospect.decision],
    lastContact: new Date()
  };

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        ...data,
        tags: Array.from(new Set([...existing.tags, ...data.tags]))
      }
    });
  }

  return prisma.client.create({ data });
}

function hashIndex(seed: string, length: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

function buildOutreachMessage({
  prospect,
  service,
  sector,
  location
}: {
  prospect: SourcingProspect;
  service: string;
  sector: string;
  location: string;
}) {
  const target = prospect.company || prospect.name;
  const openings = [
    `Bonjour ${target},`,
    `Bonjour, et bravo pour le travail de ${target} !`,
    `Bonjour ${target}, j'espere que tout va bien chez vous.`
  ];
  const hooks = [
    `En decouvrant votre activite dans le secteur "${sector}" a ${location}, j'ai pense que ${service} pourrait vous faire gagner du temps au quotidien.`,
    `Je vois que vous etes actifs dans "${sector}" a ${location}. Des entreprises comme la votre utilisent deja ${service} pour traiter plus de demandes clients.`,
    `Votre presence dans le secteur "${sector}" a retenu mon attention. Nous accompagnons ce type d'activite a ${location} grace a ${service}.`
  ];
  const closings = [
    "Seriez-vous ouvert a un court echange cette semaine ? Repondez simplement OUI.",
    "Si le sujet vous interesse, repondez OUI et je vous envoie un exemple concret.",
    "Puis-je vous proposer un diagnostic gratuit ? Repondez OUI et je m'occupe du reste."
  ];

  return [
    openings[hashIndex(`${prospect.id}o`, openings.length)],
    "",
    "Je vous ecris de la part de Oumar Business, agence digitale.",
    hooks[hashIndex(`${prospect.id}h`, hooks.length)],
    "",
    closings[hashIndex(`${prospect.id}c`, closings.length)],
    "",
    "Repondez STOP si vous ne souhaitez plus etre contacte."
  ].join("\n");
}

async function sendSourcingEmail(to: string, service: string, text: string, clientId: string) {
  try {
    const account = await getRuntimeEmailAccount("main");
    const engine = new EmailEngine();
    await randomDelay();
    await engine.send({
      account,
      from: `${account.name ?? "Oumar Business"} <${account.email}>`,
      to: [to],
      subject: `Diagnostic gratuit - ${service}`,
      text
    });
    await createAgentLog({ action: "sourcing_email_sent", input: to, output: "sent", clientId });
    return true;
  } catch (error) {
    await createAgentLog({
      action: "sourcing_email_failed",
      input: to,
      error: error instanceof Error ? error.message : String(error),
      clientId
    });
    return false;
  }
}

async function sendSourcingWhatsApp(to: string, text: string, clientId: string) {
  const sessions = await prisma.wASession.findMany({
    where: { type: "baileys", status: "connected" },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  for (const session of sessions) {
    const client = baileysManager.get(session.id);
    if (!client || client.status !== "open") continue;
    try {
      await randomDelay();
      await client.sendText(to, text);
      await createAgentLog({ action: "sourcing_whatsapp_sent", input: to, output: "sent", clientId });
      return { sent: true, message: "Premier WhatsApp envoye via Baileys." };
    } catch (error) {
      await createAgentLog({
        action: "sourcing_whatsapp_failed",
        input: to,
        error: error instanceof Error ? error.message : String(error),
        clientId
      });
      return { sent: false, message: "WhatsApp detecte mais l'envoi Baileys a echoue." };
    }
  }

  await createAgentLog({ action: "sourcing_whatsapp_blocked", input: to, output: "no_active_session", clientId });
  return { sent: false, message: "blocked_no_whatsapp_session: aucune session Baileys active." };
}

async function randomDelay() {
  const ms = 3000 + Math.floor(Math.random() * 5000);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function dailyContactCounts() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [email, whatsapp] = await Promise.all([
    prisma.agentLog.count({ where: { agentType: "prospection", action: "sourcing_email_sent", createdAt: { gte: since } } }),
    prisma.agentLog.count({ where: { agentType: "prospection", action: "sourcing_whatsapp_sent", createdAt: { gte: since } } })
  ]);
  return { email, whatsapp };
}

async function createAgentLog(input: {
  action: string;
  input?: string;
  output?: string;
  clientId?: string;
  duration?: number;
  error?: string;
}) {
  return prisma.agentLog.create({
    data: {
      agentType: "prospection",
      action: input.action,
      input: input.input,
      output: input.output,
      clientId: input.clientId,
      duration: input.duration,
      error: input.error,
      escalated: false
    }
  });
}

async function readPendingToolActions(): Promise<PendingToolAction[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: "agent_pending_tool_actions" } }).catch(() => null);
  return Array.isArray(stored?.value) ? (stored.value as PendingToolAction[]) : [];
}

async function writePendingToolActions(actions: PendingToolAction[]) {
  return prisma.appSetting.upsert({
    where: { key: "agent_pending_tool_actions" },
    create: { key: "agent_pending_tool_actions", value: actions as never },
    update: { value: actions as never }
  });
}

async function getSourcingRuns(): Promise<SourcingRun[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: sourcingHistoryKey } });
  const value = stored?.value;
  return Array.isArray(value) ? (value as SourcingRun[]) : [];
}

async function saveSourcingRun(run: SourcingRun) {
  const current = await getSourcingRuns();
  const next = [run, ...current.filter((item) => item.id !== run.id)].slice(0, 20);
  await prisma.appSetting.upsert({
    where: { key: sourcingHistoryKey },
    create: { key: sourcingHistoryKey, value: next },
    update: { value: next }
  });
}

async function getSourcingAgentsConfig(): Promise<SourcingAgentsConfig> {
  const stored = await prisma.appSetting.findUnique({ where: { key: sourcingConfigKey } }).catch(() => null);
  const value = stored?.value && typeof stored.value === "object" && !Array.isArray(stored.value) ? stored.value as Partial<SourcingAgentsConfig> : {};
  const merged: SourcingAgentsConfig = {
    discovery: {
      ...defaultSourcingConfig.discovery,
      ...(value.discovery && typeof value.discovery === "object" ? value.discovery : {})
    },
    qualification: {
      ...defaultSourcingConfig.qualification,
      ...(value.qualification && typeof value.qualification === "object" ? value.qualification : {})
    }
  };
  return upgradeLegacySourcingConfig(merged);
}

function upgradeLegacySourcingConfig(config: SourcingAgentsConfig): SourcingAgentsConfig {
  const discoveryLooksLegacy =
    config.discovery.name === "Agent Sourcing Decouverte" ||
    config.discovery.keywords.includes("Abidjan") ||
    config.discovery.bootstrap === "Scanner le web pour trouver des entreprises qui peuvent acheter les services Oumar Business.";
  const qualificationLooksLegacy =
    config.qualification.name === "Agent Sourcing Qualification" ||
    config.qualification.bootstrap === "Lire les sites trouves par Agent 1, extraire contacts reels, scorer et qualifier les prospects." ||
    config.qualification.rules === "Entreprise locale, contact exploitable, besoin probable en WhatsApp, site web ou marketing.";

  return {
    discovery: discoveryLooksLegacy
      ? {
          ...defaultSourcingConfig.discovery,
          enabled: config.discovery.enabled,
          hitl: config.discovery.hitl
        }
      : config.discovery,
    qualification: qualificationLooksLegacy
      ? {
          ...defaultSourcingConfig.qualification,
          enabled: config.qualification.enabled,
          hitl: config.qualification.hitl
        }
      : config.qualification
  };
}
