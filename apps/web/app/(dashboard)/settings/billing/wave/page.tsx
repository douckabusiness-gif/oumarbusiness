"use client";

import { Field, SectionCard, SettingsPageShell, ToggleField } from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";
import { BillingSettings, initialBillingSettings } from "../_shared";

export default function BillingWaveSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<BillingSettings>(
    "/api/settings/billing",
    initialBillingSettings
  );

  return (
    <SettingsPageShell
      eyebrow="Paiement Wave"
      title="Configuration Wave CI"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <SectionCard
        title="Compte Wave"
        subtitle="Cette page ne concerne que Wave CI: activation et numero affiche au client."
      >
        <div className="grid gap-4">
          <ToggleField
            label="Activer Wave CI"
            checked={data.methods.waveEnabled}
            onChange={(checked) =>
              setData((current) => ({ ...current, methods: { ...current.methods, waveEnabled: checked } }))
            }
          />
          <Field
            label="Numero Wave"
            value={data.accounts.waveNumber}
            onChange={(value) =>
              setData((current) => ({ ...current, accounts: { ...current.accounts, waveNumber: value } }))
            }
          />
        </div>
      </SectionCard>
    </SettingsPageShell>
  );
}
