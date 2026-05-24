import { Paperclip, Send } from "lucide-react";
import { ClientPortalShell } from "@/components/client-portal/ClientPortalShell";

export default function ClientMessagesPage() {
  return (
    <ClientPortalShell title="Messages" subtitle="Support, livrables et validations projet.">
      <div className="flex min-h-[calc(100vh-12rem)] flex-col rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line p-5">
          <div>
            <h1 className="font-semibold">Messages avec Oumar Business</h1>
            <p className="text-sm text-muted">Support, livrables et validations projet</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">En ligne</span>
        </div>

        <section className="flex flex-1 items-center justify-center overflow-y-auto bg-ink p-5">
          <div className="max-w-md rounded-2xl border border-line bg-panel px-5 py-6 text-center">
            <h2 className="text-base font-semibold">Aucun message pour le moment</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Les echanges avec l'equipe apparaitront ici quand une conversation reelle aura commence.
            </p>
          </div>
        </section>

        <footer className="flex items-center gap-2 border-t border-line p-3">
          <button className="flex h-11 w-11 items-center justify-center rounded-md border border-line" aria-label="Piece jointe">
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            className="h-11 flex-1 rounded-md border border-line bg-ink px-4 outline-none focus:border-gold/70"
            placeholder="Ecrire un message a l'equipe..."
          />
          <button className="flex h-11 w-11 items-center justify-center rounded-md bg-gold text-black" aria-label="Envoyer">
            <Send className="h-5 w-5" />
          </button>
        </footer>
      </div>
    </ClientPortalShell>
  );
}
