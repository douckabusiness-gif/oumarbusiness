import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../../db/prisma.js";
import { EmailEngine } from "@oumar/email-engine";
import { getRuntimeEmailAccount } from "./settings.js";
import { createRateLimiter, secureCookieEnabled } from "../../services/httpSecurity.js";

export const clientPortalRouter = Router();

const CLIENT_PORTAL_ACCOUNTS_KEY = "client_portal_accounts";
const CLIENT_PORTAL_SESSIONS_KEY = "client_portal_sessions";
const CLIENT_PORTAL_VERIFY_TOKENS_KEY = "client_portal_verify_tokens";
const CLIENT_PORTAL_COOKIE = "ob_client_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const VERIFY_TOKEN_DURATION_MS = 1000 * 60 * 60 * 24;

type ClientPortalAccount = {
  id: string;
  name: string;
  email: string;
  company: string;
  passwordHash: string;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

type ClientPortalSession = {
  id: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
};

type ClientPortalVerifyToken = {
  id: string;
  accountId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseAccount(value: unknown): ClientPortalAccount | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  const email = typeof value.email === "string" ? value.email : "";
  const company = typeof value.company === "string" ? value.company : "";
  const passwordHash = typeof value.passwordHash === "string" ? value.passwordHash : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const verifiedAt =
    typeof value.verifiedAt === "string"
      ? value.verifiedAt
      : Object.prototype.hasOwnProperty.call(value, "verifiedAt")
        ? ""
        : createdAt;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;

  if (!id || !name || !email || !passwordHash || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    name,
    email,
    company,
    passwordHash,
    verifiedAt,
    createdAt,
    updatedAt
  };
}

function parseSession(value: unknown): ClientPortalSession | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const accountId = typeof value.accountId === "string" ? value.accountId : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : "";

  if (!id || !accountId || !createdAt || !expiresAt) {
    return null;
  }

  return { id, accountId, createdAt, expiresAt };
}

function parseVerifyToken(value: unknown): ClientPortalVerifyToken | null {
  if (!isObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const accountId = typeof value.accountId === "string" ? value.accountId : "";
  const email = typeof value.email === "string" ? value.email : "";
  const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";

  if (!id || !accountId || !email || !expiresAt || !createdAt) {
    return null;
  }

  return { id, accountId, email, expiresAt, createdAt };
}

async function loadAccounts() {
  const stored = await prisma.appSetting.findUnique({ where: { key: CLIENT_PORTAL_ACCOUNTS_KEY } }).catch(() => null);
  if (!stored) return [] as ClientPortalAccount[];

  const raw: unknown[] = Array.isArray(stored.value) ? stored.value : [];
  return raw.map(parseAccount).filter((item: ClientPortalAccount | null): item is ClientPortalAccount => Boolean(item));
}

async function saveAccounts(accounts: ClientPortalAccount[]) {
  await prisma.appSetting.upsert({
    where: { key: CLIENT_PORTAL_ACCOUNTS_KEY },
    update: { value: accounts as unknown as object },
    create: { key: CLIENT_PORTAL_ACCOUNTS_KEY, value: accounts as unknown as object }
  });
}

async function loadSessions() {
  const stored = await prisma.appSetting.findUnique({ where: { key: CLIENT_PORTAL_SESSIONS_KEY } }).catch(() => null);
  if (!stored) return [] as ClientPortalSession[];

  const raw: unknown[] = Array.isArray(stored.value) ? stored.value : [];
  const now = Date.now();
  return raw
    .map(parseSession)
    .filter((item: ClientPortalSession | null): item is ClientPortalSession => Boolean(item))
    .filter((item: ClientPortalSession) => new Date(item.expiresAt).getTime() > now);
}

async function saveSessions(sessions: ClientPortalSession[]) {
  await prisma.appSetting.upsert({
    where: { key: CLIENT_PORTAL_SESSIONS_KEY },
    update: { value: sessions as unknown as object },
    create: { key: CLIENT_PORTAL_SESSIONS_KEY, value: sessions as unknown as object }
  });
}

async function loadVerifyTokens() {
  const stored = await prisma.appSetting.findUnique({ where: { key: CLIENT_PORTAL_VERIFY_TOKENS_KEY } }).catch(() => null);
  if (!stored) return [] as ClientPortalVerifyToken[];

  const raw: unknown[] = Array.isArray(stored.value) ? stored.value : [];
  const now = Date.now();
  return raw
    .map(parseVerifyToken)
    .filter((item: ClientPortalVerifyToken | null): item is ClientPortalVerifyToken => Boolean(item))
    .filter((item: ClientPortalVerifyToken) => new Date(item.expiresAt).getTime() > now);
}

async function saveVerifyTokens(tokens: ClientPortalVerifyToken[]) {
  await prisma.appSetting.upsert({
    where: { key: CLIENT_PORTAL_VERIFY_TOKENS_KEY },
    update: { value: tokens as unknown as object },
    create: { key: CLIENT_PORTAL_VERIFY_TOKENS_KEY, value: tokens as unknown as object }
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;

  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function parseCookieHeader(cookieHeader?: string) {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getSessionIdFromRequest(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[CLIENT_PORTAL_COOKIE] ?? "";
}

function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(CLIENT_PORTAL_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/",
    maxAge: SESSION_DURATION_MS
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(CLIENT_PORTAL_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled(),
    path: "/"
  });
}

function toPublicAccount(account: ClientPortalAccount) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    company: account.company,
    verified: Boolean(account.verifiedAt),
    createdAt: account.createdAt
  };
}

async function resolveAuthenticatedAccount(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return null;
  }

  const [accounts, sessions] = await Promise.all([loadAccounts(), loadSessions()]);
  const session = sessions.find((item: ClientPortalSession) => item.id === sessionId);
  if (!session) {
    return null;
  }

  const account = accounts.find((item: ClientPortalAccount) => item.id === session.accountId);
  return account && account.verifiedAt ? account : null;
}

function getPublicAppUrl(req: Request) {
  return (process.env.APP_URL ?? req.get("origin") ?? req.get("referer") ?? "http://localhost:1010").replace(/\/$/, "");
}

async function sendClientVerificationEmail(req: Request, account: ClientPortalAccount, tokenId: string) {
  const appUrl = getPublicAppUrl(req);
  const verifyUrl = `${appUrl}/client/verify-email?token=${tokenId}`;
  const runtimeEmail = await getRuntimeEmailAccount("main");
  const engine = new EmailEngine();

  await engine.send({
    account: runtimeEmail,
    from: `${runtimeEmail.name ?? "Oumar Business"} <${runtimeEmail.email}>`,
    to: [account.email],
    subject: "Confirmez votre email client",
    text: `Bonjour ${account.name},\n\nConfirmez votre email pour activer votre espace client :\n${verifyUrl}\n\nCe lien expire dans 24 heures.`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#0e0e0e;color:#fff;border-radius:16px">
      <h2 style="color:#d4a020;margin:0 0 16px">Confirmez votre email</h2>
      <p>Bonjour <strong>${account.name}</strong>,</p>
      <p>Confirmez votre email pour activer votre espace client.</p>
      <a href="${verifyUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#d4a020;color:#000;border-radius:12px;font-weight:bold;text-decoration:none">Confirmer mon email</a>
      <p style="color:#888;font-size:12px">Ce lien expire dans 24 heures.</p>
    </div>`
  });
}

const clientAuthRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Trop de tentatives. Reessayez dans quelques minutes.",
  keyPrefix: "client-auth"
});

clientPortalRouter.post("/register", clientAuthRateLimit, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const company = typeof req.body?.company === "string" ? req.body.company.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (name.length < 2) {
      return res.status(400).json({ error: "Le nom est obligatoire." });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Email invalide." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caracteres." });
    }

    const accounts = await loadAccounts();
    if (accounts.some((item: ClientPortalAccount) => item.email === email)) {
      return res.status(400).json({ error: "Un compte client existe deja avec cet email." });
    }

    const now = new Date().toISOString();
    const account: ClientPortalAccount = {
      id: randomUUID(),
      name,
      email,
      company,
      passwordHash: hashPassword(password),
      verifiedAt: "",
      createdAt: now,
      updatedAt: now
    };
    const tokenId = randomBytes(32).toString("hex");
    const verifyTokens = await loadVerifyTokens();
    const nextToken: ClientPortalVerifyToken = {
      id: tokenId,
      accountId: account.id,
      email: account.email,
      createdAt: now,
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_DURATION_MS).toISOString()
    };

    try {
      await sendClientVerificationEmail(req, account, tokenId);
    } catch {
      return res.status(502).json({ error: "Impossible d'envoyer l'email de confirmation pour le moment." });
    }

    await saveAccounts([account, ...accounts]);
    await saveVerifyTokens([...verifyTokens.filter((item) => item.email !== account.email), nextToken]);

    clearSessionCookie(res);
    res.status(201).json({ ok: true, requiresVerification: true, email: account.email });
  } catch (error) {
    next(error);
  }
});

clientPortalRouter.post("/login", clientAuthRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const accounts = await loadAccounts();
    const account = accounts.find((item: ClientPortalAccount) => item.email === email);

    if (!account || !verifyPassword(password, account.passwordHash)) {
      return res.status(401).json({ error: "Email ou mot de passe invalide." });
    }
    if (!account.verifiedAt) {
      return res.status(403).json({
        error: "Confirmez votre email avant de vous connecter.",
        code: "EMAIL_NOT_VERIFIED"
      });
    }

    const now = new Date().toISOString();
    const session: ClientPortalSession = {
      id: randomUUID(),
      accountId: account.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    };

    const sessions = await loadSessions();
    await saveSessions([session, ...sessions.filter((item: ClientPortalSession) => item.accountId !== account.id)]);
    setSessionCookie(res, session.id);

    res.json({ ok: true, account: toPublicAccount(account) });
  } catch (error) {
    next(error);
  }
});

clientPortalRouter.post("/resend-verification", clientAuthRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    if (!email.includes("@")) return res.status(400).json({ error: "Email invalide." });

    const accounts = await loadAccounts();
    const account = accounts.find((item: ClientPortalAccount) => item.email === email);
    if (!account || account.verifiedAt) {
      return res.json({ ok: true });
    }

    const now = new Date().toISOString();
    const tokenId = randomBytes(32).toString("hex");
    const verifyTokens = await loadVerifyTokens();
    const nextToken: ClientPortalVerifyToken = {
      id: tokenId,
      accountId: account.id,
      email: account.email,
      createdAt: now,
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_DURATION_MS).toISOString()
    };

    await sendClientVerificationEmail(req, account, tokenId);
    await saveVerifyTokens([...verifyTokens.filter((item) => item.accountId !== account.id), nextToken]);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

clientPortalRouter.post("/verify-email", clientAuthRateLimit, async (req, res, next) => {
  try {
    const tokenId = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!tokenId) return res.status(400).json({ error: "Token manquant." });

    const [accounts, tokens] = await Promise.all([loadAccounts(), loadVerifyTokens()]);
    const token = tokens.find((item) => item.id === tokenId);
    if (!token) return res.status(400).json({ error: "Lien invalide ou deja utilise." });

    const accountIndex = accounts.findIndex((item: ClientPortalAccount) => item.id === token.accountId);
    if (accountIndex === -1) {
      await saveVerifyTokens(tokens.filter((item) => item.id !== tokenId));
      return res.status(404).json({ error: "Compte introuvable." });
    }

    const now = new Date().toISOString();
    accounts[accountIndex] = {
      ...accounts[accountIndex]!,
      verifiedAt: now,
      updatedAt: now
    };

    await saveAccounts(accounts);
    await saveVerifyTokens(tokens.filter((item) => item.id !== tokenId));
    clearSessionCookie(res);

    res.json({ ok: true, account: toPublicAccount(accounts[accountIndex]!) });
  } catch (error) {
    next(error);
  }
});

clientPortalRouter.post("/logout", async (req, res, next) => {
  try {
    const sessionId = getSessionIdFromRequest(req);
    if (sessionId) {
      const sessions = await loadSessions();
      await saveSessions(sessions.filter((item: ClientPortalSession) => item.id !== sessionId));
    }

    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

clientPortalRouter.get("/session", async (req, res, next) => {
  try {
    const account = await resolveAuthenticatedAccount(req);

    if (!account) {
      clearSessionCookie(res);
      return res.status(401).json({ authenticated: false });
    }

    res.json({ authenticated: true, account: toPublicAccount(account) });
  } catch (error) {
    next(error);
  }
});
