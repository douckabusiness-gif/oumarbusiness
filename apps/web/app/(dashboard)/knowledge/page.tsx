"use client";

import { useEffect, useMemo, useState } from "react";
import { DatabaseZap, FileSearch, FileUp, Loader2, Search, Sparkles, UploadCloud } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type KnowledgeDocument = {
  id: string;
  title: string;
  type: string;
  scope: string;
  clientId?: string | null;
  source: string;
  status: string;
  createdAt: string;
  chunks: Array<{ id: string }>;
};

type SearchResult = {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  score: number;
  scope: string;
  clientId?: string | null;
};

type FilePreview = {
  fileName: string;
  mimeType: string;
  characters: number;
  preview: string;
  ready: boolean;
  error?: string;
};

const emptyForm = {
  title: "",
  type: "faq",
  scope: "global",
  clientId: "",
  source: "manual",
  sourceUrl: "",
  rawText: ""
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchClientId, setSearchClientId] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Record<string, FilePreview>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/memory/knowledge/documents`, { cache: "no-store" });
        const payload = (await response.json()) as { documents?: KnowledgeDocument[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Chargement des documents impossible");
        }

        if (mounted) {
          setDocuments(payload.documents ?? []);
        }
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "Chargement des documents impossible");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalChunks = documents.reduce((sum, document) => sum + document.chunks.length, 0);
    const clientScoped = documents.filter((document) => document.scope === "client").length;
    return {
      documents: documents.length,
      chunks: totalChunks,
      clientScoped
    };
  }, [documents]);

  async function createDocument() {
    if (!form.title.trim() || !form.rawText.trim()) {
      setError("Titre et contenu sont requis.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/memory/knowledge/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          clientId: form.clientId.trim() || undefined,
          sourceUrl: form.sourceUrl.trim() || undefined
        })
      });
      const payload = (await response.json()) as { document?: KnowledgeDocument; error?: string };
      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "Creation du document impossible");
      }

      setDocuments((current) => [payload.document!, ...current]);
      setForm(emptyForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creation du document impossible");
    } finally {
      setSaving(false);
    }
  }

  async function previewFiles(files: File[]) {
    const previews = await Promise.all(
      files.map(async (file) => {
        try {
          const base64 = await readFileAsDataUrl(file);
          const response = await fetch(`${apiBaseUrl}/api/memory/knowledge/files/preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              base64
            })
          });
          const payload = (await response.json()) as {
            fileName?: string;
            mimeType?: string;
            characters?: number;
            preview?: string;
            error?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error ?? "Preview impossible");
          }

          return [
            file.name,
            {
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              characters: payload.characters ?? 0,
              preview: payload.preview ?? "",
              ready: true
            } satisfies FilePreview
          ] as const;
        } catch (caught) {
          return [
            file.name,
            {
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              characters: 0,
              preview: "",
              ready: false,
              error: caught instanceof Error ? caught.message : "Preview impossible"
            } satisfies FilePreview
          ] as const;
        }
      })
    );

    setFilePreviews(Object.fromEntries(previews));
  }

  async function uploadFileDocuments() {
    if (selectedFiles.length === 0) {
      setError("Choisis au moins un fichier PDF, DOCX ou TXT.");
      return;
    }

    setUploadingFile(true);
    setError(null);

    try {
      const createdDocuments: KnowledgeDocument[] = [];

      for (const file of selectedFiles) {
        const base64 = await readFileAsDataUrl(file);
        const response = await fetch(`${apiBaseUrl}/api/memory/knowledge/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:
              selectedFiles.length === 1 && form.title.trim()
                ? form.title.trim()
                : file.name.replace(/\.[^.]+$/, ""),
            type: form.type,
            scope: form.scope,
            clientId: form.clientId.trim() || undefined,
            sourceUrl: form.sourceUrl.trim() || undefined,
            fileName: file.name,
            mimeType: file.type,
            base64
          })
        });
        const payload = (await response.json()) as { document?: KnowledgeDocument; error?: string };
        if (!response.ok || !payload.document) {
          throw new Error(`${file.name}: ${payload.error ?? "Upload fichier impossible"}`);
        }
        createdDocuments.push(payload.document);
      }

      setDocuments((current) => [...createdDocuments.reverse(), ...current]);
      setSelectedFiles([]);
      setFilePreviews({});
      setForm(emptyForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload fichier impossible");
    } finally {
      setUploadingFile(false);
    }
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      setError("Entre une requete pour tester la recherche.");
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/memory/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          clientId: searchClientId.trim() || undefined,
          agentType: "autonomous",
          limit: 5
        })
      });
      const payload = (await response.json()) as { results?: SearchResult[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Recherche impossible");
      }

      setResults(payload.results ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recherche impossible");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Memoire documentaire</p>
        <h1 className="mt-2 text-3xl font-bold">Knowledge base agents</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Ajoute les offres, FAQ, process, briefs ou documents clients que les agents pourront retrouver avant de
          repondre.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={DatabaseZap} label="Documents" value={String(stats.documents)} />
        <StatCard icon={Sparkles} label="Chunks" value={String(stats.chunks)} />
        <StatCard icon={UploadCloud} label="Docs client" value={String(stats.clientScoped)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <UploadCloud className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-semibold">Ajouter une source</h2>
              <p className="mt-1 text-sm text-muted">V1 manuelle: colle le texte utile, on le decoupe et on l’indexe.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Titre" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <Field label="Type" value={form.type} onChange={(value) => setForm((current) => ({ ...current, type: value }))} />
            <Field label="Scope" value={form.scope} onChange={(value) => setForm((current) => ({ ...current, scope: value }))} />
            <Field
              label="Client ID (optionnel)"
              value={form.clientId}
              onChange={(value) => setForm((current) => ({ ...current, clientId: value }))}
            />
            <Field label="Source" value={form.source} onChange={(value) => setForm((current) => ({ ...current, source: value }))} />
            <Field
              label="Source URL"
              value={form.sourceUrl}
              onChange={(value) => setForm((current) => ({ ...current, sourceUrl: value }))}
            />
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="text-zinc-300">Contenu texte</span>
              <textarea
                rows={12}
                value={form.rawText}
                onChange={(event) => setForm((current) => ({ ...current, rawText: event.target.value }))}
                className="rounded-md border border-line bg-ink px-3 py-3 outline-none focus:border-gold/70"
                placeholder="Ex: offre de creation de site, objections commerciales, process support, FAQ..."
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-ink px-4 text-sm font-semibold text-zinc-200">
              <FileUp className="h-4 w-4 text-gold" />
              {selectedFiles.length > 0 ? `${selectedFiles.length} fichier(s) selectionne(s)` : "Choisir PDF / DOCX / TXT"}
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={async (event) => {
                  const files = Array.from(event.target.files ?? []);
                  setSelectedFiles(files);
                  if (files.length > 0) {
                    await previewFiles(files);
                  } else {
                    setFilePreviews({});
                  }
                }}
              />
            </label>
            <button
              type="button"
              onClick={uploadFileDocuments}
              disabled={uploadingFile}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Importer le fichier
            </button>
            <button
              type="button"
              onClick={createDocument}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Indexer le texte
            </button>
          </div>

          {selectedFiles.length > 0 ? (
            <div className="mt-5 grid gap-3">
              {selectedFiles.map((file) => {
                const preview = filePreviews[file.name];
                return (
                  <article key={file.name} className="rounded-md border border-line bg-ink p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{file.name}</p>
                      <span className="text-xs text-muted">
                        {preview?.ready ? `${preview.characters} caracteres extraits` : preview?.error ?? "Analyse..."}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">
                      {preview?.preview || "Apercu indisponible pour le moment."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <FileSearch className="h-5 w-5 text-gold" />
            <div>
              <h2 className="font-semibold">Tester la recherche</h2>
              <p className="mt-1 text-sm text-muted">Verifie ce que les agents recupereront avant de repondre.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Requete" value={searchQuery} onChange={setSearchQuery} />
            <Field label="Client ID (optionnel)" value={searchClientId} onChange={setSearchClientId} />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-5 text-sm font-semibold"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Lancer la recherche
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {results.length === 0 ? (
              <div className="rounded-md border border-dashed border-line bg-ink/50 p-4 text-sm text-muted">
                Aucun resultat pour le moment.
              </div>
            ) : (
              results.map((result) => (
                <article key={result.chunkId} className="rounded-md border border-line bg-ink p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{result.title}</p>
                    <span className="text-xs text-gold">score {result.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-wide text-muted">
                    {result.scope} {result.clientId ? `· client ${result.clientId}` : ""}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-200">{result.content}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="font-semibold">Documents indexes</h2>
        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-md border border-dashed border-line bg-ink/50 p-4 text-sm text-muted">
              Aucun document encore indexe.
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-3 pr-4">Titre</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Scope</th>
                  <th className="pb-3 pr-4">Chunks</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3">Client</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-t border-line/80 text-zinc-200">
                    <td className="py-3 pr-4">{document.title}</td>
                    <td className="py-3 pr-4">{document.type}</td>
                    <td className="py-3 pr-4">{document.scope}</td>
                    <td className="py-3 pr-4">{document.chunks.length}</td>
                    <td className="py-3 pr-4">{document.status}</td>
                    <td className="py-3">{document.clientId ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("lecture_fichier_impossible"));
    reader.readAsDataURL(file);
  });
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof DatabaseZap;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <Icon className="h-5 w-5 text-gold" />
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
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
