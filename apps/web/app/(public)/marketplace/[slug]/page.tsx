"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Download,
  ExternalLink,
  Globe2,
  KeyRound,
  Loader2,
  MonitorPlay,
  PackageCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Star
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type MarketplaceApp = {
  id: string;
  slug: string;
  appName: string;
  category: "agent" | "website" | "marketing" | "automation";
  tagline: string;
  shortDescription: string;
  fullDescription: string;
  targetClient: string;
  marketScope: string;
  priceFrom: number;
  currency: "XOF" | "EUR" | "USD";
  licenseType: "single" | "extended" | "enterprise" | "internal";
  licenseName: string;
  licenseSummary: string;
  supportWindowDays: number;
  demoUrl: string;
  adminDemoUrl?: string;
  demoLogin?: string;
  demoPassword?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  downloadUrl?: string;
  galleryUrls: string[];
  features: string[];
  deliverables: string[];
  techStack: string[];
  tags: string[];
  featured: boolean;
};

export default function MarketplaceDetailPage() {
  const params = useParams<{ slug: string }>();
  const [item, setItem] = useState<MarketplaceApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderInfo, setOrderInfo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadApp() {
      if (!params?.slug) return;

      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/market/public-apps/${params.slug}`, { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(String(data.error ?? "Application introuvable."));
        }

        setItem(data.item as MarketplaceApp);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger l'application.");
      } finally {
        setLoading(false);
      }
    }

    void loadApp();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] px-5 py-16 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la fiche produit...
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-[#080808] px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-gold">
            <ArrowLeft className="h-4 w-4" />
            Retour marketplace
          </Link>
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            {error || "Application introuvable."}
          </div>
        </div>
      </div>
    );
  }

  const mediaItems = [item.thumbnailUrl, ...item.galleryUrls].filter(Boolean) as string[];

  async function handleOrder() {
    if (!item) return;

    try {
      setSubmitting(true);
      setOrderError("");
      setOrderSuccess("");
      setOrderInfo("");

      const response = await fetch(`${apiBaseUrl}/api/market/public-apps/${item.slug}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName,
          company,
          email,
          whatsapp,
          country,
          budget,
          message,
          language: "fr"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible d'envoyer la demande."));
      }

      setOrderSuccess(String(data.message ?? "Ta demande est bien partie. Elle est maintenant enregistrée dans le CRM de Oumar Business."));
      const emailStatus = data?.confirmations?.email?.status as string | undefined;
      const whatsappStatus = data?.confirmations?.whatsapp?.status as string | undefined;
      const notes: string[] = [];
      if (emailStatus === "failed") {
        notes.push("L'email de confirmation n'a pas pu partir.");
      }
      if (whatsappStatus === "failed") {
        notes.push("Le WhatsApp de confirmation n'a pas pu partir.");
      }
      if (notes.length > 0) {
        setOrderInfo(notes.join(" "));
      }
      setCustomerName("");
      setCompany("");
      setEmail("");
      setWhatsapp("");
      setCountry("");
      setBudget("");
      setMessage("");
    } catch (submitError) {
      setOrderError(submitError instanceof Error ? submitError.message : "Impossible d'envoyer la demande.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-gold">
          <ArrowLeft className="h-4 w-4" />
          Retour marketplace
        </Link>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  <Sparkles className="h-3.5 w-3.5" />
                  Application prête à vendre
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                  {categoryLabel(item.category)}
                </span>
                {item.featured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black">
                    <Star className="h-3.5 w-3.5" />
                    Featured
                  </span>
                ) : null}
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{item.appName}</h1>
              <p className="mt-3 text-lg font-medium text-gold">{item.tagline}</p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">{item.fullDescription}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="relative aspect-[16/10] bg-[#111]">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveAssetUrl(item.thumbnailUrl)} alt={item.appName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-gold/15 via-transparent to-amber/15">
                    <span className="text-3xl font-bold text-zinc-200">{item.appName}</span>
                  </div>
                )}
              </div>
            </div>

            {item.videoUrl ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold">Vidéo preview</h2>
                <p className="mt-2 text-sm text-zinc-300">Tu peux brancher ici une vidéo YouTube, Loom ou hébergée.</p>
                {isDirectVideoFile(item.videoUrl) ? (
                  <video src={resolveAssetUrl(item.videoUrl)} controls className="mt-4 aspect-video w-full rounded-xl bg-black" />
                ) : (
                  <a href={item.videoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black">
                    <MonitorPlay className="h-4 w-4" />
                    Ouvrir la vidéo
                  </a>
                )}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HighlightCard icon={<BadgeCheck className="h-4 w-4 text-gold" />} label="Prix de départ" value={`${item.priceFrom.toLocaleString("fr-FR")} ${item.currency}`} />
              <HighlightCard icon={<ShieldCheck className="h-4 w-4 text-gold" />} label="Licence" value={licenseLabel(item.licenseType)} />
              <HighlightCard icon={<Clock3 className="h-4 w-4 text-gold" />} label="Support inclus" value={`${item.supportWindowDays} jours`} />
              <HighlightCard icon={<Globe2 className="h-4 w-4 text-gold" />} label="Marché cible" value={item.marketScope} />
            </div>

            <SectionCard title="Ce que tu obtiens" icon={<PackageCheck className="h-5 w-5 text-gold" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoCard label="Client cible" value={item.targetClient} />
                <InfoCard label="Type de système" value={categoryLabel(item.category)} />
                <InfoCard label="Nom de licence" value={item.licenseName} />
                <InfoCard label="Déploiement" value={item.downloadUrl ? "Package prêt à récupérer" : "Livraison pilotée par Oumar Business"} />
              </div>
            </SectionCard>

            <SectionCard title="Licence et support" icon={<ShieldCheck className="h-5 w-5 text-gold" />}>
              <div className="rounded-2xl border border-gold/20 bg-gold/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gold">Résumé licence</p>
                <p className="mt-2 text-sm leading-7 text-zinc-200">{item.licenseSummary}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoCard label="Licence active" value={item.licenseName} />
                <InfoCard label="Niveau" value={licenseLabel(item.licenseType)} />
                <InfoCard label="Support" value={`${item.supportWindowDays} jours`} />
              </div>
            </SectionCard>

            {mediaItems.length > 1 ? (
              <SectionCard title="Aperçus du système" icon={<MonitorPlay className="h-5 w-5 text-gold" />}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mediaItems.slice(0, 6).map((url) => (
                  <div key={url} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveAssetUrl(url)} alt={item.appName} className="aspect-[4/3] h-full w-full object-cover" />
                  </div>
                ))}
                </div>
              </SectionCard>
            ) : null}
          </div>

          <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
            <div className="rounded-3xl border border-gold/20 bg-gradient-to-b from-gold/10 to-white/[0.03] p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Prix de départ</p>
                  <p className="mt-2 text-3xl font-black text-white">{item.priceFrom.toLocaleString("fr-FR")} {item.currency}</p>
                </div>
                <div className="rounded-2xl border border-gold/20 bg-black/30 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Support</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">{item.supportWindowDays} jours</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <TrustRow label="Licence incluse" value={item.licenseName} />
                <TrustRow label="Marché" value={item.marketScope} />
                <TrustRow label="Client cible" value={item.targetClient} />
                <TrustRow label="Téléchargement" value={item.downloadUrl ? "Disponible immédiatement" : "Livraison après validation"} />
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <a href={item.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black">
                  Voir la démo live
                  <ExternalLink className="h-4 w-4" />
                </a>
                {item.adminDemoUrl ? (
                  <a href={item.adminDemoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white">
                    Démo admin
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {item.downloadUrl ? (
                  <a
                    href={resolveAssetUrl(item.downloadUrl)}
                    download
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Telecharger le package
                    <Download className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
                    Aucun package public direct. Livraison ou installation gérée après commande.
                  </div>
                )}
                <a href="#order-form" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white">
                  Commander cette application
                </a>
              </div>
            </div>

            <div id="order-form" className="rounded-2xl border border-gold/20 bg-gold/10 p-5">
              <h2 className="text-lg font-semibold">Demander cette app</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Remplis ce formulaire. Ta demande ira directement dans le CRM comme prospect marketplace.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Nom" value={customerName} onChange={setCustomerName} />
                <Field label="Entreprise" value={company} onChange={setCompany} />
                <Field label="Email" value={email} onChange={setEmail} />
                <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
                <Field label="Pays" value={country} onChange={setCountry} />
                <Field label="Budget" value={budget} onChange={setBudget} />
              </div>

              <div className="mt-3">
                <TextAreaField label="Message" value={message} onChange={setMessage} />
              </div>

              {orderError ? <p className="mt-4 text-sm text-red-300">{orderError}</p> : null}
              {orderSuccess ? <p className="mt-4 text-sm text-emerald-300">{orderSuccess}</p> : null}
              {orderInfo ? <p className="mt-2 text-sm text-amber-300">{orderInfo}</p> : null}

              <button
                onClick={() => void handleOrder()}
                disabled={submitting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Envoi..." : "Envoyer la demande au CRM"}
              </button>
            </div>

            {(item.demoLogin || item.demoPassword) ? (
              <div className="rounded-2xl border border-gold/20 bg-gold/10 p-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-gold" />
                  <h2 className="text-lg font-semibold">Accès démo</h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoCard label="Login" value={item.demoLogin || "Non fourni"} />
                  <InfoCard label="Mot de passe" value={item.demoPassword || "Non fourni"} />
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-gold" />
                <h2 className="text-lg font-semibold">Fonctionnalités clés</h2>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                {item.features.map((feature) => (
                  <li key={feature} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold">Stack technique</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.techStack.map((tech) => (
                  <span key={tech} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold">Livrables</h2>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                {item.deliverables.map((deliverable) => (
                  <li key={deliverable} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function HighlightCard({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function TrustRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-right text-sm font-medium text-zinc-100">{value}</span>
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
        className="h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 outline-none focus:border-gold/60"
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
        className="min-h-28 rounded-xl border border-white/10 bg-white/[0.03] p-3 outline-none focus:border-gold/60"
      />
    </label>
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

function isDirectVideoFile(value?: string) {
  if (!value) return false;
  return /\.(mp4|webm|mov)$/i.test(value) || value.startsWith("/uploads/");
}

function licenseLabel(value: MarketplaceApp["licenseType"]) {
  if (value === "extended") return "Licence etendue";
  if (value === "enterprise") return "Licence entreprise";
  if (value === "internal") return "Usage interne";
  return "Licence simple";
}

function categoryLabel(value: MarketplaceApp["category"]) {
  if (value === "agent") return "Agent IA";
  if (value === "website") return "Application web";
  if (value === "marketing") return "Systeme marketing";
  return "Automatisation";
}
