"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, Send, Smartphone } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type NotificationSettingsPayload = {
  enabled: boolean;
  vapidPublicKey: string;
  contactEmail: string;
  subscriptionCount: number;
  lastTestAt: string | null;
};

type NotificationHistoryEntry = {
  id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  source: string;
  status: "sent" | "failed" | "skipped";
  reason: string;
  sentCount: number;
  removedCount: number;
  createdAt: string;
};

type PermissionStateValue = "default" | "granted" | "denied" | "unsupported" | "unknown";

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [permissionState, setPermissionState] = useState<PermissionStateValue>("unknown");
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [title, setTitle] = useState("Test Oumar Business");
  const [body, setBody] = useState("Nouvelle notification push depuis ton agence autonome.");

  const supported = useMemo(() => {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPermissionState(supported ? Notification.permission : "unsupported");
    }
    void loadSettings();
    void loadHistory();
    void detectCurrentSubscription();
  }, [supported]);

  async function loadSettings() {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/settings/notifications`, { cache: "no-store" });
      const data = (await response.json()) as { settings?: NotificationSettingsPayload; error?: string };
      if (!response.ok || !data.settings) {
        throw new Error(data.error ?? "Chargement notifications impossible.");
      }
      setSettings(data.settings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement notifications impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function detectCurrentSubscription() {
    if (!supported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setEndpoint(subscription?.endpoint ?? "");
    } catch {
      // silent; status cards remain usable
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/notifications/history?limit=24`, { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; entries?: NotificationHistoryEntry[] };
      if (response.ok && Array.isArray(data.entries)) {
        setHistory(data.entries);
      }
    } catch {
      // keep page usable
    }
  }

  async function enableNotifications() {
    if (!supported || !settings) return;
    try {
      setWorking(true);
      setError("");
      setSuccess("");

      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      if (permission !== "granted") {
        throw new Error("Permission notification refusee par le navigateur.");
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(settings.vapidPublicKey)
        });
      }

      const response = await fetch(`${apiBaseUrl}/api/settings/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          label: "Appareil principal"
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; subscriptionCount?: number };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Abonnement push impossible.");
      }

      setEndpoint(subscription.endpoint);
      setSettings((current) => current ? { ...current, subscriptionCount: data.subscriptionCount ?? current.subscriptionCount } : current);
      setSuccess("Notifications push activees sur cet appareil.");
    } catch (subscribeError) {
      setError(subscribeError instanceof Error ? subscribeError.message : "Activation push impossible.");
    } finally {
      setWorking(false);
    }
  }

  async function disableNotifications() {
    if (!supported || !endpoint) return;
    try {
      setWorking(true);
      setError("");
      setSuccess("");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      const response = await fetch(`${apiBaseUrl}/api/settings/notifications/subscribe`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; subscriptionCount?: number };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Desabonnement push impossible.");
      }

      setEndpoint("");
      setSettings((current) => current ? { ...current, subscriptionCount: data.subscriptionCount ?? current.subscriptionCount } : current);
      setSuccess("Notifications push retirees de cet appareil.");
    } catch (unsubscribeError) {
      setError(unsubscribeError instanceof Error ? unsubscribeError.message : "Desabonnement push impossible.");
    } finally {
      setWorking(false);
    }
  }

  async function sendTestNotification() {
    if (!endpoint) {
      setError("Active d'abord les notifications sur cet appareil.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      setSuccess("");
      const response = await fetch(`${apiBaseUrl}/api/settings/notifications/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          title,
          body,
          url: "/overview"
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; sentCount?: number; settings?: NotificationSettingsPayload };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Test push impossible.");
      }

      if (data.settings) {
        setSettings(data.settings);
      }
      await loadHistory();
      setSuccess(`Notification test envoyee. Appareils touches: ${data.sentCount ?? 0}.`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Test push impossible.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Parametres systeme</p>
        <h1 className="mt-2 text-3xl font-bold">Notifications push PWA</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          Active les notifications sur ton appareil, puis envoie un test pour verifier toute la chaine PWA.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Navigateur" value={supported ? "Compatible" : "Non compatible"} />
        <StatusCard label="Permission" value={formatPermission(permissionState)} />
        <StatusCard label="Cet appareil" value={endpoint ? "Abonne" : "Non abonne"} />
        <StatusCard label="Appareils actifs" value={loading ? "..." : String(settings?.subscriptionCount ?? 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Activer sur cet appareil</h2>
              <p className="text-sm text-muted">Telephone, bureau ou navigateur courant.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <InfoRow label="Email contact push" value={settings?.contactEmail ?? "..."} />
            <InfoRow label="Dernier test" value={settings?.lastTestAt ? formatDate(settings.lastTestAt) : "Aucun test"} />
            <InfoRow label="Endpoint courant" value={endpoint ? "Enregistre" : "Aucun"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void enableNotifications()}
              disabled={!supported || working}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Activer ici
            </button>
            <button
              type="button"
              onClick={() => void disableNotifications()}
              disabled={!endpoint || working}
              className="rounded-xl border border-line bg-ink px-4 py-3 text-sm font-semibold text-zinc-100 disabled:opacity-60"
            >
              Retirer cet appareil
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">Envoyer une notification test</h2>
          <div className="mt-4 grid gap-4">
            <Field label="Titre" value={title} onChange={setTitle} />
            <TextAreaField label="Message" value={body} onChange={setBody} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void sendTestNotification()}
                disabled={!endpoint || working}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer un test
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle("Nouveau lead marketplace");
                  setBody("Un nouveau prospect vient de demander une application sur ton marketplace.");
                }}
                className="rounded-xl border border-line bg-ink px-4 py-3 text-sm font-semibold text-zinc-100"
              >
                Scenario lead
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle("Paiement confirme");
                  setBody("Une facture Wave ou Orange Money vient d'etre confirmee.");
                }}
                className="rounded-xl border border-line bg-ink px-4 py-3 text-sm font-semibold text-zinc-100"
              >
                Scenario paiement
              </button>
            </div>
            <p className="text-xs text-muted">
              Le test vise d'abord cet appareil. Les evenements reels sont aussi branches pour WhatsApp, marketplace, paiements, escalades IA, emails entrants et projets en retard.
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Journal des notifications</h2>
            <p className="text-sm text-muted">Les derniers envois reels, les echecs et les notifications ignorees.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-xl border border-line bg-ink px-4 py-2 text-sm font-semibold text-zinc-100"
          >
            Rafraichir
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-ink/60 p-4 text-sm text-muted">
              Aucun evenement push journalise pour le moment.
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-line bg-ink p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{entry.title}</span>
                  <StatusBadge status={entry.status} />
                  <span className="rounded-full border border-line px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                    {formatSource(entry.source)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">{entry.body}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                  <span>{formatDate(entry.createdAt)}</span>
                  <span>raison: {entry.reason}</span>
                  <span>envoyes: {entry.sentCount}</span>
                  {entry.removedCount > 0 ? <span>abonnes supprimes: {entry.removedCount}</span> : null}
                  {entry.url ? <span>cible: {entry.url}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-line bg-ink px-3 text-zinc-100 outline-none"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 rounded-md border border-line bg-ink p-3 text-zinc-100 outline-none"
      />
    </label>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: NotificationHistoryEntry["status"] }) {
  const palette =
    status === "sent"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : status === "failed"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : "border-amber-500/30 bg-amber-500/10 text-amber-200";

  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${palette}`}>{formatStatus(status)}</span>;
}

function formatPermission(value: PermissionStateValue) {
  if (value === "granted") return "Autorisee";
  if (value === "denied") return "Refusee";
  if (value === "default") return "A demander";
  if (value === "unsupported") return "Non supporte";
  return "Chargement";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}

function formatStatus(value: NotificationHistoryEntry["status"]) {
  if (value === "sent") return "Envoyee";
  if (value === "failed") return "Echec";
  return "Ignoree";
}

function formatSource(value: string) {
  const map: Record<string, string> = {
    system: "Systeme",
    whatsapp: "WhatsApp",
    marketplace: "Marketplace",
    billing: "Facturation",
    escalation: "Escalade IA",
    email_incoming: "Email entrant",
    project_delay: "Projet"
  };

  return map[value] ?? value;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
