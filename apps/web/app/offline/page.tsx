"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-gold">
          <WifiOff className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Mode hors ligne</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          L&apos;application n&apos;arrive pas a joindre le reseau pour le moment. Tu peux reessayer des que la connexion revient.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black"
          >
            Reessayer
          </button>
          <Link
            href="/"
            className="rounded-xl border border-line bg-ink px-4 py-3 text-sm font-semibold text-zinc-100"
          >
            Retour accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
