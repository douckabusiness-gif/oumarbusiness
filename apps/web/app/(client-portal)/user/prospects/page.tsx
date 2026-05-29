"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";

type ProspectItem = {
  id: string;
  name?: string | null;
  title?: string | null;
  summary?: string | null;
  sector?: string | null;
  zone?: string | null;
  url?: string | null;
  email?: string | null;
  phone?: string | null;
  score?: number | null;
  agentKey?: string | null;
  runId?: string | null;
  createdAt?: string | null;
  sessionId?: string | null;
  cycleIndex?: number | null;
};

type ProspectPayload = {
  prospects?: ProspectItem[];
  items?: ProspectItem[];
};

const freeEmailDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.fr",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "live.com",
  "live.fr",
  "icloud.com",
  "aol.com",
  "gmx.com",
  "gmx.fr",
  "yandex.com",
  "proton.me",
  "protonmail.com",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "laposte.net",
  "sfr.fr",
]);

function agentName(agentKey?: string | null) {
  if (agentKey === "sourcing-serper") {
    return "Agent Découverte";
  }

  if (agentKey === "sourcing-tavily") {
    return "Agent Qualification";
  }

  return "Sourcing";
}

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

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function extractWebsiteHostname(url?: string | null) {
  if (!url) {
    return "";
  }

  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}

function emailLooksStrong(email?: string | null, url?: string | null) {
  if (!email) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const [localPart = "", domain = ""] = normalized.split("@");
  const emailDomain = normalizeDomain(domain);
  const hostname = extractWebsiteHostname(url);

  if (!emailDomain || !hostname) {
    return false;
  }

  const matchesSite =
    emailDomain === hostname ||
    emailDomain.endsWith(`.${hostname}`) ||
    hostname.endsWith(`.${emailDomain}`);

  if (!matchesSite) {
    return false;
  }

  if (freeEmailDomains.has(emailDomain)) {
    return false;
  }

  if (/^(no-?reply|noreply|do-?not-?reply)([._-].*)?$/i.test(localPart)) {
    return false;
  }

  return true;
}

function emailBadge(email?: string | null, url?: string | null) {
  if (!email) {
    return null;
  }

  if (emailLooksStrong(email, url)) {
    return {
      label: "Email entreprise fort",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    };
  }

  return {
    label: "Email a verifier",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  };
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
        : null) ?? "Impossible de charger les prospects.";
    throw new Error(message);
  }

  return payload as T;
}

export default function UserProspectsPage() {
  const [prospects, setProspects] = useState<ProspectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await fetchJson<ProspectPayload>("/api/sourcing/prospects");
      setProspects(Array.isArray(payload) ? payload : payload.prospects ?? payload.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les prospects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => {
    const serper = prospects.filter((item) => item.agentKey === "sourcing-serper").length;
    const tavily = prospects.filter((item) => item.agentKey === "sourcing-tavily").length;
    return {
      total: prospects.length,
      serper,
      tavily,
    };
  }, [prospects]);

  return (
    <SaasPortalShell
      title="Mes prospects"
      subtitle="Retrouve les contacts retenus par tes agents et leur origine live."
    >
      <div className="space-y-8">
        <section className="flex flex-wrap justify-end gap-3">
          <Link
            href="/user/agents"
            className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
          >
            Ouvrir les agents
          </Link>
          <Link
            href="/user/agents"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
          >
            Centre live
          </Link>
        </section>

      {error ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total" value={loading ? "…" : String(stats.total)} />
        <MetricCard label="Découverte" value={loading ? "…" : String(stats.serper)} />
        <MetricCard label="Qualification" value={loading ? "…" : String(stats.tavily)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {prospects.length === 0 ? (
          <div className="xl:col-span-2 2xl:col-span-3">
            <EmptyState
              title="Aucun prospect retenu"
              body="Les prospects qualifies par les agents live ou les runs manuels apparaitront ici."
            />
          </div>
        ) : (
          prospects.map((prospect) => {
            const mailBadge = emailBadge(prospect.email, prospect.url);

            return (
              <article
                key={prospect.id}
                className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-semibold text-white">
                      {prospect.name || prospect.title || "Prospect"}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{agentName(prospect.agentKey)}</Badge>
                      {prospect.sessionId ? <Badge>Session {prospect.sessionId.slice(0, 8)}</Badge> : null}
                      {prospect.cycleIndex != null ? <Badge>Cycle {prospect.cycleIndex}</Badge> : null}
                      {mailBadge ? (
                        <Badge className={mailBadge.className}>{mailBadge.label}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">
                    {typeof prospect.score === "number" ? `${prospect.score}/10` : "—"}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-zinc-400 md:grid-cols-2">
                  <InfoCell label="Zone" value={prospect.zone ?? "—"} />
                  <InfoCell label="Secteur" value={prospect.sector ?? "—"} />
                </div>

                {prospect.email || prospect.phone ? (
                  <div className="mt-5 grid gap-3 text-sm text-zinc-400 md:grid-cols-2">
                    {prospect.email ? (
                      <InfoLinkCell
                        label="Email"
                        value={prospect.email}
                        href={`mailto:${prospect.email}`}
                      />
                    ) : null}
                    {prospect.phone ? (
                      <InfoLinkCell
                        label="Telephone"
                        value={prospect.phone}
                        href={`tel:${prospect.phone}`}
                      />
                    ) : null}
                  </div>
                ) : null}

                {prospect.url ? (
                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-amber-300">
                    <a href={prospect.url} target="_blank" rel="noreferrer" className="break-all hover:text-amber-200">
                      {prospect.url}
                    </a>
                  </div>
                ) : null}

                {prospect.summary ? (
                  <p className="mt-5 line-clamp-4 text-sm leading-7 text-zinc-300">{prospect.summary}</p>
                ) : null}

                <div className="mt-5 flex items-center justify-between gap-3 text-sm text-zinc-500">
                  <span>{formatDate(prospect.createdAt)}</span>
                  <div className="flex gap-2">
                    {prospect.runId ? (
                      <Link
                        href={`/user/history/run?id=${prospect.runId}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/15"
                      >
                        Voir l'analyse
                      </Link>
                    ) : null}
                    {prospect.url ? (
                      <a
                        href={prospect.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
                      >
                        Ouvrir
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
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

function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 ${className}`.trim()}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-8 text-center">
      <div className="text-sm font-medium text-white">{title}</div>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </div>
  );
}
