"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Check, CheckCheck, Clock, FileText, ImageIcon, Loader2, MessageSquare, Mic, Paperclip, RefreshCw, Send, Settings, Smile, Square, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type Session = {
  id: string;
  name: string;
  phoneNumber?: string;
  status: string;
  connected: boolean;
};

type Conversation = {
  id: string;
  sessionId: string;
  jid: string;
  name?: string;
  phoneNumber?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
};

type Message = {
  id: string;
  waMessageId: string;
  fromMe: boolean;
  type: string;
  content?: string;
  mediaUrl?: string;
  mimetype?: string;
  filename?: string;
  fileSize?: number;
  caption?: string;
  status?: "pending" | "sent" | "delivered" | "read";
  timestamp: string;
};

type IncomingMsg = {
  id?: string;
  from?: string;
  text?: string;
  type?: string;
  mediaUrl?: string;
  mimetype?: string;
  filename?: string;
  fileSize?: number;
  caption?: string;
  timestamp?: string;
};

export default function WhatsAppPage() {
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv]       = useState<Conversation | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [text, setText]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [loading, setLoading]             = useState(true);
  const [socketReady, setSocketReady]     = useState(false);
  const [sendError, setSendError]         = useState<string | null>(null);
  const [isRecording, setIsRecording]     = useState(false);
  const bottomRef                         = useRef<HTMLDivElement>(null);
  const mediaRecorderRef                  = useRef<MediaRecorder | null>(null);
  const audioChunksRef                    = useRef<BlobPart[]>([]);
  const socketRef                         = useRef<Socket | null>(null);
  const activeConvRef                     = useRef<Conversation | null>(null);
  const activeSessionRef                  = useRef<Session | null>(null);

  // keep ref in sync for socket handler
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  useEffect(() => {
    void loadSessions();

    const socket = io(apiBaseUrl, { transports: ["websocket", "polling"], withCredentials: true });
    socketRef.current = socket;
    socket.on("connect",    () => setSocketReady(true));
    socket.on("disconnect", () => setSocketReady(false));

    socket.on("whatsapp:message", (msg: IncomingMsg) => {
      const conv = activeConvRef.current;
      if (conv) {
        const fromPhone = (msg.from ?? "").split("@")[0];
        const convPhone = conv.jid.includes("@") ? conv.jid.split("@")[0] : conv.jid;
        if (fromPhone === convPhone) {
          const newMsg: Message = {
            id:          msg.id ?? String(Date.now()),
            waMessageId: msg.id ?? String(Date.now()),
            fromMe:      false,
            type:        msg.type ?? "text",
            content:     msg.text,
            mediaUrl:    msg.mediaUrl,
            mimetype:    msg.mimetype,
            filename:    msg.filename,
            fileSize:    msg.fileSize,
            caption:     msg.caption,
            timestamp:   msg.timestamp ?? new Date().toISOString(),
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      }
    });

    socket.on("whatsapp:db:message", (payload: { conversation: Conversation; message: Message }) => {
      const session = activeSessionRef.current;
      if (session && payload.conversation.sessionId === session.id) {
        setConversations((prev) => upsertConversation(prev, payload.conversation));
      }

      const conv = activeConvRef.current;
      if (conv?.id === payload.conversation.id) {
        setMessages((prev) => {
          if (prev.some((message) => message.waMessageId === payload.message.waMessageId)) return prev;
          return [...prev, payload.message];
        });
      }
    });

    socket.on("whatsapp:message:update", (payload: { waMessageId: string; status: Message["status"] }) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.waMessageId === payload.waMessageId ? { ...message, status: payload.status } : message
        )
      );
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSessions() {
    setLoading(true);
    try {
      const r = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions`, { cache: "no-store" });
      const data = (await r.json()) as { sessions: Session[] };
      const list = data.sessions ?? [];
      setSessions(list);
      const connected = list.find((s) => s.connected) ?? list[0] ?? null;
      setActiveSession(connected);
      if (connected) await loadConversations(connected.id);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversations(sessionId: string) {
    try {
      const r = await fetch(`${apiBaseUrl}/api/whatsapp/conversations?sessionId=${sessionId}`, { cache: "no-store" });
      const data = (await r.json()) as { conversations: Conversation[] };
      setConversations(data.conversations ?? []);
    } catch { /* silent */ }
  }

  async function openConversation(conv: Conversation) {
    setActiveConv(conv);
    setMessages([]);
    try {
      const r = await fetch(`${apiBaseUrl}/api/whatsapp/conversations/${conv.id}/messages`, { cache: "no-store" });
      const data = (await r.json()) as { messages: Message[] };
      setMessages(data.messages ?? []);
    } catch { /* silent */ }
  }

  async function sendMessage() {
    if (!text.trim() || !activeSession || !activeConv) return;
    setSending(true);
    setSendError(null);
    const body = text.trim();
    setText("");
    const optimisticId = `opt_${Date.now()}`;
    const optimistic: Message = {
      id:          optimisticId,
      waMessageId: optimisticId,
      fromMe:      true,
      type:        "text",
      content:     body,
      status:      "pending",
      timestamp:   new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const response = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions/${activeSession.id}/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ to: activeConv.jid, type: "text", text: body }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Message non envoye");
      setMessages((prev) => prev.map((message) => message.id === optimisticId ? { ...message, status: "sent" } : message));
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setText(body);
      setSendError(error instanceof Error ? error.message : "Message non envoye");
    }
    setSending(false);
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!activeSession?.connected || !activeConv) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSendError("Enregistrement vocal non supporte par ce navigateur.");
      return;
    }

    try {
      setSendError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "";
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        void sendVoiceMessage(blob, mimeType);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setSendError("Micro indisponible. Autorise l'acces au micro puis reessaie.");
      setIsRecording(false);
    }
  }

  async function sendVoiceMessage(blob: Blob, mimetype: string) {
    if (!activeSession || !activeConv || blob.size === 0) return;
    setSending(true);
    setSendError(null);
    const mediaDataUrl = await blobToDataUrl(blob);
    const optimisticId = `voice_${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      waMessageId: optimisticId,
      fromMe: true,
      type: "audio",
      mediaUrl: mediaDataUrl,
      mimetype,
      status: "pending",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const response = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions/${activeSession.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activeConv.jid, type: "audio", mediaDataUrl, mimetype }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Vocal non envoye");
      setMessages((prev) => prev.map((message) => message.id === optimisticId ? { ...message, status: "sent" } : message));
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId));
      setSendError(error instanceof Error ? error.message : "Vocal non envoye");
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-6.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="flex h-[calc(100vh-6.5rem)] flex-col items-center justify-center gap-4 text-center">
        <MessageSquare className="h-16 w-16 text-gold/50" />
        <h2 className="text-xl font-semibold">Aucune session WhatsApp active</h2>
        <p className="max-w-sm text-sm text-muted">
          Configure et connecte une session dans les parametres pour voir tes conversations ici.
        </p>
        <Link
          href="/settings/whatsapp"
          className="inline-flex h-11 items-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black"
        >
          <Settings className="h-4 w-4" />
          Aller aux parametres WhatsApp
        </Link>
      </div>
    );
  }

  const displayName = (conv: Conversation) => conv.name ?? conv.phoneNumber ?? conv.jid;
  const initial     = (conv: Conversation) => displayName(conv).charAt(0).toUpperCase();

  return (
    <div className="h-[calc(100vh-8rem)] min-h-[620px] overflow-hidden rounded-lg border border-line bg-panel">
      <div className="grid h-full min-h-0 lg:grid-cols-[280px_minmax(0,1fr)_260px]">

        {/* Conversations list */}
        <aside className="flex min-h-0 flex-col border-r border-line">
          <div className="flex items-center justify-between border-b border-line p-4">
            <div>
              <p className="text-xs text-muted">Session</p>
              <p className="text-sm font-semibold">{activeSession.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${socketReady ? "bg-emerald-400" : "bg-amber-400"}`} />
              <button
                onClick={() => void loadConversations(activeSession.id)}
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5"
                title="Rafraichir"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="border-b border-line p-3">
            <input
              className="h-10 w-full rounded-md border border-line bg-ink px-3 text-sm outline-none focus:border-gold/70"
              placeholder="Rechercher"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted">
                <MessageSquare className="h-10 w-10 opacity-30" />
                <p>Aucune conversation.</p>
                <p className="text-xs">Les messages entrants apparaitront ici.</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {conversations.map((conv) => {
                  const isActive = conv.id === activeConv?.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => void openConversation(conv)}
                      className={`flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors ${isActive ? "bg-gold text-black" : "hover:bg-white/5"}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${isActive ? "bg-black/20 text-black" : "bg-white/10"}`}>
                        {initial(conv)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{displayName(conv)}</span>
                        <span className={`block truncate text-xs ${isActive ? "opacity-70" : "text-muted"}`}>
                          {conv.lastMessage ?? "Aucun message"}
                        </span>
                      </span>
                      {conv.unreadCount > 0 && !isActive ? (
                        <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-black">
                          {conv.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Messages zone */}
        <section className="flex min-h-0 min-w-0 flex-col">
          {!activeConv ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
              <MessageSquare className="h-16 w-16 opacity-20" />
              <p className="text-sm">Selectionne une conversation</p>
            </div>
          ) : (
            <>
              <header className="flex h-16 items-center gap-3 border-b border-line px-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold font-semibold text-black">
                  {initial(activeConv)}
                </span>
                <div>
                  <p className="font-semibold">{displayName(activeConv)}</p>
                  <p className="text-xs text-emerald-400">{activeSession.connected ? "session connectee" : "session deconnectee"}</p>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-ink p-4">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted">Aucun message dans cette conversation.</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[76%] rounded-lg px-4 py-3 ${msg.fromMe ? "bg-gold text-black" : "bg-panel"}`}>
                        <MessageContent message={msg} />
                        <p className="mt-1 text-right text-[11px] opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {msg.fromMe ? <ReadStatus status={msg.status ?? "sent"} /> : null}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <footer className="flex items-center gap-2 border-t border-line p-3">
                <button className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-white/5" aria-label="Emoji">
                  <Smile className="h-5 w-5" />
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-white/5" aria-label="Piece jointe">
                  <Paperclip className="h-5 w-5" />
                </button>
                <button
                  onClick={() => void toggleRecording()}
                  disabled={sending || !activeSession.connected}
                  className={`flex h-10 w-10 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 ${
                    isRecording ? "bg-red-500 text-white" : "hover:bg-white/5"
                  }`}
                  aria-label={isRecording ? "Arreter le vocal" : "Enregistrer un vocal"}
                  title={isRecording ? "Arreter le vocal" : "Enregistrer un vocal"}
                >
                  {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
                </button>
                <input
                  className="h-11 flex-1 rounded-md border border-line bg-ink px-4 outline-none focus:border-gold/70"
                  placeholder="Ecrire un message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={!activeSession.connected}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={sending || !text.trim() || !activeSession.connected}
                  className="flex h-11 w-11 items-center justify-center rounded-md bg-gold text-black disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Envoyer"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </footer>
              {sendError ? (
                <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                  {sendError}
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Contact info */}
        <aside className="hidden border-l border-line p-5 lg:block">
          {activeConv ? (
            <>
              <div className="text-center">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold text-2xl font-black text-black">
                  {initial(activeConv)}
                </span>
                <h2 className="mt-4 text-lg font-semibold">{activeConv.name ?? "Inconnu"}</h2>
                <p className="text-sm text-muted">{activeConv.phoneNumber ?? activeConv.jid}</p>
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <Info label="Session" value={activeSession.name} />
                <Info label="JID WhatsApp" value={activeConv.jid} />
                <Info label="Messages non lus" value={String(activeConv.unreadCount)} />
                {activeConv.lastMessageAt && (
                  <Info label="Dernier message" value={new Date(activeConv.lastMessageAt).toLocaleString("fr-FR")} />
                )}
              </div>
              <div className="mt-6">
                <Link
                  href="/settings/whatsapp"
                  className="flex items-center gap-2 rounded-md border border-line bg-ink px-3 py-2 text-xs hover:bg-white/5"
                >
                  <Settings className="h-3 w-3 text-gold" />
                  Parametres WhatsApp
                </Link>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <p className="text-xs">Selectionne une conversation pour voir les details</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MessageContent({ message }: { message: Message }) {
  if (message.type === "image") {
    return (
      <div className="space-y-2">
        {message.mediaUrl ? (
          <img src={message.mediaUrl} alt={message.caption ?? "Image WhatsApp"} className="max-h-72 rounded-md object-contain" />
        ) : (
          <MediaPlaceholder icon={ImageIcon} label="Image recue" />
        )}
        {(message.caption ?? message.content) ? <p className="text-sm leading-6">{message.caption ?? message.content}</p> : null}
      </div>
    );
  }

  if (message.type === "audio") {
    return message.mediaUrl ? (
      <div className="flex min-w-64 items-center gap-3">
        <Mic className="h-5 w-5 opacity-70" />
        <audio controls src={message.mediaUrl} className="h-10 max-w-full" />
      </div>
    ) : (
      <MediaPlaceholder icon={Mic} label="Vocal recu" />
    );
  }

  if (message.type === "video") {
    return message.mediaUrl ? (
      <div className="space-y-2">
        <video controls src={message.mediaUrl} className="max-h-72 rounded-md" />
        {(message.caption ?? message.content) ? <p className="text-sm leading-6">{message.caption ?? message.content}</p> : null}
      </div>
    ) : (
      <MediaPlaceholder icon={Video} label="Video recue" />
    );
  }

  if (message.type === "document") {
    return (
      <a
        href={message.mediaUrl}
        download={message.filename ?? "document"}
        className="flex items-center gap-3 rounded-md border border-black/10 bg-black/5 p-3 text-sm underline-offset-2 hover:underline"
      >
        <FileText className="h-5 w-5" />
        <span>{message.filename ?? message.content ?? "Document WhatsApp"}</span>
      </a>
    );
  }

  if (message.type === "text") {
    return <p className="text-sm leading-6">{message.content}</p>;
  }

  return <p className="text-sm italic opacity-70">[{message.type}] {message.content}</p>;
}

function MediaPlaceholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm italic opacity-80">
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function upsertConversation(list: Conversation[], next: Conversation) {
  const withoutCurrent = list.filter((item) => item.id !== next.id);
  return [next, ...withoutCurrent].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

function ReadStatus({ status }: { status: NonNullable<Message["status"]> }) {
  if (status === "pending") {
    return <Clock className="ml-1 inline h-3.5 w-3.5 align-[-2px] text-black/60" />;
  }
  if (status === "sent") {
    return <Check className="ml-1 inline h-3.5 w-3.5 align-[-2px] text-black/60" />;
  }
  return (
    <CheckCheck
      className={`ml-1 inline h-3.5 w-3.5 align-[-2px] ${status === "read" ? "text-sky-600" : "text-black/60"}`}
    />
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
