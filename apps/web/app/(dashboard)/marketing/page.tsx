import Link from "next/link";
import { CalendarDays, Facebook, FlaskConical, Search, Settings2, Sparkles } from "lucide-react";

const platforms = [
  {
    href: "/marketing/facebook",
    title: "Facebook Ads",
    subtitle: "Meta, Instagram, Reels, Lead Ads et messages WhatsApp.",
    icon: Facebook,
    tone: "text-sky-300",
    border: "border-sky-400/35",
    bg: "bg-sky-500/10"
  },
  {
    href: "/marketing/google",
    title: "Google Ads",
    subtitle: "Search, mots-cles, annonces et conversions.",
    icon: Search,
    tone: "text-emerald-300",
    border: "border-emerald-400/35",
    bg: "bg-emerald-500/10"
  }
] as const;

export default function MarketingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Marketing</p>
          <h1 className="mt-2 text-3xl font-bold">Choisis une plateforme</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Les pages sont separees. Facebook reste pour Meta et Instagram. Google reste pour Search et mots-cles.
          </p>
        </div>
        <Link
          href="/settings/marketing"
          className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-md border border-line px-5 text-sm font-semibold hover:border-gold/60"
        >
          <Settings2 className="h-4 w-4" />
          Parametres API
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {platforms.map((platform) => (
          <Link
            key={platform.href}
            href={platform.href}
            className={`rounded-lg border ${platform.border} ${platform.bg} p-6 transition hover:-translate-y-1 hover:border-gold/60`}
          >
            <platform.icon className={`h-10 w-10 ${platform.tone}`} />
            <h2 className="mt-6 text-2xl font-bold">{platform.title}</h2>
            <p className="mt-2 text-sm text-muted">{platform.subtitle}</p>
            <span className="mt-6 inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-semibold text-black">
              Ouvrir
            </span>
          </Link>
        ))}
      </div>

      <section className="rounded-lg border border-line bg-panel p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-gold" />
          <div>
            <h2 className="text-lg font-semibold">Bibliothèque créative + scoring IA</h2>
            <p className="mt-1 text-sm text-muted">
              Chaque page garde maintenant ses propres assets. Meta stocke surtout les vidéos et Google les images, avec score et recommandations.
            </p>
          </div>
        </div>
      </section>

      <Link
        href="/marketing/ab-tests"
        className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/10 p-6 transition hover:border-gold/60"
      >
        <div className="flex items-start gap-4">
          <FlaskConical className="mt-1 h-8 w-8 text-gold" />
          <div>
            <h2 className="text-xl font-semibold">A/B Testing créatives</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Compare 2 à 4 créatives de la bibliothèque, laisse l’IA recommander un gagnant, puis prépare la prochaine variante.
            </p>
          </div>
        </div>
        <span className="inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-semibold text-black">
          Ouvrir
        </span>
      </Link>

      <Link
        href="/marketing/planner"
        className="flex items-center justify-between rounded-lg border border-line bg-panel p-6 transition hover:border-gold/50"
      >
        <div className="flex items-start gap-4">
          <CalendarDays className="mt-1 h-8 w-8 text-gold" />
          <div>
            <h2 className="text-xl font-semibold">Planification des campagnes</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Prépare le lancement, règle le budget, lie un test A/B et fais avancer chaque campagne de brouillon à actif.
            </p>
          </div>
        </div>
        <span className="inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-semibold text-black">
          Ouvrir
        </span>
      </Link>
    </div>
  );
}
