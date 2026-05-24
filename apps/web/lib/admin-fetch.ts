"use client";

import { getApiBaseUrl } from "@/lib/api";

let installed = false;

export function installAdminFetchCredentials() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  const apiBaseUrl = getApiBaseUrl();

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const shouldIncludeCredentials = url.startsWith(`${apiBaseUrl}/api/`) || url.startsWith("/api/");

    if (!shouldIncludeCredentials || init?.credentials) {
      return originalFetch(input, init);
    }

    return originalFetch(input, {
      ...init,
      credentials: "include"
    });
  };
}
