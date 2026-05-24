"use client";

import { Globe2 } from "lucide-react";
import {
  Field,
  SectionCard,
  SelectField,
  SettingsPageShell,
  ToggleField
} from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";

type LanguageItem = {
  code: string;
  label: string;
  enabled: boolean;
  rtl: boolean;
};

type LanguagesSettings = {
  defaultLanguage: string;
  defaultDirection: string;
  clientPortalLanguage: string;
  available: LanguageItem[];
  customLabels: {
    dashboardTitle: string;
    clientPortalTitle: string;
    invoiceLabel: string;
  };
};

const initialData: LanguagesSettings = {
  defaultLanguage: "fr",
  defaultDirection: "ltr",
  clientPortalLanguage: "fr",
  available: [],
  customLabels: {
    dashboardTitle: "",
    clientPortalTitle: "",
    invoiceLabel: ""
  }
};

export default function LanguagesSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<LanguagesSettings>(
    "/api/settings/languages",
    initialData
  );

  const enabledCodes = data.available.filter((language) => language.enabled).map((language) => language.code);
  const selectorOptions = enabledCodes.length > 0 ? enabledCodes : ["fr", "en", "ar"];

  return (
    <SettingsPageShell
      eyebrow="Parametres langues"
      title="Langues, portail client et RTL"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Langues actives" subtitle="Active ou desactive les langues disponibles dans l'OS.">
          <div className="grid gap-3">
            {data.available.map((language, index) => (
              <div key={language.code} className="rounded-lg border border-line bg-ink p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Libelle"
                    value={language.label}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        available: current.available.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: value } : item
                        )
                      }))
                    }
                  />
                  <Field
                    label="Code"
                    value={language.code}
                    onChange={(value) =>
                      setData((current) => ({
                        ...current,
                        available: current.available.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, code: value } : item
                        )
                      }))
                    }
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ToggleField
                    label="Langue active"
                    checked={language.enabled}
                    onChange={(checked) =>
                      setData((current) => ({
                        ...current,
                        available: current.available.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, enabled: checked } : item
                        )
                      }))
                    }
                  />
                  <ToggleField
                    label="Mode RTL"
                    checked={language.rtl}
                    onChange={(checked) =>
                      setData((current) => ({
                        ...current,
                        available: current.available.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, rtl: checked } : item
                        )
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Preferences globales" subtitle="Langue par defaut et libelles personnalises.">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Langue par defaut"
              value={data.defaultLanguage}
              options={selectorOptions}
              onChange={(value) => setData((current) => ({ ...current, defaultLanguage: value }))}
            />
            <SelectField
              label="Direction par defaut"
              value={data.defaultDirection}
              options={["ltr", "rtl"]}
              onChange={(value) => setData((current) => ({ ...current, defaultDirection: value }))}
            />
            <SelectField
              label="Langue portail client"
              value={data.clientPortalLanguage}
              options={selectorOptions}
              onChange={(value) => setData((current) => ({ ...current, clientPortalLanguage: value }))}
            />
            <Field
              label="Titre dashboard"
              value={data.customLabels.dashboardTitle}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  customLabels: { ...current.customLabels, dashboardTitle: value }
                }))
              }
            />
            <Field
              label="Titre portail client"
              value={data.customLabels.clientPortalTitle}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  customLabels: { ...current.customLabels, clientPortalTitle: value }
                }))
              }
            />
            <Field
              label="Libelle facture"
              value={data.customLabels.invoiceLabel}
              onChange={(value) =>
                setData((current) => ({
                  ...current,
                  customLabels: { ...current.customLabels, invoiceLabel: value }
                }))
              }
            />
          </div>

          <div className="mt-5 rounded-lg border border-line bg-ink p-4 text-sm text-zinc-300">
            <p className="flex items-center gap-2 font-semibold">
              <Globe2 className="h-4 w-4 text-gold" />
              Etat actuel
            </p>
            <p className="mt-2 text-muted">
              Dashboard en {data.defaultLanguage}, portail client en {data.clientPortalLanguage}, direction {data.defaultDirection}.
            </p>
          </div>
        </SectionCard>
      </div>
    </SettingsPageShell>
  );
}
