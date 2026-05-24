import { MetricCard } from "@/components/ui/MetricCard";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Reporting</p>
        <h1 className="mt-2 text-3xl font-bold">KPIs temps reel</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Auto-resolution" value="84%" helper="Tous canaux" />
        <MetricCard label="Temps moyen reponse" value="42s" helper="WhatsApp + Email" />
        <MetricCard label="Conversion" value="21%" helper="Prospect vers client" />
        <MetricCard label="NPS" value="68" helper="Satisfaction moyenne" />
      </div>
      <div className="rounded-lg border border-line bg-panel p-5">
        <div className="grid h-72 items-end gap-3 md:grid-cols-12">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="rounded-t-md bg-gold" style={{ height: `${35 + ((index * 17) % 55)}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
