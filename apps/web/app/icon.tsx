import { ImageResponse } from "next/og";
import { getApiBaseUrl } from "@/lib/api";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";
export const dynamic = "force-dynamic";

const apiBaseUrl = getApiBaseUrl();

export default async function Icon() {
  const branding = await loadBrandingSettings();
  const pwaIconUrl = resolveBrandingAssetUrl(branding?.pwaIconUrl ?? "");

  if (pwaIconUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pwaIconUrl}
            alt="PWA icon"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain"
            }}
          />
        </div>
      ),
      size
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at top, #2b1c06 0%, #080808 62%)",
          color: "#ffc24b",
          fontFamily: "Arial, sans-serif"
        }}
      >
        <div
          style={{
            width: 392,
            height: 392,
            borderRadius: 96,
            border: "8px solid rgba(255,194,75,0.22)",
            boxShadow: "0 0 80px rgba(255,122,24,0.28)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
            <span style={{ fontSize: 182, fontWeight: 900, letterSpacing: 0 }}>OB</span>
            <span style={{ fontSize: 38, color: "#fff4da", fontWeight: 700, letterSpacing: 2 }}>
              OUMAR BUSINESS
            </span>
          </div>
        </div>
      </div>
    ),
    size
  );
}

async function loadBrandingSettings(): Promise<{ pwaIconUrl?: string } | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/settings/branding`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as { pwaIconUrl?: string };
  } catch {
    return null;
  }
}

function resolveBrandingAssetUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${apiBaseUrl}${value}`;
  }

  return value;
}
