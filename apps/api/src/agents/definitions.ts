import type { AgentType } from "@oumar/shared";

export type OrchestratorGroupId = "growth" | "operations";

export const orchestratorGroupDefinitions: Array<{
  id: OrchestratorGroupId;
  name: string;
  orchestratorName: string;
  mission: string;
  defaultAgent: AgentType;
  agentTypes: AgentType[];
}> = [
  {
    id: "growth",
    name: "Croissance & Front Office",
    orchestratorName: "Growth Orchestrator",
    mission: "Gerer acquisition, conversations entrantes, qualification, conversion et campagnes.",
    defaultAgent: "autonomous",
    agentTypes: ["autonomous", "prospection", "sales", "whatsapp", "email", "marketing"]
  },
  {
    id: "operations",
    name: "Delivery & Operations",
    orchestratorName: "Operations Orchestrator",
    mission: "Gerer execution projet, delivery, facturation, freelances et reporting.",
    defaultAgent: "project",
    agentTypes: ["project", "web", "ai-builder", "billing", "freelance", "report"]
  }
];

export const rootOrchestratorDefinition = {
  name: "Root Orchestrator",
  mission: "Router chaque demande vers le bon groupe puis laisser l'orchestrateur de domaine choisir l'agent specialise."
} as const;

export const agentDefinitions: Array<{
  type: AgentType;
  group: OrchestratorGroupId;
  name: string;
  mission: string;
  escalationRules: string[];
}> = [
  {
    type: "autonomous",
    group: "growth",
    name: "Autonome 24/7",
    mission: "Premier point de contact WhatsApp et Email.",
    escalationRules: ["client agressif", "projet > 500000 XOF", "demande humaine explicite"]
  },
  {
    type: "prospection",
    group: "growth",
    name: "Prospection automatique",
    mission: "Importer, qualifier et relancer les prospects.",
    escalationRules: ["reponse positive a fort budget", "risque de spam"]
  },
  {
    type: "sales",
    group: "growth",
    name: "Commercial",
    mission: "Generer devis, relancer et convertir en projet.",
    escalationRules: ["remise exceptionnelle", "negociation complexe"]
  },
  {
    type: "project",
    group: "operations",
    name: "Chef de projet",
    mission: "Piloter milestones, livrables et approbations.",
    escalationRules: ["retard critique", "blocage client"]
  },
  {
    type: "web",
    group: "operations",
    name: "Createur de sites web",
    mission: "Analyser les briefs web et produire les specs.",
    escalationRules: ["architecture complexe", "audit technique manuel requis"]
  },
  {
    type: "ai-builder",
    group: "operations",
    name: "Builder d'agents IA",
    mission: "Concevoir des agents IA sur mesure pour les clients.",
    escalationRules: ["donnees sensibles", "outil externe non approuve"]
  },
  {
    type: "marketing",
    group: "growth",
    name: "Marketing et contenu",
    mission: "Produire contenus, calendriers et campagnes.",
    escalationRules: ["validation marque", "campagne payante importante"]
  },
  {
    type: "email",
    group: "growth",
    name: "Email specialise",
    mission: "Classifier, resumer et repondre aux emails.",
    escalationRules: ["juridique", "plainte client"]
  },
  {
    type: "whatsapp",
    group: "growth",
    name: "WhatsApp specialise",
    mission: "Gerer conversations, diffusions et qualification lead.",
    escalationRules: ["limite diffusion", "blocage contact"]
  },
  {
    type: "billing",
    group: "operations",
    name: "Facturation automatique",
    mission: "Creer, envoyer et relancer les factures.",
    escalationRules: ["paiement conteste", "avoir ou annulation"]
  },
  {
    type: "freelance",
    group: "operations",
    name: "Gestionnaire freelances",
    mission: "Recruter, assigner et evaluer les freelances.",
    escalationRules: ["contrat sensible", "qualite insuffisante"]
  },
  {
    type: "report",
    group: "operations",
    name: "Rapport de nuit",
    mission: "Produire le rapport quotidien de 7h pour Oumar.",
    escalationRules: ["alerte prioritaire", "donnees manquantes"]
  }
];

export function getAgentDefinition(agentType: AgentType) {
  return agentDefinitions.find((agent) => agent.type === agentType);
}

export function getGroupDefinition(groupId: OrchestratorGroupId) {
  return orchestratorGroupDefinitions.find((group) => group.id === groupId);
}

export function getGroupByAgentType(agentType: AgentType): OrchestratorGroupId {
  return getAgentDefinition(agentType)?.group ?? "growth";
}
