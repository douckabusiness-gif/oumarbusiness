"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BrainCircuit, Clock3, Loader2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ClientMemoryPayload = {
  memory: {
    id: string;
    clientId: string;
    profileSummary?: string | null;
    lastUpdatedAt: string;
    facts: Array<{
      id: string;
      category: string;
      fact: string;
      confidence: number;
      source?: string | null;
      createdAt: string;
    }>;
    preferences: Array<{
      id: string;
      key: string;
      value: string;
      createdAt: string;
    }>;
  };
};

type SessionPayload = {
  session: {
    id: string;
    channel: string;
    externalRef?: string | null;
    title?: string | null;
    language?: string | null;
    lastMessageAt?: string | null;
    summaries: Array<{
      id: string;
      summary: string;
      createdAt: string;
    }>;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      agentType?: string | null;
      createdAt: string;
    }>;
  };
};

type ClientListRecord = {
  id: string;
  name: string;
  company?: string | null;
  memoryProfile?: {
    profileSummary?: string | null;
  } | null;
  conversationSessions: Array<{
    id: string;
    channel: string;
    updatedAt: string;
  }>;
};

export default function ClientMemoryPage() {
  const params = useParams<{ id: string }>();
  const clientId = typeof params?.id === "string" ? params.id : "";
  const [client, setClient] = useState<ClientListRecord | null>(null);
  const [memory, setMemory] = useState<ClientMemoryPayload["memory"] | null>(null);
  const [session, setSession] = useState<SessionPayload["session"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const clientResponse = await fetch(`${apiBaseUrl}/api/memory/clients`, { cache: "no-store" });
        const clientPayload = (await clientResponse.json()) as { clients?: ClientListRecord[]; error?: string };
        if (!clientResponse.ok) {
          throw new Error(clientPayload.error ?? "Chargement client impossible");
        }

        const foundClient = clientPayload.clients?.find((entry) => entry.id === clientId) ?? null;
        if (mounted) setClient(foundClient);

        const memoryResponse = await fetch(`${apiBaseUrl}/api/memory/clients/${clientId}`, { cache: "no-store" });
        const memoryPayload = (await memoryResponse.json()) as ClientMemoryPayload & { error?: string };
        if (!memoryResponse.ok) {
          throw new Error(memoryPayload.error ?? "Chargement memoire impossible");
        }

        if (mounted) {
          setMemory(memoryPayload.memory);
        }

        const latestSessionId = foundClient?.conversationSessions[0]?.id;
        if (latestSessionId) {
          const sessionResponse = await fetch(`${apiBaseUrl}/api/memory/sessions/${latestSessionId}`, { cache: "no-store" });
          const sessionPayload = (await sessionResponse.json()) as SessionPayload & { error?: string };
          if (sessionResponse.ok && mounted) {
            setSession(sessionPayload.session);
          }
        }
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "Chargement memoire impossible");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/crm" className="inline-flex items-center gap-2 text-sm text-gold">
            <ArrowLeft className="h-4 w-4" />
            Retour CRM
          </Link>
          <p className="mt-4 text-sm text-gold">Memoire client</p>
          <h1 className="mt-2 text-3xl font-bold">{client?.name ?? "Client inconnu"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
            Vue de ce que l’agent retient vraiment: resume consolide, faits memorises, preferences et derniere session.
          </p>
        </div>
        <Link
          href="/knowledge"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold text-zinc-200"
        >
          <BrainCircuit className="h-4 w-4 text-gold" />
          Gérer la knowledge base
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      {!memory ? (
        <div className="rounded-lg border border-dashed border-line bg-panel p-5 text-sm text-muted">
          Aucune memoire consolidee pour ce client pour le moment.
        </div>
      ) : (
        <>
          <section className="rounded-lg border border-line bg-panel p-5">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-gold" />
              <div>
                <h2 className="font-semibold">Resume consolidé</h2>
                <p className="mt-1 text-sm text-muted">
                  Derniere mise a jour: {new Date(memory.lastUpdatedAt).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-200">
              {memory.profileSummary ?? "Le systeme n'a pas encore resume ce client."}
            </p>
          </section>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-lg border border-line bg-panel p-5">
              <h2 className="font-semibold">Faits memorises</h2>
              <div className="mt-5 space-y-3">
                {memory.facts.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line bg-ink/50 p-4 text-sm text-muted">
                    Aucun fait extrait pour le moment.
                  </div>
                ) : (
                  memory.facts.map((fact) => (
                    <article key={fact.id} className="rounded-md border border-line bg-ink p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-wide text-gold">{fact.category}</span>
                        <span className="text-xs text-muted">{Math.round(fact.confidence * 100)}%</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-200">{fact.fact}</p>
                      <p className="mt-3 text-xs text-muted">
                        {fact.source ?? "source inconnue"} · {new Date(fact.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-5">
              <h2 className="font-semibold">Preferences et derniere session</h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {memory.preferences.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line bg-ink/50 p-4 text-sm text-muted">
                    Aucune preference enregistree.
                  </div>
                ) : (
                  memory.preferences.map((preference) => (
                    <span
                      key={preference.id}
                      className="rounded-md border border-gold/20 bg-gold/10 px-3 py-2 text-xs text-gold"
                    >
                      {preference.key}: {preference.value}
                    </span>
                  ))
                )}
              </div>

              <div className="mt-6">
                {!session ? (
                  <div className="rounded-md border border-dashed border-line bg-ink/50 p-4 text-sm text-muted">
                    Pas encore de session conversationnelle tracee ici.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border border-line bg-ink p-4">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <Clock3 className="h-3.5 w-3.5" />
                        {session.channel} · {session.language ?? "fr"}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-200">
                        {session.summaries[0]?.summary ?? "Pas encore de resume automatique sur cette session."}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {session.messages.slice(-8).map((message) => (
                        <article key={message.id} className="rounded-md border border-line bg-ink p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs uppercase tracking-wide text-gold">
                              {message.role === "user" ? "Client" : message.agentType ?? "Agent"}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(message.createdAt).toLocaleString("fr-FR")}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-zinc-200">{message.content}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
