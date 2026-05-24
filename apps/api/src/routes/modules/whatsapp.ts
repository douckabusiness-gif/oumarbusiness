import { Router } from "express";
import QRCode from "qrcode";
import { WhatsAppCloudClient } from "@oumar/whatsapp-cloud";
import { WhatsAppBaileysClient, baileysManager, type SessionSummary } from "@oumar/whatsapp-baileys";
import { orchestrator } from "../../agents/orchestrator.js";
import { prisma } from "../../db/prisma.js";
import { requireAuthenticatedAdmin } from "./admin-auth.js";
import { logger } from "../../services/logger.js";
import { isStopMessage, registerOptOut } from "../../services/sourcingOptout.js";
import { sendBusinessPushNotificationSafe } from "./notifications.js";

export const whatsappRouter = Router();

const SAAS_WHATSAPP_META_CONFIGS_KEY = "saas_whatsapp_meta_configs";
const SAAS_CRM_LEADS_KEY = "saas_crm_leads";
const SAAS_SUBSCRIPTIONS_KEY = "saas_subscriptions";

type SaasWhatsAppMetaConfig = {
  companyId: string;
  sessionId: string;
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  displayPhoneNumber: string;
};

type SaasSubscription = {
  companyId: string;
  moduleKey: string;
  status: string;
};

type SaasCrmLead = {
  id: string;
  companyId: string;
  name: string;
  company: string;
  source: string;
  score: number;
  status: "new" | "warm" | "hot" | "won";
  updatedAt: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAccessibleSaasStatus(status: string) {
  return status === "active";
}

function normalizePhoneForSaasLead(value: string) {
  return value.replace(/\D/g, "");
}

async function loadSaasMetaConfigs() {
  const stored = await prisma.appSetting.findUnique({ where: { key: SAAS_WHATSAPP_META_CONFIGS_KEY } }).catch(() => null);
  const raw: unknown[] = Array.isArray(stored?.value) ? stored.value : [];
  return raw
    .map((item: unknown) => {
      if (!isObject(item)) return null;
      const companyId = typeof item.companyId === "string" ? item.companyId : "";
      const sessionId = typeof item.sessionId === "string" ? item.sessionId : "";
      const accessToken = typeof item.accessToken === "string" ? item.accessToken : "";
      const phoneNumberId = typeof item.phoneNumberId === "string" ? item.phoneNumberId : "";
      const verifyToken = typeof item.verifyToken === "string" ? item.verifyToken : "";
      const displayPhoneNumber = typeof item.displayPhoneNumber === "string" ? item.displayPhoneNumber : "";
      if (!companyId || !sessionId || !accessToken || !phoneNumberId || !verifyToken) return null;
      return { companyId, sessionId, accessToken, phoneNumberId, verifyToken, displayPhoneNumber } satisfies SaasWhatsAppMetaConfig;
    })
    .filter((item: SaasWhatsAppMetaConfig | null): item is SaasWhatsAppMetaConfig => Boolean(item));
}

async function upsertSaasLeadFromWhatsApp(companyId: string, phone: string, text: string) {
  const [subscriptionsSetting, leadsSetting] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: SAAS_SUBSCRIPTIONS_KEY } }).catch(() => null),
    prisma.appSetting.findUnique({ where: { key: SAAS_CRM_LEADS_KEY } }).catch(() => null)
  ]);

  const subscriptionsRaw: unknown[] = Array.isArray(subscriptionsSetting?.value) ? subscriptionsSetting.value : [];
  const subscriptions = subscriptionsRaw
    .map((item: unknown) => {
      if (!isObject(item)) return null;
      const companyIdValue = typeof item.companyId === "string" ? item.companyId : "";
      const moduleKey = typeof item.moduleKey === "string" ? item.moduleKey : "";
      const status = typeof item.status === "string" ? item.status : "";
      if (!companyIdValue || !moduleKey || !status) return null;
      return { companyId: companyIdValue, moduleKey, status } satisfies SaasSubscription;
    })
    .filter((item: SaasSubscription | null): item is SaasSubscription => Boolean(item));

  const crmActive = subscriptions.some(
    (item) => item.companyId === companyId && item.moduleKey === "crm-intelligent" && isAccessibleSaasStatus(item.status)
  );
  if (!crmActive) return;

  const leadsRaw: unknown[] = Array.isArray(leadsSetting?.value) ? leadsSetting.value : [];
  const leads = leadsRaw
    .map((item: unknown) => {
      if (!isObject(item)) return null;
      const id = typeof item.id === "string" ? item.id : "";
      const itemCompanyId = typeof item.companyId === "string" ? item.companyId : "";
      const name = typeof item.name === "string" ? item.name : "";
      const company = typeof item.company === "string" ? item.company : "";
      const source = typeof item.source === "string" ? item.source : "";
      const score = typeof item.score === "number" ? item.score : 0;
      const status = item.status === "hot" || item.status === "won" || item.status === "warm" ? item.status : "new";
      const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : "";
      if (!id || !itemCompanyId || !name || !company || !source || !updatedAt) return null;
      return { id, companyId: itemCompanyId, name, company, source, score, status, updatedAt } satisfies SaasCrmLead;
    })
    .filter((item: SaasCrmLead | null): item is SaasCrmLead => Boolean(item));

  const normalizedPhone = normalizePhoneForSaasLead(phone);
  const updatedAt = new Date().toISOString();
  const existing = leads.find((lead: SaasCrmLead) => lead.companyId === companyId && lead.source === `WhatsApp:${normalizedPhone}`);
  const nextLead: SaasCrmLead = existing
    ? { ...existing, status: text ? "warm" : existing.status, updatedAt }
    : {
        id: `saas_lead_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        companyId,
        name: normalizedPhone,
        company: normalizedPhone,
        source: `WhatsApp:${normalizedPhone}`,
        score: 65,
        status: text ? "warm" : "new",
        updatedAt
      };

  await prisma.appSetting.upsert({
    where: { key: SAAS_CRM_LEADS_KEY },
    update: { value: [nextLead, ...leads.filter((lead: SaasCrmLead) => lead.id !== nextLead.id)] as unknown as object },
    create: { key: SAAS_CRM_LEADS_KEY, value: [nextLead] as unknown as object }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLOUD API (Meta officielle)
// ═══════════════════════════════════════════════════════════════════════════════

const cloudClient = new WhatsAppCloudClient({
  accessToken: process.env.META_ACCESS_TOKEN ?? "",
  phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? "",
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
});

whatsappRouter.get("/cloud/webhook", async (req, res) => {
  const mode      = String(req.query["hub.mode"] ?? "");
  const token     = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  if (mode === "subscribe") {
    try {
      return res.status(200).send(cloudClient.verifyWebhook(token, challenge));
    } catch {
      const saasConfigs = await loadSaasMetaConfigs();
      const matched = saasConfigs.find((item) => item.verifyToken === token);
      if (matched) {
        return res.status(200).send(challenge);
      }
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(403);
});

whatsappRouter.post("/cloud/webhook", async (req, res) => {
  try {
    const phoneNumberId = String(req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? "");
    if (phoneNumberId) {
      const saasConfigs = await loadSaasMetaConfigs();
      const matched = saasConfigs.find((item) => item.phoneNumberId === phoneNumberId);
      if (matched) {
        const client = new WhatsAppCloudClient({
          accessToken: matched.accessToken,
          phoneNumberId: matched.phoneNumberId,
          verifyToken: matched.verifyToken
        });
        const message = client.parseWebhookPayload(req.body);
        const io = req.app.get("io");
        io.emit("whatsapp:message", message);
        if (message.text) {
          const savedIncoming = await saveIncomingMessage(
            {
              id: message.id,
              from: message.from,
              text: message.text,
              type: message.type,
              timestamp: message.timestamp
            },
            matched.sessionId
          ).catch(() => null);

          if (savedIncoming) {
            await prisma.wAConversation.update({
              where: { id: savedIncoming.conversation.id },
              data: {
                labels: Array.from(new Set([...(savedIncoming.conversation.labels ?? []), `saas:${matched.companyId}`]))
              }
            }).catch(() => null);
            io.emit("whatsapp:db:message", { conversation: savedIncoming.conversation, message: savedIncoming.message });
          }

          await upsertSaasLeadFromWhatsApp(matched.companyId, message.from, message.text).catch(() => null);
        }
        res.sendStatus(200);
        return;
      }
    }

    const message = cloudClient.parseWebhookPayload(req.body);
    const io = req.app.get("io");
    io.emit("whatsapp:message", message);
    if (message.text) {
      await sendBusinessPushNotificationSafe({
        title: "Nouveau message WhatsApp",
        body: `${message.from}: ${message.text.slice(0, 120)}`,
        url: "/whatsapp",
        tag: `whatsapp-cloud-${message.from}`,
        source: "whatsapp"
      });
      if (isStopMessage(message.text)) {
        await registerOptOut({ value: message.from, channel: "whatsapp", reason: "STOP WhatsApp Cloud" });
        await cloudClient.sendText(
          message.from,
          "C'est note. Vous ne recevrez plus de messages de notre part. Merci."
        );
        logger.info({ from: message.from }, "Opt-out STOP WhatsApp Cloud enregistre");
        res.sendStatus(200);
        return;
      }
      const response = await orchestrator.chat({
        channel: "whatsapp",
        text: message.text,
        clientId: message.from,
        metadata: { source: "cloud", from: message.from, externalRef: message.from, locale: "fr" },
      });
      if (!response.decision.escalate) {
        await cloudClient.sendText(message.from, response.text);
      } else {
        io.emit("whatsapp:hitl", {
          source: "cloud",
          from: message.from,
          clientMessage: message.text,
          agentResponse: response.text,
          agentName: response.agentName,
        });
      }
    }
    res.sendStatus(200);
  } catch (error) {
    logger.error({ error }, "Erreur webhook Cloud WhatsApp");
    res.sendStatus(200);
  }
});

whatsappRouter.use(requireAuthenticatedAdmin);

// ═══════════════════════════════════════════════════════════════════════════════
// BAILEYS (WhatsApp Web via QR code)
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Récupère la conversation correspondant à un numéro, ou la crée si absente.
// Sans ce upsert, aucun message entrant ne serait jamais rattaché à une conversation.
async function getOrCreateConversation(sessionId: string, phone: string) {
  const cleaned = phone.replace(/\D/g, "");
  const jid = phone.includes("@") ? phone : `${cleaned}@s.whatsapp.net`;

  const exact = await prisma.wAConversation.findFirst({
    where: { sessionId, jid },
  });
  if (exact) return exact;

  const existing = phone.includes("@")
    ? await prisma.wAConversation.findFirst({
        where: {
          sessionId,
          OR: [
            { phoneNumber: cleaned },
            { jid: { contains: cleaned } },
          ],
        },
      })
    : await prisma.wAConversation.findFirst({
        where: { sessionId, jid: `${cleaned}@s.whatsapp.net` },
      });

  if (existing && phone.includes("@") && existing.jid !== jid) {
    return prisma.wAConversation.update({
      where: { id: existing.id },
      data: { jid, phoneNumber: cleaned },
    });
  }
  if (existing) return existing;
  return prisma.wAConversation.create({
    data: { sessionId, jid, phoneNumber: cleaned, labels: [] },
  });
}

async function saveIncomingMessage(
  msg: {
    id: string;
    from: string;
    text?: string;
    type: string;
    timestamp: string;
    mediaUrl?: string;
    mimetype?: string;
    filename?: string;
    fileSize?: number;
    caption?: string;
  },
  sessionId: string
): Promise<{ conversation: Awaited<ReturnType<typeof getOrCreateConversation>>; message: Awaited<ReturnType<typeof prisma.wAMessage.upsert>> }> {
  const conversation = await getOrCreateConversation(sessionId, msg.from);
  const message = await prisma.wAMessage.upsert({
    where: { waMessageId: msg.id },
    create: {
      conversationId: conversation.id,
      waMessageId: msg.id,
      fromMe: false,
      type: msg.type,
      content: msg.text ?? null,
      mediaUrl: msg.mediaUrl ?? null,
      mimetype: msg.mimetype ?? null,
      filename: msg.filename ?? null,
      fileSize: msg.fileSize ?? null,
      caption: msg.caption ?? null,
      timestamp: new Date(msg.timestamp),
    },
    update: {},
  });
  await prisma.wAConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: msg.text ?? msg.caption ?? msg.filename ?? `[${msg.type}]`,
      lastMessageAt: new Date(msg.timestamp),
      unreadCount: { increment: 1 },
    },
  });
  return { conversation, message };
}

// Persiste un message sortant pour qu'il reste visible après rechargement de la conversation.
async function saveOutgoingMessage(
  sessionId: string,
  to: string,
  content: string | null,
  type = "text",
  waMessageId?: string | null
): Promise<{ conversation: Awaited<ReturnType<typeof getOrCreateConversation>>; message: Awaited<ReturnType<typeof prisma.wAMessage.upsert>> }> {
  const conversation = await getOrCreateConversation(sessionId, to);
  const id = waMessageId ?? `out_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const message = await prisma.wAMessage.upsert({
    where: { waMessageId: id },
    create: {
      conversationId: conversation.id,
      waMessageId: id,
      fromMe: true,
      type,
      content,
      timestamp: new Date(),
    },
    update: {},
  });
  await prisma.wAConversation.update({
    where: { id: conversation.id },
    data: { lastMessage: content ?? `[${type}]`, lastMessageAt: new Date() },
  });
  return { conversation, message };
}

function emitSavedMessage(io: any, conversation: unknown, message: unknown): void {
  io.emit("whatsapp:db:message", { conversation, message });
}

function attachBaileysEvents(client: WhatsAppBaileysClient, sessionId: string, io: any): void {
  client.removeAllListeners();

  client.on("qr", async ({ qr }: { qr: string }) => {
    logger.info({ sessionId }, "QR Baileys genere");
    const qrDataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#111111",
        light: "#ffffff"
      }
    });
    client.setQrDataUrl(qrDataUrl);
    io.emit("whatsapp:baileys:qr", { sessionId, qr, qrDataUrl });
    await prisma.wASession.update({ where: { id: sessionId }, data: { status: "qr_pending" } }).catch(() => {});
  });

  client.on("connected", async ({ phoneNumber }: { phoneNumber: string | undefined }) => {
    logger.info({ sessionId, phoneNumber }, "Session Baileys connectee");
    io.emit("whatsapp:baileys:connected", { sessionId, phoneNumber });
    await prisma.wASession
      .update({ where: { id: sessionId }, data: { status: "connected", phoneNumber: phoneNumber ?? "" } })
      .catch(() => {});
  });

  client.on("disconnected", async ({ shouldReconnect }: { shouldReconnect: boolean }) => {
    logger.info({ sessionId, shouldReconnect }, "Session Baileys deconnectee");
    io.emit("whatsapp:baileys:disconnected", { sessionId, shouldReconnect });
    await prisma.wASession
      .update({ where: { id: sessionId }, data: { status: shouldReconnect ? "reconnecting" : "disconnected" } })
      .catch(() => {});
  });

  client.on("message", async (normalizedMsg: any) => {
    logger.info({ sessionId, from: normalizedMsg.from, type: normalizedMsg.type }, "Message Baileys recu");
    io.emit("whatsapp:message", normalizedMsg);
    const savedIncoming = await saveIncomingMessage(normalizedMsg, sessionId).catch(() => null);
    if (savedIncoming) emitSavedMessage(io, savedIncoming.conversation, savedIncoming.message);
    if (normalizedMsg.text) {
        await sendBusinessPushNotificationSafe({
          title: "Nouveau message WhatsApp",
          body: `${normalizedMsg.from}: ${String(normalizedMsg.text).slice(0, 120)}`,
          url: "/whatsapp",
          tag: `whatsapp-baileys-${normalizedMsg.from}`,
          source: "whatsapp"
        });
    }
    if (!normalizedMsg.text) return;
    if (isStopMessage(normalizedMsg.text)) {
      await registerOptOut({ value: normalizedMsg.from, channel: "whatsapp", reason: "STOP WhatsApp" }).catch(() => {});
      const confirmation = "C'est note. Vous ne recevrez plus de messages de notre part. Merci.";
      const sentStop = await client.sendText(normalizedMsg.from, confirmation).catch(() => null);
      const savedStop = await saveOutgoingMessage(
        sessionId,
        normalizedMsg.from,
        confirmation,
        "text",
        sentStop?.key?.id ?? null
      ).catch(() => null);
      if (savedStop) emitSavedMessage(io, savedStop.conversation, savedStop.message);
      logger.info({ sessionId, from: normalizedMsg.from }, "Opt-out STOP WhatsApp enregistre");
      return;
    }
    try {
      await client.sendPresence(normalizedMsg.from, "composing").catch(() => {});
      const response = await orchestrator.chat({
        channel: "whatsapp",
        text: normalizedMsg.text,
        clientId: normalizedMsg.from,
        conversationId: savedIncoming?.conversation.id,
        metadata: {
          source: "baileys",
          sessionId,
          externalRef: savedIncoming?.conversation.id ?? normalizedMsg.from,
          locale: "fr"
        },
      });
      if (!response.decision.escalate) {
        // Délai anti-ban WhatsApp : simule lecture + frappe humaine avec variation aléatoire
        // Lecture : 2-5s selon longueur du message reçu
        const readingTime = 2000 + Math.min(normalizedMsg.text.length * 40, 3000);
        // Frappe : ~28ms par caractère de la réponse (≈ 35 mots/min), cap 10s
        const typingTime = Math.min(response.text.length * 28, 10000);
        // Jitter ±1.5s pour casser la régularité (anti-fingerprint bot)
        const jitter = Math.floor((Math.random() - 0.5) * 3000);
        const delay = Math.max(4000, readingTime + typingTime + jitter);
        // Rafraîchit l'indicateur "en train d'écrire" toutes les 4s pendant le délai
        let elapsed = 0;
        while (elapsed < delay - 4000) {
          await sleep(4000);
          elapsed += 4000;
          await client.sendPresence(normalizedMsg.from, "composing").catch(() => {});
        }
        await sleep(delay - elapsed);
        await client.sendPresence(normalizedMsg.from, "paused").catch(() => {});
        const sent = await client.sendText(normalizedMsg.from, response.text);
        const sentId = sent?.key?.id ?? null;
        const savedOutgoing = await saveOutgoingMessage(sessionId, normalizedMsg.from, response.text, "text", sentId).catch(() => null);
        if (savedOutgoing) emitSavedMessage(io, savedOutgoing.conversation, savedOutgoing.message);
        logger.info({ sessionId, to: normalizedMsg.from, action: response.decision.action }, "Reponse agent envoyee");
      } else {
        await client.sendPresence(normalizedMsg.from, "paused").catch(() => {});
        io.emit("whatsapp:baileys:hitl", {
          sessionId,
          from: normalizedMsg.from,
          clientMessage: normalizedMsg.text,
          agentResponse: response.text,
          agentName: response.agentName,
          action: response.decision.action,
          reason: response.decision.reason,
        });
        logger.info({ sessionId, from: normalizedMsg.from, reason: response.decision.reason }, "HITL requis");
      }
    } catch (error) {
      logger.error({ error, sessionId }, "Erreur orchestrateur Baileys");
      await client.sendPresence(normalizedMsg.from, "paused").catch(() => {});
    }
  });

  client.on("message.update", async (update: { messageId: string; status: string }) => {
    const saved = await prisma.wAMessage
      .update({
        where: { waMessageId: update.messageId },
        data: { status: update.status },
      })
      .catch(() => null);
    if (saved) {
      io.emit("whatsapp:message:update", {
        sessionId,
        waMessageId: update.messageId,
        status: update.status,
      });
    }
  });
}

function ensureBaileysClient(sessionId: string, io: any): WhatsAppBaileysClient {
  const client = baileysManager.getOrCreate(sessionId);
  attachBaileysEvents(client, sessionId, io);
  if (client.status === "closed") {
    void client.connect().catch((error) => {
      logger.error({ error, sessionId }, "Erreur restauration session Baileys");
    });
  }
  return client;
}

// Auto-reconnect au démarrage de l'API pour toutes les sessions marquées "connected"
export async function startBaileysAutoReconnect(io: any): Promise<void> {
  try {
    const sessions = await prisma.wASession.findMany({
      where: { type: "baileys", status: { in: ["connected", "reconnecting"] } }
    });
    if (sessions.length === 0) return;
    logger.info({ count: sessions.length }, "Auto-reconnexion des sessions Baileys au demarrage");
    for (const session of sessions) {
      ensureBaileysClient(session.id, io);
    }
  } catch (error) {
    logger.warn({ error }, "Erreur auto-reconnexion Baileys au demarrage");
  }
}

// POST /api/whatsapp/baileys/sessions — Créer une session
whatsappRouter.post("/baileys/sessions", async (req, res, next) => {
  try {
    const { name = "Session WhatsApp", phoneNumber = "" } = req.body as { name?: string; phoneNumber?: string };
    const dbSession = await prisma.wASession.create({
      data: { name, type: "baileys", phoneNumber, status: "connecting" },
    });
    const sessionId = dbSession.id;
    const io = req.app.get("io");
    const client = baileysManager.getOrCreate(sessionId);
    attachBaileysEvents(client, sessionId, io);
    await client.connect();
    res.status(201).json({
      sessionId,
      name: dbSession.name,
      status: client.status,
      message: "Session demarree. QR code en route via Socket.io (whatsapp:baileys:qr).",
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/whatsapp/baileys/sessions — Lister les sessions
whatsappRouter.get("/baileys/sessions", async (_req, res, next) => {
  try {
    const io = _req.app.get("io");
    const dbSessions = await prisma.wASession.findMany({
      where: { type: "baileys" },
      orderBy: { createdAt: "desc" },
    });
    for (const session of dbSessions) {
      if (session.status === "connected" || session.status === "reconnecting") {
        ensureBaileysClient(session.id, io);
      }
    }
    const active = baileysManager.list();
    const sessions = dbSessions.map((db: (typeof dbSessions)[number]) => {
      const live = active.find((s: SessionSummary) => s.sessionId === db.id);
      return {
        id: db.id,
        name: db.name,
        phoneNumber: live?.phoneNumber ?? db.phoneNumber,
        status: live?.status ?? db.status,
        connected: live?.status === "open",
        createdAt: db.createdAt,
      };
    });
    res.json({ sessions, total: sessions.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/whatsapp/baileys/sessions/:id — Statut d'une session
whatsappRouter.get("/baileys/sessions/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = baileysManager.get(id);
    const db = await prisma.wASession.findUnique({ where: { id } });
    if (!db) return res.status(404).json({ error: "Session introuvable" });
    res.json({
      id: db.id,
      name: db.name,
      phoneNumber: client?.phoneNumber ?? db.phoneNumber,
      status: client?.status ?? db.status,
      connected: client?.status === "open",
    });
  } catch (error) {
    next(error);
  }
});


// GET /api/whatsapp/baileys/sessions/:id/qr — Récupérer le QR code en polling (alternative Socket.io)
whatsappRouter.get("/baileys/sessions/:id/qr", async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = baileysManager.get(id);

    if (!client) {
      return res.status(404).json({ error: "Session introuvable. Créez-la d'abord via POST /baileys/sessions" });
    }

    if (client.status === "open") {
      return res.json({ status: "connected", connected: true, message: "Déjà connecté, pas de QR nécessaire" });
    }

    if (client.status === "connecting") {
      return res.json({ status: "connecting", connected: false, message: "Connexion en cours, QR pas encore prêt..." });
    }

    if (client.lastQrDataUrl) {
      return res.json({
        status: client.status,
        connected: false,
        qrDataUrl: client.lastQrDataUrl,
        message: "Scannez ce QR code avec WhatsApp → Appareils liés → Lier un appareil",
      });
    }

    return res.json({
      status: client.status,
      connected: false,
      message: "QR pas encore généré. Réessayez dans 3 secondes.",
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/baileys/sessions/:id/reconnect — Reconnecter
whatsappRouter.post("/baileys/sessions/:id/reconnect", async (req, res, next) => {
  try {
    const { id } = req.params;
    const io = req.app.get("io");
    await baileysManager.remove(id);
    const client = baileysManager.getOrCreate(id);
    attachBaileysEvents(client, id, io);
    await client.connect();
    res.json({ message: "Reconnexion en cours. QR code en route...", status: client.status });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/whatsapp/baileys/sessions/:id — Déconnecter (garde les credentials)
whatsappRouter.delete("/baileys/sessions/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await baileysManager.remove(id);
    await prisma.wASession.update({ where: { id }, data: { status: "disconnected" } }).catch(() => {});
    res.json({ message: "Session deconnectee. Credentials conserves." });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/whatsapp/baileys/sessions/:id/logout — Logout complet
whatsappRouter.delete("/baileys/sessions/:id/logout", async (req, res, next) => {
  try {
    const { id } = req.params;
    await baileysManager.logout(id);
    await prisma.wASession.update({ where: { id }, data: { status: "disconnected" } }).catch(() => {});
    res.json({ message: "Logout complet. Nouveau QR necessaire au prochain connect." });
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/baileys/sessions/:id/send — Envoyer un message
whatsappRouter.post("/baileys/sessions/:id/send", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { to, type = "text", text, lat, lon, name: contactName, phone: contactPhone, mediaDataUrl, mimetype } = req.body as {
      to: string; type?: string; text?: string;
      mediaDataUrl?: string; mimetype?: string;
      lat?: number; lon?: number; name?: string; phone?: string;
    };
    if (!to) return res.status(400).json({ error: "Le champ 'to' est requis" });
    const client = baileysManager.get(id);
    if (!client) return res.status(404).json({ error: "Session introuvable" });
    if (client.status !== "open") {
      return res.status(400).json({ error: `Session non connectee (statut: ${client.status})` });
    }
    let result: unknown;
    switch (type) {
      case "text":
        if (!text) return res.status(400).json({ error: "'text' requis pour type=text" });
        result = await client.sendText(to, text);
        break;
      case "location":
        if (typeof lat !== "number" || typeof lon !== "number") {
          return res.status(400).json({ error: "'lat' et 'lon' requis pour type=location" });
        }
        result = await client.sendLocation(to, lat, lon);
        break;
      case "contact":
        if (!contactName || !contactPhone) return res.status(400).json({ error: "'name' et 'phone' requis pour type=contact" });
        result = await client.sendContact(to, { name: contactName, phone: contactPhone });
        break;
      case "audio": {
        const payload = mediaDataUrl?.includes(",") ? mediaDataUrl.split(",")[1] : mediaDataUrl;
        if (!payload) return res.status(400).json({ error: "'mediaDataUrl' requis pour type=audio" });
        const buffer = Buffer.from(payload, "base64");
        result = await client.sendAudio(to, buffer, mimetype);
        break;
      }
      default:
        return res.status(400).json({ error: `Type '${type}' non supporte. Types valides: text, audio, location, contact` });
    }
    const waMessageId = (result as { key?: { id?: string } })?.key?.id ?? null;
    const savedOutgoing = await saveOutgoingMessage(id, to, type === "text" ? (text ?? null) : null, type, waMessageId).catch(() => null);
    if (savedOutgoing) {
      const io = req.app.get("io");
      emitSavedMessage(io, savedOutgoing.conversation, savedOutgoing.message);
    }
    res.json({ sent: true, to, type, result });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS & MESSAGES (depuis la DB)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/whatsapp/conversations — Lister toutes les conversations
whatsappRouter.get("/conversations", async (req, res, next) => {
  try {
    const { sessionId, archived } = req.query as { sessionId?: string; archived?: string };
    const where: Record<string, unknown> = { isArchived: archived === "true" };
    if (sessionId) where["sessionId"] = sessionId;
    const conversations = await prisma.wAConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: { session: { select: { name: true, phoneNumber: true } } },
    });
    res.json({ conversations, total: conversations.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/whatsapp/conversations/:id/messages — Messages d'une conversation
whatsappRouter.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await prisma.wAConversation.findUnique({ where: { id } });
    if (!conversation) return res.status(404).json({ error: "Conversation introuvable" });
    const messages = await prisma.wAMessage.findMany({
      where: { conversationId: id },
      orderBy: { timestamp: "asc" },
      take: 100,
    });
    res.json({ conversation, messages });
  } catch (error) {
    next(error);
  }
});

// POST /api/whatsapp/baileys/sessions/:id/hitl/approve — Valider et envoyer une réponse HITL
whatsappRouter.post("/baileys/sessions/:id/hitl/approve", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { to, text } = req.body as { to: string; text: string };
    if (!to || !text) return res.status(400).json({ error: "'to' et 'text' requis" });
    const client = baileysManager.get(id);
    if (!client || client.status !== "open") return res.status(400).json({ error: "Session non connectee" });
    await client.sendPresence(to, "composing");
    await new Promise((r) => setTimeout(r, 800));
    const sent = await client.sendText(to, text);
    const sentId = sent?.key?.id ?? null;
    const savedOutgoing = await saveOutgoingMessage(id, to, text, "text", sentId).catch(() => null);
    if (savedOutgoing) {
      const io = req.app.get("io");
      emitSavedMessage(io, savedOutgoing.conversation, savedOutgoing.message);
    }
    logger.info({ sessionId: id, to }, "Reponse HITL approuvee et envoyee");
    res.json({ sent: true, approved: true });
  } catch (error) {
    next(error);
  }
});
