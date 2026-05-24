import type { Metadata, Viewport } from "next";
import { PwaClient } from "@/components/pwa/PwaClient";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Oumar Business",
  title: "Oumar Business",
  description: "CRM, WhatsApp, facturation et gestion operationnelle dans une application web.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oumar Business"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <PwaClient />
      </body>
    </html>
  );
}
