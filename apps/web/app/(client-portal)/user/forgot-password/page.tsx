"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Radar } from "lucide-react";
import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!email.includes("@")) { setError("Saisis un email valide."); return; }
    setLoading(true);
    setError("");
    try {
      await fetch(`${apiBaseUrl}/api/sourcing/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      // Toujours afficher le message de succes (anti-enumeration)
      setSent(true);
    } catch {
      setError("Une erreur est survenue. Reessaie dans quelques instants.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-8 text-white">
      {/* Decor */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-gold/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-blue-500/8 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link
          href="/user/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour a la connexion
        </Link>

        <div className="overflow-hidden rounded-3xl border border-gold/20 bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          {/* Halo */}
          <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-gold/12 blur-3xl" />

          <div className="relative p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                <Radar className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gold">Espace Sourcing</p>
                <h1 className="text-lg font-black leading-tight">Mot de passe oublie</h1>
              </div>
            </div>

            {sent ? (
              <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                <h2 className="mt-4 text-lg font-bold">Email envoye !</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Si cet email est associe a un compte, tu recevras un lien de reinitialisation dans quelques minutes.
                  Verifie aussi tes spams.
                </p>
                <Link
                  href="/user/login"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-gold/40 hover:text-gold"
                >
                  Retour a la connexion
                </Link>
              </div>
            ) : (
              <>
                <p className="mt-4 text-sm leading-6 text-zinc-400">
                  Saisis ton adresse email. Si un compte existe, tu recevras un lien pour reinitialiser ton mot de passe.
                </p>

                <div className="mt-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Adresse email
                  </label>
                  <div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-line bg-ink px-4 transition focus-within:border-gold/60">
                    <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void submit()}
                      placeholder="contact@exemple.com"
                      className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={loading}
                  className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gold font-bold text-black shadow-lg shadow-gold/25 transition hover:bg-amber-400 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Envoyer le lien
                </button>

                <p className="mt-5 text-center text-sm text-zinc-500">
                  Tu te souviens ?{" "}
                  <Link href="/user/login" className="font-semibold text-gold hover:underline">
                    Se connecter
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
