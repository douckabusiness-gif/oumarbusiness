"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Bot,
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  MailCheck,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  TestTube2,
  XCircle
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type EmailAccount = {
  id: string;
  name: string;
  fromName: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  isActive: boolean;
  syncMode: string;
  pollingSeconds: number;
  sentFolder: string;
  signature: string;
  signatureEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  autoReplyEnabled: boolean;
  passwordConfigured: boolean;
  passwordSource: "database" | "env" | "none";
};

type EmailSettings = {
  accounts: EmailAccount[];
  templates: string[];
  deliverability: {
    spf: string;
    dkim: string;
    dmarc: string;
    warmupLimitPerDay: number;
  };
};

type TestStatus = {
  kind: "idle" | "ok" | "error" | "loading";
  message: string;
};

const defaultAccount: EmailAccount = {
  id: "main",
  name: "Oumar Business",
  fromName: "Oumar Business",
  email: "oumarbusiness@oumarbusiness.online",
  imapHost: "mail.oumarbusiness.online",
  imapPort: 993,
  imapSecure: true,
  smtpHost: "mail.oumarbusiness.online",
  smtpPort: 465,
  smtpSecure: true,
  username: "oumarbusiness@oumarbusiness.online",
  isActive: true,
  syncMode: "idle_plus_polling",
  pollingSeconds: 30,
  sentFolder: "Sent",
  signature: "Oumar Business\nMarketing digital - Sites web - Agents IA\nWhatsApp: +225 07 57 32 56 95",
  signatureEnabled: true,
  aiSuggestionsEnabled: true,
  autoReplyEnabled: false,
  passwordConfigured: false,
  passwordSource: "none"
};

const automationRules = [
  ["aiSuggestionsEnabled", "Suggestions IA", "3 brouillons de reponse pour chaque email important"],
  ["signatureEnabled", "Signature automatique", "Signature Oumar Business ajoutee aux reponses sortantes"],
  ["autoReplyEnabled", "Reponse automatique", "Accuse reception et FAQ simples avec validation humaine au debut"]
] as const;

export default function EmailSettingsPage() {
  const [account, setAccount] = useState<EmailAccount>(defaultAccount);
  const [templates, setTemplates] = useState<string[]>([]);
  const [deliverability, setDeliverability] = useState<EmailSettings["deliverability"] | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<TestStatus>({ kind: "idle", message: "" });
  const [imapStatus, setImapStatus] = useState<TestStatus>({ kind: "idle", message: "" });
  const [smtpStatus, setSmtpStatus] = useState<TestStatus>({ kind: "idle", message: "" });

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings/email`);
        if (!response.ok) throw new Error("Impossible de charger les parametres email.");
        const data = (await response.json()) as EmailSettings;
        if (!alive) return;
        setAccount(data.accounts[0] ?? defaultAccount);
        setTemplates(data.templates ?? []);
        setDeliverability(data.deliverability ?? null);
      } catch (error) {
        if (!alive) return;
        setSaveStatus({
          kind: "error",
          message: error instanceof Error ? error.message : "Erreur chargement email."
        });
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      alive = false;
    };
  }, []);

  const passwordBadge = useMemo(() => {
    if (!account.passwordConfigured) return "Aucun mot de passe";
    return account.passwordSource === "env" ? "Mot de passe depuis ENV" : "Mot de passe sauvegarde";
  }, [account.passwordConfigured, account.passwordSource]);

  function updateAccount<K extends keyof EmailAccount>(key: K, value: EmailAccount[K]) {
    setAccount((current) => ({ ...current, [key]: value }));
    setSaveStatus({ kind: "idle", message: "" });
  }

  async function saveSettings() {
    setSaving(true);
    setSaveStatus({ kind: "loading", message: "Enregistrement..." });

    const payloadAccount: Record<string, unknown> = {
      ...account,
      password: undefined,
      clearPassword
    };

    if (passwordInput) {
      payloadAccount.password = passwordInput;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accounts: [payloadAccount],
          templates
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sauvegarde impossible.");
      const settings = data.settings as EmailSettings;
      setAccount(settings.accounts[0] ?? defaultAccount);
      setPasswordInput("");
      setClearPassword(false);
      setSaveStatus({ kind: "ok", message: "Parametres email sauvegardes." });
    } catch (error) {
      setSaveStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Sauvegarde impossible."
      });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(type: "imap" | "smtp") {
    const setStatus = type === "imap" ? setImapStatus : setSmtpStatus;
    setStatus({ kind: "loading", message: type === "imap" ? "Test IMAP..." : "Test SMTP..." });

    try {
      const response = await fetch(`${apiBaseUrl}/api/settings/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, type })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Test impossible.");
      setStatus({ kind: "ok", message: data.message ?? (type === "imap" ? "Connexion entrante OK" : "Envoi SMTP OK") });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Test impossible."
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Parametres email</p>
          <h1 className="mt-2 text-3xl font-bold">Email domaine LWS</h1>
          <p className="mt-2 text-sm text-muted">IMAP/SMTP direct sur mail.oumarbusiness.online, sans dependance Gmail.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => testConnection("imap")}
            disabled={loading || imapStatus.kind === "loading"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TestTube2 className="h-4 w-4" />
            Tester IMAP
          </button>
          <button
            onClick={() => testConnection("smtp")}
            disabled={loading || smtpStatus.kind === "loading"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Tester SMTP
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </div>

      <StatusLine status={saveStatus} />
      <div className="grid gap-3 xl:grid-cols-2">
        <StatusLine title="IMAP" status={imapStatus} />
        <StatusLine title="SMTP" status={smtpStatus} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="h-7 w-7 text-gold" />
              <div>
                <h2 className="font-semibold">Compte principal LWS</h2>
                <p className="text-sm text-muted">Identifiants IMAP entrant et SMTP sortant</p>
              </div>
            </div>
            <Status label={account.isActive ? "Actif" : "Inactif"} tone={account.isActive ? "ok" : "warn"} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Nom du compte" value={account.name} onChange={(value) => updateAccount("name", value)} />
            <Field label="Nom expediteur" value={account.fromName} onChange={(value) => updateAccount("fromName", value)} />
            <Field label="Adresse email" value={account.email} onChange={(value) => updateAccount("email", value)} />
            <Field label="Username" value={account.username} onChange={(value) => updateAccount("username", value)} />
            <Field label="IMAP host" value={account.imapHost} onChange={(value) => updateAccount("imapHost", value)} />
            <Field label="IMAP port" value={String(account.imapPort)} onChange={(value) => updateAccount("imapPort", Number(value))} />
            <Field label="SMTP host" value={account.smtpHost} onChange={(value) => updateAccount("smtpHost", value)} />
            <Field label="SMTP port" value={String(account.smtpPort)} onChange={(value) => updateAccount("smtpPort", Number(value))} />
            <Field label="Dossier envoyes" value={account.sentFolder} onChange={(value) => updateAccount("sentFolder", value)} />
            <Field label="Polling secondes" value={String(account.pollingSeconds)} onChange={(value) => updateAccount("pollingSeconds", Number(value))} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Toggle label="IMAP SSL/TLS" checked={account.imapSecure} onChange={(value) => updateAccount("imapSecure", value)} />
            <Toggle label="SMTP SSL/TLS" checked={account.smtpSecure} onChange={(value) => updateAccount("smtpSecure", value)} />
            <Toggle label="Compte actif" checked={account.isActive} onChange={(value) => updateAccount("isActive", value)} />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-ink p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4 text-gold" />
                Mot de passe email
              </p>
              <Status label={passwordBadge} tone={account.passwordConfigured ? "ok" : "warn"} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => {
                  setPasswordInput(event.target.value);
                  setClearPassword(false);
                }}
                placeholder={
                  account.passwordConfigured
                    ? "Mot de passe configure - entrer un nouveau pour remplacer"
                    : "Mot de passe du compte LWS"
                }
                className="h-11 rounded-md border border-line bg-black px-3 outline-none focus:border-gold/70"
              />
              <button
                onClick={() => {
                  setPasswordInput("");
                  setClearPassword(false);
                }}
                className="rounded-md border border-line px-4 text-sm font-semibold"
              >
                Remplacer
              </button>
              <button
                onClick={() => {
                  setPasswordInput("");
                  setClearPassword(true);
                }}
                className="rounded-md border border-red-900/70 px-4 text-sm font-semibold text-red-200"
              >
                Supprimer
              </button>
            </div>
            {clearPassword ? <p className="mt-3 text-sm text-red-200">La suppression sera appliquee au prochain enregistrement.</p> : null}
            <p className="mt-3 text-sm text-muted">Le mot de passe est chiffre cote API et n'est jamais renvoye en clair.</p>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Agent Email</h2>
          </div>

          <div className="mt-5 space-y-3">
            {automationRules.map(([key, name, description]) => (
              <label key={key} className="block rounded-md border border-line bg-ink p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{name}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(account[key])}
                    onChange={(event) => updateAccount(key, event.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </label>
            ))}
          </div>

          <label className="mt-5 grid gap-2 text-sm">
            <span className="text-zinc-300">Signature par defaut</span>
            <textarea
              value={account.signature}
              onChange={(event) => updateAccount("signature", event.target.value)}
              className="min-h-28 resize-y rounded-md border border-line bg-ink p-3 outline-none focus:border-gold/70"
            />
          </label>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Delivrabilite domaine</h2>
          </div>

          <div className="mt-5 grid gap-3">
            <ChecklistItem title="SPF" text={deliverability?.spf ?? "Autoriser le serveur LWS dans le DNS SPF."} />
            <ChecklistItem title="DKIM" text={deliverability?.dkim ?? "Activer DKIM dans le panel LWS."} />
            <ChecklistItem title="DMARC" text={deliverability?.dmarc ?? "Publier une politique DMARC de monitoring."} />
            <ChecklistItem
              title="Warm-up"
              text={`Limiter les automatismes au debut: ${deliverability?.warmupLimitPerDay ?? 50} emails/jour maximum.`}
            />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Templates</h2>
          </div>

          <div className="mt-5 grid gap-3">
            {(templates.length ? templates : ["Accuse reception devis", "Relance douce J+3", "Validation livrable"]).map((template) => (
              <div key={template} className="flex items-center justify-between rounded-md border border-line bg-ink p-3 text-sm">
                <span>{template}</span>
                <button className="rounded-md border border-line px-3 py-1 text-xs">Editer</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-line bg-panel p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={<MailCheck className="h-5 w-5" />} label="Sync" value="IMAP IDLE" />
          <Metric icon={<Clock className="h-5 w-5" />} label="Polling" value={`${account.pollingSeconds}s`} />
          <Metric icon={<Send className="h-5 w-5" />} label="Envoi" value={account.smtpPort === 465 ? "SMTP SSL" : "SMTP STARTTLS"} />
          <Metric icon={<Archive className="h-5 w-5" />} label="Copies" value={account.sentFolder} />
        </div>
      </section>
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink px-3 py-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-gold" />
    </label>
  );
}

function Status({ label, tone = "warn" }: { label: string; tone?: "ok" | "warn" }) {
  return (
    <span className={tone === "ok" ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200" : "rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300"}>
      {label}
    </span>
  );
}

function StatusLine({ title, status }: { title?: string; status: TestStatus }) {
  if (status.kind === "idle" || !status.message) return null;

  const isOk = status.kind === "ok";
  const isLoading = status.kind === "loading";
  return (
    <div
      className={
        isOk
          ? "flex items-center gap-2 rounded-md border border-emerald-900/70 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
          : isLoading
            ? "flex items-center gap-2 rounded-md border border-line bg-panel px-4 py-3 text-sm text-zinc-200"
            : "flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-100"
      }
    >
      {isOk ? <CheckCircle2 className="h-4 w-4" /> : isLoading ? <TestTube2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span>{title ? `${title}: ` : ""}{status.message}</span>
    </div>
  );
}

function ChecklistItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <p className="font-semibold text-gold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-4">
      <span className="text-gold">{icon}</span>
      <p className="mt-3 text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
