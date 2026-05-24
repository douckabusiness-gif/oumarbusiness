"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Globe2,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  Radar,
  Rocket,
  Send,
  Sparkles,
  TrendingUp,
  X,
  Zap
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { LandingAssistantChat } from "./LandingAssistantChat";
import { ParticleField } from "./ParticleField";

const apiBaseUrl = getApiBaseUrl();
const services = [
  {
    title: "Marketing Digital",
    tagline: "Plus de leads, moins d'effort.",
    icon: TrendingUp,
    items: ["Publicites Meta & Google", "SEO & contenu", "Social media", "Campagnes WhatsApp"]
  },
  {
    title: "Creation Web",
    tagline: "Des sites qui convertissent.",
    icon: MonitorSmartphone,
    items: ["WordPress & Next.js", "E-commerce", "Landing pages", "Maintenance continue"]
  },
  {
    title: "Agents IA",
    tagline: "Automatisations et assistance metier.",
    icon: Bot,
    items: ["Assistant client configure", "Automatisation ventes", "Reporting centralise", "Workflows metier"]
  }
];

const steps = [
  { n: "01", title: "Brief", icon: MessageCircle, text: "Vous decrivez votre besoin en quelques minutes, par WhatsApp ou formulaire." },
  { n: "02", title: "Analyse IA", icon: Sparkles, text: "Nos agents analysent, qualifient et construisent la meilleure approche." },
  { n: "03", title: "Livraison", icon: Rocket, text: "Production, validation et mise en ligne avec un suivi 100% transparent." },
  { n: "04", title: "Support", icon: Clock, text: "Suivi continu, rapports automatiques et optimisation permanente." }
];

const marqueeItems = [
  "Marketing Digital",
  "Sites Web",
  "Agents IA",
  "Automatisation",
  "WhatsApp Business",
  "SEO",
  "E-commerce",
  "Reporting"
];

const agentRows = [
  { label: "Agent WhatsApp", value: "Qualification client" },
  { label: "Agent Commercial", value: "Preparation devis" },
  { label: "Agent Facturation", value: "Suivi paiement" }
];

function Counter({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const target = Number.parseInt(value.replace(/\D/g, ""), 10) || 0;
  const suffix = value.replace(/[\d\s]/g, "");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!inView || target === 0) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1500;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [inView, target]);

  return (
    <span ref={ref} className={className}>
      {target === 0 ? value : `${current}${suffix}`}
    </span>
  );
}

export function LandingPage() {
  const [branding, setBranding] = useState<{ agencyName?: string; logoUrl?: string; phone?: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadBranding() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { agencyName?: string; logoUrl?: string; phone?: string };
        if (mounted) {
          setBranding(payload);
        }
      } catch {
        // Keep landing page usable even if branding API is unavailable.
      }
    }

    void loadBranding();

    return () => {
      mounted = false;
    };
  }, []);

  const agencyName = branding?.agencyName || "Oumar Business";
  const logoUrl = resolveBrandingLogoUrl(branding?.logoUrl ?? "");
  const whatsappUrl = buildWhatsAppUrl(branding?.phone ?? "");

  return (
    <div className="bg-ink text-white">
      {/* ---------------- Header ---------------- */}
      <header className="landing-header-3d sticky top-0 z-50 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5">
          <Link href="/" className="group inline-flex items-center gap-3">
            {logoUrl ? (
              <span className="logo-badge flex h-14 items-center justify-center rounded-2xl px-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`Logo ${agencyName}`}
                  className="block max-h-11 w-auto max-w-[12rem] object-contain"
                />
              </span>
            ) : (
              <span className="block h-14 w-[12rem]" aria-hidden="true" />
            )}
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-300 md:flex">
            <a href="#services" className="transition hover:text-white">
              Services
            </a>
            <a href="#process" className="transition hover:text-white">
              Processus
            </a>
            <a href="#zone" className="transition hover:text-white">
              Zones
            </a>
            <Link href="/marketplace" className="transition hover:text-white">
              Marketplace
            </Link>
            <Link
              href="/sourcing"
              className="relative flex items-center gap-1.5 overflow-hidden rounded-full border border-gold/40 bg-gradient-to-r from-amber/10 to-gold/10 px-4 py-1.5 text-xs font-bold text-gold shadow-[0_0_12px_rgba(255,179,0,0.15)] transition hover:border-gold/70 hover:shadow-[0_0_18px_rgba(255,179,0,0.3)] hover:text-amber-300"
            >
              <Sparkles className="h-3 w-3" />
              Trouver des Clients
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-white transition hover:border-gold/60 hover:text-gold"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="hidden rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:border-gold hover:bg-gold/15 sm:inline-flex"
            >
              Inscription
            </Link>

            <a
              href={whatsappUrl || "#"}
              className="btn-gold inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
              target={whatsappUrl ? "_blank" : undefined}
              rel={whatsappUrl ? "noreferrer" : undefined}
              aria-disabled={!whatsappUrl}
              onClick={(event) => {
                if (!whatsappUrl) event.preventDefault();
              }}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Parler sur WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-panel text-white md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div className="border-t border-line/80 bg-ink/95 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4">
              <a href="#services" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Services
              </a>
              <a href="#process" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Processus
              </a>
              <a href="#zone" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Zones
              </a>
              <Link href="/marketplace" className="rounded-xl border border-line bg-panel px-4 py-3 text-sm font-semibold text-white">
                Marketplace
              </Link>
              <Link href="/sourcing" className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold">
                Trouver des Clients
              </Link>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link href="/login" className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-3 text-sm font-semibold text-white">
                  Connexion
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-bold text-black">
                  Inscription
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden grid-bg">
          <ParticleField />
          <div className="glow-blob animate-drift -left-32 -top-24 h-[28rem] w-[28rem] bg-gold/25" />
          <div className="glow-blob animate-floaty right-[-10rem] top-10 h-[26rem] w-[26rem] bg-ember/20" />
          <div className="glow-blob bottom-[-12rem] left-1/3 h-[24rem] w-[24rem] bg-amber/10" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-32">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                Oumar Business
              </div>

              <h1 className="text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
                Votre Systeme Digital avec l'
                <span className="text-gradient">Intelligence Artificielle</span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-300">
                Marketing, sites web, CRM, facturation et agents IA dans un meme environnement de travail.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsappUrl || "#"}
                  className="btn-gold inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-bold"
                  target={whatsappUrl ? "_blank" : undefined}
                  rel={whatsappUrl ? "noreferrer" : undefined}
                  aria-disabled={!whatsappUrl}
                  onClick={(event) => {
                    if (!whatsappUrl) event.preventDefault();
                  }}
                >
                  Demander un devis gratuit
                  <ArrowRight className="h-5 w-5" />
                </a>
                <a
                  href="#services"
                  className="btn-ghost inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-semibold text-white"
                >
                  Decouvrir nos services
                </a>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" />
                  WhatsApp, Email, CRM et facturation dans un meme systeme
                </div>
              </div>
            </motion.div>

            {/* Hero preview card */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="glow-blob inset-6 bg-gold/20" />
              <div className="card animate-floaty p-1.5">
                <div className="rounded-[0.85rem] bg-ink/85 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                      <span className="text-sm font-bold">Console Oumar IA</span>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted">
                      Vue d'ensemble
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    {agentRows.map((row) => (
                      <div key={row.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium">
                            <Bot className="h-4 w-4 text-gold" />
                            {row.label}
                          </span>
                          <span className="text-muted">{row.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-2xl font-black text-gradient">CRM</p>
                      <p className="mt-1 text-xs text-muted">Qualification et suivi centralises</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-2xl font-black text-gradient">IA</p>
                      <p className="mt-1 text-xs text-muted">Reponses, devis et operations assistees</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink" />
        </section>

        {/* ---------------- Marquee ---------------- */}
        <div className="marquee-mask overflow-hidden border-y border-white/5 bg-panel/40 py-5">
          <div className="marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="flex items-center gap-3 px-8 text-sm font-bold uppercase tracking-[0.2em] text-zinc-500"
              >
                {item}
                <Sparkles className="h-3.5 w-3.5 text-gold/70" />
              </span>
            ))}
          </div>
        </div>

        {/* ---------------- Services ---------------- */}
        <section id="services" className="mx-auto max-w-7xl px-5 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl"
          >
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Nos services</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Trois offres, <span className="text-gradient">un systeme complet</span>.
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Chaque service est pilote par des agents IA qui executent, journalisent et optimisent.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="card p-7"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-ember shadow-gold">
                    <Icon className="h-7 w-7 text-black" />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold">{service.title}</h3>
                  <p className="mt-1 text-sm font-medium text-gold">{service.tagline}</p>
                  <ul className="mt-6 space-y-3 text-sm text-zinc-300">
                    {service.items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={whatsappUrl || "#"}
                    className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-gold transition hover:gap-3"
                    target={whatsappUrl ? "_blank" : undefined}
                    rel={whatsappUrl ? "noreferrer" : undefined}
                    aria-disabled={!whatsappUrl}
                    onClick={(event) => {
                      if (!whatsappUrl) event.preventDefault();
                    }}
                  >
                    Voir le detail
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ---------------- Process ---------------- */}
        <section id="process" className="relative border-y border-line bg-panel/50 py-24">
          <div className="mx-auto max-w-7xl px-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-2xl"
            >
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Processus</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                De l'idee a la livraison, <span className="text-gradient">sans friction</span>.
              </h2>
            </motion.div>

            <div className="relative mt-14">
              <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent md:block" />
              <div className="grid gap-6 md:grid-cols-4">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.title}
                      initial={{ opacity: 0, y: 28 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.12, duration: 0.5 }}
                      className="relative"
                    >
                      <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-ember shadow-gold md:mx-0">
                        <Icon className="h-6 w-6 text-black" />
                      </div>
                      <div className="mt-5 rounded-2xl border border-line bg-ink p-6">
                        <span className="text-sm font-black text-gold">{step.n}</span>
                        <h3 className="mt-2 text-xl font-bold">{step.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-muted">{step.text}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Zones ---------------- */}
        <section id="zone" className="border-t border-line bg-panel/50 py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Mode de collaboration</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                Travail a distance <span className="text-gradient">et suivi centralise</span>.
              </h2>
              <p className="mt-5 text-lg leading-7 text-zinc-300">
                Le projet peut etre suivi depuis un seul espace avec WhatsApp, email, CRM, devis, factures et portail client.
              </p>
              <a
                href={whatsappUrl || "#"}
                className="btn-gold mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold"
                target={whatsappUrl ? "_blank" : undefined}
                rel={whatsappUrl ? "noreferrer" : undefined}
                aria-disabled={!whatsappUrl}
                onClick={(event) => {
                  if (!whatsappUrl) event.preventDefault();
                }}
              >
                Demarrer mon projet
                <ArrowRight className="h-5 w-5" />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="card relative min-h-[22rem] overflow-hidden p-7"
            >
              <Globe2 className="absolute -right-6 -top-6 h-44 w-44 text-gold/15" />
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">Organisation</p>
              <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5">
                {["WhatsApp", "Email", "CRM", "Projets", "Devis", "Factures"].map((city) => (
                  <div key={city} className="flex items-center gap-3 text-sm font-medium">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-gold shadow-glow" />
                    </span>
                    {city}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <BarChart3 className="h-9 w-9 text-gold" />
                <p className="text-sm text-zinc-300">
                  <span className="font-bold text-white">Un seul systeme</span> pour suivre messages, projets, devis et factures.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section className="mx-auto max-w-5xl px-5 py-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card relative overflow-hidden p-10 text-center md:p-16"
          >
            <div className="glow-blob -top-20 left-1/2 h-64 w-64 -translate-x-1/2 bg-gold/25" />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold">
                <Rocket className="h-4 w-4" />
                Demarrer simplement
              </div>
              <h2 className="text-4xl font-black tracking-tight md:text-6xl">
                Parlons de <span className="text-gradient">votre besoin</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">
                Decris ton besoin et nous revenons vers toi par email ou WhatsApp.
              </p>
              <form className="mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="Votre email professionnel"
                  className="min-h-14 flex-1 rounded-xl border border-line bg-ink px-5 text-sm outline-none transition focus:border-gold/60"
                />
                <button
                  type="submit"
                  className="btn-gold inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-7 text-base font-bold"
                >
                  <Send className="h-4 w-4" />
                  Envoyer
                </button>
              </form>
              <p className="mt-4 text-xs text-muted">
                Sans engagement.
              </p>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="landing-footer-3d">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <span className="logo-badge flex h-14 items-center justify-center rounded-2xl px-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt={`Logo ${agencyName}`}
                    className="block max-h-11 w-auto max-w-[12rem] object-contain"
                  />
                </span>
              ) : (
                <span className="block h-14 w-[12rem]" aria-hidden="true" />
              )}
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              CRM, WhatsApp, facturation, projets et automatisation dans un meme systeme.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Services</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>Marketing Digital</li>
              <li>Creation Web</li>
              <li>Agents IA</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Navigation</p>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li>
                <a href="#services" className="transition hover:text-gold">
                  Services
                </a>
              </li>
              <li>
                <a href="#process" className="transition hover:text-gold">
                  Processus
                </a>
              </li>
              <li>
                <Link href="/marketplace" className="transition hover:text-gold">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition hover:text-gold">
                  Connexion
                </Link>
              </li>
              <li>
                <Link href="/register" className="transition hover:text-gold">
                  Inscription
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Contact</p>
            <a
              href={whatsappUrl || "#"}
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted transition hover:text-gold"
              target={whatsappUrl ? "_blank" : undefined}
              rel={whatsappUrl ? "noreferrer" : undefined}
              aria-disabled={!whatsappUrl}
              onClick={(event) => {
                if (!whatsappUrl) event.preventDefault();
              }}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Business
            </a>
          </div>
        </div>
        <div className="border-t border-line py-6 text-center text-xs text-muted">
          &copy; {new Date().getFullYear()} {agencyName}. Tous droits reserves.
        </div>
      </footer>
      <LandingAssistantChat />
    </div>
  );
}

function resolveBrandingLogoUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }

  return value;
}

function buildWhatsAppUrl(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
}
