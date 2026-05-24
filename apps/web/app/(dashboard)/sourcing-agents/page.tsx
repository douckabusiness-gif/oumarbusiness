"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Edit2,
  Loader2,
  Pause,
  Play,
  Plus,
  Radar,
  Search,
  Star,
  Trash2,
  TrendingUp,
  Users,
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

// ─── Onglets ───────────────────────────────────────────────────────────────

type Tab = "overview" | "plans" | "agents" | "subscribers";

const TABS: { key: Tab; label: string; icon: typeof Radar }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: TrendingUp },
  { key: "plans", label: "Plans & Tarifs", icon: Zap },
  { key: "agents", label: "Agents Globaux", icon: Radar },
  { key: "subscribers", label: "Abonnes", icon: Users }
];

// ─── Composant principal ───────────────────────────────────────────────────

export default function SourcingBusinessPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
              Monetise tes agents Serper + Tavily. Cree des plans d'acces, pilote les agents globaux et suis tes abonnes
              depuis une seule page — sans toucher au reste de ton systeme.
            </p>
          </div>
          <Link
            href="/settings/search-intelligence"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-line bg-ink px-4 text-sm font-semibold text-zinc-200 transition hover:border-gold/40 hover:text-gold"
          >
            <Search className="h-4 w-4" />
            Config Serper / Tavily
          </Link>
        </div>

        {/* Barre d'onglets */}
        <div className="relative mt-7 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-ink p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive ? "bg-gold text-black shadow-lg shadow-gold/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "plans" && <PlansTab />}
      {activeTab === "agents" && <GlobalAgentsTab />}
      {activeTab === "subscribers" && <SubscribersTab />}
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
        const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing`, { cache: "no-store" });
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
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans`, { cache: "no-store" });
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
          body: JSON.stringify(body)
        });
        const data = (await r.json()) as { ok: boolean; plan?: SourcingPlan; error?: string };
        if (!data.ok) throw new Error(data.error ?? "Erreur.");
        setPlans((prev) => prev.map((p) => (p.id === editingId ? data.plan! : p)));
      } else {
        const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/plans/${id}`, { method: "DELETE" });
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

// ─── Onglet Agents Globaux ─────────────────────────────────────────────────

function GlobalAgentsTab() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<SourcingGlobalAgent[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, Partial<SourcingGlobalAgent>>>({});

  useEffect(() => {
    void loadAgents();
  }, []);

  async function loadAgents() {
    try {
      setLoading(true);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents`, { cache: "no-store" });
      const data = (await r.json()) as { ok: boolean; agents: SourcingGlobalAgent[] };
      if (data.ok) setAgents(data.agents);
    } catch {
      setError("Impossible de charger les agents globaux.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(agent: SourcingGlobalAgent) {
    try {
      setSavingKey(agent.agentKey);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents/${agent.agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    const patch = forms[agentKey] ?? {};
    try {
      setSavingKey(agentKey);
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/global-agents/${agentKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

  function startEdit(agent: SourcingGlobalAgent) {
    setForms((prev) => ({ ...prev, [agent.agentKey]: { ...agent } }));
    setEditing(agent.agentKey);
  }

  function updateForm(agentKey: string, field: string, value: string | number) {
    setForms((prev) => ({ ...prev, [agentKey]: { ...prev[agentKey], [field]: value } }));
  }

  if (loading) return <LoadingBox />;

  return (
    <div className="space-y-5">
      {error ? <ErrorBanner message={error} onClose={() => setError("")} /> : null}

      <div>
        <p className="font-semibold text-zinc-100">Configuration globale des agents</p>
        <p className="mt-1 text-sm text-zinc-500">
          Parametres par defaut appliques a chaque nouveau compte sourcing. Tu peux toujours surcharger par compte.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {agents.map((agent) => {
          const isEditing = editing === agent.agentKey;
          const form = forms[agent.agentKey] ?? agent;
          const isSaving = savingKey === agent.agentKey;
          const isSerper = agent.source === "serper";

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
                    <p className="font-bold text-zinc-100">{agent.displayName}</p>
                    <p className={`mt-0.5 text-xs font-semibold uppercase tracking-widest ${isSerper ? "text-violet-400" : "text-sky-400"}`}>
                      {agent.source} · {isSerper ? "Decouverte rapide" : "Qualification approfondie"}
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
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Nom affiche</label>
                    <input
                      type="text"
                      value={String(form.displayName ?? "")}
                      onChange={(e) => updateForm(agent.agentKey, "displayName", e.target.value)}
                      className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
                    />
                  </div>
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
                      rows={3}
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
                      onClick={() => setEditing(null)}
                      className="inline-flex h-9 items-center rounded-xl border border-line px-4 text-xs font-semibold text-zinc-400 hover:border-gold/30"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-2 text-sm text-zinc-500">
                  {agent.defaultKeywords && <p><span className="text-zinc-400">Mots-cles:</span> {agent.defaultKeywords}</p>}
                  {agent.defaultSector && <p><span className="text-zinc-400">Secteur:</span> {agent.defaultSector}</p>}
                  {agent.defaultZone && <p><span className="text-zinc-400">Zone:</span> {agent.defaultZone}</p>}
                  <p><span className="text-zinc-400">Cible par run:</span> {agent.defaultTargetCount} prospects</p>
                  {!agent.defaultKeywords && !agent.defaultSector && !agent.defaultZone && (
                    <p className="italic text-zinc-600">Aucune configuration specifique — valeurs par defaut actives.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(agent)}
                    className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-3 text-xs font-semibold text-zinc-300 hover:border-gold/40"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Configurer
                  </button>
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
      const r = await fetch(`${apiBaseUrl}/api/sourcing/admin/sourcing/subscribers`, { cache: "no-store" });
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
