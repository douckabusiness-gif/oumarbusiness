"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Smartphone, Wallet } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { MetricCard } from "@/components/ui/MetricCard";

const apiBaseUrl = getApiBaseUrl();

type BillingSettings = {
  methods: {
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    waveEnabled: boolean;
    orangeMoneyEnabled: boolean;
    bankTransferEnabled: boolean;
  };
  accounts: {
    stripePublicLabel: string;
    paypalHandle: string;
    waveNumber: string;
    orangeMoneyNumber: string;
    bankName: string;
    iban: string;
    swift: string;
  };
  invoicing: {
    invoicePrefix: string;
    defaultCurrency: string;
    defaultDueDays: number;
    depositPercent: number;
    lateReminderDays: string;
  };
};

type ManualInvoice = {
  id: string;
  number: string;
  clientName: string;
  clientEmail?: string;
  clientWhatsapp?: string;
  projectName: string;
  amount: number;
  currency: "XOF" | "EUR" | "USD";
  dueDate: string;
  createdAt: string;
  sentAt: string;
  paidAt?: string;
  status: "draft" | "sent" | "paid" | "overdue";
  paymentMethods: Array<"wave" | "orange_money">;
  paymentReference?: string;
  paymentMethodUsed?: "wave" | "orange_money";
  notes?: string;
};

type BillingPayload = {
  settings: BillingSettings;
  summary: {
    paidXof: number;
    pendingXof: number;
    overdueXof: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
  };
  invoices: ManualInvoice[];
};

const initialSettings: BillingSettings = {
  methods: {
    stripeEnabled: false,
    paypalEnabled: false,
    waveEnabled: false,
    orangeMoneyEnabled: false,
    bankTransferEnabled: true
  },
  accounts: {
    stripePublicLabel: "",
    paypalHandle: "",
    waveNumber: "",
    orangeMoneyNumber: "",
    bankName: "",
    iban: "",
    swift: ""
  },
  invoicing: {
    invoicePrefix: "OB",
    defaultCurrency: "XOF",
    defaultDueDays: 7,
    depositPercent: 60,
    lateReminderDays: "7,14,30"
  }
};

export default function BillingPage() {
  const [settings, setSettings] = useState<BillingSettings>(initialSettings);
  const [summary, setSummary] = useState<BillingPayload["summary"]>({
    paidXof: 0,
    pendingXof: 0,
    overdueXof: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0
  });
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [projectName, setProjectName] = useState("");
  const [amount, setAmount] = useState("150000");
  const [currency, setCurrency] = useState<"XOF" | "EUR" | "USD">("XOF");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [useWave, setUseWave] = useState(true);
  const [useOrange, setUseOrange] = useState(true);

  useEffect(() => {
    void loadBilling();
  }, []);

  useEffect(() => {
    if (!dueDate) {
      const date = new Date();
      date.setDate(date.getDate() + settings.invoicing.defaultDueDays);
      setDueDate(date.toISOString().slice(0, 10));
    }
  }, [dueDate, settings.invoicing.defaultDueDays]);

  async function loadBilling() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/billing/invoices`, { cache: "no-store" });
      const data = (await response.json()) as BillingPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Chargement facturation impossible.");
      }
      setSettings(data.settings);
      setSummary(data.summary);
      setInvoices(data.invoices);
      setUseWave(data.settings.methods.waveEnabled);
      setUseOrange(data.settings.methods.orangeMoneyEnabled);
      setCurrency(data.settings.invoicing.defaultCurrency as "XOF" | "EUR" | "USD");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement facturation impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function createInvoice() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const paymentMethods = [
        ...(useWave ? ["wave"] : []),
        ...(useOrange ? ["orange_money"] : [])
      ];

      const response = await fetch(`${apiBaseUrl}/api/billing/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientWhatsapp,
          projectName,
          amount: Number(amount),
          currency,
          dueDate,
          notes,
          paymentMethods
        })
      });

      const data = (await response.json()) as { invoice?: ManualInvoice; summary?: BillingPayload["summary"]; error?: string };
      if (!response.ok || !data.invoice || !data.summary) {
        throw new Error(data.error ?? "Creation facture impossible.");
      }

      setInvoices((current) => [data.invoice!, ...current]);
      setSummary(data.summary);
      setSuccess("Facture creee avec instructions manuelles Wave / Orange Money.");
      setClientName("");
      setClientEmail("");
      setClientWhatsapp("");
      setProjectName("");
      setAmount("150000");
      setNotes("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Creation facture impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmManualPayment(invoiceId: string, paymentMethod: "wave" | "orange_money") {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetch(`${apiBaseUrl}/api/billing/invoices/${invoiceId}/confirm-manual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          paymentReference: paymentRefs[invoiceId] ?? ""
        })
      });
      const data = (await response.json()) as { invoice?: ManualInvoice; summary?: BillingPayload["summary"]; error?: string };
      if (!response.ok || !data.invoice || !data.summary) {
        throw new Error(data.error ?? "Confirmation paiement impossible.");
      }

      setInvoices((current) => current.map((item) => (item.id === data.invoice!.id ? data.invoice! : item)));
      setSummary(data.summary);
      setSuccess(`Paiement ${paymentMethod === "wave" ? "Wave" : "Orange Money"} confirme.`);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Confirmation paiement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateInvoiceStatus(invoiceId: string, status: "draft" | "sent" | "overdue") {
    try {
      setSaving(true);
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/billing/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = (await response.json()) as { invoice?: ManualInvoice; summary?: BillingPayload["summary"]; error?: string };
      if (!response.ok || !data.invoice || !data.summary) {
        throw new Error(data.error ?? "Mise a jour statut impossible.");
      }
      setInvoices((current) => current.map((item) => (item.id === data.invoice!.id ? data.invoice! : item)));
      setSummary(data.summary);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Mise a jour statut impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function sendInvoice(invoiceId: string, channel: "email" | "whatsapp") {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await fetch(`${apiBaseUrl}/api/billing/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Envoi de la facture impossible.");
      }
      setSuccess(data.message ?? `Facture envoyee par ${channel === "email" ? "email" : "WhatsApp"}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Envoi de la facture impossible.");
    } finally {
      setSaving(false);
    }
  }

  const enabledManualMethods = useMemo(() => {
    return {
      wave: settings.methods.waveEnabled,
      orange: settings.methods.orangeMoneyEnabled
    };
  }, [settings.methods.orangeMoneyEnabled, settings.methods.waveEnabled]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Finances</p>
        <h1 className="mt-2 text-3xl font-bold">Facturation manuelle Wave + Orange Money</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Ici tu crees une facture, tu donnes les instructions de paiement manuelles au client, puis tu confirmes toi-meme la reception de l&apos;argent.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Factures payees" value={`${summary.paidXof.toLocaleString("fr-FR")} XOF`} helper={`${summary.paidCount} payees`} />
        <MetricCard label="En attente" value={`${summary.pendingXof.toLocaleString("fr-FR")} XOF`} helper={`${summary.pendingCount} factures ouvertes`} />
        <MetricCard label="Retards" value={`${summary.overdueXof.toLocaleString("fr-FR")} XOF`} helper={`${summary.overdueCount} a relancer`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">Nouvelle facture manuelle</h2>
          <div className="mt-4 grid gap-4">
            <Field label="Client" value={clientName} onChange={setClientName} />
            <Field label="Email client" value={clientEmail} type="email" onChange={setClientEmail} />
            <Field label="WhatsApp client" value={clientWhatsapp} onChange={setClientWhatsapp} />
            <Field label="Projet / service" value={projectName} onChange={setProjectName} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Montant" value={amount} type="number" onChange={setAmount} />
              <SelectField
                label="Devise"
                value={currency}
                onChange={(value) => setCurrency(value as "XOF" | "EUR" | "USD")}
                options={["XOF", "EUR", "USD"]}
              />
            </div>
            <Field label="Echeance" value={dueDate} type="date" onChange={setDueDate} />
            <TextAreaField label="Note interne / rappel" value={notes} onChange={setNotes} />

            <div className="rounded-lg border border-line bg-ink p-4">
              <p className="text-sm font-semibold text-zinc-100">Moyens de paiement manuels</p>
              <div className="mt-3 space-y-3 text-sm">
                <Toggle
                  label={`Wave CI ${enabledManualMethods.wave ? `(${settings.accounts.waveNumber})` : "(desactive dans Parametres)"}`}
                  checked={useWave && enabledManualMethods.wave}
                  disabled={!enabledManualMethods.wave}
                  onChange={setUseWave}
                />
                <Toggle
                  label={`Orange Money ${enabledManualMethods.orange ? `(${settings.accounts.orangeMoneyNumber})` : "(desactive dans Parametres)"}`}
                  checked={useOrange && enabledManualMethods.orange}
                  disabled={!enabledManualMethods.orange}
                  onChange={setUseOrange}
                />
              </div>
            </div>

            <button
              onClick={() => void createInvoice()}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-md bg-gold px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Creer la facture"}
            </button>
          </div>
        </section>

        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <InstructionCard
              icon={Wallet}
              title="Wave CI"
              enabled={settings.methods.waveEnabled}
              number={settings.accounts.waveNumber}
              steps={[
                "Le client envoie le montant exact au numero Wave affiche.",
                "Il t'envoie la reference ou capture du paiement.",
                "Tu confirmes manuellement la facture dans l'admin."
              ]}
            />
            <InstructionCard
              icon={Smartphone}
              title="Orange Money"
              enabled={settings.methods.orangeMoneyEnabled}
              number={settings.accounts.orangeMoneyNumber}
              steps={[
                "Le client paie sur le numero Orange Money affiche.",
                "Il t'envoie la reference ou capture du paiement.",
                "Tu confirmes manuellement la reception."
              ]}
            />
          </div>

          <section className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-semibold">Factures manuelles</h2>
            {loading ? (
              <div className="mt-6 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-line bg-ink p-4 text-sm text-muted">
                Aucune facture manuelle pour le moment.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {invoices.map((invoice) => (
                  <article key={invoice.id} className="rounded-lg border border-line bg-ink p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-semibold text-zinc-100">{invoice.number}</p>
                        <p className="mt-1 text-sm text-zinc-300">{invoice.clientName} · {invoice.projectName}</p>
                        <p className="mt-1 text-sm text-muted">
                          {invoice.amount.toLocaleString("fr-FR")} {invoice.currency} · echeance {invoice.dueDate}
                        </p>
                      </div>
                      <span className="rounded-full border border-line px-3 py-1 text-xs text-zinc-200">{formatStatus(invoice.status)}</span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <LeadInfo label="Methodes" value={invoice.paymentMethods.map(formatMethod).join(", ")} />
                      <LeadInfo label="Reference" value={invoice.paymentReference || "En attente"} />
                      <LeadInfo label="Paye par" value={invoice.paymentMethodUsed ? formatMethod(invoice.paymentMethodUsed) : "Non confirme"} />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <LeadInfo label="Email client" value={invoice.clientEmail || "Non renseigne"} />
                      <LeadInfo label="WhatsApp client" value={invoice.clientWhatsapp || "Non renseigne"} />
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto]">
                      <input
                        value={paymentRefs[invoice.id] ?? ""}
                        onChange={(event) => setPaymentRefs((current) => ({ ...current, [invoice.id]: event.target.value }))}
                        placeholder="Reference paiement / capture / code transaction"
                        className="h-11 rounded-md border border-line bg-panel px-3 text-sm text-zinc-100 outline-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`${apiBaseUrl}/api/billing/invoices/${invoice.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100"
                        >
                          Ouvrir PDF
                        </a>
                        {invoice.clientEmail ? (
                          <button
                            onClick={() => void sendInvoice(invoice.id, "email")}
                            disabled={saving}
                            className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-60"
                          >
                            Envoyer email
                          </button>
                        ) : null}
                        {invoice.clientWhatsapp ? (
                          <button
                            onClick={() => void sendInvoice(invoice.id, "whatsapp")}
                            disabled={saving}
                            className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-60"
                          >
                            Envoyer WhatsApp
                          </button>
                        ) : null}
                        {invoice.status !== "paid" && invoice.paymentMethods.includes("wave") ? (
                          <button
                            onClick={() => void confirmManualPayment(invoice.id, "wave")}
                            disabled={saving}
                            className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
                          >
                            Confirmer Wave
                          </button>
                        ) : null}
                        {invoice.status !== "paid" && invoice.paymentMethods.includes("orange_money") ? (
                          <button
                            onClick={() => void confirmManualPayment(invoice.id, "orange_money")}
                            disabled={saving}
                            className="rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-60"
                          >
                            Confirmer Orange
                          </button>
                        ) : null}
                        {invoice.status !== "overdue" && invoice.status !== "paid" ? (
                          <button
                            onClick={() => void updateInvoiceStatus(invoice.id, "overdue")}
                            disabled={saving}
                            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
                          >
                            Marquer retard
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-md border border-line bg-ink p-3 text-zinc-100 outline-none"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? "opacity-50" : ""}`}>
      <span className="text-zinc-300">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function InstructionCard({
  icon: Icon,
  title,
  enabled,
  number,
  steps
}: {
  icon: typeof CreditCard;
  title: string;
  enabled: boolean;
  number: string;
  steps: string[];
}) {
  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-gold" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-zinc-300">
        {enabled ? `Numero de paiement: ${number}` : "Methode non active dans Parametres > Billing."}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        {steps.map((step) => (
          <li key={step} className="rounded-md border border-line bg-ink px-3 py-2">{step}</li>
        ))}
      </ul>
    </section>
  );
}

function LeadInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function formatMethod(value: "wave" | "orange_money") {
  return value === "wave" ? "Wave" : "Orange Money";
}

function formatStatus(value: ManualInvoice["status"]) {
  if (value === "paid") return "Payee";
  if (value === "sent") return "Envoyee";
  if (value === "overdue") return "En retard";
  return "Brouillon";
}
