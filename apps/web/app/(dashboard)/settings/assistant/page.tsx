"use client";

import {
  Field,
  SectionCard,
  SettingsPageShell,
  TextAreaField,
  ToggleField
} from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";

type AssistantSettings = {
  enabled: boolean;
  assistantName: string;
  launcherTitle: string;
  launcherSubtitle: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  defaultDraft: string;
  quickPrompts: string[];
};

const initialData: AssistantSettings = {
  enabled: true,
  assistantName: "Assistant Oumar Business",
  launcherTitle: "Besoin d'aide ?",
  launcherSubtitle: "Discute avec l'assistant",
  welcomeMessage: "Bonjour, je suis l'assistant Oumar Business. Ecris ton besoin et je t'oriente.",
  inputPlaceholder: "Ecris ton besoin...",
  defaultDraft: "Bonjour, je veux un site web avec agent IA.",
  quickPrompts: [
    "Je veux un devis pour un site web.",
    "Je veux un agent WhatsApp.",
    "Je veux automatiser mes relances."
  ]
};

export default function AssistantSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<AssistantSettings>(
    "/api/settings/assistant",
    initialData
  );

  function setPrompt(index: number, value: string) {
    setData((current) => ({
      ...current,
      quickPrompts: current.quickPrompts.map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  }

  return (
    <SettingsPageShell
      eyebrow="Parametres assistance"
      title="Assistant de la page d'accueil"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <SectionCard title="Comportement general" subtitle="Controle ce que le visiteur voit sur la page d'accueil.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ToggleField
                label="Activer l'assistant sur la page d'accueil"
                checked={data.enabled}
                onChange={(checked) => setData((current) => ({ ...current, enabled: checked }))}
              />
            </div>
            <Field
              label="Nom assistant"
              value={data.assistantName}
              onChange={(value) => setData((current) => ({ ...current, assistantName: value }))}
            />
            <Field
              label="Placeholder champ message"
              value={data.inputPlaceholder}
              onChange={(value) => setData((current) => ({ ...current, inputPlaceholder: value }))}
            />
            <TextAreaField
              label="Message d'accueil"
              value={data.welcomeMessage}
              wide
              rows={4}
              onChange={(value) => setData((current) => ({ ...current, welcomeMessage: value }))}
            />
            <TextAreaField
              label="Texte pre-rempli"
              value={data.defaultDraft}
              wide
              rows={3}
              onChange={(value) => setData((current) => ({ ...current, defaultDraft: value }))}
            />
          </div>
        </SectionCard>

        <SectionCard title="Bouton flottant" subtitle="Texte visible quand le chat est reduit.">
          <div className="grid gap-4">
            <Field
              label="Titre bouton"
              value={data.launcherTitle}
              onChange={(value) => setData((current) => ({ ...current, launcherTitle: value }))}
            />
            <Field
              label="Sous-titre bouton"
              value={data.launcherSubtitle}
              onChange={(value) => setData((current) => ({ ...current, launcherSubtitle: value }))}
            />
            <div className="rounded-lg border border-line bg-ink p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Apercu</p>
              <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-gold/40 bg-panel px-4 py-3">
                <span className="block">
                  <span className="block text-sm font-semibold text-white">{data.launcherTitle}</span>
                  <span className="block text-xs text-zinc-400">{data.launcherSubtitle}</span>
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Prompts rapides" subtitle="3 raccourcis affiches dans la fenetre de chat.">
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Field
              key={index}
              label={`Prompt ${index + 1}`}
              value={data.quickPrompts[index] ?? ""}
              onChange={(value) => setPrompt(index, value)}
            />
          ))}
        </div>
      </SectionCard>
    </SettingsPageShell>
  );
}
