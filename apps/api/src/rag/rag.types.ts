export type ChunkRecord = {
  content: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
};
