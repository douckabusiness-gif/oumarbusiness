"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet
} from "lucide-react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import {
  formatDate,
  formatMoney,
  statusBadgeClass,
  subscriptionStatusLabel,
  type SourcingPlan,
  type UserPaymentMethods,
  type UserPaymentRequest,
  type UserSourcingSubscriptionView
} from "@/components/saas/shared";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type PaymentMethodsResponse = {
  ok: boolean;
  methods: UserPaymentMethods;
};

type PaymentRequestsResponse = {
  ok: boolean;
  requests: UserPaymentRequest[];
};

type CreatePaymentRequestResponse = {
  ok?: boolean;
  request?: UserPaymentRequest;
  error?: string;
};

export default function UserSubscriptionPage() {
  const paymentSectionRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [subscriptionView, setSubscriptionView] = useState<UserSourcingSubscriptionView | null>(null);
  const [plans, setPlans] = useState<SourcingPlan[]>([]);
  const [methods, setMethods] = useState<UserPaymentMethods | null>(null);
  const [requests, setRequests] = useState<UserPaymentRequest[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wave" | "orange_money">("wave");
  const [senderPhone, setSenderPhone] = useState("");
  const [reference, setReference] = useState("");

  async function loadPage() {
    const [subscriptionRes, plansRes, methodsRes, requestsRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/sourcing/subscription`, { cache: "no-store", credentials: "include" }),
      fetch(`${apiBaseUrl}/api/sourcing/public/sourcing/plans`, { cache: "no-store", credentials: "include" }),
      fetch(`${apiBaseUrl}/api/sourcing/payment-methods`, { cache: "no-store", credentials: "include" }),
      fetch(`${apiBaseUrl}/api/sourcing/payments/requests/me`, { cache: "no-store", credentials: "include" })
    ]);

    if (!subscriptionRes.ok || !plansRes.ok || !methodsRes.ok || !requestsRes.ok) {
      throw new Error("Impossible de charger les informations d'abonnement.");
    }

    const subscriptionData = (await subscriptionRes.json()) as UserSourcingSubscriptionView;
    const plansData = (await plansRes.json()) as { ok: boolean; plans: SourcingPlan[] };
    const methodsData = (await methodsRes.json()) as PaymentMethodsResponse;
    const requestsData = (await requestsRes.json()) as PaymentRequestsResponse;

    setSubscriptionView(subscriptionData);
    setPlans(plansData.plans ?? []);
    setMethods(methodsData.methods);
    setRequests(requestsData.requests ?? []);

    const activePlan = subscriptionData.subscription
      ? (plansData.plans ?? []).find(
          (plan) =>
            plan.name === subscriptionData.subscription?.planName &&
            plan.monthlyPrice === subscriptionData.subscription?.monthlyPrice
        ) ?? null
      : null;
    const requestPlanId = subscriptionData.latestRequest?.planId ?? requestsData.requests?.[0]?.planId ?? "";
    setSelectedPlanId(activePlan?.id ?? requestPlanId);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await loadPage();
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
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

  const currentSubscription = subscriptionView?.subscription ?? null;
  const latestRequest = requests[0] ?? subscriptionView?.latestRequest ?? null;
  const currentPlan = useMemo(() => {
    if (!currentSubscription) return null;
    return (
      plans.find(
        (plan) => plan.name === currentSubscription.planName && plan.monthlyPrice === currentSubscription.monthlyPrice
      ) ?? subscriptionView?.currentPlan ?? null
    );
  }, [currentSubscription, plans, subscriptionView?.currentPlan]);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? currentPlan ?? null;
  const currentPlanMatchesSelection = Boolean(
    currentSubscription &&
      currentSubscription.status === "active" &&
      selectedPlan &&
      currentSubscription.planName === selectedPlan.name &&
      currentSubscription.monthlyPrice === selectedPlan.monthlyPrice
  );
  const selectedPlanPendingRequest = selectedPlan
    ? requests.find((request) => request.planId === selectedPlan.id && request.status === "pending") ?? null
    : null;
  const latestRequestStatus = latestRequest?.status ?? null;
  const showPaymentBlock = Boolean(selectedPlan && !currentPlanMatchesSelection);
  const paymentMethodsConfigured = Boolean(methods?.configured);
  const currentStatusLabel =
    currentSubscription?.status === "active"
      ? "Actif"
      : latestRequestStatus === "pending"
        ? "Paiement en attente"
        : latestRequestStatus === "rejected"
          ? "Paiement refuse"
          : currentSubscription
            ? subscriptionStatusLabel(currentSubscription.status)
            : "Aucun plan actif";
  const currentAccessLabel =
    currentSubscription?.accessible ? "Ouvert" : latestRequestStatus === "pending" ? "En attente" : "Bloque";
  const currentAmount = currentSubscription?.monthlyPrice ?? currentPlan?.monthlyPrice ?? 0;

  function revealPayment(planId: string) {
    setSelectedPlanId(planId);
    window.requestAnimationFrame(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submitPaymentRequest() {
    if (!selectedPlan) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/sourcing/payments/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planId: selectedPlan.id,
          method: paymentMethod,
          senderPhone,
          reference
        })
      });

      const payload = (await response.json()) as CreatePaymentRequestResponse;
      if (!response.ok || !payload.ok || !payload.request) {
        throw new Error(payload.error ?? "Impossible d'envoyer la demande de paiement.");
      }

      setSuccess("Ta demande de paiement a ete envoyee. Elle apparait maintenant en attente.");
      setSenderPhone("");
      setReference("");
      await loadPage();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setSuccess("Information de paiement copiee.");
    } catch {
      setError("Impossible de copier cette information.");
    }
  }

  if (loading) {
    return (
      <SaasPortalShell title="Abonnement" subtitle="">
        <div className="flex min-h-[18rem] items-center justify-center rounded-3xl border border-line bg-panel">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </SaasPortalShell>
    );
  }

  return (
    <SaasPortalShell title="Abonnement" subtitle="Votre plan et les offres disponibles">
      <div className="space-y-6">
        <section className="rounded-3xl border border-gold/25 bg-gold/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">Plan actuel</p>
          <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10">
                <CreditCard className="h-5 w-5 text-gold" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-zinc-100">
                    {currentSubscription?.planName ?? latestRequest?.planName ?? "Aucun plan actif"}
                  </h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(currentSubscription?.status ?? "paused")}`}>
                    {currentStatusLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">Agent sourcing commercial</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-3xl font-black text-gold">
                {currentAmount > 0 ? formatMoney(currentAmount) : "Gratuit"}
              </p>
              <p className="text-sm text-zinc-400">/ mois</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCell label="Debut" value={currentSubscription ? formatDate(currentSubscription.startDate) : "-"} />
            <InfoCell
              label="Prochain paiement"
              value={currentSubscription?.nextBillingDate ? formatDate(currentSubscription.nextBillingDate) : "-"}
            />
            <InfoCell
              label="Dernier paiement"
              value={currentSubscription?.lastPaymentDate ? formatDate(currentSubscription.lastPaymentDate) : "-"}
            />
            <InfoCell label="Acces" value={currentAccessLabel} accent={currentAccessLabel === "Ouvert" ? "success" : "warning"} />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">Nos offres</p>
          <h2 className="mt-2 text-3xl font-bold text-zinc-100">Choisir un plan</h2>
          <p className="mt-2 text-sm text-zinc-400">Selectionnez un plan pour voir les instructions de paiement.</p>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            {plans.map((plan) => {
              const isCurrentPlan =
                currentSubscription?.status === "active" &&
                currentSubscription.planName === plan.name &&
                currentSubscription.monthlyPrice === plan.monthlyPrice;
              const isSelected = selectedPlanId === plan.id;
              const pendingForPlan = requests.find((request) => request.planId === plan.id && request.status === "pending") ?? null;

              return (
                <article
                  key={plan.id}
                  className={`rounded-3xl border p-5 transition ${
                    isSelected ? "border-gold/50 bg-gold/5 shadow-[0_0_0_1px_rgba(212,160,32,0.15)]" : "border-line bg-panel"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {plan.isPopular ? (
                      <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-300">
                        Populaire
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">
                        Selectionne
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-zinc-100">{plan.name}</h3>
                  <p className="mt-2 min-h-[3rem] text-sm leading-6 text-zinc-400">{plan.description}</p>
                  <p className="mt-5 text-4xl font-black text-zinc-100">
                    {plan.monthlyPrice > 0 ? formatMoney(plan.monthlyPrice) : "Gratuit"}
                    <span className="text-base font-medium text-zinc-400"> / mois</span>
                  </p>
                  <ul className="mt-6 space-y-2 text-sm text-zinc-200">
                    <li>{plan.maxRunsPerMonth} runs / mois</li>
                    <li>Jusqu'a {plan.maxProspectsPerRun} prospects / run</li>
                    {plan.agents.includes("serper") ? <li>Agent Serper</li> : null}
                    {plan.agents.includes("tavily") ? <li>Agent Tavily</li> : null}
                  </ul>

                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrentPlan) return;
                      revealPayment(plan.id);
                    }}
                    disabled={isCurrentPlan || Boolean(pendingForPlan)}
                    className={`mt-8 inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold transition ${
                      isCurrentPlan
                        ? "cursor-not-allowed bg-emerald-500/15 text-emerald-300"
                        : pendingForPlan
                          ? "cursor-not-allowed bg-amber-500/15 text-amber-200"
                          : isSelected
                            ? "bg-gold text-black hover:bg-amber-400"
                            : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                    }`}
                  >
                    {isCurrentPlan
                      ? "Plan actuel"
                      : pendingForPlan
                        ? "Paiement en attente"
                        : isSelected
                          ? "Voir le paiement"
                          : "Choisir ce plan"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {showPaymentBlock ? (
          <section ref={paymentSectionRef} className="rounded-3xl border border-gold/25 bg-gold/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Paiement</p>
            <h2 className="mt-2 text-3xl font-bold text-zinc-100">
              Payer le plan {selectedPlan?.name} - {selectedPlan ? `${formatMoney(selectedPlan.monthlyPrice)} / mois` : ""}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Effectuez votre paiement puis envoyez votre demande pour activation.
            </p>

            {!paymentMethodsConfigured ? (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Les moyens de paiement sourcing ne sont pas encore configures dans l'admin.
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <PaymentMethodCard
                    title="Wave"
                    icon={Smartphone}
                    accent="violet"
                    selected={paymentMethod === "wave"}
                    number={methods?.waveNumber ?? ""}
                    holder={methods?.waveHolder ?? ""}
                    amount={selectedPlan?.monthlyPrice ?? 0}
                    onSelect={() => setPaymentMethod("wave")}
                    onCopy={copyValue}
                  />
                  <PaymentMethodCard
                    title="Orange Money"
                    icon={Wallet}
                    accent="amber"
                    selected={paymentMethod === "orange_money"}
                    number={methods?.orangeMoneyNumber ?? ""}
                    holder={methods?.orangeMoneyHolder ?? ""}
                    amount={selectedPlan?.monthlyPrice ?? 0}
                    onSelect={() => setPaymentMethod("orange_money")}
                    onCopy={copyValue}
                  />
                </div>

                {methods?.instructions ? (
                  <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-zinc-300">
                    {methods.instructions}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-400">
                      Numero expediteur
                    </span>
                    <input
                      value={senderPhone}
                      onChange={(event) => setSenderPhone(event.target.value)}
                      placeholder="Ex: +225 07 00 00 00 00"
                      className="h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-zinc-100 outline-none transition focus:border-gold/50"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-400">
                      Reference ou note
                    </span>
                    <input
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Ex: paiement sourcing mai"
                      className="h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-zinc-100 outline-none transition focus:border-gold/50"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void submitPaymentRequest()}
                  disabled={saving || !selectedPlan || !senderPhone.trim()}
                  className="mt-5 inline-flex h-12 items-center gap-2 rounded-2xl bg-gold px-5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Envoyer ma demande de paiement
                </button>
              </>
            )}
          </section>
        ) : null}

        {latestRequest ? (
          <section className="rounded-3xl border border-line bg-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Statut de demande</p>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-100">{latestRequest.planName}</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Methode: {latestRequest.method === "wave" ? "Wave" : "Orange Money"} · Envoye le {formatDate(latestRequest.createdAt)}
                </p>
                {latestRequest.reference ? (
                  <p className="mt-2 text-sm text-zinc-400">Reference: {latestRequest.reference}</p>
                ) : null}
                {latestRequest.rejectionReason ? (
                  <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {latestRequest.rejectionReason}
                  </div>
                ) : null}
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${statusBadgeClass(
                latestRequest.status === "approved"
                  ? "paid"
                  : latestRequest.status === "rejected"
                    ? "overdue"
                    : "sent"
              )}`}>
                {latestRequest.status === "approved" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {latestRequest.status === "pending"
                  ? "En attente"
                  : latestRequest.status === "approved"
                    ? "Approuvee"
                    : "Refusee"}
              </div>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}
        {success ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}
      </div>
    </SaasPortalShell>
  );
}

function InfoCell({ label, value, accent }: { label: string; value: string; accent?: "success" | "warning" }) {
  return (
    <div className="rounded-2xl border border-line bg-ink px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${accent === "success" ? "text-emerald-300" : accent === "warning" ? "text-amber-200" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

function PaymentMethodCard({
  title,
  icon: Icon,
  accent,
  selected,
  number,
  holder,
  amount,
  onSelect,
  onCopy
}: {
  title: string;
  icon: typeof Smartphone;
  accent: "violet" | "amber";
  selected: boolean;
  number: string;
  holder: string;
  amount: number;
  onSelect: () => void;
  onCopy: (value: string) => Promise<void>;
}) {
  const accentClass =
    accent === "violet"
      ? selected
        ? "border-violet-400/40 bg-violet-500/10"
        : "border-line bg-panel"
      : selected
        ? "border-amber-400/40 bg-amber-500/10"
        : "border-line bg-panel";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-3xl border p-5 text-left transition ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${accent === "violet" ? "text-violet-300" : "text-amber-200"}`} />
            <span className="text-lg font-bold text-zinc-100">{title}</span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-zinc-500">Numero</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-2xl font-black text-zinc-100">{number || "-"}</p>
            {number ? (
              <span
                onClick={(event) => {
                  event.preventDefault();
                  void onCopy(number);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-ink text-zinc-300"
              >
                <Copy className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        </div>
        {selected ? (
          <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold">Selectionne</span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Titulaire</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{holder || "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Montant a envoyer</p>
          <p className="mt-1 text-sm font-semibold text-gold">{amount > 0 ? formatMoney(amount) : "Gratuit"}</p>
        </div>
      </div>
    </button>
  );
}
