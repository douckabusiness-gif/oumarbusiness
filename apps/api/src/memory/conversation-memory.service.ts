import type { MessageChannel } from "@oumar/shared";
import { prisma } from "../db/prisma.js";

type SessionLookupInput = {
  channel: MessageChannel;
  clientId?: string;
  conversationId?: string;
  externalRef?: string;
  title?: string;
  language?: string;
};

type AppendMessageInput = {
  sessionId: string;
  role: "user" | "agent" | "system";
  content: string;
  agentType?: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
};

class ConversationMemoryService {
  // Vérifie que le clientId est un vrai Client en base (évite FK violation avec JIDs WhatsApp)
  private async resolveClientId(clientId?: string): Promise<string | undefined> {
    if (!clientId) return undefined;
    const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }).catch(() => null);
    return exists ? clientId : undefined;
  }

  async getOrCreateSession(input: SessionLookupInput) {
    const externalRef = input.externalRef ?? input.conversationId;
    const safeClientId = await this.resolveClientId(input.clientId);

    if (input.conversationId) {
      const byId = await prisma.conversationSession.findUnique({
        where: { id: input.conversationId }
      });
      if (byId) return byId;
    }

    if (externalRef) {
      const byExternal = await prisma.conversationSession.findFirst({
        where: {
          channel: input.channel,
          externalRef
        }
      });

      if (byExternal) {
        return prisma.conversationSession.update({
          where: { id: byExternal.id },
          data: {
            clientId: safeClientId ?? byExternal.clientId,
            title: input.title ?? byExternal.title,
            language: input.language ?? byExternal.language
          }
        });
      }
    }

    if (safeClientId) {
      const byClient = await prisma.conversationSession.findFirst({
        where: {
          clientId: safeClientId,
          channel: input.channel,
          status: "active"
        },
        orderBy: { updatedAt: "desc" }
      });

      if (byClient) {
        return prisma.conversationSession.update({
          where: { id: byClient.id },
          data: {
            externalRef: externalRef ?? byClient.externalRef,
            title: input.title ?? byClient.title,
            language: input.language ?? byClient.language
          }
        });
      }
    }

    return prisma.conversationSession.create({
      data: {
        clientId: safeClientId,
        channel: input.channel,
        externalRef,
        title: input.title,
        language: input.language ?? "fr",
        status: "active"
      }
    });
  }

  async appendMessage(input: AppendMessageInput) {
    const message = await prisma.conversationMemoryMessage.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        agentType: input.agentType,
        messageType: input.messageType ?? "text",
        metadata: input.metadata as never
      }
    });

    await prisma.conversationSession.update({
      where: { id: input.sessionId },
      data: { lastMessageAt: message.createdAt }
    });

    return message;
  }

  async getRecentMessages(sessionId: string, limit = 12) {
    return prisma.conversationMemoryMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async getLatestSummary(sessionId: string) {
    return prisma.conversationSummary.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" }
    });
  }
}

export const conversationMemoryService = new ConversationMemoryService();
