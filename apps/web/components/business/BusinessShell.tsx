"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, LayoutDashboard, LogOut, Loader2, Radar, Users, Zap } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";
import { installAdminFetchCredentials } from "@/lib/admin-fetch";

const apiBaseUrl = getApiBaseUrl();

const businessNav = [
  { href: "/business/sourcing", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/business/sourcing?tab=plans", label: "Plans & Tarifs", icon: Zap },
  { href: "/business/sourcing?tab=agents", label: "Agents Globaux", icon: Radar },
  { href: "/business/sourcing?tab=subscribers", label: "Abonnes", icon: Users }
];

export function BusinessShell({ children }: { children: React.ReactNode }) {
  installAdminFetchCredentials();
  const router = useRouter();
  const pathname = usePathname();
  const [authLoading, setAuthLoading] = useState(true);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const r = await fetch(`${apiBaseUrl}/api/admin-auth/session`, {
          cache: "no-store",
          credentials: "include"
        });
        if (!r.ok) { router.replace("/admin/login"); return; }
        const data = (await r.json()) as { authenticated: boolean; user?: { name: string } };
        if (!data.authenticated || !data.user) { router.replace("/admin/login"); return; }
        if (mounted) { setAdminName(data.user.name); setAuthLoading(false); }
      } catch {
        router.replace("/admin/login");
      }
    }

    void checkAuth();
    return () => { mounted = false; };
  }, [router]);

  async function logout() {
    try {
      await fetch(`${apiBaseUrl}/api/admin-auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      router.replace("/admin/login");
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-4 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
          Verification...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-[#0c0c0c]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
          {/* Logo / titre */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-amber-600 shadow-md shadow-gold/30">
              <Radar className="h-5 w-5 text-black" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Sourcing Business</p>
              <p className="text-[10px] uppercase tracking-widest text-gold">Espace monetisation</p>
            </div>
          </div>

          {/* Separateur */}
          <div className="mx-2 hidden h-6 w-px bg-line lg:block" />

          {/* Nav business */}
          <nav className="hidden items-center gap-1 lg:flex">
            {businessNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href.split("?")[0];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive ? "bg-gold/10 text-gold" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions droite */}
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/overview"
              className="hidden items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-gold/30 hover:text-zinc-200 lg:flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour admin
            </Link>
            {adminName && (
              <span className="hidden rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-zinc-400 lg:block">
                {adminName}
              </span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-zinc-400 transition hover:text-white"
              aria-label="Deconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nav mobile */}
        <div className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
          {businessNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href.split("?")[0];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isActive ? "bg-gold/10 text-gold" : "text-zinc-400"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Contenu */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
