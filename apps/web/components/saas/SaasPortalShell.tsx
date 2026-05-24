"use client";

import Link from "next/link";
import Image from "next/image";
import { Bot, FolderClock, LayoutDashboard, Loader2, LogOut, Menu, Search, Target, UserRound, X } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api";
import type { SaasCompany, SaasUser } from "@/components/saas/shared";

const apiBaseUrl = getApiBaseUrl();

type SessionPayload = {
  authenticated: boolean;
  user?: SaasUser;
  company?: SaasCompany;
};

type BrandingPayload = {
  agencyName?: string;
  logoUrl?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const baseNav: NavItem[] = [
  { href: "/user/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/user/agents", label: "Agents", icon: Bot },
  { href: "/user/sourcing", label: "Nouveau sourcing", icon: Search },
  { href: "/user/prospects", label: "Mes prospects", icon: Target },
  { href: "/user/history", label: "Historique", icon: FolderClock },
  { href: "/user/profile", label: "Mon profil", icon: UserRound }
];

export function SaasPortalShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<SaasUser | null>(null);
  const [company, setCompany] = useState<SaasCompany | null>(null);
  const [branding, setBranding] = useState<BrandingPayload>({});

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const [sessionRes, brandRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/sourcing/auth/me`, { cache: "no-store", credentials: "include" }),
          fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" }).catch(() => null)
        ]);

        if (!sessionRes.ok) {
          router.replace("/user/login");
          return;
        }

        const data = (await sessionRes.json()) as SessionPayload;
        const brandData = brandRes ? (await brandRes.json() as BrandingPayload) : {};
        if (!active) return;

        if (!data.authenticated || !data.user || !data.company) {
          router.replace("/user/login");
          return;
        }

        setUser(data.user);
        setCompany(data.company);
        setBranding(brandData ?? {});
      } catch {
        router.replace("/user/login");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch(`${apiBaseUrl}/api/sourcing/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => null);
    router.replace("/user/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-white">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-line bg-panel/95 xl:flex xl:flex-col">
          <SidebarContent
            pathname={pathname}
            company={company}
            user={user}
            branding={branding}
            onLogout={() => void logout()}
          />
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-40 bg-black/70 xl:hidden" onClick={() => setDrawerOpen(false)}>
            <aside
              className="h-full w-80 max-w-[85vw] border-r border-line bg-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <SidebarContent
                pathname={pathname}
                company={company}
                user={user}
                branding={branding}
                onClose={() => setDrawerOpen(false)}
                onLogout={() => void logout()}
              />
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 xl:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line text-zinc-200 xl:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                {/* Logo visible sur mobile (sidebar cachée) */}
                {branding.logoUrl && (
                  <Link href="/user/dashboard" className="xl:hidden shrink-0">
                    <Image
                      src={branding.logoUrl.startsWith("http") ? branding.logoUrl : `${apiBaseUrl}${branding.logoUrl}`}
                      alt={branding.agencyName || "Logo"}
                      width={36}
                      height={36}
                      className="h-9 w-auto object-contain"
                      unoptimized
                    />
                  </Link>
                )}
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Espace utilisateur</p>
                  <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
                  <p className="mt-1 hidden text-sm text-muted sm:block">{subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl border border-line bg-panel px-4 py-2 text-right md:block">
                  <p className="text-sm font-medium text-zinc-100">{company?.name}</p>
                  <p className="text-xs text-muted">{user?.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-line px-4 text-sm font-medium text-zinc-100 hover:border-gold/40 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Deconnexion</span>
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 xl:px-8">{children}</div>
        </div>
      </div>
    </main>
  );
}

function SidebarContent({
  pathname,
  company,
  user,
  branding,
  onClose,
  onLogout
}: {
  pathname: string;
  company: SaasCompany | null;
  user: SaasUser | null;
  branding: BrandingPayload;
  onClose?: () => void;
  onLogout: () => void;
}) {
  const logoSrc = branding.logoUrl
    ? branding.logoUrl.startsWith("http")
      ? branding.logoUrl
      : `${apiBaseUrl}${branding.logoUrl}`
    : null;
  const agencyName = branding.agencyName || "Oumar Business";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <Link href="/user/dashboard" className="flex items-center gap-3 min-w-0">
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={agencyName}
              width={40}
              height={40}
              className="h-10 w-auto max-w-[120px] shrink-0 object-contain"
              unoptimized
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
              <span className="text-sm font-black text-gold">{agencyName.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-100">{agencyName}</p>
            <p className="text-xs text-zinc-500">Espace utilisateur</p>
          </div>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line text-zinc-300 xl:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="border-b border-line px-5 py-5">
        <div className="rounded-3xl border border-line bg-ink p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10">
              <Search className="h-5 w-5 text-gold" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">{company?.name || "Entreprise"}</p>
              <p className="mt-1 truncate text-xs text-muted">{user?.name || "Utilisateur"}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs text-zinc-300">
            <div className="flex items-center justify-between">
              <span>Acces</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
                {company?.status === "active" ? "Ouvert" : "Ferme"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div>
          <p className="px-2 text-xs font-medium uppercase tracking-[0.24em] text-zinc-500">Navigation</p>
          <nav className="mt-3 space-y-1">
            {baseNav.map((item) => (
              <SidebarLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            ))}
          </nav>
        </div>

      </div>

      <div className="border-t border-line px-4 py-4">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-medium text-zinc-100 hover:border-gold/40 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Deconnexion
        </button>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
        active ? "bg-gold/10 text-gold" : "text-zinc-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
