import { EventEmitter } from "node:events";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { NormalizedMessage } from "@oumar/shared";

export type SessionStatus = "connecting" | "qr" | "open" | "closed";

export type BaileysQREvent           = { sessionId: string; qr: string };
export type BaileysConnectedEvent    = { sessionId: string; phoneNumber: string | undefined };
export type BaileysDisconnectedEvent = { sessionId: string; shouldReconnect: boolean };
export type BaileysMessageUpdateEvent = {
  sessionId: string;
  messageId: string;
  remoteJid?: string;
  status: "pending" | "sent" | "delivered" | "read";
};

// Version WhatsApp Web connue et stable — utilisée si fetchLatestBaileysVersion échoue
const FALLBACK_WA_VERSION: [number, number, number] = [2, 3000, 1015901307];

export class WhatsAppBaileysClient extends EventEmitter {
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private _status: SessionStatus = "closed";
  private _phoneNumber: string | undefined;
  private _lastQr: string | undefined;          // dernier QR brut (pour polling REST)
  private _lastQrDataUrl: string | undefined;   // dernier QR en Data URL
  private readonly sessionDir: string;
  private reconnecting = false;

  constructor(
    public readonly sessionId: string,
    // Défaut relatif au cwd — fonctionne sur Windows comme sous Linux/Docker.
    // En production (Docker), BAILEYS_SESSIONS_DIR pointe vers un volume persistant.
    baseDir = process.env["BAILEYS_SESSIONS_DIR"] ?? join(process.cwd(), "baileys-sessions")
  ) {
    super();
    this.sessionDir = join(baseDir, sessionId);
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  get status(): SessionStatus { return this._status; }
  get phoneNumber(): string | undefined { return this._phoneNumber; }
  get lastQr(): string | undefined { return this._lastQr; }
  get lastQrDataUrl(): string | undefined { return this._lastQrDataUrl; }

  setQrDataUrl(url: string): void {
    this._lastQrDataUrl = url;
  }

  // ─── Connexion ───────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    // Si déjà en cours ou ouvert, ne rien faire
    if (this._status === "open" || this._status === "connecting") return;

    this._status = "connecting";
    this._lastQr = undefined;
    this._lastQrDataUrl = undefined;

    try {
      // Récupérer la version WA — avec fallback si pas de réseau
      let version: [number, number, number];
      try {
        const result = await fetchLatestBaileysVersion();
        version = result.version as [number, number, number];
      } catch {
        console.warn(`[Baileys:${this.sessionId}] fetchLatestBaileysVersion échoué, utilisation du fallback ${FALLBACK_WA_VERSION}`);
        version = FALLBACK_WA_VERSION;
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ["Chrome (Linux)", "Chrome", "120.0.0"],
        syncFullHistory: false,
        getMessage: async () => undefined,
      });

      this.socket = socket;

      // ── Événements de connexion ────────────────────────────────────────────
      socket.ev.on("connection.update", ({ qr, connection, lastDisconnect }) => {
        if (qr) {
          this._status = "qr";
          this._lastQr = qr;
          this.emit("qr", { sessionId: this.sessionId, qr } satisfies BaileysQREvent);
        }

        if (connection === "open") {
          this._status = "open";
          this.reconnecting = false;
          this._lastQr = undefined;
          this._lastQrDataUrl = undefined;
          this._phoneNumber = socket.user?.id?.split(":")[0] ?? undefined;
          this.emit("connected", {
            sessionId: this.sessionId,
            phoneNumber: this._phoneNumber,
          } satisfies BaileysConnectedEvent);
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isConflict  = statusCode === DisconnectReason.connectionReplaced; // 440 — replaced by another session
          const shouldReconnect = !isLoggedOut && !isConflict;
          this._status = "closed";
          if (isConflict) {
            console.warn(`[Baileys:${this.sessionId}] Session remplacee par un autre appareil — reconnexion annulee.`);
          }
          this.emit("disconnected", {
            sessionId: this.sessionId,
            shouldReconnect,
          } satisfies BaileysDisconnectedEvent);
          if (shouldReconnect && !this.reconnecting) {
            this.reconnecting = true;
            console.log(`[Baileys:${this.sessionId}] Reconnexion dans 5s...`);
            setTimeout(() => this.connect(), 5_000);
          }
        }
      });

      // ── Sauvegarder les credentials ────────────────────────────────────────
      socket.ev.on("creds.update", saveCreds);

      // ── Messages entrants ──────────────────────────────────────────────────
      socket.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const message of messages) {
          if (message.key.fromMe || !message.message) continue;
          this.emit("message", await this.normalizeMessage(message));
        }
      });

      socket.ev.on("messages.update", (updates) => {
        for (const item of updates) {
          const id = item.key?.id;
          if (!id) continue;
          const rawStatus = (item.update as { status?: number })?.status;
          if (!rawStatus) continue;
          this.emit("message.update", {
            sessionId: this.sessionId,
            messageId: id,
            remoteJid: item.key?.remoteJid ?? undefined,
            status: this.normalizeStatus(rawStatus),
          } satisfies BaileysMessageUpdateEvent);
        }
      });

    } catch (error) {
      // Si la connexion échoue, remettre "closed" pour permettre un retry
      this._status = "closed";
      this.socket = null;
      console.error(`[Baileys:${this.sessionId}] Erreur de connexion:`, error);
      throw error;
    }
  }

  // ─── Déconnexion ─────────────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    this.reconnecting = false;
    if (this.socket) {
      try { this.socket.end(undefined); } catch { /* ignore */ }
      this.socket = null;
    }
    this._status = "closed";
    this._lastQr = undefined;
    this._lastQrDataUrl = undefined;
  }

  async logout(): Promise<void> {
    this.reconnecting = false;
    if (this.socket) {
      try { await this.socket.logout(); } catch { /* ignore */ }
      this.socket = null;
    }
    this._status = "closed";
    this._lastQr = undefined;
    this._lastQrDataUrl = undefined;
  }

  // ─── Envoi de messages ───────────────────────────────────────────────────────

  async sendText(jid: string, text: string) {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), { text });
  }

  async sendImage(jid: string, buffer: Buffer, caption?: string) {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), { image: buffer, caption });
  }

  async sendVideo(jid: string, buffer: Buffer, caption?: string) {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), { video: buffer, caption });
  }

  async sendAudio(jid: string, buffer: Buffer, mimetype = "audio/webm") {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), { audio: buffer, mimetype, ptt: true });
  }

  async sendDocument(jid: string, buffer: Buffer, mimetype: string, filename: string) {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), { document: buffer, mimetype, fileName: filename });
  }

  async sendLocation(jid: string, lat: number, lon: number) {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), {
      location: { degreesLatitude: lat, degreesLongitude: lon },
    });
  }

  async sendContact(jid: string, contact: { name: string; phone: string }) {
    this.assertOpen();
    const vcard = [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${contact.name}`,
      `TEL;type=CELL;waid=${contact.phone}:+${contact.phone}`,
      "END:VCARD",
    ].join("\n");
    return this.socket!.sendMessage(this.formatJid(jid), {
      contacts: { displayName: contact.name, contacts: [{ vcard }] },
    });
  }

  async sendReaction(jid: string, messageId: string, emoji: string) {
    this.assertOpen();
    return this.socket!.sendMessage(this.formatJid(jid), {
      react: { text: emoji, key: { id: messageId, remoteJid: this.formatJid(jid) } },
    });
  }

  async deleteMessage(jid: string, messageId: string, forEveryone: boolean) {
    this.assertOpen();
    if (forEveryone) {
      return this.socket!.sendMessage(this.formatJid(jid), {
        delete: { id: messageId, remoteJid: this.formatJid(jid), fromMe: true },
      });
    }
  }

  async markAsRead(jid: string, messageIds: string[]) {
    this.assertOpen();
    await this.socket!.readMessages(
      messageIds.map((id) => ({ id, remoteJid: this.formatJid(jid), fromMe: false }))
    );
  }

  async sendPresence(jid: string, type: "available" | "composing" | "paused") {
    this.assertOpen();
    await this.socket!.sendPresenceUpdate(type, this.formatJid(jid));
  }

  // ─── Helpers privés ──────────────────────────────────────────────────────────

  private assertOpen(): void {
    if (this._status !== "open") {
      throw new Error(
        `Session ${this.sessionId} non connectee (statut: ${this._status}). Scannez le QR code d'abord.`
      );
    }
  }

  private formatJid(phone: string): string {
    if (phone.includes("@")) return phone;
    return `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
  }

  private normalizeStatus(status: number): BaileysMessageUpdateEvent["status"] {
    if (status >= 4) return "read";
    if (status >= 3) return "delivered";
    if (status >= 2) return "sent";
    return "pending";
  }

  private async normalizeMessage(message: any): Promise<NormalizedMessage> {
    const jid: string = message.key.remoteJid ?? "";
    const msg = message.message ?? {};
    let text: string | undefined;
    let type: NormalizedMessage["type"] = "unknown";
    let mediaUrl: string | undefined;
    let mimetype: string | undefined;
    let filename: string | undefined;
    let fileSize: number | undefined;
    let caption: string | undefined;

    if (msg.conversation)                    { text = msg.conversation;                    type = "text"; }
    else if (msg.extendedTextMessage?.text)  { text = msg.extendedTextMessage.text;        type = "text"; }
    else if (msg.imageMessage)               { caption = msg.imageMessage.caption ?? undefined; text = caption; type = "image"; }
    else if (msg.videoMessage)               { caption = msg.videoMessage.caption ?? undefined; text = caption; type = "video"; }
    else if (msg.audioMessage)               { type = "audio"; }
    else if (msg.documentMessage)            { text = msg.documentMessage.fileName ?? undefined; type = "document"; }
    else if (msg.locationMessage)            { text = `${msg.locationMessage.degreesLatitude},${msg.locationMessage.degreesLongitude}`; type = "location"; }
    else if (msg.contactMessage ?? msg.contactsArrayMessage) { type = "contact"; }

    const mediaMessage =
      msg.imageMessage ??
      msg.videoMessage ??
      msg.audioMessage ??
      msg.documentMessage;

    if (mediaMessage) {
      mimetype = mediaMessage.mimetype ?? undefined;
      filename = mediaMessage.fileName ?? mediaMessage.title ?? undefined;
      fileSize = Number(mediaMessage.fileLength ?? 0) || undefined;

      try {
        const buffer = await downloadMediaMessage(message, "buffer", {});
        if (Buffer.isBuffer(buffer)) {
          const mediaMime = mimetype ?? "application/octet-stream";
          mediaUrl = `data:${mediaMime};base64,${buffer.toString("base64")}`;
        }
      } catch (error) {
        console.warn(`[Baileys:${this.sessionId}] téléchargement média échoué`, error);
      }
    }

    return {
      id: message.key.id ?? crypto.randomUUID(),
      channel: "whatsapp",
      from: jid,
      text,
      type,
      mediaUrl,
      mimetype,
      filename,
      fileSize,
      caption,
      timestamp: new Date(
        typeof message.messageTimestamp === "number" ? message.messageTimestamp * 1000 : Date.now()
      ).toISOString(),
      raw: message,
    };
  }
}
