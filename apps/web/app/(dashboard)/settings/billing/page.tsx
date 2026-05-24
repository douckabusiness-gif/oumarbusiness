import Link from "next/link";
import { ArrowRight, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";

const sections = [
  {
    title: "Facturation",
    href: "/settings/billing/facturation",
    icon: CreditCard,
    text: "Prefixe facture, devise, delai, acompte et relances."
  },
  {
    title: "Wave CI",
    href: "/settings/billing/wave",
    icon: Smartphone,
    text: "Activation et numero Wave utilises pour les paiements."
  },
  {
    title: "Orange Money",
    href: "/settings/billing/orange-money",
    icon: Smartphone,
    text: "Activation et numero Orange Money affiches au client."
  },
  {
    title: "PayPal",
    href: "/settings/billing/paypal",
    icon: Wallet,
    text: "Activation et identifiant PayPal."
  },
  {
    title: "Autres moyens",
    href: "/settings/billing/autres",
    icon: Landmark,
    text: "Stripe Checkout et virement bancaire."
  }
] as const;

export default function BillingSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Paiements</p>
        <h1 className="mt-2 text-3xl font-bold">Choisir le service a configurer</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Ici, on ne melange plus les services. Choisis la page a ouvrir: Facturation, Wave, Orange Money, PayPal ou
          autres moyens.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-line bg-panel p-5 transition hover:border-gold/60 hover:bg-white/[0.04]"
          >
            <section.icon className="h-6 w-6 text-gold" />
            <h2 className="mt-5 font-semibold">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{section.text}</p>
            <div className="mt-5 flex items-center gap-2 text-sm font-medium text-gold">
              Ouvrir
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
