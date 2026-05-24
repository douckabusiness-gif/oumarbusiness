"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, Loader2, Radar } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (password.length < 6) { setError("Le mot de passe doit contenir au moins 6 caracteres."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/sourcing/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Erreur.");
      setDone(true);
      setTimeout(() => router.push("/user/login"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">
        Lien invalide. Veuillez generer un nouveau lien depuis la page{" "}
        <Link href="/user/forgot-password" className="font-bold text-red-300 hover:underline">
          mot de passe oublie
        </Link>
        .
      </div>
    );
  }

  return done ? (
    <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
      <h2 className="mt-4 text-lg font-bold">Mot de passe modifie !</h2>
      <p className="mt-2 text-sm text-zinc-400">Redirection vers la connexion dans quelques secondes...</p>
    </div>
  ) : (
    <>
      <p className="mt-4 text-sm leading-6 text-zinc-400">
        Choisis un nouveau mot de passe securise pour ton espace sourcing.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Nouveau mot de passe
          </label>
          <div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-line bg-ink px-4 transition focus-within:border-gold/60">
            <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caracteres"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Confirmer le mot de passe
          </label>
          <div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-line bg-ink px-4 transition focus-within:border-gold/60">
            <LockKeyhole className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Repete ton mot de passe"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
          </div>
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
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Reinitialiser mon mot de passe
      </button>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-8 text-white">
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
          <div className="p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                <Radar className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gold">Espace Sourcing</p>
                <h1 className="text-lg font-black leading-tight">Nouveau mot de passe</h1>
              </div>
            </div>
            <Suspense fallback={<div className="mt-6 text-sm text-zinc-500">Chargement...</div>}>
              <ResetForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
