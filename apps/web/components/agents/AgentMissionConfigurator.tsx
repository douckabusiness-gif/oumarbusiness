"use client";

import Link from "next/link";
import {
  Bot,
  Brain,
  CheckCircle2,
  Gauge,
  KeyRound,
  Mail,
  MessageSquareText,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  X,
  Zap
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

type MissionKind = "sales" | "sourcing" | "operations";

type AgentMission = {
  id: string;
  name: string;
  missionName: string;
  missionKind: MissionKind;
  provider: string;
  model: string;
  description: string;
  objective: string;
  hitl: boolean;
  bootstrap: string;
  soul: string;
  identity: string;
};

type SavedAgentConfig = {
  type: string;
  name: string;
  provider: string;
  model: string;
  missionPreset: string;
  description: string;
  hitlRequired: boolean;
  temperature: number;
  escalationThreshold: number;
  config?: {
    missionTab?: Record<string, unknown>;
    brainTab?: Record<string, unknown>;
  };
};

type AiProviderSettings = {
  id: string;
  name: string;
  defaultModel: string;
  enabled: boolean;
  apiKeyConfigured: boolean;
  models: string[];
};

const agents: AgentMission[] = [
  {
    id: "autonomous",
    name: "Autonome 24/7",
    missionName: "Agent d'Accueil",
    missionKind: "operations",
    provider: "Claude",
    model: "claude-sonnet-4-20250514",
    description: "Premier contact WhatsApp, Email et portail client.",
    objective: "Qualifier la demande et router vers le bon agent.",
    hitl: true,
    bootstrap: "Repondre vite, collecter le besoin, identifier le service et creer une fiche CRM.",
    soul: "Professionnel, chaleureux, rassurant, style Oumar Business.",
    identity: "Assistant principal de Oumar Business pour prospects et clients."
  },
  {
    id: "prospection",
    name: "Prospection",
    missionName: "Agent de Sourcing",
    missionKind: "sourcing",
    provider: "Gemini",
    model: "gemini-2.5-pro",
    description: "Trouve les prospects, les qualifie et les ajoute aux campagnes.",
    objective: "Identifier les bons clients et les enrolller dans le CRM.",
    hitl: true,
    bootstrap: "Chercher des prospects selon source, mots-cles et pays, puis appliquer les regles de qualification.",
    soul: "Curieux, precis, non agressif, oriente opportunites business.",
    identity: "Agent de sourcing B2B pour l'agence Oumar Business."
  },
  {
    id: "sales",
    name: "Commercial",
    missionName: "Agent de Vente",
    missionKind: "sales",
    provider: "OpenAI",
    model: "gpt-4.1",
    description: "Convertit les prospects en clients, devis et paiements.",
    objective: "Faire avancer le client vers devis, appel ou lien de paiement.",
    hitl: true,
    bootstrap: "Analyser le besoin, presenter la valeur, lever les objections et proposer l'action suivante.",
    soul: "Professionnel, clair, confiant, jamais forceur.",
    identity: "Commercial digital de Oumar Business specialise marketing, sites web et agents IA."
  },
  {
    id: "project",
    name: "Chef de projet",
    missionName: "Agent Projet",
    missionKind: "operations",
    provider: "Claude",
    model: "claude-sonnet-4-20250514",
    description: "Pilote les milestones, retards, validations et livrables.",
    objective: "Maintenir chaque projet dans les delais avec alertes utiles.",
    hitl: false,
    bootstrap: "Suivre les deadlines, demander les validations client et alerter avant retard.",
    soul: "Organise, calme, ferme sur les delais.",
    identity: "Chef de projet operations pour Oumar Business."
  },
  {
    id: "web",
    name: "Createur web",
    missionName: "Agent Site Web",
    missionKind: "operations",
    provider: "Gemini",
    model: "gemini-2.5-pro",
    description: "Transforme les briefs web en cahiers de charge et taches.",
    objective: "Choisir WordPress, Next.js ou e-commerce selon budget et complexite.",
    hitl: true,
    bootstrap: "Analyser le brief, recommander la stack et generer le plan de production.",
    soul: "Technique mais simple, pedagogue, oriente livraison.",
    identity: "Architecte web de Oumar Business."
  },
  {
    id: "ai-builder",
    name: "Builder agents IA",
    missionName: "Agent Builder IA",
    missionKind: "operations",
    provider: "Qwen",
    model: "qwen-plus",
    description: "Cree des agents IA clients avec prompts, outils et workflows.",
    objective: "Transformer un besoin client en agent IA livrable.",
    hitl: true,
    bootstrap: "Collecter role, canaux, outils, limites et scenarios de test.",
    soul: "Methodique, prudent avec les donnees, oriente produit.",
    identity: "Concepteur d'agents IA sur mesure pour Oumar Business."
  },
  {
    id: "marketing",
    name: "Marketing",
    missionName: "Agent Marketing",
    missionKind: "operations",
    provider: "Kimi K2",
    model: "kimi-k2",
    description: "Cree contenus, campagnes Meta/Google et briefs fal.ai.",
    objective: "Produire des campagnes pretes a publier avec validation.",
    hitl: true,
    bootstrap: "Generer angles, hooks, posts, publicites, visuels et calendrier editorial.",
    soul: "Creatif, commercial, adapte a l'Afrique de l'Ouest.",
    identity: "Strategiste contenu et acquisition de Oumar Business."
  },
  {
    id: "email",
    name: "Email",
    missionName: "Agent Email",
    missionKind: "operations",
    provider: "Claude",
    model: "claude-sonnet-4-20250514",
    description: "Classe, resume et repond aux emails professionnels.",
    objective: "Reduire le temps de traitement sans perdre la qualite.",
    hitl: true,
    bootstrap: "Classifier, resumer, proposer une reponse et escalader si risque.",
    soul: "Professionnel, concis, diplomate.",
    identity: "Assistant email de Oumar Business."
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    missionName: "Agent WhatsApp",
    missionKind: "operations",
    provider: "Groq",
    model: "llama-3.3-70b-versatile",
    description: "Gere conversations, relances et qualification WhatsApp.",
    objective: "Repondre vite et garder le prospect engage.",
    hitl: true,
    bootstrap: "Detecter l'intention, repondre dans la langue du client et creer les suivis.",
    soul: "Direct, chaleureux, naturel dans WhatsApp.",
    identity: "Agent WhatsApp officiel de Oumar Business."
  },
  {
    id: "billing",
    name: "Facturation",
    missionName: "Agent Facturation",
    missionKind: "operations",
    provider: "OpenAI",
    model: "gpt-4.1",
    description: "Cree factures, relances et instructions de paiement.",
    objective: "Envoyer facture et relance au bon moment.",
    hitl: true,
    bootstrap: "Verifier projet, montant, devise, methode de paiement et delai.",
    soul: "Rigoureux, poli, ferme sur les paiements.",
    identity: "Agent finance et facturation de Oumar Business."
  },
  {
    id: "freelance",
    name: "Freelances",
    missionName: "Agent Freelance",
    missionKind: "operations",
    provider: "GLM",
    model: "glm-4.5",
    description: "Evalue candidats, suit missions et controle livrables.",
    objective: "Trouver le bon freelance et proteger la qualite.",
    hitl: true,
    bootstrap: "Scorer profils, suivre livrables et signaler les risques de qualite.",
    soul: "Exigeant, juste, oriente resultat.",
    identity: "Manager freelance de Oumar Business."
  },
  {
    id: "report",
    name: "Rapport de nuit",
    missionName: "Boss Agent",
    missionKind: "operations",
    provider: "Claude",
    model: "claude-sonnet-4-20250514",
    description: "Compile le rapport quotidien pour Oumar.",
    objective: "Donner chaque matin les priorites et alertes.",
    hitl: false,
    bootstrap: "Analyser messages, projets, ventes, finances et actions urgentes.",
    soul: "Clair, synthetique, oriente decision.",
    identity: "Agent de reporting executif de Oumar Business."
  }
];

const defaultAgent = agents.find((agent) => agent.id === "sales") ?? agents[0]!;
const apiBaseUrl = getApiBaseUrl();

export function AgentMissionConfigurator() {
  const [agentList, setAgentList] = useState<AgentMission[]>(agents);
  const [providerCatalog, setProviderCatalog] = useState<AiProviderSettings[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentMission>(defaultAgent);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(providerId(defaultAgent.provider));
  const [selectedModel, setSelectedModel] = useState<string>(defaultAgent.model);
  const [activeTab, setActiveTab] = useState<"mission" | "brain">("mission");
  const [isOpen, setIsOpen] = useState(false);
  const [savedAgent, setSavedAgent] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedIndex = useMemo(
    () => agentList.findIndex((agent) => agent.id === selectedAgent.id) + 1,
    [agentList, selectedAgent]
  );
  const readyProviders = useMemo(
    () => providerCatalog.filter((provider) => provider.enabled && provider.apiKeyConfigured),
    [providerCatalog]
  );
  const providerCount = String(readyProviders.length);
  const selectedProvider = providerCatalog.find((provider) => provider.id === selectedProviderId) ?? null;
  const providerInvalid = Boolean(selectedProviderId) && !readyProviders.some((provider) => provider.id === selectedProviderId);
  const noReadyProviders = providerCatalog.length > 0 && readyProviders.length === 0;
  const availableModels = selectedProvider?.models ?? [];
  const saveBlocked = isSaving || !selectedProviderId || providerInvalid || noReadyProviders;
  const providerAlert = noReadyProviders
    ? "Aucun fournisseur IA actif avec une cle configuree. Va dans Gestion des cles API pour en preparer un."
    : providerInvalid
      ? `${selectedProvider?.name ?? selectedAgent.provider} est indisponible. Choisis un fournisseur actif avec une cle configuree.`
      : null;

  useEffect(() => {
    let isMounted = true;

    async function loadConfiguration() {
      try {
        const [agentsResponse, providersResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/settings/agents`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/settings/ai-providers`, { cache: "no-store" })
        ]);

        const agentsPayload = (await agentsResponse.json()) as { agents?: SavedAgentConfig[]; error?: string };
        const providersPayload = (await providersResponse.json()) as { providers?: AiProviderSettings[]; error?: string };

        if (!agentsResponse.ok) {
          throw new Error(agentsPayload.error ?? "Impossible de charger les agents.");
        }

        if (!providersResponse.ok) {
          throw new Error(providersPayload.error ?? "Impossible de charger les fournisseurs IA.");
        }

        if (!isMounted) return;

        const catalog = providersPayload.providers ?? [];
        setProviderCatalog(catalog);
        setAgentList((currentAgents) =>
          currentAgents.map((agent) => {
            const saved = agentsPayload.agents?.find((candidate) => candidate.type === agent.id);
            const nextAgent = saved ? mergeSavedAgent(agent, saved) : agent;
            return syncAgentProvider(nextAgent, catalog);
          })
        );
      } catch (error) {
        if (isMounted) {
          setSaveError(error instanceof Error ? error.message : "Impossible de charger la configuration IA.");
        }
      }
    }

    void loadConfiguration();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProvider) return;

    if (availableModels.length === 0) {
      setSelectedModel(selectedProvider.defaultModel);
      return;
    }

    if (!availableModels.includes(selectedModel)) {
      setSelectedModel(
        availableModels.includes(selectedAgent.model) ? selectedAgent.model : selectedProvider.defaultModel
      );
    }
  }, [availableModels, selectedAgent.model, selectedModel, selectedProvider]);

  function openConfigurator(agent: AgentMission) {
    const nextProviderId = resolveProviderId(agent.provider, providerCatalog);
    setSelectedAgent(agent);
    setSelectedProviderId(nextProviderId);
    setSelectedModel(resolveAgentModel(agent, nextProviderId, providerCatalog));
    setActiveTab("mission");
    setSavedAgent(null);
    setIsOpen(true);
  }

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProviderId || providerInvalid || noReadyProviders) {
      setSaveError(providerAlert ?? "Choisis un fournisseur IA actif dans Gestion des cles API.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const formData = new FormData(event.currentTarget);
    const bootstrap = String(formData.get("bootstrap") ?? selectedAgent.bootstrap);
    const soul = String(formData.get("soul") ?? selectedAgent.soul);
    const identity = String(formData.get("identity") ?? selectedAgent.identity);
    const name = String(formData.get("name") ?? selectedAgent.missionName);
    const provider = selectedProviderId;
    const model = selectedModel;
    const temperature = Number(formData.get("temperature") ?? 0.7);
    const hitl = formData.get("hitl") === "on";

    const payload = {
      type: selectedAgent.id,
      name,
      provider,
      model,
      temperature,
      escalationThreshold: 0.3,
      enabled: true,
      systemPrompt: `${bootstrap}\n\n${soul}\n\n${identity}`,
      missionKind: selectedAgent.missionKind,
      description: selectedAgent.description,
      config: {
        provider,
        model,
        missionKind: selectedAgent.missionKind,
        description: selectedAgent.description,
        missionTab: buildMissionPayload(selectedAgent, formData),
        brainTab: {
          bootstrap,
          soul,
          identity,
          hitl
        }
      }
    };

    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/agents/${selectedAgent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { agent?: SavedAgentConfig; error?: string };
      if (!response.ok || !result.agent) {
        throw new Error(result.error ?? "Sauvegarde impossible pour le moment.");
      }

      const updatedAgent = syncAgentProvider(mergeSavedAgent(selectedAgent, result.agent), providerCatalog);

      setAgentList((currentAgents) =>
        currentAgents.map((agent) => (agent.id === selectedAgent.id ? updatedAgent : agent))
      );
      setSelectedAgent(updatedAgent);
      setSelectedProviderId(resolveProviderId(updatedAgent.provider, providerCatalog));
      setSelectedModel(updatedAgent.model);
      setSavedAgent(updatedAgent.missionName);
      setIsOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Sauvegarde impossible pour le moment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Parametres agents IA</p>
          <h1 className="mt-2 text-3xl font-bold">Configuration mission + cerveau</h1>
        </div>
        <button
          type="button"
          onClick={() => openConfigurator(agentList.find((agent) => agent.id === defaultAgent.id) ?? defaultAgent)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Configurer une mission
        </button>
      </div>

      {saveError ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {saveError}
        </div>
      ) : null}

      {savedAgent ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          Mission sauvegardee en base PostgreSQL : {savedAgent}
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Missions heritees de tes premiers agents</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Vente et Sourcing deviennent des modeles reutilisables pour les 12 agents autonomes.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MissionPreset title="Agent de Vente" icon={<MessageSquareText className="h-5 w-5" />} />
            <MissionPreset title="Agent de Sourcing" icon={<Search className="h-5 w-5" />} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentList.map((agent, index) => (
          <article key={agent.id} className="rounded-lg border border-line bg-panel p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold font-bold text-black">
                {index + 1}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">Actif</span>
            </div>
            <h2 className="mt-5 text-lg font-semibold">{agent.name}</h2>
            <p className="mt-2 text-sm text-gold">{agent.missionName}</p>
            <p className="mt-3 min-h-12 text-sm leading-6 text-muted">{agent.description}</p>
            <div className="mt-5 grid gap-2 text-sm text-zinc-300">
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-gold" />
                {agent.provider}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold" />
                HITL {agent.hitl ? "active" : "desactive"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openConfigurator(agent)}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line text-sm font-semibold text-white hover:border-gold/70"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Configurer la mission
            </button>
          </article>
        ))}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-line bg-[#070b16] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-3">
                {selectedAgent.missionKind === "sourcing" ? (
                  <Search className="h-5 w-5 text-blue-400" />
                ) : (
                  <KeyRound className="h-5 w-5 text-violet-400" />
                )}
                <h2 className="text-xl font-bold">Configurer la mission : {selectedAgent.missionName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 border-b border-line bg-zinc-400/60 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("mission")}
                className={`flex h-14 items-center justify-center gap-2 border-b-2 ${
                  activeTab === "mission" ? "border-indigo-500 text-white" : "border-transparent text-zinc-300"
                }`}
              >
                <Target className="h-4 w-4" />
                Mission
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("brain")}
                className={`flex h-14 items-center justify-center gap-2 border-b-2 ${
                  activeTab === "brain" ? "border-indigo-500 text-white" : "border-transparent text-zinc-300"
                }`}
              >
                <Brain className="h-4 w-4" />
                Cerveau de l'Agent
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="agent-config-form" onSubmit={saveConfiguration}>
                {activeTab === "mission" ? (
                  <MissionTab agent={selectedAgent} />
                ) : (
                  <BrainTab
                    agent={selectedAgent}
                    providers={readyProviders}
                    selectedProviderId={selectedProviderId}
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    providerAlert={providerAlert}
                    onProviderChange={setSelectedProviderId}
                    onModelChange={setSelectedModel}
                    providerInvalid={providerInvalid}
                    noReadyProviders={noReadyProviders}
                  />
                )}
              </form>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line bg-zinc-400/70 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-11 rounded-md bg-[#020817] px-5 text-sm font-semibold text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                form="agent-config-form"
                disabled={saveBlocked}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Sauvegarde..." : "Sauvegarder les parametres"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Agents configurables" value="12" />
          <Metric label="Missions heritees" value="2" />
          <Metric label="Fournisseurs IA prets" value={providerCount} />
          <Metric label="Mode HITL" value="Pret" />
        </div>
      </section>

      <p className="text-xs text-muted">Agent selectionne par defaut : {selectedIndex > 0 ? selectedIndex : 1}</p>
    </div>
  );
}

function MissionPreset({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="flex min-w-52 items-center gap-3 rounded-lg border border-line bg-ink px-4 py-3">
      <span className="text-gold">{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

function mergeSavedAgent(agent: AgentMission, saved: SavedAgentConfig): AgentMission {
  const brainTab = saved.config?.brainTab ?? {};

  return {
    ...agent,
    missionName: saved.name || agent.missionName,
    missionKind: (saved.missionPreset as MissionKind) || agent.missionKind,
    provider: providerLabel(saved.provider) || agent.provider,
    model: saved.model || agent.model,
    description: saved.description || agent.description,
    hitl: saved.hitlRequired,
    bootstrap: String(brainTab.bootstrap ?? agent.bootstrap),
    soul: String(brainTab.soul ?? agent.soul),
    identity: String(brainTab.identity ?? agent.identity)
  };
}

function syncAgentProvider(agent: AgentMission, providers: AiProviderSettings[]) {
  const nextProvider = providers.find((provider) => provider.id === resolveProviderId(agent.provider, providers));
  if (!nextProvider) return agent;

  return {
    ...agent,
    provider: nextProvider.name,
    model: nextProvider.models.includes(agent.model) ? agent.model : nextProvider.defaultModel
  };
}

function providerLabel(provider: string) {
  const normalized = provider.toLowerCase();
  const labels: Record<string, string> = {
    claude: "Claude",
    openai: "OpenAI",
    groq: "Groq",
    gemini: "Gemini",
    glm: "GLM",
    "kimi-k2": "Kimi K2",
    qwen: "Qwen",
    "nvidia-nim": "NVIDIA NIM",
    "fal-ai": "fal.ai",
    "fal.ai": "fal.ai"
  };

  return labels[normalized] ?? provider;
}

function providerId(provider: string) {
  const labels: Record<string, string> = {
    Claude: "claude",
    OpenAI: "openai",
    Groq: "groq",
    Gemini: "gemini",
    GLM: "glm",
    "Kimi K2": "kimi-k2",
    Qwen: "qwen",
    "NVIDIA NIM": "nvidia-nim",
    "fal.ai": "fal-ai"
  };

  return labels[provider] ?? provider.toLowerCase();
}

function resolveProviderId(provider: string, providers: AiProviderSettings[]) {
  const directMatch = providers.find((candidate) => candidate.id === provider.toLowerCase());
  if (directMatch) return directMatch.id;

  const labelMatch = providers.find((candidate) => candidate.name === provider);
  if (labelMatch) return labelMatch.id;

  return providerId(provider);
}

function resolveAgentModel(agent: AgentMission, nextProviderId: string, providers: AiProviderSettings[]) {
  const nextProvider = providers.find((provider) => provider.id === nextProviderId);
  if (!nextProvider) return agent.model;

  if (nextProvider.models.includes(agent.model)) {
    return agent.model;
  }

  return nextProvider.defaultModel;
}

function buildMissionPayload(agent: AgentMission, formData: FormData) {
  if (agent.missionKind === "sales") {
    return {
      tone: String(formData.get("tone") ?? "Professionnel & Formel"),
      pitch: String(formData.get("pitch") ?? ""),
      conversionObjective: String(formData.get("conversionObjective") ?? "Devis PDF"),
      channels: ["whatsapp", "email", "crm", "billing"]
    };
  }

  if (agent.missionKind === "sourcing") {
    return {
      prospectSource: String(formData.get("prospectSource") ?? "LinkedIn Pro"),
      searchKeywords: String(formData.get("searchKeywords") ?? ""),
      qualificationInstructions: String(formData.get("qualificationInstructions") ?? ""),
      marketingEnrollment: String(formData.get("marketingEnrollment") ?? "Aucun enrolement")
    };
  }

  return {
    objective: String(formData.get("operationalObjective") ?? agent.objective),
    actionRules: String(formData.get("actionRules") ?? agent.bootstrap),
    channels: ["whatsapp", "email", "crm", "marketing"]
  };
}

function MissionTab({ agent }: { agent: AgentMission }) {
  if (agent.missionKind === "sales") {
    return (
      <div className="space-y-6">
        <SelectField
          name="tone"
          label="Script de vente & Ton"
          defaultValue="Professionnel & Formel"
          options={["Professionnel & Formel", "Chaleureux WhatsApp", "Direct conversion", "Consultatif premium"]}
        />
        <TextAreaField
          name="pitch"
          label="Proposition de valeur (Pitch)"
          defaultValue="Oumar Business automatise votre acquisition, vos reponses WhatsApp et vos ventes avec des agents IA connectes a votre CRM."
          placeholder="Quel est l'argument principal pour convaincre le client ?"
          rows={5}
        />
        <SelectField
          name="conversionObjective"
          label="Objectif de conversion"
          defaultValue="Lien de paiement (Stripe)"
          options={[
            "Lien de paiement (Stripe)",
            "Devis PDF",
            "Appel de diagnostic",
            "Paiement Wave CI",
            "Paiement Orange Money",
            "Portail client"
          ]}
        />
        <ChannelGrid />
      </div>
    );
  }

  if (agent.missionKind === "sourcing") {
    return (
      <div className="space-y-6">
        <SelectField
          name="prospectSource"
          label="Source de prospection"
          defaultValue="LinkedIn Pro"
          options={["LinkedIn Pro", "CSV importe", "Meta Leads", "Google Maps", "Site web", "WhatsApp groups"]}
        />
        <InputField name="searchKeywords" label="Mots-cles de recherche" placeholder="ex: PME, Plomberie, Paris, Decideurs..." />
        <TextAreaField
          name="qualificationInstructions"
          label="Instructions de qualification"
          placeholder="Decrivez a l'IA comment reconnaitre un bon client..."
          rows={5}
        />
        <SelectField
          name="marketingEnrollment"
          label="Enrolement Automatique (Marketing)"
          defaultValue="Aucun enrolement"
          options={[
            "Aucun enrolement",
            "Campagne Meta Ads",
            "Sequence email J+3/J+7",
            "Broadcast WhatsApp autorise",
            "Pipeline CRM Prospect"
          ]}
        />
        <p className="text-xs italic text-muted">Chaque prospect trouve sera automatiquement ajoute a cette campagne.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SelectField
        name="missionName"
        label="Type de mission"
        defaultValue={agent.missionName}
        options={[agent.missionName, "Support client", "Controle qualite", "Reporting", "Production"]}
      />
      <TextAreaField name="operationalObjective" label="Objectif operationnel" defaultValue={agent.objective} rows={4} />
      <TextAreaField name="actionRules" label="Regles d'action" defaultValue={agent.bootstrap} rows={5} />
      <ChannelGrid />
    </div>
  );
}

function BrainTab({
  agent,
  providers,
  selectedProviderId,
  selectedModel,
  availableModels,
  providerAlert,
  onProviderChange,
  onModelChange,
  providerInvalid,
  noReadyProviders
}: {
  agent: AgentMission;
  providers: AiProviderSettings[];
  selectedProviderId: string;
  selectedModel: string;
  availableModels: string[];
  providerAlert: string | null;
  onProviderChange: (value: string) => void;
  onModelChange: (value: string) => void;
  providerInvalid: boolean;
  noReadyProviders: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <InputField name="name" label="Nom de l'Agent" defaultValue={agent.missionName} />
        <ModelSelectField
          label="Modele actif"
          value={selectedModel}
          options={availableModels}
          disabled={noReadyProviders || providerInvalid}
          onChange={onModelChange}
        />
      </div>

      <TextAreaField
        name="bootstrap"
        label="BOOTSTRAP (Instructions de base)"
        labelClassName="text-blue-400"
        defaultValue={agent.bootstrap}
        placeholder="Instructions systeme..."
        rows={5}
      />
      <TextAreaField
        name="soul"
        label="SOUL (Personnalite)"
        labelClassName="text-violet-400"
        defaultValue={agent.soul}
        placeholder="Style, ton, attitude..."
        rows={4}
      />
      <TextAreaField
        name="identity"
        label="IDENTITY (Qui est-il ?)"
        labelClassName="text-emerald-400"
        defaultValue={agent.identity}
        placeholder="Nom, role, domaine d'expertise..."
        rows={4}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ProviderSelectField
          label="Fournisseur IA"
          value={selectedProviderId}
          options={providers}
          invalidLabel={providerInvalid ? `${agent.provider} (indisponible)` : null}
          disabled={noReadyProviders}
          onChange={onProviderChange}
        />
        <InputField name="temperature" label="Temperature" defaultValue="0.7" />
      </div>

      {providerAlert ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <p>{providerAlert}</p>
          <Link href="/settings/api-keys" className="mt-3 inline-flex font-semibold text-gold underline underline-offset-4">
            Ouvrir Gestion des cles API
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-300">Validation HUMAINE (HITL)</p>
              <p className="mt-1 text-sm italic text-amber-200/80">
                Si active, l'agent ne pourra pas envoyer d'email, devis, paiement ou campagne sans approbation.
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input name="hitl" type="checkbox" defaultChecked={agent.hitl} className="peer sr-only" />
            <span className="h-7 w-12 rounded-full bg-slate-700 transition peer-checked:bg-gold" />
            <span className="absolute left-1 h-5 w-5 rounded-full bg-slate-950 transition peer-checked:translate-x-5" />
          </label>
        </div>
      </div>
    </div>
  );
}

function ChannelGrid() {
  const channels = [
    ["WhatsApp", MessageSquareText],
    ["Email", Mail],
    ["CRM", Gauge],
    ["Marketing", Zap]
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {channels.map(([channel, Icon]) => (
        <label key={channel} className="flex items-center justify-between rounded-md border border-line bg-ink p-3 text-sm">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gold" />
            {channel}
          </span>
          <input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" />
        </label>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function InputField({
  label,
  name,
  placeholder,
  defaultValue,
  readOnly = false
}: {
  label: string;
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-zinc-200">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className="h-11 rounded-md border border-line bg-[#050917] px-3 outline-none focus:border-indigo-400 read-only:text-zinc-400"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options
}: {
  label: string;
  name?: string;
  defaultValue: string;
  options: string[];
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-zinc-200">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-md border border-line bg-[#050917] px-3 outline-none focus:border-indigo-400"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ProviderSelectField({
  label,
  value,
  options,
  invalidLabel,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: AiProviderSettings[];
  invalidLabel: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-zinc-200">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-[#050917] px-3 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {invalidLabel ? <option value={value}>{invalidLabel}</option> : null}
        {!value && !invalidLabel ? <option value="">Choisir un fournisseur actif</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModelSelectField({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const normalizedOptions = options.includes(value) ? options : value ? [value, ...options] : options;

  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold text-zinc-200">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-[#050917] px-3 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {normalizedOptions.length === 0 ? <option value="">Aucun modele disponible</option> : null}
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  placeholder,
  defaultValue,
  labelClassName = "text-zinc-200",
  rows = 4
}: {
  label: string;
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  labelClassName?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className={`font-semibold ${labelClassName}`}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-md border border-line bg-[#050917] px-3 py-3 outline-none focus:border-indigo-400"
      />
    </label>
  );
}
