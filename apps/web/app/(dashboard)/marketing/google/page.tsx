"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  FileText,
  FlaskConical,
  Image,
  KeyRound,
  Link2,
  MousePointerClick,
  Search,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import { CreativeLibraryPanel } from "@/components/marketing/CreativeLibraryPanel";

const campaigns = [
  {
    name: "Création site web professionnel",
    type: "Search",
    keywords: "création site web, agence web",
    budget: "120 000 XOF",
    result: "18 leads",
    recommendation:
      "La campagne capte une intention forte. Ajoute des mots-clés négatifs comme gratuit, formation et emploi pour réduire les clics inutiles."
  },
  {
    name: "Agence marketing digital Abidjan",
    type: "Search local",
    keywords: "agence marketing, publicité en ligne",
    budget: "160 000 XOF",
    result: "27 leads",
    recommendation:
      "Le volume est bon. Crée une landing page locale avec preuve sociale, WhatsApp visible et formulaire court pour améliorer le taux de conversion."
  },
  {
    name: "Agent IA entreprise",
    type: "Search international",
    keywords: "agent IA entreprise, chatbot business",
    budget: "220 000 XOF",
    result: "21 leads",
    recommendation:
      "Le sujet est premium. Teste deux annonces : une orientée gain de temps et une orientée réduction des coûts opérationnels."
  }
] as const;

const assets = [
  ["Titres Search", "15 titres courts avec bénéfice clair et mot-clé principal.", FileText],
  ["Descriptions", "4 descriptions avec preuve, urgence et appel à l'action.", Send],
  ["Sitelinks", "Liens vers services, devis, cas clients et contact.", Link2],
  ["Mots-clés négatifs", "Liste pour éviter les clics sans intention d'achat.", KeyRound],
  ["Landing page", "Structure de page optimisée pour conversion.", MousePointerClick],
  ["Tracking", "Plan de conversion Google Ads + GA4.", BarChart3]
] as const;

export default function GoogleMarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/marketing" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold">
            <ArrowLeft className="h-4 w-4" />
            Retour marketing
          </Link>
          <Link href="/marketing/ab-tests" className="inline-flex items-center gap-2 text-sm text-gold hover:text-amber-300">
            <FlaskConical className="h-4 w-4" />
            A/B Testing
          </Link>
          <Link href="/marketing/planner" className="inline-flex items-center gap-2 text-sm text-gold hover:text-amber-300">
            <CalendarDays className="h-4 w-4" />
            Planner
          </Link>
        </div>
        <p className="mt-4 text-sm text-emerald-300">Google Ads</p>
        <h1 className="mt-2 text-3xl font-bold">Cockpit Google : intention, mots-clés et conversions</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Google sert à capturer les clients qui cherchent déjà une solution. Ici on travaille les mots-clés, les annonces, les landing pages et les conversions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Metric icon={Search} label="Objectif fort" value="Search leads" />
        <Metric icon={KeyRound} label="Base" value="Mots-clés" />
        <Metric icon={MousePointerClick} label="Conversion" value="Devis / appel" />
        <Metric icon={BarChart3} label="Tracking" value="Google Ads + GA4" />
      </div>

      <section className="rounded-lg border border-emerald-400/30 bg-panel p-5">
        <div className="flex items-center gap-3">
          <Search className="h-7 w-7 text-emerald-300" />
          <h2 className="text-lg font-semibold">Campagnes Google</h2>
        </div>

        <div className="mt-5 space-y-4">
          {campaigns.map((campaign) => (
            <article key={campaign.name} className="rounded-lg border border-line bg-ink p-4">
              <div className="grid gap-4 text-sm lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <p className="mt-1 text-xs text-muted">{campaign.keywords}</p>
                </div>
                <Info label="Type" value={campaign.type} />
                <Info label="Budget" value={campaign.budget} />
                <Info label="Résultat" value={campaign.result} />
              </div>
              <div className="mt-4 rounded-md border border-emerald-300/25 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Recommandation IA
                </div>
                <p className="mt-2 text-sm text-zinc-200">{campaign.recommendation}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center gap-3">
          <Send className="h-6 w-6 text-gold" />
          <h2 className="text-lg font-semibold">Générateur campagne Google</h2>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <Field label="Service" defaultValue="Création de site web professionnel" />
          <Field label="Mots-clés" defaultValue="création site web, agence web, site vitrine" />
          <Field label="Landing page" defaultValue="https://oumarbusiness.online/services" />
          <Field label="Conversion" defaultValue="Demande de devis" />
        </div>
        <textarea
          defaultValue="Annonce : Créez un site web professionnel avec Oumar Business. Devis rapide, design moderne, support WhatsApp."
          className="mt-4 min-h-28 w-full rounded-md border border-line bg-ink p-3 text-sm outline-none focus:border-gold/70"
        />
        <button className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-300 px-5 text-sm font-semibold text-black">
          <TrendingUp className="h-4 w-4" />
          Générer annonces Search
        </button>
      </section>

      <CreativeLibraryPanel
        platform="google"
        mediaType="image"
        title="Bibliothèque image Google"
        description="Ajoute, score et réutilise tes visuels Display, Performance Max et landing pages."
        accent="emerald"
        accept="image/png,image/jpeg,image/webp"
        defaultName="Visuel création site web"
        defaultCampaign="Création site web professionnel"
        formatOptions={["Performance Max", "Display", "Landing page", "Image 1:1"]}
        defaultFormat="Performance Max"
        defaultPrimaryText="Créez un site web professionnel avec un design moderne et un devis rapide."
        defaultCta="Demande de devis"
        defaultPrompt="Visuel premium noir et or, entrepreneur devant un dashboard web moderne, message clair et lisible."
        submitLabel="Enregistrer dans la bibliothèque"
      />

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-gold" />
          <h2 className="text-lg font-semibold">Assets de campagne</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map(([title, description, Icon]) => (
            <article key={title} className="rounded-lg border border-line bg-ink p-4">
              <Icon className="h-5 w-5 text-emerald-300" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <Icon className="h-5 w-5 text-emerald-300" />
      <p className="mt-4 text-xs text-muted">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input defaultValue={defaultValue} className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70" />
    </label>
  );
}
