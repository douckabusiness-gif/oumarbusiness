"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Loader2, MessageSquareQuote } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ClientMemoryRecord = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  status: string;
  language: string;
  country?: string | null;
  memoryProfile?: {
    profileSummary?: string | null;
    facts: Array<{ id: string; fact: string }>;
    preferences: Array<{ id: string; key: string; value: string }>;
  } | null;
  conversationSessions: Array<{
    id: string;
    channel: string;
    updatedAt: string;
  }>;
};

const pipelineTitles = ["prospect", "qualifie", "devis_envoye", "negociation", "client", "inactif"] as const;

export default function CrmPage() {
  const [clients, setClients] = useState<ClientMemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/memory/clients`, { cache: "no-store" });
        const payload = (await response.json()) as { clients?: ClientMemoryRecord[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Chargement CRM impossible");
        }
        if (mounted) {
          setClients(payload.clients ?? []);
        }
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "Chargement CRM impossible");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const columns = useMemo(() => {
    return pipelineTitles.map((status) => ({
      status,
      items: clients.filter((client) => normalizeStatus(client.status) === status)
    }));
  }, [clients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">CRM</p>
          <h1 className="mt-2 text-3xl font-bold">Pipeline commercial + memoire client</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Cette vue montre maintenant ce que les agents connaissent deja du client: resume, faits memorises et
            preferencces utiles.
          </p>
        </div>
        <Link
          href="/knowledge"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold text-zinc-200"
        >
          <BrainCircuit className="h-4 w-4 text-gold" />
          Ouvrir la knowledge base
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      ) : (
        <div className="grid gap-4 overflow-x-auto xl:grid-cols-6">
          {columns.map((column) => (
            <section key={column.status} className="min-h-96 rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold capitalize">{formatStatus(column.status)}</h2>
                <span className="text-xs text-muted">{column.items.length}</span>
              </div>
              <div className="mt-4 space-y-3">
                {column.items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line bg-ink/50 p-3 text-xs text-muted">
                    Aucun client ici
                  </div>
                ) : (
                  column.items.map((client) => (
                    <article key={client.id} className="rounded-md border border-line bg-ink p-4">
                      <p className="font-medium">{client.name}</p>
                      <p className="mt-1 text-xs text-muted">{client.company ?? client.country ?? "Sans societe"}</p>
                      <p className="mt-3 text-xs leading-5 text-zinc-300">
                        {client.memoryProfile?.profileSummary ?? "Aucune memoire consolidee pour ce client."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {client.memoryProfile?.facts.slice(0, 2).map((fact) => (
                          <span
                            key={fact.id}
                            className="rounded-md border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] text-gold"
                          >
                            {fact.fact}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-xs text-muted">
                          <MessageSquareQuote className="h-3.5 w-3.5" />
                          {client.conversationSessions[0]?.channel ?? "sans session"}
                        </span>
                        <Link
                          href={`/crm/${client.id}/memory`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gold"
                        >
                          Voir memoire
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeStatus(status: string) {
  const value = status.toLowerCase().replace(/\s+/g, "_");
  if (value === "prospect") return "prospect";
  if (value === "qualifie" || value === "qualified") return "qualifie";
  if (value === "devis_envoye" || value === "quote_sent") return "devis_envoye";
  if (value === "negociation" || value === "negotiation") return "negociation";
  if (value === "client" || value === "active_client") return "client";
  return "inactif";
}

function formatStatus(status: (typeof pipelineTitles)[number]) {
  return status.replace("_", " ");
}
