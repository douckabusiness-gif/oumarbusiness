import type { ChunkRecord } from "./rag.types.js";

const TARGET_CHUNK_SIZE = 700;

class ChunkingService {
  split(text: string): ChunkRecord[] {
    const normalized = text.replace(/\r/g, "").trim();
    if (!normalized) return [];

    const paragraphs = normalized
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const chunks: ChunkRecord[] = [];
    let buffer = "";
    let chunkIndex = 0;

    const flush = () => {
      const content = buffer.trim();
      if (!content) return;
      chunks.push({
        chunkIndex,
        content
      });
      chunkIndex += 1;
      buffer = "";
    };

    for (const paragraph of paragraphs) {
      if (`${buffer}\n\n${paragraph}`.trim().length > TARGET_CHUNK_SIZE && buffer) {
        flush();
      }
      buffer = `${buffer}\n\n${paragraph}`.trim();
    }

    flush();
    return chunks;
  }
}

export const chunkingService = new ChunkingService();
