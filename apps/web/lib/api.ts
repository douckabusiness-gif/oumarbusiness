const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return trimTrailingSlash(configuredApiBaseUrl);
  }

  try {
    const apiUrl = new URL(configuredApiBaseUrl);
    const pageHostname = window.location.hostname;

    if (isLocalHostname(pageHostname) && isLocalHostname(apiUrl.hostname)) {
      apiUrl.hostname = pageHostname;
      return trimTrailingSlash(apiUrl.toString());
    }
  } catch {
    return trimTrailingSlash(configuredApiBaseUrl);
  }

  return trimTrailingSlash(configuredApiBaseUrl);
}
