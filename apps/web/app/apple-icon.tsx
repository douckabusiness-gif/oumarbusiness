import { ImageResponse } from "next/og";
import { getApiBaseUrl } from "@/lib/api";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";
export const dynamic = "force-dynamic";

const apiBaseUrl = getApiBaseUrl();

export default async function AppleIcon() {
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
            alt="Apple icon"
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
          background: "#080808",
          color: "#ffc24b",
          fontFamily: "Arial, sans-serif",
          fontSize: 68,
          fontWeight: 900
        }}
      >
        OB
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
