"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Forward, Inbox, Loader2, Pencil, RefreshCw, Reply, Search, Send, Settings, X } from "lucide-react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();
const folders = [
  { id: "INBOX", label: "Inbox" },
  { id: "Sent", label: "Envoyes" },
  { id: "Drafts", label: "Brouillons" },
  { id: "Archive", label: "Archives" },
  { id: "Spam", label: "Spam" }
];

type EmailMessage = {
  id: string;
  uid: number;
  folder: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  subject: string;
  preview: string;
  bodyText: string;
  receivedAt: string;
  isRead: boolean;
};

export default function EmailPage() {
  const [folder, setFolder] = useState("INBOX");
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<"new" | "reply">("new");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ kind: "idle" | "ok" | "error"; message: string }>({
    kind: "idle",
    message: ""
  });
  const composeBodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadMessages(folder);
  }, [folder]);

  useEffect(() => {
    if (!composerOpen) return;

    const focusTimer = window.setTimeout(() => {
      composeBodyRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [composerOpen, composerMode]);

  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return messages;

    return messages.filter((message) =>
      [message.fromName, message.fromEmail, message.subject, message.preview]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [messages, search]);

  const selectedMessage = filteredMessages.find((message) => message.id === selectedId) ?? filteredMessages[0];

  async function loadMessages(nextFolder = folder) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/email/threads?folder=${encodeURIComponent(nextFolder)}&limit=30`, {
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de charger les emails.");

      const nextMessages = (data.messages ?? data.threads ?? []) as EmailMessage[];
      setMessages(nextMessages);
      setSelectedId(nextMessages[0]?.id ?? "");
    } catch (loadError) {
      setMessages([]);
      setSelectedId("");
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les emails.");
    } finally {
      setLoading(false);
    }
  }

  function openNewMessage() {
    setComposerMode("new");
    setComposerOpen(true);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setSendStatus({ kind: "idle", message: "" });
  }

  function openReply(message: EmailMessage) {
    setComposerMode("reply");
    setComposerOpen(true);
    setComposeTo(message.fromEmail);
    setComposeSubject(message.subject.toLowerCase().startsWith("re:") ? message.subject : `Re: ${message.subject}`);
    setComposeBody("");
    setSendStatus({ kind: "idle", message: "" });
  }

  async function sendEmail() {
    if (!composeTo.trim()) {
      setSendStatus({ kind: "error", message: "Ajoute au moins un destinataire." });
      return;
    }

    if (!composeSubject.trim()) {
      setSendStatus({ kind: "error", message: "Ajoute un sujet au message." });
      return;
    }

    if (!composeBody.trim()) {
      setSendStatus({ kind: "error", message: "Ecris le contenu du message avant d'envoyer." });
      return;
    }

    setSending(true);
    setSendStatus({ kind: "idle", message: "" });

    try {
      const response = await fetch(`${apiBaseUrl}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          text: composeBody
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Envoi impossible.");

      setSendStatus({ kind: "ok", message: data.message ?? "Email envoye avec succes." });
      setComposeBody("");
    } catch (sendError) {
      setSendStatus({
        kind: "error",
        message: sendError instanceof Error ? sendError.message : "Envoi impossible."
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border border-line bg-panel">
      <div className="grid h-full lg:grid-cols-[210px_360px_minmax(0,1fr)]">
        <aside className="border-r border-line p-3">
          <div className="mb-4 flex items-center gap-2 px-2 py-1 text-sm font-semibold text-muted">
            <Inbox className="h-4 w-4 text-gold" />
            Boite LWS
          </div>
          <button
            onClick={openNewMessage}
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-black"
          >
            <Pencil className="h-4 w-4" />
            Nouveau message
          </button>
          {folders.map((item) => (
            <button
              key={item.id}
              onClick={() => setFolder(item.id)}
              className={`mb-1 block w-full rounded-md px-3 py-2 text-left text-sm ${
                item.id === folder ? "bg-gold text-black" : "hover:bg-white/5"
              }`}
            >
              {item.label}
              {item.id === "INBOX" && messages.length ? <span className="float-right">{messages.length}</span> : null}
            </button>
          ))}

          <div className="mt-5 rounded-md border border-line bg-ink p-3 text-xs leading-6 text-muted">
            Les emails viennent maintenant du serveur IMAP configure dans Parametres Email.
          </div>

          <Link href="/settings/email" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm">
            <Settings className="h-4 w-4" />
            Parametres
          </Link>
        </aside>

        <aside className="flex min-h-0 flex-col border-r border-line">
          <div className="border-b border-line p-3">
            <div className="flex gap-2">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-ink px-3">
                <Search className="h-4 w-4 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Recherche email"
                />
              </label>
              <button
                onClick={() => loadMessages()}
                disabled={loading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line disabled:opacity-60"
                title="Actualiser"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <StateBlock title="Synchronisation IMAP" text="Lecture des vrais emails en cours..." />
            ) : error ? (
              <StateBlock title="Connexion email requise" text={error} actionHref="/settings/email" actionLabel="Configurer Email" />
            ) : filteredMessages.length === 0 ? (
              <StateBlock title="Aucun email" text="Aucun message trouve dans ce dossier." />
            ) : (
              filteredMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedId(message.id)}
                  className={`block w-full border-b border-line p-4 text-left ${
                    selectedMessage?.id === message.id ? "bg-ink" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className={message.isRead ? "truncate font-medium text-zinc-200" : "truncate font-bold text-white"}>
                      {message.fromName}
                    </p>
                    <span className="shrink-0 text-xs text-muted">{formatEmailDate(message.receivedAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm">{message.subject}</p>
                  <p className="mt-1 truncate text-xs text-muted">{message.preview || "Aucun apercu disponible"}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="relative flex min-w-0 flex-col overflow-hidden">
          {composerOpen ? (
            <Composer
              mode={composerMode}
              to={composeTo}
              subject={composeSubject}
              body={composeBody}
              sending={sending}
              status={sendStatus}
              bodyRef={composeBodyRef}
              onToChange={setComposeTo}
              onSubjectChange={setComposeSubject}
              onBodyChange={setComposeBody}
              onClose={() => setComposerOpen(false)}
              onSend={sendEmail}
            />
          ) : null}
          {selectedMessage ? (
            <>
              <header className="border-b border-line p-5">
                <h1 className="text-xl font-semibold">{selectedMessage.subject}</h1>
                <p className="mt-2 text-sm text-muted">
                  De: {selectedMessage.fromName} &lt;{selectedMessage.fromEmail || "email inconnu"}&gt;
                </p>
                <p className="mt-1 text-sm text-muted">
                  A: {selectedMessage.to.length ? selectedMessage.to.join(", ") : "Oumar Business"} · {formatFullDate(selectedMessage.receivedAt)}
                </p>
              </header>
              <article className="flex-1 overflow-y-auto whitespace-pre-wrap p-6 leading-8 text-zinc-200">
                {selectedMessage.bodyText || "Ce message ne contient pas de texte lisible."}
                <div className="mt-8 rounded-lg border border-line bg-ink p-4">
                  <p className="text-sm font-semibold">Suggestions IA</p>
                  <p className="mt-2 text-sm text-muted">
                    L'agent Email pourra proposer 3 brouillons de reponse a partir de ce vrai message.
                  </p>
                </div>
              </article>
              <footer className="flex gap-2 border-t border-line p-3">
                <button
                  onClick={() => openReply(selectedMessage)}
                  className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black"
                >
                  <Reply className="h-4 w-4" />
                  Repondre
                </button>
                <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm">
                  <Forward className="h-4 w-4" />
                  Transferer
                </button>
                <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm">
                  <Archive className="h-4 w-4" />
                  Archiver
                </button>
              </footer>
            </>
          ) : (
            <StateBlock title="Aucun message selectionne" text="Selectionne un email dans la liste pour lire le contenu." />
          )}
        </section>
      </div>
    </div>
  );
}

function StateBlock({
  title,
  text,
  actionHref,
  actionLabel
}: {
  title: string;
  text: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{text}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-4 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function Composer({
  mode,
  to,
  subject,
  body,
  sending,
  status,
  bodyRef,
  onToChange,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend
}: {
  mode: "new" | "reply";
  to: string;
  subject: string;
  body: string;
  sending: boolean;
  status: { kind: "idle" | "ok" | "error"; message: string };
  bodyRef: { current: HTMLTextAreaElement | null };
  onToChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/55 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gold">{mode === "reply" ? "Reponse email" : "Composition"}</p>
            <p className="mt-1 text-lg font-semibold">{mode === "reply" ? "Repondre a cet email" : "Nouveau message"}</p>
          </div>
          <button onClick={onClose} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm">
            <X className="h-4 w-4" />
            Fermer
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            <label className="grid gap-2 text-sm">
              <span className="text-zinc-300">A:</span>
              <input
                value={to}
                onChange={(event) => onToChange(event.target.value)}
                placeholder="client@example.com"
                className="h-11 rounded-md border border-line bg-black px-3 text-sm outline-none focus:border-gold/70"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-zinc-300">Sujet:</span>
              <input
                value={subject}
                onChange={(event) => onSubjectChange(event.target.value)}
                placeholder="Sujet"
                className="h-11 rounded-md border border-line bg-black px-3 text-sm outline-none focus:border-gold/70"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-zinc-300">Message:</span>
              <textarea
                ref={(node) => {
                  bodyRef.current = node;
                }}
                value={body}
                onChange={(event) => onBodyChange(event.target.value)}
                placeholder="Ecris ton message..."
                className="min-h-64 resize-y rounded-md border border-line bg-black p-3 text-sm leading-6 outline-none focus:border-gold/70"
              />
            </label>
          </div>

          {status.message ? (
            <p
              className={
                status.kind === "error"
                  ? "mt-4 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-100"
                  : "mt-4 rounded-md border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100"
              }
            >
              {status.message}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm font-semibold">
            Fermer
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
