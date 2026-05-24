"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  BookmarkPlus,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  Filter,
  Globe,
  Loader2,
  MapPin,
  Radar,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingUp,
  User,
  X
} from "lucide-react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import type { SaasSourcingRun } from "@/components/saas/shared";
import { formatDate, normalizeProspectScore } from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ProspectItem = SaasSourcingRun["prospects"][number] & {
  runId: string;
  agentName: string;
  objective: string;
  createdAt: string;
  sector: string;
  zone: string;
};

type SortKey = "score_desc" | "score_asc" | "date_desc" | "company_asc";

export default function UserProspectsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runs, setRuns] = useState<SaasSourcingRun[]>([]);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "serper" | "tavily">("all");
  const [filterCrm, setFilterCrm] = useState<"all" | "in_crm" | "not_in_crm">("all");
  const [sortKey, setSortKey] = useState<SortKey>("score_desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);

  function exportCsv() {
    const headers = ["Entreprise", "Contact", "Site web", "Score", "Source", "Secteur", "Zone", "Agent", "Date", "Enregistre"];
    const rows = filtered.map((p) => [
      `"${p.company.replace(/"/g, '""')}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.website.replace(/"/g, '""')}"`,
      normalizeProspectScore(p.score),
      p.source,
      `"${p.sector.replace(/"/g, '""')}"`,
      `"${p.zone.replace(/"/g, '""')}"`,
      `"${p.agentName.replace(/"/g, '""')}"`,
      new Date(p.createdAt).toLocaleDateString("fr-FR"),
      p.pushedToCrmAt ? "Oui" : "Non"
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/workspace`,
          { cache: "no-store", credentials: "include" }
        );
        if (!response.ok) throw new Error("Impossible de charger les prospects.");
        const data = (await response.json()) as { runs: SaasSourcingRun[] };
        if (active) setRuns(data.runs ?? []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Erreur de chargement.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const allProspects = useMemo<ProspectItem[]>(
    () =>
      runs.flatMap((run) =>
        run.prospects.map((p) => ({
          ...p,
          runId: run.id,
          agentName: run.agentName,
          objective: run.objective || run.brief,
          createdAt: run.createdAt,
          sector: run.sector,
          zone: run.zone
        }))
      ),
    [runs]
  );

  const filtered = useMemo(() => {
    let list = [...allProspects];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          p.website.toLowerCase().includes(q) ||
          p.sector.toLowerCase().includes(q) ||
          p.zone.toLowerCase().includes(q)
      );
    }

    if (filterSource !== "all") list = list.filter((p) => p.source === filterSource);
    if (filterCrm === "in_crm") list = list.filter((p) => !!p.pushedToCrmAt);
    if (filterCrm === "not_in_crm") list = list.filter((p) => !p.pushedToCrmAt);

    list.sort((a, b) => {
      if (sortKey === "score_desc") return b.score - a.score;
      if (sortKey === "score_asc") return a.score - b.score;
      if (sortKey === "date_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortKey === "company_asc") return a.company.localeCompare(b.company);
      return 0;
    });

    return list;
  }, [allProspects, search, filterSource, filterCrm, sortKey]);

  const stats = useMemo(() => {
    const total = allProspects.length;
    const serperCount = allProspects.filter((p) => p.source === "serper").length;
    const tavilyCount = allProspects.filter((p) => p.source === "tavily").length;
    const inCrm = allProspects.filter((p) => !!p.pushedToCrmAt).length;
    const avgScore = total
      ? Math.round(allProspects.reduce((s, p) => s + normalizeProspectScore(p.score), 0) / total)
      : 0;
    return { total, serperCount, tavilyCount, inCrm, avgScore };
  }, [allProspects]);

  async function pushToCrm(prospect: ProspectItem) {
    try {
      setPushingId(prospect.id);
      const response = await fetch(
        `${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/runs/${prospect.runId}/prospects/${prospect.id}/push-crm`,
        { method: "POST", credentials: "include" }
      );
      if (!response.ok) throw new Error("Erreur lors de l'enregistrement du prospect.");
      setRuns((prev) =>
        prev.map((run) =>
          run.id !== prospect.runId
            ? run
            : {
                ...run,
                prospects: run.prospects.map((p) =>
                  p.id !== prospect.id
                    ? p
                    : { ...p, pushedToCrmAt: new Date().toISOString() }
                )
              }
        )
      );
      setPushSuccess(prospect.id);
      setTimeout(() => setPushSuccess(null), 3000);
    } catch {
      /* ignore */
    } finally {
      setPushingId(null);
    }
  }

  return (
    <SaasPortalShell
      title="Mes Prospects"
      subtitle="Tous les contacts qualifies par tes agents Serper et Tavily."
    >
      <div className="space-y-6">

        {/* ── Stats bar ── */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
            <StatPill label="Total" value={String(stats.total)} color="gold" icon={Sparkles} />
            <StatPill label="Serper" value={String(stats.serperCount)} color="violet" icon={Radar} />
            <StatPill label="Tavily" value={String(stats.tavilyCount)} color="sky" icon={Radar} />
            <StatPill label="Enregistrés" value={String(stats.inCrm)} color="emerald" icon={CheckCircle2} />
            <StatPill label="Score moyen" value={`${stats.avgScore}/10`} color="amber" icon={TrendingUp} className="hidden xl:flex" />
          </div>
        )}

        {/* ── Barre de recherche + filtres ── */}
        {!loading && allProspects.length > 0 && (
          <div className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-ink px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher entreprise, contact, zone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")}>
                  <X className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                </button>
              )}
            </div>

            {/* Source filter */}
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-ink p-1">
              {(["all", "serper", "tavily"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilterSource(v)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    filterSource === v ? "bg-gold text-black" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v === "all" ? "Tous" : v === "serper" ? "Serper" : "Tavily"}
                </button>
              ))}
            </div>

            {/* Saved filter */}
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-ink p-1">
              {(["all", "not_in_crm", "in_crm"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilterCrm(v)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    filterCrm === v ? "bg-gold text-black" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v === "all" ? "Tous" : v === "in_crm" ? "Enregistrés" : "Non enregistrés"}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-ink px-3 py-2.5">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-transparent text-xs text-zinc-300 focus:outline-none"
              >
                <option value="score_desc">Score ↓</option>
                <option value="score_asc">Score ↑</option>
                <option value="date_desc">Plus recent</option>
                <option value="company_asc">Entreprise A→Z</option>
              </select>
            </div>

            {/* Export CSV */}
            {filtered.length > 0 && (
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 px-4 text-xs font-bold text-gold hover:bg-gold/20 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            )}
          </div>
        )}

        {/* ── Contenu ── */}
        {loading ? (
          <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-line bg-panel">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-sm text-zinc-500">Chargement des prospects...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line bg-panel p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-ink">
              <Search className="h-6 w-6 text-zinc-600" />
            </div>
            {allProspects.length === 0 ? (
              <>
                <p className="font-semibold text-zinc-300">Aucun prospect encore</p>
                <p className="max-w-sm text-sm leading-6 text-zinc-500">
                  Lance une recherche dans "Nouveau sourcing" pour commencer a remplir cette page.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-zinc-300">Aucun resultat</p>
                <p className="text-sm text-zinc-500">Essaie d'autres filtres ou mots-cles.</p>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilterSource("all"); setFilterCrm("all"); }}
                  className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-4 text-xs font-semibold text-zinc-300 hover:border-gold/40"
                >
                  <Filter className="h-3.5 w-3.5" /> Reinitialiser les filtres
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-600">
              {filtered.length} prospect{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
              {filtered.length !== allProspects.length && ` sur ${allProspects.length}`}
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((prospect) => (
                <ProspectCard
                  key={prospect.id}
                  prospect={prospect}
                  expanded={expandedId === prospect.id}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === prospect.id ? null : prospect.id)
                  }
                  pushing={pushingId === prospect.id}
                  justPushed={pushSuccess === prospect.id}
                  onPushCrm={() => void pushToCrm(prospect)}
                />
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </SaasPortalShell>
  );
}

// ── Carte prospect ────────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  expanded,
  onToggleExpand,
  pushing,
  justPushed,
  onPushCrm
}: {
  prospect: ProspectItem;
  expanded: boolean;
  onToggleExpand: () => void;
  pushing: boolean;
  justPushed: boolean;
  onPushCrm: () => void;
}) {
  const isInCrm = !!prospect.pushedToCrmAt;
  const displayScore = normalizeProspectScore(prospect.score);
  const scoreColor = displayScore >= 8 ? "emerald" : displayScore >= 5 ? "gold" : "zinc";
  const initial = (prospect.company || prospect.name || "?")[0]?.toUpperCase() ?? "?";
  const description = prospect.summary || prospect.snippet || "";

  return (
    <article className="flex flex-col overflow-hidden rounded-[28px] border border-line bg-panel transition hover:border-zinc-600">

      {/* ── Header de la carte ── */}
      <div className="flex items-start gap-4 p-5">
        {/* Avatar entreprise */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink text-xl font-black text-gold">
          {initial}
        </div>

        {/* Nom + entreprise */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight text-white">
                {prospect.company || "Entreprise inconnue"}
              </p>
              {prospect.name && prospect.name !== prospect.company && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                  <User className="h-3 w-3 shrink-0" />
                  {prospect.name}
                </p>
              )}
            </div>
            {/* Score badge */}
            <ScoreBadge score={displayScore} color={scoreColor} />
          </div>

          {/* Source badge */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              prospect.source === "tavily"
                ? "bg-sky-500/15 text-sky-300"
                : "bg-violet-500/15 text-violet-300"
            }`}>
              <Radar className="h-2.5 w-2.5" />
              {prospect.source === "tavily" ? "Tavily" : "Serper"}
            </span>
            {isInCrm && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Enregistrer
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Infos clés ── */}
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
        <InfoCell icon={MapPin} label="Zone" value={prospect.zone || "—"} />
        <InfoCell icon={Tag} label="Secteur" value={prospect.sector || "—"} />
      </div>

      {/* ── Site web ── */}
      {prospect.website && (
        <div className="border-t border-line px-5 py-3">
          <a
            href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex max-w-full items-center gap-1.5 overflow-hidden text-ellipsis text-sm text-gold hover:text-amber-400"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-xs">{cleanUrl(prospect.website)}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
          </a>
        </div>
      )}

      {/* ── Description / résumé ── */}
      {description && (
        <div className="border-t border-line px-5 py-4">
          <p className={`text-sm leading-6 text-zinc-400 ${!expanded ? "line-clamp-3" : ""}`}>
            {description}
          </p>
          {description.length > 160 && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-1.5 text-xs font-semibold text-gold hover:text-amber-400"
            >
              {expanded ? "Voir moins" : "Voir tout"}
            </button>
          )}
        </div>
      )}

      {/* ── Pied de carte : date + actions ── */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line bg-ink px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-semibold text-zinc-500">{prospect.agentName}</span>
          <span className="text-[11px] text-zinc-600">{formatDate(prospect.createdAt)}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {prospect.website && (
            <a
              href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-panel text-zinc-400 hover:border-gold/40 hover:text-gold"
              title="Visiter le site"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {!isInCrm ? (
            <button
              type="button"
              onClick={onPushCrm}
              disabled={pushing}
              title="Enregistrer le prospect"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
            >
              {pushing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" />
              )}
              Enregistrer
            </button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400">
              {justPushed ? <Sparkles className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {justPushed ? "Ajouté !" : "Enregistré"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function ScoreBadge({ score, color }: { score: number; color: "emerald" | "gold" | "zinc" }) {
  const classes = {
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    gold: "bg-gold/15 text-gold border-gold/20",
    zinc: "bg-zinc-500/10 text-zinc-400 border-zinc-700"
  };
  return (
    <div className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl border ${classes[color]}`}>
      <span className="text-sm font-black leading-none">{score}</span>
      <span className="text-[9px] leading-none opacity-70">/10</span>
    </div>
  );
}

function InfoCell({
  icon: Icon,
  label,
  value
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-panel px-4 py-3">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className="truncate text-xs font-medium text-zinc-300">{value}</span>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
  icon: Icon,
  className = ""
}: {
  label: string;
  value: string;
  color: "gold" | "violet" | "sky" | "emerald" | "amber";
  icon: typeof Sparkles;
  className?: string;
}) {
  const colors: Record<string, string> = {
    gold: "text-gold bg-gold/10 border-gold/20",
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    sky: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/20"
  };
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-panel px-4 py-3 ${className}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${colors[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-xl font-black text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function cleanUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
