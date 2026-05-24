import Link from "next/link";
import {
  CircleHelp,
  Bot,
  CreditCard,
  DatabaseZap,
  Globe2,
  KeyRound,
  Mail,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  Paintbrush,
  ShieldCheck,
  Users
} from "lucide-react";

const settings = [
  {
    title: "WhatsApp",
    href: "/settings/whatsapp",
    icon: MessageCircle,
    text: "Cloud API Meta, Baileys, sessions QR, webhooks et limites d'envoi."
  },
  {
    title: "Agents IA",
    href: "/settings/agents",
    icon: Bot,
    text: "Prompts, fournisseur IA, modele, temperature, seuils et activation."
  },
  {
    title: "Assistant accueil",
    href: "/settings/assistant",
    icon: CircleHelp,
    text: "Bouton flottant, message d'accueil, prompts rapides et activation sur la home."
  },
  {
    title: "Cles IA",
    href: "/settings/api-keys",
    icon: KeyRound,
    text: "Groq, OpenAI, Claude, Gemini, GLM, Kimi K2, Qwen et NVIDIA NIM."
  },
  {
    title: "Marketing API",
    href: "/settings/marketing",
    icon: Megaphone,
    text: "Meta/Facebook Marketing API, Google Ads, pixels, tags et conversions."
  },
  {
    title: "Search Intelligence",
    href: "/settings/search-intelligence",
    icon: DatabaseZap,
    text: "Tavily, Serper, recherche web, extraction, sourcing et veille autonome."
  },
  {
    title: "Email",
    href: "/settings/email",
    icon: Mail,
    text: "Comptes IMAP/SMTP, signatures, sync et templates."
  },
  {
    title: "Notifications",
    href: "/settings/notifications",
    icon: MonitorSmartphone,
    text: "Push PWA, permission navigateur, appareil abonne et test d'envoi."
  },
  {
    title: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
    text: "Point d'entree vers Facturation, Wave, Orange Money, PayPal et autres moyens."
  },
  {
    title: "Team",
    href: "/settings/team",
    icon: Users,
    text: "Invitations, roles RBAC, suspension et audit par membre."
  },
  {
    title: "Security",
    href: "/settings/security",
    icon: ShieldCheck,
    text: "2FA, sessions actives, audit log et rate limiting."
  },
  {
    title: "Branding",
    href: "/settings/branding",
    icon: Paintbrush,
    text: "Logo, couleurs, nom agence, factures et portail client."
  },
  {
    title: "Languages",
    href: "/settings/languages",
    icon: Globe2,
    text: "FR, EN, AR, RTL et traductions custom."
  }
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Administration</p>
        <h1 className="mt-2 text-3xl font-bold">Parametres systeme</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settings.map((setting) => (
          <Link
            key={setting.href}
            href={setting.href}
            className="rounded-lg border border-line bg-panel p-5 transition hover:border-gold/60 hover:bg-white/[0.04]"
          >
            <setting.icon className="h-6 w-6 text-gold" />
            <h2 className="mt-5 font-semibold">{setting.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{setting.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
