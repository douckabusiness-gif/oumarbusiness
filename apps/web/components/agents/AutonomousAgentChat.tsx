"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Network,
  Route,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound
} from "lucide-react";

type AgentDecision = {
  action: string;
  confidence: number;
  escalate: boolean;
  reason: string;
};

type AgentPayload = {
  text: string;
  agentName: string;
  orchestratorGroup: "growth" | "operations";
  orchestratorName: string;
  rootRouteReason?: string;
  routeReason: string;
  routeKeywords?: string[];
  routingFallback?: boolean;
  decision: AgentDecision;
  toolAction?: {
    tool: string;
    status: "proposed" | "executed" | "pending_human" | "failed";
    message?: string;
    error?: string;
  };
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  body: string;
  meta?: string;
  payload?: AgentPayload;
};

const scenarios = [
  {
    label: "Demande devis",
    text: "Bonjour, je veux un devis pour un site e-commerce avec paiement Wave et WhatsApp.",
    expectedGroup: "growth",
    expectedAgent: "Commercial",
    expectedReason: "group_keyword:sales"
  },
  {
    label: "Projet en retard",
    text: "Je suis mecontent, mon projet de site web est en retard et je veux une solution aujourd'hui.",
    expectedGroup: "operations",
    expectedAgent: "Chef de projet",
    expectedReason: "group_keyword:project"
  },
  {
    label: "Campagne ads",
    text: "Prepare une campagne Facebook et Google Ads pour vendre mes services de livraison a Abidjan.",
    expectedGroup: "growth",
    expectedAgent: "Marketing",
    expectedReason: "group_keyword:marketing"
  },
  {
    label: "Facture",
    text: "Ma facture est deja payee par Orange Money, je veux une confirmation et le recu.",
    expectedGroup: "operations",
    expectedAgent: "Facturation",
    expectedReason: "group_keyword:billing"
  },
  {
    label: "Application web",
    text: "Je veux creer une application web pour gerer mes clients.",
    expectedGroup: "operations",
    expectedAgent: "Site Web",
    expectedReason: "group_keyword:web"
  },
  {
    label: "Agent IA",
    text: "Je veux creer un agent IA pour repondre automatiquement sur WhatsApp.",
    expectedGroup: "operations",
    expectedAgent: "Builder IA",
    expectedReason: "group_keyword:ai_builder"
  },
  {
    label: "Email",
    text: "Aide-moi a repondre a cet email client et a le classer.",
    expectedGroup: "growth",
    expectedAgent: "Email",
    expectedReason: "group_keyword:email"
  },
  {
    label: "WhatsApp",
    text: "Je veux preparer une diffusion WhatsApp pour mes prospects.",
    expectedGroup: "growth",
    expectedAgent: "WhatsApp",
    expectedReason: "group_keyword:whatsapp"
  }
];

function expectedForMessage(userText: string) {
  const normalized = userText.toLowerCase();
  return scenarios.find((scenario) => scenario.text.toLowerCase() === normalized);
}

function inferExpectedRoute(userText: string) {
  const exact = expectedForMessage(userText);
  if (exact) return exact;

  if (/devis|prix|tarif|budget|combien|proposition/i.test(userText)) {
    return { expectedGroup: "growth", expectedAgent: "Commercial", expectedReason: "group_keyword:sales" };
  }
  if (/application web|aplication web|appli web|app web|plateforme|site|wordpress|next\.?js|nextjs|e-?commerce|dashboard|portail|landing page/i.test(userText)) {
    return { expectedGroup: "operations", expectedAgent: "Site Web", expectedReason: "group_keyword:web" };
  }
  if (/agent ia|bot|assistant ia|automatisation|workflow|rag/i.test(userText)) {
    return { expectedGroup: "operations", expectedAgent: "Builder IA", expectedReason: "group_keyword:ai_builder" };
  }
  if (/facture|paiement|wave|stripe|orange money|invoice/i.test(userText)) {
    return { expectedGroup: "operations", expectedAgent: "Facturation", expectedReason: "group_keyword:billing" };
  }
  if (/retard|livrable|milestone|projet|deadline/i.test(userText)) {
    return { expectedGroup: "operations", expectedAgent: "Chef de projet", expectedReason: "group_keyword:project" };
  }
  if (/marketing|campagne|facebook|google ads|meta ads|ads|seo/i.test(userText)) {
    return { expectedGroup: "growth", expectedAgent: "Marketing", expectedReason: "group_keyword:marketing" };
  }
  if (/email|mail|newsletter|inbox/i.test(userText)) {
    return { expectedGroup: "growth", expectedAgent: "Email", expectedReason: "group_keyword:email" };
  }
  if (/whatsapp|broadcast|diffusion|qr code/i.test(userText)) {
    return { expectedGroup: "growth", expectedAgent: "WhatsApp", expectedReason: "group_keyword:whatsapp" };
  }

  return null;
}

function scoreResponse(payload?: AgentPayload, userText = "") {
  if (!payload) {
    return {
      total: 0,
      routing: 0,
      routePrecision: 0,
      confidence: 0,
      autonomy: 0,
      verdict: "En attente",
      notes: ["Aucune reponse agent a analyser."]
    };
  }

  const expected = inferExpectedRoute(userText);
  const confidence = Math.round(payload.decision.confidence * 100);
  const expectedGroupOk = expected ? payload.orchestratorGroup === expected.expectedGroup : true;
  const expectedReasonOk = expected ? payload.routeReason === expected.expectedReason : !payload.routingFallback;
  const routing = payload.routingFallback ? 35 : expectedGroupOk ? 92 : 45;
  const routePrecision = payload.routingFallback ? 25 : expectedReasonOk ? 94 : expectedGroupOk ? 68 : 35;
  const autonomy = payload.decision.escalate ? 58 : 88;
  const briefQuality = userText.length > 80 ? 86 : userText.length > 30 ? 72 : 50;
  const total = Math.round((confidence + routing + routePrecision + autonomy + briefQuality) / 5);
  const verdict =
    payload.routingFallback || routePrecision < 50
      ? "Mauvais routage"
      : routePrecision < 80
        ? "A verifier"
        : "Correct";
  const notes: string[] = [];

  if (payload.routingFallback) {
    notes.push("Routage faible: scenario utile pour entrainer l'orchestrateur.");
  }
  if (expected && !expectedReasonOk) {
    notes.push(`Attendu: ${expected.expectedGroup} / ${expected.expectedAgent}. Obtenu: ${payload.orchestratorGroup} / ${payload.agentName}.`);
  }
  if (expected && !expectedReasonOk && expected.expectedReason === "group_keyword:web") {
    notes.push("Suggestion: ajouter ou renforcer application web dans les regles Agent Site Web.");
  }
  if (payload.decision.escalate) {
    notes.push("Ajouter des exemples HITL pour que l'agent sache quand escalader.");
  } else {
    notes.push("Bonne autonomie: l'agent peut repondre sans intervention humaine.");
  }

  if (confidence < 75) {
    notes.push("Renforcer le prompt avec 3 cas clients proches de cette demande.");
  }

  if (briefQuality < 75) {
    notes.push("Tester avec un brief plus riche: budget, delai, pays, objectif.");
  } else {
    notes.push("Ce scenario peut devenir un replay d'entrainement valide.");
  }

  return {
    total,
    routing,
    routePrecision,
    confidence,
    autonomy,
    verdict,
    notes
  };
}

export function AutonomousAgentChat() {
  const [input, setInput] = useState("Bonjour, je veux un devis pour un site web avec agent IA.");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      body: "Ecris une demande client. Le routeur racine choisira le departement, puis l'orchestrateur du groupe prendra le relais.",
      meta: "Root Orchestrator"
    }
  ]);

  const latestAgent = useMemo(
    () => [...messages].reverse().find((message) => message.role === "agent" && message.payload),
    [messages]
  );
  const latestUser = useMemo(
    () => [...messages].reverse().find((message) => message.role === "user"),
    [messages]
  );
  const score = scoreResponse(latestAgent?.payload, latestUser?.body ?? "");

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      body: text,
      meta: "Demande entrante"
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/agent-test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "whatsapp",
          text,
          locale: "fr",
          conversationId: "autonomous-agent-chat"
        })
      });
      const payload = (await response.json()) as AgentPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? `API ${response.status}`);
      }

      setMessages((current) => [
        ...current,
        {
          id: `agent_${Date.now()}`,
          role: "agent",
          body: payload.text,
          meta: `${payload.agentName} · ${payload.decision.action}`,
          payload
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error_${Date.now()}`,
          role: "agent",
          body: "Le chat autonome n'a pas pu joindre l'API agent.",
          meta: error instanceof Error ? error.message : "Erreur inconnue"
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-8rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-w-0 flex-col rounded-lg border border-line bg-panel">
        <header className="flex min-h-16 items-center justify-between border-b border-line px-5">
          <div>
            <p className="text-sm text-gold">Chat autonome</p>
            <h2 className="text-xl font-semibold">Root Orchestrator</h2>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">Auto-routing</span>
        </header>

        <div className="border-b border-line bg-ink px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <RouteCard icon={Network} label="Niveau 1" value="Root Orchestrator" />
            <RouteCard
              icon={Route}
              label="Departement"
              value={latestAgent?.payload?.orchestratorGroup === "operations" ? "Operations" : latestAgent?.payload ? "Growth" : "En attente"}
            />
            <RouteCard icon={Bot} label="Agent final" value={latestAgent?.payload?.agentName ?? "En attente"} />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-ink p-5">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[84%] rounded-lg border px-4 py-3 ${
                  message.role === "user" ? "border-gold/40 bg-gold text-black" : "border-line bg-panel"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-xs opacity-75">
                  {message.role === "user" ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  {message.meta}
                </div>
                {message.payload ? (
                  <div className="mb-3 space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-gold/80">
                      {message.payload.orchestratorName} · {message.payload.orchestratorGroup} · {message.payload.routeReason}
                    </p>
                    <div
                      className={`rounded-md border px-3 py-2 text-xs ${
                        message.payload.routingFallback
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                      }`}
                    >
                      Pourquoi ce routage ?{" "}
                      {message.payload.routeKeywords?.length
                        ? message.payload.routeKeywords.join(", ")
                        : message.payload.routingFallback
                          ? "fallback canal"
                          : "route demandee"}
                    </div>
                    {message.payload.routeReason === "group_default" ? (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                        Routage faible, scenario utile pour entrainer l'orchestrateur.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-sm leading-6">{message.body}</p>
                {message.payload?.toolAction ? (
                  <div className="mt-3 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
                    Outil: {message.payload.toolAction.tool} · {message.payload.toolAction.status}
                    {message.payload.toolAction.message ? ` · ${message.payload.toolAction.message}` : ""}
                    {message.payload.toolAction.error ? ` · ${message.payload.toolAction.error}` : ""}
                  </div>
                ) : null}
                {message.payload ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      confiance {Math.round(message.payload.decision.confidence * 100)}%
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                        message.payload.decision.escalate ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {message.payload.decision.escalate ? "escalade" : "auto"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-gold" />
              Orchestration en cours...
            </div>
          ) : null}
        </div>

        <footer className="border-t border-line p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendMessage();
              }}
              className="h-12 flex-1 rounded-md border border-line bg-ink px-4 outline-none focus:border-gold/70"
              placeholder="Ecris une demande client..."
            />
            <button
              onClick={() => void sendMessage()}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-gold px-5 font-semibold text-black disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Envoyer
            </button>
          </div>
        </footer>
      </section>

      <aside className="space-y-5">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-gold" />
            <div>
              <p className="text-sm text-gold">Coach d'entrainement</p>
              <h2 className="font-semibold">Score scenario</h2>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-line bg-ink p-4 text-center">
            <p className="text-4xl font-bold text-gold">{score.total}%</p>
            <p className="mt-1 text-xs text-muted">qualite de routage et autonomie</p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                score.verdict === "Correct"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : score.verdict === "A verifier"
                    ? "bg-amber-500/15 text-amber-200"
                    : score.verdict === "En attente"
                      ? "bg-white/10 text-zinc-300"
                      : "bg-red-500/15 text-red-300"
              }`}
            >
              {score.verdict}
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            <ScoreLine label="Routage" value={score.routing} />
            <ScoreLine label="Precision routage" value={score.routePrecision} />
            <ScoreLine label="Confiance" value={score.confidence} />
            <ScoreLine label="Autonomie" value={score.autonomy} />
          </div>
          <div className="mt-4 space-y-2">
            {score.notes.map((note) => (
              <p key={note} className="rounded-md border border-line bg-ink p-3 text-sm leading-5 text-zinc-300">
                {note}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-gold" />
            <h2 className="font-semibold">Replays rapides</h2>
          </div>
          <div className="mt-4 space-y-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.label}
                onClick={() => void sendMessage(scenario.text)}
                disabled={loading}
                className="block w-full rounded-md border border-line bg-ink px-3 py-3 text-left text-sm text-zinc-300 hover:border-gold/60 disabled:opacity-60"
              >
                <span className="block font-semibold text-white">{scenario.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{scenario.text}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function RouteCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof BrainCircuit;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        <Icon className="h-4 w-4 text-gold" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
