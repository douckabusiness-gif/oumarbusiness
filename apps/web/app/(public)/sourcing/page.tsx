"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Globe2,
  MapPin,
  Menu,
  Radar,
  Search,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  Users,
  X,
  Zap
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

// ─── Types ─────────────────────────────────────────────────────────────────

type Plan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  maxRunsPerMonth: number;
  maxProspectsPerRun: number;
  agents: string[];
  isPopular: boolean;
  isActive: boolean;
};

// ─── Données statiques ─────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    icon: Search,
    title: "Tu définis ton brief",
    text: "Secteur, zone géographique, mots-clés et nombre de prospects ciblés. 30 secondes suffisent."
  },
  {
    n: "02",
    icon: Radar,
    title: "Les agents cherchent",
    text: "Serper parcourt le web en largeur, Tavily qualifie en profondeur. Deux moteurs, un seul résultat."
  },
  {
    n: "03",
    icon: Target,
    title: "Tu reçois tes prospects",
    text: "Entreprise, contact, site web, score de pertinence. Tout classé, prêt à exploiter ou exporter."
  }
];

const AGENTS = [
  {
    key: "serper",
    name: "Agent Serper",
    badge: "Découverte rapide",
    color: "violet" as const,
    headline: "Trouve un maximum de cibles en un minimum de temps.",
    description:
      "Serper exploite les résultats de recherche pour identifier rapidement un grand nombre d'entreprises correspondant à ton profil cible.",
    features: [
      "Recherche web à haute vitesse",
      "Large couverture sectorielle",
      "Idéal pour les prospections à fort volume",
      "Score automatique de pertinence"
    ]
  },
  {
    key: "tavily",
    name: "Agent Tavily",
    badge: "Qualification approfondie",
    color: "sky" as const,
    headline: "Analyse chaque prospect en profondeur avant de te le livrer.",
    description:
      "Tavily plonge dans le contenu de chaque cible pour extraire des informations précises : activité, taille, contacts, signaux d'achat.",
    features: [
      "Analyse sémantique avancée",
      "Extraction de contacts directs",
      "Détection de signaux d'achat",
      "Synthèse détaillée par prospect"
    ]
  }
];

const MARQUEE = [
  "Serper Agent",
  "Tavily Agent",
  "Sourcing Automatisé",
  "Export CSV",
  "Scoring IA",
  "Prospects Qualifiés",
  "Multi-Secteurs",
  "Multi-Zones"
];

// ─── Taglines marketing par plan ──────────────────────────────────────────

const PLAN_TAGLINES: Record<string, string> = {
  starter: "Idéal pour tester la prospection automatisée avant de passer au Pro.",
  pro: "Pour les commerciaux qui veulent des résultats dès la première semaine.",
  business: "Pour les équipes qui veulent générer des prospects chaque semaine."
};

// ─── Compteur anime ────────────────────────────────────────────────────────

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1400;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(value * eased));
      if (progress < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {current}
      {suffix}
    </span>
  );
}

// ─── Formatage monnaie ─────────────────────────────────────────────────────

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0
  }).format(amount);
}

// ─── Page principale ───────────────────────────────────────────────────────

export default function SourcingLandingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [branding, setBranding] = useState<{ agencyName?: string; logoUrl?: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [brandRes, plansRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/sourcing/public/sourcing/plans`, { cache: "no-store" })
        ]);
        const brandData = (await brandRes.json()) as { agencyName?: string; logoUrl?: string };
        const plansData = (await plansRes.json()) as { ok: boolean; plans: Plan[] };
        if (mounted) {
          setBranding(brandData);
          if (plansData.ok) setPlans(plansData.plans);
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoadingPlans(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const agencyName = branding?.agencyName ?? "Oumar Business";
  const logoUrl = resolveLogo(branding?.logoUrl ?? "");

  return (
    <div className="bg-ink text-white">

      {/* ── Header sticky ──────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-blue-800/40 bg-blue-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={agencyName} className="h-9 w-auto object-contain" />
            ) : (
              <span className="text-base font-black text-gold">{agencyName}</span>
            )}
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-400 md:flex">
            <a href="#comment" className="transition hover:text-white">Comment ça marche</a>
            <a href="#agents" className="transition hover:text-white">Les agents</a>
            <a href="#tarifs" className="transition hover:text-white">Tarifs</a>
            <Link href="/" className="transition hover:text-white">Accueil</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/user/login"
              className="inline-flex rounded-xl border border-line px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-gold/40 hover:text-gold"
            >
              Connexion
            </Link>
            <Link
              href="/user/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              Commencer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-panel text-white md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div className="border-t border-blue-800/30 bg-blue-950/95 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4">
              <a href="#comment" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Comment ca marche
              </a>
              <a href="#agents" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Les agents
              </a>
              <a href="#tarifs" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Tarifs
              </a>
              <Link href="/" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Accueil
              </Link>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link href="/user/login" className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white">
                  Connexion
                </Link>
                <Link href="/user/register" className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-bold text-black">
                  Inscription
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main>

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Blobs decoratifs */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-gold/12 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-20 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-sky-500/8 blur-3xl" />

          {/* Grille */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#d4a020 1px, transparent 1px), linear-gradient(90deg, #d4a020 1px, transparent 1px)",
              backgroundSize: "44px 44px"
            }}
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 py-24 lg:grid-cols-2 lg:py-36">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              {/* Badge */}
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                Sourcing Commercial — Powered by IA
              </div>

              <h1 className="text-5xl font-black leading-[1.05] tracking-tight md:text-6xl xl:text-7xl">
                Trouve tes{" "}
                <span className="bg-gradient-to-r from-gold via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                  prospects
                </span>
                <br />
                en{" "}
                <span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
                  quelques minutes
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-300">
                Deux agents IA spécialisés — Serper et Tavily — cherchent, qualifient et te livrent des
                prospects prêts à être contactés. Tu définis le brief, ils font le reste.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/user/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gold px-7 py-4 text-base font-bold text-black shadow-xl shadow-gold/25 transition hover:bg-amber-400"
                >
                  <Sparkles className="h-5 w-5" />
                  Créer mon espace gratuit
                </Link>
                <Link
                  href="/user/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-7 py-4 text-base font-semibold text-white transition hover:border-gold/40 hover:text-gold"
                >
                  J'ai déjà un compte
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <p className="mt-3 text-xs text-zinc-600">Test gratuit — aucun paiement demandé au départ.</p>

              <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-500">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-gold" />Sans carte bancaire</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-gold" />Accès immédiat</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-gold" />Export CSV inclus</span>
              </div>
            </motion.div>

            {/* Hero visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-gold/10 via-transparent to-violet-500/10 blur-xl" />
              <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-panel p-1">
                <div className="rounded-[1.1rem] bg-ink/90 p-6">
                  {/* Header card */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                      <span className="text-sm font-bold">Sourcing en cours...</span>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                      3 / 20 prospects
                    </span>
                  </div>

                  {/* Prospects preview */}
                  <div className="mt-5 space-y-3">
                    {[
                      { name: "AgriTech Dakar SARL", score: 9, sector: "Agro", zone: "Dakar" },
                      { name: "Faso Digital Group", score: 8, sector: "Tech", zone: "Ouagadougou" },
                      { name: "Abidjan Commerce SA", score: 7, sector: "Commerce", zone: "Abidjan" }
                    ].map((p, i) => (
                      <motion.div
                        key={p.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + i * 0.15 }}
                        className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-sm font-black text-gold">
                          {p.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="flex items-center gap-2 text-xs text-zinc-500">
                            <Tag className="h-3 w-3" />{p.sector}
                            <MapPin className="h-3 w-3" />{p.zone}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold ${
                          p.score >= 9 ? "bg-emerald-500/15 text-emerald-300" : p.score >= 7 ? "bg-gold/15 text-gold" : "bg-zinc-500/10 text-zinc-400"
                        }`}>
                          {p.score}/10
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Agents status */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3 text-center">
                      <Radar className="mx-auto h-5 w-5 text-violet-400" />
                      <p className="mt-1 text-xs font-bold text-violet-300">Serper</p>
                      <p className="text-[10px] text-zinc-500">Découverte active</p>
                    </div>
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3 text-center">
                      <Search className="mx-auto h-5 w-5 text-sky-400" />
                      <p className="mt-1 text-xs font-bold text-sky-300">Tavily</p>
                      <p className="text-[10px] text-zinc-500">Qualification en cours</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-ink" />
        </section>

        {/* ── Stats ──────────────────────────────────────────── */}
        <section className="border-y border-white/5 bg-panel/40">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px md:grid-cols-4">
            {[
              { value: 2, suffix: "", label: "Agents IA spécialisés" },
              { value: 100, suffix: "%", label: "Automatisé" },
              { value: 3, suffix: " plans", label: "Adaptés à ta taille" },
              { value: 1, suffix: " clic", label: "Pour exporter en CSV" }
            ].map((s) => (
              <div key={s.label} className="py-8 text-center">
                <p className="text-3xl font-black text-gold md:text-4xl">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-1.5 text-sm text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Marquee ────────────────────────────────────────── */}
        <div className="overflow-hidden border-b border-white/5 bg-ink py-4">
          <div
            className="flex gap-0 whitespace-nowrap"
            style={{
              animation: "marquee 22s linear infinite"
            }}
          >
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="inline-flex items-center gap-3 px-10 text-xs font-bold uppercase tracking-[0.2em] text-zinc-600"
              >
                {item}
                <Sparkles className="h-3 w-3 text-gold/50" />
              </span>
            ))}
          </div>
        </div>

        {/* ── Comment ca marche ──────────────────────────────── */}
        <section id="comment" className="mx-auto max-w-7xl px-5 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Processus</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              De ton brief à tes prospects,{" "}
              <span className="bg-gradient-to-r from-gold to-amber-400 bg-clip-text text-transparent">
                en 3 étapes
              </span>
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Pas de setup complexe. Tu arrives, tu définis ta cible, tes agents travaillent.
            </p>
          </motion.div>

          <div className="relative mt-14">
            <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent md:block" />
            <div className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.13, duration: 0.5 }}
                    className="relative"
                  >
                    <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-amber-500 shadow-lg shadow-gold/30 md:mx-0">
                      <Icon className="h-7 w-7 text-black" />
                    </div>
                    <div className="mt-5 rounded-3xl border border-line bg-panel p-6">
                      <span className="text-xs font-black tracking-widest text-gold">{step.n}</span>
                      <h3 className="mt-2 text-xl font-bold">{step.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">{step.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Les 2 agents ──────────────────────────────────── */}
        <section id="agents" className="relative border-y border-line bg-panel/30 py-24">
          <div className="pointer-events-none absolute -left-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-violet-500/8 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-sky-500/8 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl"
            >
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Les agents</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                Deux moteurs,{" "}
                <span className="bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
                  une mission
                </span>
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Chaque agent est spécialisé. Ensemble ils couvrent toute la chaîne du sourcing — de la
                découverte à la qualification.
              </p>
            </motion.div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {AGENTS.map((agent, i) => {
                const isViolet = agent.color === "violet";
                return (
                  <motion.div
                    key={agent.key}
                    initial={{ opacity: 0, x: i === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className={`relative overflow-hidden rounded-3xl border p-7 ${
                      isViolet
                        ? "border-violet-500/30 bg-violet-500/5"
                        : "border-sky-500/30 bg-sky-500/5"
                    }`}
                  >
                    <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${
                      isViolet ? "bg-violet-500/15" : "bg-sky-500/15"
                    }`} />

                    <div className="relative">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${
                          isViolet ? "border-violet-500/30 bg-violet-500/10" : "border-sky-500/30 bg-sky-500/10"
                        }`}>
                          <Radar className={`h-7 w-7 ${isViolet ? "text-violet-400" : "text-sky-400"}`} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest ${isViolet ? "text-violet-400" : "text-sky-400"}`}>
                            {agent.badge}
                          </p>
                          <h3 className="text-xl font-black">{agent.name}</h3>
                        </div>
                      </div>

                      <p className="mt-5 text-base font-semibold text-zinc-100">{agent.headline}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{agent.description}</p>

                      <ul className="mt-6 space-y-2.5">
                        {agent.features.map((f) => (
                          <li key={f} className="flex items-center gap-3 text-sm">
                            <CheckCircle2 className={`h-4 w-4 shrink-0 ${isViolet ? "text-violet-400" : "text-sky-400"}`} />
                            <span className="text-zinc-300">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Comparaison rapide */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-8 overflow-hidden rounded-3xl border border-line bg-panel"
            >
              <div className="grid divide-x divide-line md:grid-cols-4">
                {[
                  { label: "Vitesse", serper: "Très rapide", tavily: "Modérée" },
                  { label: "Volume", serper: "Très élevé", tavily: "Ciblé" },
                  { label: "Profondeur", serper: "Basique", tavily: "Avancée" },
                  { label: "Idéal pour", serper: "Prospection large", tavily: "Qualification fine" }
                ].map((row) => (
                  <div key={row.label} className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{row.label}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-violet-300">
                      <Radar className="h-3.5 w-3.5" /> {row.serper}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-sky-300">
                      <Search className="h-3.5 w-3.5" /> {row.tavily}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Tarifs ────────────────────────────────────────── */}
        <section id="tarifs" className="mx-auto max-w-7xl px-5 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Tarifs</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Un plan pour{" "}
              <span className="bg-gradient-to-r from-gold to-amber-400 bg-clip-text text-transparent">
                chaque ambition
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              Démarre avec le Starter, évolue quand ton volume augmente. Sans engagement, sans surprise.
            </p>
          </motion.div>

          {loadingPlans ? (
            <div className="mt-14 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            </div>
          ) : plans.length === 0 ? (
            <p className="mt-14 text-center text-zinc-500">Les plans seront disponibles prochainement.</p>
          ) : (
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...plans].sort((a, b) => a.monthlyPrice - b.monthlyPrice).map((plan, i) => {
                const isFree = plan.monthlyPrice === 0;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className={`relative overflow-hidden rounded-3xl border p-7 transition hover:shadow-xl ${
                      isFree
                        ? "border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-panel shadow-lg shadow-emerald-500/10"
                        : plan.isPopular
                          ? "border-gold/40 bg-gradient-to-b from-gold/8 to-panel shadow-lg shadow-gold/10"
                          : "border-line bg-panel hover:border-gold/20"
                    }`}
                  >
                    {isFree && (
                      <>
                        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
                        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-black">
                          <Sparkles className="h-3 w-3" />
                          Gratuit
                        </div>
                      </>
                    )}
                    {!isFree && plan.isPopular && (
                      <>
                        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl" />
                        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-black text-black">
                          <Star className="h-3 w-3" />
                          Populaire
                        </div>
                      </>
                    )}

                    <p className="text-xl font-black">{plan.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{plan.description || " "}</p>
                    {PLAN_TAGLINES[plan.name.toLowerCase()] && (
                      <p className="mt-1.5 text-xs italic text-gold/60">{PLAN_TAGLINES[plan.name.toLowerCase()]}</p>
                    )}

                    <p className={`mt-6 text-4xl font-black ${isFree ? "text-emerald-400" : "text-gold"}`}>
                      {isFree ? "GRATUIT" : formatMoney(plan.monthlyPrice)}
                      {!isFree && <span className="text-base font-normal text-zinc-400"> / mois</span>}
                    </p>

                    <ul className="mt-7 space-y-2.5">
                      <li className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 ${isFree ? "text-emerald-400" : "text-gold"}`} />
                        <span className="text-zinc-200">{plan.maxRunsPerMonth} run{plan.maxRunsPerMonth > 1 ? "s" : ""} par mois</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 ${isFree ? "text-emerald-400" : "text-gold"}`} />
                        <span className="text-zinc-200">{plan.maxProspectsPerRun} prospects max / run</span>
                      </li>
                      {plan.agents.includes("serper") && (
                        <li className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                          <span className="text-zinc-200">Agent Serper inclus</span>
                        </li>
                      )}
                      {plan.agents.includes("tavily") && (
                        <li className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-400" />
                          <span className="text-zinc-200">Agent Tavily inclus</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="text-zinc-200">Export CSV illimité</span>
                      </li>
                      {isFree && (
                        <li className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          <span className="text-zinc-200">Sans carte bancaire</span>
                        </li>
                      )}
                    </ul>

                    <Link
                      href="/user/register"
                      className={`mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-bold transition ${
                        isFree
                          ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 hover:bg-emerald-400"
                          : plan.isPopular
                            ? "bg-gold text-black shadow-lg shadow-gold/25 hover:bg-amber-400"
                            : "border border-line bg-ink text-zinc-100 hover:border-gold/40 hover:text-gold"
                      }`}
                    >
                      {isFree ? "Commencer gratuitement" : `Choisir ${plan.name}`}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Features supplementaires ───────────────────────── */}
        <section className="border-y border-line bg-panel/30 py-20">
          <div className="mx-auto max-w-7xl px-5">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: BarChart3, title: "Dashboard complet", text: "Stats en temps réel, usage du plan, historique de tous tes runs." },
                { icon: TrendingUp, title: "Scoring automatique", text: "Chaque prospect reçoit un score de pertinence de 1 à 10." },
                { icon: Globe2, title: "Multi-zones", text: "Sourcez sur Dakar, Abidjan, Paris ou tout autre marché en même temps." },
                { icon: Users, title: "Export CSV", text: "Un clic pour exporter tous tes prospects en CSV, compatible Excel." }
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-3xl border border-line bg-panel p-6"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 border border-gold/20">
                      <Icon className="h-6 w-6 text-gold" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{f.text}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── CTA finale ─────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-5 py-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-amber-950/60 via-panel to-panel p-10 text-center shadow-2xl shadow-gold/10 md:p-16"
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 right-1/4 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold">
                <Zap className="h-4 w-4" />
                Commence aujourd'hui
              </div>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl xl:text-6xl">
                Tes premiers prospects{" "}
                <br className="hidden md:block" />
                <span className="bg-gradient-to-r from-gold via-amber-400 to-yellow-300 bg-clip-text text-transparent">
                  en moins de 5 minutes
                </span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">
                Crée ton compte, définis ton brief et laisse tes agents travailler. Sans installation, sans technique.
              </p>

              <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/user/register"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gold px-8 py-4 text-base font-black text-black shadow-xl shadow-gold/30 transition hover:bg-amber-400"
                >
                  <Sparkles className="h-5 w-5" />
                  Créer mon compte gratuit
                </Link>
                <Link
                  href="/user/login"
                  className="inline-flex items-center gap-2 rounded-2xl border border-line px-8 py-4 text-base font-semibold text-white transition hover:border-gold/40 hover:text-gold"
                >
                  J'ai déjà un compte
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <p className="mt-5 text-sm text-zinc-500">
                Accès immédiat · Pas de carte bancaire · Support inclus
              </p>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-blue-800/40 bg-blue-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={agencyName} className="h-8 w-auto object-contain" />
            ) : (
              <span className="font-black text-gold">{agencyName}</span>
            )}
          </Link>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="#agents" className="transition hover:text-zinc-200">Les agents</a>
            <a href="#tarifs" className="transition hover:text-zinc-200">Tarifs</a>
            <Link href="/user/login" className="transition hover:text-zinc-200">Connexion</Link>
            <Link href="/" className="transition hover:text-zinc-200">Accueil</Link>
          </div>
          <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} {agencyName}</p>
        </div>
      </footer>

      {/* Animation marquee */}
      <style jsx>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function resolveLogo(value: string): string {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/uploads/")) return `${apiBaseUrl}${value}`;
  return value;
}
