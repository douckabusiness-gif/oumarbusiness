import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../db/prisma.js";
import { createRateLimiter, secureCookieEnabled } from "../../services/httpSecurity.js";

export const adminAuthRouter = Router();

const ADMIN_SESSIONS_KEY = "admin_portal_sessions";
const ADMIN_COOKIE = "ob_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

type AdminSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSession(value: unknown): AdminSession | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const userId = typeof value.userId === "string" ? value.userId : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : "";
  if (!id || !userId || !createdAt || !expiresAt) return null;
  return { id, userId, createdAt, expiresAt };
}

async function loadSessions() {
  const stored = await prisma.appSetting.findUnique({ where: { key: ADMIN_SESSIONS_KEY } }).catch(() => null);
  if (!stored) return [] as AdminSession[];
  const now = Date.now();
  const raw = Array.isArray(stored.value) ? stored.value : [];
  return raw
    .map(parseSession)
    .filter((item: AdminSession | null): item is AdminSession => Boolean(item))
    .filter((item: AdminSession) => new Date(item.expiresAt).getTime() > now);
}

async function saveSessions(items: AdminSession[]) {
  await prisma.appSetting.upsert({
    where: { key: ADMIN_SESSIONS_KEY },
    update: { value: items as unknown as object },
    create: { key: ADMIN_SESSIONS_KEY, value: items as unknown as object }
  });
}

function parseCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) return {} as Record<string, string>;
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getSessionIdFromRequest(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[ADMIN_COOKIE] ?? "";
}

function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(ADMIN_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/",
    maxAge: SESSION_DURATION_MS
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(ADMIN_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/"
  });
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;

  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function isAdminRole(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function toPublicUser(user: { id: string; email: string; name: string; role: string; isActive: boolean }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive
  };
}

export async function resolveAuthenticatedAdmin(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;
  const sessions = await loadSessions();
  const session = sessions.find((item: AdminSession) => item.id === sessionId);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, isActive: true }
  });
  if (!user || !user.isActive || !isAdminRole(user.role)) return null;
  return user;
}

export async function requireAuthenticatedAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await resolveAuthenticatedAdmin(req);
    if (!admin) {
      clearSessionCookie(res);
      res.status(401).json({ error: "Acces admin requis." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

const adminLoginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Trop de tentatives. Reessayez dans quelques minutes.",
  keyPrefix: "admin-login"
});

adminAuthRouter.post("/login", adminLoginRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email et mot de passe requis." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, isActive: true, password: true }
    });

    if (!user || !user.password || !user.isActive || !isAdminRole(user.role) || !verifyPassword(password, user.password)) {
      return res.status(401).json({ ok: false, error: "Identifiants admin invalides." });
    }

    const session: AdminSession = {
      id: randomUUID(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    };

    const sessions = await loadSessions();
    await saveSessions([session, ...sessions.filter((item: AdminSession) => item.userId !== user.id)]);
    setSessionCookie(res, session.id);

    res.json({ ok: true, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.post("/logout", async (req, res, next) => {
  try {
    const sessionId = getSessionIdFromRequest(req);
    if (sessionId) {
      const sessions = await loadSessions();
      await saveSessions(sessions.filter((item: AdminSession) => item.id !== sessionId));
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.get("/session", async (req, res, next) => {
  try {
    const user = await resolveAuthenticatedAdmin(req);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ authenticated: false });
    }

    res.json({ authenticated: true, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});
