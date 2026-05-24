import Link from "next/link";
import { ClientPortalShell } from "@/components/client-portal/ClientPortalShell";

export default function ClientDashboardPage() {
  return (
    <ClientPortalShell title="Vos projets, factures et livrables" subtitle="Acces client securise avec compte et connexion.">
      <section className="rounded-lg border border-line bg-panel p-6">
          <p className="text-sm text-gold">Bienvenue</p>
          <h1 className="mt-2 text-3xl font-bold">Vos projets, factures et livrables.</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {["Projet actif", "Factures", "Messages"].map((label) => (
              <Link
                key={label}
                href={label === "Messages" ? "/client/messages" : "/client/dashboard"}
                className="rounded-lg border border-line bg-ink p-5 transition hover:border-gold/60"
              >
                <h2 className="font-semibold">{label}</h2>
                <p className="mt-3 text-sm text-muted">Acces par magic link et synchronisation dashboard.</p>
              </Link>
            ))}
          </div>
      </section>
    </ClientPortalShell>
  );
}
