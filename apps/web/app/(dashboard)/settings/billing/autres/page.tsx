"use client";

import { Field, SectionCard, SettingsPageShell, ToggleField } from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";
import { BillingSettings, initialBillingSettings } from "../_shared";

export default function BillingOtherMethodsSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<BillingSettings>(
    "/api/settings/billing",
    initialBillingSettings
  );

  return (
    <SettingsPageShell
      eyebrow="Autres paiements"
      title="Stripe et virement bancaire"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <SectionCard
        title="Stripe"
        subtitle="Bloc separe pour Stripe seulement."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleField
            label="Activer Stripe Checkout"
            checked={data.methods.stripeEnabled}
            onChange={(checked) =>
              setData((current) => ({ ...current, methods: { ...current.methods, stripeEnabled: checked } }))
            }
          />
          <Field
            label="Libelle Stripe"
            value={data.accounts.stripePublicLabel}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, stripePublicLabel: value } }))
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Virement bancaire"
        subtitle="Bloc separe pour les informations bancaires."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleField
            label="Activer virement bancaire"
            checked={data.methods.bankTransferEnabled}
            onChange={(checked) =>
              setData((current) => ({ ...current, methods: { ...current.methods, bankTransferEnabled: checked } }))
            }
          />
          <Field
            label="Banque"
            value={data.accounts.bankName}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, bankName: value } }))
            }
          />
          <Field
            label="SWIFT"
            value={data.accounts.swift}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, swift: value } }))
            }
          />
          <Field
            label="IBAN"
            value={data.accounts.iban}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, iban: value } }))
            }
          />
        </div>
      </SectionCard>
    </SettingsPageShell>
  );
}
