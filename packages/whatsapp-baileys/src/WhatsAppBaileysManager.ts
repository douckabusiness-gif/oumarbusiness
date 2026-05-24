import { WhatsAppBaileysClient, type SessionStatus } from "./WhatsAppBaileysClient.js";

export type SessionSummary = {
  sessionId: string;
  status: SessionStatus;
  phoneNumber?: string;
};

/**
 * Gère plusieurs sessions Baileys simultanées.
 * Une session = un numéro WhatsApp connecté via QR code.
 */
export class WhatsAppBaileysManager {
  private readonly sessions = new Map<string, WhatsAppBaileysClient>();

  /** Récupère une session existante ou en crée une nouvelle. */
  getOrCreate(sessionId: string): WhatsAppBaileysClient {
    if (!this.sessions.has(sessionId)) {
      const client = new WhatsAppBaileysClient(sessionId);
      this.sessions.set(sessionId, client);
    }
    return this.sessions.get(sessionId)!;
  }

  /** Récupère une session existante (undefined si introuvable). */
  get(sessionId: string): WhatsAppBaileysClient | undefined {
    return this.sessions.get(sessionId);
  }

  /** Déconnecte et supprime une session du manager. */
  async remove(sessionId: string): Promise<void> {
    const client = this.sessions.get(sessionId);
    if (client) {
      await client.disconnect();
      this.sessions.delete(sessionId);
    }
  }

  /** Déconnecte, efface les credentials et supprime la session. */
  async logout(sessionId: string): Promise<void> {
    const client = this.sessions.get(sessionId);
    if (client) {
      await client.logout();
      this.sessions.delete(sessionId);
    }
  }

  /** Liste toutes les sessions avec leur statut actuel. */
  list(): SessionSummary[] {
    return Array.from(this.sessions.entries()).map(([id, client]) => ({
      sessionId: id,
      status: client.status,
      phoneNumber: client.phoneNumber,
    }));
  }

  /** Vérifie si une session existe dans le manager. */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /** Nombre total de sessions actives. */
  get count(): number {
    return this.sessions.size;
  }
}

// Instance singleton partagée par toute l'API
export const baileysManager = new WhatsAppBaileysManager();
