import type { MessageChannel } from "@oumar/shared";
import { prisma } from "../db/prisma.js";

function normalizeFact(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

class ClientMemoryService {
  // Vérifie que le clientId est un vrai Client UUID (évite FK violation avec JIDs WhatsApp/@lid)
  private async resolveClientId(clientId?: string): Promise<string | undefined> {
    if (!clientId) return undefined;
    const exists = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }).catch(() => null);
    return exists ? clientId : undefined;
  }

  async ensure(clientId: string) {
    const existing = await prisma.clientMemory.findUnique({
      where: { clientId },
      include: {
        facts: { orderBy: { createdAt: "desc" } },
        preferences: { orderBy: { createdAt: "desc" } }
      }
    });

    if (existing) return existing;

    return prisma.clientMemory.create({
      data: { clientId },
      include: {
        facts: true,
        preferences: true
      }
    });
  }

  async rememberTurn(input: {
    clientId?: string;
    channel: MessageChannel;
    userText: string;
    language?: string;
  }) {
    if (!input.clientId) return null;

    // Valide que le clientId est un vrai Client UUID avant toute écriture FK
    const safeClientId = await this.resolveClientId(input.clientId);
    if (!safeClientId) return null;

    const memory = await this.ensure(safeClientId);
    const facts = this.extractFacts(input.userText);

    for (const fact of facts) {
      const normalized = normalizeFact(fact.fact);
      const duplicate = memory.facts.find(
        (existing: { category: string; fact: string }) =>
          existing.category === fact.category && normalizeFact(existing.fact) === normalized
      );
      if (duplicate) continue;

      await prisma.clientMemoryFact.create({
        data: {
          memoryId: memory.id,
          category: fact.category,
          fact: normalized,
          confidence: fact.confidence,
          source: input.channel
        }
      });
    }

    if (input.language) {
      await this.upsertPreference(memory.id, "language", input.language);
    }

    await this.upsertPreference(memory.id, "preferred_channel", input.channel);
    await this.refreshProfileSummary(memory.id);

    return prisma.clientMemory.findUnique({
      where: { id: memory.id },
      include: {
        facts: { orderBy: { createdAt: "desc" } },
        preferences: { orderBy: { createdAt: "desc" } }
      }
    });
  }

  async getProfile(clientId: string) {
    return prisma.clientMemory.findUnique({
      where: { clientId },
      include: {
        facts: { orderBy: { createdAt: "desc" } },
        preferences: { orderBy: { createdAt: "desc" } }
      }
    });
  }

  private async upsertPreference(memoryId: string, key: string, value: string) {
    const existing = await prisma.clientPreference.findFirst({
      where: { memoryId, key },
      orderBy: { createdAt: "desc" }
    });

    if (existing?.value === value) return existing;

    if (existing) {
      return prisma.clientPreference.update({
        where: { id: existing.id },
        data: { value }
      });
    }

    return prisma.clientPreference.create({
      data: { memoryId, key, value }
    });
  }

  private async refreshProfileSummary(memoryId: string) {
    const memory = await prisma.clientMemory.findUnique({
      where: { id: memoryId },
      include: {
        facts: { orderBy: { createdAt: "desc" }, take: 5 },
        preferences: { orderBy: { createdAt: "desc" }, take: 5 }
      }
    });

    if (!memory) return null;

    const factSummary = memory.facts.map((fact: { fact: string }) => fact.fact).join(" | ");
    const preferenceSummary = memory.preferences
      .map((pref: { key: string; value: string }) => `${pref.key}: ${pref.value}`)
      .join(" | ");
    const profileSummary = [factSummary, preferenceSummary].filter(Boolean).join(" || ") || null;

    return prisma.clientMemory.update({
      where: { id: memoryId },
      data: {
        profileSummary,
        lastUpdatedAt: new Date()
      }
    });
  }

  private extractFacts(text: string) {
    const lower = text.toLowerCase();
    const facts: Array<{ category: string; fact: string; confidence: number }> = [];

    const budgetMatch = text.match(/(\d[\d\s.,]{3,})\s*(fcfa|xof|eur|usd)/i);
    if (budgetMatch) {
      facts.push({
        category: "budget",
        fact: `Budget mentionne: ${budgetMatch[0]}`,
        confidence: 0.92
      });
    }

    if (/whatsapp/i.test(lower)) {
      facts.push({
        category: "interest",
        fact: "Interet exprime pour WhatsApp ou l'automatisation des messages.",
        confidence: 0.74
      });
    }

    if (/site|wordpress|next\.?js|e-?commerce/i.test(lower)) {
      facts.push({
        category: "interest",
        fact: "Interet exprime pour un projet site web.",
        confidence: 0.74
      });
    }

    if (/marketing|publicite|facebook ads|google ads|campagne/i.test(lower)) {
      facts.push({
        category: "interest",
        fact: "Interet exprime pour une prestation marketing ou ads.",
        confidence: 0.74
      });
    }

    if (/urgent|vite|rapidement|aujourd'hui|demain/i.test(lower)) {
      facts.push({
        category: "urgency",
        fact: "Le client attend une execution rapide ou prioritaire.",
        confidence: 0.81
      });
    }

    return facts;
  }
}

export const clientMemoryService = new ClientMemoryService();
