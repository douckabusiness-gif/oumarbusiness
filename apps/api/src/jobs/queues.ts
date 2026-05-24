import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const redisConnection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

export const agentQueue = new Queue("agent-jobs", { connection: redisConnection });
export const communicationQueue = new Queue("communication-jobs", { connection: redisConnection });
export const billingQueue = new Queue("billing-jobs", { connection: redisConnection });
