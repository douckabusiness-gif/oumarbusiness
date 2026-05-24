import { Activity, AlertTriangle, Bot, Euro, MessageSquare, Timer } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";

const events = [
  ["Agent autonome", "7 conversations traitees cette nuit", "il y a 8 min"],
  ["Facturation", "Facture OB-2026-001 marquee en attente", "il y a 22 min"],
  ["Projet", "Site vitrine Kora Studio en revision client", "il y a 41 min"],
  ["WhatsApp", "2 demandes de devis classees chaudes", "il y a 1 h"]
];

export function OverviewDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Centre de supervision</p>
        <h1 className="mt-2 text-3xl font-bold">Bonjour Oumar, les agents sont en ligne.</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Messages 24h" value="128" helper="84% auto-resolus" />
        <MetricCard label="Leads actifs" value="37" helper="9 devis a relancer" />
        <MetricCard label="Revenus mois" value="4.8M XOF" helper="+18% vs mois dernier" />
        <MetricCard label="Projets actifs" value="14" helper="2 demandent attention" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold">Activite temps reel</h2>
          </div>
          <div className="mt-5 space-y-3">
            {events.map(([source, text, time]) => (
              <div key={text} className="flex items-center justify-between rounded-md border border-line bg-ink p-4">
                <div>
                  <p className="font-medium">{source}</p>
                  <p className="mt-1 text-sm text-muted">{text}</p>
                </div>
                <span className="text-xs text-zinc-500">{time}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-gold" />
            <h2 className="text-lg font-semibold">Priorites du jour</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {[
              [MessageSquare, "Repondre au prospect VIP Adama S."],
              [Euro, "Valider le paiement Wave de 350 000 XOF"],
              [Timer, "Replanifier le jalon du projet ClinicAI"],
              [Bot, "Revoir le seuil d'escalade de l'agent WhatsApp"]
            ].map(([Icon, label]) => {
              const LucideIcon = Icon as typeof Bot;
              return (
                <div key={String(label)} className="flex items-center gap-3 rounded-md bg-ink p-3 text-sm">
                  <LucideIcon className="h-4 w-4 text-gold" />
                  {label as string}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
