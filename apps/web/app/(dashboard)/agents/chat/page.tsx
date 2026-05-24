import { AutonomousAgentChat } from "@/components/agents/AutonomousAgentChat";

export default function AgentsChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gold">Orchestration autonome</p>
        <h1 className="mt-2 text-3xl font-bold">Chat avec les agents</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Une seule demande, puis le routeur racine et les orchestrateurs choisissent le bon departement et le bon agent.
        </p>
      </div>
      <AutonomousAgentChat />
    </div>
  );
}
