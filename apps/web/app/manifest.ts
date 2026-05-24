import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Oumar Business",
    short_name: "Oumar Business",
    description: "CRM, WhatsApp, facturation et gestion operationnelle dans une application installable.",
    start_url: "/sourcing?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#080808",
    theme_color: "#080808",
    lang: "fr",
    categories: ["business", "productivity", "marketing"],
    shortcuts: [
      {
        name: "Connexion sourcing",
        short_name: "Connexion sourcing",
        description: "Ouvrir l'espace sourcing",
        url: "/user/login"
      },
      {
        name: "Inscription sourcing",
        short_name: "Inscription sourcing",
        description: "Creer un compte sourcing",
        url: "/user/register"
      },
      {
        name: "Portail client",
        short_name: "Portail client",
        description: "Acceder au portail client",
        url: "/client/login"
      }
    ],
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
