import { prisma } from "../db/prisma.js";
import type { RetrievalResult } from "../memory/memory.types.js";
import { embeddingsService } from "./embeddings.service.js";
import { pgvectorService } from "./pgvector.service.js";
import { logger } from "../services/logger.js";

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function lexicalScore(query: string, content: string) {
  const queryTokens = new Set(tokenize(query));
  const contentTokens = tokenize(content);
  if (!queryTokens.size || !contentTokens.length) return 0;

  let score = 0;
  for (const token of contentTokens) {
    if (queryTokens.has(token)) score += 1;
  }

  return score / Math.max(queryTokens.size, 1);
}

class RetrievalService {
  // Vérifie que le clientId est un vrai Client UUID (évite FK violation avec JIDs WhatsApp/@lid)
  private async resolveClientId(clientId?: string): Promise<string | undefined> {
    if (!clientId) return undefined;
    const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }).catch(() => null);
    return exists ? clientId : undefined;
  }

  async search(input: {
    query: string;
    clientId?: string;
    agentType?: string;
    limit?: number;
  }): Promise<RetrievalResult[]> {
    const safeClientId = await this.resolveClientId(input.clientId);
    let semanticResults: RetrievalResult[] = [];
    try {
      const queryVector = await embeddingsService.embedText(input.query);
      semanticResults = await pgvectorService.similaritySearch({
        queryVector,
        clientId: safeClientId,
        limit: input.limit ?? 5
      });
    } catch (error) {
      logger.warn({ error }, "semantic retrieval failed, falling back to lexical retrieval");
    }

    if (semanticResults.length > 0) {
      await prisma.knowledgeRetrievalLog.create({
        data: {
          clientId: safeClientId,
          agentType: input.agentType ?? "unknown",
          query: input.query,
          chunkIds: semanticResults.map((chunk: RetrievalResult) => chunk.chunkId)
        }
      });

      return semanticResults;
    }

    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        document: input.clientId
          ? {
              OR: [{ scope: "global" }, { scope: "client", clientId: input.clientId }]
            }
          : {
              scope: "global"
            }
      },
      include: { document: true },
      take: 200
    });

    const ranked = chunks
      .map((chunk: { documentId: string; id: string; content: string; document: { title: string; scope: string; clientId: string | null } }) => ({
        documentId: chunk.documentId,
        chunkId: chunk.id,
        title: chunk.document.title,
        content: chunk.content,
        score: lexicalScore(input.query, chunk.content),
        scope: chunk.document.scope,
        clientId: chunk.document.clientId
      }))
      .filter((chunk: RetrievalResult) => chunk.score > 0)
      .sort((left: RetrievalResult, right: RetrievalResult) => right.score - left.score)
      .slice(0, input.limit ?? 5);

    await prisma.knowledgeRetrievalLog.create({
      data: {
        clientId: input.clientId,
        agentType: input.agentType ?? "unknown",
        query: `${input.query} [lexical-fallback]`,
        chunkIds: ranked.map((chunk: RetrievalResult) => chunk.chunkId)
      }
    });

    return ranked;
  }
}

export const retrievalService = new RetrievalService();
