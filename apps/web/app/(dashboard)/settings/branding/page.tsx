"use client";
import { ImagePlus, Paintbrush, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Field,
  SectionCard,
  SettingsPageShell,
  TextAreaField
} from "@/components/settings/SettingsPagePrimitives";
import { useSettingsResource } from "@/components/settings/useSettingsResource";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type BrandingSettings = {
  agencyName: string;
  legalName: string;
  logoUrl: string;
  pwaIconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  invoicePrefix: string;
  clientPortalTitle: string;
  supportEmail: string;
  contactEmail: string;
  phone: string;
  footerText: string;
};

const initialData: BrandingSettings = {
  agencyName: "",
  legalName: "",
  logoUrl: "",
  pwaIconUrl: "",
  primaryColor: "#F5A623",
  secondaryColor: "#080808",
  invoicePrefix: "OB",
  clientPortalTitle: "",
  supportEmail: "",
  contactEmail: "",
  phone: "",
  footerText: ""
};

export default function BrandingSettingsPage() {
  const { data, setData, loading, saving, saved, error, save } = useSettingsResource<BrandingSettings>(
    "/api/settings/branding",
    initialData
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pwaIconInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPwaIcon, setUploadingPwaIcon] = useState(false);

  useEffect(() => {
    if (!saved) return;
    window.dispatchEvent(new CustomEvent("branding-updated"));
  }, [saved]);

  async function handleLogoFile(file: File | null) {
    if (!file) return;
    setUploadingLogo(true);

    try {
      const dataUrl = await prepareLogoAsset(file);
      setData((current) => ({
        ...current,
        logoUrl: dataUrl
      }));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handlePwaIconFile(file: File | null) {
    if (!file) return;
    setUploadingPwaIcon(true);

    try {
      const dataUrl = await preparePwaIconAsset(file);
      setData((current) => ({
        ...current,
        pwaIconUrl: dataUrl
      }));
    } finally {
      setUploadingPwaIcon(false);
    }
  }

  return (
    <SettingsPageShell
      eyebrow="Parametres branding"
      title="Identite visuelle et marque"
      loading={loading}
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Marque agence" subtitle="Nom, logo et textes utilises dans le portail et les factures.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nom agence"
              value={data.agencyName}
              onChange={(value) => setData((current) => ({ ...current, agencyName: value }))}
            />
            <Field
              label="Nom legal"
              value={data.legalName}
              onChange={(value) => setData((current) => ({ ...current, legalName: value }))}
            />
            <Field
              label="URL logo"
              value={data.logoUrl}
              wide
              onChange={(value) => setData((current) => ({ ...current, logoUrl: value }))}
            />
            <div className="grid gap-2 text-sm md:col-span-2">
              <span className="text-zinc-300">Logo depuis l'admin</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-4 font-semibold text-zinc-200"
                >
                  {uploadingLogo ? <UploadCloud className="h-4 w-4 animate-pulse text-gold" /> : <ImagePlus className="h-4 w-4 text-gold" />}
                  Choisir un logo
                </button>
                <span className="text-xs text-muted">PNG, JPG, WebP ou SVG. Il sera sauvegarde dans Branding.</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(event) => {
                    void handleLogoFile(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
            <Field
              label="URL icone PWA"
              value={data.pwaIconUrl}
              wide
              onChange={(value) => setData((current) => ({ ...current, pwaIconUrl: value }))}
            />
            <div className="grid gap-2 text-sm md:col-span-2">
              <span className="text-zinc-300">Icone application installable</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => pwaIconInputRef.current?.click()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-4 font-semibold text-zinc-200"
                >
                  {uploadingPwaIcon ? <UploadCloud className="h-4 w-4 animate-pulse text-gold" /> : <ImagePlus className="h-4 w-4 text-gold" />}
                  Choisir une icone PWA
                </button>
                <span className="text-xs text-muted">PNG, JPG, WebP ou SVG. Utilisee pour l'application installable.</span>
                <input
                  ref={pwaIconInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(event) => {
                    void handlePwaIconFile(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
            <Field
              label="Titre portail client"
              value={data.clientPortalTitle}
              wide
              onChange={(value) => setData((current) => ({ ...current, clientPortalTitle: value }))}
            />
            <Field
              label="Email support"
              value={data.supportEmail}
              onChange={(value) => setData((current) => ({ ...current, supportEmail: value }))}
            />
            <Field
              label="Email contact"
              value={data.contactEmail}
              onChange={(value) => setData((current) => ({ ...current, contactEmail: value }))}
            />
            <Field
              label="Numero de telephone"
              value={data.phone}
              onChange={(value) => setData((current) => ({ ...current, phone: value }))}
            />
            <Field
              label="Prefixe facture"
              value={data.invoicePrefix}
              onChange={(value) => setData((current) => ({ ...current, invoicePrefix: value }))}
            />
            <TextAreaField
              label="Texte de bas de page"
              value={data.footerText}
              wide
              rows={4}
              onChange={(value) => setData((current) => ({ ...current, footerText: value }))}
            />
          </div>
        </SectionCard>

        <SectionCard title="Palette visuelle" subtitle="Couleurs principales de l'OS, des factures et du portail client.">
          <div className="grid gap-4">
            <Field
              label="Couleur primaire"
              value={data.primaryColor}
              onChange={(value) => setData((current) => ({ ...current, primaryColor: value }))}
            />
            <Field
              label="Couleur secondaire"
              value={data.secondaryColor}
              onChange={(value) => setData((current) => ({ ...current, secondaryColor: value }))}
            />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-ink p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Paintbrush className="h-4 w-4 text-gold" />
              Apercu rapide
            </p>
            <div className="mt-4 flex items-center gap-4 rounded-md border border-line bg-panel px-4 py-4">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-line bg-black">
                {data.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveBrandingLogoUrl(data.logoUrl)} alt="Logo agence" className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-sm font-black text-gold">OB</span>
                )}
              </div>
              <div>
                <p className="font-medium">{data.agencyName || "Nom agence"}</p>
                <p className="mt-1 text-sm text-muted">{data.legalName || "Nom legal"}</p>
              </div>
            </div>
            {data.logoUrl ? (
              <div className="mt-4 rounded-md border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview transparence</p>
                <div
                  className="mt-3 flex min-h-24 items-center justify-center rounded-md border border-line p-4"
                  style={{
                    backgroundColor: "#111111",
                    backgroundImage:
                      "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)",
                    backgroundSize: "18px 18px",
                    backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px"
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveBrandingLogoUrl(data.logoUrl)}
                    alt="Preview transparence du logo"
                    className="max-h-20 w-auto max-w-full object-contain"
                  />
                </div>
              </div>
            ) : null}
            {data.pwaIconUrl ? (
              <div className="mt-4 rounded-md border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview icone PWA</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[22px] border border-line bg-black p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveBrandingLogoUrl(data.pwaIconUrl)}
                      alt="Preview icone PWA"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <p className="text-sm text-muted">Cette icone sera utilisee pour l'installation PWA sur mobile et bureau.</p>
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              <div className="rounded-md px-4 py-3 text-black" style={{ backgroundColor: data.primaryColor }}>
                {data.agencyName || "Nom agence"}
              </div>
              <div className="rounded-md px-4 py-3 text-white" style={{ backgroundColor: data.secondaryColor }}>
                {data.clientPortalTitle || "Portail client"}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </SettingsPageShell>
  );
}

async function prepareLogoAsset(file: File) {
  if (file.type === "image/svg+xml") {
    return await rasterizeVectorLogo(file, 512, 512, "contain");
  }

  return await resizeRasterLogo(file, 512, 512, "contain");
}

async function preparePwaIconAsset(file: File) {
  if (file.type === "image/svg+xml") {
    return await rasterizeVectorLogo(file, 512, 512, "contain");
  }

  return await resizeRasterLogo(file, 512, 512, "contain");
}

async function resizeRasterLogo(file: File, maxWidth: number, maxHeight: number, fit: "contain" | "inside") {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const { width, height } = fitInside(image.naturalWidth, image.naturalHeight, maxWidth, maxHeight, fit);
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = maxHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas_context_logo_indisponible");
    }

    context.clearRect(0, 0, maxWidth, maxHeight);
    const offsetX = Math.round((maxWidth - width) / 2);
    const offsetY = Math.round((maxHeight - height) / 2);
    context.drawImage(image, offsetX, offsetY, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function rasterizeVectorLogo(file: File, maxWidth: number, maxHeight: number, fit: "contain" | "inside") {
  const markup = await readFileAsText(file);
  const svgBlob = new Blob([markup], { type: "image/svg+xml" });
  const imageUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(imageUrl);
    const { width, height } = fitInside(image.naturalWidth || 512, image.naturalHeight || 512, maxWidth, maxHeight, fit);
    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = maxHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas_context_logo_indisponible");
    }

    context.clearRect(0, 0, maxWidth, maxHeight);
    const offsetX = Math.round((maxWidth - width) / 2);
    const offsetY = Math.round((maxHeight - height) / 2);
    context.drawImage(image, offsetX, offsetY, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("chargement_logo_impossible"));
    image.src = src;
  });
}

function fitInside(width: number, height: number, maxWidth: number, maxHeight: number, fit: "contain" | "inside") {
  if (fit === "inside" && width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("lecture_logo_impossible"));
    reader.readAsText(file);
  });
}

function resolveBrandingLogoUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }

  return value;
}
