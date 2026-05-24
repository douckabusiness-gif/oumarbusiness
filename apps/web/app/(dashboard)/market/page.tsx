"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Radar, Rocket, Save, Shield, Star, Store, WandSparkles } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ProjectCategory = "agent" | "website" | "marketing" | "automation";
type AppStatus = "draft" | "private" | "published" | "archived";
type Currency = "XOF" | "EUR" | "USD";
type LicenseType = "single" | "extended" | "enterprise" | "internal";

type SourceProject = {
  id: string;
  name: string;
  category: ProjectCategory;
  market: string;
  summary: string;
  deliverables: string[];
};

type MarketplaceApp = {
  id: string;
  sourceProjectId?: string;
  sourceProjectName?: string;
  appName: string;
  slug: string;
  category: ProjectCategory;
  tagline: string;
  shortDescription: string;
  fullDescription: string;
  targetClient: string;
  marketScope: string;
  priceFrom: number;
  currency: Currency;
  licenseType: LicenseType;
  licenseName: string;
  licenseSummary: string;
  supportWindowDays: number;
  demoUrl: string;
  adminDemoUrl?: string;
  demoLogin?: string;
  demoPassword?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  downloadUrl?: string;
  galleryUrls: string[];
  features: string[];
  deliverables: string[];
  techStack: string[];
  tags: string[];
  featured: boolean;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
};

const categoryLabels: Record<ProjectCategory, string> = {
  agent: "Agent IA",
  website: "Site web",
  marketing: "Marketing",
  automation: "Automation"
};

const statusLabels: Record<AppStatus, string> = {
  draft: "Brouillon",
  private: "Privé",
  published: "Publié",
  archived: "Archivé"
};

const licenseLabels: Record<LicenseType, string> = {
  single: "Licence simple",
  extended: "Licence etendue",
  enterprise: "Licence entreprise",
  internal: "Usage interne"
};

export default function MarketAdminPage() {
  const [apps, setApps] = useState<MarketplaceApp[]>([]);
  const [projects, setProjects] = useState<SourceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  const [sourceProjectId, setSourceProjectId] = useState("");
  const [appName, setAppName] = useState("");
  const [category, setCategory] = useState<ProjectCategory>("website");
  const [tagline, setTagline] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [targetClient, setTargetClient] = useState("");
  const [marketScope, setMarketScope] = useState("");
  const [priceFrom, setPriceFrom] = useState("350000");
  const [currency, setCurrency] = useState<Currency>("XOF");
  const [licenseType, setLicenseType] = useState<LicenseType>("single");
  const [licenseName, setLicenseName] = useState("Licence simple Oumar Business");
  const [licenseSummary, setLicenseSummary] = useState("Une installation pour un client final.");
  const [supportWindowDays, setSupportWindowDays] = useState("30");
  const [demoUrl, setDemoUrl] = useState("");
  const [adminDemoUrl, setAdminDemoUrl] = useState("");
  const [demoLogin, setDemoLogin] = useState("");
  const [demoPassword, setDemoPassword] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [galleryText, setGalleryText] = useState("");
  const [thumbnailAssetDataUrl, setThumbnailAssetDataUrl] = useState("");
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");
  const [videoAssetDataUrl, setVideoAssetDataUrl] = useState("");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadAssetDataUrl, setDownloadAssetDataUrl] = useState("");
  const [downloadAssetFilename, setDownloadAssetFilename] = useState("");
  const [downloadPreviewName, setDownloadPreviewName] = useState("");
  const [galleryAssetDataUrls, setGalleryAssetDataUrls] = useState<string[]>([]);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState<string[]>([]);
  const [featuresText, setFeaturesText] = useState("");
  const [deliverablesText, setDeliverablesText] = useState("");
  const [techStackText, setTechStackText] = useState("Next.js\nTypeScript\nPostgreSQL");
  const [tagsText, setTagsText] = useState("");
  const [featured, setFeatured] = useState(true);
  const [publishNow, setPublishNow] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [appsResponse, projectsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/market/apps`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/market/source-projects`, { cache: "no-store" })
        ]);

        const appsData = await appsResponse.json();
        const projectsData = await projectsResponse.json();

        if (!appsResponse.ok) throw new Error(String(appsData.error ?? "Impossible de charger les apps."));
        if (!projectsResponse.ok) throw new Error(String(projectsData.error ?? "Impossible de charger les projets finis."));

        const nextApps = Array.isArray(appsData.items) ? appsData.items : [];
        const nextProjects = Array.isArray(projectsData.items) ? projectsData.items : [];

        setApps(nextApps);
        setProjects(nextProjects);

        if (nextProjects.length > 0) {
          const first = nextProjects[0] as SourceProject;
          setSourceProjectId(first.id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le market admin.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === sourceProjectId) ?? null,
    [projects, sourceProjectId]
  );

  useEffect(() => {
    if (!selectedProject) return;

    setCategory(selectedProject.category);
    setAppName((current) => current || selectedProject.name);
    setTagline((current) => current || buildDefaultTagline(selectedProject.category));
    setShortDescription((current) => current || selectedProject.summary);
    setFullDescription((current) => current || `${selectedProject.summary} Cette application peut ensuite etre adaptee au client final selon le besoin.`);
    setTargetClient((current) => current || buildDefaultTargetClient(selectedProject.category));
    setMarketScope((current) => current || selectedProject.market);
    setLicenseName((current) => current || buildDefaultLicenseName(selectedProject.category));
    setLicenseSummary((current) => current || buildDefaultLicenseSummary(selectedProject.category));
    setDeliverablesText((current) => current || selectedProject.deliverables.join("\n"));
    setFeaturesText((current) => current || buildDefaultFeatures(selectedProject.category).join("\n"));
  }, [selectedProject]);

  const stats = useMemo(() => {
    return {
      total: apps.length,
      published: apps.filter((item) => item.status === "published").length,
      privateApps: apps.filter((item) => item.status === "private").length,
      featuredApps: apps.filter((item) => item.featured).length
    };
  }, [apps]);

  function resetForm() {
    setEditingAppId(null);
    setAppName(selectedProject?.name ?? "");
    setCategory(selectedProject?.category ?? "website");
    setTagline(selectedProject ? buildDefaultTagline(selectedProject.category) : "");
    setShortDescription(selectedProject?.summary ?? "");
    setFullDescription(selectedProject ? `${selectedProject.summary} Cette application peut ensuite etre adaptee au client final selon le besoin.` : "");
    setTargetClient(selectedProject ? buildDefaultTargetClient(selectedProject.category) : "");
    setMarketScope(selectedProject?.market ?? "");
    setPriceFrom("350000");
    setCurrency("XOF");
    setLicenseType("single");
    setLicenseName(selectedProject ? buildDefaultLicenseName(selectedProject.category) : "Licence simple Oumar Business");
    setLicenseSummary(selectedProject ? buildDefaultLicenseSummary(selectedProject.category) : "Une installation pour un client final.");
    setSupportWindowDays("30");
    setDemoUrl("");
    setAdminDemoUrl("");
    setDemoLogin("");
    setDemoPassword("");
    setThumbnailUrl("");
    setVideoUrl("");
    setGalleryText("");
    setThumbnailAssetDataUrl("");
    setThumbnailPreviewUrl("");
    setVideoAssetDataUrl("");
    setVideoPreviewUrl("");
    setDownloadUrl("");
    setDownloadAssetDataUrl("");
    setDownloadAssetFilename("");
    setDownloadPreviewName("");
    setGalleryAssetDataUrls([]);
    setGalleryPreviewUrls([]);
    setFeaturesText(selectedProject ? buildDefaultFeatures(selectedProject.category).join("\n") : "");
    setDeliverablesText(selectedProject?.deliverables.join("\n") ?? "");
    setTechStackText("Next.js\nTypeScript\nPostgreSQL");
    setTagsText("");
    setFeatured(true);
    setPublishNow(true);
  }

  function startEditing(app: MarketplaceApp) {
    setEditingAppId(app.id);
    setSourceProjectId(app.sourceProjectId ?? sourceProjectId);
    setAppName(app.appName);
    setCategory(app.category);
    setTagline(app.tagline);
    setShortDescription(app.shortDescription);
    setFullDescription(app.fullDescription);
    setTargetClient(app.targetClient);
    setMarketScope(app.marketScope);
    setPriceFrom(String(app.priceFrom));
    setCurrency(app.currency);
    setLicenseType(app.licenseType);
    setLicenseName(app.licenseName);
    setLicenseSummary(app.licenseSummary);
    setSupportWindowDays(String(app.supportWindowDays));
    setDemoUrl(app.demoUrl);
    setAdminDemoUrl(app.adminDemoUrl ?? "");
    setDemoLogin(app.demoLogin ?? "");
    setDemoPassword(app.demoPassword ?? "");
    setThumbnailUrl(app.thumbnailUrl ?? "");
    setVideoUrl(app.videoUrl ?? "");
    setGalleryText(app.galleryUrls.join("\n"));
    setThumbnailAssetDataUrl("");
    setThumbnailPreviewUrl(resolveAssetUrl(app.thumbnailUrl));
    setVideoAssetDataUrl("");
    setVideoPreviewUrl(resolveAssetUrl(app.videoUrl));
    setDownloadUrl(app.downloadUrl ?? "");
    setDownloadAssetDataUrl("");
    setDownloadAssetFilename("");
    setDownloadPreviewName(app.downloadUrl ? app.downloadUrl.split("/").pop() ?? "package" : "");
    setGalleryAssetDataUrls([]);
    setGalleryPreviewUrls(app.galleryUrls.map((item) => resolveAssetUrl(item)));
    setFeaturesText(app.features.join("\n"));
    setDeliverablesText(app.deliverables.join("\n"));
    setTechStackText(app.techStack.join("\n"));
    setTagsText(app.tags.join(", "));
    setFeatured(app.featured);
    setPublishNow(app.status === "published");
    setError("");
    setSuccess("");
  }

  async function handleSaveApp() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(`${apiBaseUrl}/api/market/apps${editingAppId ? `/${editingAppId}` : ""}`, {
        method: editingAppId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceProjectId: sourceProjectId || undefined,
          appName,
          category,
          tagline,
          shortDescription,
          fullDescription,
          targetClient,
          marketScope,
          priceFrom: Number(priceFrom),
          currency,
          licenseType,
          licenseName,
          licenseSummary,
          supportWindowDays: Number(supportWindowDays),
          demoUrl,
          adminDemoUrl: adminDemoUrl || undefined,
          demoLogin: demoLogin || undefined,
          demoPassword: demoPassword || undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          videoUrl: videoUrl || undefined,
          downloadUrl: downloadUrl || undefined,
          thumbnailAssetDataUrl: thumbnailAssetDataUrl || undefined,
          videoAssetDataUrl: videoAssetDataUrl || undefined,
          downloadAssetDataUrl: downloadAssetDataUrl || undefined,
          downloadAssetFilename: downloadAssetFilename || undefined,
          galleryAssetDataUrls,
          galleryUrls: splitLines(galleryText),
          features: splitLines(featuresText),
          deliverables: splitLines(deliverablesText),
          techStack: splitLines(techStackText),
          tags: splitCommaValues(tagsText),
          featured,
          status: publishNow ? "published" : "private"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible d'ajouter l'application."));
      }

      const item = data.item as MarketplaceApp;
      setApps((current) => {
        if (editingAppId) {
          return current.map((entry) => (entry.id === item.id ? item : entry));
        }

        return [item, ...current];
      });
      setSuccess(
        editingAppId
          ? "Application mise à jour."
          : publishNow
            ? "Application publiée dans le showroom."
            : "Application enregistrée en privé."
      );
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'enregistrer l'application.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: AppStatus, nextFeatured?: boolean) {
    try {
      setError("");
      const response = await fetch(`${apiBaseUrl}/api/market/apps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(typeof nextFeatured === "boolean" ? { featured: nextFeatured } : {})
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible de mettre à jour l'application."));
      }

      const item = data.item as MarketplaceApp;
      setApps((current) => current.map((app) => (app.id === item.id ? item : app)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Impossible de mettre à jour l'application.");
    }
  }

  async function duplicateApp(id: string) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(`${apiBaseUrl}/api/market/apps/${id}/duplicate`, {
        method: "POST"
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data.error ?? "Impossible de dupliquer l'application."));
      }

      const item = data.item as MarketplaceApp;
      setApps((current) => [item, ...current]);
      setSuccess("Application dupliquée en brouillon.");
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Impossible de dupliquer l'application.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Marketplace admin</p>
          <h1 className="mt-2 text-3xl font-bold">Ton propre ThemeForest pour apps et démos</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Tu crées ta fiche produit, tu branches la démo live, tu ajoutes les identifiants démo et tu publies ton application dans une vraie vitrine commerciale.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/market/leads"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold text-zinc-200"
          >
            <Radar className="h-4 w-4 text-gold" />
            Leads marketplace
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black"
          >
            <ExternalLink className="h-4 w-4" />
            Ouvrir le showroom public
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard icon={Store} label="Apps" value={String(stats.total)} />
        <StatCard icon={Rocket} label="Publiées" value={String(stats.published)} />
        <StatCard icon={Shield} label="Privées" value={String(stats.privateApps)} />
        <StatCard icon={Star} label="Featured" value={String(stats.featuredApps)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <WandSparkles className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">{editingAppId ? "Modifier une application" : "Publier une application"}</h2>
          </div>

          {loading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-300">Projet fini source</span>
                  <select
                    value={sourceProjectId}
                    onChange={(event) => {
                      setSourceProjectId(event.target.value);
                      setAppName("");
                      setTagline("");
                      setShortDescription("");
                      setFullDescription("");
                      setTargetClient("");
                      setMarketScope("");
                      setDeliverablesText("");
                      setFeaturesText("");
                    }}
                    className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <Field label="Nom de l'application" value={appName} onChange={setAppName} />
                <Field label="Tagline produit" value={tagline} onChange={setTagline} />

                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-300">Catégorie</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as ProjectCategory)}
                    className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
                  >
                    <option value="website">Site web</option>
                    <option value="agent">Agent IA</option>
                    <option value="marketing">Marketing</option>
                    <option value="automation">Automation</option>
                  </select>
                </label>

                <TextAreaField label="Résumé court" value={shortDescription} onChange={setShortDescription} />
                <TextAreaField label="Description complète" value={fullDescription} onChange={setFullDescription} />
                <Field label="Client cible" value={targetClient} onChange={setTargetClient} />
                <Field label="Zone marché" value={marketScope} onChange={setMarketScope} />
                <Field label="Prix de départ" value={priceFrom} onChange={setPriceFrom} />

                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-300">Devise</span>
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value as Currency)}
                    className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
                  >
                    <option value="XOF">XOF</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-300">Type de licence</span>
                  <select
                    value={licenseType}
                    onChange={(event) => setLicenseType(event.target.value as LicenseType)}
                    className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
                  >
                    <option value="single">Licence simple</option>
                    <option value="extended">Licence etendue</option>
                    <option value="enterprise">Licence entreprise</option>
                    <option value="internal">Usage interne</option>
                  </select>
                </label>
                <Field label="Nom de licence" value={licenseName} onChange={setLicenseName} />
                <TextAreaField label="Resume licence" value={licenseSummary} onChange={setLicenseSummary} />
                <Field label="Support (jours)" value={supportWindowDays} onChange={setSupportWindowDays} />

                <Field label="URL démo live" value={demoUrl} onChange={setDemoUrl} />
                <Field label="URL démo admin" value={adminDemoUrl} onChange={setAdminDemoUrl} />
                <Field label="Login démo" value={demoLogin} onChange={setDemoLogin} />
                <Field label="Mot de passe démo" value={demoPassword} onChange={setDemoPassword} />
                <Field label="Image cover URL" value={thumbnailUrl} onChange={setThumbnailUrl} />
                <Field label="Vidéo preview URL" value={videoUrl} onChange={setVideoUrl} />
                <Field label="URL téléchargement externe" value={downloadUrl} onChange={setDownloadUrl} />
                <UploadField
                  label="Uploader la cover"
                  accept="image/png,image/jpeg,image/webp"
                  onDataUrl={(dataUrl) => {
                    setThumbnailAssetDataUrl(dataUrl);
                    setThumbnailPreviewUrl(dataUrl);
                  }}
                />
                {thumbnailPreviewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-line bg-ink p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnailPreviewUrl} alt="Cover preview" className="aspect-[16/10] w-full rounded-lg object-cover" />
                  </div>
                ) : null}
                <UploadField
                  label="Uploader la vidéo preview"
                  accept="video/mp4,video/webm,video/quicktime"
                  onDataUrl={(dataUrl) => {
                    setVideoAssetDataUrl(dataUrl);
                    setVideoPreviewUrl(dataUrl);
                  }}
                />
                {videoPreviewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-line bg-ink p-3">
                    <video src={videoPreviewUrl} controls className="aspect-video w-full rounded-lg bg-black" />
                  </div>
                ) : null}
                  <UploadField
                    label="Uploader le package téléchargeable"
                    accept=".zip,.pdf,.rar,.7z,application/zip,application/pdf,application/octet-stream"
                    onDataUrl={(dataUrl) => {
                      setDownloadAssetDataUrl(dataUrl);
                    }}
                    onFile={({ dataUrl, filename }) => {
                      setDownloadAssetDataUrl(dataUrl);
                      setDownloadAssetFilename(filename);
                      setDownloadPreviewName(filename);
                    }}
                />
                {downloadPreviewName ? (
                  <div className="rounded-xl border border-line bg-ink p-3 text-sm text-zinc-200">
                    Package pret: <span className="font-semibold text-gold">{downloadPreviewName}</span>
                  </div>
                ) : null}
                <MultiUploadField
                  label="Uploader la galerie images"
                  accept="image/png,image/jpeg,image/webp"
                  onDataUrls={(dataUrls) => {
                    setGalleryAssetDataUrls(dataUrls);
                    setGalleryPreviewUrls(dataUrls);
                  }}
                />
                {galleryPreviewUrls.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {galleryPreviewUrls.map((previewUrl) => (
                      <div key={previewUrl} className="overflow-hidden rounded-xl border border-line bg-ink p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Gallery preview" className="aspect-[4/3] w-full rounded-lg object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}

                <TextAreaField label="Galerie images (1 ligne = 1 URL)" value={galleryText} onChange={setGalleryText} />
                <TextAreaField label="Fonctionnalités (1 ligne = 1 point fort)" value={featuresText} onChange={setFeaturesText} />
                <TextAreaField label="Livrables (1 ligne = 1 livrable)" value={deliverablesText} onChange={setDeliverablesText} />
                <TextAreaField label="Stack technique (1 ligne = 1 techno)" value={techStackText} onChange={setTechStackText} />
                <Field label="Tags (séparés par virgule)" value={tagsText} onChange={setTagsText} />

                <label className="flex items-center gap-3 rounded-lg border border-line bg-ink px-4 py-3 text-sm">
                  <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="h-4 w-4 accent-[#F5A623]" />
                  Mettre en avant cette app
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-line bg-ink px-4 py-3 text-sm">
                  <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} className="h-4 w-4 accent-[#F5A623]" />
                  Publier directement dans le showroom
                </label>
              </div>

              {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
              {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => void handleSaveApp()}
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Enregistrement..." : editingAppId ? "Sauver les modifications" : publishNow ? "Publier l'application" : "Sauver en privé"}
                </button>
                {editingAppId ? (
                  <button
                    onClick={() => resetForm()}
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-line px-5 text-sm font-medium"
                  >
                    Annuler édition
                  </button>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-gold" />
            <div>
              <h2 className="text-lg font-semibold">Catalogue apps</h2>
              <p className="mt-1 text-sm text-muted">Tu gères ici le statut, la mise en avant et l’accès au showroom public.</p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du catalogue...
            </div>
          ) : apps.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-line bg-ink p-6 text-sm text-muted">
              Aucune application publiée pour le moment.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {apps.map((app) => (
                <article key={app.id} className="rounded-lg border border-line bg-ink p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{app.appName}</h3>
                        <StatusBadge status={app.status} />
                        {app.featured ? <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black">Featured</span> : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-gold">{app.tagline}</p>
                      <p className="mt-2 text-sm text-muted">{app.shortDescription}</p>
                    </div>
                    <div className="rounded-lg border border-gold/25 bg-gold/10 px-4 py-3 text-right">
                      <p className="text-xs text-muted">Démo</p>
                      <a href={app.demoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-gold">
                        Voir live
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>

                  {app.thumbnailUrl ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-panel">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveAssetUrl(app.thumbnailUrl)} alt={app.appName} className="aspect-[16/8] w-full object-cover" />
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 xl:grid-cols-4">
                    <MiniInfo label="Catégorie" value={categoryLabels[app.category]} />
                    <MiniInfo label="Marché" value={app.marketScope} />
                    <MiniInfo label="Prix" value={`${app.priceFrom.toLocaleString("fr-FR")} ${app.currency}`} />
                    <MiniInfo label="Licence" value={licenseLabels[app.licenseType]} />
                  </div>
                  <div className="mt-3 grid gap-3 xl:grid-cols-3">
                    <MiniInfo label="Nom licence" value={app.licenseName} />
                    <MiniInfo label="Support" value={`${app.supportWindowDays} jours`} />
                    <MiniInfo label="Slug public" value={app.slug} />
                  </div>
                  <div className="mt-3 rounded-md border border-line bg-panel p-3">
                    <p className="text-xs text-muted">Résumé licence</p>
                    <p className="mt-1 text-sm font-medium">{app.licenseSummary}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {app.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-line px-3 py-1 text-xs text-zinc-300">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {app.status !== "published" ? (
                      <button onClick={() => void updateStatus(app.id, "published")} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black">
                        Publier
                      </button>
                    ) : null}
                    {app.status !== "private" ? (
                      <button onClick={() => void updateStatus(app.id, "private")} className="rounded-md border border-line px-4 py-2 text-sm">
                        Passer en privé
                      </button>
                    ) : null}
                    {app.status !== "draft" ? (
                      <button onClick={() => void updateStatus(app.id, "draft")} className="rounded-md border border-line px-4 py-2 text-sm">
                        Brouillon
                      </button>
                    ) : null}
                    {app.status !== "archived" ? (
                      <button onClick={() => void updateStatus(app.id, "archived")} className="rounded-md border border-line px-4 py-2 text-sm">
                        Archiver
                      </button>
                    ) : null}
                    <button
                      onClick={() => void updateStatus(app.id, app.status, !app.featured)}
                      className="rounded-md border border-line px-4 py-2 text-sm"
                    >
                      {app.featured ? "Retirer featured" : "Mettre featured"}
                    </button>
                    <button
                      onClick={() => void duplicateApp(app.id)}
                      className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm"
                    >
                      <Copy className="h-4 w-4" />
                      Dupliquer
                    </button>
                    <button
                      onClick={() => startEditing(app)}
                      className="rounded-md border border-line px-4 py-2 text-sm"
                    >
                      Modifier
                    </button>
                    <Link href={`/marketplace/${app.slug}`} className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm">
                      Ouvrir fiche
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    {app.downloadUrl ? (
                      <a
                        href={resolveAssetUrl(app.downloadUrl)}
                        download
                        className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm"
                      >
                        Telecharger package
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function buildDefaultTagline(category: ProjectCategory) {
  if (category === "agent") return "Une app autonome prête à convertir et assister.";
  if (category === "marketing") return "Une machine à leads prête à être déployée.";
  if (category === "automation") return "Un workflow intelligent qui fait gagner du temps.";
  return "Une application premium prête à être montrée en démo.";
}

function buildDefaultTargetClient(category: ProjectCategory) {
  if (category === "agent") return "PME, services clients, cliniques, commerces, support";
  if (category === "marketing") return "Entreprises qui veulent plus de leads qualifiés";
  if (category === "automation") return "Entreprises qui veulent structurer acquisition et opérations";
  return "Entreprises qui veulent un portail ou un site haut de gamme";
}

function buildDefaultLicenseName(category: ProjectCategory) {
  if (category === "agent") return "Licence simple Agent IA";
  if (category === "marketing") return "Licence campagne et assets";
  if (category === "automation") return "Licence workflow automation";
  return "Licence simple application web";
}

function buildDefaultLicenseSummary(category: ProjectCategory) {
  if (category === "agent") return "Une installation pour un client final avec adaptation du prompt et support initial.";
  if (category === "marketing") return "Utilisation pour une marque avec droits sur la structure de campagne et les assets livres.";
  if (category === "automation") return "Une installation pour un process client, avec ajustements mineurs inclus.";
  return "Une installation pour un client final, personnalisation legere et support initial inclus.";
}

function buildDefaultFeatures(category: ProjectCategory) {
  if (category === "agent") return ["Réponses automatiques 24/7", "Escalade humaine", "Mémoire client", "Journal IA"];
  if (category === "marketing") return ["Pages campagnes", "Scoring IA", "A/B testing", "Planner marketing"];
  if (category === "automation") return ["Workflows automatiques", "CRM connecté", "Reporting", "Relances"];
  return ["Dashboard clair", "Portail client", "Design premium", "Production rapide"];
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitCommaValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-gold/10 p-2">
          <Icon className="h-4 w-4 text-gold" />
        </div>
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function resolveAssetUrl(value?: string) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }

  return value;
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

function UploadField({
  label,
  accept,
  onDataUrl,
  onFile
}: {
  label: string;
  accept: string;
  onDataUrl: (dataUrl: string) => void;
  onFile?: (file: { dataUrl: string; filename: string }) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void readFileAsDataUrl(file)
            .then((dataUrl) => {
              onDataUrl(dataUrl);
              onFile?.({ dataUrl, filename: file.name });
            })
            .catch(() => undefined);
        }}
        className="rounded-md border border-line bg-ink px-3 py-3 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
      />
    </label>
  );
}

function MultiUploadField({
  label,
  accept,
  onDataUrls
}: {
  label: string;
  accept: string;
  onDataUrls: (dataUrls: string[]) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type="file"
        accept={accept}
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length === 0) return;
          void Promise.all(files.map((file) => readFileAsDataUrl(file)))
            .then(onDataUrls)
            .catch(() => undefined);
        }}
        className="rounded-md border border-line bg-ink px-3 py-3 text-sm outline-none file:mr-4 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: AppStatus }) {
  const tone =
    status === "published"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : status === "private"
        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
        : status === "archived"
          ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
          : "border-gold/30 bg-gold/10 text-gold";

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${tone}`}>{statusLabels[status]}</span>;
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70" />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 rounded-md border border-line bg-ink p-3 text-sm outline-none focus:border-gold/70" />
    </label>
  );
}
