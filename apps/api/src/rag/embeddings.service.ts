import { logger } from "../services/logger.js";
import { getEmbeddingProviderConfig } from "../routes/modules/settings.js";
import { VECTOR_DIMENSIONS } from "./pgvector.service.js";

class EmbeddingsService {
  private readonly dimensions = VECTOR_DIMENSIONS;
  private remoteReady = false;

  async embedText(text: string) {
    const normalized = text.trim();
    if (!normalized) return new Array<number>(this.dimensions).fill(0);

    const remote = await this.tryRemoteEmbedding(normalized);
    if (remote) return this.normalizeVector(remote);

    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = normalized
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);

    if (tokens.length === 0) return vector;

    for (const token of tokens) {
      let hash = 2166136261;
      for (let index = 0; index < token.length; index += 1) {
        hash ^= token.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }

      const slot = Math.abs(hash) % this.dimensions;
      const sign = (hash >>> 1) % 2 === 0 ? 1 : -1;
      vector[slot] = (vector[slot] ?? 0) + sign;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) return vector;

    return vector.map((value) => value / magnitude);
  }

  private async tryRemoteEmbedding(text: string) {
    const provider = getEmbeddingProviderConfig();
    if (!provider) return null;

    try {
      const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/v1/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.model,
          input: text
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Embedding provider ${provider.name} a renvoye ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const embedding = payload.data?.[0]?.embedding;
      if (!embedding?.length) return null;

      if (!this.remoteReady) {
        logger.info({ provider: provider.name, model: provider.model }, "remote embedding provider enabled");
        this.remoteReady = true;
      }

      return embedding;
    } catch (error) {
      logger.warn({ error }, "remote embedding failed, falling back to local vectorizer");
      return null;
    }
  }

  private normalizeVector(values: number[]) {
    const vector = new Array<number>(this.dimensions).fill(0);
    for (let index = 0; index < Math.min(values.length, this.dimensions); index += 1) {
      vector[index] = values[index] ?? 0;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) return vector;
    return vector.map((value) => value / magnitude);
  }
}

export const embeddingsService = new EmbeddingsService();
