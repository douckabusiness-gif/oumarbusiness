"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";

type HistoryRun = {
  id: string;
  agentKey?: string | null;
  status?: string | null;
  keywords?: string | null;
  sector?: string | null;
  zone?: string | null;
  keptCount?: number | null;
  createdAt: string;
  sessionId?: string | null;
  cycleIndex?: number | null;
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

type HistoryPayload = {
  runs?: HistoryRun[];
  history?: HistoryRun[];
  items?: HistoryRun[];
  liveFeed?: LiveEvent[];
  feed?: LiveEvent[];
};

function agentName(agentKey?: string | null) {
  if (agentKey === "sourcing-serper") {
    return "Agent Serper";
  }

  if (agentKey === "sourcing-tavily") {
    return "Agent Tavily";
  }

  return "Agent sourcing";
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : null) ?? "Impossible de charger l’historique.";
    throw new Error(message);
  }

  return payload as T;
}

function statusTone(status?: string | null) {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "running":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "paused":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "blocked":
    case "failed":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

export default function UserHistoryPage() {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [historyPayload, livePayload] = await Promise.all([
        fetchJson<HistoryPayload>("/api/sourcing/history"),
        fetchJson<HistoryPayload>("/api/sourcing/agents/live/feed"),
      ]);

      setRuns(
        Array.isArray(historyPayload)
          ? historyPayload
          : historyPayload.runs ??
              historyPayload.history ??
              historyPayload.items ??
              [],
      );
      setEvents(
        Array.isArray(livePayload)
          ? livePayload
          : livePayload.feed ?? livePayload.liveFeed ?? [],
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l’historique.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const groupedRuns = useMemo(() => {
    const map = new Map<string, HistoryRun[]>();

    for (const run of runs) {
      const key = run.sessionId || `manual-${run.id}`;
      const bucket = map.get(key) ?? [];
      bucket.push(run);
      map.set(key, bucket);
    }

    return [...map.entries()].sort((left, right) => {
      const rightDate = right[1][0]?.createdAt ? Date.parse(right[1][0].createdAt) : 0;
      const leftDate = left[1][0]?.createdAt ? Date.parse(left[1][0].createdAt) : 0;
      return rightDate - leftDate;
    });
  }, [runs]);

  return (
    <SaasPortalShell
      title="Historique"
      subtitle="Suis les cycles live, les runs executes et les evenements des agents."
    >
      <div className="space-y-8">
        <section className="flex justify-end">
          <Link
            href="/user/agents"
            className="inline-flex items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-400/15"
          >
            Retour au centre live
          </Link>
        </section>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Runs par session</div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Cycles enregistres</h2>
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              {loading ? "Chargement…" : `${runs.length} run(s)`}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            {groupedRuns.length === 0 ? (
              <EmptyState
                title="Aucun historique pour l’instant"
                body="Lance les agents live ou un run manuel pour remplir cette page."
              />
            ) : (
              groupedRuns.map(([sessionId, sessionRuns]) => (
                <div
                  key={sessionId}
                  className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {sessionId.startsWith("manual-")
                          ? "Run manuel"
                          : `Session ${sessionId.slice(0, 8)}`}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        Dernier mouvement : {formatDateTime(sessionRuns[0]?.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{sessionRuns.length} cycle(s)</Badge>
                      {!sessionId.startsWith("manual-") ? <Badge>ID {sessionId.slice(0, 8)}</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {sessionRuns.map((run) => (
                      <div
                        key={run.id}
                        className="rounded-2xl border border-zinc-800 bg-black/30 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{agentName(run.agentKey)}</div>
                            <div className="mt-1 text-sm text-zinc-400">
                              {run.keywords || "Mission live sauvegardee"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(run.status)}`}
                            >
                              {run.status ?? "completed"}
                            </span>
                            {run.cycleIndex != null ? <Badge>Cycle {run.cycleIndex}</Badge> : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-zinc-400 md:grid-cols-4">
                          <InfoCell label="Secteur" value={run.sector ?? "—"} />
                          <InfoCell label="Zone" value={run.zone ?? "—"} />
                          <InfoCell label="Retenus" value={String(run.keptCount ?? 0)} />
                          <InfoCell label="Lance le" value={formatDateTime(run.createdAt)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Flux live fusionne</div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Evenements recents</h2>
            </div>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
              {loading ? "Chargement…" : `${events.length} event(s)`}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {events.length === 0 ? (
              <EmptyState
                title="Aucun evenement live"
                body="Les demarrages de cycle, erreurs provider et prospects retenus apparaitront ici."
              />
            ) : (
              events.slice(0, 12).map((event) => (
                <div key={event.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{event.message}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {agentName(event.agentKey)} • {event.type}
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
        </div>
      </section>
      </div>
    </SaasPortalShell>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <div className="mt-1 text-zinc-200">{value}</div>
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-6 text-center">
      <div className="text-sm font-medium text-white">{title}</div>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </div>
  );
}
