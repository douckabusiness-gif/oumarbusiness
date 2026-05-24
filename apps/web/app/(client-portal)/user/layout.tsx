"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

const apiBaseUrl = getApiBaseUrl();

// Pages accessibles sans authentification
const PUBLIC_PATHS = ["/user/login", "/user/register", "/user/forgot-password", "/user/reset-password", "/user/verify-email"];

export default function UserPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isAuthPage = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Les pages d'auth s'affichent immediatement (pas de spinner)
  // Les pages protegees attendent la verification
  const [status, setStatus] = useState<"checking" | "ok">(isAuthPage ? "ok" : "checking");

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/sourcing/auth/me`, {
          cache: "no-store",
          credentials: "include"
        });
        const data = (await res.json()) as { authenticated?: boolean };
        if (!active) return;

        if (data.authenticated) {
          // Deja connecte sur une page d'auth → redirection vers le dashboard
          if (isAuthPage) {
            router.replace("/user/dashboard");
          } else {
            setStatus("ok");
          }
        } else {
          // Non connecte sur une page protegee → redirection vers login
          if (!isAuthPage) {
            router.replace("/user/login");
          } else {
            setStatus("ok");
          }
        }
      } catch {
        if (!active) return;
        // En cas d'erreur reseau, rediriger vers login si page protegee
        if (!isAuthPage) {
          router.replace("/user/login");
        } else {
          setStatus("ok");
        }
      }
    }

    void checkAuth();
    return () => {
      active = false;
    };
  }, [pathname, isAuthPage, router]);

  // Spinner pendant la verification sur les pages protegees
  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-zinc-500">Verification de la session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
