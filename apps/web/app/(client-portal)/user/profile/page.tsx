"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  LockKeyhole,
  Loader2,
  Save,
  UserRound
} from "lucide-react";
import { SaasPortalShell } from "@/components/saas/SaasPortalShell";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type Tab = "infos" | "entreprise" | "securite";

const TABS: { key: Tab; label: string; icon: typeof UserRound }[] = [
  { key: "infos", label: "Informations", icon: UserRound },
  { key: "entreprise", label: "Entreprise", icon: Building2 },
  { key: "securite", label: "Securite", icon: LockKeyhole }
];

type UserData = { id: string; name: string; email: string; role: string };
type CompanyData = {
  id: string; name: string; ownerEmail: string;
  description?: string; businessEmail?: string; businessPhone?: string; industry?: string;
};

export default function UserProfilePage() {
  const [tab, setTab] = useState<Tab>("infos");
  const [user, setUser] = useState<UserData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/sourcing/auth/me`, { cache: "no-store", credentials: "include" });
        const data = (await res.json()) as { user?: UserData; company?: CompanyData };
        if (active) { setUser(data.user ?? null); setCompany(data.company ?? null); }
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <SaasPortalShell title="Mon profil" subtitle="">
        <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-line bg-panel">
          <Loader2 className="h-7 w-7 animate-spin text-gold" />
        </div>
      </SaasPortalShell>
    );
  }

  return (
    <SaasPortalShell title="Mon profil" subtitle="Gere tes informations personnelles et la securite de ton compte.">
      <div className="space-y-5">
        {/* Avatar + infos rapides */}
        <div className="flex items-center gap-5 rounded-3xl border border-line bg-panel p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-2xl font-black text-gold">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-xl font-black text-zinc-100">{user?.name ?? "—"}</p>
            <p className="text-sm text-zinc-500">{user?.email ?? "—"}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold capitalize">
              {user?.role ?? "user"}
            </span>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 rounded-2xl border border-line bg-ink p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  tab === t.key ? "bg-gold text-black" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        {tab === "infos" && user && <InfosTab user={user} onUpdate={(u) => setUser(u)} />}
        {tab === "entreprise" && company && <EntrepriseTab company={company} onUpdate={(c) => setCompany(c)} />}
        {tab === "securite" && <SecuriteTab />}
      </div>
    </SaasPortalShell>
  );
}

// ─── Onglet Informations ──────────────────────────────────────────────────

function InfosTab({ user, onUpdate }: { user: UserData; onUpdate: (u: UserData) => void }) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (name.trim().length < 2) { setError("Le nom doit contenir au moins 2 caracteres."); return; }
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() })
      });
      const data = (await res.json()) as { ok?: boolean; user?: UserData; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur.");
      if (data.user) onUpdate(data.user);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-panel p-6">
      <h2 className="font-bold text-zinc-100">Informations personnelles</h2>
      <p className="mt-1 text-sm text-zinc-500">Modifie ton nom d'affichage.</p>

      <div className="mt-6 max-w-md space-y-4">
        <ProfileField label="Nom complet" value={name} onChange={setName} icon={UserRound} />
        <ProfileField label="Email" value={user.email} onChange={() => {}} icon={UserRound} disabled
          hint="L'email ne peut pas etre modifie pour l'instant." />
      </div>

      {error && <AlertBox type="error" message={error} />}
      {success && <AlertBox type="success" message="Informations mises a jour avec succes." />}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || name.trim() === user.name}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-black shadow-lg shadow-gold/20 hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Sauvegarder
      </button>
    </div>
  );
}

// ─── Onglet Entreprise ────────────────────────────────────────────────────

function EntrepriseTab({ company, onUpdate }: { company: CompanyData; onUpdate: (c: CompanyData) => void }) {
  const [name, setName] = useState(company.name);
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [phone, setPhone] = useState(company.businessPhone ?? "");
  const [description, setDescription] = useState(company.description ?? "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/company`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), industry: industry.trim(), businessPhone: phone.trim(), description: description.trim() })
      });
      const data = (await res.json()) as { ok?: boolean; company?: CompanyData; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur.");
      if (data.company) onUpdate(data.company);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-panel p-6">
      <h2 className="font-bold text-zinc-100">Informations de l'entreprise</h2>
      <p className="mt-1 text-sm text-zinc-500">Ces informations apparaissent dans tes exports et rapports.</p>

      <div className="mt-6 max-w-md space-y-4">
        <ProfileField label="Nom de l'entreprise" value={name} onChange={setName} icon={Building2} />
        <ProfileField label="Secteur d'activite" value={industry} onChange={setIndustry} icon={Building2} placeholder="Ex: Tech, Commerce, Sante..." />
        <ProfileField label="Telephone" value={phone} onChange={setPhone} icon={Building2} placeholder="Ex: +221 77 000 00 00" />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Decris ton activite en quelques mots..."
            className="mt-1.5 w-full resize-none rounded-xl border border-line bg-ink px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-gold/60 focus:outline-none"
          />
        </div>
      </div>

      {error && <AlertBox type="error" message={error} />}
      {success && <AlertBox type="success" message="Informations entreprise mises a jour." />}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-black shadow-lg shadow-gold/20 hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Sauvegarder
      </button>
    </div>
  );
}

// ─── Onglet Securite ──────────────────────────────────────────────────────

function SecuriteTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (next.length < 6) { setError("Le nouveau mot de passe doit contenir au moins 6 caracteres."); return; }
    if (next !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/auth/change-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: next })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur.");
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-panel p-6">
      <h2 className="font-bold text-zinc-100">Changer le mot de passe</h2>
      <p className="mt-1 text-sm text-zinc-500">Utilise un mot de passe fort d'au moins 6 caracteres.</p>

      <div className="mt-6 max-w-md space-y-4">
        <ProfileField label="Mot de passe actuel" value={current} onChange={setCurrent} type="password" icon={LockKeyhole} />
        <ProfileField label="Nouveau mot de passe" value={next} onChange={setNext} type="password" icon={LockKeyhole} placeholder="Minimum 6 caracteres" />
        <ProfileField label="Confirmer le nouveau mot de passe" value={confirm} onChange={setConfirm} type="password" icon={LockKeyhole} />
      </div>

      {error && <AlertBox type="error" message={error} />}
      {success && <AlertBox type="success" message="Mot de passe modifie avec succes !" />}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !current || !next || !confirm}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-bold text-black shadow-lg shadow-gold/20 hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Modifier le mot de passe
      </button>
    </div>
  );
}

// ─── Composants utilitaires ───────────────────────────────────────────────

function ProfileField({
  label, value, onChange, type = "text", icon: Icon, placeholder, disabled, hint
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; icon: typeof UserRound; placeholder?: string; disabled?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</label>
      <div className={`mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-line px-4 transition ${
        disabled ? "bg-zinc-900/50 opacity-60" : "bg-ink focus-within:border-gold/60"
      }`}>
        <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-full flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}

function AlertBox({ type, message }: { type: "error" | "success"; message: string }) {
  return (
    <div className={`mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
      type === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : "border-red-500/30 bg-red-500/10 text-red-200"
    }`}>
      {type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {message}
    </div>
  );
}
