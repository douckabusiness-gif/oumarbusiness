import type { AgentInput } from "@oumar/shared";
import { clientMemoryService } from "./client-memory.service.js";
import { conversationMemoryService } from "./conversation-memory.service.js";
import { summaryService } from "./summary.service.js";
import type { AgentMemoryContext, MemoryTurnInput } from "./memory.types.js";
import { retrievalService } from "../rag/retrieval.service.js";

class MemoryService {
  async buildContext(input: {
    channel: AgentInput["channel"];
    clientId?: string;
    conversationId?: string;
    externalRef?: string;
    language?: string;
    latestUserText?: string;
    agentType?: string;
  }): Promise<AgentMemoryContext> {
    const session = await conversationMemoryService.getOrCreateSession({
      channel: input.channel,
      clientId: input.clientId,
      conversationId: input.conversationId,
      externalRef: input.externalRef,
      language: input.language
    });

    const [recentMessages, latestSummary, clientProfile, retrievedKnowledge] = await Promise.all([
      conversationMemoryService.getRecentMessages(session.id, 10),
      conversationMemoryService.getLatestSummary(session.id),
      input.clientId ? clientMemoryService.getProfile(input.clientId) : Promise.resolve(null),
      input.latestUserText
        ? retrievalService.search({
            query: input.latestUserText,
            clientId: input.clientId,
            agentType: input.agentType,
            limit: 4
          })
        : Promise.resolve([])
    ]);

    return {
      sessionId: session.id,
      clientId: input.clientId,
      channel: input.channel,
      clientProfileSummary: clientProfile?.profileSummary ?? undefined,
      clientFacts: clientProfile?.facts.slice(0, 6).map((fact: { fact: string }) => fact.fact) ?? [],
      preferences:
        clientProfile?.preferences
          .slice(0, 6)
          .map((preference: { key: string; value: string }) => `${preference.key}: ${preference.value}`) ?? [],
      conversationSummary: latestSummary?.summary,
      recentMessages: recentMessages
        .reverse()
        .map((message: { role: string; content: string; createdAt: Date; agentType: string | null }) => ({
          role: message.role as "user" | "agent" | "system",
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          agentType: message.agentType
        })),
      retrievedKnowledge: retrievedKnowledge.map((item) => ({
        title: item.title,
        content: item.content,
        score: item.score
      }))
    };
  }

  async captureTurn(input: MemoryTurnInput) {
    const session = await conversationMemoryService.getOrCreateSession({
      channel: input.channel,
      clientId: input.clientId,
      conversationId: input.conversationId,
      externalRef: input.externalRef,
      title: input.title,
      language: input.language
    });

    await conversationMemoryService.appendMessage({
      sessionId: session.id,
      role: "user",
      content: input.userText,
      metadata: input.metadata
    });

    if (input.agentText) {
      await conversationMemoryService.appendMessage({
        sessionId: session.id,
        role: "agent",
        content: input.agentText,
        agentType: input.agentType,
        metadata: input.metadata
      });
    }

    await Promise.all([
      summaryService.refreshSessionSummary(session.id),
      clientMemoryService.rememberTurn({
        clientId: input.clientId,
        channel: input.channel,
        userText: input.userText,
        language: input.language
      })
    ]);

    return session;
  }
}

export const memoryService = new MemoryService();
