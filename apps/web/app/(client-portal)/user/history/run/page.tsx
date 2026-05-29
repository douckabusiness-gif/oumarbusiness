"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";

type RunProspect = {
  id: string;
  name: string;
  company: string;
  website: string;
  email?: string | null;
  phone?: string | null;
  snippet: string;
  summary: string;
  source: "serper" | "tavily";
  score: number;
};

type RunDetail = {
  id: string;
  agentKey: string;
  status: string;
  brief: string;
  sector: string;
  zone: string;
  foundCount: number;
  createdAt: string;
  sessionId?: string | null;
  cycleIndex?: number | null;
  error?: string | null;
  prospects: RunProspect[];
};

type SessionRun = {
  id: string;
  agentKey?: string | null;
  agentName?: string | null;
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
  agentName?: string | null;
  type: string;
  message: string;
  createdAt: string;
  runId?: string | null;
  sessionId: string;
  cycleIndex?: number | null;
};

type RunDetailPayload = {
  run: RunDetail;
  agentName: string;
  sessionRuns: SessionRun[];
  events: LiveEvent[];
};

function agentName(agentKey?: string | null) {
  if (agentKey === "sourcing-serper") return "Agent Découverte";
  if (agentKey === "sourcing-tavily") return "Agent Qualification";
  return "Agent sourcing";
}

function sourceName(source?: string | null) {
  if (source === "serper") return "Découverte";
  if (source === "tavily") return "Qualification";
  return "Recherche";
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
        : null) ?? "Impossible de charger l'analyse du sourcing.";
    throw new Error(message);
  }

  return payload as T;
}

export default function UserHistoryRunDetailPage() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("id") ?? "";
  const [payload, setPayload] = useState<RunDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!runId) {
      setLoading(false);
      setError("Aucun run de sourcing n'a ete specifie.");
      return;
    }

    try {
      const nextPayload = await fetchJson<RunDetailPayload>(`/api/sourcing/history/${runId}`);
      setPayload(nextPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger l'analyse du sourcing.");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = payload?.run ?? null;
  const prospects = run?.prospects ?? [];
  const events = payload?.events ?? [];
  const otherRuns = useMemo(
    () => (payload?.sessionRuns ?? []).filter((item) => item.id !== run?.id),
    [payload?.sessionRuns, run?.id],
  );

  return (
    <SaasPortalShell
      title="Analyse du sourcing"
      subtitle="Ouvre un run précis pour voir le brief, les résultats retenus et les événements liés."
    >
      <div className="space-y-8">
        <section className="flex flex-wrap justify-end gap-3">
          <Link
            href="/user/history"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
          >
            Retour a l'historique
          </Link>
          <Link
            href="/user/prospects"
            className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
          >
            Mes prospects
          </Link>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 px-6 py-8 text-zinc-300">
            Chargement de l'analyse…
          </div>
        ) : run ? (
          <>
            <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-3xl font-semibold text-white">{payload?.agentName ?? agentName(run.agentKey)}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{run.sessionId ? `Session ${run.sessionId.slice(0, 8)}` : "Run manuel"}</Badge>
                    {run.cycleIndex != null ? <Badge>Cycle {run.cycleIndex}</Badge> : null}
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(run.status)}`}>
                      {run.status}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                  {run.foundCount} prospect(s) retenu(s)
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <InfoCell label="Lance le" value={formatDateTime(run.createdAt)} />
                <InfoCell label="Secteur" value={run.sector || "—"} />
                <InfoCell label="Zone" value={run.zone || "—"} />
                <InfoCell label="Agent" value={agentName(run.agentKey)} />
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/30 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Brief analyse</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-200">{run.brief || "Aucun brief enregistre."}</p>
              </div>

              {run.error ? (
                <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
                  {run.error}
                </div>
              ) : null}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Prospects retenus</div>
                    <h3 className="mt-3 text-2xl font-semibold text-white">Analyse complete</h3>
                  </div>
                  <Badge>{prospects.length} resultat(s)</Badge>
                </div>

                <div className="mt-6 space-y-4">
                  {prospects.length === 0 ? (
                    <EmptyState title="Aucun prospect detaille" body="Ce run n'a pas encore de resultat enregistre." />
                  ) : (
                    prospects.map((prospect) => (
                      <article key={prospect.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-lg font-semibold text-white">{prospect.company || prospect.name}</h4>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge>{sourceName(prospect.source)}</Badge>
                              <Badge>{prospect.score}/10</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-zinc-400 md:grid-cols-2">
                          {prospect.email ? <InfoLinkCell label="Email" value={prospect.email} href={`mailto:${prospect.email}`} /> : null}
                          {prospect.phone ? <InfoLinkCell label="Telephone" value={prospect.phone} href={`tel:${prospect.phone}`} /> : null}
                        </div>

                        {prospect.website ? (
                          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-amber-300">
                            <a href={prospect.website} target="_blank" rel="noreferrer" className="break-all hover:text-amber-200">
                              {prospect.website}
                            </a>
                          </div>
                        ) : null}

                        {prospect.summary ? (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{prospect.summary}</p>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
                  <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Runs lies</div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">Autres cycles</h3>
                  <div className="mt-6 space-y-3">
                    {otherRuns.length === 0 ? (
                      <EmptyState title="Aucun autre cycle" body="Ce run n'est pas rattache a une autre session." />
                    ) : (
                      otherRuns.map((item) => (
                        <Link
                          key={item.id}
                          href={`/user/history/run?id=${item.id}`}
                          className="block rounded-2xl border border-zinc-800 bg-black/30 px-4 py-4 transition hover:border-amber-400/40 hover:bg-zinc-900/80"
                        >
                          <div className="text-sm font-medium text-white">{item.agentName || agentName(item.agentKey)}</div>
                          <div className="mt-1 text-sm text-zinc-400">{item.keywords || "Mission live sauvegardee"}</div>
                          <div className="mt-3 text-xs text-zinc-500">{formatDateTime(item.createdAt)}</div>
                        </Link>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
                  <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Flux lie</div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">Evenements</h3>
                  <div className="mt-6 space-y-3">
                    {events.length === 0 ? (
                      <EmptyState title="Aucun evenement" body="Aucun evenement live rattache a ce sourcing." />
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-zinc-800 bg-black/30 px-4 py-4">
                          <div className="text-sm font-medium text-white">{event.message}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {event.agentName || agentName(event.agentKey)} • {event.type}
                          </div>
                          <div className="mt-3 text-xs text-zinc-500">{formatDateTime(event.createdAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </section>
          </>
        ) : (
          <EmptyState title="Run introuvable" body="Ce sourcing n'existe pas ou n'est plus accessible." />
        )}
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

function InfoLinkCell({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <a href={href} className="mt-1 block break-all text-amber-300 hover:text-amber-200">
        {value}
      </a>
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
