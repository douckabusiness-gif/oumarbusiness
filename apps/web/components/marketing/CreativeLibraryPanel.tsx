"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { BarChart3, CheckCircle2, Image as ImageIcon, Loader2, Send, Sparkles, Video } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type CreativeLibraryItem = {
  id: string;
  platform: "meta" | "google";
  mediaType: "image" | "video";
  name: string;
  campaign: string;
  format: string;
  primaryText: string;
  cta: string;
  prompt: string;
  script?: string;
  voiceover?: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  score: number;
  verdict: "ready" | "optimize" | "revise";
  recommendations: string[];
  createdAt: string;
};

type CreativeLibraryPanelProps = {
  platform: "meta" | "google";
  mediaType: "image" | "video";
  title: string;
  description: string;
  accent: "sky" | "emerald";
  accept: string;
  defaultName: string;
  defaultCampaign: string;
  formatOptions: string[];
  defaultFormat: string;
  defaultPrimaryText: string;
  defaultCta: string;
  defaultPrompt: string;
  defaultScript?: string;
  defaultVoiceover?: string;
  submitLabel: string;
};

function toAbsoluteAssetUrl(value: string) {
  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }

  return value;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export function CreativeLibraryPanel(props: CreativeLibraryPanelProps) {
  const [items, setItems] = useState<CreativeLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [assetDataUrl, setAssetDataUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [name, setName] = useState(props.defaultName);
  const [campaign, setCampaign] = useState(props.defaultCampaign);
  const [format, setFormat] = useState(props.defaultFormat);
  const [primaryText, setPrimaryText] = useState(props.defaultPrimaryText);
  const [cta, setCta] = useState(props.defaultCta);
  const [prompt, setPrompt] = useState(props.defaultPrompt);
  const [script, setScript] = useState(props.defaultScript ?? "");
  const [voiceover, setVoiceover] = useState(props.defaultVoiceover ?? "");

  useEffect(() => {
    async function loadLibrary() {
      try {
        setLoading(true);
        const response = await fetch(
          `${apiBaseUrl}/api/marketing/creative-library?platform=${props.platform}&mediaType=${props.mediaType}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(String(data.error ?? "Impossible de charger la bibliothèque."));
        }
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la bibliothèque.");
      } finally {
        setLoading(false);
      }
    }

    void loadLibrary();
  }, [props.mediaType, props.platform]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const accentClasses =
    props.accent === "sky"
      ? {
          border: "border-sky-400/30",
          dashed: "border-sky-300/40",
          icon: "text-sky-300",
          pill: "bg-sky-500/10 text-sky-200",
          button: "bg-sky-300 text-black",
          recommendation: "border-sky-300/25 bg-sky-500/10 text-sky-100"
        }
      : {
          border: "border-emerald-400/30",
          dashed: "border-emerald-300/40",
          icon: "text-emerald-300",
          pill: "bg-emerald-500/10 text-emerald-200",
          button: "bg-emerald-300 text-black",
          recommendation: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
        };

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFileName(file.name);
    setName(file.name.replace(/\.[^.]+$/, ""));
    setPreviewUrl(URL.createObjectURL(file));
    setAssetDataUrl(await readFileAsDataUrl(file));
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    if (!assetDataUrl) {
      setError("Ajoute d'abord un fichier.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${apiBaseUrl}/api/marketing/creative-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: props.platform,
          mediaType: props.mediaType,
          name,
          campaign,
          format,
          primaryText,
          cta,
          prompt,
          script,
          voiceover,
          assetDataUrl
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible d'enregistrer la créative."));
      }

      const nextItem = data.item as CreativeLibraryItem;
      setItems((current) => [nextItem, ...current]);
      setSuccess("Créative enregistrée et scorée dans la bibliothèque.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'enregistrer la créative.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`rounded-lg border ${accentClasses.border} bg-panel p-5`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="mt-1 text-sm text-muted">{props.description}</p>
        </div>
        <div className={`inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm ${accentClasses.pill}`}>
          <BarChart3 className="h-4 w-4" />
          {items.length} créative{items.length > 1 ? "s" : ""} sauvegardée{items.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <label className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed ${accentClasses.dashed} bg-ink p-4 text-center`}>
          {previewUrl ? (
            props.mediaType === "video" ? (
              <video src={previewUrl} controls className="max-h-72 w-full rounded-md object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Aperçu créative" className="max-h-72 w-full rounded-md object-contain" />
            )
          ) : (
            <>
              {props.mediaType === "video" ? (
                <Video className={`h-10 w-10 ${accentClasses.icon}`} />
              ) : (
                <ImageIcon className={`h-10 w-10 ${accentClasses.icon}`} />
              )}
              <span className="mt-4 font-semibold">{props.mediaType === "video" ? "Importer une vidéo" : "Importer une image"}</span>
              <span className="mt-2 text-xs text-muted">{selectedFileName || "Le fichier restera dans la bibliothèque après refresh."}</span>
            </>
          )}
          <input type="file" accept={props.accept} className="hidden" onChange={(event) => void handleFileChange(event)} />
        </label>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nom créative" value={name} onChange={setName} />
            <Field label="Campagne liée" value={campaign} onChange={setCampaign} />
            <SelectField label="Format / usage" value={format} onChange={setFormat} options={props.formatOptions} />
            <Field label="CTA" value={cta} onChange={setCta} />
          </div>

          <TextAreaField label="Message principal" value={primaryText} onChange={setPrimaryText} minHeight="min-h-24" />
          <TextAreaField label="Prompt créatif" value={prompt} onChange={setPrompt} minHeight="min-h-24" />

          {props.mediaType === "video" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <TextAreaField label="Script vidéo" value={script} onChange={setScript} minHeight="min-h-28" />
              <TextAreaField label="Voix off" value={voiceover} onChange={setVoiceover} minHeight="min-h-28" />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

          <button
            onClick={() => void handleSave()}
            disabled={saving || !assetDataUrl}
            className={`inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-50 ${accentClasses.button}`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {saving ? "Enregistrement..." : props.submitLabel}
          </button>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <Sparkles className={`h-5 w-5 ${accentClasses.icon}`} />
          <h3 className="font-semibold">Bibliothèque créative</h3>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de la bibliothèque...
          </div>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Aucune créative enregistrée pour cette plateforme.</p>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-line bg-ink p-4">
                <div className="grid gap-4 md:grid-cols-[148px_1fr]">
                  <div className="overflow-hidden rounded-md border border-line bg-panel">
                    {item.mediaType === "video" ? (
                      <video src={toAbsoluteAssetUrl(item.fileUrl)} controls className="h-36 w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={toAbsoluteAssetUrl(item.fileUrl)} alt={item.name} className="h-36 w-full object-cover" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{item.name}</h4>
                        <p className="mt-1 text-xs text-muted">{item.campaign}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accentClasses.pill}`}>
                        Score IA {item.score}/100
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <Info label="Format" value={item.format} />
                      <Info label="Statut" value={verdictLabel(item.verdict)} />
                    </div>

                    <p className="mt-3 text-sm text-zinc-200">{item.primaryText || "Pas de message principal."}</p>

                    <div className={`mt-4 rounded-md border p-3 ${accentClasses.recommendation}`}>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        Recommandation IA
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        {item.recommendations.map((recommendation) => (
                          <p key={recommendation}>{recommendation}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function verdictLabel(verdict: CreativeLibraryItem["verdict"]) {
  if (verdict === "ready") return "Prête à tester";
  if (verdict === "optimize") return "À optimiser";
  return "À retravailler";
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
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
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  minHeight
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${minHeight} rounded-md border border-line bg-ink p-3 text-sm outline-none focus:border-gold/70`}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
