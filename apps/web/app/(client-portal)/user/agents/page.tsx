"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  Brain,
  Loader2,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Wand2,
  X
} from "lucide-react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import type { SaasAgentProfile, SaasSourcingRun, SourcingMissionConfig } from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();


type AgentsPayload = {
  agents: SaasAgentProfile[];
};

type WorkspacePayload = {
  runs: SaasSourcingRun[];
  stats: {
    total: number;
    completed: number;
    prospectsFound: number;
  };
  providers: {
    serper: { configured: boolean };
    tavily: { configured: boolean };
  };
};

type FormState = {
  displayName: string;
  isEnabled: boolean;
  systemPrompt: string;
  personality: string;
  identity: string;
  userContext: string;
  tone: string;
  requireApproval: boolean;
  missionConfig: SourcingMissionConfig;
};

function buildForm(agent: SaasAgentProfile): FormState {
  return {
    displayName: agent.displayName,
    isEnabled: agent.isEnabled,
    systemPrompt: agent.systemPrompt || "",
    personality: agent.personality || "",
    identity: agent.identity || "",
    userContext: agent.userContext || "",
    tone: agent.tone || "",
    requireApproval: agent.requireApproval,
    missionConfig: {
      source: agent.missionConfig?.source || "serper",
      keywords: agent.missionConfig?.keywords || "",
      qualificationInstructions: agent.missionConfig?.qualificationInstructions || "",
      enrollmentMode: "none",
      defaultSector: agent.missionConfig?.defaultSector || "",
      defaultZone: agent.missionConfig?.defaultZone || "",
      defaultTargetCount: agent.missionConfig?.defaultTargetCount || 6
    }
  };
}

export default function UserAgentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [agents, setAgents] = useState<SaasAgentProfile[]>([]);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [selectedAgentKey, setSelectedAgentKey] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"mission" | "brain">("mission");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [agentsResponse, workspaceResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/sourcing/agents`, {
            cache: "no-store",
            credentials: "include"
          }),
          fetch(`${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/workspace`, {
            cache: "no-store",
            credentials: "include"
          })
        ]);
        if (!agentsResponse.ok) throw new Error("Impossible de charger les agents de sourcing.");
        if (!workspaceResponse.ok) throw new Error("Impossible de charger l'activite de sourcing.");

        const agentsData = (await agentsResponse.json()) as AgentsPayload;
        const workspaceData = (await workspaceResponse.json()) as WorkspacePayload;
        if (!active) return;

        const sourcingAgents = agentsData.agents
          .filter((item) => item.moduleKey === "sourcing-commercial")
          .sort((left, right) => agentRank(left.agentKey) - agentRank(right.agentKey));

        setAgents(sourcingAgents);
        setWorkspace(workspaceData);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Impossible de charger les agents de sourcing.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((item) => item.agentKey === selectedAgentKey) ?? null,
    [agents, selectedAgentKey]
  );

  const missionReady = useMemo(() => {
    if (!form) return false;
    return Boolean(
      form.missionConfig.keywords.trim() &&
        form.missionConfig.qualificationInstructions.trim() &&
        form.missionConfig.defaultSector.trim() &&
        form.missionConfig.defaultZone.trim()
    );
  }, [form]);

  const brainReady = useMemo(() => {
    if (!form) return false;
    return Boolean(form.systemPrompt.trim() && form.identity.trim());
  }, [form]);

  const liveFeed = useMemo(
    () =>
      (workspace?.runs ?? [])
        .slice()
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 6),
    [workspace]
  );

  async function saveAgent() {
    if (!selectedAgent || !form) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetch(`${apiBaseUrl}/api/sourcing/agents/${selectedAgent.agentKey}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; agent?: SaasAgentProfile };
      if (!response.ok || !data.ok || !data.agent) throw new Error(data.error ?? "Impossible d'enregistrer l'agent.");

      setAgents((current) =>
        current
          .map((item) => (item.agentKey === data.agent!.agentKey ? data.agent! : item))
          .sort((left, right) => agentRank(left.agentKey) - agentRank(right.agentKey))
      );
      setForm(buildForm(data.agent));
      setSuccess(`Les reglages de ${data.agent.displayName} ont bien ete enregistres.`);
      setModalOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer l'agent.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAgent(agent: SaasAgentProfile) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetch(`${apiBaseUrl}/api/sourcing/agents/${agent.agentKey}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !agent.isEnabled })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; agent?: SaasAgentProfile };
      if (!response.ok || !data.ok || !data.agent) throw new Error(data.error ?? "Impossible de mettre a jour l'agent.");

      setAgents((current) =>
        current
          .map((item) => (item.agentKey === data.agent!.agentKey ? data.agent! : item))
          .sort((left, right) => agentRank(left.agentKey) - agentRank(right.agentKey))
      );
      setSuccess(`${data.agent.displayName} est maintenant ${data.agent.isEnabled ? "actif" : "en pause"}.`);
      if (selectedAgentKey === data.agent.agentKey) {
        setForm(buildForm(data.agent));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de mettre a jour l'agent.");
    } finally {
      setSaving(false);
    }
  }

  function openAgent(agent: SaasAgentProfile) {
    setSelectedAgentKey(agent.agentKey);
    setForm(buildForm(agent));
    setActiveTab("mission");
    setModalOpen(true);
  }


  return (
    <SaasPortalShell
      title="Agents"
      subtitle="Tu as maintenant deux agents distincts: Serper pour la recherche rapide, Tavily pour l'analyse et la qualification."
    >
      <div className="space-y-6">
        {loading ? (
          <section className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-line bg-panel">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-line bg-panel p-6">
              <p className="text-sm text-gold">Centre de commandement</p>
              <h2 className="mt-2 text-2xl font-bold">Agents de Sourcing</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                Chaque agent rend un service different. Serper ouvre le terrain et trouve des pistes. Tavily lit mieux les pages,
                enrichit les resultats et aide a mieux qualifier.
              </p>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agentKey}
                  agent={agent}
                  runs={workspace?.runs ?? []}
                  providers={workspace?.providers ?? null}
                  busy={saving}
                  onConfigure={() => openAgent(agent)}
                  onToggle={() => void toggleAgent(agent)}
                />
              ))}
            </section>

            <section className="rounded-3xl border border-line bg-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gold">Flux live</p>
                  <h3 className="mt-2 text-2xl font-bold">Activite recente des agents</h3>
                </div>
                <Link href="/user/history" className="text-sm font-medium text-gold hover:text-gold/80">
                  Voir tout
                </Link>
              </div>

              {liveFeed.length ? (
                <div className="mt-5 space-y-3">
                  {liveFeed.map((run) => (
                    <div key={run.id} className="rounded-2xl border border-line bg-ink p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-zinc-100">{run.agentName}</p>
                          <p className="mt-1 text-sm leading-6 text-muted">{run.objective || run.brief}</p>
                        </div>
                        <div className="text-sm text-zinc-300">
                          {run.foundCount} prospect(s) • {run.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-line bg-ink px-4 py-5">
                  <p className="font-medium text-zinc-100">Aucune activite recente</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Le flux live se remplira apres les prochains runs de Serper et Tavily.
                  </p>
                </div>
              )}
            </section>

            {!agents.length ? (
              <section className="rounded-3xl border border-line bg-panel p-6">
                <p className="font-medium text-zinc-100">Aucun agent de sourcing disponible</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Le profil d'agent n'a pas encore ete initialise pour ce compte utilisateur.
                </p>
              </section>
            ) : null}
          </>
        )}

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div> : null}

        {modalOpen && selectedAgent && form ? (
          <div className="fixed inset-0 z-50 bg-black/70 px-4 py-8">
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div>
                  <p className="text-sm text-gold">Configurer l'agent</p>
                  <h3 className="mt-1 text-2xl font-bold">{selectedAgent.displayName}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-zinc-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="border-b border-line px-6 py-3">
                <div className="flex gap-3">
                  <TabButton active={activeTab === "mission"} onClick={() => setActiveTab("mission")} icon={Target} label="Mission" />
                  <TabButton active={activeTab === "brain"} onClick={() => setActiveTab("brain")} icon={Brain} label="Cerveau de l'Agent" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                {activeTab === "mission" ? (
                  <div className="space-y-6">
                    <InfoBlock
                      title="Source verrouillee"
                      text={`Cet agent travaille uniquement avec ${labelForSource(form.missionConfig.source)}.`}
                    />

                    <TextField
                      label="Mots-cles de recherche"
                      placeholder="ex: cliniques privees, site web, Abidjan"
                      value={form.missionConfig.keywords}
                      onChange={(value) =>
                        setForm({ ...form, missionConfig: { ...form.missionConfig, keywords: value } })
                      }
                    />

                    <TextareaField
                      label="Instructions de qualification"
                      placeholder="Decris comment cet agent reconnait un bon prospect..."
                      value={form.missionConfig.qualificationInstructions}
                      onChange={(value) =>
                        setForm({
                          ...form,
                          missionConfig: { ...form.missionConfig, qualificationInstructions: value }
                        })
                      }
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <TextField
                        label="Secteur par defaut"
                        placeholder="ex: Sante"
                        value={form.missionConfig.defaultSector}
                        onChange={(value) =>
                          setForm({ ...form, missionConfig: { ...form.missionConfig, defaultSector: value } })
                        }
                      />
                      <TextField
                        label="Zone par defaut"
                        placeholder="ex: Abidjan"
                        value={form.missionConfig.defaultZone}
                        onChange={(value) =>
                          setForm({ ...form, missionConfig: { ...form.missionConfig, defaultZone: value } })
                        }
                      />
                      <TextField
                        label="Nombre vise"
                        placeholder="6"
                        value={String(form.missionConfig.defaultTargetCount)}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            missionConfig: {
                              ...form.missionConfig,
                              defaultTargetCount: Math.min(Math.max(Number(value || 6), 1), 10)
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField
                        label="Nom de l'agent"
                        value={form.displayName}
                        onChange={(value) => setForm({ ...form, displayName: value })}
                      />
                      <div className="rounded-2xl border border-line bg-ink p-4">
                        <p className="text-sm font-semibold text-zinc-100">Etat de l'agent</p>
                        <p className="mt-1 text-xs leading-6 text-muted">
                          Coupe l'agent ici si tu veux bloquer les lancements depuis la page sourcing.
                        </p>
                        <div className="mt-4 flex items-center justify-between gap-4">
                          <span className={`rounded-full px-3 py-1 text-xs ${form.isEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                            {form.isEnabled ? "Actif" : "En pause"}
                          </span>
                          <Toggle checked={form.isEnabled} onChange={(checked) => setForm({ ...form, isEnabled: checked })} />
                        </div>
                      </div>

                    </div>

                    <TextareaField
                      label="BOOTSTRAP"
                      icon={BookOpen}
                      placeholder="Instructions de base..."
                      value={form.systemPrompt}
                      onChange={(value) => setForm({ ...form, systemPrompt: value })}
                    />
                    <TextareaField
                      label="SOUL"
                      icon={Sparkles}
                      placeholder="Style, ton, attitude..."
                      value={form.personality}
                      onChange={(value) => setForm({ ...form, personality: value })}
                    />
                    <TextareaField
                      label="IDENTITY"
                      icon={User}
                      placeholder="Role, expertise, posture..."
                      value={form.identity}
                      onChange={(value) => setForm({ ...form, identity: value })}
                    />
                    <TextareaField
                      label="USER CONTEXT"
                      icon={Bot}
                      placeholder="Contexte business, cible, priorites..."
                      value={form.userContext}
                      onChange={(value) => setForm({ ...form, userContext: value })}
                    />

                    <TextField
                      label="Ton de reponse"
                      value={form.tone}
                      onChange={(value) => setForm({ ...form, tone: value })}
                    />

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                            <ShieldCheck className="h-4 w-4" />
                            Validation humaine
                          </p>
                          <p className="mt-1 text-xs leading-6 text-amber-100/80">
                            Si activee, l'agent prepare le sourcing mais garde la main humaine sur les suites sensibles.
                          </p>
                        </div>
                        <Toggle checked={form.requireApproval} onChange={(checked) => setForm({ ...form, requireApproval: checked })} />
                      </div>
                    </div>


                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-11 items-center rounded-2xl border border-line px-4 text-sm font-medium text-zinc-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void saveAgent()}
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gold px-4 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  Enregistrer les parametres
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SaasPortalShell>
  );
}

function AgentCard({
  agent,
  runs,
  providers,
  busy,
  onConfigure,
  onToggle
}: {
  agent: SaasAgentProfile;
  runs: SaasSourcingRun[];
  providers: WorkspacePayload["providers"] | null;
  busy: boolean;
  onConfigure: () => void;
  onToggle: () => void;
}) {
  const agentRuns = runs.filter((run) => run.agentKey === agent.agentKey);
  const prospects = agentRuns.reduce((sum, run) => sum + run.foundCount, 0);
  const completed = agentRuns.filter((run) => run.status === "completed").length;
  const sourceLabel = labelForSource(agent.missionConfig.source);
  const sourceReady = agent.missionConfig.source === "serper" ? providers?.serper.configured : providers?.tavily.configured;
  const lastRun = agentRuns[0] ?? null;
  const averageProspects = completed ? Math.round(prospects / completed) : 0;

  return (
    <article className="rounded-[28px] border border-line bg-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-5">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${agentCardTint(agent.agentKey)}`}>
            <Search className="h-7 w-7 text-indigo-200" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[2rem] font-bold leading-tight text-white">{agent.displayName}</h3>
            <p className="mt-2 max-w-xl text-sm leading-7 text-muted">{agentDescription(agent.agentKey)}</p>
          </div>
        </div>

        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
          agent.isEnabled ? (sourceReady ? "bg-indigo-500 text-white" : "bg-zinc-700 text-zinc-200") : "bg-amber-500/20 text-amber-200"
        }`}>
          {agent.isEnabled ? (sourceReady ? "En ligne" : "A configurer") : "En pause"}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Source" value={sourceLabel} />
        <MetricCard label="Prospects" value={String(prospects)} />
        <MetricCard label="Runs" value={String(completed)} />
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-ink px-4 py-4 text-sm text-zinc-200">
        <p className="font-semibold text-zinc-100">KW: {agent.missionConfig.keywords.trim() || "N/A"}</p>
        <p className="mt-2">SRC: {sourceLabel}</p>
        <p className="mt-2">Moyenne: {averageProspects} prospect(s) par run</p>
        <p className="mt-2">Derniere activite: {lastRun ? new Date(lastRun.createdAt).toLocaleString("fr-FR") : "Aucune"}</p>
      </div>

      <div className="mt-4 flex gap-3">
        <Link
          href={`/user/sourcing?agent=${agent.agentKey}`}
          className={`inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line px-4 text-sm font-semibold ${
            agent.isEnabled ? "bg-ink text-white hover:border-gold/40" : "pointer-events-none bg-zinc-900 text-zinc-500"
          }`}
        >
          <Play className="h-4 w-4" />
          Lancer avec {sourceLabel}
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={onToggle}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 hover:border-gold/40 disabled:opacity-60"
        >
          <Pause className="h-4 w-4" />
          {agent.isEnabled ? "Pause" : "Reprendre"}
        </button>
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-zinc-800 text-zinc-100 hover:border-gold/40"
        >
          <Wand2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink p-4 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Target;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-medium ${
        active ? "bg-gold/10 text-gold" : "bg-ink text-zinc-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Label({
  text,
  icon: Icon
}: {
  text: string;
  icon?: typeof Search;
}) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
      {Icon ? <Icon className="h-4 w-4 text-gold" /> : null}
      {text}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-zinc-300">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-line bg-ink px-4 outline-none transition focus:border-gold/60"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  icon
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: typeof Search;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <Label text={label} icon={icon} />
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[120px] rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-gold/60"
      />
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${checked ? "bg-gold" : "bg-zinc-700"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink p-4">
      <p className="font-semibold text-zinc-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}

function agentRank(agentKey: string) {
  if (agentKey === "sourcing-serper") return 0;
  if (agentKey === "sourcing-tavily") return 1;
  return 2;
}

function labelForSource(source: SourcingMissionConfig["source"]) {
  return source === "tavily" ? "Tavily" : "Serper";
}

function agentDescription(agentKey: string) {
  if (agentKey === "sourcing-tavily") {
    return "Analyse les pages trouvees, extrait les signaux utiles et aide a mieux qualifier les prospects.";
  }
  return "Cherche rapidement des entreprises, annuaires et pistes web pour lancer une premiere liste de prospects.";
}

function agentCardTint(agentKey: string) {
  if (agentKey === "sourcing-tavily") return "bg-violet-500/12";
  return "bg-indigo-500/12";
}
