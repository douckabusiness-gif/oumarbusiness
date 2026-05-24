import type { AgentType, MessageChannel } from "@oumar/shared";

export type MemoryTurnInput = {
  channel: MessageChannel;
  clientId?: string;
  conversationId?: string;
  externalRef?: string;
  title?: string;
  language?: string;
  userText: string;
  agentText?: string;
  agentType?: AgentType;
  metadata?: Record<string, unknown>;
};

export type MemoryMessageView = {
  role: "user" | "agent" | "system";
  content: string;
  createdAt: string;
  agentType?: string | null;
};

export type AgentMemoryContext = {
  sessionId?: string;
  clientId?: string;
  channel: MessageChannel;
  clientProfileSummary?: string;
  clientFacts: string[];
  preferences: string[];
  conversationSummary?: string;
  recentMessages: MemoryMessageView[];
  retrievedKnowledge: Array<{
    title: string;
    content: string;
    score: number;
  }>;
};

export type KnowledgeIngestionInput = {
  title: string;
  type: string;
  scope: "global" | "client";
  source: "upload" | "generated" | "url" | "manual" | "file";
  clientId?: string;
  sourceUrl?: string;
  rawText: string;
  metadata?: Record<string, unknown>;
};

export type RetrievalResult = {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  score: number;
  scope: string;
  clientId?: string | null;
};
