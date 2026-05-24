import type { AgentInput, AgentResponse, AgentType } from "@oumar/shared";
import { BaseAgent } from "./BaseAgent.js";
import { generateAgentReply, type LlmChatMessage } from "../services/llmRuntime.js";
import { logger } from "../services/logger.js";
import { providerChatErrorMessage } from "../services/providerChatClient.js";
import { serializeToolsForPrompt } from "./tools/registry.js";

type AgentRuntimeAction = "reply" | "create_task" | "create_quote" | "send_invoice" | "report";

type RuntimeAgentConfig = {
  name?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  config?: {
    provider?: string;
    model?: string;
    description?: string;
    missionKind?: string;
    brainTab?: {
      bootstrap?: string;
      soul?: string;
      identity?: string;
      hitl?: boolean;
    };
  };
};

type RuntimeMemoryContext = {
  clientProfileSummary?: string;
  clientFacts?: string[];
  preferences?: string[];
  conversationSummary?: string;
  recentMessages?: Array<{
    role: "user" | "agent" | "system";
    content: string;
    agentType?: string | null;
  }>;
  retrievedKnowledge?: Array<{
    title: string;
    content?: string;
    score?: number;
  }>;
};

type RuntimeOrchestratorContext = {
  root?: string;
  groupName?: string;
  orchestratorName?: string;
  rootRouteReason?: string;
  routeReason?: string;
  routeKeywords?: string[];
  routingFallback?: boolean;
};

function readObject<T>(value: unknown): T | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
}

function compactLines(lines: Array<string | false | undefined | null>) {
  return lines.filter(Boolean).join("\n");
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function formatKnowledge(memoryContext: RuntimeMemoryContext | null) {
  const items = memoryContext?.retrievedKnowledge?.slice(0, 4) ?? [];
  if (!items.length) return "";

  return items
    .map((item, index) =>
      compactLines([
        `Source ${index + 1}: ${item.title}`,
        item.content ? truncate(item.content.replace(/\s+/g, " ").trim(), 900) : undefined
      ])
    )
    .join("\n\n");
}

function formatMemory(memoryContext: RuntimeMemoryContext | null) {
  if (!memoryContext) return "";

  return compactLines([
    memoryContext.clientProfileSummary ? `Profil client: ${memoryContext.clientProfileSummary}` : undefined,
    memoryContext.clientFacts?.length ? `Faits connus: ${memoryContext.clientFacts.join("; ")}` : undefined,
    memoryContext.preferences?.length ? `Preferences: ${memoryContext.preferences.join("; ")}` : undefined,
    memoryContext.conversationSummary ? `Resume conversation: ${memoryContext.conversationSummary}` : undefined
  ]);
}

function actionInstruction(action: AgentRuntimeAction) {
  switch (action) {
    case "create_quote":
      return "Objectif prioritaire: qualifier la demande commerciale, proposer une fourchette ou les informations necessaires au devis, puis indiquer la prochaine etape.";
    case "create_task":
      return "Objectif prioritaire: transformer la demande en actions projet claires, identifier les risques, delais et prochaines validations.";
    case "send_invoice":
      return "Objectif prioritaire: aider sur facture, paiement, confirmation ou relance avec prudence. Ne confirme jamais un paiement non verifie.";
    case "report":
      return "Objectif prioritaire: synthetiser les informations en points clairs, alertes et actions du jour.";
    default:
      return "Objectif prioritaire: repondre utilement au client et collecter les informations manquantes si besoin.";
  }
}

function buildSystemPrompt(input: {
  agentName: string;
  agentType: AgentType;
  basePrompt?: string;
  description?: string;
  action: AgentRuntimeAction;
  memoryContext: RuntimeMemoryContext | null;
  orchestratorContext: RuntimeOrchestratorContext | null;
}) {
  const knowledge = formatKnowledge(input.memoryContext);
  const memory = formatMemory(input.memoryContext);
  const routeKeywords = input.orchestratorContext?.routeKeywords?.join(", ");
  const availableTools = serializeToolsForPrompt(input.agentType);
  const toolInstruction = availableTools.length
    ? compactLines([
        "Outils reels disponibles pour toi:",
        JSON.stringify(availableTools, null, 2),
        "Quand une action doit etre executee, reponds avec un JSON strict et seulement ce JSON:",
        '{"message":"message client clair","action":{"tool":"nom_outil","args":{}}}',
        'Si aucune action ne doit etre executee, utilise: {"message":"message client clair","action":null}.',
        "Ne mets pas de markdown autour du JSON. Ne cree une action que si les informations minimales sont presentes."
      ])
    : undefined;

  return compactLines([
    "Tu es un agent IA operationnel de Oumar Business, agence digitale basee en Cote d'Ivoire.",
    `Agent actif: ${input.agentName}.`,
    input.description ? `Mission: ${input.description}` : undefined,
    input.basePrompt,
    actionInstruction(input.action),
    "Style: professionnel, clair, chaleureux, direct, francais par defaut sauf si le client ecrit dans une autre langue.",
    "Important: ne dis jamais que tu as seulement 'pris en charge' la demande. Donne une vraie reponse client exploitable.",
    "Si la demande concerne un prix ou un devis, demande les informations manquantes: type de service, objectifs, delai, budget indicatif, pays et canal de contact.",
    "Si une action sensible est necessaire (facture, paiement, engagement contractuel), prepare la reponse mais indique qu'une validation humaine peut etre requise.",
    toolInstruction,
    input.orchestratorContext
      ? `Routage interne: ${input.orchestratorContext.orchestratorName ?? "orchestrateur"} / ${input.orchestratorContext.routeReason ?? "n/a"}${routeKeywords ? ` / mots-cles: ${routeKeywords}` : ""}.`
      : undefined,
    memory ? `Memoire client:\n${memory}` : undefined,
    knowledge ? `Base documentaire utile:\n${knowledge}` : undefined,
    knowledge ? "Quand tu utilises la base documentaire, integre les informations naturellement dans ta reponse. Ne liste JAMAIS les sources, titres de documents, numeros ou references dans ta reponse au client." : undefined
  ]);
}

function buildMessages(input: AgentInput, memoryContext: RuntimeMemoryContext | null): LlmChatMessage[] {
  const history: LlmChatMessage[] = (memoryContext?.recentMessages ?? [])
    .filter((message) => message.role === "user" || message.role === "agent")
    .slice(-8)
    .map((message) => ({
      role: message.role === "agent" ? "assistant" : "user",
      content: truncate(message.content, 1200)
    }));

  return [
    ...history,
    {
      role: "user",
      content: input.text
    }
  ];
}

function formatSources(memoryContext: RuntimeMemoryContext | null) {
  const sources = memoryContext?.retrievedKnowledge?.slice(0, 3) ?? [];
  if (!sources.length) return "";

  return `\n\nSources:\n${sources.map((item, index) => `${index + 1}. ${item.title}`).join("\n")}`;
}

function extractJsonCandidate(text: string): { candidate: string; prefix: string } | null {
  const trimmed = text.trim();

  // 1. Bloc fenced ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return { candidate: fenced[1].trim(), prefix: "" };

  // 2. JSON au début du texte
  if (trimmed.startsWith("{")) return { candidate: trimmed, prefix: "" };

  // 3. JSON en fin de texte — le LLM répond normalement puis ajoute le JSON
  const lastBrace = trimmed.lastIndexOf("\n{");
  if (lastBrace !== -1) {
    return {
      candidate: trimmed.slice(lastBrace).trim(),
      prefix: trimmed.slice(0, lastBrace).trim()
    };
  }

  return null;
}

function parseStructuredCompletion(text: string): {
  message: string;
  action?: { tool: string; args: Record<string, unknown> };
  parseError?: string;
} {
  const extracted = extractJsonCandidate(text);
  if (!extracted) return { message: text };

  const { candidate, prefix } = extracted;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { message: text, parseError: "structured_output_not_object" };
    }

    const payload = parsed as { message?: unknown; action?: unknown };
    // Si le LLM a mis du texte avant le JSON, ce texte prime sur payload.message
    const payloadMessage = typeof payload.message === "string" && payload.message.trim() ? payload.message.trim() : "";
    const message = prefix || payloadMessage || text;

    if (!payload.action) return { message };

    if (typeof payload.action !== "object" || Array.isArray(payload.action)) {
      return { message, parseError: "action_not_object" };
    }

    const action = payload.action as { tool?: unknown; args?: unknown };
    if (typeof action.tool !== "string" || !action.tool.trim()) {
      return { message, parseError: "tool_missing" };
    }

    if (!action.args || typeof action.args !== "object" || Array.isArray(action.args)) {
      return { message, parseError: "tool_args_missing" };
    }

    return {
      message,
      action: {
        tool: action.tool,
        args: action.args as Record<string, unknown>
      }
    };
  } catch {
    // Si le JSON est en fin de texte et qu'on ne peut pas le parser, retourner le prefix seul
    return { message: prefix || text, parseError: "json_parse_failed" };
  }
}

export class GenericAgent extends BaseAgent {
  constructor(
    public readonly type: AgentType,
    public readonly name: string,
    private readonly defaultAction: AgentRuntimeAction = "reply"
  ) {
    super();
  }

  protected async execute(input: AgentInput): Promise<AgentResponse> {
    const config = readObject<RuntimeAgentConfig>(input.metadata?.agentConfig);
    const memoryContext = readObject<RuntimeMemoryContext>(input.metadata?.memoryContext);
    const orchestratorContext = readObject<RuntimeOrchestratorContext>(input.metadata?.orchestrator);
    const agentName = config?.name ?? this.name;
    const configObject = config?.config ?? {};
    const isTestMode = Boolean(input.metadata?.testMode);
    const testProvider = typeof input.metadata?.provider === "string" ? input.metadata.provider : "";
    const providerId = isTestMode && testProvider && testProvider !== "mock" ? testProvider : configObject.provider;

    const systemPrompt = buildSystemPrompt({
      agentName,
      agentType: this.type,
      basePrompt: config?.systemPrompt,
      description: configObject.description,
      action: this.defaultAction,
      memoryContext,
      orchestratorContext
    });

    const messages = buildMessages(input, memoryContext);
    const sources = formatSources(memoryContext);

    try {
      const completion = await generateAgentReply({
        providerId,
        model: configObject.model,
        systemPrompt,
        messages,
        temperature: config?.temperature,
        maxTokens: Math.max(config?.maxTokens ?? 1200, serializeToolsForPrompt(this.type).length ? 700 : 0)
      });

      if (!completion) {
        return {
          text:
            "Aucun fournisseur IA actif avec une cle configuree n'est disponible pour repondre. Va dans Parametres > Gestion des cles API, active au moins OpenAI, Groq, Claude, Gemini, Qwen, Kimi, GLM ou NVIDIA NIM, puis relance le test.",
          decision: {
            ...this.decision("escalate", 0),
            reason: "llm_provider_not_configured"
          }
        };
      }

      const structured = serializeToolsForPrompt(this.type).length ? parseStructuredCompletion(completion.text) : null;
      const proposedAction = structured?.action;
      const confidence = structured?.parseError
        ? 0.42
        : completion.fallbackFrom
          ? 0.76
          : proposedAction
            ? 0.9
            : 0.84;

      return {
        text: structured?.message ?? completion.text,
        decision: this.decision(this.defaultAction, confidence),
        toolAction: proposedAction
          ? {
              tool: proposedAction.tool,
              args: proposedAction.args,
              status: "proposed",
              message: structured?.message
            }
          : undefined
      };
    } catch (error) {
      logger.warn(
        {
          error,
          agent: this.type,
          provider: providerId,
          model: configObject.model
        },
        "agent llm runtime failed"
      );

      return {
        text: providerChatErrorMessage(providerId ?? "unknown", error),
        decision: {
          ...this.decision("escalate", 0.12),
          reason: "llm_runtime_error"
        }
      };
    }
  }
}
