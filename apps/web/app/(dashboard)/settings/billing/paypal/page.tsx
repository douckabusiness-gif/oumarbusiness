"use client";

import { Field, SectionCard, SettingsPageShell, ToggleField } from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";
import { BillingSettings, initialBillingSettings } from "../_shared";

export default function BillingPaypalSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<BillingSettings>(
    "/api/settings/billing",
    initialBillingSettings
  );

  return (
    <SettingsPageShell
      eyebrow="Paiement PayPal"
      title="Configuration PayPal"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <SectionCard
        title="Compte PayPal"
        subtitle="Cette page ne concerne que PayPal: activation et identifiant utilise pour les clients."
      >
        <div className="grid gap-4">
          <ToggleField
            label="Activer PayPal"
            checked={data.methods.paypalEnabled}
            onChange={(checked) =>
              setData((current) => ({ ...current, methods: { ...current.methods, paypalEnabled: checked } }))
            }
          />
          <Field
            label="Handle PayPal"
            value={data.accounts.paypalHandle}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, paypalHandle: value } }))
            }
          />
        </div>
      </SectionCard>
    </SettingsPageShell>
  );
}
