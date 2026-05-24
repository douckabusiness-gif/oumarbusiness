"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Search, ShieldCheck } from "lucide-react";

type PublicPortalEntryProps = {
  mode: "login" | "register";
};

export function PublicPortalEntry({ mode }: PublicPortalEntryProps) {
  const isLogin = mode === "login";

  return (
    <main className="min-h-screen bg-ink px-5 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-lg font-black tracking-tight text-gold">
            Oumar Business
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <Link href="/" className="transition hover:text-white">
              Accueil
            </Link>
            <Link href="/sourcing" className="transition hover:text-white">
              Sourcing
            </Link>
          </div>
        </div>

        <section className="rounded-[2rem] border border-line bg-panel/60 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)] md:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-gold">Acces application</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
              {isLogin ? "Choisis ton espace de connexion" : "Choisis ton espace d'inscription"}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Oumar Business dispose de deux parcours differents. Le portail client sert au suivi de projet.
              L'espace utilisateur sert au sourcing commercial avec les agents Serper et Tavily.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-[1.5rem] border border-line bg-ink/80 p-7">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/12 text-gold">
                <BriefcaseBusiness className="h-7 w-7" />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gold">Portail client</p>
              <h2 className="mt-3 text-2xl font-black">Projet, messages et factures</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Pour les clients qui suivent leur projet, consultent leurs messages, devis et factures.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-300">
                <li>Messages avec l'equipe</li>
                <li>Suivi de projet</li>
                <li>Devis et factures</li>
              </ul>
              <Link
                href={isLogin ? "/client/login" : "/client/register"}
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-panel text-sm font-bold text-white transition hover:border-gold/40 hover:text-gold"
              >
                {isLogin ? "Connexion client" : "Inscription client"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>

            <article className="rounded-[1.5rem] border border-gold/25 bg-gradient-to-br from-gold/10 via-panel to-panel p-7 shadow-[0_18px_60px_rgba(212,160,32,0.12)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-black">
                <Search className="h-7 w-7" />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-gold">Utilisateur sourcing</p>
              <h2 className="mt-3 text-2xl font-black">Prospects, agents et historique</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Pour lancer des runs de sourcing, piloter tes agents et recuperer des prospects qualifies.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-200">
                <li>Agent Serper</li>
                <li>Agent Tavily</li>
                <li>Export prospects et historique</li>
              </ul>
              <Link
                href={isLogin ? "/user/login" : "/user/register"}
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-sm font-black text-black transition hover:bg-amber-400"
              >
                {isLogin ? "Connexion sourcing" : "Inscription sourcing"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 text-sm text-zinc-300">
            <ShieldCheck className="h-4 w-4 text-gold" />
            Confirmation email requise avant le premier acces.
          </div>
        </section>
      </div>
    </main>
  );
}
