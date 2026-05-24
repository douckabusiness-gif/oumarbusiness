import type { AgentDecision, AgentInput, AgentResponse, AgentType, MessageChannel } from "@oumar/shared";
import {
  agentDefinitions,
  getGroupByAgentType,
  orchestratorGroupDefinitions,
  rootOrchestratorDefinition,
  type OrchestratorGroupId
} from "./definitions.js";
import { GenericAgent } from "./GenericAgent.js";
import { prisma } from "../db/prisma.js";
import { memoryService } from "../memory/memory.service.js";
import { getTool } from "./tools/registry.js";
import { sendBusinessPushNotificationSafe } from "../routes/modules/notifications.js";

type RoutedAgentInput = AgentInput & {
  requestedAgent?: AgentType;
};

type AgentDispatch = {
  groupId: OrchestratorGroupId;
  groupName: string;
  orchestratorName: string;
  agentType: AgentType;
  rootRouteReason: string;
  routeReason: string;
  routeKeywords: string[];
  routingFallback: boolean;
};

type PendingToolAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  agentType: AgentType;
  channel: MessageChannel;
  clientId?: string;
  conversationId?: string;
  reason: string;
  originalText: string;
  createdAt: string;
};

type RouteMatch<T> = {
  target: T;
  reason: string;
  keywords: string[];
};

type RouteRule<T> = RouteMatch<T> & {
  pattern: RegExp;
};

const webRoutePattern =
  /application web|aplication web|appli web|app web|plateforme|site|wordpress|next\.?js|nextjs|e-?commerce|dashboard|portail|landing page|brief technique/i;
const aiBuilderRoutePattern =
  /agent ia|agents ia|bot|assistant ia|automatisation|automation|workflow ia|workflow|prompt|rag|assistant virtuel|bot sur mesure/i;
const quoteRoutePattern = /devis|prix|tarif|budget|combien|proposition|proposition commerciale/i;

const rootGroupRoutes: Array<RouteRule<OrchestratorGroupId>> = [
  {
    pattern: new RegExp(`(?:${quoteRoutePattern.source}).*(?:${webRoutePattern.source})|(?:${webRoutePattern.source}).*(?:${quoteRoutePattern.source})`, "i"),
    target: "growth",
    reason: "root_keyword:quote_web",
    keywords: ["devis", "web"]
  },
  {
    pattern: new RegExp(`(?:${quoteRoutePattern.source}).*(?:${aiBuilderRoutePattern.source})|(?:${aiBuilderRoutePattern.source}).*(?:${quoteRoutePattern.source})`, "i"),
    target: "growth",
    reason: "root_keyword:quote_ai",
    keywords: ["devis", "agent ia"]
  },
  { pattern: /facture|paiement|pay[eé]|wave|stripe|orange money|invoice/i, target: "operations", reason: "root_keyword:billing", keywords: ["facture", "paiement"] },
  { pattern: /projet|milestone|deadline|retard|livrable|task|tache/i, target: "operations", reason: "root_keyword:project", keywords: ["projet", "retard", "livrable"] },
  { pattern: webRoutePattern, target: "operations", reason: "root_keyword:web", keywords: ["application web", "site", "plateforme"] },
  { pattern: aiBuilderRoutePattern, target: "operations", reason: "root_keyword:ai_builder", keywords: ["agent ia", "bot", "workflow"] },
  { pattern: /freelance|prestataire|mission|sous-traitant/i, target: "operations", reason: "root_keyword:freelance", keywords: ["freelance", "prestataire"] },
  { pattern: /rapport|kpi|analytics|reporting|performance du jour/i, target: "operations", reason: "root_keyword:report", keywords: ["rapport", "analytics"] },
  { pattern: /prospect|lead|outreach|sourcing/i, target: "growth", reason: "root_keyword:prospection", keywords: ["prospect", "lead"] },
  { pattern: quoteRoutePattern, target: "growth", reason: "root_keyword:sales", keywords: ["devis", "prix", "budget"] },
  { pattern: /marketing|campagne|contenu|facebook|google ads|meta ads|ads|seo/i, target: "growth", reason: "root_keyword:marketing", keywords: ["marketing", "campagne", "ads"] },
  { pattern: /email|mail|inbox|newsletter/i, target: "growth", reason: "root_keyword:email", keywords: ["email", "newsletter"] },
  { pattern: /whatsapp|broadcast|diffusion|qr code/i, target: "growth", reason: "root_keyword:whatsapp", keywords: ["whatsapp", "broadcast"] },
  { pattern: /bonjour|salut|hello|bonsoir|info|renseignement|je veux parler/i, target: "growth", reason: "root_keyword:greeting", keywords: ["accueil"] }
];

const groupAgentRoutes: Record<OrchestratorGroupId, Array<RouteRule<AgentType>>> = {
  growth: [
    { pattern: /prospect|lead|outreach|sourcing|scraping/i, target: "prospection", reason: "group_keyword:prospection", keywords: ["prospect", "lead"] },
    { pattern: quoteRoutePattern, target: "sales", reason: "group_keyword:sales", keywords: ["devis", "prix", "budget"] },
    { pattern: /marketing|campagne|contenu|facebook|google ads|meta ads|ads|seo/i, target: "marketing", reason: "group_keyword:marketing", keywords: ["marketing", "campagne", "ads"] },
    { pattern: /email|mail|inbox|newsletter/i, target: "email", reason: "group_keyword:email", keywords: ["email", "newsletter"] },
    { pattern: /whatsapp|broadcast|diffusion|qr code/i, target: "whatsapp", reason: "group_keyword:whatsapp", keywords: ["whatsapp", "broadcast"] },
    { pattern: /bonjour|salut|hello|bonsoir|info|renseignement|je veux parler/i, target: "autonomous", reason: "group_keyword:autonomous", keywords: ["accueil"] }
  ],
  operations: [
    { pattern: /facture|paiement|invoice|wave|stripe|orange money/i, target: "billing", reason: "group_keyword:billing", keywords: ["facture", "paiement"] },
    { pattern: webRoutePattern, target: "web", reason: "group_keyword:web", keywords: ["application web", "site", "plateforme"] },
    { pattern: aiBuilderRoutePattern, target: "ai-builder", reason: "group_keyword:ai_builder", keywords: ["agent ia", "bot", "workflow"] },
    { pattern: /freelance|prestataire|mission|contrat/i, target: "freelance", reason: "group_keyword:freelance", keywords: ["freelance", "mission"] },
    { pattern: /rapport|kpi|analytics|reporting|daily report/i, target: "report", reason: "group_keyword:report", keywords: ["rapport", "analytics"] },
    { pattern: /projet|milestone|deadline|retard|livrable|task|tache/i, target: "project", reason: "group_keyword:project", keywords: ["projet", "retard", "livrable"] }
  ]
};

const defaultGroupByChannel: Record<MessageChannel, OrchestratorGroupId> = {
  whatsapp: "growth",
  email: "growth",
  portal: "growth",
  system: "operations"
};

function matchRoute<T>(rules: Array<RouteRule<T>>, text: string): RouteMatch<T> | null {
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return {
        target: rule.target,
        reason: rule.reason,
        keywords: rule.keywords
      };
    }
  }

  return null;
}

class DomainOrchestrator {
  constructor(
    public readonly groupId: OrchestratorGroupId,
    public readonly groupName: string,
    public readonly orchestratorName: string,
    private readonly defaultAgent: AgentType,
    private readonly managedAgents: readonly AgentType[],
    private readonly keywordRoutes: Array<RouteRule<AgentType>>
  ) {}

  handles(agentType: AgentType) {
    return this.managedAgents.includes(agentType);
  }

  dispatch(input: RoutedAgentInput, rootMatch: RouteMatch<OrchestratorGroupId>): AgentDispatch {
    if (input.requestedAgent && this.handles(input.requestedAgent)) {
      return {
        groupId: this.groupId,
        groupName: this.groupName,
        orchestratorName: this.orchestratorName,
        agentType: input.requestedAgent,
        rootRouteReason: rootMatch.reason,
        routeReason: "requested_agent",
        routeKeywords: rootMatch.keywords,
        routingFallback: false
      };
    }

    const agentMatch = matchRoute(this.keywordRoutes, input.text);
    if (agentMatch) {
      return {
        groupId: this.groupId,
        groupName: this.groupName,
        orchestratorName: this.orchestratorName,
        agentType: agentMatch.target,
        rootRouteReason: rootMatch.reason,
        routeReason: agentMatch.reason,
        routeKeywords: [...new Set([...rootMatch.keywords, ...agentMatch.keywords])],
        routingFallback: false
      };
    }

    return {
      groupId: this.groupId,
      groupName: this.groupName,
      orchestratorName: this.orchestratorName,
      agentType: this.defaultAgent,
      rootRouteReason: rootMatch.reason,
      routeReason: "group_default",
      routeKeywords: rootMatch.keywords,
      routingFallback: rootMatch.reason === "channel_default" || rootMatch.keywords.length === 0
    };
  }
}

class AgentOrchestrator {
  private readonly agents = new Map<AgentType, GenericAgent>();
  private readonly groups = new Map<OrchestratorGroupId, DomainOrchestrator>();

  constructor() {
    for (const definition of agentDefinitions) {
      const action =
        definition.type === "sales"
          ? "create_quote"
          : definition.type === "billing"
            ? "send_invoice"
            : definition.type === "report"
              ? "report"
              : definition.type === "project"
                ? "create_task"
                : "reply";
      this.agents.set(definition.type, new GenericAgent(definition.type, definition.name, action));
    }

    for (const group of orchestratorGroupDefinitions) {
      this.groups.set(
        group.id,
        new DomainOrchestrator(
          group.id,
          group.name,
          group.orchestratorName,
          group.defaultAgent,
          group.agentTypes,
          groupAgentRoutes[group.id]
        )
      );
    }
  }

  describeArchitecture() {
    return {
      root: rootOrchestratorDefinition,
      groups: orchestratorGroupDefinitions.map((group) => ({
        ...group,
        agents: agentDefinitions.filter((agent) => agent.group === group.id)
      }))
    };
  }

  async route(input: AgentInput): Promise<AgentDecision> {
    const dispatch = this.resolveDispatch(input);
    const agent = this.agents.get(dispatch.agentType) ?? this.agents.get("autonomous");
    if (!agent) {
      throw new Error("Autonomous agent is not configured");
    }

    const response = await this.handleWithConfig(dispatch, agent, input);
    return response.decision;
  }

  async chat(input: RoutedAgentInput): Promise<
    AgentResponse & {
      agentName: string;
      orchestratorGroup: OrchestratorGroupId;
      orchestratorName: string;
      rootRouteReason: string;
      routeReason: string;
      routeKeywords: string[];
      routingFallback: boolean;
    }
  > {
    const dispatch = this.resolveDispatch(input);
    const agent = this.agents.get(dispatch.agentType) ?? this.agents.get("autonomous");
    if (!agent) {
      throw new Error("Agent is not configured");
    }

    const { metadataName: agentName, ...response } = await this.handleWithConfig(dispatch, agent, input);
    return {
      ...response,
      agentName: agentName ?? agent.name,
      orchestratorGroup: dispatch.groupId,
      orchestratorName: dispatch.orchestratorName,
      rootRouteReason: dispatch.rootRouteReason,
      routeReason: dispatch.routeReason,
      routeKeywords: dispatch.routeKeywords,
      routingFallback: dispatch.routingFallback
    };
  }

  async handoff(from: AgentType, to: AgentType | "human", context: Record<string, unknown>) {
    return {
      from,
      to,
      fromGroup: getGroupByAgentType(from),
      toGroup: to === "human" ? "human" : getGroupByAgentType(to),
      context,
      handedOffAt: new Date().toISOString()
    };
  }

  async getSharedMemory(clientId: string) {
    return memoryService.buildContext({
      channel: "system",
      clientId
    });
  }

  async updateSharedMemory(clientId: string, update: Record<string, unknown>) {
    await memoryService.captureTurn({
      channel: "system",
      clientId,
      userText: typeof update.note === "string" ? update.note : JSON.stringify(update),
      metadata: { source: "shared_memory_update", update }
    });

    return memoryService.buildContext({
      channel: "system",
      clientId
    });
  }

  private resolveDispatch(input: RoutedAgentInput): AgentDispatch {
    if (input.requestedAgent) {
      const requestedGroupId = getGroupByAgentType(input.requestedAgent);
      const requestedGroup = this.groups.get(requestedGroupId);
      if (requestedGroup) {
        return requestedGroup.dispatch(input, {
          target: requestedGroupId,
          reason: "requested_agent",
          keywords: []
        });
      }
    }

    const rootMatch = this.selectGroup(input.text, input.channel);
    const group = this.groups.get(rootMatch.target);
    if (!group) {
      throw new Error(`Orchestrator group ${rootMatch.target} is not configured`);
    }

    return group.dispatch(input, rootMatch);
  }

  private selectGroup(text: string, channel: MessageChannel): RouteMatch<OrchestratorGroupId> {
    const rootMatch = matchRoute(rootGroupRoutes, text);
    if (rootMatch) return rootMatch;

    return {
      target: defaultGroupByChannel[channel],
      reason: "channel_default",
      keywords: []
    };
  }

  private async handleWithConfig(
    dispatch: AgentDispatch,
    agent: GenericAgent,
    input: AgentInput
  ): Promise<AgentResponse & { metadataName?: string }> {
    const config = await prisma.agentConfig.findUnique({
      where: { type: dispatch.agentType }
    });

    if (config && !config.isActive) {
      const disabledResponse: AgentResponse & { metadataName?: string } = {
        metadataName: config.name,
        text: `${config.name} est desactive. Je transmets la demande a un humain.`,
        decision: {
          agent: dispatch.agentType,
          action: "escalate",
          confidence: 0,
          escalate: true,
          reason: "agent_disabled"
        }
      };

      await this.notifyEscalation(disabledResponse, dispatch, input, config.name);
      return disabledResponse;
    }

    const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
    const memoryContext = await memoryService.buildContext({
      channel: input.channel,
      clientId: input.clientId,
      conversationId: input.conversationId,
      externalRef: typeof metadata.externalRef === "string" ? metadata.externalRef : undefined,
      language: typeof metadata.locale === "string" ? metadata.locale : undefined,
      latestUserText: input.text,
      agentType: dispatch.agentType
    });

    let response = await agent.handle({
      ...input,
      metadata: {
        ...metadata,
        memoryContext,
        orchestrator: {
          root: rootOrchestratorDefinition.name,
          groupId: dispatch.groupId,
          groupName: dispatch.groupName,
          orchestratorName: dispatch.orchestratorName,
          rootRouteReason: dispatch.rootRouteReason,
          routeReason: dispatch.routeReason,
          routeKeywords: dispatch.routeKeywords,
          routingFallback: dispatch.routingFallback
        },
        agentConfig: config
          ? {
              name: config.name,
              systemPrompt: config.systemPrompt,
              temperature: config.temperature,
              escalationThreshold: config.escalationThreshold,
              config: config.config
            }
          : undefined
      }
    });

    const configObject =
      config?.config && typeof config.config === "object" && !Array.isArray(config.config)
        ? (config.config as Record<string, unknown>)
        : {};
    const brainTab =
      configObject.brainTab && typeof configObject.brainTab === "object" && !Array.isArray(configObject.brainTab)
        ? (configObject.brainTab as Record<string, unknown>)
        : {};
    const toolAutonomy =
      configObject.toolAutonomy && typeof configObject.toolAutonomy === "object" && !Array.isArray(configObject.toolAutonomy)
        ? (configObject.toolAutonomy as Record<string, unknown>)
        : {};
    const hitlRequired = Boolean(brainTab.hitl);
    const sensitiveAction = ["create_quote", "send_invoice"].includes(response.decision.action);
    const sensitiveRequiresHuman = sensitiveAction && toolAutonomy.sensitiveActions !== "autonomous";

    response = await this.resolveToolAction({
      response,
      dispatch,
      input,
      hitlRequired: hitlRequired || sensitiveRequiresHuman,
      sensitiveAction
    });

    await memoryService.captureTurn({
      channel: input.channel,
      clientId: input.clientId,
      conversationId: memoryContext.sessionId ?? input.conversationId,
      externalRef: typeof metadata.externalRef === "string" ? metadata.externalRef : undefined,
      language: typeof metadata.locale === "string" ? metadata.locale : undefined,
      userText: input.text,
      agentText: response.text,
      agentType: dispatch.agentType,
      metadata: {
        ...metadata,
        orchestratorGroup: dispatch.groupId,
        orchestratorName: dispatch.orchestratorName,
        rootRouteReason: dispatch.rootRouteReason,
        routeReason: dispatch.routeReason,
        routeKeywords: dispatch.routeKeywords,
        routingFallback: dispatch.routingFallback,
        toolAction: response.toolAction
      }
    });

    const finalResponse: AgentResponse & { metadataName?: string } = !config
      ? response
      : {
          ...response,
          metadataName: config.name,
          decision: {
            ...response.decision,
            escalate:
              response.decision.escalate ||
              response.decision.confidence < config.escalationThreshold ||
              ((hitlRequired || sensitiveRequiresHuman) && sensitiveAction),
            reason:
              (hitlRequired || sensitiveRequiresHuman) && sensitiveAction
                ? sensitiveRequiresHuman
                  ? "sensitive_tool_requires_human"
                  : "hitl_required"
                : response.decision.confidence < config.escalationThreshold
                  ? "below_configured_threshold"
                  : response.decision.reason
          }
        };

    await this.notifyEscalation(finalResponse, dispatch, input, finalResponse.metadataName ?? agent.name);
    return finalResponse;
  }

  private async notifyEscalation(
    response: AgentResponse & { metadataName?: string },
    dispatch: AgentDispatch,
    input: AgentInput,
    agentName: string
  ) {
    if (!response.decision.escalate) return;

    const channelUrl =
      input.channel === "whatsapp" ? "/whatsapp" : input.channel === "email" ? "/email" : "/agents/chat";
    const reason = response.decision.reason ? ` (${response.decision.reason})` : "";

    await sendBusinessPushNotificationSafe({
      title: "Escalade agent IA",
      body: `${agentName} demande une intervention humaine${reason}: ${input.text.slice(0, 120)}`,
      url: channelUrl,
      tag: `agent-escalation-${dispatch.agentType}-${input.clientId ?? input.conversationId ?? Date.now()}`,
      source: "escalation"
    });
  }

  private async resolveToolAction(input: {
    response: AgentResponse;
    dispatch: AgentDispatch;
    input: AgentInput;
    hitlRequired: boolean;
    sensitiveAction: boolean;
  }): Promise<AgentResponse> {
    const proposed = input.response.toolAction;
    if (!proposed || proposed.status !== "proposed") return input.response;

    const tool = getTool(proposed.tool);
    if (!tool) {
      return this.failToolAction(input.response, proposed.tool, "outil_inconnu", "Outil agent inconnu.");
    }

    if (!tool.allowedAgents.includes(input.dispatch.agentType)) {
      return this.failToolAction(
        input.response,
        proposed.tool,
        "outil_non_autorise",
        `L'agent ${input.dispatch.agentType} n'a pas le droit d'utiliser ${proposed.tool}.`
      );
    }

    const parsed = tool.schema.safeParse(proposed.args);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return this.failToolAction(input.response, proposed.tool, "arguments_invalides", message);
    }

    if (input.hitlRequired && input.sensitiveAction) {
      const pending = await this.storePendingToolAction({
        tool: proposed.tool,
        args: parsed.data as Record<string, unknown>,
        agentType: input.dispatch.agentType,
        channel: input.input.channel,
        clientId: input.input.clientId,
        conversationId: input.input.conversationId,
        reason: "hitl_required",
        originalText: input.input.text,
        createdAt: new Date().toISOString()
      });

      await prisma.agentLog.create({
        data: {
          agentType: input.dispatch.agentType,
          action: `tool_pending:${proposed.tool}`,
          input: JSON.stringify(parsed.data),
          output: pending.id,
          clientId: input.input.clientId,
          conversationId: input.input.conversationId,
          escalated: true,
          escalatedTo: "human"
        }
      });

      return {
        ...input.response,
        text: `${input.response.text}\n\nAction preparee et mise en attente de validation humaine: ${proposed.tool}.`,
        decision: {
          ...input.response.decision,
          escalate: true,
          reason: "hitl_required"
        },
        toolAction: {
          ...proposed,
          args: parsed.data as Record<string, unknown>,
          status: "pending_human",
          result: { pendingActionId: pending.id },
          message: "Validation humaine requise avant execution."
        }
      };
    }

    const startedAt = Date.now();
    try {
      const execution = await tool.execute(parsed.data, {
        agentType: input.dispatch.agentType,
        channel: input.input.channel,
        clientId: input.input.clientId,
        conversationId: input.input.conversationId,
        originalText: input.input.text
      });

      await prisma.agentLog.create({
        data: {
          agentType: input.dispatch.agentType,
          action: `tool_executed:${tool.name}`,
          input: JSON.stringify(parsed.data),
          output: JSON.stringify(execution.result),
          clientId: input.input.clientId,
          conversationId: input.input.conversationId,
          duration: Date.now() - startedAt
        }
      });

      return {
        ...input.response,
        text: `${input.response.text}\n\nAction executee: ${execution.message}`,
        toolAction: {
          ...proposed,
          args: parsed.data as Record<string, unknown>,
          status: "executed",
          message: execution.message,
          result: execution.result
        }
      };
    } catch (error) {
      await prisma.agentLog.create({
        data: {
          agentType: input.dispatch.agentType,
          action: `tool_failed:${tool.name}`,
          input: JSON.stringify(parsed.data),
          error: error instanceof Error ? error.message : String(error),
          clientId: input.input.clientId,
          conversationId: input.input.conversationId,
          duration: Date.now() - startedAt,
          escalated: true,
          escalatedTo: "human"
        }
      });

      return this.failToolAction(
        input.response,
        proposed.tool,
        "execution_failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private failToolAction(response: AgentResponse, tool: string, reason: string, error: string): AgentResponse {
    return {
      ...response,
      text: `${response.text}\n\nAction non executee (${tool}): ${error}`,
      decision: {
        ...response.decision,
        confidence: Math.min(response.decision.confidence, 0.28),
        escalate: true,
        reason
      },
      toolAction: {
        tool,
        args: response.toolAction?.args ?? {},
        status: "failed",
        error
      }
    };
  }

  private async storePendingToolAction(action: Omit<PendingToolAction, "id">) {
    const key = "agent_pending_tool_actions";
    const pending: PendingToolAction = {
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...action
    };
    const stored = await prisma.appSetting.findUnique({ where: { key } }).catch(() => null);
    const current = Array.isArray(stored?.value) ? (stored.value as unknown[]) : [];
    const next = [pending, ...current].slice(0, 200);
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: next as never },
      update: { value: next as never }
    });
    return pending;
  }
}

export const orchestrator = new AgentOrchestrator();
