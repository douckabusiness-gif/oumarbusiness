"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FlaskConical, Loader2, Search, Send, Sparkles, Video } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type CreativeLibraryItem = {
  id: string;
  platform: "meta" | "google";
  mediaType: "image" | "video";
  name: string;
  campaign: string;
  format: string;
  primaryText: string;
  cta: string;
  prompt: string;
  fileUrl: string;
  score: number;
  verdict: "ready" | "optimize" | "revise";
  recommendations: string[];
  createdAt: string;
};

type MarketingAbTest = {
  id: string;
  platform: "meta" | "google";
  name: string;
  campaign: string;
  budgetDaily: number;
  status: "draft" | "recommended";
  variants: Array<{
    creativeId: string;
    name: string;
    mediaType: "image" | "video";
    format: string;
    fileUrl: string;
    score: number;
    verdict: "ready" | "optimize" | "revise";
    strengths: string[];
  }>;
  winnerCreativeId: string;
  winnerName: string;
  winnerScore: number;
  recommendation: string;
  nextVariantIdea: string;
  createdAt: string;
};

function toAssetUrl(value: string) {
  return value.startsWith("/uploads/") ? `${apiBaseUrl}${value}` : value;
}

export default function MarketingAbTestsPage() {
  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  const [creatives, setCreatives] = useState<CreativeLibraryItem[]>([]);
  const [tests, setTests] = useState<MarketingAbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("Test Reel vs Reel");
  const [campaign, setCampaign] = useState("Prospection WhatsApp PME Afrique");
  const [budgetDaily, setBudgetDaily] = useState("5000");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (platform === "meta") {
      setName("Test Reel vs Reel");
      setCampaign("Prospection WhatsApp PME Afrique");
    } else {
      setName("Test image Display");
      setCampaign("Création site web professionnel");
    }
    setSelectedIds([]);
    setError("");
    setSuccess("");
  }, [platform]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [creativeResponse, testResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/marketing/creative-library?platform=${platform}`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/marketing/ab-tests?platform=${platform}`, { cache: "no-store" })
        ]);

        const creativeData = await creativeResponse.json();
        const testData = await testResponse.json();

        if (!creativeResponse.ok) {
          throw new Error(String(creativeData.error ?? "Impossible de charger les créatives."));
        }

        if (!testResponse.ok) {
          throw new Error(String(testData.error ?? "Impossible de charger les tests A/B."));
        }

        setCreatives(Array.isArray(creativeData.items) ? creativeData.items : []);
        setTests(Array.isArray(testData.items) ? testData.items : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger les données.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [platform]);

  function toggleCreative(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, id];
    });
  }

  async function handleCreateTest() {
    if (selectedIds.length < 2) {
      setError("Choisis au moins 2 créatives.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${apiBaseUrl}/api/marketing/ab-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          name,
          campaign,
          budgetDaily: Number(budgetDaily),
          creativeIds: selectedIds
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible de créer le test A/B."));
      }

      const item = data.item as MarketingAbTest;
      setTests((current) => [item, ...current]);
      setSuccess("Test A/B créé avec un gagnant recommandé.");
      setSelectedIds([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible de créer le test A/B.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/marketing" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold">
          <ArrowLeft className="h-4 w-4" />
          Retour marketing
        </Link>
        <p className="mt-4 text-sm text-gold">A/B Testing</p>
        <h1 className="mt-2 text-3xl font-bold">Tester plusieurs créatives et choisir le gagnant</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Sélectionne 2 à 4 créatives de ta bibliothèque, lance un test et laisse le système recommander la meilleure variante.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Plateforme" value={platform === "meta" ? "Meta Ads" : "Google Ads"} />
        <StatCard label="Créatives prêtes" value={String(creatives.length)} />
        <StatCard label="Tests lancés" value={String(tests.length)} />
        <StatCard label="Sélection active" value={`${selectedIds.length}/4`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Créer un test</h2>
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

            <Field label="Nom du test" value={name} onChange={setName} />
            <Field label="Campagne" value={campaign} onChange={setCampaign} />
            <Field label="Budget test / jour (FCFA)" value={budgetDaily} onChange={setBudgetDaily} />
          </div>

          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

          <button
            onClick={() => void handleCreateTest()}
            disabled={saving || selectedIds.length < 2}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {saving ? "Création..." : "Lancer le test A/B"}
          </button>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Sparkles className={`h-6 w-6 ${platform === "meta" ? "text-sky-300" : "text-emerald-300"}`} />
            <h2 className="text-lg font-semibold">Choisir les créatives</h2>
          </div>

          {loading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : creatives.length === 0 ? (
            <p className="mt-5 text-sm text-muted">
              Aucune créative disponible pour cette plateforme. Ajoute d'abord une vidéo Meta ou une image Google dans la bibliothèque.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {creatives.map((creative) => {
                const selected = selectedIds.includes(creative.id);
                return (
                  <button
                    key={creative.id}
                    type="button"
                    onClick={() => toggleCreative(creative.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      selected ? "border-gold bg-gold/10" : "border-line bg-ink hover:border-gold/40"
                    }`}
                  >
                    <div className="grid gap-4 md:grid-cols-[132px_1fr]">
                      <div className="overflow-hidden rounded-md border border-line bg-panel">
                        {creative.mediaType === "video" ? (
                          <video src={toAssetUrl(creative.fileUrl)} className="h-32 w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={toAssetUrl(creative.fileUrl)} alt={creative.name} className="h-32 w-full object-cover" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold">{creative.name}</h3>
                          <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-zinc-200">Score {creative.score}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted">{creative.campaign}</p>
                        <p className="mt-3 text-sm text-zinc-200">{creative.primaryText || "Pas de message principal."}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                          <span>{creative.format}</span>
                          <span>•</span>
                          <span>{creative.mediaType === "video" ? "Vidéo" : "Image"}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-gold" />
          <h2 className="text-lg font-semibold">Historique des tests</h2>
        </div>

        {loading ? null : tests.length === 0 ? (
          <p className="mt-5 text-sm text-muted">Aucun test enregistré pour cette plateforme.</p>
        ) : (
          <div className="mt-5 grid gap-4">
            {tests.map((test) => (
              <article key={test.id} className="rounded-lg border border-line bg-ink p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold">{test.name}</h3>
                    <p className="mt-1 text-xs text-muted">{test.campaign}</p>
                  </div>
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                    Gagnant: {test.winnerName} ({test.winnerScore}/100)
                  </span>
                </div>

                <p className="mt-4 text-sm text-zinc-200">{test.recommendation}</p>
                <p className="mt-2 text-sm text-muted">{test.nextVariantIdea}</p>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {test.variants.map((variant) => (
                    <div key={variant.creativeId} className="rounded-md border border-line bg-panel p-3">
                      <div className="flex items-center gap-2">
                        {variant.mediaType === "video" ? (
                          <Video className="h-4 w-4 text-sky-300" />
                        ) : (
                          <Search className="h-4 w-4 text-emerald-300" />
                        )}
                        <p className="font-medium">{variant.name}</p>
                      </div>
                      <p className="mt-2 text-xs text-muted">{variant.format}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
                        {variant.strengths.map((strength) => (
                          <span key={strength} className="rounded-full bg-black/30 px-2 py-1">
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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
