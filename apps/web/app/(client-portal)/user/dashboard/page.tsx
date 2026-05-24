"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Radar,
  Search,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { useEffect, useState } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import type { SaasCompany, SaasSourcingRun, SaasUser } from "@/components/saas/shared";
import { formatDate } from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type WorkspacePayload = {
  runs: SaasSourcingRun[];
  stats: {
    total: number;
    completed: number;
    prospectsFound: number;
    runsThisMonth: number;
    prospectsThisMonth: number;
  };
  providers: { serper: { configured: boolean }; tavily: { configured: boolean } };
};

export default function UserDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ user?: SaasUser; company?: SaasCompany } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sessionRes, wsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/sourcing/auth/me`, { cache: "no-store", credentials: "include" }),
          fetch(`${apiBaseUrl}/api/sourcing/modules/sourcing-commercial/workspace`, { cache: "no-store", credentials: "include" })
        ]);
        const sessionData = (await sessionRes.json()) as { user?: SaasUser; company?: SaasCompany };
        const wsData = (await wsRes.json()) as WorkspacePayload;
        if (active) { setSession(sessionData); setWorkspace(wsData); }
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const latestRuns = workspace?.runs.slice(0, 3) ?? [];
  const providersReady = Boolean(workspace?.providers.serper.configured || workspace?.providers.tavily.configured);

  if (loading) {
    return (
      <SaasPortalShell title="Tableau de bord" subtitle="">
        <div className="flex min-h-[20rem] items-center justify-center rounded-3xl border border-line bg-panel">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </SaasPortalShell>
    );
  }

  return (
    <SaasPortalShell
      title={`Bonjour${session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}`}
      subtitle={session?.company?.name ?? "Espace sourcing"}
    >
      <div className="space-y-6">

        {/* ── Barre de stats principales ── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Play} label="Runs total" value={String(workspace?.stats.total ?? 0)} color="gold" />
          <StatCard icon={CheckCircle2} label="Completés" value={String(workspace?.stats.completed ?? 0)} color="emerald" />
          <StatCard icon={Target} label="Prospects" value={String(workspace?.stats.prospectsFound ?? 0)} color="violet" />
          <StatCard icon={TrendingUp} label="Ce mois" value={String(workspace?.stats.prospectsThisMonth ?? 0)} color="sky" />
        </div>

        <div className={`rounded-3xl border px-5 py-4 text-sm ${providersReady ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
          {providersReady
            ? "Tes agents sont prets. Lance ton premier sourcing."
            : "Les providers de recherche ne sont pas encore configures dans l'admin."}
        </div>

        {/* ── Accès rapides ── */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <QuickAction href="/user/sourcing" icon={Radar} label="Nouveau sourcing" color="gold" primary />
          <QuickAction href="/user/prospects" icon={Target} label="Mes prospects" color="violet" />
          <QuickAction href="/user/history" icon={Clock} label="Historique" color="sky" />
          <QuickAction href="/user/agents" icon={Bot} label="Mes agents" color="emerald" />
        </div>

        {/* ── Derniers runs ── */}
        <div className="rounded-3xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">Activité récente</p>
              <h3 className="mt-1 text-xl font-bold">Derniers sourcing</h3>
            </div>
            <Link href="/user/history" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-amber-400">
              Tout voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {latestRuns.length ? (
            <div className="mt-5 space-y-3">
              {latestRuns.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-line bg-ink p-5 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-zinc-600" />
              <p className="mt-2 text-sm font-medium text-zinc-400">Aucun run pour l'instant</p>
              <Link href="/user/sourcing" className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl bg-gold px-4 text-xs font-bold text-black hover:bg-amber-400">
                <Play className="h-3.5 w-3.5" /> Lancer mon premier sourcing
              </Link>
            </div>
          )}
        </div>

      </div>
    </SaasPortalShell>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Play; label: string; value: string; color: string }) {
  const c: Record<string, string> = {
    gold: "text-gold bg-gold/10 border-gold/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    sky: "text-sky-300 bg-sky-500/10 border-sky-500/20"
  };
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${c[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-black text-zinc-100">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, color, primary }: { href: string; icon: typeof Radar; label: string; color: string; primary?: boolean }) {
  const c: Record<string, string> = {
    gold: "text-gold bg-gold/10 border-gold/20",
    violet: "text-violet-300 bg-violet-500/10 border-violet-500/20",
    sky: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
  };
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:border-gold/40 ${primary ? "border-gold/30 bg-gold/5" : "border-line bg-panel"}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${c[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className={`text-sm font-semibold ${primary ? "text-gold" : "text-zinc-300"}`}>{label}</span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-zinc-600" />
    </Link>
  );
}

function RunRow({ run }: { run: SaasSourcingRun }) {
  const isSerper = run.agentKey === "sourcing-serper";
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isSerper ? "border-violet-500/20 bg-violet-500/10" : "border-sky-500/20 bg-sky-500/10"}`}>
        <Radar className={`h-4 w-4 ${isSerper ? "text-violet-400" : "text-sky-400"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">{run.objective || run.brief}</p>
        <p className="text-xs text-zinc-500">{run.sector} · {run.zone} · {formatDate(run.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-zinc-100">{run.foundCount}</p>
        <p className="text-[10px] text-zinc-600">prospects</p>
      </div>
    </div>
  );
}
