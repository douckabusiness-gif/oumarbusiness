import { Router } from "express";
import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { prisma } from "../../db/prisma.js";

export const notificationsRouter = Router();

const NOTIFICATIONS_SETTINGS_KEY = "web-push-settings";
const NOTIFICATIONS_SUBSCRIPTIONS_KEY = "web-push-subscriptions";
const NOTIFICATIONS_JOURNAL_KEY = "web-push-journal";

type WebPushSettings = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  enabled: boolean;
  contactEmail: string;
  lastTestAt?: string;
};

type WebPushSubscriptionRecord = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
  lastUsedAt?: string;
  userAgent?: string;
  label?: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  source?: string;
};

type NotificationJournalEntry = {
  id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  source: string;
  status: "sent" | "failed" | "skipped";
  reason: string;
  sentCount: number;
  removedCount: number;
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSubscription(value: unknown): WebPushSubscriptionRecord | null {
  const source = asRecord(value);
  const keys = asRecord(source.keys);
  const endpoint = asString(source.endpoint);
  const p256dh = asString(keys.p256dh);
  const auth = asString(keys.auth);
  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    keys: { p256dh, auth },
    createdAt: asString(source.createdAt, new Date().toISOString()),
    lastUsedAt: asString(source.lastUsedAt) || undefined,
    userAgent: asString(source.userAgent) || undefined,
    label: asString(source.label) || undefined
  };
}

export async function readPushSubscriptions() {
  const stored = await prisma.appSetting.findUnique({ where: { key: NOTIFICATIONS_SUBSCRIPTIONS_KEY } }).catch(() => null);
  if (!Array.isArray(stored?.value)) {
    return [] as WebPushSubscriptionRecord[];
  }
  return stored.value
    .map(normalizeSubscription)
    .filter((item: WebPushSubscriptionRecord | null): item is WebPushSubscriptionRecord => Boolean(item));
}

async function writeSubscriptions(items: WebPushSubscriptionRecord[]) {
  await prisma.appSetting.upsert({
    where: { key: NOTIFICATIONS_SUBSCRIPTIONS_KEY },
    update: { value: items as never },
    create: { key: NOTIFICATIONS_SUBSCRIPTIONS_KEY, value: items as never }
  });
}

function defaultSettings(): WebPushSettings {
  return {
    vapidPublicKey: "",
    vapidPrivateKey: "",
    enabled: true,
    contactEmail: process.env.MAIN_SMTP_USER || "support@oumar-business.com"
  };
}

function normalizeSettings(value: unknown): WebPushSettings {
  const source = asRecord(value);
  const defaults = defaultSettings();
  return {
    vapidPublicKey: asString(source.vapidPublicKey, defaults.vapidPublicKey),
    vapidPrivateKey: asString(source.vapidPrivateKey, defaults.vapidPrivateKey),
    enabled: asBoolean(source.enabled, defaults.enabled),
    contactEmail: asString(source.contactEmail, defaults.contactEmail),
    lastTestAt: asString(source.lastTestAt) || undefined
  };
}

async function writeSettings(value: WebPushSettings) {
  await prisma.appSetting.upsert({
    where: { key: NOTIFICATIONS_SETTINGS_KEY },
    update: { value: value as never },
    create: { key: NOTIFICATIONS_SETTINGS_KEY, value: value as never }
  });
}

export async function loadPushSettings() {
  const stored = await prisma.appSetting.findUnique({ where: { key: NOTIFICATIONS_SETTINGS_KEY } }).catch(() => null);
  const current = normalizeSettings(stored?.value);

  if (current.vapidPublicKey && current.vapidPrivateKey) {
    webpush.setVapidDetails(`mailto:${current.contactEmail}`, current.vapidPublicKey, current.vapidPrivateKey);
    return current;
  }

  const envPublic = asString(process.env.WEB_PUSH_VAPID_PUBLIC_KEY);
  const envPrivate = asString(process.env.WEB_PUSH_VAPID_PRIVATE_KEY);
  if (envPublic && envPrivate) {
    const next = {
      ...current,
      vapidPublicKey: envPublic,
      vapidPrivateKey: envPrivate
    };
    webpush.setVapidDetails(`mailto:${next.contactEmail}`, next.vapidPublicKey, next.vapidPrivateKey);
    return next;
  }

  const generated = webpush.generateVAPIDKeys();
  const next: WebPushSettings = {
    ...current,
    vapidPublicKey: generated.publicKey,
    vapidPrivateKey: generated.privateKey
  };
  await writeSettings(next);
  webpush.setVapidDetails(`mailto:${next.contactEmail}`, next.vapidPublicKey, next.vapidPrivateKey);
  return next;
}

function serializeSettings(settings: WebPushSettings, subscriptionCount: number) {
  return {
    enabled: settings.enabled,
    vapidPublicKey: settings.vapidPublicKey,
    contactEmail: settings.contactEmail,
    subscriptionCount,
    lastTestAt: settings.lastTestAt ?? null
  };
}

function createPayload(body: Partial<PushPayload>): PushPayload {
  return {
    title: asString(body.title, "Oumar Business"),
    body: asString(body.body, "Nouvelle notification"),
    url: asString(body.url, "/overview") || "/overview",
    tag: asString(body.tag, "oumar-business"),
    icon: asString(body.icon, "/icon?size=192") || "/icon?size=192",
    badge: asString(body.badge, "/icon?size=192") || "/icon?size=192",
    source: asString(body.source, "system") || "system"
  };
}

async function appendNotificationJournal(entry: NotificationJournalEntry) {
  const stored = await prisma.appSetting.findUnique({ where: { key: NOTIFICATIONS_JOURNAL_KEY } }).catch(() => null);
  const current = Array.isArray(stored?.value) ? (stored.value as NotificationJournalEntry[]) : [];
  const next = [entry, ...current].slice(0, 80);

  await prisma.appSetting.upsert({
    where: { key: NOTIFICATIONS_JOURNAL_KEY },
    update: { value: next as never },
    create: { key: NOTIFICATIONS_JOURNAL_KEY, value: next as never }
  });
}

async function readNotificationJournal(limit = 30) {
  const stored = await prisma.appSetting.findUnique({ where: { key: NOTIFICATIONS_JOURNAL_KEY } }).catch(() => null);
  const current = Array.isArray(stored?.value) ? (stored.value as NotificationJournalEntry[]) : [];
  return current.slice(0, Math.max(1, Math.min(limit, 80)));
}

async function sendToSubscriptions(subscriptions: WebPushSubscriptionRecord[], payload: PushPayload) {
  const staleEndpoints = new Set<string>();
  let sentCount = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      sentCount += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.add(subscription.endpoint);
      } else {
        throw error;
      }
    }
  }

  return { sentCount, staleEndpoints };
}

export async function sendBusinessPushNotification(body: Partial<PushPayload>) {
  const settings = await loadPushSettings();
  const payload = createPayload(body);

  if (!settings.enabled) {
    await appendNotificationJournal({
      id: randomUUID(),
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      source: payload.source ?? "system",
      status: "skipped",
      reason: "disabled",
      sentCount: 0,
      removedCount: 0,
      createdAt: new Date().toISOString()
    });
    return { ok: false, reason: "disabled", sentCount: 0 };
  }

  const subscriptions = await readPushSubscriptions();
  if (subscriptions.length === 0) {
    await appendNotificationJournal({
      id: randomUUID(),
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      source: payload.source ?? "system",
      status: "skipped",
      reason: "no_subscriptions",
      sentCount: 0,
      removedCount: 0,
      createdAt: new Date().toISOString()
    });
    return { ok: false, reason: "no_subscriptions", sentCount: 0 };
  }

  const result = await sendToSubscriptions(subscriptions, payload);
  if (result.staleEndpoints.size > 0) {
    const nextSubscriptions = subscriptions.filter((item: WebPushSubscriptionRecord) => !result.staleEndpoints.has(item.endpoint));
    await writeSubscriptions(nextSubscriptions);
  }

  await appendNotificationJournal({
    id: randomUUID(),
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    source: payload.source ?? "system",
    status: "sent",
    reason: "sent",
    sentCount: result.sentCount,
    removedCount: result.staleEndpoints.size,
    createdAt: new Date().toISOString()
  });

  return {
    ok: true,
    reason: "sent",
    sentCount: result.sentCount,
    removedCount: result.staleEndpoints.size
  };
}

export async function sendBusinessPushNotificationSafe(body: Partial<PushPayload>) {
  try {
    return await sendBusinessPushNotification(body);
  } catch (error) {
    const payload = createPayload(body);
    await appendNotificationJournal({
      id: randomUUID(),
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      source: payload.source ?? "system",
      status: "failed",
      reason: error instanceof Error ? error.message : "push_error",
      sentCount: 0,
      removedCount: 0,
      createdAt: new Date().toISOString()
    }).catch(() => undefined);

    return {
      ok: false,
      reason: error instanceof Error ? error.message : "push_error",
      sentCount: 0
    };
  }
}

notificationsRouter.get("/", async (_req, res, next) => {
  try {
    const [settings, subscriptions] = await Promise.all([loadPushSettings(), readPushSubscriptions()]);
    res.json({
      ok: true,
      settings: serializeSettings(settings, subscriptions.length)
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/history", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 80);
    const entries = await readNotificationJournal(limit);
    res.json({ ok: true, entries });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/subscribe", async (req, res, next) => {
  try {
    const subscription = normalizeSubscription(req.body?.subscription);
    if (!subscription) {
      res.status(400).json({ ok: false, error: "Abonnement push invalide." });
      return;
    }

    const userAgent = asString(req.body?.userAgent);
    const label = asString(req.body?.label);
    const subscriptions = await readPushSubscriptions();
    const now = new Date().toISOString();
    const nextRecord: WebPushSubscriptionRecord = {
      ...subscription,
      createdAt: subscription.createdAt || now,
      lastUsedAt: now,
      userAgent: userAgent || subscription.userAgent,
      label: label || subscription.label
    };

    const nextSubscriptions = subscriptions
      .filter((item: WebPushSubscriptionRecord) => item.endpoint !== subscription.endpoint)
      .concat(nextRecord);

    await writeSubscriptions(nextSubscriptions);

    res.json({
      ok: true,
      subscribed: true,
      subscriptionCount: nextSubscriptions.length
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.delete("/subscribe", async (req, res, next) => {
  try {
    const endpoint = asString(req.body?.endpoint);
    if (!endpoint) {
      res.status(400).json({ ok: false, error: "Endpoint manquant." });
      return;
    }

    const subscriptions = await readPushSubscriptions();
    const nextSubscriptions = subscriptions.filter((item: WebPushSubscriptionRecord) => item.endpoint !== endpoint);
    await writeSubscriptions(nextSubscriptions);

    res.json({
      ok: true,
      subscribed: false,
      subscriptionCount: nextSubscriptions.length
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/test", async (req, res, next) => {
  try {
    const endpoint = asString(req.body?.endpoint);
    const settings = await loadPushSettings();
    if (!settings.enabled) {
      res.status(400).json({ ok: false, error: "Les notifications push sont desactivees." });
      return;
    }

    const subscriptions = await readPushSubscriptions();
    const targets = endpoint
      ? subscriptions.filter((item: WebPushSubscriptionRecord) => item.endpoint === endpoint)
      : subscriptions;
    if (targets.length === 0) {
      res.status(400).json({ ok: false, error: "Aucun appareil abonne pour ce test." });
      return;
    }

    const payload = createPayload({
      title: req.body?.title,
      body: req.body?.body,
      url: req.body?.url,
      tag: "push-test"
    });

    const result = await sendToSubscriptions(targets, payload);
    let nextSubscriptions = subscriptions;
    if (result.staleEndpoints.size > 0) {
      nextSubscriptions = subscriptions.filter((item: WebPushSubscriptionRecord) => !result.staleEndpoints.has(item.endpoint));
      await writeSubscriptions(nextSubscriptions);
    }

    const nextSettings = {
      ...settings,
      lastTestAt: new Date().toISOString()
    };
    await writeSettings(nextSettings);

    res.json({
      ok: true,
      sentCount: result.sentCount,
      removedCount: result.staleEndpoints.size,
      settings: serializeSettings(nextSettings, nextSubscriptions.length)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi push impossible.";
    res.status(502).json({ ok: false, error: message });
  }
});
