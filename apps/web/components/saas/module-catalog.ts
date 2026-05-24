export const saasModuleCatalog = [
  {
    key: "sourcing-commercial",
    title: "Agent sourcing commercial",
    description: "Recherche prospects, qualification et preparation outreach."
  }
] as const;

export type SaasModuleKey = (typeof saasModuleCatalog)[number]["key"];
