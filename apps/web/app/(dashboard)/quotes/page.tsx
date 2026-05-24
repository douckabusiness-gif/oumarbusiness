"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Loader2, Mail, MessageCircle, SendHorizontal } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ClientRecord = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  status: string;
  source?: string | null;
};

type QuoteRecord = {
  id: string;
  clientId: string;
  serviceType: string;
  brief: string;
  lineItems: Array<{ label?: string; amount?: number }>;
  total: number;
  currency: "XOF" | "EUR" | "USD";
  status: string;
  validUntil: string;
  createdAt: string;
  client: ClientRecord;
};

const emptyForm = {
  clientId: "",
  serviceType: "",
  brief: "",
  total: "",
  currency: "XOF",
  validityDays: "7"
};

export default function QuotesPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [clientsResponse, quotesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/memory/clients`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/quotes`, { cache: "no-store" })
        ]);

        const clientsData = (await clientsResponse.json()) as { clients?: ClientRecord[]; error?: string };
        const quotesData = (await quotesResponse.json()) as { items?: QuoteRecord[]; error?: string };

        if (!clientsResponse.ok) {
          throw new Error(clientsData.error ?? "Chargement CRM impossible.");
        }

        if (!quotesResponse.ok) {
          throw new Error(quotesData.error ?? "Chargement des devis impossible.");
        }

        if (!active) return;
        setClients(Array.isArray(clientsData.clients) ? clientsData.clients : []);
        setQuotes(Array.isArray(quotesData.items) ? quotesData.items : []);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Chargement des devis impossible.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    return {
      total: quotes.length,
      drafts: quotes.filter((quote) => normalizeQuoteStatus(quote.status) === "draft").length,
      sent: quotes.filter((quote) => normalizeQuoteStatus(quote.status) === "sent").length
    };
  }, [quotes]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [clients]);

  async function createQuote() {
    try {
      setSaving(true);
      setError("");
      setFeedback("");

      const response = await fetch(`${apiBaseUrl}/api/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          serviceType: form.serviceType,
          brief: form.brief,
          total: Number(form.total || 0),
          currency: form.currency,
          validityDays: Number(form.validityDays || 7)
        })
      });

      const data = (await response.json()) as { item?: QuoteRecord; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Création du devis impossible.");
      }

      setQuotes((current) => [data.item!, ...current]);
      setForm(emptyForm);
      setFeedback("Devis créé en brouillon.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Création du devis impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote(id: string, channel: "email" | "whatsapp") {
    try {
      setBusyId(id);
      setError("");
      setFeedback("");

      const response = await fetch(`${apiBaseUrl}/api/quotes/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
      });

      const data = (await response.json()) as { item?: QuoteRecord; message?: string; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error ?? "Envoi du devis impossible.");
      }

      setQuotes((current) => current.map((quote) => (quote.id === id ? data.item! : quote)));
      setFeedback(data.message ?? "Devis envoyé.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Envoi du devis impossible.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Vente</p>
        <h1 className="mt-2 text-3xl font-bold">Devis</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Cette page sert à préparer rapidement une proposition commerciale depuis un prospect CRM ou un lead marketplace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Tous les devis" value={String(stats.total)} />
        <StatCard label="Brouillons" value={String(stats.drafts)} />
        <StatCard label="Envoyés" value={String(stats.sent)} />
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {feedback ? <div className="rounded-lg border border-gold/20 bg-gold/10 p-4 text-sm text-gold">{feedback}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-semibold">Créer un devis</h2>
              <p className="mt-1 text-sm text-muted">Version simple : client, service, résumé, prix et validité.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="text-zinc-300">Prospect ou client CRM</span>
              <select
                value={form.clientId}
                onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
                className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none"
              >
                <option value="">Choisir...</option>
                {sortedClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `- ${client.company}` : ""} ({formatClientStatus(client.status)})
                  </option>
                ))}
              </select>
            </label>

            <Field label="Service / application" value={form.serviceType} onChange={(value) => setForm((current) => ({ ...current, serviceType: value }))} />

            <TextAreaField label="Résumé du besoin" value={form.brief} onChange={(value) => setForm((current) => ({ ...current, brief: value }))} />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Montant" value={form.total} onChange={(value) => setForm((current) => ({ ...current, total: value }))} />
              <SelectField
                label="Devise"
                value={form.currency}
                options={["XOF", "EUR", "USD"]}
                onChange={(value) => setForm((current) => ({ ...current, currency: value as "XOF" | "EUR" | "USD" }))}
              />
              <Field
                label="Validité (jours)"
                value={form.validityDays}
                onChange={(value) => setForm((current) => ({ ...current, validityDays: value }))}
              />
            </div>

            <button
              type="button"
              onClick={createQuote}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              Créer le devis
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="font-semibold">Devis récents</h2>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-line bg-ink/50 p-4 text-sm text-muted">
              Aucun devis pour le moment.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {quotes.map((quote) => {
                const busy = busyId === quote.id;
                return (
                  <article key={quote.id} className="rounded-lg border border-line bg-ink p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-zinc-100">{quote.serviceType}</p>
                        <p className="mt-1 text-sm text-muted">
                          {quote.client.name}
                          {quote.client.company ? ` - ${quote.client.company}` : ""}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${statusClass(quote.status)}`}>
                        {formatQuoteStatus(quote.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <InfoCard label="Montant" value={`${quote.total.toLocaleString("fr-FR")} ${quote.currency}`} />
                      <InfoCard label="Validité" value={new Date(quote.validUntil).toLocaleDateString("fr-FR")} />
                      <InfoCard label="Source client" value={quote.client.source || "CRM"} />
                    </div>

                    <div className="mt-4 rounded-md border border-line bg-panel p-3">
                      <p className="text-xs uppercase tracking-wide text-muted">Résumé</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-200">{quote.brief}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={`${apiBaseUrl}/api/quotes/${quote.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100"
                      >
                        <ExternalLink className="h-4 w-4 text-gold" />
                        Ouvrir PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => sendQuote(quote.id, "email")}
                        disabled={busy || !quote.client.email}
                        className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
                      >
                        <Mail className="h-4 w-4" />
                        Envoyer email
                      </button>
                      <button
                        type="button"
                        onClick={() => sendQuote(quote.id, "whatsapp")}
                        disabled={busy || !quote.client.whatsapp}
                        className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-50"
                      >
                        <MessageCircle className="h-4 w-4 text-gold" />
                        Envoyer WhatsApp
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <textarea
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-line bg-ink px-3 py-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function normalizeQuoteStatus(value: string) {
  const normalized = value.toLowerCase().trim();
  if (normalized === "sent") return "sent";
  return "draft";
}

function formatQuoteStatus(value: string) {
  return normalizeQuoteStatus(value) === "sent" ? "Envoyé" : "Brouillon";
}

function statusClass(value: string) {
  return normalizeQuoteStatus(value) === "sent"
    ? "border border-gold/20 bg-gold/10 text-gold"
    : "border border-white/10 bg-white/[0.04] text-zinc-300";
}

function formatClientStatus(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  if (normalized === "devis_envoye") return "devis";
  if (normalized === "qualifie") return "qualifié";
  if (normalized === "client") return "client";
  if (normalized === "negociation") return "négociation";
  return "prospect";
}
