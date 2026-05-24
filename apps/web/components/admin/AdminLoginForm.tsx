"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type BrandingPayload = {
  agencyName?: string;
  logoUrl?: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<BrandingPayload | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const [sessionResponse, brandingResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/admin-auth/session`, { cache: "no-store", credentials: "include" }),
          fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" })
        ]);

        if (sessionResponse.ok) {
          router.replace("/overview");
          return;
        }

        if (brandingResponse.ok) {
          const data = (await brandingResponse.json()) as BrandingPayload;
          if (mounted) setBranding(data);
        }
      } catch {
        // Keep login usable even if checks fail.
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function submit() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${apiBaseUrl}/api/admin-auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Connexion admin impossible.");
      }

      router.push("/overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion admin impossible.");
    } finally {
      setLoading(false);
    }
  }

  const agencyName = branding?.agencyName || "Oumar Business";
  const logoUrl = resolveBrandingLogoUrl(branding?.logoUrl ?? "");

  return (
    <main className="min-h-screen bg-ink px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Retour a l'accueil
          </Link>
          <Link href="/login" className="hidden text-xs text-zinc-500 transition hover:text-zinc-200 sm:block">
            Connexion client
          </Link>
        </div>

        <div className="grid overflow-hidden rounded-[28px] border border-line bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_0.92fr]">
          <section className="relative overflow-hidden border-b border-line px-6 py-8 sm:px-8 sm:py-10 lg:border-b-0 lg:border-r">
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
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

              <p className="mt-6 text-sm font-medium text-gold">Admin</p>
              <h1 className="mt-3 max-w-md text-3xl font-black tracking-tight sm:text-4xl">
                Accede au pilotage interne.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-zinc-300">
                Cette connexion est reservee a l'equipe admin pour gerer le CRM, la messagerie, les agents et les reglages du systeme.
              </p>

              <div className="mt-8 grid gap-3">
                {[
                  "Acces aux pages internes de gestion",
                  "Session admin separee de l'espace client",
                  "Utilisateurs ADMIN et SUPER_ADMIN uniquement"
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-md">
              <p className="text-sm font-medium text-gold">Connexion admin</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Entre tes identifiants admin</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Utilise ici le compte admin que nous avons cree dans la base.
              </p>

              <div className="mt-8 grid gap-4">
                <Field label="Email admin" value={email} onChange={setEmail} placeholder="admin@oumarbusiness.local" type="email" icon={Mail} />
                <Field label="Mot de passe" value={password} onChange={setPassword} placeholder="Mot de passe admin" type="password" icon={LockKeyhole} />
              </div>

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
                Se connecter
              </button>
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
