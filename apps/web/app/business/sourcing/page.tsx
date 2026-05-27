"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Edit2,
  Loader2,
  MapPin,
  Pause,
  Phone,
  Play,
  Plus,
  Radar,
  Save,
  Search,
  Smartphone,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap
} from "lucide-react";
import {
  formatDate,
  formatMoney,
  statusBadgeClass,
  subscriptionStatusLabel,
  type SourcingGlobalAgent,
  type SourcingPlan,
  type SourcingSubscriber
} from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

// ─── Types locaux ──────────────────────────────────────────────────────────

type AdminAgent = {
  id: string;
  companyId: string;
  agentKey: string;
  displayName: string;
  isEnabled: boolean;
  missionConfig: { source: "serper" | "tavily"; keywords: string };
  updatedAt: string;
};

type WorkspaceItem = {
  companyId: string;
  companyName: string;
  ownerEmail: string;
  usersCount: number;
  subscriptionStatus: string;
  totalRuns: number;
  totalProspects: number;
  lastRunAt: string | null;
  agents: AdminAgent[];
};

type RecentRun = {
  id: string;
  companyName: string;
  agentName: string;
  foundCount: number;
  objective: string;
  sector: string;
  zone: string;
  createdAt: string;
};

type OverviewPayload = {
  stats: { workspaces: number; activeAgents: number; pausedAgents: number; runs: number; prospects: number };
  workspaces: WorkspaceItem[];
  recentRuns: RecentRun[];
};

type ApiProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  budget: string;
  models: string[];
  apiKeyConfigured: boolean;
  apiKeySource: "database" | "env" | "none";
  apiKey?: string;
  clearApiKey?: boolean;
  isReplacingKey?: boolean;
  status?: "idle" | "loading" | "ok" | "error";
  message?: string;
  modelStatus?: "idle" | "loading" | "ok" | "error";
  modelMessage?: string;
  chatStatus?: "idle" | "loading" | "ok" | "error";
  chatMessage?: string;
};

type ApiSettingsTabKey = "providers" | "search";

const SEARCH_PROVIDER_IDS = new Set(["serper", "tavily"]);
const CHAT_PROVIDER_IDS = new Set(["groq", "openai", "claude", "gemini", "glm", "kimi-k2", "qwen", "nvidia-nim"]);

function normalizeProvider(provider: ApiProviderConfig): ApiProviderConfig {
  return {
    ...provider,
    apiKey: "",
    clearApiKey: false,
    isReplacingKey: false,
    status: "idle",
    message: undefined,
    modelStatus: "idle",
    modelMessage: undefined,
    chatStatus: "idle",
    chatMessage: undefined
  };
}

function toProviderPayload(provider: ApiProviderConfig) {
  const typedApiKey = provider.apiKey?.trim();
  return {
    id: provider.id,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    enabled: provider.enabled,
    budget: provider.budget,
    models: provider.models,
    ...(typedApiKey ? { apiKey: typedApiKey } : {}),
    ...(provider.clearApiKey ? { clearApiKey: true } : {})
  };
}

function isChatProvider(provider: ApiProviderConfig) {
  return CHAT_PROVIDER_IDS.has(provider.id);
}

function isSearchProvider(provider: ApiProviderConfig) {
  return SEARCH_PROVIDER_IDS.has(provider.id);
}

// ─── Onglets ───────────────────────────────────────────────────────────────

type Tab = "overview" | "plans" | "agents" | "api-settings" | "subscribers" | "analytics" | "payments";

const TABS: { key: Tab; label: string; icon: typeof Radar }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: TrendingUp },
  { key: "plans", label: "Plans & Tarifs", icon: Zap },
  { key: "agents", label: "Agents Globaux", icon: Radar },
  { key: "api-settings", label: "Parametres API", icon: Search },
  { key: "subscribers", label: "Abonnes", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart2 },
  { key: "payments", label: "Paiements", icon: CreditCard }
];

// ─── Composant principal ───────────────────────────────────────────────────

export default function SourcingBusinessPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [apiSettingsVersion, setApiSettingsVersion] = useState(0);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sourcing/admin/payments/requests`, { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; requests?: { status: string }[] }) => {
        if (d.ok && d.requests) {
          setPendingPaymentsCount(d.requests.filter((r) => r.status === "pending").length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* En-tete business */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-amber-950/40 via-panel to-panel p-6 xl:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-amber-500/5 blur-2xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
                Produit SaaS
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white xl:text-4xl">
              Sourcing Commercial
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Pilote ton produit sourcing comme un espace separe de ton projet personnel. Regle les agents globaux, les
              plans, les abonnes et les API depuis cette zone dediee.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("api-settings")}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-line bg-ink px-4 text-sm font-semibold text-zinc-200 transition hover:border-gold/40 hover:text-gold"
          >
            <Search className="h-4 w-4" />
            Parametres API
          </button>
        </div>

        {/* Barre d'onglets */}
        <div className="relative mt-7 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const showBadge = tab.key === "payments" && pendingPaymentsCount > 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive ? "bg-gold text-black shadow-lg shadow-gold/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {showBadge && (
                  <span className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-black ${
                    isActive ? "bg-black/20 text-black" : "bg-red-500 text-white"
                  }`}>
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "plans" && <PlansTab />}
      {activeTab === "agents" && <GlobalAgentsTab apiSettingsVersion={apiSettingsVersion} />}
      {activeTab === "api-settings" && <ApiSettingsTab onSaved={() => setApiSettingsVersion((value) => value + 1)} />}
      {activeTab === "subscribers" && <SubscribersTab />}
      {activeTab === "analytics" && <AnalyticsTab />}
      {activeTab === "payments" && <PaymentsTab />}
    </div>
  );
}

// ─── Onglet Vue d'ensemble ─────────────────────────────────────────────────

function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<OverviewPayload | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing`, { cache: "no-store", credentials: "include" });
        if (!r.ok) throw new Error("Impossible de charger la supervision sourcing.");
        const data = (await r.json()) as OverviewPayload;
        if (active) setPayload(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erreur.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function toggleAgent(companyId: string, agent: AdminAgent) {
    try {
      setSavingKey(`${companyId}:${agent.agentKey}`);
      setError("");
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/agents/${companyId}/${agent.agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isEnabled: !agent.isEnabled })
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; agent?: AdminAgent };
      if (!r.ok || !data.ok || !data.agent) throw new Error(data.error ?? "Erreur de mise a jour.");
      setPayload((cur) =>
        cur
          ? {
              ...cur,
              workspaces: cur.workspaces.map((w) =>
                w.companyId === companyId
                  ? { ...w, agents: w.agents.map((a) => (a.id === data.agent!.id ? data.agent! : a)) }
                  : w
              )
            }
          : cur
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSavingKey("");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-line bg-panel">
        <Loader2 className="h-7 w-7 animate-spin text-gold" />
      </div>
    );
  }

  const stats = payload?.stats ?? { workspaces: 0, activeAgents: 0, pausedAgents: 0, runs: 0, prospects: 0 };

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Comptes" value={String(stats.workspaces)} icon={Users} accent="gold" />
        <StatCard label="Agents actifs" value={String(stats.activeAgents)} icon={Radar} accent="emerald" />
        <StatCard label="En pause" value={String(stats.pausedAgents)} icon={Pause} accent="amber" />
        <StatCard label="Runs total" value={String(stats.runs)} icon={Play} accent="sky" />
        <StatCard label="Prospects" value={String(stats.prospects)} icon={Search} accent="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm font-semibold text-gold">Comptes sourcing</p>
          <div className="mt-4 space-y-4">
            {payload?.workspaces.length ? (
              payload.workspaces.map((ws) => (
                <article key={ws.companyId} className="rounded-2xl border border-line bg-ink p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-zinc-100">{ws.companyName}</p>
                      <p className="mt-1 text-sm text-zinc-500">{ws.ownerEmail}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {ws.usersCount} utilisateur(s) · {ws.totalRuns} run(s) · {ws.totalProspects} prospect(s)
                      </p>
                    </div>
                    <span className="rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">
                      {subscriptionStatusLabel(ws.subscriptionStatus as "active")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {ws.agents.map((agent) => (
                      <div key={agent.id} className="rounded-2xl border border-line bg-panel p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">{agent.displayName}</p>
                            <p className="mt-0.5 text-xs uppercase tracking-widest text-zinc-500">
                              {agent.missionConfig.source}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${agent.isEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                            {agent.isEnabled ? "Actif" : "Pause"}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleAgent(ws.companyId, agent)}
                            disabled={savingKey === `${ws.companyId}:${agent.agentKey}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-zinc-900 px-3 text-xs font-semibold text-zinc-100 hover:border-gold/40 disabled:opacity-50"
                          >
                            {agent.isEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            {savingKey === `${ws.companyId}:${agent.agentKey}` ? "..." : agent.isEnabled ? "Pause" : "Reprendre"}
                          </button>
                          <Link
                            href={`/sourcing-agents/${ws.companyId}`}
                            className="inline-flex h-9 items-center rounded-xl border border-line px-3 text-xs font-semibold text-zinc-100 hover:border-gold/40"
                          >
                            Ouvrir
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <EmptyState message="Aucun compte sourcing actif pour l'instant." />
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5">
          <p className="text-sm font-semibold text-gold">Flux live admin</p>
          <div className="mt-4 space-y-3">
            {payload?.recentRuns.length ? (
              payload.recentRuns.map((run) => (
                <article key={run.id} className="rounded-2xl border border-line bg-ink p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{run.agentName}</p>
                      <p className="text-xs text-zinc-500">{run.companyName}</p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-600">{new Date(run.createdAt).toLocaleString("fr-FR")}</span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-zinc-300">{run.objective}</p>
                  <p className="mt-2 text-xs text-zinc-500">{run.foundCount} prospect(s) · {run.sector} · {run.zone}</p>
                </article>
              ))
            ) : (
              <EmptyState message="Aucun run recent. Les utilisateurs n'ont pas encore lance de recherche." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Plans & Tarifs ─────────────────────────────────────────────────

type PlanForm = {
  name: string;
  description: string;
  monthlyPrice: string;
  maxRunsPerMonth: string;
  maxProspectsPerRun: string;
  agents: ("serper" | "tavily")[];
  isPopular: boolean;
};

const EMPTY_PLAN_FORM: PlanForm = {
  name: "",
  description: "",
  monthlyPrice: "",
  maxRunsPerMonth: "10",
  maxProspectsPerRun: "20",
  agents: ["serper", "tavily"],
  isPopular: false
};

function PlansTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [plans, setPlans] = useState<SourcingPlan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_PLAN_FORM);

  useEffect(() => {
    void loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans`, { cache: "no-store", credentials: "include" });
      const data = (await r.json()) as { ok: boolean; plans: SourcingPlan[] };
      if (data.ok) setPlans(data.plans);
    } catch {
      setError("Impossible de charger les plans.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_PLAN_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(plan: SourcingPlan) {
    setForm({
      name: plan.name,
      description: plan.description,
      monthlyPrice: String(plan.monthlyPrice),
      maxRunsPerMonth: String(plan.maxRunsPerMonth),
      maxProspectsPerRun: String(plan.maxProspectsPerRun),
      agents: plan.agents,
      isPopular: plan.isPopular
    });
    setEditingId(plan.id);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError("");
  }

  async function submitForm() {
    if (!form.name.trim()) { setError("Le nom du plan est requis."); return; }
    try {
      setSaving(true);
      setError("");
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        monthlyPrice: Number(form.monthlyPrice) || 0,
        maxRunsPerMonth: Number(form.maxRunsPerMonth) || 10,
        maxProspectsPerRun: Number(form.maxProspectsPerRun) || 20,
        agents: form.agents,
        isPopular: form.isPopular
      };

      if (editingId) {
        const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body)
        });
        const data = (await r.json()) as { ok: boolean; plan?: SourcingPlan; error?: string };
        if (!data.ok) throw new Error(data.error ?? "Erreur.");
        setPlans((prev) => prev.map((p) => (p.id === editingId ? data.plan! : p)));
      } else {
        const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body)
        });
        const data = (await r.json()) as { ok: boolean; plan?: SourcingPlan; error?: string };
        if (!data.ok) throw new Error(data.error ?? "Erreur.");
        setPlans((prev) => [...prev, data.plan!]);
      }

      cancelForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(id: string) {
    if (!confirm("Supprimer ce plan ? Cette action est irreversible.")) return;
    try {
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans/${id}`, { method: "DELETE", credentials: "include" });
      const data = (await r.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Erreur.");
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression.");
    }
  }

  async function toggleActive(plan: SourcingPlan) {
    try {
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !plan.isActive })
      });
      const data = (await r.json()) as { ok: boolean; plan?: SourcingPlan };
      if (data.ok && data.plan) setPlans((prev) => prev.map((p) => (p.id === plan.id ? data.plan! : p)));
    } catch {
      setError("Erreur lors du changement d'etat.");
    }
  }

  function toggleAgent(agent: "serper" | "tavily") {
    setForm((prev) => ({
      ...prev,
      agents: prev.agents.includes(agent) ? prev.agents.filter((a) => a !== agent) : [...prev.agents, agent]
    }));
  }

  if (loading) return <LoadingBox />;

  return (
    <div className="space-y-5">
      {error ? <ErrorBanner message={error} onClose={() => setError("")} /> : null}

      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-zinc-100">Plans d'abonnement</p>
          <p className="mt-1 text-sm text-zinc-500">
            Definis les offres que tes clients peuvent souscrire pour acceder aux agents sourcing.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-black shadow-lg shadow-gold/20 transition hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            Nouveau plan
          </button>
        )}
      </div>

      {/* Formulaire creation / edition */}
      {showForm && (
        <div className="rounded-3xl border border-gold/30 bg-amber-950/20 p-6">
          <p className="font-semibold text-gold">{editingId ? "Modifier le plan" : "Creer un nouveau plan"}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Nom du plan *</label>
              <input
                type="text"
                placeholder="Ex: Starter, Pro, Business..."
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Description</label>
              <input
                type="text"
                placeholder="Ce qui est inclus dans ce plan..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Prix mensuel (XOF)</label>
              <input
                type="number"
                placeholder="55000"
                min={0}
                value={form.monthlyPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Runs / mois</label>
              <input
                type="number"
                min={1}
                value={form.maxRunsPerMonth}
                onChange={(e) => setForm((prev) => ({ ...prev, maxRunsPerMonth: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-2.5 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Prospects max / run</label>
              <input
                type="number"
                min={1}
                value={form.maxProspectsPerRun}
                onChange={(e) => setForm((prev) => ({ ...prev, maxProspectsPerRun: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-2.5 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${form.isPopular ? "border-gold bg-gold" : "border-line bg-ink"}`}
                  onClick={() => setForm((prev) => ({ ...prev, isPopular: !prev.isPopular }))}>
                  {form.isPopular && <Check className="h-3.5 w-3.5 text-black" />}
                </span>
                Marquer comme populaire
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Agents inclus</label>
              <div className="mt-2 flex gap-3">
                {(["serper", "tavily"] as const).map((agent) => (
                  <button
                    key={agent}
                    type="button"
                    onClick={() => toggleAgent(agent)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      form.agents.includes(agent)
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-line bg-ink text-zinc-400 hover:border-gold/30"
                    }`}
                  >
                    <Radar className="h-4 w-4" />
                    {agent === "serper" ? "Serper" : "Tavily"}
                    {form.agents.includes(agent) && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => void submitForm()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingId ? "Sauvegarder" : "Creer le plan"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="inline-flex h-10 items-center rounded-2xl border border-line px-5 text-sm font-semibold text-zinc-300 hover:border-gold/30"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des plans */}
      {plans.length === 0 && !showForm ? (
        <div className="rounded-3xl border border-dashed border-line bg-panel p-8 text-center">
          <Zap className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 font-semibold text-zinc-300">Aucun plan cree</p>
          <p className="mt-1 text-sm text-zinc-500">Cree ton premier plan pour commencer a monetiser tes agents sourcing.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-black hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" /> Creer un plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl border bg-panel p-5 transition ${
                plan.isPopular ? "border-gold/40 shadow-lg shadow-gold/10" : "border-line"
              } ${!plan.isActive ? "opacity-60" : ""}`}
            >
              {plan.isPopular && (
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-black">
                  <Star className="h-3 w-3" /> Populaire
                </div>
              )}
              <div className="flex items-start justify-between gap-3 pr-20">
                <p className="font-bold text-zinc-100">{plan.name}</p>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{plan.description || "—"}</p>
              <p className="mt-4 text-2xl font-black text-gold">
                {formatMoney(plan.monthlyPrice)}<span className="text-sm font-normal text-zinc-400"> / mois</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" />{plan.maxRunsPerMonth} runs / mois</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" />{plan.maxProspectsPerRun} prospects max / run</li>
                {plan.agents.includes("serper") && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" />Agent Serper (decouverte)</li>}
                {plan.agents.includes("tavily") && <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" />Agent Tavily (qualification)</li>}
              </ul>
              <div className="mt-5 flex gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => openEdit(plan)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-3 text-xs font-semibold text-zinc-300 hover:border-gold/40"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Modifier
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive(plan)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-3 text-xs font-semibold text-zinc-300 hover:border-gold/40"
                >
                  {plan.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {plan.isActive ? "Desactiver" : "Activer"}
                </button>
                <button
                  type="button"
                  onClick={() => void deletePlan(plan.id)}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 text-xs font-semibold text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Onglet Parametres API ────────────────────────────────────────────────

function ApiSettingsTab({ onSaved }: { onSaved: () => void }) {
  const [providers, setProviders] = useState<ApiProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<ApiSettingsTabKey>("providers");

  useEffect(() => {
    void loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers`, {
        cache: "no-store",
        credentials: "include"
      });
      const data = (await response.json()) as { providers?: ApiProviderConfig[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Chargement impossible");
      setProviders((data.providers ?? []).map(normalizeProvider));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  function updateProvider(id: string, patch: Partial<ApiProviderConfig>) {
    setProviders((current) => current.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider)));
  }

  async function fetchModels(provider: ApiProviderConfig) {
    updateProvider(provider.id, {
      modelStatus: "loading",
      modelMessage: "Verification de la cle et recuperation des modeles..."
    });
    try {
      const typedApiKey = provider.apiKey?.trim();
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers/${provider.id}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(typedApiKey ? { apiKey: typedApiKey } : {}),
          baseUrl: provider.baseUrl
        })
      });
      const data = (await response.json()) as { ok?: boolean; models?: string[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Modeles indisponibles");
      const models = data.models ?? [];
      updateProvider(provider.id, {
        models,
        defaultModel: models.length > 0
          ? (models.includes(provider.defaultModel) ? provider.defaultModel : models[0]!)
          : provider.defaultModel,
        apiKey: "",
        apiKeyConfigured: provider.apiKeyConfigured || Boolean(typedApiKey),
        apiKeySource: typedApiKey ? "database" : provider.apiKeySource,
        clearApiKey: false,
        isReplacingKey: false,
        modelStatus: "ok",
        modelMessage: `${models.length} modele(s) recupere(s)`
      });
    } catch (caught) {
      updateProvider(provider.id, {
        modelStatus: "error",
        modelMessage: caught instanceof Error ? caught.message : "Modeles indisponibles"
      });
    }
  }

  async function saveProviders() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ providers: providers.map(toProviderPayload) })
      });
      const data = (await response.json()) as { ok?: boolean; providers?: ApiProviderConfig[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Sauvegarde impossible");
      setProviders((data.providers ?? providers).map(normalizeProvider));
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  }

  const providerItems = providers.filter(isChatProvider);
  const searchItems = providers.filter(isSearchProvider);

  if (loading) return <LoadingBox />;

  return (
    <div className="space-y-5">
      {error ? <ErrorBanner message={error} onClose={() => setError(null)} /> : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-semibold text-zinc-100">Parametres API du produit sourcing</p>
          <p className="mt-1 text-sm text-zinc-500">
            Cette zone appartient au produit Sourcing Business. Elle te permet de choisir tes fournisseurs IA,
            recuperer leurs modeles et brancher Serper / Tavily sans passer par tes reglages personnels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Enregistre
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void saveProviders()}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-black disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="inline-flex rounded-2xl border border-line bg-ink p-1">
        {([
          { key: "providers", label: "Fournisseurs IA" },
          { key: "search", label: "API Serper & Tavily" }
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveSubTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeSubTab === tab.key ? "bg-gold text-black" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {(activeSubTab === "providers" ? providerItems : searchItems).map((provider) => {
          const isSearch = isSearchProvider(provider);
          return (
            <section key={provider.id} className="rounded-3xl border border-line bg-panel p-5">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-100">{provider.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        provider.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"
                      }`}
                    >
                      {provider.enabled ? "Actif" : "Desactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {isSearch
                      ? "Cle et endpoint dedies au moteur de recherche web du produit sourcing."
                      : "Cle fournisseur IA dediee au cerveau de tes agents sourcing."}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  Actif
                  <input
                    type="checkbox"
                    checked={provider.enabled}
                    onChange={(event) => updateProvider(provider.id, { enabled: event.target.checked })}
                    className="h-4 w-4 accent-gold"
                  />
                </label>
              </div>

              <div className={`grid gap-4 ${isSearch ? "xl:grid-cols-[1.35fr_1fr_180px]" : "xl:grid-cols-[1.35fr_1fr_180px]"}`}>
                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-300">Cle API</span>
                  {provider.apiKeyConfigured && !provider.isReplacingKey && !provider.clearApiKey ? (
                    <div className="rounded-2xl border border-line bg-ink p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-emerald-300">Cle enregistree</p>
                          <p className="text-xs text-zinc-500">
                            La cle est bien sauvegardee et reste volontairement masquee pour la securite.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateProvider(provider.id, {
                                isReplacingKey: true,
                                clearApiKey: false,
                                apiKey: ""
                              })
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-zinc-200 hover:border-gold/40"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Remplacer
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateProvider(provider.id, {
                                clearApiKey: true,
                                isReplacingKey: false,
                                apiKey: ""
                              })
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-500/30 px-3 text-xs font-semibold text-rose-300 hover:border-rose-400/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : provider.clearApiKey ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-rose-300">Suppression en attente</p>
                          <p className="text-xs text-zinc-500">
                            Clique sur <span className="font-semibold text-zinc-300">Enregistrer</span> pour supprimer cette cle.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateProvider(provider.id, {
                              clearApiKey: false,
                              isReplacingKey: false,
                              apiKey: ""
                            })
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-zinc-200 hover:border-gold/40"
                        >
                          <X className="h-3.5 w-3.5" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="password"
                      value={provider.apiKey ?? ""}
                      placeholder={provider.isReplacingKey ? "Colle la nouvelle cle API" : "Colle la cle API"}
                      onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value, clearApiKey: false })}
                      className="h-11 rounded-xl border border-line bg-ink px-3 text-zinc-100 outline-none focus:border-gold/60"
                    />
                  )}
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-300">Base URL</span>
                  <input
                    type="text"
                    value={provider.baseUrl}
                    onChange={(event) => updateProvider(provider.id, { baseUrl: event.target.value })}
                    className="h-11 rounded-xl border border-line bg-ink px-3 text-zinc-100 outline-none focus:border-gold/60"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void fetchModels(provider)}
                    disabled={provider.modelStatus === "loading"}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-ink px-4 text-sm font-semibold text-zinc-200 hover:border-gold/40 disabled:opacity-60"
                  >
                    {provider.modelStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {isSearch ? "Verifier l'API" : "Recuperer les modeles"}
                  </button>
                </div>
              </div>

              {!isSearch && provider.models?.length > 0 && (
                <div className="mt-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-zinc-300">Modele par defaut</span>
                    <div className="relative max-w-md">
                      <select
                        value={provider.defaultModel}
                        onChange={(event) => updateProvider(provider.id, { defaultModel: event.target.value })}
                        className="h-11 w-full appearance-none rounded-xl border border-line bg-ink px-3 pr-9 text-sm text-zinc-100 outline-none focus:border-gold/60"
                      >
                        {provider.models.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </label>
                  <p className="mt-1.5 text-xs text-zinc-600">
                    Ce modele sera utilise par tous les agents sourcing configures sur ce fournisseur.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>Source cle: {provider.apiKeySource}</span>
                {provider.modelMessage ? <span className="rounded-full border border-line px-2 py-1">{provider.modelMessage}</span> : null}
                {!isSearch && provider.models?.length ? (
                  <span className="rounded-full border border-line px-2 py-1">
                    {provider.models.length} modele(s) disponible(s)
                  </span>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Onglet Agents Globaux ─────────────────────────────────────────────────

function GlobalAgentsTab({ apiSettingsVersion }: { apiSettingsVersion: number }) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<SourcingGlobalAgent[]>([]);
  const [providers, setProviders] = useState<ApiProviderConfig[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, Partial<SourcingGlobalAgent>>>({});
  const [editorSections, setEditorSections] = useState<Record<string, "mission" | "brain">>({});

  useEffect(() => {
    void loadAgents();
    void loadProviders();
  }, [apiSettingsVersion]);

  async function loadAgents() {
    try {
      setLoading(true);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents`, { cache: "no-store", credentials: "include" });
      const data = (await r.json()) as { ok: boolean; agents: SourcingGlobalAgent[] };
      if (data.ok) setAgents(data.agents);
    } catch {
      setError("Impossible de charger les agents globaux.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProviders() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers`, {
        cache: "no-store",
        credentials: "include"
      });
      const data = (await response.json()) as { providers?: ApiProviderConfig[] };
      if (response.ok) {
        setProviders((data.providers ?? []).map(normalizeProvider));
      }
    } catch {
      // On garde une UX souple ici ; le bloc Parametres API reste la zone de diagnostic detaillee.
    }
  }

  async function toggleEnabled(agent: SourcingGlobalAgent) {
    try {
      setSavingKey(agent.agentKey);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents/${agent.agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isEnabled: !agent.isEnabled })
      });
      const data = (await r.json()) as { ok: boolean; agent?: SourcingGlobalAgent };
      if (data.ok && data.agent) setAgents((prev) => prev.map((a) => (a.agentKey === agent.agentKey ? data.agent! : a)));
    } catch {
      setError("Erreur lors du changement d'etat.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveConfig(agentKey: string) {
    const patch = { ...(forms[agentKey] ?? {}), modelId: "" };
    try {
      setSavingKey(agentKey);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch)
      });
      const data = (await r.json()) as { ok: boolean; agent?: SourcingGlobalAgent; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Erreur.");
      if (data.agent) setAgents((prev) => prev.map((a) => (a.agentKey === agentKey ? data.agent! : a)));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde.");
    } finally {
      setSavingKey(null);
    }
  }

  async function reapplyTemplate(agentKey: string) {
    try {
      setSavingKey(`${agentKey}:reapply`);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents/${agentKey}/reapply`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await r.json()) as { ok: boolean; updatedProfiles?: number; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Erreur.");
      setError(`Template reapplique sur ${data.updatedProfiles ?? 0} compte(s) existant(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la resynchronisation.");
    } finally {
      setSavingKey(null);
    }
  }

  function startEdit(agent: SourcingGlobalAgent) {
    setForms((prev) => ({ ...prev, [agent.agentKey]: { ...agent } }));
    setEditing(agent.agentKey);
    setEditorSections((prev) => ({ ...prev, [agent.agentKey]: "mission" }));
  }

  function updateForm<K extends keyof SourcingGlobalAgent>(agentKey: string, field: K, value: SourcingGlobalAgent[K]) {
    setForms((prev) => ({ ...prev, [agentKey]: { ...prev[agentKey], [field]: value } }));
  }

  if (loading) return <LoadingBox />;

  const chatProviders = providers.filter(isChatProvider);

  return (
    <div className="space-y-5">
      {error ? <ErrorBanner message={error} onClose={() => setError("")} /> : null}

      <div>
        <p className="font-semibold text-zinc-100">Configuration globale des agents</p>
        <p className="mt-1 text-sm text-zinc-500">
          Parametres par defaut appliques a chaque nouveau compte sourcing. Tu peux reappliquer les templates aux comptes existants quand tu veux resynchroniser Serper et Tavily.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {agents.map((agent) => {
          const isEditing = editing === agent.agentKey;
          const form = forms[agent.agentKey] ?? agent;
          const isSaving = savingKey === agent.agentKey;
          const isReapplying = savingKey === `${agent.agentKey}:reapply`;
          const isSerper = agent.source === "serper";
          const editorSection = editorSections[agent.agentKey] ?? "mission";
          const toolsValue = Array.isArray(form.allowedTools) ? form.allowedTools.join(", ") : "";
          const productName = agent.agentKey === "sourcing-serper" ? "Agent Découverte" : "Agent Qualification";
          const productSubtitle = isSerper ? "Template produit — découverte rapide" : "Template produit — qualification approfondie";
          const selectedProviderId = String(form.modelProvider ?? agent.modelProvider ?? (isSerper ? "openai" : "claude"));
          return (
            <article
              key={agent.agentKey}
              className={`rounded-3xl border p-6 transition ${
                agent.isEnabled ? "border-line bg-panel" : "border-line bg-panel opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-line ${isSerper ? "bg-violet-500/10" : "bg-sky-500/10"}`}>
                    <Radar className={`h-6 w-6 ${isSerper ? "text-violet-400" : "text-sky-400"}`} />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-100">{productName}</p>
                    <p className={`mt-0.5 text-xs font-semibold uppercase tracking-widest ${isSerper ? "text-violet-400" : "text-sky-400"}`}>
                      {productSubtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${agent.isEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                    {agent.isEnabled ? "Actif" : "Desactive"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleEnabled(agent)}
                    disabled={isSaving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-3 text-xs font-semibold text-zinc-300 hover:border-gold/40 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : agent.isEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {agent.isEnabled ? "Pause" : "Activer"}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="mt-5 space-y-4">
                  <div className="inline-flex rounded-2xl border border-line bg-ink p-1">
                    {(["mission", "brain"] as const).map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setEditorSections((prev) => ({ ...prev, [agent.agentKey]: section }))}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                          editorSection === section ? "bg-gold text-black" : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {section === "mission" ? "Mission" : "Cerveau"}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Nom affiche</label>
                    <input
                      type="text"
                      value={String(form.displayName ?? "")}
                      onChange={(e) => updateForm(agent.agentKey, "displayName", e.target.value)}
                      className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Fournisseur IA</label>
                      <select
                        value={selectedProviderId}
                        onChange={(e) => {
                          const nextProviderId = e.target.value;
                          updateForm(agent.agentKey, "modelProvider", nextProviderId);
                          updateForm(agent.agentKey, "modelId", "");
                        }}
                        className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                      >
                        {chatProviders.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-zinc-600">Choisi d'abord le fournisseur branche a ta cle API.</p>
                      {(() => {
                        const prov = chatProviders.find((p) => p.id === selectedProviderId);
                        const model = prov?.defaultModel;
                        if (!model || model === "search") return null;
                        return (
                          <p className="mt-2 text-xs text-zinc-500">
                            Modele actif:{" "}
                            <span className="font-semibold text-gold">{model}</span>
                            <span className="ml-1 text-zinc-600">(defini dans Parametres API)</span>
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  {editorSection === "mission" ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Mots-cles par defaut</label>
                        <input
                          type="text"
                          placeholder="Ex: agence web, consultant marketing..."
                          value={String(form.defaultKeywords ?? "")}
                          onChange={(e) => updateForm(agent.agentKey, "defaultKeywords", e.target.value)}
                          className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Instructions de qualification</label>
                        <textarea
                          rows={4}
                          placeholder="Ex: Chercher des entreprises de 10-50 employes..."
                          value={String(form.qualificationInstructions ?? "")}
                          onChange={(e) => updateForm(agent.agentKey, "qualificationInstructions", e.target.value)}
                          className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Secteur par defaut</label>
                          <input
                            type="text"
                            placeholder="Ex: Tech, Commerce..."
                            value={String(form.defaultSector ?? "")}
                            onChange={(e) => updateForm(agent.agentKey, "defaultSector", e.target.value)}
                            className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Zone par defaut</label>
                          <input
                            type="text"
                            placeholder="Ex: Dakar, Abidjan..."
                            value={String(form.defaultZone ?? "")}
                            onChange={(e) => updateForm(agent.agentKey, "defaultZone", e.target.value)}
                            className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Prospects cibles / run</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={Number(form.defaultTargetCount ?? 20)}
                            onChange={(e) => updateForm(agent.agentKey, "defaultTargetCount", Number(e.target.value))}
                            className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">System prompt</label>
                        <textarea
                          rows={4}
                          value={String(form.systemPrompt ?? "")}
                          onChange={(e) => updateForm(agent.agentKey, "systemPrompt", e.target.value)}
                          className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Personnalite</label>
                        <textarea
                          rows={3}
                          value={String(form.personality ?? "")}
                          onChange={(e) => updateForm(agent.agentKey, "personality", e.target.value)}
                          className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Identite</label>
                        <textarea
                          rows={3}
                          value={String(form.identity ?? "")}
                          onChange={(e) => updateForm(agent.agentKey, "identity", e.target.value)}
                          className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Contexte utilisateur</label>
                        <textarea
                          rows={3}
                          value={String(form.userContext ?? "")}
                          onChange={(e) => updateForm(agent.agentKey, "userContext", e.target.value)}
                          className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Outils autorises</label>
                        <input
                          type="text"
                          placeholder="Ex: web_search, page_scrape, company_lookup"
                          value={toolsValue}
                          onChange={(e) =>
                            updateForm(
                              agent.agentKey,
                              "allowedTools",
                              e.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => void saveConfig(agent.agentKey)}
                      disabled={isSaving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gold px-4 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Sauvegarder
                    </button>
                    <button
                      type="button"
                      onClick={() => void reapplyTemplate(agent.agentKey)}
                      disabled={isReapplying}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-4 text-xs font-semibold text-zinc-300 hover:border-gold/30 disabled:opacity-50"
                    >
                      {isReapplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Reappliquer aux comptes existants
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="inline-flex h-9 items-center rounded-xl border border-line px-4 text-xs font-semibold text-zinc-400 hover:border-gold/30"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-2 text-sm text-zinc-500">
                  <p>
                    <span className="text-zinc-400">Fournisseur IA:</span>{" "}
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-zinc-200">
                      {chatProviders.find((provider) => provider.id === agent.modelProvider)?.name ?? agent.modelProvider}
                    </span>
                  </p>
                  {(() => {
                    const prov = chatProviders.find((p) => p.id === agent.modelProvider);
                    const model = prov?.defaultModel;
                    if (!model || model === "search") return null;
                    return (
                      <p>
                        <span className="text-zinc-400">Modele:</span>{" "}
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-zinc-200">
                          {model}
                        </span>
                      </p>
                    );
                  })()}
                  <p><span className="text-zinc-400">Source interne:</span> {isSerper ? "Serper" : "Tavily"}</p>
                  {agent.defaultKeywords && <p><span className="text-zinc-400">Mots-cles:</span> {agent.defaultKeywords}</p>}
                  {agent.defaultSector && <p><span className="text-zinc-400">Secteur:</span> {agent.defaultSector}</p>}
                  {agent.defaultZone && <p><span className="text-zinc-400">Zone:</span> {agent.defaultZone}</p>}
                  <p><span className="text-zinc-400">Cible par run:</span> {agent.defaultTargetCount} prospects</p>
                  {agent.allowedTools.length ? <p><span className="text-zinc-400">Outils:</span> {agent.allowedTools.join(", ")}</p> : null}
                  {!agent.defaultKeywords && !agent.defaultSector && !agent.defaultZone && (
                    <p className="italic text-zinc-600">Aucune configuration specifique — valeurs par defaut actives.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(agent)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-3 text-xs font-semibold text-zinc-300 hover:border-gold/40"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Configurer
                    </button>
                    <button
                      type="button"
                      onClick={() => void reapplyTemplate(agent.agentKey)}
                      disabled={isReapplying}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-zinc-300 hover:border-gold/30 disabled:opacity-50"
                    >
                      {isReapplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Reappliquer
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ─── Onglet Abonnes ────────────────────────────────────────────────────────

function SubscribersTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscribers, setSubscribers] = useState<SourcingSubscriber[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadSubscribers();
  }, []);

  async function loadSubscribers() {
    try {
      setLoading(true);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/subscribers`, { cache: "no-store", credentials: "include" });
      const data = (await r.json()) as { ok: boolean; subscribers: SourcingSubscriber[]; totalRevenue: number };
      if (data.ok) {
        setSubscribers(data.subscribers);
        setTotalRevenue(data.totalRevenue);
      }
    } catch {
      setError("Impossible de charger les abonnes.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = subscribers.filter(
    (s) =>
      s.companyName.toLowerCase().includes(search.toLowerCase()) ||
      s.ownerEmail.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingBox />;

  return (
    <div className="space-y-5">
      {error ? <ErrorBanner message={error} onClose={() => setError("")} /> : null}

      {/* Stats rapides */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total abonnes" value={String(subscribers.length)} icon={Users} accent="gold" />
        <StatCard
          label="Abonnes actifs"
          value={String(subscribers.filter((s) => s.subscription?.status === "active").length)}
          icon={Check}
          accent="emerald"
        />
        <StatCard label="Revenu mensuel" value={formatMoney(totalRevenue)} icon={TrendingUp} accent="amber" />
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState message={search ? "Aucun abonne correspond a ta recherche." : "Aucun abonne sourcing pour l'instant."} />
      ) : (
        <div className="rounded-3xl border border-line bg-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Compte</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Statut</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Activite</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Prochain debit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub, idx) => (
                  <tr key={sub.companyId} className={`border-b border-line ${idx % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-100">{sub.companyName}</p>
                      <p className="text-xs text-zinc-500">{sub.ownerEmail}</p>
                      {sub.industry && <p className="mt-0.5 text-xs text-zinc-600">{sub.industry}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {sub.subscription ? (
                        <>
                          <p className="font-medium text-zinc-200">{sub.subscription.planName || "Sourcing"}</p>
                          <p className="text-xs text-gold">{formatMoney(sub.subscription.monthlyPrice)} / mois</p>
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sub.subscription ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(sub.subscription.status)}`}>
                          {subscriptionStatusLabel(sub.subscription.status)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-500/15 px-2.5 py-1 text-xs text-zinc-400">Sans abonnement</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-300">{sub.totalRuns} runs</p>
                      <p className="text-xs text-zinc-500">{sub.totalProspects} prospects</p>
                      {sub.lastRunAt && <p className="text-xs text-zinc-600">Dernier: {formatDate(sub.lastRunAt)}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {sub.subscription?.nextBillingDate ? formatDate(sub.subscription.nextBillingDate) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Onglet Analytics ─────────────────────────────────────────────────────

function AnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [subscribers, setSubscribers] = useState<SourcingSubscriber[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [ovRes, subRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing`, { cache: "no-store", credentials: "include" }),
          fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/subscribers`, { cache: "no-store", credentials: "include" })
        ]);
        const ovData = (await ovRes.json()) as OverviewPayload;
        const subData = (await subRes.json()) as { ok: boolean; subscribers: SourcingSubscriber[]; totalRevenue: number };
        if (active) {
          setOverview(ovData);
          if (subData.ok) {
            setSubscribers(subData.subscribers);
            setTotalRevenue(subData.totalRevenue);
          }
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erreur.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const recentRuns = overview?.recentRuns ?? [];

  // Secteurs
  const sectorCounts = recentRuns.reduce<Record<string, number>>((acc, r) => {
    if (r.sector) acc[r.sector] = (acc[r.sector] ?? 0) + 1;
    return acc;
  }, {});
  const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Zones
  const zoneCounts = recentRuns.reduce<Record<string, number>>((acc, r) => {
    if (r.zone) acc[r.zone] = (acc[r.zone] ?? 0) + 1;
    return acc;
  }, {});
  const topZones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Agents
  const serperRuns = recentRuns.filter((r) => r.agentName?.toLowerCase().includes("serper")).length;
  const tavilyRuns = recentRuns.filter((r) => r.agentName?.toLowerCase().includes("tavily")).length;
  const totalAgentRuns = Math.max(serperRuns + tavilyRuns, 1);

  // Moyenne prospects / run
  const avgProspects =
    recentRuns.length > 0
      ? Math.round(recentRuns.reduce((sum, r) => sum + r.foundCount, 0) / recentRuns.length)
      : 0;

  // Plans
  const planCounts = subscribers.reduce<Record<string, number>>((acc, s) => {
    const plan = s.subscription?.planName ?? "Sans plan";
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});
  const planDistribution = Object.entries(planCounts).sort((a, b) => b[1] - a[1]);

  const activeSubscribers = subscribers.filter((s) => s.subscription?.status === "active").length;

  if (loading) return <LoadingBox />;

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} /> : null}

      {/* KPI */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Revenu mensuel"
          value={formatMoney(totalRevenue)}
          sub={`${activeSubscribers} abonne${activeSubscribers > 1 ? "s" : ""} actif${activeSubscribers > 1 ? "s" : ""}`}
          accent="gold"
        />
        <KpiCard
          label="Runs totaux"
          value={String(overview?.stats.runs ?? 0)}
          sub={`${recentRuns.length} recents charges`}
          accent="sky"
        />
        <KpiCard
          label="Prospects generes"
          value={String(overview?.stats.prospects ?? 0)}
          sub={`~${avgProspects} par run en moy.`}
          accent="violet"
        />
        <KpiCard
          label="Taux d'activation"
          value={subscribers.length ? `${Math.round((activeSubscribers / subscribers.length) * 100)}%` : "—"}
          sub={`${activeSubscribers} / ${subscribers.length} actifs`}
          accent="emerald"
        />
      </div>

      {/* Agent usage + Plan distribution */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gold" />
            <p className="text-sm font-semibold text-gold">Utilisation des agents</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Repartition Serper / Tavily sur les runs recents</p>
          <div className="mt-5 space-y-4">
            <AgentBar label="Serper (decouverte rapide)" count={serperRuns} total={totalAgentRuns} color="violet" />
            <AgentBar label="Tavily (qualification approfondie)" count={tavilyRuns} total={totalAgentRuns} color="sky" />
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl bg-ink text-center">
            <div className="py-4">
              <p className="text-xl font-black text-violet-400">{serperRuns}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Serper</p>
            </div>
            <div className="py-4">
              <p className="text-xl font-black text-sky-400">{tavilyRuns}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Tavily</p>
            </div>
            <div className="py-4">
              <p className="text-xl font-black text-gold">{serperRuns + tavilyRuns}</p>
              <p className="mt-0.5 text-xs text-zinc-500">Total</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" />
            <p className="text-sm font-semibold text-gold">Repartition des plans</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Distribution des abonnes par offre</p>
          {planDistribution.length > 0 ? (
            <div className="mt-5 space-y-3">
              {planDistribution.map(([plan, count]) => (
                <div key={plan}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-300">{plan}</span>
                    <span className="text-xs text-zinc-500">{count} abonne{count > 1 ? "s" : ""}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-700"
                      style={{ width: subscribers.length ? `${Math.round((count / subscribers.length) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-ink px-4 py-6 text-center text-sm text-zinc-500">
              Aucun abonne pour l'instant.
            </div>
          )}
        </div>
      </div>

      {/* Top secteurs + Top zones */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-semibold text-zinc-100">Top secteurs cibles</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Secteurs les plus recherches dans les runs recents</p>
          {topSectors.length > 0 ? (
            <div className="mt-5 space-y-3">
              {topSectors.map(([sector, count], i) => (
                <div key={sector} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-zinc-600">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-zinc-200">{sector}</span>
                      <span className="ml-2 shrink-0 text-xs text-zinc-500">{count} run{count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                        style={{ width: `${Math.round((count / (topSectors[0]?.[1] ?? 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-ink px-4 py-6 text-center text-sm text-zinc-500">
              Pas encore de donnees de secteurs.
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-sky-400" />
            <p className="text-sm font-semibold text-zinc-100">Top zones geographiques</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Zones les plus ciblees dans les runs recents</p>
          {topZones.length > 0 ? (
            <div className="mt-5 space-y-3">
              {topZones.map(([zone, count], i) => (
                <div key={zone} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-zinc-600">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-zinc-200">{zone}</span>
                      <span className="ml-2 shrink-0 text-xs text-zinc-500">{count} run{count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-700"
                        style={{ width: `${Math.round((count / (topZones[0]?.[1] ?? 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-ink px-4 py-6 text-center text-sm text-zinc-500">
              Pas encore de donnees de zones.
            </div>
          )}
        </div>
      </div>

      {/* Top comptes par activite */}
      {(overview?.workspaces.length ?? 0) > 0 && (
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-zinc-100">Activite par compte</p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Classement des comptes par volume de runs generes</p>
          <div className="mt-5 space-y-3">
            {[...(overview?.workspaces ?? [])]
              .sort((a, b) => b.totalRuns - a.totalRuns)
              .slice(0, 5)
              .map((ws, i) => {
                const maxRuns = Math.max(...(overview?.workspaces ?? []).map((w) => w.totalRuns), 1);
                return (
                  <div key={ws.companyId} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-zinc-600">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium text-zinc-200">{ws.companyName}</span>
                        <span className="ml-2 shrink-0 text-xs text-zinc-500">
                          {ws.totalRuns} runs · {ws.totalProspects} prospects
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-700"
                          style={{ width: `${Math.round((ws.totalRuns / maxRuns) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent
}: {
  label: string;
  value: string;
  sub: string;
  accent: "gold" | "sky" | "violet" | "emerald";
}) {
  const styles: Record<string, string> = {
    gold: "border-gold/20 bg-gold/5",
    sky: "border-sky-500/20 bg-sky-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5"
  };
  return (
    <div className={`rounded-3xl border p-5 ${styles[accent]}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function AgentBar({
  label,
  count,
  total,
  color
}: {
  label: string;
  count: number;
  total: number;
  color: "violet" | "sky";
}) {
  const pct = Math.round((count / total) * 100);
  const barColor = color === "violet" ? "bg-violet-500" : "bg-sky-500";
  const textColor = color === "violet" ? "text-violet-400" : "text-sky-400";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-300">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Composants utilitaires ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "gold"
}: {
  label: string;
  value: string;
  icon: typeof Users;
  accent?: "gold" | "emerald" | "amber" | "sky" | "violet";
}) {
  const colors: Record<string, string> = {
    gold: "text-gold",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    sky: "text-sky-400",
    violet: "text-violet-400"
  };
  return (
    <article className="rounded-3xl border border-line bg-panel p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-line bg-ink p-3">
          <Icon className={`h-5 w-5 ${colors[accent]}`} />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-0.5 text-2xl font-black text-zinc-100">{value}</p>
        </div>
      </div>
    </article>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      <span className="flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 text-red-400 hover:text-red-200">✕</button>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink px-4 py-5">
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}

function LoadingBox() {
  return (
    <div className="flex min-h-[14rem] items-center justify-center rounded-3xl border border-line bg-panel">
      <Loader2 className="h-7 w-7 animate-spin text-gold" />
    </div>
  );
}

// ─── Onglet Paiements ──────────────────────────────────────────────────────

type PaymentMethodsConfig = {
  waveNumber: string;
  waveHolder: string;
  orangeMoneyNumber: string;
  orangeMoneyHolder: string;
  instructions: string;
};

type AdminPaymentRequest = {
  id: string;
  companyName: string;
  userName: string;
  userEmail: string;
  planName: string;
  amount: number;
  method: "wave" | "orange_money";
  senderPhone: string;
  reference: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
};

function PaymentsTab() {
  const [methods, setMethods] = useState<PaymentMethodsConfig>({
    waveNumber: "", waveHolder: "", orangeMoneyNumber: "", orangeMoneyHolder: "", instructions: ""
  });
  const [requests, setRequests] = useState<AdminPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMethods, setSavingMethods] = useState(false);
  const [methodsSaved, setMethodsSaved] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [mRes, rRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/sourcing/admin/payment-methods`, { cache: "no-store", credentials: "include" }),
          fetch(`${apiBaseUrl}/api/sourcing/admin/payments/requests`, { cache: "no-store", credentials: "include" })
        ]);
        const mData = (await mRes.json()) as { ok: boolean; methods: PaymentMethodsConfig };
        const rData = (await rRes.json()) as { ok: boolean; requests: AdminPaymentRequest[] };
        if (!active) return;
        if (mData.ok) setMethods(mData.methods);
        if (rData.ok) setRequests(rData.requests);
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function saveMethods() {
    setSavingMethods(true);
    try {
      await fetch(`${apiBaseUrl}/api/sourcing/admin/payment-methods`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(methods)
      });
      setMethodsSaved(true);
      setTimeout(() => setMethodsSaved(false), 3000);
    } catch { /* ignore */ } finally {
      setSavingMethods(false);
    }
  }

  async function approve(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/admin/payments/requests/${id}/approve`, { method: "PATCH", credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; request?: AdminPaymentRequest };
      if (data.ok && data.request) setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" } : r));
    } catch { /* ignore */ } finally { setProcessing(null); }
  }

  async function reject(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/admin/payments/requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "rejected", rejectionReason: rejectReason } : r));
      setRejectId(null); setRejectReason("");
    } catch { /* ignore */ } finally { setProcessing(null); }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  if (loading) return <LoadingBox />;

  return (
    <div className="space-y-6">

      {/* Configuration des numéros */}
      <div className="rounded-3xl border border-line bg-panel p-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-gold" />
          <h2 className="font-bold text-zinc-100">Numéros de paiement</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-500">Configure les numéros que les utilisateurs verront pour payer.</p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {/* Wave */}
          <div className="space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-bold text-violet-300">Wave</span>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Numéro Wave</label>
              <input
                type="text"
                value={methods.waveNumber}
                onChange={(e) => setMethods((m) => ({ ...m, waveNumber: e.target.value }))}
                placeholder="77 XXX XX XX"
                className="mt-1 h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-zinc-100 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Nom du titulaire</label>
              <input
                type="text"
                value={methods.waveHolder}
                onChange={(e) => setMethods((m) => ({ ...m, waveHolder: e.target.value }))}
                placeholder="Prénom Nom"
                className="mt-1 h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-zinc-100 focus:border-violet-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Orange Money */}
          <div className="space-y-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-bold text-orange-300">Orange Money</span>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Numéro Orange Money</label>
              <input
                type="text"
                value={methods.orangeMoneyNumber}
                onChange={(e) => setMethods((m) => ({ ...m, orangeMoneyNumber: e.target.value }))}
                placeholder="77 XXX XX XX"
                className="mt-1 h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-zinc-100 focus:border-orange-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Nom du titulaire</label>
              <input
                type="text"
                value={methods.orangeMoneyHolder}
                onChange={(e) => setMethods((m) => ({ ...m, orangeMoneyHolder: e.target.value }))}
                placeholder="Prénom Nom"
                className="mt-1 h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-zinc-100 focus:border-orange-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Instructions supplémentaires (optionnel)
          </label>
          <textarea
            value={methods.instructions}
            onChange={(e) => setMethods((m) => ({ ...m, instructions: e.target.value }))}
            rows={2}
            placeholder="Ex: Mentionner votre email en commentaire du paiement..."
            className="mt-1 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/50 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void saveMethods()}
            disabled={savingMethods}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50"
          >
            {savingMethods ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {methodsSaved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Enregistré
            </span>
          )}
        </div>
      </div>

      {/* Demandes en attente */}
      <div className="rounded-3xl border border-line bg-panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-zinc-100">Demandes en attente</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{pending.length} demande{pending.length > 1 ? "s" : ""} à traiter</p>
          </div>
          {pending.length > 0 && (
            <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-bold text-yellow-300">
              {pending.length} en attente
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-line bg-ink px-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-500">Aucune demande en attente</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {pending.map((req) => (
              <div key={req.id} className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-zinc-100">{req.companyName}</p>
                    <p className="text-sm text-zinc-500">{req.userName} · {req.userEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gold">{formatMoney(req.amount)}</p>
                    <p className="text-xs text-zinc-500">Plan {req.planName}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-white/5 bg-ink/60 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-zinc-600">Méthode</p>
                    <p className="mt-0.5 font-bold text-zinc-300 flex items-center gap-1">
                      {req.method === "wave"
                        ? <><Smartphone className="h-3 w-3 text-violet-400" /> Wave</>
                        : <><Phone className="h-3 w-3 text-orange-400" /> Orange Money</>
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-600">Numéro</p>
                    <p className="mt-0.5 font-mono font-semibold text-zinc-300">{req.senderPhone}</p>
                  </div>
                  <div>
                    <p className="text-zinc-600">Référence</p>
                    <p className="mt-0.5 font-mono font-semibold text-zinc-300">{req.reference}</p>
                  </div>
                  <div>
                    <p className="text-zinc-600">Date</p>
                    <p className="mt-0.5 text-zinc-400">{formatDate(req.createdAt)}</p>
                  </div>
                </div>

                {rejectId === req.id ? (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Raison du refus (optionnel)"
                      className="h-10 w-full rounded-xl border border-line bg-ink px-3 text-sm text-zinc-100 focus:border-red-500/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void reject(req.id)}
                        disabled={processing === req.id}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-50"
                      >
                        {processing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Confirmer le refus
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectId(null); setRejectReason(""); }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-4 text-sm text-zinc-400 hover:text-zinc-200"
                      >
                        <X className="h-3.5 w-3.5" /> Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void approve(req.id)}
                      disabled={processing === req.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {processing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approuver
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectId(req.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-500/30 px-4 text-sm font-bold text-red-400 hover:border-red-500/60"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Refuser
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="rounded-3xl border border-line bg-panel p-6">
          <h2 className="font-bold text-zinc-100">Historique</h2>
          <div className="mt-4 space-y-3">
            {history.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink p-4">
                <div>
                  <p className="text-sm font-bold text-zinc-200">{req.companyName} — Plan {req.planName}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{req.userName} · {formatDate(req.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-gold">{formatMoney(req.amount)}</span>
                  {req.status === "approved" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Approuvé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-300">
                      <XCircle className="h-3 w-3" /> Refusé
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
