import { prisma } from "../db/prisma.js";

const SUMMARY_WINDOW = 12;

function compactText(value: string, maxLength = 900) {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength - 1)}…`;
}

class SummaryService {
  async refreshSessionSummary(sessionId: string) {
    const messages = await prisma.conversationMemoryMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: SUMMARY_WINDOW
    });

    if (messages.length < 4) return null;

    const orderedMessages = [...messages].reverse();
    const firstMessage = orderedMessages[0];
    const lastMessage = orderedMessages[orderedMessages.length - 1];

    if (!firstMessage || !lastMessage) return null;

    const summary = compactText(
      orderedMessages
        .map((message) => `${message.role === "user" ? "Client" : message.agentType ?? "Agent"}: ${message.content}`)
        .join(" | ")
    );

    const existing = await prisma.conversationSummary.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" }
    });

    if (existing?.summary === summary) return existing;

    return prisma.conversationSummary.create({
      data: {
        sessionId,
        summary,
        rangeStartAt: firstMessage.createdAt,
        rangeEndAt: lastMessage.createdAt
      }
    });
  }
}

export const summaryService = new SummaryService();
