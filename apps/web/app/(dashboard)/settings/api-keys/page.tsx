"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MessageSquareText,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  XCircle
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ProviderConfig = {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  budget: string;
  models: string[];
  apiKeyConfigured: boolean;
  apiKeySource: "database" | "env" | "none";
  apiKey?: string;
  clearApiKey?: boolean;
  isReplacingKey?: boolean;
  status?: "idle" | "loading" | "ok" | "error";
  message?: string;
  modelStatus?: "idle" | "loading" | "ok" | "error";
  modelMessage?: string;
  chatStatus?: "idle" | "loading" | "ok" | "error";
  chatMessage?: string;
};

function normalizeProvider(provider: ProviderConfig): ProviderConfig {
  return {
    ...provider,
    apiKey: "",
    clearApiKey: false,
    isReplacingKey: false,
    status: "idle",
    message: undefined,
    modelStatus: "idle",
    modelMessage: provider.models?.length ? `${provider.models.length} modele(s) disponible(s)` : undefined,
    chatStatus: "idle",
    chatMessage: undefined
  };
}

function toProviderPayload(provider: ProviderConfig) {
  const typedApiKey = provider.apiKey?.trim();

  return {
    id: provider.id,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    enabled: provider.enabled,
    budget: provider.budget,
    models: provider.models,
    ...(typedApiKey ? { apiKey: typedApiKey } : {}),
    ...(provider.clearApiKey ? { clearApiKey: true } : {})
  };
}

export default function ApiKeysSettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers`, { cache: "no-store" });
      const data = (await response.json()) as { providers?: ProviderConfig[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Chargement impossible");
      setProviders((data.providers ?? []).map(normalizeProvider));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  function updateProvider(id: string, patch: Partial<ProviderConfig>) {
    setProviders((current) =>
      current.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider))
    );
  }

  async function fetchModels(provider: ProviderConfig) {
    updateProvider(provider.id, { modelStatus: "loading", modelMessage: "Verification de la cle et recuperation des modeles..." });
    try {
      const typedApiKey = provider.apiKey?.trim();
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers/${provider.id}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(typedApiKey ? { apiKey: typedApiKey } : {}),
          baseUrl: provider.baseUrl
        })
      });
      const data = (await response.json()) as { ok?: boolean; models?: string[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Modeles indisponibles");
      const models = data.models?.length ? data.models : provider.models;
      updateProvider(provider.id, {
        models,
        defaultModel: models.includes(provider.defaultModel) ? provider.defaultModel : models[0] ?? provider.defaultModel,
        apiKey: "",
        apiKeyConfigured: provider.apiKeyConfigured || Boolean(typedApiKey),
        apiKeySource: typedApiKey ? "database" : provider.apiKeySource,
        clearApiKey: false,
        isReplacingKey: false,
        modelStatus: "ok",
        modelMessage: `${models.length} modele(s) recupere(s)`
      });
    } catch (caught) {
      updateProvider(provider.id, {
        modelStatus: "error",
        modelMessage: caught instanceof Error ? caught.message : "Modeles indisponibles"
      });
    }
  }

  async function testChat(provider: ProviderConfig) {
    updateProvider(provider.id, { chatStatus: "loading", chatMessage: "Test de generation chat en cours..." });
    try {
      const typedApiKey = provider.apiKey?.trim();
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers/${provider.id}/test-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(typedApiKey ? { apiKey: typedApiKey } : {}),
          baseUrl: provider.baseUrl,
          model: provider.defaultModel
        })
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string; replyPreview?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Test chat impossible");
      updateProvider(provider.id, {
        apiKeyConfigured: provider.apiKeyConfigured || Boolean(typedApiKey),
        apiKeySource: typedApiKey ? "database" : provider.apiKeySource,
        chatStatus: "ok",
        chatMessage: data.replyPreview ? `${data.message ?? "Chat IA fonctionnel"}: ${data.replyPreview}` : (data.message ?? "Chat IA fonctionnel")
      });
    } catch (caught) {
      updateProvider(provider.id, {
        chatStatus: "error",
        chatMessage: caught instanceof Error ? caught.message : "Test chat impossible"
      });
    }
  }

  async function saveProviders() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/ai-providers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: providers.map(toProviderPayload) })
      });
      const data = (await response.json()) as { ok?: boolean; providers?: ProviderConfig[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Sauvegarde impossible");
      setProviders((data.providers ?? providers).map(normalizeProvider));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Fournisseurs IA</p>
          <h1 className="mt-2 text-3xl font-bold">Gestion des cles API</h1>
        </div>
        <div className="flex items-center gap-3">
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Enregistre
            </span>
          ) : null}
          <button
            onClick={() => void saveProviders()}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-gold" />
          <div>
            <h2 className="font-semibold">Vault IA</h2>
            <p className="text-sm text-muted">Les cles sont envoyees a l'API pour verification et ne sont jamais reaffichees en clair.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <section key={provider.id} className="rounded-lg border border-line bg-panel p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-gold" />
                <div>
                  <h2 className="font-semibold">{provider.name}</h2>
                  <KeyStatus provider={provider} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                Actif
                <input
                  type="checkbox"
                  checked={provider.enabled}
                  onChange={(event) => updateProvider(provider.id, { enabled: event.target.checked })}
                  className="h-4 w-4 accent-gold"
                />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1.4fr_1fr_150px_260px]">
              <ApiKeyControl provider={provider} onChange={(patch) => updateProvider(provider.id, patch)} />
              <Field
                label="Base URL"
                value={provider.baseUrl}
                onChange={(value) => updateProvider(provider.id, { baseUrl: value })}
              />
              <ModelSelect
                label="Modele par defaut"
                value={provider.defaultModel}
                models={provider.models}
                onChange={(value) => updateProvider(provider.id, { defaultModel: value })}
              />
              <Field
                label="Budget mensuel"
                value={provider.budget}
                onChange={(value) => updateProvider(provider.id, { budget: value })}
              />
              <div className="mt-7 grid grid-cols-2 gap-2">
                <button
                  onClick={() => void fetchModels(provider)}
                  disabled={provider.modelStatus === "loading"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-3 text-sm font-semibold hover:border-gold/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {provider.modelStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Modeles
                </button>
                <button
                  onClick={() => void testChat(provider)}
                  disabled={provider.chatStatus === "loading"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gold/50 bg-gold/10 px-3 text-sm font-semibold text-gold hover:border-gold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {provider.chatStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                  Tester chat
                </button>
              </div>
            </div>

            <ProviderValidationMessages provider={provider} />
          </section>
        ))}
      </div>
    </div>
  );
}

function ProviderValidationMessages({ provider }: { provider: ProviderConfig }) {
  const rows = [
    {
      label: "Modeles recuperes",
      status: provider.modelStatus,
      message: provider.modelMessage
    },
    {
      label: "Chat IA fonctionnel",
      status: provider.chatStatus,
      message: provider.chatMessage
    }
  ].filter((row) => row.message);

  if (!rows.length) return null;

  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2">
      {rows.map((row) => {
        const isError = row.status === "error";
        const isLoading = row.status === "loading";
        const isOk = row.status === "ok";
        return (
          <div
            key={row.label}
            className={`rounded-md border p-3 text-sm ${
              isError
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : isOk
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-line bg-ink text-zinc-300"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isError ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {row.label}
            </div>
            <p className="mt-1 text-xs leading-5 opacity-90">{row.message}</p>
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function KeyStatus({ provider }: { provider: ProviderConfig }) {
  if (provider.clearApiKey) {
    return <p className="text-xs text-amber-200">Suppression de la cle en attente</p>;
  }

  if (provider.apiKeySource === "database") {
    return <p className="text-xs text-emerald-300">Cle sauvegardee</p>;
  }

  if (provider.apiKeySource === "env") {
    return <p className="text-xs text-sky-300">Cle depuis ENV</p>;
  }

  return <p className="text-xs text-muted">Aucune cle sauvegardee</p>;
}

function ApiKeyControl({
  provider,
  onChange
}: {
  provider: ProviderConfig;
  onChange: (patch: Partial<ProviderConfig>) => void;
}) {
  const showInput = !provider.apiKeyConfigured || provider.isReplacingKey || provider.clearApiKey;

  if (!showInput) {
    return (
      <div className="grid gap-2 text-sm">
        <span className="text-zinc-300">API key</span>
        <div className="min-h-11 rounded-md border border-line bg-ink p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
              {provider.apiKeySource === "env" ? "Cle depuis ENV" : "Cle sauvegardee"}
            </span>
            <button
              type="button"
              onClick={() => onChange({ isReplacingKey: true, apiKey: "", clearApiKey: false })}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold hover:border-gold/70"
            >
              <PencilLine className="h-3.5 w-3.5" />
              Remplacer
            </button>
            {provider.apiKeySource === "database" ? (
              <button
                type="button"
                onClick={() => onChange({ clearApiKey: true, apiKey: "", isReplacingKey: false })}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-red-500/30 px-3 text-xs font-semibold text-red-200 hover:border-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted">
            La cle est configuree. Elle ne sera jamais reaffichee en clair.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm">
      <span className="text-zinc-300">API key</span>
      <input
        type="password"
        placeholder={
          provider.clearApiKey
            ? "Suppression en attente"
            : provider.apiKeyConfigured
              ? "Cle configuree - entrer une nouvelle cle pour remplacer"
              : "sk-..."
        }
        value={provider.apiKey ?? ""}
        disabled={provider.clearApiKey}
        onChange={(event) => onChange({ apiKey: event.target.value, clearApiKey: false })}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {provider.clearApiKey ? (
        <button
          type="button"
          onClick={() => onChange({ clearApiKey: false, apiKey: "", isReplacingKey: false })}
          className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold hover:border-gold/70"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Annuler suppression
        </button>
      ) : provider.isReplacingKey ? (
        <button
          type="button"
          onClick={() => onChange({ isReplacingKey: false, apiKey: "" })}
          className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold hover:border-gold/70"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Annuler remplacement
        </button>
      ) : null}
    </div>
  );
}

function ModelSelect({
  label,
  value,
  models,
  onChange
}: {
  label: string;
  value: string;
  models: string[];
  onChange: (value: string) => void;
}) {
  const options = models.includes(value) ? models : [value, ...models];

  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      >
        {options.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}
