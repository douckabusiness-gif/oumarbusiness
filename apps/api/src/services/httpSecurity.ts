import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function secureCookieEnabled() {
  return process.env.NODE_ENV === "production";
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix?: string;
}) {
  const attempts = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const forwardedFor = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
    const ip = forwardedFor || req.socket.remoteAddress || req.ip || "unknown";
    const key = `${options.keyPrefix ?? "rate"}:${ip}`;
    const current = attempts.get(key);

    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.max) {
      res.status(429).json({ error: options.message });
      return;
    }

    current.count += 1;
    attempts.set(key, current);
    next();
  };
}
