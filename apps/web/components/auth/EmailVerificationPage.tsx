"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MailWarning, ShieldCheck } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type Props = {
  audience: "client" | "user";
  loginHref: string;
  verifyEndpoint: string;
  title: string;
  body: string;
  token: string;
};

export function EmailVerificationPage({ audience, loginHref, verifyEndpoint, title, body, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<{ agencyName?: string; logoUrl?: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" });
        if (!response.ok || !active) return;
        const data = (await response.json()) as { agencyName?: string; logoUrl?: string };
        if (active) setBranding(data);
      } catch {
        // Keep page usable without branding.
      }
    }

    async function verifyEmail() {
      if (!token) {
        setError("Le lien de confirmation est incomplet.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}${verifyEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const data = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Impossible de confirmer cet email.");
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Impossible de confirmer cet email.");
      } finally {
        setLoading(false);
      }
    }

    void loadBranding();
    void verifyEmail();

    return () => {
      active = false;
    };
  }, [token, verifyEndpoint]);

  const agencyName = branding?.agencyName || "Oumar Business";
  const logoUrl = resolveLogo(branding?.logoUrl ?? "");

  return (
    <main className="min-h-screen bg-ink px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Retour a l'accueil
          </Link>
          <Link href={loginHref} className="text-sm font-medium text-gold transition hover:underline">
            Aller a la connexion
          </Link>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-line bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <section className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
            <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={`Logo ${agencyName}`} className="block max-h-10 w-auto max-w-[10rem] object-contain" />
                ) : (
                  <span className="text-lg font-black text-gold">{agencyName}</span>
                )}
              </div>

              <p className="mt-6 text-sm font-medium text-gold">
                {audience === "client" ? "Portail client" : "Espace sourcing"}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">{body}</p>

              <div className="mt-8 rounded-3xl border border-white/8 bg-white/[0.03] p-6">
                {loading ? (
                  <div className="flex items-center gap-3 text-zinc-200">
                    <Loader2 className="h-5 w-5 animate-spin text-gold" />
                    Verification en cours...
                  </div>
                ) : error ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 text-red-200">
                      <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                      <div>
                        <p className="font-semibold">Confirmation impossible</p>
                        <p className="mt-1 text-sm text-red-200/90">{error}</p>
                      </div>
                    </div>
                    <Link
                      href={loginHref}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-ink px-4 text-sm font-semibold text-zinc-100 hover:border-gold/40 hover:text-gold"
                    >
                      Retour a la connexion
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 text-emerald-200">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      <div>
                        <p className="font-semibold">Email confirme</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          Ton acces est maintenant active. Tu peux te connecter normalement.
                        </p>
                      </div>
                    </div>
                    <Link
                      href={loginHref}
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-gold px-4 text-sm font-semibold text-black hover:bg-[#f5b52d]"
                    >
                      Aller a la connexion
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-400">
                <ShieldCheck className="h-4 w-4 text-gold" />
                Verification email obligatoire avant acces
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function resolveLogo(value: string) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }
  return value;
}
