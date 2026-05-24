"use client";

import { Field, SectionCard, SettingsPageShell, ToggleField } from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";
import { BillingSettings, initialBillingSettings } from "../_shared";

export default function BillingOrangeMoneySettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<BillingSettings>(
    "/api/settings/billing",
    initialBillingSettings
  );

  return (
    <SettingsPageShell
      eyebrow="Paiement Orange Money"
      title="Configuration Orange Money"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <SectionCard
        title="Compte Orange Money"
        subtitle="Cette page ne concerne que Orange Money: activation et numero affiche au client."
      >
        <div className="grid gap-4">
          <ToggleField
            label="Activer Orange Money"
            checked={data.methods.orangeMoneyEnabled}
            onChange={(checked) =>
              setData((current) => ({ ...current, methods: { ...current.methods, orangeMoneyEnabled: checked } }))
            }
          />
          <Field
            label="Numero Orange Money"
            value={data.accounts.orangeMoneyNumber}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, orangeMoneyNumber: value } }))
            }
          />
        </div>
      </SectionCard>
    </SettingsPageShell>
  );
}
