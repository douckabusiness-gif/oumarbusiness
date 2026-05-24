"use client";

import Link from "next/link";
import { Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

type ClientAccount = {
  id: string;
  name: string;
  email: string;
  company: string;
  createdAt: string;
};

type SessionPayload = {
  authenticated: boolean;
  account?: ClientAccount;
};

export function ClientPortalShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<ClientAccount | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/client-portal/session`, {
          cache: "no-store",
          credentials: "include"
        });

        if (!response.ok) {
          router.replace("/client/login");
          return;
        }

        const data = (await response.json()) as SessionPayload;
        if (!active) return;

        if (!data.authenticated || !data.account) {
          router.replace("/client/login");
          return;
        }

        setAccount(data.account);
      } catch {
        router.replace("/client/login");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    await fetch(`${apiBaseUrl}/api/client-portal/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(() => null);
    router.replace("/client/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-white">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold font-black text-black">OB</span>
            <div>
              <p className="text-sm text-gold">Portail client</p>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-md border border-line bg-ink px-3 py-2">
              <p className="font-medium">{account?.name}</p>
              <p className="text-xs text-muted">{account?.company || account?.email}</p>
            </div>
            <Link href="/client/dashboard" className="rounded-md border border-line px-3 py-2 text-muted hover:border-gold/60 hover:text-white">
              Dashboard
            </Link>
            <Link href="/client/messages" className="rounded-md border border-line px-3 py-2 text-muted hover:border-gold/60 hover:text-white">
              Messages
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 font-medium text-black"
            >
              <LogOut className="h-4 w-4" />
              Deconnexion
            </button>
          </div>
        </header>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
