"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  CheckCircle2,
  Cloud,
  Database,
  Loader2,
  LogOut,
  QrCode,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wifi
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

const webhookEvents = [
  "messages",
  "message_template_status_update",
  "account_update",
  "phone_number_name_update",
  "security"
];

type BaileysSession = {
  id: string;
  name: string;
  phoneNumber?: string;
  status: string;
  connected: boolean;
  createdAt: string;
};

type StoredWhatsAppSettings = {
  cloud?: {
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
    verifyToken?: string;
  };
  baileys?: {
    defaultSessionName?: string;
    phoneNumber?: string;
  };
};

export default function WhatsAppSettingsPage() {
  // Cloud API (Meta)
  const [phoneNumberId, setPhoneNumberId]           = useState("");
  const [businessAccountId, setBusinessAccountId]   = useState("");
  const [accessToken, setAccessToken]               = useState("");
  const [verifyToken, setVerifyToken]               = useState("");

  // Baileys
  const [sessionName, setSessionName]   = useState("Oumar personnel");
  const [phoneNumber, setPhoneNumber]   = useState("+225 XX XX XX XX");
  const [sessions, setSessions]         = useState<BaileysSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl]       = useState<string | null>(null);
  const [baileysStatus, setBaileysStatus] = useState("QR requis");
  const [socketReady, setSocketReady]   = useState(false);
  const [isStarting, setIsStarting]     = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Save
  const [isSaving, setIsSaving] = useState(false);
  const [saveOk, setSaveOk]     = useState(false);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  // Load current settings on mount
  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const [settingsRes, brandingRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/settings/whatsapp`, { cache: "no-store" }),
          fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" })
        ]);
        if (!settingsRes.ok || !active) return;

        const settings = (await settingsRes.json()) as StoredWhatsAppSettings;
        const branding = brandingRes.ok ? ((await brandingRes.json()) as { phone?: string }) : {};

        if (!active) return;

        setPhoneNumberId(settings.cloud?.phoneNumberId ?? "");
        setBusinessAccountId(settings.cloud?.businessAccountId ?? "");
        setAccessToken(settings.cloud?.accessToken ?? "");
        setVerifyToken(settings.cloud?.verifyToken ?? "");
        setSessionName(settings.baileys?.defaultSessionName ?? "Oumar personnel");
        setPhoneNumber(settings.baileys?.phoneNumber ?? branding.phone ?? "");
      } catch {
        // Keep form usable even if settings are unavailable.
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  // Socket.io + initial session fetch
  useEffect(() => {
    let socket: Socket | undefined;

    fetchSessions();

    socket = io(apiBaseUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true
    });

    socket.on("connect",    () => setSocketReady(true));
    socket.on("disconnect", () => setSocketReady(false));

    socket.on("whatsapp:baileys:qr", (payload: { sessionId: string; qrDataUrl?: string }) => {
      setActiveSessionId(payload.sessionId);
      setBaileysStatus("QR pret a scanner");
      setError(null);
      if (payload.qrDataUrl) setQrDataUrl(payload.qrDataUrl);
      void fetchSessions();
    });

    socket.on("whatsapp:baileys:connected", (payload: { sessionId: string; phoneNumber?: string }) => {
      setActiveSessionId(payload.sessionId);
      setBaileysStatus("Connecte");
      setQrDataUrl(null);
      if (payload.phoneNumber) setPhoneNumber(payload.phoneNumber);
      void fetchSessions();
    });

    socket.on("whatsapp:baileys:disconnected", (payload: { shouldReconnect?: boolean }) => {
      setBaileysStatus(payload.shouldReconnect ? "Reconnexion..." : "Deconnecte");
      void fetchSessions();
    });

    return () => {
      socket?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeSession?.id) return;
    if (activeSession.connected) {
      setBaileysStatus("Connecte");
      setQrDataUrl(null);
      return;
    }

    const sessionId = activeSession.id;
    const fallbackStatus = activeSession.status;
    let active = true;

    async function loadQr() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions/${sessionId}/qr`, {
          cache: "no-store"
        });
        if (!response.ok || !active) return;

        const data = (await response.json()) as {
          status?: string;
          connected?: boolean;
          qrDataUrl?: string;
        };

        if (!active) return;

        if (data.connected) {
          setBaileysStatus("Connecte");
          setQrDataUrl(null);
          void fetchSessions();
          return;
        }

        setBaileysStatus(humanizeSessionStatus(data.status ?? fallbackStatus));
        setQrDataUrl(data.qrDataUrl ?? null);
      } catch {
        // Keep last QR/status displayed if polling fails once.
      }
    }

    void loadQr();
    const interval = window.setInterval(() => {
      void loadQr();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeSession?.connected, activeSession?.id, activeSession?.status]);

  async function fetchSessions() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { sessions: BaileysSession[] };
      const nextSessions = data.sessions ?? [];
      setSessions(nextSessions);
      const current = nextSessions.find((session) => session.id === activeSessionId) ?? nextSessions[0];
      if (current) {
        setActiveSessionId(current.id);
        setBaileysStatus(current.connected ? "Connecte" : humanizeSessionStatus(current.status));
        if (current.connected) {
          setQrDataUrl(null);
        }
      }
    } catch {
      setError("Impossible de charger les sessions Baileys.");
    }
  }

  async function saveSettings() {
    setIsSaving(true);
    setSaveOk(false);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/whatsapp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloud: {
            phoneNumberId,
            businessAccountId,
            accessToken: accessToken || undefined,
            verifyToken: verifyToken || undefined,
          },
          baileys: {
            defaultSessionName: sessionName,
            phoneNumber,
          },
        }),
      });
      const brandingResponse = await fetch(`${apiBaseUrl}/api/settings/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber.trim()
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Erreur sauvegarde");
      if (!brandingResponse.ok) {
        throw new Error("Le numero WhatsApp public n'a pas pu etre enregistre.");
      }
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur sauvegarde");
    } finally {
      setIsSaving(false);
    }
  }

  async function startSession() {
    if (activeSession?.id && !activeSession.connected) {
      await reconnectSession();
      return;
    }

    setIsStarting(true);
    setError(null);
    setQrDataUrl(null);
    setBaileysStatus("Generation du QR...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sessionName, phoneNumber })
      });
      const data = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Erreur generation QR");
      if (data.sessionId) setActiveSessionId(data.sessionId);
      await fetchSessions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur generation QR");
      setBaileysStatus("Erreur QR");
    } finally {
      setIsStarting(false);
    }
  }

  async function disconnectSession() {
    if (!activeSession?.id) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions/${activeSession.id}`, { method: "DELETE" });
      setBaileysStatus("Deconnecte");
      setQrDataUrl(null);
      await fetchSessions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur deconnexion");
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function reconnectSession() {
    if (!activeSession?.id) return startSession();
    setIsStarting(true);
    setError(null);
    setQrDataUrl(null);
    setBaileysStatus("Reconnexion...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/whatsapp/baileys/sessions/${activeSession.id}/reconnect`, {
        method: "POST"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Erreur reconnexion");
      await fetchSessions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur reconnexion");
      setBaileysStatus("Erreur QR");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Parametres WhatsApp</p>
          <h1 className="mt-2 text-3xl font-bold">Cloud API Meta et Baileys</h1>
        </div>
        <div className="flex items-center gap-3">
          {saveOk && (
            <span className="flex items-center gap-1 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Enregistre !
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Cloud API */}
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-6 w-6 text-gold" />
              <div>
                <h2 className="font-semibold">WhatsApp Cloud API</h2>
                <p className="text-sm text-muted">Numero professionnel Meta</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">Pret</span>
          </div>

          <div className="mt-6 grid gap-4">
            <ControlledField label="Phone Number ID"       value={phoneNumberId}     onChange={setPhoneNumberId}     placeholder="123456789" />
            <ControlledField label="Business Account ID"  value={businessAccountId} onChange={setBusinessAccountId} placeholder="987654321" />
            <ControlledField label="Access Token"         value={accessToken}       onChange={setAccessToken}       placeholder="EAA..." type="password" />
            <ControlledField label="Webhook Verify Token" value={verifyToken}       onChange={setVerifyToken}       placeholder="random-secret-string" />
            <Field           label="Webhook URL"          value={`${apiBaseUrl}/api/whatsapp/cloud/webhook`} readOnly />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-ink p-4">
            <p className="text-sm font-semibold">Evenements webhook</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {webhookEvents.map((event) => (
                <label key={event} className="flex items-center gap-3 rounded-md border border-line p-3 text-sm">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" />
                  {event}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Baileys */}
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-gold" />
              <div>
                <h2 className="font-semibold">WhatsApp Baileys</h2>
                <p className="text-sm text-muted">Numero personnel via QR code</p>
              </div>
            </div>
            <span className={statusBadgeClass(baileysStatus)}>{baileysStatus}</span>
          </div>

          <div className="mt-6 grid gap-4">
            <ControlledField label="Nom de session" value={sessionName} onChange={setSessionName} />
            <ControlledField label="Numero WhatsApp public" value={phoneNumber} onChange={setPhoneNumber} placeholder="+2250700000000" />
            <div className="-mt-1 text-xs text-muted">
              Ce numero alimente aussi le bouton WhatsApp visible sur la page d&apos;accueil.
            </div>
            <Field label="Cle de chiffrement session" placeholder="32 bytes hex" type="password" />
            <Field label="Limite diffusion par jour"  defaultValue="200" />
            <Field label="Delai entre messages"       defaultValue="1-3 secondes" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-gold/50 bg-white p-4 text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR code WhatsApp Baileys"
                  className="h-48 w-48 rounded-md object-contain"
                />
              ) : activeSession?.connected ? (
                <div className="flex flex-col items-center gap-3 text-black">
                  <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                  <p className="text-sm font-semibold">WhatsApp connecte</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-900">
                  <QrCode className="h-16 w-16 text-gold" />
                  <p className="text-sm font-semibold">Clique sur Generer QR</p>
                  <p className="text-xs text-zinc-500">Le vrai QR scannable apparait ici.</p>
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startSession}
                  disabled={isStarting || isDisconnecting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Generer QR
                </button>
                <button
                  onClick={reconnectSession}
                  disabled={isStarting || isDisconnecting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-ink px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reconnecter
                </button>
                {activeSession?.id && (
                  <button
                    onClick={() => void disconnectSession()}
                    disabled={isStarting || isDisconnecting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 text-sm font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Supprimer session
                  </button>
                )}
              </div>

              {error ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <Status icon={Wifi}        label="Socket dashboard" value={socketReady ? "Connecte en temps reel" : "Connexion..."} />
              <Status icon={Database}    label="Stockage session" value="Volume Docker persistant" />
              <Status icon={Radio}       label="Session active"   value={activeSession?.id ? `${activeSession.name} - ${activeSession.status}` : "Aucune session"} />
              <Status icon={ShieldCheck} label="Anti-ban"         value="Rate limit diffusion actif" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status.toLowerCase().includes("connect")) {
    return "rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300";
  }
  if (status.toLowerCase().includes("erreur")) {
    return "rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-300";
  }
  return "rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300";
}

function humanizeSessionStatus(status: string) {
  switch (status) {
    case "open":
    case "connected":
      return "Connecte";
    case "connecting":
      return "Generation du QR...";
    case "qr_pending":
      return "QR pret a scanner";
    case "reconnecting":
      return "Reconnexion...";
    case "disconnected":
      return "Deconnecte";
    default:
      return status || "QR requis";
  }
}

function Field({
  label,
  placeholder,
  defaultValue,
  value,
  type = "text",
  readOnly = false
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        readOnly={readOnly}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function ControlledField({
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
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function Status({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-ink p-3 text-sm">
      <Icon className="h-4 w-4 text-gold" />
      <span>
        <span className="block text-muted">{label}</span>
        <span className="block font-medium">{value}</span>
      </span>
    </div>
  );
}
