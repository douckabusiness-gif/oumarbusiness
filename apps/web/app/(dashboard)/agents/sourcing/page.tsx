"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  PlayCircle,
  Radar,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  X
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type SourcingChannel = "email_whatsapp" | "email" | "whatsapp" | "crm_only";

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
  limits: {
    emailDailyLimit: number;
    whatsappDailyLimit: number;
    emailSentToday: number;
    whatsappSentToday: number;
  };
  createdAt: string;
};

type SourcingAgentStatus = {
  id: string;
  name: string;
  provider: string;
  role: string;
  ready: boolean;
  keySource: "database" | "env" | "none";
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

const initialForm = {
  sector: "PME, startups, e-commerce, cliniques, immobilier",
  location: "Afrique, Europe, USA",
  service: "marketing digital, site web, agent IA",
  keywords: "PME Afrique, startup Europe, local business USA, website redesign, WhatsApp automation",
  limit: "12",
  channel: "email_whatsapp" as SourcingChannel,
  tone: "professionnel, court et chaleureux"
};

const defaultConfig: SourcingAgentsConfig = {
  discovery: {
    name: "Chasseur Sourcing Global",
    provider: "serper",
    source: "Serper Google Search international",
    keywords: initialForm.keywords,
    bootstrap:
      "Cherche des entreprises qui ont un besoin visible en marketing digital, creation de site web ou agent IA. Ramene seulement des pistes exploitables.",
    soul: "Rapide, curieux, business, sans bruit.",
    identity: "Agent 1. Il trouve des prospects sur le web.",
    enrollment: "Aucun enrolement",
    hitl: true,
    limit: 12,
    enabled: true
  },
  qualification: {
    name: "Analyste Qualification Elite",
    provider: "tavily",
    bootstrap:
      "Analyse les prospects trouves, lit leur site, verifie le contact, attribue un score, puis decide quoi faire.",
    soul: "Strict, precis et rentable.",
    identity: "Agent 2. Il qualifie et decide si on contacte ou non.",
    enrollment: "Aucun enrolement",
    hitl: true,
    autoContactScore: 70,
    crmOnlyScore: 50,
    rules:
      "Prioriser les entreprises avec site actif, vrai besoin probable, email ou WhatsApp exploitable, et un interet clair pour marketing, web ou IA.",
    enabled: true
  }
};

const presets = [
  {
    label: "Afrique",
    sector: "PME, restaurants, cliniques, immobilier, e-commerce",
    location: "Cote d'Ivoire, Senegal, Ghana, Mali",
    service: "WhatsApp IA, site web, marketing digital",
    keywords: "PME Afrique, restaurant Abidjan, clinique Dakar, immobilier Ghana, WhatsApp business"
  },
  {
    label: "Europe",
    sector: "startups SaaS, agences, e-commerce, cabinets",
    location: "France, Belgique, Suisse, Allemagne",
    service: "agent IA, automatisation CRM, site web",
    keywords: "startup Europe, SaaS, agence marketing, CRM automation, Paris, Bruxelles"
  },
  {
    label: "USA",
    sector: "local businesses, clinics, real estate, home services",
    location: "United States, Texas, Florida, New York",
    service: "website redesign, AI receptionist, lead generation",
    keywords: "local business USA, AI receptionist, website redesign, real estate leads"
  }
];

function buildObjective(form: typeof initialForm) {
  return `Trouver des prospects dans ${form.location} pour vendre ${form.service} au secteur ${form.sector}.`;
}

function channelLabel(channel: SourcingChannel) {
  switch (channel) {
    case "email":
      return "Email seulement";
    case "whatsapp":
      return "WhatsApp seulement";
    case "crm_only":
      return "CRM seulement";
    default:
      return "Email + WhatsApp";
  }
}

export default function SourcingAgentPage() {
  const [form, setForm] = useState(initialForm);
  const [runs, setRuns] = useState<SourcingRun[]>([]);
  const [activeRun, setActiveRun] = useState<SourcingRun | null>(null);
  const [agents, setAgents] = useState<SourcingAgentStatus[]>([]);
  const [config, setConfig] = useState<SourcingAgentsConfig>(defaultConfig);
  const [editingAgent, setEditingAgent] = useState<"discovery" | "qualification" | null>(null);
  const [editorTab, setEditorTab] = useState<"mission" | "brain">("mission");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<"all" | "discovery" | "qualification" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [optOutValue, setOptOutValue] = useState("");
  const [optOutChannel, setOptOutChannel] = useState<"email" | "whatsapp">("email");

  const generatedObjective = useMemo(() => buildObjective(form), [form]);
  const canRunQualification = Boolean(activeRun?.prospects.length);

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      const [runsResponse, statusResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/agents/sourcing/runs`, { cache: "no-store" }),
        fetch(`${apiBaseUrl}/api/agents/sourcing/status`, { cache: "no-store" })
      ]);

      const runsPayload = (await runsResponse.json()) as { runs?: SourcingRun[]; error?: string };
      const statusPayload = (await statusResponse.json()) as {
        agents?: SourcingAgentStatus[];
        config?: SourcingAgentsConfig;
        error?: string;
      };

      if (!runsResponse.ok) throw new Error(runsPayload.error ?? "Historique sourcing indisponible.");
      if (!statusResponse.ok) throw new Error(statusPayload.error ?? "Statut sourcing indisponible.");

      setRuns(runsPayload.runs ?? []);
      setActiveRun(runsPayload.runs?.[0] ?? null);
      setAgents(statusPayload.agents ?? []);

      if (statusPayload.config) {
        setConfig(statusPayload.config);
        setForm((current) => ({
          ...current,
          keywords: statusPayload.config?.discovery.keywords ?? current.keywords,
          limit: String(statusPayload.config?.discovery.limit ?? current.limit)
        }));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chargement sourcing impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function pollRun(runId: string, attempt = 0) {
    if (attempt > 80) {
      setRunning(null);
      setError("Le run prend trop de temps. Recharge la page pour voir l'etat final.");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const response = await fetch(`${apiBaseUrl}/api/agents/sourcing/runs`, { cache: "no-store" });
      const payload = (await response.json()) as { runs?: SourcingRun[] };
      const found = payload.runs?.find((item) => item.id === runId);
      if (payload.runs) {
        setRuns(payload.runs);
      }
      if (found) {
        setActiveRun(found);
        if (found.status !== "running") {
          setRunning(null);
          return;
        }
      }
    } catch {
      // retry quietly
    }

    void pollRun(runId, attempt + 1);
  }

  async function launch(mode: "all" | "discovery" | "qualification") {
    setError("");
    setSuccess("");
    setRunning(mode);

    try {
      let endpoint = "/api/agents/sourcing/run";
      let body: Record<string, unknown> = {
        ...form,
        objective: generatedObjective,
        limit: Number(form.limit)
      };

      if (mode === "discovery") {
        endpoint = "/api/agents/sourcing/discovery/run";
      }

      if (mode === "qualification") {
        if (!activeRun?.id || activeRun.prospects.length === 0) {
          throw new Error("Lance Agent 1 d'abord pour donner des prospects a Agent 2.");
        }
        endpoint = `/api/agents/sourcing/runs/${activeRun.id}/qualification/run`;
        body = {};
      }

      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { run?: SourcingRun; error?: string };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "Lancement impossible.");
      }

      setRuns((current) => [payload.run!, ...current.filter((run) => run.id !== payload.run!.id)]);
      setActiveRun(payload.run);
      setSuccess(
        mode === "all"
          ? "Les 2 agents ont ete lances."
          : mode === "discovery"
            ? "Agent 1 a ete lance."
            : "Agent 2 a ete lance."
      );

      if (payload.run.status === "running") {
        void pollRun(payload.run.id);
      } else {
        setRunning(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lancement impossible.");
      setRunning(null);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/agents/sourcing/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const payload = (await response.json()) as { config?: SourcingAgentsConfig; error?: string };
      if (!response.ok || !payload.config) {
        throw new Error(payload.error ?? "Sauvegarde impossible.");
      }

      setConfig(payload.config);
      setEditingAgent(null);
      setSuccess("Parametres agent sauvegardes.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sauvegarde impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOptOut() {
    if (!optOutValue.trim()) return;
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/agents/sourcing/optout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: optOutValue.trim(), channel: optOutChannel })
      });

      if (!response.ok) {
        throw new Error("Enregistrement STOP impossible.");
      }

      setOptOutValue("");
      setSuccess("Contact ajoute a la liste STOP.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement STOP impossible.");
    }
  }

  const stats = {
    total: activeRun?.prospects.length ?? 0,
    auto: activeRun?.prospects.filter((item) => item.decision === "contact_auto").length ?? 0,
    crmOnly: activeRun?.prospects.filter((item) => item.decision === "crm_only").length ?? 0,
    ignored: activeRun?.prospects.filter((item) => item.decision === "ignored").length ?? 0
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/agents" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold">
            <ArrowLeft className="h-4 w-4" />
            Retour agents
          </Link>
          <p className="mt-4 text-sm text-gold">Agents Sourcing</p>
          <h1 className="mt-2 text-3xl font-bold">Trouver des prospects, puis decider quoi faire</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            Cette page fonctionne en 2 etapes simples. Agent 1 cherche des entreprises. Agent 2 lit, score et decide
            si on contacte, si on stocke seulement en CRM, ou si on ignore.
          </p>
        </div>
      </div>

      {error ? <Notice tone="error" text={error} /> : null}
      {success ? <Notice tone="success" text={success} /> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <SimpleStep
          number="1"
          title="Remplis le brief"
          text="Secteur, pays, service a vendre, mots-cles et canal."
          icon={Target}
        />
        <SimpleStep
          number="2"
          title="Lance Agent 1"
          text="Il cherche les prospects sur le web et ramene la premiere liste."
          icon={Search}
        />
        <SimpleStep
          number="3"
          title="Lance Agent 2"
          text="Il qualifie, score et decide: contacter, CRM seul ou ignorer."
          icon={ShieldCheck}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <AgentCard
          index={1}
          icon={Search}
          color="gold"
          ready={agents.find((item) => item.id === "discovery")?.ready ?? true}
          provider={agents.find((item) => item.id === "discovery")?.provider ?? "serper"}
          title={config.discovery.name}
          role="Trouve les prospects"
          mission={config.discovery.bootstrap}
          inputText={`${config.discovery.source} · ${config.discovery.keywords}`}
          outputText="Liste de prospects a analyser"
          running={running === "discovery"}
          disabled={Boolean(running)}
          onConfigure={() => {
            setEditorTab("mission");
            setEditingAgent("discovery");
          }}
          onLaunch={() => void launch("discovery")}
          launchLabel="Lancer Agent 1"
        />
        <AgentCard
          index={2}
          icon={ShieldCheck}
          color="emerald"
          ready={agents.find((item) => item.id === "qualification")?.ready ?? true}
          provider={agents.find((item) => item.id === "qualification")?.provider ?? "tavily"}
          title={config.qualification.name}
          role="Qualifie et decide"
          mission={config.qualification.bootstrap}
          inputText={`Score auto ${config.qualification.autoContactScore} · CRM ${config.qualification.crmOnlyScore}`}
          outputText="Contact auto, CRM seul ou ignore"
          running={running === "qualification"}
          disabled={Boolean(running) || !canRunQualification}
          helper={!canRunQualification ? "Lance Agent 1 avant Agent 2." : undefined}
          onConfigure={() => {
            setEditorTab("mission");
            setEditingAgent("qualification");
          }}
          onLaunch={() => void launch("qualification")}
          launchLabel="Lancer Agent 2"
        />
      </section>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Brief simple a donner aux agents</h2>
            <p className="mt-1 text-sm text-muted">
              Tu remplis seulement l'essentiel. Les agents construisent ensuite leur travail a partir de ce brief.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void launch("all")}
            disabled={Boolean(running)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-4 text-sm font-semibold text-black disabled:opacity-60"
          >
            {running === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Lancer les 2 agents
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <GuidedField
            label="Secteur cible"
            help="Qui veux-tu viser ?"
            value={form.sector}
            onChange={(value) => setForm((current) => ({ ...current, sector: value }))}
          />
          <GuidedField
            label="Zone geographique"
            help="Dans quels pays ou regions ?"
            value={form.location}
            onChange={(value) => setForm((current) => ({ ...current, location: value }))}
          />
          <GuidedField
            label="Service a vendre"
            help="Qu'est-ce qu'on veut proposer au prospect ?"
            value={form.service}
            onChange={(value) => setForm((current) => ({ ...current, service: value }))}
          />
          <GuidedField
            label="Mots-cles"
            help="Les mots ou signaux que les agents vont chercher sur le web."
            value={form.keywords}
            onChange={(value) => setForm((current) => ({ ...current, keywords: value }))}
          />
          <SelectField
            label="Canal autorise"
            value={form.channel}
            onChange={(value) => setForm((current) => ({ ...current, channel: value as SourcingChannel }))}
            options={[
              { value: "email_whatsapp", label: "Email + WhatsApp" },
              { value: "email", label: "Email seulement" },
              { value: "whatsapp", label: "WhatsApp seulement" },
              { value: "crm_only", label: "CRM seulement" }
            ]}
          />
          <GuidedField
            label="Nombre de prospects"
            help="Combien de pistes Agent 1 doit chercher avant qualification."
            value={form.limit}
            onChange={(value) => setForm((current) => ({ ...current, limit: value }))}
          />
        </div>

        <div className="mt-5 rounded-lg border border-line bg-ink p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Resume envoye aux agents</p>
          <p className="mt-3 text-sm text-zinc-100">{generatedObjective}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip icon={Mail} text={channelLabel(form.channel)} />
            <Chip icon={Sparkles} text={form.tone} />
            <Chip icon={Radar} text={`${form.limit} prospects max`} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  sector: preset.sector,
                  location: preset.location,
                  service: preset.service,
                  keywords: preset.keywords
                }))
              }
              className="rounded-full border border-line bg-ink px-3 py-2 text-sm text-zinc-200 hover:border-gold/60"
            >
              Scenario {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Prospects trouves" value={String(stats.total)} />
        <StatCard label="Contact auto" value={String(stats.auto)} />
        <StatCard label="CRM seul" value={String(stats.crmOnly)} />
        <StatCard label="Ignores" value={String(stats.ignored)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
        <div className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Resultat du run actif</h2>
              <p className="mt-1 text-sm text-muted">
                C'est ici que tu vois ce que les agents ont trouve et decide.
              </p>
            </div>
            {activeRun ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(activeRun.status)}`}>
                {labelRunStatus(activeRun.status)}
              </span>
            ) : null}
          </div>

          {!activeRun && !loading ? (
            <EmptyState
              icon={Radar}
              title="Aucun run pour le moment"
              text="Remplis le brief puis lance Agent 1 ou les 2 agents."
            />
          ) : null}

          {loading ? (
            <EmptyState icon={Loader2} title="Chargement" text="Je recupere l'historique sourcing." spinning />
          ) : null}

          {activeRun ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-lg border border-line bg-ink p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Mission de ce run</p>
                <p className="mt-3 text-sm text-zinc-100">{activeRun.objective}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Prospects</h3>
                <div className="mt-3 space-y-3">
                  {activeRun.prospects.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="Pas encore de prospects"
                      text="Le run est vide ou encore en cours."
                    />
                  ) : (
                    activeRun.prospects.map((prospect) => (
                      <div key={prospect.id} className="rounded-lg border border-line bg-ink p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-100">{prospect.company || prospect.name}</p>
                            <p className="mt-1 text-sm text-muted">
                              {prospect.country} · score {prospect.score}/100
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${decisionClass(prospect.decision)}`}>
                            {decisionLabel(prospect.decision)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-zinc-300">{prospect.snippet}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                          {prospect.email ? <Chip icon={Mail} text={prospect.email} /> : null}
                          {prospect.whatsapp ? <Chip icon={MessageCircle} text={prospect.whatsapp} /> : null}
                          {prospect.website ? <Chip icon={Radar} text={prospect.website} /> : null}
                        </div>
                        {prospect.reasons.length > 0 ? (
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                            {prospect.reasons.slice(0, 3).map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-xl font-semibold">Actions prises</h2>
            <div className="mt-4 space-y-3">
              {!activeRun?.actions.length ? (
                <EmptyState icon={Mail} title="Aucune action" text="Les actions email, WhatsApp ou CRM apparaitront ici." />
              ) : (
                activeRun.actions.map((action, index) => <ActionRow key={`${action.prospectId}-${action.channel}-${index}`} action={action} />)
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-xl font-semibold">Journal agent</h2>
            <div className="mt-4 space-y-3">
              {!activeRun?.logs.length ? (
                <EmptyState icon={Brain} title="Aucun log" text="Les etapes de travail des agents apparaitront ici." />
              ) : (
                activeRun.logs.map((log, index) => <LogRow key={`${log.step}-${index}`} log={log} />)
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-xl font-semibold">Liste STOP</h2>
            <p className="mt-1 text-sm text-muted">
              Ajoute ici un email ou un numero a ne plus contacter.
            </p>
            <div className="mt-4 space-y-3">
              <SelectField
                label="Canal"
                value={optOutChannel}
                onChange={(value) => setOptOutChannel(value as "email" | "whatsapp")}
                options={[
                  { value: "email", label: "Email" },
                  { value: "whatsapp", label: "WhatsApp" }
                ]}
              />
              <GuidedField
                label="Adresse ou numero"
                help="Exemple: contact@entreprise.com ou +2250700000000"
                value={optOutValue}
                onChange={setOptOutValue}
              />
              <button
                type="button"
                onClick={() => void saveOptOut()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-4 text-sm font-semibold text-zinc-100"
              >
                <Save className="h-4 w-4" />
                Ajouter a STOP
              </button>
            </div>
          </section>
        </div>
      </section>

      {editingAgent ? (
        <AgentEditorModal
          type={editingAgent}
          config={config}
          tab={editorTab}
          saving={saving}
          onTabChange={setEditorTab}
          onChange={setConfig}
          onClose={() => setEditingAgent(null)}
          onSave={() => void saveConfig()}
        />
      ) : null}
    </div>
  );
}

function Notice({ tone, text }: { tone: "error" | "success"; text: string }) {
  const palette =
    tone === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-200"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";

  return <div className={`rounded-lg border p-4 text-sm ${palette}`}>{text}</div>;
}

function SimpleStep({
  number,
  title,
  text,
  icon: Icon
}: {
  number: string;
  title: string;
  text: string;
  icon: typeof Target;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-black text-black">{number}</div>
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <p className="mt-4 text-lg font-semibold text-zinc-100">{title}</p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  );
}

function AgentCard({
  index,
  icon: Icon,
  color,
  ready,
  provider,
  title,
  role,
  mission,
  inputText,
  outputText,
  running,
  disabled,
  helper,
  launchLabel,
  onConfigure,
  onLaunch
}: {
  index: number;
  icon: typeof Search;
  color: "gold" | "emerald";
  ready: boolean;
  provider: string;
  title: string;
  role: string;
  mission: string;
  inputText: string;
  outputText: string;
  running: boolean;
  disabled: boolean;
  helper?: string;
  launchLabel: string;
  onConfigure: () => void;
  onLaunch: () => void;
}) {
  const palette =
    color === "gold"
      ? "border-gold/40 bg-gold/10 text-gold"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  const launchPalette = color === "gold" ? "bg-gold text-black" : "bg-emerald-400 text-black";

  return (
    <article className="rounded-lg border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-md border ${palette}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Agent {index}</p>
            <h2 className="mt-1 text-xl font-bold text-zinc-100">{title}</h2>
            <p className="mt-1 text-sm text-muted">{role}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            ready ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-200"
          }`}
        >
          {ready ? "Pret" : "Cle requise"}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <InfoBlock label="Mission" value={mission} />
        <InfoBlock label="Entrees" value={inputText} />
        <InfoBlock label="Sortie" value={outputText} />
        <InfoBlock label="Moteur" value={provider} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-4 text-sm font-semibold text-zinc-100"
        >
          <Settings2 className="h-4 w-4" />
          Modifier
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={disabled}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:opacity-50 ${launchPalette}`}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {launchLabel}
        </button>
      </div>

      {helper ? <p className="mt-3 text-xs text-muted">{helper}</p> : null}
    </article>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-zinc-100">{value}</p>
    </div>
  );
}

function GuidedField({
  label,
  help,
  value,
  onChange
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 rounded-lg border border-line bg-ink p-4 text-sm">
      <span className="font-semibold text-zinc-100">{label}</span>
      <span className="text-xs text-muted">{help}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-black/30 px-3 text-zinc-100 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2 rounded-lg border border-line bg-ink p-4 text-sm">
      <span className="font-semibold text-zinc-100">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-black/30 px-3 text-zinc-100 outline-none focus:border-gold/70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  spinning = false
}: {
  icon: typeof Radar;
  title: string;
  text: string;
  spinning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-ink/60 p-5">
      <Icon className={`h-5 w-5 text-gold ${spinning ? "animate-spin" : ""}`} />
      <p className="mt-3 font-semibold text-zinc-100">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

function Chip({ icon: Icon, text }: { icon: typeof Mail; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-ink px-2.5 py-1 text-xs text-zinc-300">
      <Icon className="h-3.5 w-3.5 text-gold" />
      {text}
    </span>
  );
}

function ActionRow({ action }: { action: SourcingAction }) {
  const Icon = action.status === "completed" ? CheckCircle2 : AlertTriangle;
  const color = action.status === "completed" ? "text-emerald-300" : "text-gold";

  return (
    <div className="rounded-lg border border-line bg-ink p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-semibold capitalize text-zinc-100">{action.channel}</span>
        <span className="text-xs text-muted">{action.status}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">{action.message}</p>
    </div>
  );
}

function LogRow({ log }: { log: SourcingLog }) {
  return (
    <div className="rounded-lg border border-line bg-ink p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-100">{log.step}</span>
        <span className="text-xs text-muted">{new Date(log.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">{log.message}</p>
    </div>
  );
}

function AgentEditorModal({
  type,
  config,
  tab,
  saving,
  onTabChange,
  onChange,
  onClose,
  onSave
}: {
  type: "discovery" | "qualification";
  config: SourcingAgentsConfig;
  tab: "mission" | "brain";
  saving: boolean;
  onTabChange: (tab: "mission" | "brain") => void;
  onChange: (value: SourcingAgentsConfig) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isDiscovery = type === "discovery";
  const agent = isDiscovery ? config.discovery : config.qualification;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg border border-line bg-[#060b16] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line bg-[#080d19] px-6 py-4">
          <h2 className="flex items-center gap-3 text-xl font-bold text-zinc-100">
            {isDiscovery ? <Search className="h-5 w-5 text-gold" /> : <ShieldCheck className="h-5 w-5 text-emerald-300" />}
            Configurer {agent.name}
          </h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-line bg-zinc-400/70 text-sm font-semibold">
          <button
            type="button"
            onClick={() => onTabChange("mission")}
            className={`flex h-12 items-center justify-center gap-2 ${tab === "mission" ? "border-b-2 border-indigo-500 text-white" : "text-zinc-300"}`}
          >
            <Target className="h-4 w-4" />
            Mission
          </button>
          <button
            type="button"
            onClick={() => onTabChange("brain")}
            className={`flex h-12 items-center justify-center gap-2 ${tab === "brain" ? "border-b-2 border-indigo-500 text-white" : "text-zinc-300"}`}
          >
            <Brain className="h-4 w-4" />
            Cerveau
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          {tab === "mission" ? (
            <div className="space-y-4">
              {isDiscovery ? (
                <>
                  <GuidedField
                    label="Source de recherche"
                    help="Ou Agent 1 va chercher."
                    value={config.discovery.source}
                    onChange={(value) => onChange({ ...config, discovery: { ...config.discovery, source: value } })}
                  />
                  <GuidedField
                    label="Mots-cles"
                    help="Les recherches principales a faire."
                    value={config.discovery.keywords}
                    onChange={(value) => onChange({ ...config, discovery: { ...config.discovery, keywords: value } })}
                  />
                  <GuidedField
                    label="Nombre max de prospects"
                    help="Combien de pistes Agent 1 remonte."
                    value={String(config.discovery.limit)}
                    onChange={(value) => onChange({ ...config, discovery: { ...config.discovery, limit: Number(value) || 1 } })}
                  />
                </>
              ) : (
                <>
                  <GuidedField
                    label="Regles de qualification"
                    help="Comment Agent 2 reconnait un bon prospect."
                    value={config.qualification.rules}
                    onChange={(value) => onChange({ ...config, qualification: { ...config.qualification, rules: value } })}
                  />
                  <GuidedField
                    label="Score contact auto"
                    help="A partir de quel score on contacte directement."
                    value={String(config.qualification.autoContactScore)}
                    onChange={(value) =>
                      onChange({ ...config, qualification: { ...config.qualification, autoContactScore: Number(value) || 0 } })
                    }
                  />
                  <GuidedField
                    label="Score CRM seulement"
                    help="A partir de quel score on garde seulement en CRM."
                    value={String(config.qualification.crmOnlyScore)}
                    onChange={(value) =>
                      onChange({ ...config, qualification: { ...config.qualification, crmOnlyScore: Number(value) || 0 } })
                    }
                  />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <GuidedField
                label="Nom de l'agent"
                help="Nom visible sur la page."
                value={agent.name}
                onChange={(value) =>
                  onChange(
                    isDiscovery
                      ? { ...config, discovery: { ...config.discovery, name: value } }
                      : { ...config, qualification: { ...config.qualification, name: value } }
                  )
                }
              />
              <GuidedField
                label="Bootstrap"
                help="Instruction principale de travail."
                value={agent.bootstrap}
                onChange={(value) =>
                  onChange(
                    isDiscovery
                      ? { ...config, discovery: { ...config.discovery, bootstrap: value } }
                      : { ...config, qualification: { ...config.qualification, bootstrap: value } }
                  )
                }
              />
              <GuidedField
                label="Personnalite"
                help="Style de travail de l'agent."
                value={agent.soul}
                onChange={(value) =>
                  onChange(
                    isDiscovery
                      ? { ...config, discovery: { ...config.discovery, soul: value } }
                      : { ...config, qualification: { ...config.qualification, soul: value } }
                  )
                }
              />
              <GuidedField
                label="Identite"
                help="Comment l'agent se decrit lui-meme."
                value={agent.identity}
                onChange={(value) =>
                  onChange(
                    isDiscovery
                      ? { ...config, discovery: { ...config.discovery, identity: value } }
                      : { ...config, qualification: { ...config.qualification, identity: value } }
                  )
                }
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line bg-zinc-400/70 px-6 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-md bg-[#020817] px-5 text-sm font-semibold text-white">
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-500 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder
          </button>
        </div>
      </section>
    </div>
  );
}

function statusClass(status: SourcingRun["status"]) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300";
  if (status === "running") return "bg-gold/15 text-gold";
  if (status === "partial") return "bg-amber-500/15 text-amber-200";
  return "bg-red-500/15 text-red-200";
}

function labelRunStatus(status: SourcingRun["status"]) {
  if (status === "completed") return "Termine";
  if (status === "running") return "En cours";
  if (status === "partial") return "Partiel";
  return "Echec";
}

function decisionClass(decision: SourcingProspect["decision"]) {
  if (decision === "contact_auto") return "bg-emerald-500/15 text-emerald-300";
  if (decision === "crm_only") return "bg-gold/15 text-gold";
  return "bg-red-500/15 text-red-200";
}

function decisionLabel(decision: SourcingProspect["decision"]) {
  if (decision === "contact_auto") return "Contact auto";
  if (decision === "crm_only") return "CRM seul";
  return "Ignore";
}
