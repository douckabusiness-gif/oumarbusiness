"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ExternalLink, Loader2, PlayCircle, ShieldCheck, Sparkles, Star } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ProjectCategory = "agent" | "website" | "marketing" | "automation";

type MarketplaceApp = {
  id: string;
  slug: string;
  appName: string;
  category: ProjectCategory;
  tagline: string;
  shortDescription: string;
  marketScope: string;
  priceFrom: number;
  currency: "XOF" | "EUR" | "USD";
  demoUrl: string;
  thumbnailUrl?: string;
  tags: string[];
  featured: boolean;
};

const categoryLabels: Record<ProjectCategory, string> = {
  agent: "Agent IA",
  website: "Site web",
  marketing: "Marketing",
  automation: "Automation"
};

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | ProjectCategory>("all");

  useEffect(() => {
    async function loadApps() {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/market/public-apps`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(String(data.error ?? "Impossible de charger le marketplace."));
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le marketplace.");
      } finally {
        setLoading(false);
      }
    }

    void loadApps();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => (filter === "all" ? true : item.category === filter));
  }, [filter, items]);

  const featuredCount = items.filter((item) => item.featured).length;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <section className="public-header-3d rounded-[28px] p-7 sm:p-9">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                Marketplace Oumar Business
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Des systèmes <span className="text-gradient">prêts à montrer</span>, tester et vendre
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-300">
                Une vitrine simple et claire pour présenter tes applications, donner accès à la démo, expliquer la valeur du produit
                et transformer l’intérêt en demande commerciale.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px]">
              <MetricCard label="Applications" value={String(items.length)} />
              <MetricCard label="Featured" value={String(featuredCount)} />
              <MetricCard label="Catégories" value="4" />
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {[
              { value: "all", label: "Tout" },
              { value: "website", label: "Applications web" },
              { value: "agent", label: "Agents IA" },
              { value: "marketing", label: "Marketing" },
              { value: "automation", label: "Automatisation" }
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value as "all" | ProjectCategory)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filter === item.value ? "bg-gold text-black" : "border border-white/10 bg-white/5 text-zinc-300 hover:border-gold/40"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="mt-12 flex items-center gap-3 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement du showroom...
          </div>
        ) : error ? (
          <div className="mt-12 rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-zinc-300">
            Aucune application publique pour le moment.
          </div>
        ) : (
          <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] transition hover:-translate-y-1 hover:border-gold/30">
                <div className="relative aspect-[16/10] overflow-hidden bg-[#111]">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveAssetUrl(item.thumbnailUrl)} alt={item.appName} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gold/15 via-transparent to-amber/15">
                      <span className="text-lg font-semibold text-zinc-200">{item.appName}</span>
                    </div>
                  )}
                  {item.featured ? (
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black">
                      <Star className="h-3.5 w-3.5" />
                      Featured
                    </span>
                  ) : null}
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                      {categoryLabels[item.category]}
                    </span>
                    <span className="text-sm font-semibold text-gold">
                      Dès {item.priceFrom.toLocaleString("fr-FR")} {item.currency}
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold">{item.appName}</h2>
                  <p className="mt-2 text-sm font-medium text-gold">{item.tagline}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{item.shortDescription}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-500">{item.marketScope}</p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <MiniFact icon={<ShieldCheck className="h-3.5 w-3.5 text-gold" />} text="Démo disponible" />
                    <MiniFact icon={<BadgeCheck className="h-3.5 w-3.5 text-gold" />} text="Personnalisable client" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <a
                      href={item.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Démo live
                    </a>
                    <Link
                      href={`/marketplace/${item.slug}`}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Voir fiche
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <section className="public-footer-3d mt-14 rounded-[28px] p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold">Tu veux ce système pour ton business ?</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                Chaque application peut être personnalisée, rebrandée et installée pour un client final. Tu peux montrer la démo,
                recevoir une demande et transformer l’intérêt en projet.
              </p>
            </div>
            <a
              href="https://wa.me/2250000000000"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black"
            >
              Commander sur WhatsApp
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function MiniFact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function resolveAssetUrl(value?: string) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }

  return value;
}
