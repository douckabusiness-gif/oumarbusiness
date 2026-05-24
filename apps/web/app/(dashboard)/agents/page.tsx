import Link from "next/link";
import { ArrowRightLeft, Bot, BriefcaseBusiness, MessageSquareText, Rocket, Search } from "lucide-react";

const root = {
  name: "Root Orchestrator",
  mission: "Repartit chaque demande entre les deux groupes avant de laisser l'orchestrateur specialise choisir l'agent le plus adapte."
};

const groups = [
  {
    id: "growth",
    name: "Croissance & Front Office",
    orchestrator: "Growth Orchestrator",
    icon: Rocket,
    accent: "text-emerald-300",
    border: "border-emerald-500/25",
    badge: "Acquisition",
    mission: "WhatsApp, Email, prospection, conversion et campagnes.",
    agents: [
      "Autonome 24/7",
      "Prospection",
      "Commercial",
      "WhatsApp",
      "Email",
      "Marketing"
    ]
  },
  {
    id: "operations",
    name: "Delivery & Operations",
    orchestrator: "Operations Orchestrator",
    icon: BriefcaseBusiness,
    accent: "text-sky-300",
    border: "border-sky-500/25",
    badge: "Execution",
    mission: "Projet, web, builder IA, facturation, freelances et reporting.",
    agents: [
      "Chef de projet",
      "Createur web",
      "Builder agents IA",
      "Facturation",
      "Freelances",
      "Rapport de nuit"
    ]
  }
] as const;

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Orchestration IA</p>
          <h1 className="mt-2 text-3xl font-bold">12 agents, 2 groupes, 3 niveaux de pilotage</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Le routeur racine trie les demandes, puis chaque orchestrateur de domaine pilote 6 agents avec un scope clair.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sourcing-agents"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gold/60 bg-gold/10 px-5 text-sm font-semibold text-gold hover:bg-gold/15"
          >
            <Search className="h-4 w-4" />
            Agent sourcing
          </Link>
          <Link
            href="/agents/chat"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black"
          >
            <MessageSquareText className="h-4 w-4" />
            Chat autonome
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-panel p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-md border border-gold/25 bg-gold/10 p-3">
            <Bot className="h-6 w-6 text-gold" />
          </div>
          <div>
            <p className="text-sm text-gold">Niveau 1</p>
            <h2 className="mt-1 text-xl font-semibold">{root.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{root.mission}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.id} className={`rounded-lg border bg-panel p-6 ${group.border}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-md border border-line bg-ink p-3">
                    <Icon className={`h-6 w-6 ${group.accent}`} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gold">Niveau 2</p>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-zinc-300">
                        {group.badge}
                      </span>
                    </div>
                    <h2 className="mt-1 text-xl font-semibold">{group.name}</h2>
                    <p className="mt-1 text-sm text-zinc-300">{group.orchestrator}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">6 agents</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted">{group.mission}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {group.agents.map((agent, index) => (
                  <article key={agent} className="rounded-md border border-line bg-ink px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-gold/80">Agent {index + 1}</p>
                    <h3 className="mt-1 font-medium">{agent}</h3>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded-lg border border-line bg-panel p-6">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-5 w-5 text-gold" />
          <div>
            <p className="text-sm text-gold">Handoff formel</p>
            <h2 className="text-lg font-semibold">Les passages entre groupes restent controles</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-line bg-ink p-4 text-sm text-muted">
            Un lead chaud passe du groupe Croissance vers Operations quand le devis devient projet.
          </div>
          <div className="rounded-md border border-line bg-ink p-4 text-sm text-muted">
            Un retard projet ou une facture contestee reste traite dans le groupe Operations.
          </div>
          <div className="rounded-md border border-line bg-ink p-4 text-sm text-muted">
            Le routeur racine garde la vue globale et evite qu'un agent sorte de son domaine.
          </div>
        </div>
      </section>
    </div>
  );
}
