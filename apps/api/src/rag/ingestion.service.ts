import { prisma } from "../db/prisma.js";
import type { KnowledgeIngestionInput } from "../memory/memory.types.js";
import { chunkingService } from "./chunking.service.js";
import { embeddingsService } from "./embeddings.service.js";
import { pgvectorService } from "./pgvector.service.js";

class KnowledgeIngestionService {
  async ingestDocument(input: KnowledgeIngestionInput) {
    const document = await prisma.knowledgeDocument.create({
      data: {
        title: input.title,
        type: input.type,
        scope: input.scope,
        clientId: input.clientId,
        source: input.source,
        sourceUrl: input.sourceUrl,
        rawText: input.rawText,
        status: "processing",
        metadata: input.metadata as never
      }
    });

    const chunks = chunkingService.split(input.rawText);

    for (const chunk of chunks) {
      const embedding = await embeddingsService.embedText(chunk.content);
      const savedChunk = await prisma.knowledgeChunk.create({
        data: {
          documentId: document.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          metadata: chunk.metadata as never,
          embedding: embedding as never
        }
      });
      await pgvectorService.upsertChunkVector(savedChunk.id, embedding);
    }

    return prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { status: "ready" },
      include: {
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true
          }
        }
      }
    });
  }

  async listDocuments() {
    return prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        chunks: {
          select: { id: true }
        }
      }
    });
  }
}

export const knowledgeIngestionService = new KnowledgeIngestionService();
