"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";

type AgentMetrics = {
  runs?: number;
  prospects?: number;
  conversions?: number;
  sources?: number;
  lastRunAt?: string | null;
};

type AgentConfig = {
  id: string;
  agentKey: string;
  name: string;
  enabled?: boolean;
  source?: string | null;
  keywords?: string | null;
  instructions?: string | null;
  defaultSector?: string | null;
  defaultZone?: string | null;
  defaultTargetCount?: number | null;
  metrics?: AgentMetrics;
};

type LiveSession = {
  id: string;
  status: "idle" | "running" | "paused" | "stopped" | "blocked" | "completed";
  activeAgentKeys: string[];
  pausedAgentKeys: string[];
  brief: string;
  agentBriefs?: Partial<Record<"sourcing-serper" | "sourcing-tavily", string>>;
  stopReason?: string | null;
  cycleCount: number;
  lastCycleAt?: string | null;
};

type LiveEvent = {
  id: string;
  agentKey?: string | null;
  type: string;
  message: string;
  createdAt: string;
  sessionId: string;
  cycleIndex?: number | null;
};

type LiveQuota = {
  monthlyRunLimit: number | null;
  monthlyRunsUsed: number;
  monthlyRunsRemaining: number | null;
  monthlyProspectsKept: number;
  canRun: boolean;
};

type LivePayload = {
  session?: LiveSession | null;
  liveSession?: LiveSession | null;
  feed?: LiveEvent[];
  liveFeed?: LiveEvent[];
  quota?: LiveQuota | null;
};

type AgentPayload = Array<{
  id: string;
  agentKey: string;
  displayName?: string | null;
  isEnabled?: boolean;
  missionConfig?: {
    source?: string | null;
    keywords?: string | null;
    qualificationInstructions?: string | null;
    defaultSector?: string | null;
    defaultZone?: string | null;
    defaultTargetCount?: number | null;
  } | null;
  metrics?: AgentMetrics;
}> | { agents?: Array<{
  id: string;
  agentKey: string;
  displayName?: string | null;
  isEnabled?: boolean;
  missionConfig?: {
    source?: string | null;
    keywords?: string | null;
    qualificationInstructions?: string | null;
    defaultSector?: string | null;
    defaultZone?: string | null;
    defaultTargetCount?: number | null;
  } | null;
  metrics?: AgentMetrics;
}> };

function agentLabel(agentKey: string) {
  if (agentKey === "sourcing-serper") {
    return "Agent Découverte";
  }

  if (agentKey === "sourcing-tavily") {
    return "Agent Qualification";
  }

  return "Agent sourcing";
}

function agentDescription(agentKey: string) {
  if (agentKey === "sourcing-serper") {
    return "Trouve rapidement de nouvelles entreprises et pistes pertinentes.";
  }

  if (agentKey === "sourcing-tavily") {
    return "Analyse les prospects trouves et retient les plus serieux.";
  }

  return "Agent de sourcing.";
}

function normalizeAgent(payload: {
  id: string;
  agentKey: string;
  displayName?: string | null;
  isEnabled?: boolean;
  missionConfig?: {
    source?: string | null;
    keywords?: string | null;
    qualificationInstructions?: string | null;
    defaultSector?: string | null;
    defaultZone?: string | null;
    defaultTargetCount?: number | null;
  } | null;
  metrics?: AgentMetrics;
}): AgentConfig {
  return {
    id: payload.id,
    agentKey: payload.agentKey,
    name: agentLabel(payload.agentKey),
    enabled: payload.isEnabled ?? true,
    source: payload.missionConfig?.source ?? null,
    keywords: payload.missionConfig?.keywords ?? null,
    instructions: payload.missionConfig?.qualificationInstructions ?? null,
    defaultSector: payload.missionConfig?.defaultSector ?? null,
    defaultZone: payload.missionConfig?.defaultZone ?? null,
    defaultTargetCount: payload.missionConfig?.defaultTargetCount ?? null,
    metrics: payload.metrics,
  };
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function parseJson<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parseJson<T & { error?: string }>(response);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Chargement impossible.");
  }
  return payload as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await parseJson<T & { error?: string }>(response);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Action impossible.");
  }
  return (payload ?? ({} as T)) as T;
}

function isConfigured(agent: AgentConfig) {
  return Boolean(
    agent.source?.trim() &&
      agent.keywords?.trim() &&
      agent.instructions?.trim() &&
      typeof agent.defaultTargetCount === "number" &&
      agent.defaultTargetCount > 0,
  );
}

function getConfigurationIssues(agent: AgentConfig) {
  const issues: string[] = [];
  if (!agent.source?.trim()) issues.push("source manquante");
  if (!agent.keywords?.trim()) issues.push("mots-cles manquants");
  if (!agent.instructions?.trim()) issues.push("instructions manquantes");
  if (
    typeof agent.defaultTargetCount !== "number" ||
    Number.isNaN(agent.defaultTargetCount) ||
    agent.defaultTargetCount <= 0
  ) {
    issues.push("nombre cible invalide");
  }
  return issues;
}

function liveSessionLabel(session: LiveSession | null) {
  switch (session?.status) {
    case "running":
      return "EN LIGNE";
    case "paused":
      return "EN PAUSE";
    case "blocked":
      return "BLOQUE";
    case "completed":
      return "TERMINE";
    case "stopped":
      return "ARRETE";
    default:
      return "INACTIF";
  }
}

function agentStatus(agent: AgentConfig, session: LiveSession | null) {
  if (session?.activeAgentKeys.includes(agent.agentKey) && session.status === "running") {
    return "EN LIGNE";
  }
  if (session?.pausedAgentKeys.includes(agent.agentKey)) {
    return "EN PAUSE";
  }
  if (session?.status === "blocked" && session.activeAgentKeys.includes(agent.agentKey)) {
    return "BLOQUE";
  }
  return isConfigured(agent) ? "PRET" : "A CONFIGURER";
}

export default function UserAgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [briefs, setBriefs] = useState<Partial<Record<"sourcing-serper" | "sourcing-tavily", string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [agentsPayload, livePayload] = await Promise.all([
        fetchJson<AgentPayload>("/api/sourcing/agents"),
        fetchJson<LivePayload>("/api/sourcing/agents/live"),
      ]);

      const rawAgents = Array.isArray(agentsPayload) ? agentsPayload : agentsPayload.agents ?? [];
      setAgents(rawAgents.map((item) => normalizeAgent(item)));
      setLive(livePayload);
      setBriefs((current) => ({
        "sourcing-serper":
          current["sourcing-serper"] ??
          livePayload.session?.agentBriefs?.["sourcing-serper"] ??
          livePayload.liveSession?.agentBriefs?.["sourcing-serper"] ??
          "",
        "sourcing-tavily":
          current["sourcing-tavily"] ??
          livePayload.session?.agentBriefs?.["sourcing-tavily"] ??
          livePayload.liveSession?.agentBriefs?.["sourcing-tavily"] ??
          "",
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le centre live.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  const liveSession = live?.session ?? live?.liveSession ?? null;
  const liveFeed = live?.feed ?? live?.liveFeed ?? [];
  const quota = live?.quota ?? null;

  const runAction = useCallback(
    async (action: "start" | "pause" | "resume" | "stop", agentKey?: "sourcing-serper" | "sourcing-tavily") => {
      const key = agentKey ? `${action}:${agentKey}` : `${action}:all`;
      setBusyAction(key);
      try {
        const payload =
          action === "start"
            ? agentKey
              ? { agentKey, brief: (briefs[agentKey] ?? "").trim() }
              : {}
            : agentKey
              ? { agentKey }
              : {};
        await postJson(`/api/sourcing/agents/live/${action}`, payload);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      } finally {
        setBusyAction(null);
      }
    },
    [briefs, load],
  );

  const totalRuns = useMemo(() => agents.reduce((sum, item) => sum + (item.metrics?.runs ?? 0), 0), [agents]);
  const totalProspects = useMemo(() => agents.reduce((sum, item) => sum + (item.metrics?.prospects ?? 0), 0), [agents]);

  return (
    <SaasPortalShell title="Agents" subtitle="Chaque agent a sa propre zone de demande. Ecris, puis lance seulement celui dont tu as besoin.">
      <div className="space-y-8">
        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Agents" value={loading ? "…" : String(agents.length)} />
          <MetricCard label="Runs" value={loading ? "…" : String(totalRuns)} />
          <MetricCard label="Prospects" value={loading ? "…" : String(totalProspects)} />
          <MetricCard label="Session" value={loading ? "…" : liveSessionLabel(liveSession)} />
          <MetricCard label="Runs restants" value={quota?.monthlyRunsRemaining == null ? "Illimite" : String(quota.monthlyRunsRemaining)} />
        </section>

        {liveSession?.stopReason ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 px-5 py-4 text-sm text-zinc-300">
            {liveSession.stopReason}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          {agents.map((agent) => {
            const status = agentStatus(agent, liveSession);
            const configured = isConfigured(agent);
            const issues = getConfigurationIssues(agent);
            const isRunning = liveSession?.activeAgentKeys.includes(agent.agentKey) && liveSession.status === "running";
            const isPaused = liveSession?.pausedAgentKeys.includes(agent.agentKey) ?? false;
            const agentBrief = briefs[agent.agentKey as "sourcing-serper" | "sourcing-tavily"] ?? "";

            return (
              <article key={agent.agentKey} className="rounded-[30px] border border-zinc-800 bg-zinc-950/70 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-zinc-800 bg-indigo-500/10 text-3xl text-indigo-300">
                      {agent.agentKey === "sourcing-serper" ? "S" : "T"}
                    </div>
                    <div>
                      <h2 className="text-3xl font-semibold text-white">{agentLabel(agent.agentKey)}</h2>
                      <p className="mt-2 text-sm text-zinc-400">{agentDescription(agent.agentKey)}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      status === "EN LIGNE"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : status === "EN PAUSE"
                          ? "bg-amber-500/15 text-amber-200"
                          : status === "BLOQUE"
                            ? "bg-rose-500/15 text-rose-200"
                            : status === "PRET"
                              ? "bg-sky-500/15 text-sky-200"
                              : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <MiniMetric label="Sources" value={String(agent.metrics?.sources ?? 0)} />
                  <MiniMetric label="Leads" value={String(agent.metrics?.prospects ?? 0)} />
                  <MiniMetric label="Conv." value={String(agent.metrics?.conversions ?? 0)} />
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm text-zinc-300">
                  <div>
                    <span className="text-zinc-500">Template:</span>{" "}
                    {agent.keywords?.trim() ? agent.keywords : "Mission par defaut non definie"}
                  </div>
                  <div className="mt-2">
                    <span className="text-zinc-500">Mode:</span>{" "}
                    {agent.agentKey === "sourcing-serper" ? "Exploration rapide" : "Analyse approfondie"}
                  </div>
                  <div className="mt-2">
                    <span className="text-zinc-500">Cible par cycle:</span>{" "}
                    {agent.defaultTargetCount ?? "N/A"} prospects
                  </div>
                  {(agent.defaultSector || agent.defaultZone) ? (
                    <div className="mt-2">
                      <span className="text-zinc-500">Cadre par defaut:</span>{" "}
                      {[agent.defaultSector, agent.defaultZone].filter(Boolean).join(" • ")}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Ta demande pour cet agent</div>
                  <textarea
                    value={agentBrief}
                    onChange={(event) =>
                      setBriefs((current) => ({
                        ...current,
                        [agent.agentKey]: event.target.value,
                      }))
                    }
                    placeholder={
                      agent.agentKey === "sourcing-serper"
                        ? "Ex: Trouve des cabinets comptables a Paris avec une page contact."
                        : "Ex: Analyse des cabinets comptables a Paris et retiens les plus serieux."
                    }
                    rows={4}
                    className="w-full resize-none rounded-3xl border border-zinc-800 bg-black px-5 py-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-gold/40"
                  />
                </div>

                {!configured ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    Cet agent doit etre complete dans l’admin sourcing avant utilisation: {issues.join(", ")}.
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {!isRunning && !isPaused ? (
                    <button
                      type="button"
                      onClick={() => void runAction("start", agent.agentKey as "sourcing-serper" | "sourcing-tavily")}
                      disabled={!configured || !agentBrief.trim() || busyAction === `start:${agent.agentKey}`}
                      className="inline-flex min-h-12 min-w-[170px] items-center justify-center rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-black shadow-gold transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-300 disabled:shadow-none"
                    >
                      {busyAction === `start:${agent.agentKey}` ? "Patiente..." : `Lancer ${agent.agentKey === "sourcing-serper" ? "Découverte" : "Qualification"}`}
                    </button>
                  ) : null}

                  {isPaused ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void runAction("resume", agent.agentKey as "sourcing-serper" | "sourcing-tavily")}
                        disabled={busyAction === `resume:${agent.agentKey}`}
                        className="inline-flex min-h-12 min-w-[150px] items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === `resume:${agent.agentKey}` ? "Patiente..." : "Reprendre"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction("stop", agent.agentKey as "sourcing-serper" | "sourcing-tavily")}
                        disabled={busyAction === `stop:${agent.agentKey}`}
                        className="inline-flex min-h-12 min-w-[140px] items-center justify-center rounded-2xl border border-rose-500/35 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === `stop:${agent.agentKey}` ? "Patiente..." : "Arreter"}
                      </button>
                    </>
                  ) : null}

                  {isRunning ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void runAction("pause", agent.agentKey as "sourcing-serper" | "sourcing-tavily")}
                        disabled={busyAction === `pause:${agent.agentKey}`}
                        className="inline-flex min-h-12 min-w-[140px] items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === `pause:${agent.agentKey}` ? "Patiente..." : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction("stop", agent.agentKey as "sourcing-serper" | "sourcing-tavily")}
                        disabled={busyAction === `stop:${agent.agentKey}`}
                        className="inline-flex min-h-12 min-w-[140px] items-center justify-center rounded-2xl border border-rose-500/35 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyAction === `stop:${agent.agentKey}` ? "Patiente..." : "Arreter"}
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="mt-5 text-xs text-zinc-500">Dernier run: {formatDateTime(agent.metrics?.lastRunAt)}</div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[30px] border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Flux live fusionne</div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Evenements recents</h2>
            </div>
            <div className="flex gap-3">
              <Link href="/user/prospects" className="text-sm font-medium text-zinc-300 hover:text-white">
                Mes prospects
              </Link>
              <Link href="/user/history" className="text-sm font-medium text-amber-300 hover:text-amber-200">
                Historique
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {liveFeed.length === 0 ? (
              <EmptyState>
                Aucun evenement live pour le moment. Ecris une demande dans la carte de l’agent puis lance-le.
              </EmptyState>
            ) : (
              liveFeed.slice(0, 12).map((event) => (
                <div key={event.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{event.message}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {event.agentKey ? agentLabel(event.agentKey) : "Session"} • {event.type}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{event.sessionId.slice(0, 8)}</Badge>
                      {event.cycleIndex != null ? <Badge>Cycle {event.cycleIndex}</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">{formatDateTime(event.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </SaasPortalShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-center">
      <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300">
      {children}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-8 text-center text-sm text-zinc-400">
      {children}
    </div>
  );
}
