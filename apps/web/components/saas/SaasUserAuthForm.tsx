"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  Loader2,
  Mail,
  Radar,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

const FEATURES = [
  { icon: Search, text: "Recherche Serper & Tavily pour trouver tes prospects" },
  { icon: Target, text: "Scoring et qualification automatique de chaque contact" },
  { icon: Radar, text: "Historique complet de tous tes runs de sourcing" }
];

const STATS = [
  { value: "2", label: "Agents IA" },
  { value: "∞", label: "Prospects" },
  { value: "100%", label: "Automatise" }
];

type Props = { mode: "login" | "register" };

export function SaasUserAuthForm({ mode }: Props) {
  const router = useRouter();
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<{ agencyName?: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { agencyName?: string; logoUrl?: string }) => {
        if (mounted) setBranding(d);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, company, email, password })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Action impossible.");
      router.push("/user/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setLoading(false);
    }
  }

  const agencyName = branding?.agencyName ?? "Oumar Business";
  const logoUrl = resolveLogo(branding?.logoUrl ?? "");

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-white">
      {/* Arriere-plan decoratif */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(#d4a020 1px, transparent 1px), linear-gradient(90deg, #d4a020 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={agencyName} className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-lg font-black text-gold">{agencyName}</span>
          )}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Accueil
        </Link>
      </header>

      {/* Contenu principal */}
      <main className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16 lg:py-12">

        {/* Colonne gauche — argumentaire */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold">
            <Radar className="h-3.5 w-3.5" />
            Espace Sourcing
          </div>

          <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl">
            {isLogin ? (
              <>
                Retrouve tes{" "}
                <span className="bg-gradient-to-r from-gold to-amber-400 bg-clip-text text-transparent">
                  prospects
                </span>{" "}
                et tes runs
              </>
            ) : (
              <>
                Lance ton sourcing{" "}
                <span className="bg-gradient-to-r from-gold to-amber-400 bg-clip-text text-transparent">
                  commercial
                </span>
              </>
            )}
          </h1>

          <p className="mt-5 max-w-md text-base leading-7 text-zinc-400">
            {isLogin
              ? "Connecte-toi pour acceder a ton espace — historique complet, prospects qualifies et agents IA prets a l'emploi."
              : "Cree ton compte en 30 secondes. Tes agents Serper et Tavily trouveront tes prospects automatiquement."}
          </p>

          <div className="mt-8 space-y-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.text}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                    <Icon className="h-4 w-4 text-gold" />
                  </div>
                  <p className="text-sm text-zinc-200">{f.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-panel p-4 text-center">
                <p className="text-2xl font-black text-gold">{s.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" />
              Session securisee
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
              <LockKeyhole className="h-3.5 w-3.5 text-gold" />
              Donnees privees
            </span>
          </div>
        </motion.div>

        {/* Colonne droite — formulaire */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {/* Halo doré sur la carte */}
            <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />

            <div className="relative p-7 sm:p-8">
              {/* Titre de la carte */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                  <Zap className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gold">
                    {isLogin ? "Connexion" : "Inscription"}
                  </p>
                  <h2 className="text-lg font-black leading-tight">
                    {isLogin ? "Accede a ton espace" : "Ouvre ton espace"}
                  </h2>
                </div>
              </div>

              {/* Champs */}
              <div className="mt-6 space-y-4">
                {!isLogin && (
                  <>
                    <AuthField
                      label="Nom complet"
                      value={name}
                      onChange={setName}
                      placeholder="Ton nom complet"
                      icon={UserRound}
                    />
                    <AuthField
                      label="Entreprise"
                      value={company}
                      onChange={setCompany}
                      placeholder="Nom de ton entreprise"
                      icon={UserRound}
                    />
                  </>
                )}
                <AuthField
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="contact@exemple.com"
                  type="email"
                  icon={Mail}
                  onEnter={isLogin ? submit : undefined}
                />
                <div>
                  <AuthField
                    label="Mot de passe"
                    value={password}
                    onChange={setPassword}
                    placeholder="Minimum 6 caracteres"
                    type="password"
                    icon={LockKeyhole}
                    onEnter={submit}
                  />
                  {isLogin && (
                    <div className="mt-2 text-right">
                      <Link href="/user/forgot-password" className="text-xs text-zinc-500 transition hover:text-gold">
                        Mot de passe oublie ?
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {/* Bouton */}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={loading}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-black shadow-lg shadow-gold/25 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isLogin ? "Se connecter" : "Creer mon espace sourcing"}
              </button>

              {/* Lien switch */}
              <p className="mt-5 text-center text-sm text-zinc-400">
                {isLogin ? "Pas encore de compte ?" : "Deja un compte ?"}{" "}
                <Link
                  href={isLogin ? "/user/register" : "/user/login"}
                  className="font-semibold text-gold hover:underline"
                >
                  {isLogin ? "S'inscrire gratuitement" : "Se connecter"}
                </Link>
              </p>

              {/* Lien portail client */}
              <div className="mt-5 border-t border-line pt-4 text-center">
                <p className="text-xs text-zinc-600">
                  Acces client projet ?{" "}
                  <Link href="/client/login" className="text-zinc-400 transition hover:text-zinc-200">
                    Portail client
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ─── Champ de formulaire ──────────────────────────────────────────────────

function AuthField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  onEnter
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon: typeof Mail;
  onEnter?: () => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-line bg-ink px-4 transition focus-within:border-gold/60 focus-within:bg-zinc-900/80">
        <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
        />
      </div>
    </label>
  );
}

// ─── Utilitaire logo ──────────────────────────────────────────────────────

function resolveLogo(value: string): string {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/uploads/")) return `${apiBaseUrl}${value}`;
  return value;
}
