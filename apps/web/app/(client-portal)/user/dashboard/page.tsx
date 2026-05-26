"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";

type SessionStatus = "idle" | "running" | "paused" | "stopped" | "blocked" | "completed";

type WorkspaceRun = {
  id: string;
  agentKey: string;
  createdAt: string;
  status?: string;
  keywords?: string;
  sector?: string | null;
  zone?: string | null;
  keptCount?: number;
  foundCount?: number;
  sessionId?: string | null;
  cycleIndex?: number | null;
};

type WorkspaceProspect = {
  id: string;
  name?: string | null;
  title?: string | null;
  summary?: string | null;
  url?: string | null;
  agentKey?: string | null;
  score?: number | null;
  createdAt?: string | null;
};

type ActiveSubscription = {
  planName: string;
  monthlyPrice: number;
  status: string;
  startDate: string;
  nextBillingDate: string;
  accessible: boolean;
};

type QuotaView = {
  planName?: string | null;
  maxRunsPerMonth?: number | null;
  maxProspectsPerRun?: number | null;
  runsThisMonth?: number;
  runsRemaining?: number | null;
  monthlyRunLimit?: number | null;
  monthlyRunsUsed?: number;
  monthlyRunsRemaining?: number | null;
  monthlyProspectsKept?: number;
  canRun?: boolean;
};

type LiveSession = {
  id: string;
  status: SessionStatus;
  activeAgentKeys: string[];
  stopReason?: string | null;
  cycleCount: number;
  lastCycleAt?: string | null;
  startedAt: string;
  updatedAt: string;
};

type WorkspacePayload = {
  module?: {
    key: string;
    title: string;
    accessible: boolean;
    subscription: ActiveSubscription | null;
  };
  runs?: WorkspaceRun[];
  stats?: {
    total: number;
    completed: number;
    prospectsFound: number;
    runsThisMonth: number;
    prospectsThisMonth: number;
  };
  liveSession?: LiveSession | null;
  quota?: QuotaView | null;
};

type ProspectPayload = {
  prospects?: WorkspaceProspect[];
  items?: WorkspaceProspect[];
};

function formatDate(value?: string | null) {
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
    year: "numeric",
  }).format(date);
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

function formatCurrency(amount?: number | null) {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "—";
  }

  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

function normalizeScore(score?: number | null) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return "—";
  }

  if (score <= 10) {
    return `${Math.max(0, Math.min(10, Math.round(score)))}/10`;
  }

  return `${Math.max(0, Math.min(10, Math.round(score / 10)))}/10`;
}

function sessionLabel(status?: SessionStatus | null) {
  switch (status) {
    case "running":
      return "En ligne";
    case "paused":
      return "En pause";
    case "blocked":
      return "Bloque";
    case "completed":
      return "Termine";
    case "stopped":
      return "Arrete";
    default:
      return "Inactif";
  }
}

function sessionTone(status?: SessionStatus | null) {
  switch (status) {
    case "running":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "paused":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "blocked":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "completed":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "stopped":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-200";
    default:
      return "border-zinc-700 bg-zinc-900 text-zinc-300";
  }
}

function agentName(agentKey?: string | null) {
  if (agentKey === "sourcing-serper") {
    return "Agent Serper";
  }

  if (agentKey === "sourcing-tavily") {
    return "Agent Tavily";
  }

  return "Agent sourcing";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : null) ?? "Impossible de charger le tableau de bord.";
    throw new Error(message);
  }

  return payload as T;
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      {helper ? <div className="mt-2 text-sm text-zinc-400">{helper}</div> : null}
    </div>
  );
}

export default function UserDashboardPage() {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [prospects, setProspects] = useState<WorkspaceProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [workspacePayload, prospectsPayload] = await Promise.all([
        fetchJson<WorkspacePayload>("/api/sourcing/modules/sourcing-commercial/workspace"),
        fetchJson<ProspectPayload>("/api/sourcing/prospects").catch(() => ({ prospects: [], items: [] })),
      ]);

      setWorkspace(workspacePayload);
      setProspects(
        Array.isArray(prospectsPayload)
          ? prospectsPayload
          : prospectsPayload.prospects ?? prospectsPayload.items ?? [],
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const moduleData = workspace?.module ?? null;
  const latestRuns = workspace?.runs ?? [];
  const stats = workspace?.stats ?? null;
  const quota = workspace?.quota ?? null;
  const liveSession = workspace?.liveSession ?? null;
  const activeSubscription = moduleData?.subscription ?? null;

  const runCount = stats?.total ?? latestRuns.length;
  const completedRuns =
    stats?.completed ?? latestRuns.filter((item) => item.status === "completed").length;
  const retainedProspects =
    stats?.prospectsFound ??
    latestRuns.reduce((sum, item) => sum + (item.keptCount ?? item.foundCount ?? 0), 0);

  const runsUsed = quota?.monthlyRunsUsed ?? quota?.runsThisMonth ?? stats?.runsThisMonth ?? 0;
  const runsRemainingRaw = quota?.monthlyRunsRemaining ?? quota?.runsRemaining;
  const runsRemaining =
    typeof runsRemainingRaw === "number" && Number.isFinite(runsRemainingRaw)
      ? runsRemainingRaw
      : null;
  const monthlyLimit = quota?.monthlyRunLimit ?? quota?.maxRunsPerMonth ?? null;
  const prospectsThisMonth =
    quota?.monthlyProspectsKept ?? stats?.prospectsThisMonth ?? prospects.length;
  const canRun =
    quota?.canRun ??
    (Boolean(moduleData?.accessible) && (runsRemaining === null || runsRemaining > 0));

  const liveAgentsLabel = liveSession?.activeAgentKeys?.length
    ? liveSession.activeAgentKeys.map(agentName).join(" + ")
    : "Aucun agent en cours";

  const recentProspects = useMemo(
    () =>
      [...prospects]
        .sort((left, right) => {
          const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return rightTime - leftTime;
        })
        .slice(0, 4),
    [prospects],
  );

  const runsRemainingValue = !activeSubscription
    ? "—"
    : runsRemaining === null
      ? "Illimite"
      : String(runsRemaining);
  const runsRemainingHelper = !activeSubscription
    ? "Active un plan sourcing pour debloquer le quota."
    : monthlyLimit == null
      ? "Plan sans plafond fixe"
      : `Limite mensuelle ${monthlyLimit}`;

  return (
    <SaasPortalShell
      title="Tableau de bord"
      subtitle="Suis l'activite, le quota et l'etat de tes agents sourcing."
    >
      <div className="space-y-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-zinc-500">Vue d&apos;ensemble</div>
            <h2 className="mt-3 text-4xl font-semibold text-white">Activite sourcing</h2>
            <p className="mt-2 max-w-3xl text-base text-zinc-400">
              Surveille tes cycles, ouvre le centre live et garde un oeil propre sur ton abonnement.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/user/agents"
              className="inline-flex items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-400/15"
            >
              Ouvrir le centre live
            </Link>
            <Link
              href="/user/subscription"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
            >
              Gerer l&apos;abonnement
            </Link>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Runs total"
            value={loading ? "…" : String(runCount)}
            helper={`${runsUsed} utilise(s) ce mois`}
          />
          <MetricCard
            label="Completes"
            value={loading ? "…" : String(completedRuns)}
            helper={liveSession ? `${liveSession.cycleCount} cycle(s) live` : "Aucun cycle live"}
          />
          <MetricCard
            label="Prospects retenus"
            value={loading ? "…" : String(retainedProspects)}
            helper={`${prospectsThisMonth} garde(s) ce mois`}
          />
          <MetricCard
            label="Runs restants"
            value={loading ? "…" : runsRemainingValue}
            helper={runsRemainingHelper}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Mode live</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">Centre de pilotage</h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Lance chaque agent depuis sa carte, suis les cycles et arrete proprement quand tu le souhaites.
                </p>
              </div>
              <div
                className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium ${sessionTone(
                  liveSession?.status,
                )}`}
              >
                {sessionLabel(liveSession?.status)}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Agents actifs</div>
                <div className="mt-3 text-lg font-medium text-white">{liveAgentsLabel}</div>
                <div className="mt-2 text-sm text-zinc-400">
                  Dernier cycle : {formatDateTime(liveSession?.lastCycleAt)}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Quota & acces</div>
                <div className="mt-3 text-lg font-medium text-white">
                  {!activeSubscription
                    ? "Aucun plan actif"
                    : canRun
                      ? "Pret a tourner"
                      : "Quota ou acces bloque"}
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  {!activeSubscription
                    ? "Active ton abonnement pour debloquer les runs live."
                    : runsRemaining === null
                      ? "Runs restants illimites"
                      : `${runsRemaining} run(s) restant(s) ce mois`}
                </div>
              </div>
            </div>

            {liveSession?.stopReason ? (
              <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {liveSession.stopReason}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/user/agents"
                className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
              >
                Ouvrir les agents
              </Link>
              <Link
                href="/user/history"
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
              >
                Voir l&apos;historique
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
            <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Mon abonnement</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {activeSubscription?.planName ?? "Aucun plan actif"}
            </h2>
            <div className="mt-2 text-sm text-zinc-400">
              {activeSubscription
                ? `Statut : ${activeSubscription.status}`
                : "Active un plan pour debloquer les runs live et les limites associees."}
            </div>

            <div className="mt-6 grid gap-3">
              <InfoRow
                label="Prix mensuel"
                value={activeSubscription ? formatCurrency(activeSubscription.monthlyPrice) : "—"}
              />
              <InfoRow
                label="Debut"
                value={activeSubscription ? formatDate(activeSubscription.startDate) : "—"}
              />
              <InfoRow
                label="Prochain paiement"
                value={activeSubscription ? formatDate(activeSubscription.nextBillingDate) : "—"}
              />
              <InfoRow label="Runs restants" value={runsRemainingValue} />
            </div>

            <Link
              href="/user/subscription"
              className="mt-6 inline-flex items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-400/15"
            >
              Gerer l&apos;abonnement
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <QuickLink
            href="/user/agents"
            title="Centre live"
            body="Configure puis lance chaque agent depuis sa carte dediee."
          />
          <QuickLink
            href="/user/prospects"
            title="Mes prospects"
            body={`${recentProspects.length} prospect(s) recent(s) deja retenu(s) par tes agents.`}
          />
          <QuickLink
            href="/user/history"
            title="Historique"
            body="Retrouve les cycles, runs et evenements recents de tes sessions live."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Activite recente</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">Derniers cycles</h2>
              </div>
              <Link href="/user/history" className="text-sm font-medium text-amber-300 hover:text-amber-200">
                Voir tout
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {latestRuns.length === 0 ? (
                <EmptyState
                  title="Aucun run pour l&apos;instant"
                  body="Lance les agents depuis le centre live pour remplir cette zone."
                />
              ) : (
                latestRuns.slice(0, 4).map((run) => (
                  <div key={run.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{agentName(run.agentKey)}</div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {run.keywords || "Cycle live execute"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge>{run.status ?? "completed"}</Badge>
                        {run.cycleIndex != null ? <Badge>Cycle {run.cycleIndex}</Badge> : null}
                        {run.sessionId ? <Badge>Session {run.sessionId.slice(0, 8)}</Badge> : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm text-zinc-400 md:grid-cols-4">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Secteur</div>
                        <div className="mt-1 text-zinc-200">{run.sector || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Zone</div>
                        <div className="mt-1 text-zinc-200">{run.zone || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Prospects retenus</div>
                        <div className="mt-1 text-zinc-200">{run.keptCount ?? run.foundCount ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Lance le</div>
                        <div className="mt-1 text-zinc-200">{formatDateTime(run.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Prospects recents</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">Dernieres retenues</h2>
              </div>
              <Link href="/user/prospects" className="text-sm font-medium text-amber-300 hover:text-amber-200">
                Voir tout
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {recentProspects.length === 0 ? (
                <EmptyState
                  title="Aucun prospect retenu"
                  body="Les prospects qualifies par les agents apparaitront ici."
                />
              ) : (
                recentProspects.map((prospect) => (
                  <div key={prospect.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {prospect.name || prospect.title || "Prospect"}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">{agentName(prospect.agentKey)}</div>
                      </div>
                      <Badge>{normalizeScore(prospect.score)}</Badge>
                    </div>
                    {prospect.summary ? (
                      <p className="mt-3 line-clamp-3 text-sm text-zinc-400">{prospect.summary}</p>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span>{formatDateTime(prospect.createdAt)}</span>
                      {prospect.url ? (
                        <a
                          href={prospect.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-300 hover:text-amber-200"
                        >
                          Ouvrir la source
                        </a>
                      ) : null}
                    </div>
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

function QuickLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-6 transition hover:border-zinc-700 hover:bg-zinc-950"
    >
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
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
