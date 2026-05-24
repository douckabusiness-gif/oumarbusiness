"use client";

import { Loader2, Pause, Play, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { SaasAgentProfile, SaasCompany, SaasSubscription, SaasUser } from "@/components/saas/shared";
import { formatDate, formatMoney, statusBadgeClass, subscriptionStatusLabel } from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type CompanyPayload = {
  company: SaasCompany;
  users: SaasUser[];
  subscriptions: SaasSubscription[];
  agents: SaasAgentProfile[];
};

export default function AdminSourcingCompanyPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = Array.isArray(params.companyId) ? params.companyId[0] : params.companyId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<CompanyPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/sourcing/admin/companies/${companyId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Impossible de charger ce compte sourcing.");
        const data = (await response.json()) as CompanyPayload;
        if (active) setPayload(data);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Impossible de charger ce compte sourcing.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (companyId) void load();
    return () => {
      active = false;
    };
  }, [companyId]);

  const sourcingSubscription = useMemo(
    () => payload?.subscriptions.find((item) => item.moduleKey === "sourcing-commercial") ?? null,
    [payload]
  );

  const sourcingAgents = useMemo(
    () => payload?.agents.filter((item) => item.moduleKey === "sourcing-commercial") ?? [],
    [payload]
  );

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-line bg-panel">
          <Loader2 className="h-7 w-7 animate-spin text-gold" />
        </div>
      ) : payload ? (
        <>
          <div>
            <p className="text-sm text-gold">Compte sourcing</p>
            <h1 className="mt-2 text-3xl font-bold">{payload.company.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              {payload.company.description || "Aucune description renseignee pour ce compte."}
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Owner" value={payload.company.ownerEmail} />
            <InfoCard label="Email business" value={payload.company.businessEmail || "-"} />
            <InfoCard label="Telephone" value={payload.company.businessPhone || "-"} />
            <InfoCard label="Secteur" value={payload.company.industry || "-"} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-line bg-panel p-5">
              <p className="text-sm text-gold">Acces sourcing</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoCard
                  label="Statut"
                  value={sourcingSubscription ? subscriptionStatusLabel(sourcingSubscription.status) : "Non configure"}
                  tone={sourcingSubscription ? statusBadgeClass(sourcingSubscription.status) : "bg-zinc-500/15 text-zinc-300"}
                />
                <InfoCard
                  label="Mensualite"
                  value={sourcingSubscription ? formatMoney(sourcingSubscription.monthlyPrice) : "-"}
                />
                <InfoCard
                  label="Prochaine echeance"
                  value={sourcingSubscription ? formatDate(sourcingSubscription.nextBillingDate) : "-"}
                />
                <InfoCard
                  label="Dernier paiement"
                  value={sourcingSubscription?.lastPaymentDate ? formatDate(sourcingSubscription.lastPaymentDate) : "-"}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-panel p-5">
              <p className="text-sm text-gold">Contexte entreprise</p>
              <div className="mt-4 grid gap-4">
                <DetailBlock label="Services">{payload.company.serviceCatalog || "Aucun service renseigne."}</DetailBlock>
                <DetailBlock label="Clients cibles">{payload.company.targetCustomers || "Aucun client cible renseigne."}</DetailBlock>
                <DetailBlock label="Skills agent">
                  {payload.company.agentSkills.length ? payload.company.agentSkills.join(", ") : "Aucune skill renseignee."}
                </DetailBlock>
                <DetailBlock label="Consignes agent">
                  {payload.company.agentInstructions || "Aucune consigne agent renseignee."}
                </DetailBlock>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gold" />
              <p className="text-sm text-gold">Agents de recherche</p>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {sourcingAgents.map((agent) => (
                <article key={agent.id} className="rounded-2xl border border-line bg-ink p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-100">{agent.displayName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {agent.missionConfig.source === "tavily" ? "Tavily" : "Serper"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        agent.isEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {agent.isEnabled ? "Actif" : "En pause"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <MiniStat
                      icon={agent.isEnabled ? Play : Pause}
                      label="Etat"
                      value={agent.isEnabled ? "Pret" : "Bloque"}
                    />
                    <MiniStat label="Volume vise" value={String(agent.missionConfig.defaultTargetCount)} />
                  </div>
                  <DetailBlock className="mt-4" label="Mots-cles">
                    {agent.missionConfig.keywords || "Aucun mot-cle par defaut."}
                  </DetailBlock>
                  <DetailBlock className="mt-3" label="Qualification">
                    {agent.missionConfig.qualificationInstructions || "Aucune instruction de qualification."}
                  </DetailBlock>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gold" />
              <p className="text-sm text-gold">Utilisateurs du compte</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {payload.users.map((user) => (
                <article key={user.id} className="rounded-2xl border border-line bg-ink p-4">
                  <h2 className="font-semibold text-zinc-100">{user.name}</h2>
                  <p className="mt-1 text-sm text-muted">{user.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">{user.role}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
    </div>
  );
}

function InfoCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-ink p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 font-medium ${tone ?? "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function DetailBlock({
  label,
  children,
  className = ""
}: {
  label: string;
  children: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-ink p-4 ${className}`.trim()}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-200">{children}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon?: typeof Search;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-gold" /> : null}
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      </div>
      <p className="mt-2 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
