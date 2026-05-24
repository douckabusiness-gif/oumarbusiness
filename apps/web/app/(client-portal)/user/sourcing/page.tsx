"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Play,
  Radar,
  Search,
  Sparkles,
  Tag,
  Target
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import { normalizeProspectScore, type SaasAgentProfile, type SaasSourcingRun } from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type WorkspacePayload = {
  module: { accessible: boolean };
  runs: SaasSourcingRun[];
  stats: { total: number; completed: number; prospectsFound: number; runsThisMonth: number };
  providers: { serper: { configured: boolean }; tavily: { configured: boolean } };
};

function extractApiErrorMessage(payload: string) {
  const flattened = payload
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return flattened && !flattened.startsWith("DOCTYPE")
    ? flattened.slice(0, 240)
    : "Le serveur a renvoye une reponse invalide.";
}

async function readApiResponse<T>(res: Response) {
  const raw = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  const expectsJson = contentType.includes("application/json");

  let data: T | null = null;
  if (raw) {
    if (!expectsJson) {
      throw new Error(extractApiErrorMessage(raw));
    }

    try {
      data = JSON.parse(raw) as T;
    } catch {
      throw new Error("Le serveur a renvoye un JSON invalide.");
    }
  }

  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Erreur ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export default function UserSourcingPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SaasSourcingRun | null>(null);
  const [payload, setPayload] = useState<WorkspacePayload | null>(null);
  const [agents, setAgents] = useState<SaasAgentProfile[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState("");
  const [form, setForm] = useState({ brief: "", sector: "", zone: "", targetCount: "6" });
  const [manuallyEdited, setManuallyEdited] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [wsRes, agRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/workspace`, { cache: "no-store", credentials: "include" }),
          fetch(`${apiBaseUrl}/api/sourcing/agents`, { cache: "no-store", credentials: "include" })
        ]);
        const [wsData, agData] = await Promise.all([
          readApiResponse<WorkspacePayload>(wsRes),
          readApiResponse<{ agents: SaasAgentProfile[] }>(agRes)
        ]);
        if (!active) return;

        const sourcingAgents = agData.agents
          .filter((a) => a.moduleKey === "sourcing-commercial")
          .sort((a, b) => (a.agentKey === "sourcing-serper" ? -1 : 1) - (b.agentKey === "sourcing-serper" ? -1 : 1));

        const preferredKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("agent") ?? "" : "";
        const initial = sourcingAgents.find((a) => a.agentKey === preferredKey) ?? sourcingAgents[0] ?? null;

        setPayload(wsData);
        setAgents(sourcingAgents);
        setSelectedAgentKey(initial?.agentKey ?? "");
        if (initial) {
          setForm({
            brief: initial.missionConfig.keywords || "",
            sector: initial.missionConfig.defaultSector || "",
            zone: initial.missionConfig.defaultZone || "",
            targetCount: String(initial.missionConfig.defaultTargetCount || 6)
          });
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erreur de chargement.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const selectedAgent = useMemo(() => agents.find((a) => a.agentKey === selectedAgentKey) ?? null, [agents, selectedAgentKey]);

  useEffect(() => {
    if (!selectedAgent || manuallyEdited) return;
    setForm({
      brief: selectedAgent.missionConfig.keywords || "",
      sector: selectedAgent.missionConfig.defaultSector || "",
      zone: selectedAgent.missionConfig.defaultZone || "",
      targetCount: String(selectedAgent.missionConfig.defaultTargetCount || 6)
    });
  }, [selectedAgent, manuallyEdited]);

  const providerReady = selectedAgent
    ? selectedAgent.missionConfig.source === "serper"
      ? Boolean(payload?.providers.serper.configured)
      : Boolean(payload?.providers.tavily.configured)
    : false;

  const canRun = Boolean(payload?.module.accessible && selectedAgent?.isEnabled && providerReady && form.brief.trim());

  async function runSourcing() {
    if (!canRun) return;
    try {
      setRunning(true);
      setError("");
      const res = await fetch(`${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/runs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentKey: selectedAgent!.agentKey,
          brief: form.brief,
          sector: form.sector,
          zone: form.zone,
          targetCount: Number(form.targetCount)
        })
      });
      const data = await readApiResponse<{ ok?: boolean; error?: string; run?: SaasSourcingRun }>(res);
      if (!res.ok || !data.ok || !data.run) throw new Error(data.error ?? "Erreur lors du lancement.");
      setSuccess(data.run);
      setPayload((prev) =>
        prev ? {
          ...prev,
          runs: [data.run!, ...prev.runs],
          stats: { ...prev.stats, total: prev.stats.total + 1, completed: prev.stats.completed + 1, prospectsFound: prev.stats.prospectsFound + data.run!.foundCount, runsThisMonth: prev.stats.runsThisMonth + 1 }
        } : prev
      );
      setManuallyEdited(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du lancement.");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <SaasPortalShell title="Nouveau sourcing" subtitle="">
        <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-line bg-panel">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </SaasPortalShell>
    );
  }

  return (
    <SaasPortalShell
      title="Nouveau sourcing"
      subtitle="Choisis ton agent, décris ta cible et lance une vraie recherche."
    >
      <div className="space-y-6">

        {!payload?.module.accessible && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            L'acces sourcing n'est pas actif pour ce compte. Active-le depuis l'administration avant de lancer une recherche.
          </div>
        )}

        {/* ── Choix de l'agent ── */}
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">Étape 1</p>
              <h3 className="mt-1 text-lg font-bold">Choisis ton agent</h3>
            </div>
            <Link href="/user/agents" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-gold">
              <Bot className="h-3.5 w-3.5" /> Configurer
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {agents.map((agent) => {
              const isSelected = agent.agentKey === selectedAgentKey;
              const isSerper = agent.agentKey === "sourcing-serper";
              const ready = isSerper ? Boolean(payload?.providers.serper.configured) : Boolean(payload?.providers.tavily.configured);
              return (
                <button
                  key={agent.agentKey}
                  type="button"
                  onClick={() => { setSelectedAgentKey(agent.agentKey); setManuallyEdited(false); }}
                  className={`rounded-2xl border p-4 text-left transition ${isSelected ? "border-gold/60 bg-gold/10 shadow-lg shadow-gold/5" : "border-line bg-ink hover:border-gold/30"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${isSerper ? "border-violet-500/20 bg-violet-500/10" : "border-sky-500/20 bg-sky-500/10"}`}>
                      <Radar className={`h-5 w-5 ${isSerper ? "text-violet-400" : "text-sky-400"}`} />
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      !agent.isEnabled ? "bg-amber-500/15 text-amber-300" : ready ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"
                    }`}>
                      {!agent.isEnabled ? "En pause" : ready ? "Prêt" : "À configurer"}
                    </span>
                  </div>
                  <p className="mt-3 font-bold text-zinc-100">{agent.displayName}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {isSerper ? "Découverte rapide — trouve vite des pistes et entreprises." : "Qualification profonde — lit et analyse les pages en détail."}
                  </p>
                  {isSelected && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-gold"><CheckCircle2 className="h-3.5 w-3.5" /> Sélectionné</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Formulaire brief ── */}
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Étape 2</p>
            <h3 className="mt-1 text-lg font-bold">Décris ta cible</h3>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Mots-clés de recherche *</label>
              <input
                type="text"
                placeholder="ex: cliniques privées Abidjan, agences web Dakar..."
                value={form.brief}
                onChange={(e) => { setManuallyEdited(true); setForm((f) => ({ ...f, brief: e.target.value })); }}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Tag className="mb-0.5 mr-1 inline h-3 w-3" />Secteur
              </label>
              <input
                type="text"
                placeholder="ex: Santé, Commerce, Tech..."
                value={form.sector}
                onChange={(e) => { setManuallyEdited(true); setForm((f) => ({ ...f, sector: e.target.value })); }}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <MapPin className="mb-0.5 mr-1 inline h-3 w-3" />Zone géographique
              </label>
              <input
                type="text"
                placeholder="ex: Abidjan, Dakar, Maroc..."
                value={form.zone}
                onChange={(e) => { setManuallyEdited(true); setForm((f) => ({ ...f, zone: e.target.value })); }}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Target className="mb-0.5 mr-1 inline h-3 w-3" />Nombre de prospects visés
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.targetCount}
                onChange={(e) => { setManuallyEdited(true); setForm((f) => ({ ...f, targetCount: e.target.value })); }}
                className="mt-2 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-zinc-100 focus:border-gold/40 focus:outline-none"
              />
              <p className="mt-1 text-xs text-zinc-600">Maximum 50 prospects par run.</p>
            </div>
          </div>

          {/* Alertes */}
          {selectedAgent && !providerReady && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {selectedAgent.missionConfig.source} n'est pas configuré. Contacte l'administrateur.
            </div>
          )}
          {selectedAgent && !selectedAgent.isEnabled && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Cet agent est en pause. Active-le depuis la page Agents.
            </div>
          )}

          {/* Bouton lancer */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void runSourcing()}
              disabled={running || !canRun}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gold px-6 text-sm font-bold text-black shadow-lg shadow-gold/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Recherche en cours..." : selectedAgent ? `Lancer avec ${selectedAgent.displayName}` : "Choisir un agent"}
            </button>
            {!form.brief.trim() && <p className="text-xs text-zinc-600">Entre des mots-clés pour commencer.</p>}
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        )}

        {/* ── Résultats du run ── */}
        {success && (
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Run terminé</p>
                <p className="font-bold text-zinc-100">{success.foundCount} prospect{success.foundCount > 1 ? "s" : ""} trouvé{success.foundCount > 1 ? "s" : ""}</p>
              </div>
              <Link href="/user/prospects" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-amber-400">
                Voir tout <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {success.prospects.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {success.prospects.slice(0, 6).map((p) => (
                    <div key={p.id} className="rounded-2xl border border-line bg-ink p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-zinc-100">{p.company}</p>
                        <span
                          className={`shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-bold ${
                            normalizeProspectScore(p.score) >= 8
                              ? "bg-emerald-500/15 text-emerald-300"
                              : normalizeProspectScore(p.score) >= 5
                                ? "bg-gold/15 text-gold"
                                : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {normalizeProspectScore(p.score)}/10
                        </span>
                      </div>
                      {p.name && p.name !== p.company && <p className="mt-0.5 text-xs text-zinc-500">{p.name}</p>}
                      {(p.snippet || p.summary) && <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{p.snippet || p.summary}</p>}
                      {p.website && (
                      <a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:text-amber-400">
                        <ExternalLink className="h-3 w-3" />{p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </SaasPortalShell>
  );
}
