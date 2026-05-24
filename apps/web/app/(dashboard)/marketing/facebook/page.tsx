"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Facebook,
  FlaskConical,
  Image,
  Instagram,
  MessageCircle,
  Mic2,
  PenLine,
  Send,
  Sparkles,
  Target,
  Users,
  type LucideIcon
} from "lucide-react";
import { CreativeLibraryPanel } from "@/components/marketing/CreativeLibraryPanel";

const campaigns = [
  {
    name: "Prospection WhatsApp PME Afrique",
    objective: "Messages",
    audience: "PME + entrepreneurs",
    budget: "250 000 XOF",
    result: "52 leads",
    recommendation:
      "Cette campagne génère du volume, mais le coût par lead peut baisser. Teste une vidéo Reel de 15 secondes avec une accroche directe et un budget test de 5 000 FCFA par jour."
  },
  {
    name: "Agents IA pour restaurants",
    objective: "Lead Ads",
    audience: "Restaurants + livraison",
    budget: "170 000 XOF",
    result: "34 leads",
    recommendation:
      "La cible est bonne. Ajoute une preuve concrète: gain de temps WhatsApp, réponses automatiques et réservation client. Lance deux variations d'image 1:1."
  },
  {
    name: "Reel agence IA",
    objective: "Engagement",
    audience: "Entrepreneurs 22-45",
    budget: "90 000 XOF",
    result: "12 leads",
    recommendation:
      "L'engagement est utile, mais il faut mieux convertir. Ajoute un CTA WhatsApp visible dès les 3 premières secondes et retargete les personnes qui ont regardé 50% de la vidéo."
  }
] as const;

const creatives = [
  ["Image carrée 1:1", "Visuel clair avec offre, bénéfice et CTA WhatsApp.", Image],
  ["Story 9:16", "Version verticale avec texte court et bouton message.", Instagram],
  ["Reel 9:16", "Script vidéo court pour attirer l'attention en 3 secondes.", Clapperboard],
  ["Texte voix off", "Voix chaleureuse, professionnelle et orientée résultat.", Mic2],
  ["Script vidéo", "Hook, problème, solution, preuve, appel à l'action.", PenLine],
  ["Prompt Canva", "Brief prêt pour créer le visuel dans Canva.", Sparkles]
] as const;

export default function FacebookMarketingPage() {
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
        <p className="mt-4 text-sm text-sky-300">Facebook / Meta Ads</p>
        <h1 className="mt-2 text-3xl font-bold">Cockpit Meta : attention, audiences et WhatsApp</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Meta sert à créer la demande : visuels forts, Reels, formulaires leads, retargeting Pixel + API Conversions et conversations WhatsApp.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Metric icon={MessageCircle} label="Objectif fort" value="Messages WhatsApp" />
        <Metric icon={Instagram} label="Placements" value="FB + IG + Reels" />
        <Metric icon={Users} label="Audience" value="Intérêts + lookalike" />
        <Metric icon={Target} label="Tracking" value="Pixel + API Conversions" />
      </div>

      <section className="rounded-lg border border-sky-400/30 bg-panel p-5">
        <div className="flex items-center gap-3">
          <Facebook className="h-7 w-7 text-sky-300" />
          <h2 className="text-lg font-semibold">Campagnes Meta</h2>
        </div>

        <div className="mt-5 space-y-4">
          {campaigns.map((campaign) => (
            <article key={campaign.name} className="rounded-lg border border-line bg-ink p-4">
              <div className="grid gap-4 text-sm lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <p className="font-semibold">{campaign.name}</p>
                  <p className="mt-1 text-xs text-muted">{campaign.audience}</p>
                </div>
                <Info label="Objectif" value={campaign.objective} />
                <Info label="Budget" value={campaign.budget} />
                <Info label="Résultat" value={campaign.result} />
              </div>
              <div className="mt-4 rounded-md border border-gold/25 bg-gold/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gold">
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
          <h2 className="text-lg font-semibold">Générateur campagne Meta</h2>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <Field label="Offre" defaultValue="Agent IA WhatsApp pour PME" />
          <Field label="Audience" defaultValue="Entrepreneurs Afrique + Europe" />
          <Field label="Format" defaultValue="Image 1:1 + Reel 9:16" />
          <Field label="CTA" defaultValue="Envoyer un message" />
        </div>
        <textarea
          defaultValue="Accroche : Ne perdez plus vos clients dans les messages. Automatisez WhatsApp avec Oumar Business."
          className="mt-4 min-h-28 w-full rounded-md border border-line bg-ink p-3 text-sm outline-none focus:border-gold/70"
        />
        <button className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-sky-300 px-5 text-sm font-semibold text-black">
          <Image className="h-4 w-4" />
          Générer créatives Meta
        </button>
      </section>

      <CreativeLibraryPanel
        platform="meta"
        mediaType="video"
        title="Bibliothèque vidéo Meta"
        description="Ajoute, score et réutilise tes Reels, Stories et vidéos carrées pour les campagnes Meta."
        accent="sky"
        accept="video/mp4,video/webm,video/quicktime"
        defaultName="Reel agent IA WhatsApp"
        defaultCampaign="Prospection WhatsApp PME Afrique"
        formatOptions={["Reel 9:16", "Story 9:16", "Vidéo carrée 1:1"]}
        defaultFormat="Reel 9:16"
        defaultPrimaryText="Automatisez WhatsApp avec Oumar Business et répondez plus vite à vos prospects."
        defaultCta="Envoyer un message WhatsApp"
        defaultPrompt="Entrepreneur africain moderne, téléphone WhatsApp, interface IA, style premium noir et or."
        defaultScript="Vous perdez des prospects parce que vos messages restent sans réponse. Oumar Business installe un agent IA qui répond, qualifie et relance automatiquement."
        defaultVoiceover="Professionnelle, énergique, claire, accent francophone neutre."
        submitLabel="Enregistrer dans la bibliothèque"
      />

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-gold" />
          <h2 className="text-lg font-semibold">Créatives</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {creatives.map(([title, description, Icon]) => (
            <article key={title} className="rounded-lg border border-line bg-ink p-4">
              <Icon className="h-5 w-5 text-sky-300" />
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
      <Icon className="h-5 w-5 text-sky-300" />
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
