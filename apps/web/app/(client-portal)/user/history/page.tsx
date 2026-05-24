"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Radar,
  Search,
  Tag,
  Target,
  X
} from "lucide-react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import type { SaasSourcingRun } from "@/components/saas/shared";
import { formatDate, normalizeProspectScore } from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

export default function UserHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<SaasSourcingRun[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "serper" | "tavily">("all");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/workspace`, {
          cache: "no-store", credentials: "include"
        });
        if (!res.ok) throw new Error("Impossible de charger l'historique.");
        const data = (await res.json()) as { runs: SaasSourcingRun[] };
        if (active) setRuns((data.runs ?? []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erreur.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    let list = [...runs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.objective || r.brief).toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q)
      );
    }
    if (filterSource !== "all") {
      list = list.filter((r) => r.agentKey === `sourcing-${filterSource}`);
    }
    return list;
  }, [runs, search, filterSource]);

  const totalProspects = useMemo(() => runs.reduce((s, r) => s + r.foundCount, 0), [runs]);

  return (
    <SaasPortalShell
      title="Historique des runs"
      subtitle="Toutes tes recherches de sourcing — clique sur un run pour voir ses prospects."
    >
      <div className="space-y-5">

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Runs total" value={String(runs.length)} />
            <MiniStat label="Complétés" value={String(runs.filter((r) => r.status === "completed").length)} />
            <MiniStat label="Prospects" value={String(totalProspects)} />
          </div>
        )}

        {/* Filtres */}
        {!loading && runs.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher un run..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              {search && <button type="button" onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-zinc-500" /></button>}
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-panel p-1">
              {(["all", "serper", "tavily"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilterSource(v)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${filterSource === v ? "bg-gold text-black" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                  {v === "all" ? "Tous" : v === "serper" ? "Serper" : "Tavily"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-line bg-panel">
            <Loader2 className="h-7 w-7 animate-spin text-gold" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[12rem] items-center justify-center rounded-3xl border border-dashed border-line bg-panel">
            <p className="text-sm text-zinc-500">{runs.length === 0 ? "Aucun historique disponible." : "Aucun résultat pour ces filtres."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                expanded={expandedId === run.id}
                onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
              />
            ))}
          </div>
        )}

        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      </div>
    </SaasPortalShell>
  );
}

function RunCard({ run, expanded, onToggle }: { run: SaasSourcingRun; expanded: boolean; onToggle: () => void }) {
  const isSerper = run.agentKey === "sourcing-serper";
  const statusColor = run.status === "completed" ? "emerald" : run.status === "running" ? "sky" : "zinc";

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-panel">
      {/* Header cliquable */}
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-center gap-4 p-5">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${isSerper ? "border-violet-500/20 bg-violet-500/10" : "border-sky-500/20 bg-sky-500/10"}`}>
            <Radar className={`h-6 w-6 ${isSerper ? "text-violet-400" : "text-sky-400"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-zinc-100">{run.objective || run.brief}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{run.sector || "—"}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{run.zone || "—"}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(run.createdAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              statusColor === "emerald" ? "bg-emerald-500/15 text-emerald-300" :
              statusColor === "sky" ? "bg-sky-500/15 text-sky-300" : "bg-zinc-500/15 text-zinc-400"
            }`}>
              {run.status === "completed" ? "Terminé" : run.status === "running" ? "En cours" : run.status}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-zinc-100">{run.foundCount}</span>
              <span className="text-xs text-zinc-600">/{run.targetCount}</span>
              <Target className="h-3.5 w-3.5 text-zinc-600" />
            </div>
          </div>
          <div className="ml-2 shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </div>
        </div>
      </button>

      {/* Prospects expandés */}
      {expanded && run.prospects.length > 0 && (
        <div className="border-t border-line px-5 pb-5 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {run.prospects.length} prospect{run.prospects.length > 1 ? "s" : ""} trouvé{run.prospects.length > 1 ? "s" : ""}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {run.prospects.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line bg-ink p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-100">{p.company}</p>
                    {p.name && p.name !== p.company && <p className="truncate text-xs text-zinc-500">{p.name}</p>}
                  </div>
                  <ScorePill score={p.score} />
                </div>
                {(p.snippet || p.summary) && (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{p.snippet || p.summary}</p>
                )}
                {p.website && (
                  <a
                    href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:text-amber-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                )}
                {p.pushedToCrmAt && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Enregistre
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && run.prospects.length === 0 && (
        <div className="border-t border-line px-5 py-4 text-sm text-zinc-500">Aucun prospect trouvé pour ce run.</div>
      )}
    </article>
  );
}

function ScorePill({ score }: { score: number }) {
  const displayScore = normalizeProspectScore(score);
  const color = displayScore >= 8 ? "text-emerald-300 bg-emerald-500/15" : displayScore >= 5 ? "text-gold bg-gold/15" : "text-zinc-400 bg-zinc-500/10";
  return <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${color}`}>{displayScore}/10</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 text-center">
      <p className="text-xl font-black text-zinc-100">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
