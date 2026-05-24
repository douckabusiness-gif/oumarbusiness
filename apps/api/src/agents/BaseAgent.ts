import type { AgentDecision, AgentInput, AgentResponse, AgentType } from "@oumar/shared";
import { logger } from "../services/logger.js";

export abstract class BaseAgent {
  abstract readonly type: AgentType;
  abstract readonly name: string;

  async handle(input: AgentInput): Promise<AgentResponse> {
    const startedAt = Date.now();

    try {
      const response = await this.execute(input);
      logger.info(
        {
          agent: this.type,
          duration: Date.now() - startedAt,
          escalated: response.decision.escalate
        },
        "agent handled input"
      );
      return response;
    } catch (error) {
      logger.error({ error, agent: this.type }, "agent failed");
      return {
        text: "Je rencontre une difficulte technique. Je transmets la demande a l'equipe.",
        decision: {
          agent: this.type,
          action: "escalate",
          confidence: 0,
          escalate: true,
          reason: "agent_error"
        }
      };
    }
  }

  protected decision(action: AgentDecision["action"], confidence = 0.75): AgentDecision {
    return {
      agent: this.type,
      action,
      confidence,
      escalate: confidence < 0.3
    };
  }

  protected abstract execute(input: AgentInput): Promise<AgentResponse>;
}
