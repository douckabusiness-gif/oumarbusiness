import { Router } from "express";
import { Redis } from "ioredis";
import { prisma } from "../../db/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const checks = {
    api: true,
    postgres: false,
    redis: false
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch {
    checks.postgres = false;
  }

  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true
  });
  redis.on("error", () => {
    checks.redis = false;
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    checks.redis = pong === "PONG";
  } catch {
    checks.redis = false;
  } finally {
    redis.disconnect();
  }

  const ok = checks.api && checks.postgres && checks.redis;
  res.status(ok ? 200 : 503).json({
    ok,
    service: "oumar-api",
    checks,
    timestamp: new Date().toISOString()
  });
});
