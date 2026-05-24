"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type AuthAudience = "client" | "user";

type BrandingPayload = {
  agencyName?: string;
  logoUrl?: string;
};

type ClientAuthFormProps = {
  mode: "login" | "register";
  audience?: AuthAudience;
};

export function ClientAuthForm({ mode, audience = "client" }: ClientAuthFormProps) {
  const router = useRouter();
  const isLogin = mode === "login";
  const isSourcingUser = audience === "user";
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<BrandingPayload | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBranding() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as BrandingPayload;
        if (mounted) setBranding(data);
      } catch {
        // Keep auth usable even if branding is unavailable.
      }
    }

    void loadBranding();

    return () => {
      mounted = false;
    };
  }, []);

  const copy = useMemo(() => {
    if (isSourcingUser) {
      return {
        eyebrow: isLogin ? "Connexion sourcing" : "Inscription sourcing",
        title: isLogin ? "Accede a ton espace sourcing" : "Cree ton espace sourcing.",
        body: isLogin
          ? "Connecte-toi pour lancer tes recherches, retrouver tes prospects et suivre ton historique."
          : "Cree un compte simple pour utiliser le systeme sourcing et retrouver tes prospects.",
        cardTitle: isLogin ? "Connecte ton espace sourcing" : "Ouvre ton espace sourcing",
        cardBody: isLogin
          ? "Entre ton email et ton mot de passe pour retrouver tes recherches."
          : "Renseigne ton nom et ton entreprise pour creer ton acces sourcing.",
        primary: isLogin ? "Se connecter" : "Creer mon espace sourcing",
        switchText: isLogin ? "Pas encore de compte sourcing ?" : "Vous avez deja un compte sourcing ?",
        switchHref: isLogin ? "/user/register" : "/user/login",
        switchLabel: isLogin ? "S'inscrire" : "Se connecter",
        afterText: "Vous cherchez plutot un acces client projet ?",
        afterHref: isLogin ? "/client/login" : "/client/register",
        afterLabel: isLogin ? "Portail client" : "Inscription client",
        redirectTo: "/user/dashboard",
        endpoint: `/api/sourcing/auth/${mode}`,
        badge: "Espace sourcing"
      };
    }

    return {
      eyebrow: isLogin ? "Connexion" : "Inscription",
      title: isLogin ? "Retrouve tes projets, devis et messages." : "Cree ton acces client en quelques secondes.",
      body: isLogin
        ? "Connecte-toi pour suivre tes demandes, relire tes echanges et acceder a tes documents depuis un seul espace."
        : "Inscris-toi pour centraliser tes projets, recevoir tes devis et suivre tes livraisons dans un espace simple et securise.",
      cardTitle: isLogin ? "Accede a ton espace client" : "Ouvre ton espace client",
      cardBody: isLogin
        ? "Entre ton email et ton mot de passe pour continuer."
        : "Remplis les informations ci-dessous pour creer ton compte.",
      primary: isLogin ? "Se connecter" : "Creer mon compte",
      switchText: isLogin ? "Pas encore de compte ?" : "Vous avez deja un compte ?",
      switchHref: isLogin ? "/client/register" : "/client/login",
      switchLabel: isLogin ? "S'inscrire" : "Se connecter",
      afterText: "",
      afterHref: "",
      afterLabel: "",
      redirectTo: "/client/dashboard",
      endpoint: `/api/client-portal/${mode}`,
      badge: "Portail client"
    };
  }, [isLogin, isSourcingUser, mode]);

  async function submit() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${apiBaseUrl}${copy.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          company,
          email,
          password
        })
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Action impossible.");
      }

      router.push(copy.redirectTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action impossible.");
    } finally {
      setLoading(false);
    }
  }

  const agencyName = branding?.agencyName || "Oumar Business";
  const logoUrl = resolveBrandingLogoUrl(branding?.logoUrl ?? "");

  return (
    <main className="min-h-screen bg-ink px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Retour a l'accueil
          </Link>
          <Link href={isLogin ? "/register" : "/login"} className="hidden text-xs text-zinc-500 transition hover:text-zinc-200 sm:block">
            Basculer entre connexion et inscription
          </Link>
        </div>

        <div className="grid overflow-hidden rounded-[28px] border border-line bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_0.95fr]">
          <section className="relative overflow-hidden border-b border-line px-6 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-r">
            <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center">
                {logoUrl ? (
                  <span className="flex h-14 items-center justify-center rounded-2xl px-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={`Logo ${agencyName}`} className="block max-h-10 w-auto max-w-[10rem] object-contain" />
                  </span>
                ) : (
                  <span className="block h-14 w-[10rem]" aria-hidden="true" />
                )}
              </div>

              <p className="mt-6 text-sm font-medium text-gold">{copy.badge}</p>
              <h2 className="mt-3 max-w-md text-3xl font-black tracking-tight sm:text-4xl">{copy.title}</h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-zinc-300">{copy.body}</p>

              <div className="mt-8 grid gap-3">
                {(isSourcingUser
                  ? [
                      "Lancer des recherches ciblees",
                      "Retrouver les prospects trouves",
                      "Suivre l'historique de tes runs"
                    ]
                  : [
                      "Acces securise a tes informations",
                      "Suivi centralise de tes projets",
                      "Echanges simples avec l'equipe Oumar Business"
                    ]
                ).map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-gold" />
                  Session securisee
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
                  <LockKeyhole className="h-4 w-4 text-gold" />
                  Donnees privees
                </span>
              </div>
            </div>
          </section>

          <section className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-md">
              <div>
                <p className="text-sm font-medium text-gold">{copy.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{copy.cardTitle}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{copy.cardBody}</p>
              </div>

              <div className="mt-8 grid gap-4">
                {mode === "register" ? (
                  <>
                    <Field
                      label="Nom complet"
                      value={name}
                      onChange={setName}
                      placeholder="Votre nom complet"
                      icon={UserRound}
                    />
                    <Field
                      label="Entreprise"
                      value={company}
                      onChange={setCompany}
                      placeholder="Nom de votre entreprise"
                      icon={UserRound}
                    />
                  </>
                ) : null}
                <Field label="Email" value={email} onChange={setEmail} placeholder="contact@exemple.com" type="email" icon={Mail} />
                <Field
                  label="Mot de passe"
                  value={password}
                  onChange={setPassword}
                  placeholder="Minimum 6 caracteres"
                  type="password"
                  icon={LockKeyhole}
                />
              </div>

              {isSourcingUser && !isLogin ? (
                <div className="mt-6 rounded-2xl border border-line bg-ink px-4 py-4 text-sm leading-6 text-zinc-300">
                  Une fois le compte cree, ton espace sourcing est disponible.
                </div>
              ) : null}

              {error ? (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={loading}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold font-semibold text-black transition hover:bg-[#f5b52d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {copy.primary}
              </button>

              <p className="mt-5 text-sm text-zinc-400">
                {copy.switchText}{" "}
                <Link href={copy.switchHref} className="font-semibold text-gold transition hover:text-gold/80 hover:underline">
                  {copy.switchLabel}
                </Link>
              </p>
              {copy.afterText && copy.afterHref && copy.afterLabel ? (
                <p className="mt-3 text-sm text-zinc-500">
                  {copy.afterText}{" "}
                  <Link href={copy.afterHref} className="font-semibold text-zinc-200 transition hover:text-gold hover:underline">
                    {copy.afterLabel}
                  </Link>
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon: typeof Mail;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-zinc-300">{label}</span>
      <div className="flex h-12 items-center gap-3 rounded-xl border border-line bg-ink px-4 transition focus-within:border-gold/70">
        <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
        />
      </div>
    </label>
  );
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
