"use client";

import Link from "next/link";
import { ArrowRight, Mail, MessageCircle, MessageSquare, Settings, Sparkles } from "lucide-react";

const channels = [
  {
    title: "WhatsApp",
    description: "Conversations clients, pieces jointes, vocal et suivi en temps reel.",
    href: "/whatsapp",
    icon: MessageCircle,
    accent: "from-[#1f6f4a] to-[#0e3e2a]"
  },
  {
    title: "Email",
    description: "Inbox, reponse, nouveau message et suivi des echanges professionnels.",
    href: "/email",
    icon: Mail,
    accent: "from-[#3b2b10] to-[#1b1408]"
  }
];

export default function MessagingPage() {
  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[28px] border border-white/8 bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/20 bg-[#f5a623]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#f5a623]">
                <MessageSquare className="h-4 w-4" />
                Centre de messagerie
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Tous tes canaux au meme endroit</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Cette page sert d'entree simple pour retrouver tes echanges clients. Choisis le canal que tu veux ouvrir.
              </p>
            </div>

            <Link
              href="/settings/assistant"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[#f5a623]/40 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Reglages assistant
            </Link>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {channels.map((channel) => {
            const Icon = channel.icon;

            return (
              <Link
                key={channel.title}
                href={channel.href}
                className="group rounded-[24px] border border-white/8 bg-[#111111] p-6 transition hover:-translate-y-1 hover:border-[#f5a623]/35 hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${channel.accent}`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>

                <h2 className="mt-5 text-2xl font-black tracking-tight">{channel.title}</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">{channel.description}</p>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#f5a623]">
                  Ouvrir {channel.title}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </section>

        <section className="rounded-[24px] border border-white/8 bg-[#111111] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-[#f5a623]" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[#f5a623]">Usage simple</h3>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                WhatsApp sert pour les conversations rapides et les pieces jointes. Email sert pour les messages plus formels,
                les suivis et les reponses professionnelles.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
