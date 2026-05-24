"use client";

import { CreditCard } from "lucide-react";
import { Field, SectionCard, SettingsPageShell } from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";
import { BillingSettings, initialBillingSettings } from "../_shared";

export default function BillingInvoicingSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<BillingSettings>(
    "/api/settings/billing",
    initialBillingSettings
  );

  return (
    <SettingsPageShell
      eyebrow="Facturation"
      title="Regles de facturation"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <SectionCard
        title="Documents commerciaux"
        subtitle="Cette page regle seulement les factures et devis: prefixe, devise, delai, acompte et relances."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field
            label="Prefixe facture"
            value={data.invoicing.invoicePrefix}
            onChange={(value) =>
              setData((current) => ({ ...current, invoicing: { ...current.invoicing, invoicePrefix: value } }))
            }
          />
          <Field
            label="Devise"
            value={data.invoicing.defaultCurrency}
            onChange={(value) =>
              setData((current) => ({ ...current, invoicing: { ...current.invoicing, defaultCurrency: value } }))
            }
          />
          <Field
            label="Delai (jours)"
            type="number"
            value={data.invoicing.defaultDueDays}
            onChange={(value) =>
              setData((current) => ({
                ...current,
                invoicing: { ...current.invoicing, defaultDueDays: Number(value) || 0 }
              }))
            }
          />
          <Field
            label="Acompte (%)"
            type="number"
            value={data.invoicing.depositPercent}
            onChange={(value) =>
              setData((current) => ({
                ...current,
                invoicing: { ...current.invoicing, depositPercent: Number(value) || 0 }
              }))
            }
          />
          <Field
            label="Relances"
            value={data.invoicing.lateReminderDays}
            onChange={(value) =>
              setData((current) => ({ ...current, invoicing: { ...current.invoicing, lateReminderDays: value } }))
            }
          />
        </div>
        <div className="mt-5 rounded-lg border border-line bg-ink p-4 text-sm text-zinc-300">
          <p className="flex items-center gap-2 font-semibold">
            <CreditCard className="h-4 w-4 text-gold" />
            Regles actuelles
          </p>
          <p className="mt-2 text-muted">
            Prefixe {data.invoicing.invoicePrefix}, acompte {data.invoicing.depositPercent}%, echeance a{" "}
            {data.invoicing.defaultDueDays} jours, relances a {data.invoicing.lateReminderDays}.
          </p>
        </div>
      </SectionCard>
    </SettingsPageShell>
  );
}
