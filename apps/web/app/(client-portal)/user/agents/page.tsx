"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

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

type AgentPayload = AgentConfig[] | { agents?: AgentConfig[] };

type SavePayload = Partial<
  Pick<
    AgentConfig,
    | "name"
    | "enabled"
    | "source"
    | "keywords"
    | "instructions"
    | "defaultSector"
    | "defaultZone"
    | "defaultTargetCount"
  >
>;

function agentLabel(agentKey: string) {
  if (agentKey === "sourcing-serper") {
    return "Agent Serper";
  }

  if (agentKey === "sourcing-tavily") {
    return "Agent Tavily";
  }

  return "Agent sourcing";
}

function agentDescription(agentKey: string) {
  if (agentKey === "sourcing-serper") {
    return "Decouverte rapide — trouve vite des pistes et entreprises.";
  }

  if (agentKey === "sourcing-tavily") {
    return "Qualification profonde — lit et analyse les pages en detail.";
  }

  return "Agent de sourcing.";
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
    throw new Error(payload?.error ?? "Impossible de charger les agents.");
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
    body: body ? JSON.stringify(body) : "{}",
  });

  const payload = await parseJson<T & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Action impossible.");
  }

  return (payload ?? ({} as T)) as T;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJson<T & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Mise a jour impossible.");
  }

  return (payload ?? ({} as T)) as T;
}

function isConfigured(agent: AgentConfig) {
  return Boolean(
    agent.source &&
      agent.keywords &&
      agent.instructions &&
      agent.defaultSector &&
      agent.defaultZone &&
      agent.defaultTargetCount,
  );
}

function cardStatus(agent: AgentConfig, liveSession: LiveSession | null) {
  const active = liveSession?.activeAgentKeys?.includes(agent.agentKey);

  if (active && liveSession?.status === "running") {
    return "EN LIGNE";
  }

  if (active && liveSession?.status === "paused") {
    return "EN PAUSE";
  }

  if (active && liveSession?.status === "blocked") {
    return "BLOQUE";
  }

  if (isConfigured(agent)) {
    return "PRET";
  }

  return "A CONFIGURER";
}

function sourceLabel(value?: string | null) {
  if (!value) {
    return "Web";
  }

  if (value === "serper") {
    return "Serper";
  }

  if (value === "tavily") {
    return "Tavily";
  }

  return value;
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

export default function UserAgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [agentsPayload, livePayload] = await Promise.all([
        fetchJson<AgentPayload>("/api/sourcing/agents"),
        fetchJson<LivePayload>("/api/sourcing/agents/live"),
      ]);

      setAgents(Array.isArray(agentsPayload) ? agentsPayload : agentsPayload.agents ?? []);
      setLive(livePayload);
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

  const handleAgentAction = useCallback(
    async (agentKey: string, action: "start" | "pause" | "resume" | "stop") => {
      setBusyAgent(`${agentKey}:${action}`);
      try {
        await postJson(`/api/sourcing/agents/live/${action}`, { agentKey });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      } finally {
        setBusyAgent(null);
      }
    },
    [load],
  );

  const handleSave = useCallback(
    async (payload: SavePayload) => {
      if (!editing) {
        return;
      }

      setSaving(true);
      try {
        await patchJson(`/api/sourcing/agents/${editing.agentKey}`, payload);
        setEditing(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Enregistrement impossible.");
      } finally {
        setSaving(false);
      }
    },
    [editing, load],
  );

  const totalRuns = useMemo(
    () => agents.reduce((sum, item) => sum + (item.metrics?.runs ?? 0), 0),
    [agents],
  );

  const totalProspects = useMemo(
    () => agents.reduce((sum, item) => sum + (item.metrics?.prospects ?? 0), 0),
    [agents],
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-zinc-500">Espace Utilisateur</div>
          <h1 className="mt-3 text-4xl font-semibold text-white">Agents IA</h1>
          <p className="mt-2 max-w-3xl text-base text-zinc-400">
            Configure chaque agent une fois, puis lance Serper et Tavily separement sans brief manuel partage.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm text-zinc-300">
            {quota?.monthlyRunsRemaining == null
              ? "Runs restants illimites"
              : `${quota.monthlyRunsRemaining} run(s) restant(s)`}
          </div>
          <button
            type="button"
            onClick={() => postJson("/api/sourcing/agents/live/stop", {}).then(load).catch((err: Error) => setError(err.message))}
            className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15"
          >
            Arreter tous les agents
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Agents" value={loading ? "…" : String(agents.length)} />
        <MetricCard label="Runs" value={loading ? "…" : String(totalRuns)} />
        <MetricCard label="Prospects" value={loading ? "…" : String(totalProspects)} />
        <MetricCard
          label="Session live"
          value={loading ? "…" : liveSessionLabel(liveSession)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {agents.map((agent) => {
          const active = liveSession?.activeAgentKeys?.includes(agent.agentKey) ?? false;
          const status = cardStatus(agent, liveSession);
          const configured = isConfigured(agent);
          const actionKeyPrefix = `${agent.agentKey}:`;

          return (
            <article
              key={agent.agentKey}
              className="rounded-[30px] border border-zinc-800 bg-zinc-950/70 p-6"
            >
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
                  <span className="text-zinc-500">KW:</span>{" "}
                  {agent.keywords?.trim() ? agent.keywords : "N/A"}
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500">SRC:</span> {sourceLabel(agent.source)}
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500">Secteur:</span> {agent.defaultSector || "N/A"}
                </div>
                <div className="mt-2">
                  <span className="text-zinc-500">Zone:</span> {agent.defaultZone || "N/A"}
                </div>
              </div>

              {!configured ? (
                <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Cet agent doit etre configure completement avant de pouvoir demarrer.
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {!active ? (
                  <button
                    type="button"
                    onClick={() => void handleAgentAction(agent.agentKey, liveSession ? "resume" : "start")}
                    disabled={!configured || busyAgent?.startsWith(actionKeyPrefix)}
                    className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    {busyAgent === `${agent.agentKey}:${liveSession ? "resume" : "start"}`
                      ? "Patiente..."
                      : liveSession
                        ? "Reprendre"
                        : "Lancer"}
                  </button>
                ) : null}

                {active ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleAgentAction(agent.agentKey, "pause")}
                      disabled={busyAgent === `${agent.agentKey}:pause`}
                      className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed"
                    >
                      {busyAgent === `${agent.agentKey}:pause` ? "Patiente..." : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAgentAction(agent.agentKey, "stop")}
                      disabled={busyAgent === `${agent.agentKey}:stop`}
                      className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-5 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed"
                    >
                      {busyAgent === `${agent.agentKey}:stop` ? "Patiente..." : "Arreter"}
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => setEditing(agent)}
                  className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
                >
                  Configurer
                </button>
              </div>

              <div className="mt-5 text-xs text-zinc-500">
                Dernier run: {formatDateTime(agent.metrics?.lastRunAt)}
              </div>
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
          <Link href="/user/history" className="text-sm font-medium text-amber-300 hover:text-amber-200">
            Voir l’historique
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {liveFeed.length === 0 ? (
            <EmptyState>
              Aucun evenement live pour le moment. Demarre un agent depuis sa carte pour voir apparaitre les cycles ici.
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

      {editing ? (
        <AgentConfigModal
          agent={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}

function AgentConfigModal({
  agent,
  saving,
  onClose,
  onSave,
}: {
  agent: AgentConfig;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: SavePayload) => void;
}) {
  const [name, setName] = useState(agent.name || agentLabel(agent.agentKey));
  const [source, setSource] = useState(agent.source || (agent.agentKey === "sourcing-serper" ? "serper" : "tavily"));
  const [keywords, setKeywords] = useState(agent.keywords || "");
  const [instructions, setInstructions] = useState(agent.instructions || "");
  const [defaultSector, setDefaultSector] = useState(agent.defaultSector || "");
  const [defaultZone, setDefaultZone] = useState(agent.defaultZone || "");
  const [defaultTargetCount, setDefaultTargetCount] = useState(
    String(agent.defaultTargetCount ?? 10),
  );
  const [enabled, setEnabled] = useState(agent.enabled ?? true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[32px] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Configuration agent</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">{agentLabel(agent.agentKey)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Fermer
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Nom agent">
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
          </Field>
          <Field label="Source">
            <select value={source} onChange={(event) => setSource(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none">
              <option value="serper">Serper</option>
              <option value="tavily">Tavily</option>
            </select>
          </Field>
          <Field label="Mots-cles">
            <textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} rows={4} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
          </Field>
          <Field label="Instructions">
            <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={4} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
          </Field>
          <Field label="Secteur par defaut">
            <input value={defaultSector} onChange={(event) => setDefaultSector(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
          </Field>
          <Field label="Zone par defaut">
            <input value={defaultZone} onChange={(event) => setDefaultZone(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
          </Field>
          <Field label="Nombre de prospects par defaut">
            <input value={defaultTargetCount} onChange={(event) => setDefaultTargetCount(event.target.value)} className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none" />
          </Field>
          <Field label="Statut">
            <label className="flex h-full items-center gap-3 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              Agent active
            </label>
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                name,
                source,
                keywords,
                instructions,
                defaultSector,
                defaultZone,
                defaultTargetCount: Number.parseInt(defaultTargetCount, 10) || 10,
                enabled,
              })
            }
            className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      {children}
    </div>
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
