const statuses = [
  ["Scoping", ["Agent IA e-commerce"]],
  ["Actif", ["Site vitrine Kora", "Campagne Meta ClinicAI"]],
  ["Review", ["Portail client Baobab"]],
  ["Termine", ["Audit SEO Nimba"]]
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Operations</p>
        <h1 className="mt-2 text-3xl font-bold">Gestion de projets</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {statuses.map(([status, projects]) => (
          <section key={status as string} className="rounded-lg border border-line bg-panel p-4">
            <h2 className="font-semibold">{status as string}</h2>
            <div className="mt-4 space-y-3">
              {(projects as string[]).map((project) => (
                <article key={project} className="rounded-md border border-line bg-ink p-4">
                  <p className="font-medium">{project}</p>
                  <div className="mt-3 h-2 rounded-full bg-line">
                    <div className="h-2 w-2/3 rounded-full bg-gold" />
                  </div>
                  <p className="mt-3 text-xs text-muted">Milestones, livrables et approbations client</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
