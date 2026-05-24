import {
  Activity,
  Facebook,
  KeyRound,
  Link2,
  Megaphone,
  Save,
  Search,
  ShieldCheck,
  TestTube2
} from "lucide-react";

const metaPermissions = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_manage_ads",
  "pages_read_engagement",
  "instagram_basic",
  "leads_retrieval"
];

const conversionEvents = [
  "lead",
  "quote_requested",
  "invoice_sent",
  "payment_received",
  "client_portal_signup",
  "project_approved"
];

export default function MarketingSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-gold">Parametres marketing</p>
          <h1 className="mt-2 text-3xl font-bold">Meta/Facebook API et Google Ads</h1>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line px-5 text-sm font-semibold">
            <TestTube2 className="h-4 w-4" />
            Tester connexions
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gold px-5 text-sm font-semibold text-black">
            <Save className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Facebook className="h-7 w-7 text-sky-300" />
              <div>
                <h2 className="font-semibold">Meta / Facebook Marketing API</h2>
                <p className="text-sm text-muted">Facebook Ads, Instagram, Pixel et Lead Ads</p>
              </div>
            </div>
            <Status label="A configurer" tone="amber" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Meta App ID" placeholder="1234567890" />
            <Field label="Meta App Secret" placeholder="app-secret" type="password" />
            <Field label="Long-lived Access Token" placeholder="EAAB..." type="password" wide />
            <Field label="Business Manager ID" placeholder="987654321" />
            <Field label="Ad Account ID" placeholder="act_123456789" />
            <Field label="Page ID" placeholder="Facebook Page ID" />
            <Field label="Instagram Account ID" placeholder="IG Business Account ID" />
            <Field label="Meta Pixel ID" placeholder="Pixel ID" />
            <Field label="Webhook Verify Token" placeholder="meta-marketing-webhook-token" type="password" wide />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-ink p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-gold" />
              Permissions requises
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {metaPermissions.map((permission) => (
                <label key={permission} className="flex items-center gap-3 rounded-md border border-line p-3 text-sm">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" />
                  {permission}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="h-7 w-7 text-emerald-300" />
              <div>
                <h2 className="font-semibold">Google Ads API</h2>
                <p className="text-sm text-muted">Search, YouTube, Display et conversions</p>
              </div>
            </div>
            <Status label="A configurer" tone="amber" />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Developer Token" placeholder="Google Ads developer token" type="password" wide />
            <Field label="OAuth Client ID" placeholder="client-id.apps.googleusercontent.com" />
            <Field label="OAuth Client Secret" placeholder="client-secret" type="password" />
            <Field label="Refresh Token" placeholder="1//..." type="password" wide />
            <Field label="Manager Customer ID" placeholder="123-456-7890" />
            <Field label="Customer ID" placeholder="098-765-4321" />
            <Field label="Conversion Tag ID" placeholder="AW-XXXXXXXXX" />
            <Field label="GA4 Measurement ID" placeholder="G-XXXXXXXXXX" />
          </div>

          <div className="mt-6 rounded-lg border border-line bg-ink p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-gold" />
              OAuth redirect
            </p>
            <div className="mt-3 rounded-md border border-line bg-panel px-3 py-3 text-sm text-zinc-300">
              http://localhost:4000/api/marketing/google/oauth/callback
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Tracking et attribution</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="UTM source par defaut" defaultValue="oumar-business" />
            <Field label="UTM medium par defaut" defaultValue="paid_social" />
            <Field label="Domaine tracking" defaultValue="https://app.oumar-business.com" wide />
            <Field label="Webhook conversions" defaultValue="http://localhost:4000/api/marketing/conversions/webhook" wide />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {conversionEvents.map((event) => (
              <label key={event} className="flex items-center gap-3 rounded-md border border-line bg-ink p-3 text-sm">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-gold" />
                {event}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-gold" />
            <h2 className="text-lg font-semibold">Etat des integrations</h2>
          </div>
          <div className="mt-5 space-y-3">
            <IntegrationRow name="Meta Marketing API" status="Token manquant" />
            <IntegrationRow name="Meta Pixel" status="Pixel ID manquant" />
            <IntegrationRow name="Google Ads API" status="OAuth requis" />
            <IntegrationRow name="Google Tag / GA4" status="Measurement ID manquant" />
            <IntegrationRow name="Conversions server-side" status="Pret cote API" ok />
          </div>
          <div className="mt-6 rounded-lg border border-gold/30 bg-gold/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-gold">
              <Link2 className="h-4 w-4" />
              Connexion campagne
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Ces cles alimentent la page Marketing pour creer les campagnes, lire les performances,
              remonter les leads et attribuer les ventes aux publicites.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  defaultValue,
  type = "text",
  wide = false
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={`grid gap-2 text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-zinc-300">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-11 rounded-md border border-line bg-ink px-3 outline-none focus:border-gold/70"
      />
    </label>
  );
}

function Status({ label, tone }: { label: string; tone: "amber" | "green" }) {
  const className =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-amber-500/15 text-amber-300";

  return <span className={`rounded-full px-3 py-1 text-xs ${className}`}>{label}</span>;
}

function IntegrationRow({ name, status, ok = false }: { name: string; status: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-ink p-3 text-sm">
      <span>{name}</span>
      <span className={ok ? "text-emerald-300" : "text-amber-300"}>{status}</span>
    </div>
  );
}
