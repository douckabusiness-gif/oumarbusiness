"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Loader2, LogOut, Menu, Radar, Search, X } from "lucide-react";
import { dashboardNavigation } from "@/lib/navigation";
import { getApiBaseUrl } from "@/lib/api";
import { installAdminFetchCredentials } from "@/lib/admin-fetch";

const apiBaseUrl = getApiBaseUrl();
const mobilePrimaryNavigation = [
  dashboardNavigation[0],
  dashboardNavigation[1],
  dashboardNavigation[2],
  dashboardNavigation[9],
  dashboardNavigation[10]
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  installAdminFetchCredentials();
  const router = useRouter();
  const pathname = usePathname();
  const [branding, setBranding] = useState<{ agencyName?: string; logoUrl?: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBranding() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { agencyName?: string; logoUrl?: string };
        if (mounted) setBranding(payload);
      } catch {
        // Keep dashboard usable if branding is unavailable.
      }
    }

    function handleBrandingUpdated() {
      void loadBranding();
    }

    void loadBranding();
    window.addEventListener("branding-updated", handleBrandingUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("branding-updated", handleBrandingUpdated);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAdminSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin-auth/session`, {
          cache: "no-store",
          credentials: "include"
        });

        if (!response.ok) {
          router.replace("/admin/login");
          return;
        }

        const payload = (await response.json()) as {
          authenticated: boolean;
          user?: { name: string; role: string };
        };

        if (!payload.authenticated || !payload.user) {
          router.replace("/admin/login");
          return;
        }

        if (mounted) {
          setAdminUser(payload.user);
          setAuthLoading(false);
        }
      } catch {
        router.replace("/admin/login");
      }
    }

    void loadAdminSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function logout() {
    try {
      await fetch(`${apiBaseUrl}/api/admin-auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } finally {
      router.replace("/admin/login");
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-4 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
          Verification de la session admin...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-line bg-[#0c0c0c] lg:flex">
        <div className="flex h-20 items-center justify-center border-b border-line px-5">
          <Link href="/" className="inline-flex items-center justify-center">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveBrandingLogoUrl(branding.logoUrl)}
                alt="Logo agence"
                className="block max-h-12 w-auto max-w-[10.5rem] object-contain"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-gold text-sm font-black text-black">
                OB
              </span>
            )}
          </Link>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-gold text-black"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <Link
            href="/business/sourcing"
            className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-600 to-gold px-4 py-3 shadow-lg shadow-gold/20 transition hover:from-amber-500 hover:to-amber-400"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/20">
              <Radar className="h-4 w-4 text-black" />
            </div>
            <div>
              <p className="text-sm font-black text-black">Sourcing Business</p>
              <p className="text-[10px] font-medium text-black/60">Monetisation agents</p>
            </div>
          </Link>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="absolute inset-y-0 left-0 w-[84vw] max-w-[20rem] border-r border-line bg-[#0c0c0c]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Link href="/" className="inline-flex items-center justify-center">
                {branding?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveBrandingLogoUrl(branding.logoUrl)}
                    alt="Logo agence"
                    className="block max-h-10 w-auto max-w-[8.5rem] object-contain"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold text-sm font-black text-black">
                    OB
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-panel text-zinc-300"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 px-3 py-4">
              {dashboardNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm transition ${
                      isActive ? "bg-gold text-black" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-line p-3">
              <Link
                href="/business/sourcing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-600 to-gold px-4 py-3 shadow-lg shadow-gold/20"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/20">
                  <Radar className="h-4 w-4 text-black" />
                </div>
                <div>
                  <p className="text-sm font-black text-black">Sourcing Business</p>
                  <p className="text-[10px] font-medium text-black/60">Monetisation agents</p>
                </div>
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-zinc-300 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 lg:hidden">
                <Link href="/" className="inline-flex items-center gap-2">
                  {branding?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveBrandingLogoUrl(branding.logoUrl)}
                      alt="Logo agence"
                      className="block h-8 w-auto max-w-[7rem] object-contain"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gold text-xs font-black text-black">
                      OB
                    </span>
                  )}
                  <span className="text-sm font-medium text-zinc-200">
                    {branding?.agencyName?.trim() || "Oumar Business"}
                  </span>
                </Link>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted lg:max-w-xl">
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Recherche: client, message, facture...</span>
              </div>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-zinc-300"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-3 lg:flex">
              {adminUser ? (
                <div className="rounded-md border border-line bg-panel px-3 py-2 text-right">
                  <p className="text-sm font-medium text-zinc-100">{adminUser.name}</p>
                  <p className="text-xs text-zinc-500">{adminUser.role}</p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel px-3 text-sm text-zinc-300 transition hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Deconnexion
              </button>
            </div>
          </div>
        </header>
        <main className="px-3 py-4 pb-24 sm:px-4 sm:py-6 lg:px-8 lg:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#0b0b0b]/95 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] transition ${
                  isActive ? "bg-gold text-black" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
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
