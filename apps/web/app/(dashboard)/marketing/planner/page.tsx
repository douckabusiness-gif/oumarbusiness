"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, PauseCircle, PlayCircle, Rocket, Save, Sparkles } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type Platform = "meta" | "google";
type CampaignStatus = "draft" | "testing" | "active" | "paused" | "completed";

type MarketingAbTest = {
  id: string;
  platform: Platform;
  name: string;
  campaign: string;
  winnerName: string;
};

type MarketingCampaignPlan = {
  id: string;
  platform: Platform;
  name: string;
  objective: string;
  status: CampaignStatus;
  budgetDaily: number;
  startDate: string;
  channel: string;
  notes: string;
  linkedCreativeIds: string[];
  linkedTestId?: string;
  createdAt: string;
  updatedAt: string;
};

const statusOrder: CampaignStatus[] = ["draft", "testing", "active", "paused", "completed"];

const statusLabels: Record<CampaignStatus, string> = {
  draft: "Brouillon",
  testing: "Test",
  active: "Actif",
  paused: "Pause",
  completed: "Terminé"
};

export default function MarketingPlannerPage() {
  const [platform, setPlatform] = useState<Platform>("meta");
  const [plans, setPlans] = useState<MarketingCampaignPlan[]>([]);
  const [tests, setTests] = useState<MarketingAbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("Lancement campagne Meta WhatsApp");
  const [objective, setObjective] = useState("Générer des demandes entrantes WhatsApp qualifiées");
  const [budgetDaily, setBudgetDaily] = useState("5000");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState("Messages WhatsApp");
  const [notes, setNotes] = useState("Suivre CPL, taux de réponse et qualité des leads.");
  const [linkedTestId, setLinkedTestId] = useState("");

  useEffect(() => {
    if (platform === "meta") {
      setName("Lancement campagne Meta WhatsApp");
      setObjective("Générer des demandes entrantes WhatsApp qualifiées");
      setChannel("Messages WhatsApp");
      setNotes("Suivre CPL, taux de réponse et qualité des leads.");
    } else {
      setName("Lancement campagne Google Search");
      setObjective("Capter les prospects déjà en intention d'achat");
      setChannel("Search + landing page");
      setNotes("Surveiller CTR, taux de conversion et mots-clés négatifs.");
    }
    setLinkedTestId("");
    setError("");
    setSuccess("");
  }, [platform]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [plansResponse, testsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/marketing/campaign-plans?platform=${platform}`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/marketing/ab-tests?platform=${platform}`, { cache: "no-store" })
        ]);

        const plansData = await plansResponse.json();
        const testsData = await testsResponse.json();

        if (!plansResponse.ok) {
          throw new Error(String(plansData.error ?? "Impossible de charger les campagnes."));
        }

        if (!testsResponse.ok) {
          throw new Error(String(testsData.error ?? "Impossible de charger les tests."));
        }

        setPlans(Array.isArray(plansData.items) ? plansData.items : []);
        setTests(Array.isArray(testsData.items) ? testsData.items : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le planner.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [platform]);

  const plansByStatus = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      items: plans.filter((plan) => plan.status === status)
    }));
  }, [plans]);

  async function handleCreatePlan() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${apiBaseUrl}/api/marketing/campaign-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          name,
          objective,
          status: "draft",
          budgetDaily: Number(budgetDaily),
          startDate,
          channel,
          notes,
          linkedTestId: linkedTestId || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible de créer la campagne."));
      }

      const item = data.item as MarketingCampaignPlan;
      setPlans((current) => [item, ...current]);
      setSuccess("Campagne ajoutée au planner.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible de créer la campagne.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(planId: string, status: CampaignStatus) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/marketing/campaign-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible de mettre à jour la campagne."));
      }

      const item = data.item as MarketingCampaignPlan;
      setPlans((current) => current.map((plan) => (plan.id === item.id ? item : plan)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Impossible de mettre à jour la campagne.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/marketing" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold">
          <ArrowLeft className="h-4 w-4" />
          Retour marketing
        </Link>
        <p className="mt-4 text-sm text-gold">Planification</p>
        <h1 className="mt-2 text-3xl font-bold">Piloter le cycle de vie des campagnes</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Prépare tes campagnes, choisis une date de lancement, lie un test A/B si besoin puis fais avancer la campagne de brouillon à actif.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Plateforme" value={platform === "meta" ? "Meta Ads" : "Google Ads"} />
        <StatCard label="Campagnes" value={String(plans.length)} />
        <StatCard label="Tests A/B" value={String(tests.length)} />
        <StatCard label="Actives" value={String(plans.filter((plan) => plan.status === "active").length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Nouvelle campagne</h2>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="text-zinc-300">Plateforme</span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value === "google" ? "google" : "meta")}
                className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
              >
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
              </select>
            </label>

            <Field label="Nom campagne" value={name} onChange={setName} />
            <Field label="Objectif" value={objective} onChange={setObjective} />
            <Field label="Budget / jour (FCFA)" value={budgetDaily} onChange={setBudgetDaily} />
            <Field label="Canal" value={channel} onChange={setChannel} />
            <DateField label="Date de lancement" value={startDate} onChange={setStartDate} />

            <label className="grid gap-2 text-sm">
              <span className="text-zinc-300">Lier un test A/B</span>
              <select
                value={linkedTestId}
                onChange={(event) => setLinkedTestId(event.target.value)}
                className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
              >
                <option value="">Aucun test lié</option>
                {tests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.name} - gagnant {test.winnerName}
                  </option>
                ))}
              </select>
            </label>

            <TextAreaField label="Notes opérationnelles" value={notes} onChange={setNotes} />
          </div>

          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

          <button
            onClick={() => void handleCreatePlan()}
            disabled={saving}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Enregistrement..." : "Ajouter au planner"}
          </button>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Sparkles className={`h-6 w-6 ${platform === "meta" ? "text-sky-300" : "text-emerald-300"}`} />
            <h2 className="text-lg font-semibold">Pipeline des campagnes</h2>
          </div>

          {loading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du planner...
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-5">
              {plansByStatus.map((group) => (
                <div key={group.status} className="rounded-lg border border-line bg-ink p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{statusLabels[group.status]}</h3>
                    <span className="rounded-full bg-black/30 px-2 py-1 text-xs text-zinc-300">{group.items.length}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.items.length === 0 ? (
                      <p className="text-xs text-muted">Aucune campagne</p>
                    ) : (
                      group.items.map((plan) => (
                        <article key={plan.id} className="rounded-md border border-line bg-panel p-3">
                          <h4 className="font-medium">{plan.name}</h4>
                          <p className="mt-1 text-xs text-muted">{plan.objective}</p>
                          <div className="mt-3 grid gap-1 text-xs text-zinc-300">
                            <span>{plan.budgetDaily.toLocaleString("fr-FR")} FCFA / jour</span>
                            <span>Lancement: {plan.startDate}</span>
                            <span>{plan.channel}</span>
                          </div>
                          {plan.linkedTestId ? (
                            <p className="mt-2 text-xs text-gold">Test A/B lié</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {plan.status !== "draft" ? (
                              <button
                                onClick={() => void updateStatus(plan.id, "draft")}
                                className="rounded-md border border-line px-2 py-1 text-xs"
                              >
                                Brouillon
                              </button>
                            ) : null}
                            {plan.status !== "testing" ? (
                              <button
                                onClick={() => void updateStatus(plan.id, "testing")}
                                className="rounded-md border border-line px-2 py-1 text-xs"
                              >
                                Test
                              </button>
                            ) : null}
                            {plan.status !== "active" ? (
                              <button
                                onClick={() => void updateStatus(plan.id, "active")}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-300 px-2 py-1 text-xs font-semibold text-black"
                              >
                                <Rocket className="h-3 w-3" />
                                Activer
                              </button>
                            ) : null}
                            {plan.status !== "paused" ? (
                              <button
                                onClick={() => void updateStatus(plan.id, "paused")}
                                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs"
                              >
                                <PauseCircle className="h-3 w-3" />
                                Pause
                              </button>
                            ) : null}
                            {plan.status !== "completed" ? (
                              <button
                                onClick={() => void updateStatus(plan.id, "completed")}
                                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs"
                              >
                                <PlayCircle className="h-3 w-3" />
                                Terminer
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-md border border-line bg-ink p-3 text-sm outline-none focus:border-gold/70"
      />
    </label>
  );
}
