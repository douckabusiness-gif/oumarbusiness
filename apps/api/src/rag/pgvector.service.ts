import { prisma } from "../db/prisma.js";
import type { RetrievalResult } from "../memory/memory.types.js";
import { logger } from "../services/logger.js";

export const VECTOR_DIMENSIONS = 256;

function vectorToSqlLiteral(vector: number[]) {
  const normalized = new Array<number>(VECTOR_DIMENSIONS).fill(0);
  for (let index = 0; index < Math.min(vector.length, VECTOR_DIMENSIONS); index += 1) {
    const value = vector[index] ?? 0;
    normalized[index] = Number.isFinite(value) ? value : 0;
  }

  return `[${normalized.map((value) => Number(value.toFixed(8))).join(",")}]`;
}

class PgvectorService {
  private ready = false;

  async ensureReady() {
    if (this.ready) return true;

    try {
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS knowledge_chunk_vectors (
          chunk_id TEXT PRIMARY KEY REFERENCES "KnowledgeChunk"(id) ON DELETE CASCADE,
          embedding vector(${VECTOR_DIMENSIONS}) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS knowledge_chunk_vectors_embedding_idx
        ON knowledge_chunk_vectors
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE knowledge_chunk_vectors
          ALTER COLUMN embedding TYPE vector(${VECTOR_DIMENSIONS})
        `);
      } catch {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE knowledge_chunk_vectors`);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE knowledge_chunk_vectors
          ALTER COLUMN embedding TYPE vector(${VECTOR_DIMENSIONS})
        `);
      }

      this.ready = true;
      logger.info("pgvector ready for knowledge retrieval");
      return true;
    } catch (error) {
      logger.warn({ error }, "pgvector unavailable, retrieval will fall back to lexical scoring");
      this.ready = false;
      return false;
    }
  }

  async upsertChunkVector(chunkId: string, vector: number[]) {
    const ok = await this.ensureReady();
    if (!ok) return false;

    const literal = vectorToSqlLiteral(vector);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO knowledge_chunk_vectors (chunk_id, embedding, updated_at)
      VALUES ($1, $2::vector, NOW())
      ON CONFLICT (chunk_id)
      DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()
      `,
      chunkId,
      literal
    );
    return true;
  }

  async similaritySearch(input: {
    queryVector: number[];
    clientId?: string;
    limit: number;
  }): Promise<RetrievalResult[]> {
    const ok = await this.ensureReady();
    if (!ok) return [];

    const literal = vectorToSqlLiteral(input.queryVector);
    const limit = Math.max(1, Math.min(20, input.limit));

    try {
      if (input.clientId) {
        const rows = await prisma.$queryRawUnsafe(
          `
          SELECT
            kc."documentId" AS "documentId",
            kc.id AS "chunkId",
            kd.title AS title,
            kc.content AS content,
            1 - (kv.embedding <=> $1::vector) AS score,
            kd.scope AS scope,
            kd."clientId" AS "clientId"
          FROM knowledge_chunk_vectors kv
          JOIN "KnowledgeChunk" kc ON kc.id = kv.chunk_id
          JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
          WHERE kd.scope = 'global' OR (kd.scope = 'client' AND kd."clientId" = $2)
          ORDER BY kv.embedding <=> $1::vector
          LIMIT ${limit}
          `,
          literal,
          input.clientId
        );
        return rows as RetrievalResult[];
      }

      const rows = await prisma.$queryRawUnsafe(
        `
        SELECT
          kc."documentId" AS "documentId",
          kc.id AS "chunkId",
          kd.title AS title,
          kc.content AS content,
          1 - (kv.embedding <=> $1::vector) AS score,
          kd.scope AS scope,
          kd."clientId" AS "clientId"
        FROM knowledge_chunk_vectors kv
        JOIN "KnowledgeChunk" kc ON kc.id = kv.chunk_id
        JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
        WHERE kd.scope = 'global'
        ORDER BY kv.embedding <=> $1::vector
        LIMIT ${limit}
        `,
        literal
      );
      return rows as RetrievalResult[];
    } catch (error) {
      logger.warn({ error }, "pgvector similarity search failed, falling back to lexical retrieval");
      return [];
    }
  }
}

export const pgvectorService = new PgvectorService();
