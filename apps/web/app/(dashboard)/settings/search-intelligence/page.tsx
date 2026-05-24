import {
  Bot,
  Brain,
  DatabaseZap,
  Globe2,
  KeyRound,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TestTube2
} from "lucide-react";
import type { ReactNode } from "react";

const providers = [
  {
    name: "Serper",
    key: "SERPER_API_KEY",
    baseUrl: "https://google.serper.dev",
    role: "Decouvrir les opportunites Google",
    status: "A configurer",
    endpoints: ["Search", "Places", "News", "Images", "Videos"],
    bestFor: ["Prospects locaux", "Google Maps", "SEO", "Concurrents"]
  },
  {
    name: "Tavily",
    key: "TAVILY_API_KEY",
    baseUrl: "https://api.tavily.com",
    role: "Comprendre et extraire le web",
    status: "A configurer",
    endpoints: ["Search", "Extract", "Crawl/Map"],
    bestFor: ["Resume web", "Analyse pages", "Veille", "Rapports"]
  }
] as const;

const agentAccess = [
  ["Prospection", "Trouver entreprises, contacts, lieux et signaux d'achat."],
  ["Marketing", "Chercher tendances, mots-cles, angles et concurrents."],
  ["Commercial", "Preparer un pitch contextualise avant devis."],
  ["Createur web", "Analyser sites clients et concurrents."],
  ["Builder agents IA", "Lire docs et pages techniques des clients."],
  ["Rapport de nuit", "Faire la veille et remonter les alertes a Oumar."]
] as const;

const objectiveFlow = [
  "Objectif donne a l'agent",
  "Serper decouvre les resultats Google",
  "Tavily extrait et comprend les pages",
  "L'agent score et cree les actions",
  "Validation humaine avant contact"
] as const;

export default function SearchIntelligenceSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Search Intelligence</p>
          <h1 className="mt-2 text-3xl font-bold">Tavily + Serper pour agents autonomes</h1>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line px-5 text-sm font-semibold">
            <TestTube2 className="h-4 w-4" />
            Tester objectif
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black">
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-start gap-3">
          <DatabaseZap className="mt-1 h-6 w-6 text-gold" />
          <div>
            <h2 className="text-lg font-semibold">Principe</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
              Serper sert a decouvrir les opportunites depuis Google. Tavily sert a lire, extraire et comprendre
              les pages. Ensemble, ils permettent a un agent de partir d'un objectif et de rassembler automatiquement
              les donnees utiles avant d'agir.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {providers.map((provider) => (
          <section key={provider.name} className="rounded-lg border border-line bg-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {provider.name === "Serper" ? (
                  <Search className="h-7 w-7 text-emerald-300" />
                ) : (
                  <Brain className="h-7 w-7 text-blue-300" />
                )}
                <div>
                  <h2 className="font-semibold">{provider.name}</h2>
                  <p className="text-sm text-muted">{provider.role}</p>
                </div>
              </div>
              <Status label={provider.status} />
            </div>

            <div className="mt-6 grid gap-4">
              <Field label="API key" placeholder={provider.key} type="password" />
              <Field label="Base URL" defaultValue={provider.baseUrl} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoList title="Endpoints" items={provider.endpoints} icon={<Globe2 className="h-4 w-4" />} />
              <InfoList title="Meilleur pour" items={provider.bestFor} icon={<Target className="h-4 w-4" />} />
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Workflow par objectif</h2>
          </div>

          <div className="mt-5 grid gap-3">
            {objectiveFlow.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-md border border-line bg-ink p-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold font-bold text-black">
                  {index + 1}
                </span>
                {step}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-gold/30 bg-gold/10 p-4">
            <p className="text-sm font-semibold text-gold">Exemple d'objectif</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Trouve 20 restaurants a Abidjan qui pourraient avoir besoin d'un agent WhatsApp IA, analyse leur presence web,
              score les meilleurs prospects, puis prepare un message de vente a valider.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Agents autorises</h2>
          </div>

          <div className="mt-5 space-y-3">
            {agentAccess.map(([agent, description]) => (
              <div key={agent} className="rounded-md border border-line bg-ink p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{agent}</span>
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 text-gold" />
          <div>
            <h2 className="text-lg font-semibold">Regle de securite</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              La recherche peut etre automatique, mais tout contact prospect, email, WhatsApp broadcast ou campagne payante
              doit rester sous validation humaine HITL.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  placeholder,
  defaultValue,
  type = "text"
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function InfoList({ title, items, icon }: { title: string; items: readonly string[]; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-ink p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <span className="text-gold">{icon}</span>
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Status({ label }: { label: string }) {
  return <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300">{label}</span>;
}
