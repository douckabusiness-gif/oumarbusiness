export default function FreelancersPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-sm text-gold">Module futur</p>
        <h1 className="mt-2 text-3xl font-bold">Freelances</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Cette page est mise en pause pour le moment. Plus tard, elle servira a gerer les freelances,
          les missions, les contrats et les paiements.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-ink/50 p-8 text-sm text-muted">
        Pour l'instant, ta priorite reste :
        <ul className="mt-4 space-y-2">
          <li>- creer tes applications</li>
          <li>- publier dans le Market</li>
          <li>- revendre sur le Marketplace</li>
        </ul>
      </div>
    </div>
  );
}
