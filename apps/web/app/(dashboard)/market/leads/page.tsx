"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Flame, Loader2, Mail, MessageCircle, Store, Users } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type MarketplaceLead = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  status: string;
  source?: string | null;
  tags: string[];
  createdAt: string;
  lastContact?: string | null;
  assignedAgentId?: string | null;
  requestedAppSlug?: string | null;
  requestedAppName?: string | null;
  requestedAppCategory?: string | null;
  budgetHint?: string | null;
  leadChannel: string;
  isHot: boolean;
  needsFollowup: boolean;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type TeamSettingsPayload = {
  members?: TeamMember[];
};

export default function MarketplaceLeadsPage() {
  const [leads, setLeads] = useState<MarketplaceLead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appFilter, setAppFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [busyLeadId, setBusyLeadId] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [leadResponse, teamResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/market/leads`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/settings/team`, { cache: "no-store" })
        ]);

        const leadData = (await leadResponse.json()) as { items?: MarketplaceLead[]; error?: string };
        const teamData = (await teamResponse.json()) as TeamSettingsPayload & { error?: string };

        if (!leadResponse.ok) {
          throw new Error(leadData.error ?? "Chargement des leads marketplace impossible.");
        }

        if (!teamResponse.ok) {
          throw new Error(teamData.error ?? "Chargement de l'equipe impossible.");
        }

        if (!active) return;

        setLeads(Array.isArray(leadData.items) ? leadData.items : []);
        setTeamMembers(Array.isArray(teamData.members) ? teamData.members : []);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Chargement des leads marketplace impossible.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const assignableMembers = useMemo(() => {
    return teamMembers.filter((member) => member.status === "active" && ["SALES_AGENT", "SUPER_ADMIN", "ADMIN"].includes(member.role));
  }, [teamMembers]);

  const memberMap = useMemo(() => new Map(assignableMembers.map((member) => [member.id, member])), [assignableMembers]);

  const appOptions = useMemo(
    () =>
      Array.from(new Set(leads.map((lead) => lead.requestedAppName).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b, "fr")
      ),
    [leads]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(leads.map((lead) => normalizeStatus(lead.status)))).sort((a, b) => a.localeCompare(b, "fr")),
    [leads]
  );

  const countryOptions = useMemo(
    () =>
      Array.from(new Set(leads.map((lead) => lead.country).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b, "fr")
      ),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (appFilter !== "all" && lead.requestedAppName !== appFilter) return false;
      if (statusFilter !== "all" && normalizeStatus(lead.status) !== statusFilter) return false;
      if (countryFilter !== "all" && (lead.country ?? "") !== countryFilter) return false;
      return true;
    });
  }, [appFilter, countryFilter, leads, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: leads.length,
      hot: leads.filter((lead) => lead.isHot).length,
      open: leads.filter((lead) => normalizeStatus(lead.status) === "prospect").length
    };
  }, [leads]);

  async function patchLead(id: string, payload: Record<string, unknown>, successMessage: string) {
    try {
      setBusyLeadId(id);
      setFeedback((current) => ({ ...current, [id]: "" }));
      const response = await fetch(`${apiBaseUrl}/api/market/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { item?: MarketplaceLead; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Mise a jour impossible.");
      }
      setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...data.item } : lead)));
      setFeedback((current) => ({ ...current, [id]: successMessage }));
    } catch (actionError) {
      setFeedback((current) => ({
        ...current,
        [id]: actionError instanceof Error ? actionError.message : "Action impossible."
      }));
    } finally {
      setBusyLeadId("");
    }
  }

  async function contactLead(id: string, channel: "email" | "whatsapp") {
    try {
      setBusyLeadId(id);
      setFeedback((current) => ({ ...current, [id]: "" }));
      const response = await fetch(`${apiBaseUrl}/api/market/leads/${id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          message: draftMessages[id] ?? ""
        })
      });
      const data = (await response.json()) as { ok?: boolean; result?: { detail?: string }; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Relance impossible.");
      }
      setFeedback((current) => ({ ...current, [id]: data.result?.detail ?? "Relance envoyee." }));
      setLeads((current) =>
        current.map((lead) =>
          lead.id === id
            ? {
                ...lead,
                needsFollowup: true,
                lastContact: new Date().toISOString()
              }
            : lead
        )
      );
    } catch (actionError) {
      setFeedback((current) => ({
        ...current,
        [id]: actionError instanceof Error ? actionError.message : "Relance impossible."
      }));
    } finally {
      setBusyLeadId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Market</p>
          <h1 className="mt-2 text-3xl font-bold">Leads Marketplace</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Ici tu peux suivre, qualifier, assigner et relancer les prospects venus de ton marketplace sans repasser par tout le CRM.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/market"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold text-zinc-200"
          >
            <Store className="h-4 w-4 text-gold" />
            Retour Market
          </Link>
          <Link
            href="/crm"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold text-zinc-200"
          >
            <Users className="h-4 w-4 text-gold" />
            Ouvrir CRM
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Leads marketplace" value={String(stats.total)} help="Tous les prospects venus des fiches app." />
        <StatCard label="A relancer vite" value={String(stats.hot)} help="Leads chauds ou demandes a suivre." />
        <StatCard label="Encore en prospect" value={String(stats.open)} help="Ceux qui ne sont pas encore qualifies." />
      </div>

      <div className="grid gap-3 rounded-lg border border-line bg-panel p-4 md:grid-cols-3">
        <FilterSelect label="Application" value={appFilter} onChange={setAppFilter} options={appOptions} allLabel="Toutes" />
        <FilterSelect label="Statut" value={statusFilter} onChange={setStatusFilter} options={statusOptions} allLabel="Tous" />
        <FilterSelect label="Pays" value={countryFilter} onChange={setCountryFilter} options={countryOptions} allLabel="Tous" />
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-panel p-6 text-sm text-muted">
          Aucun lead marketplace pour ce filtre.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredLeads.map((lead) => {
            const assigned = lead.assignedAgentId ? memberMap.get(lead.assignedAgentId) : undefined;
            const busy = busyLeadId === lead.id;

            return (
              <article key={lead.id} className="rounded-lg border border-line bg-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{lead.name}</h2>
                      {lead.isHot ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">
                          <Flame className="h-3.5 w-3.5" />
                          Chaud
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted">{lead.company || lead.country || "Sans entreprise"}</p>
                  </div>
                  <span className="rounded-full border border-line px-2.5 py-1 text-xs text-zinc-300">
                    {formatStatus(lead.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <LeadInfo label="Application" value={lead.requestedAppName || "Non detectee"} />
                  <LeadInfo label="Canal" value={lead.leadChannel} />
                  <LeadInfo label="Budget" value={lead.budgetHint || "Non renseigne"} />
                  <LeadInfo label="Pays" value={lead.country || "Non renseigne"} />
                  <LeadInfo label="Email" value={lead.email || "Non renseigne"} />
                  <LeadInfo label="WhatsApp" value={lead.whatsapp || "Non renseigne"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {lead.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-zinc-300">Statut</span>
                    <select
                      value={normalizeStatus(lead.status)}
                      onChange={(event) =>
                        void patchLead(lead.id, { status: event.target.value }, "Statut mis a jour.")
                      }
                      disabled={busy}
                      className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none"
                    >
                      <option value="prospect">Prospect</option>
                      <option value="qualifie">Qualifie</option>
                      <option value="devis_envoye">Devis envoye</option>
                      <option value="negociation">Negociation</option>
                      <option value="client">Client</option>
                      <option value="inactif">Inactif</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-zinc-300">Assigner a</span>
                    <select
                      value={lead.assignedAgentId ?? ""}
                      onChange={(event) =>
                        void patchLead(
                          lead.id,
                          { assignedToId: event.target.value || null },
                          event.target.value ? "Lead assigne." : "Assignation retiree."
                        )
                      }
                      disabled={busy}
                      className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none"
                    >
                      <option value="">Non assigne</option>
                      {assignableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void patchLead(lead.id, { hot: !lead.isHot }, lead.isHot ? "Lead retire des chauds." : "Lead marque chaud.")}
                    disabled={busy}
                    className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                  >
                    {lead.isHot ? "Retirer chaud" : "Marquer chaud"}
                  </button>
                  <button
                    onClick={() =>
                      void patchLead(
                        lead.id,
                        { followup: !lead.needsFollowup },
                        lead.needsFollowup ? "Relance retiree." : "Lead marque a relancer."
                      )
                    }
                    disabled={busy}
                    className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                  >
                    {lead.needsFollowup ? "Retirer relance" : "Marquer a relancer"}
                  </button>
                </div>

                <div className="mt-4 rounded-md border border-line bg-ink p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Relance rapide</p>
                  <textarea
                    value={draftMessages[lead.id] ?? ""}
                    onChange={(event) => setDraftMessages((current) => ({ ...current, [lead.id]: event.target.value }))}
                    placeholder="Message optionnel de relance..."
                    className="mt-3 min-h-24 w-full rounded-md border border-line bg-panel p-3 text-sm text-zinc-100 outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => void contactLead(lead.id, "email")}
                      disabled={busy || !lead.email}
                      className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      Envoyer email
                    </button>
                    <button
                      onClick={() => void contactLead(lead.id, "whatsapp")}
                      disabled={busy || !lead.whatsapp}
                      className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-50"
                    >
                      <MessageCircle className="h-4 w-4 text-gold" />
                      Envoyer WhatsApp
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted">
                      Demande recue le {new Date(lead.createdAt).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-xs text-muted">
                      Assigne: {assigned ? assigned.name : "Personne"}
                    </p>
                    {feedback[lead.id] ? <p className="text-xs text-gold">{feedback[lead.id]}</p> : null}
                  </div>
                  <Link href={`/crm/${lead.id}/memory`} className="inline-flex items-center gap-2 text-sm font-semibold text-gold">
                    Ouvrir fiche CRM
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-zinc-100">{value}</p>
      <p className="mt-2 text-sm text-muted">{help}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeadInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function normalizeStatus(status: string) {
  const value = status.toLowerCase().replace(/\s+/g, "_");
  if (value === "prospect") return "prospect";
  if (value === "qualifie" || value === "qualified") return "qualifie";
  if (value === "devis_envoye" || value === "quote_sent") return "devis_envoye";
  if (value === "negociation" || value === "negotiation") return "negociation";
  if (value === "client" || value === "active_client") return "client";
  return "inactif";
}

function formatStatus(status: string) {
  return normalizeStatus(status).replace("_", " ");
}
