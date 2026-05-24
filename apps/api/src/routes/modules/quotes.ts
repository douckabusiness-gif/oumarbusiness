import { Router } from "express";
import { EmailEngine } from "@oumar/email-engine";
import { prisma } from "../../db/prisma.js";
import { getRuntimeEmailAccount, loadBrandingSettings } from "./settings.js";
import { baileysManager } from "@oumar/whatsapp-baileys";

export const quotesRouter = Router();

type QuoteWithClient = {
  id: string;
  serviceType: string;
  brief: string;
  total: number;
  currency: string;
  validUntil: Date;
  client: {
    id: string;
    name: string;
    email: string | null;
    whatsapp: string | null;
  };
};

quotesRouter.get("/", async (_req, res, next) => {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            whatsapp: true,
            country: true,
            status: true,
            source: true
          }
        }
      },
      take: 100
    });

    res.json({ items: quotes });
  } catch (error) {
    next(error);
  }
});

quotesRouter.get("/:id/pdf", async (req, res, next) => {
  try {
    const quoteId = String(req.params.id ?? "").trim();
    const [branding, quote] = await Promise.all([
      loadBrandingSettings(),
      prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              company: true,
              email: true,
              whatsapp: true,
              country: true,
              status: true,
              source: true
            }
          }
        }
      })
    ]);

    if (!quote) {
      res.status(404).json({ error: "Devis introuvable." });
      return;
    }

    const lines: Array<{ text: string; size?: number; x?: number; y: number }> = [
      { text: branding.agencyName || "Oumar Business", size: 18, x: 56, y: 790 },
      { text: "DEVIS", size: 18, x: 450, y: 790 },
      { text: `Client: ${quote.client.name}`, x: 56, y: 752 },
      { text: `Societe: ${quote.client.company || "Non renseignee"}`, x: 56, y: 728 },
      { text: `Service: ${quote.serviceType}`, x: 56, y: 696 },
      { text: `Montant: ${Number(quote.total).toLocaleString("fr-FR")} ${quote.currency}`, size: 18, x: 56, y: 654 },
      { text: `Validite: jusqu'au ${new Date(quote.validUntil).toLocaleDateString("fr-FR")}`, x: 56, y: 622 },
      { text: `Statut: ${formatQuoteStatus(quote.status)}`, x: 330, y: 622 },
      { text: "Resume du besoin:", size: 18, x: 56, y: 574 }
    ];

    let cursor = 546;
    for (const line of wrapPdfText(quote.brief, 74)) {
      lines.push({ text: line, x: 72, y: cursor });
      cursor -= 22;
    }

    cursor -= 20;
    lines.push({ text: "Ce devis sert de base commerciale avant validation et facturation.", x: 56, y: cursor });
    cursor -= 28;
    lines.push({ text: branding.footerText || "Merci de votre confiance - Oumar Business", x: 56, y: 120 });

    const pdfBuffer = buildSimplePdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="devis-${quote.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

quotesRouter.post("/", async (req, res, next) => {
  try {
    const clientId = String(req.body.clientId ?? "").trim();
    const serviceType = String(req.body.serviceType ?? "").trim();
    const brief = String(req.body.brief ?? "").trim();
    const currency = normalizeCurrency(req.body.currency);
    const total = Number(req.body.total ?? 0);
    const validityDays = Math.min(Math.max(Number(req.body.validityDays ?? 7), 1), 90);
    const lineItems = Array.isArray(req.body.lineItems)
      ? req.body.lineItems
      : [{ label: serviceType || "Service", amount: total }];

    if (!clientId) {
      res.status(400).json({ error: "Choisis un prospect ou client CRM." });
      return;
    }

    if (!serviceType) {
      res.status(400).json({ error: "Ajoute le service ou l'application a proposer." });
      return;
    }

    if (!brief) {
      res.status(400).json({ error: "Ajoute un court resume du besoin." });
      return;
    }

    if (!Number.isFinite(total) || total <= 0) {
      res.status(400).json({ error: "Ajoute un montant valide pour le devis." });
      return;
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({ error: "Client CRM introuvable." });
      return;
    }

    const quote = await prisma.quote.create({
      data: {
        clientId,
        serviceType,
        brief,
        lineItems,
        total,
        currency,
        status: "draft",
        validUntil: addDays(new Date(), validityDays)
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            whatsapp: true,
            country: true,
            status: true,
            source: true
          }
        }
      }
    });

    res.status(201).json({ item: quote });
  } catch (error) {
    next(error);
  }
});

quotesRouter.post("/:id/send", async (req, res, next) => {
  try {
    const quoteId = String(req.params.id ?? "").trim();
    const channel = typeof req.body.channel === "string" ? req.body.channel.trim() : "";

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            whatsapp: true,
            country: true,
            status: true,
            source: true
          }
        }
      }
    });

    if (!quote) {
      res.status(404).json({ error: "Devis introuvable." });
      return;
    }

    if (channel === "email") {
      if (!quote.client.email) {
        res.status(400).json({ error: "Ce client n'a pas d'email." });
        return;
      }

      const account = await getRuntimeEmailAccount("main");
      const engine = new EmailEngine();
      await engine.send({
        account,
        from: `${account.name ?? "Oumar Business"} <${account.email}>`,
        to: [quote.client.email],
        subject: `Devis ${quote.serviceType} - Oumar Business`,
        text: quoteEmailText(quote)
      });

      const updated = await markQuoteAsSent(quote.id, quote.client.id);
      res.json({ ok: true, item: updated, message: "Devis envoye par email." });
      return;
    }

    if (channel === "whatsapp") {
      if (!quote.client.whatsapp) {
        res.status(400).json({ error: "Ce client n'a pas de numero WhatsApp." });
        return;
      }

      const sessions = await prisma.wASession.findMany({
        where: { type: "baileys", status: "connected" },
        orderBy: { createdAt: "desc" },
        take: 5
      });

      for (const session of sessions) {
        const client = baileysManager.get(session.id);
        if (!client || client.status !== "open") continue;
        await client.sendText(quote.client.whatsapp, quoteWhatsAppText(quote));
        const updated = await markQuoteAsSent(quote.id, quote.client.id);
        res.json({ ok: true, item: updated, message: "Devis envoye par WhatsApp." });
        return;
      }

      res.status(400).json({ error: "Aucune session WhatsApp Baileys active." });
      return;
    }

    res.status(400).json({ error: "Canal invalide." });
  } catch (error) {
    next(error);
  }
});

async function markQuoteAsSent(quoteId: string, clientId: string) {
  const [quote] = await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: { status: "sent" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            whatsapp: true,
            country: true,
            status: true,
            source: true
          }
        }
      }
    }),
    prisma.client.update({
      where: { id: clientId },
      data: {
        status: "devis_envoye",
        lastContact: new Date()
      }
    })
  ]);

  return quote;
}

function normalizeCurrency(value: unknown) {
  const normalized = String(value ?? "XOF").trim().toUpperCase();
  if (normalized === "EUR" || normalized === "USD") return normalized;
  return "XOF";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatQuoteStatus(value: string) {
  const normalized = value.toLowerCase().trim();
  return normalized === "sent" ? "Envoye" : "Brouillon";
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: Array<{ text: string; size?: number; x?: number; y: number }>) {
  const content = ["BT", "/F1 11 Tf", "0 0 0 rg"];

  for (const line of lines) {
    content.push(`${line.x ?? 56} ${line.y} Td`);
    content.push(`/${line.size === 18 ? "F2" : "F1"} ${line.size ?? 11} Tf`);
    content.push(`(${pdfEscape(line.text)}) Tj`);
    content.push(`${-(line.x ?? 56)} ${-line.y} Td`);
  }

  content.push("ET");
  const stream = content.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    `6 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function wrapPdfText(value: string, maxLength: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines.slice(0, 8) : ["Aucun resume fourni."];
}

function quoteEmailText(quote: QuoteWithClient) {
  return [
    `Bonjour ${quote.client.name},`,
    "",
    "Voici votre devis prepare par Oumar Business.",
    "",
    `Service: ${quote.serviceType}`,
    `Montant: ${Number(quote.total).toLocaleString("fr-FR")} ${quote.currency}`,
    `Validite: jusqu'au ${new Date(quote.validUntil).toLocaleDateString("fr-FR")}`,
    "",
    "Resume du besoin :",
    quote.brief,
    "",
    "Si vous validez ce devis, nous pouvons passer a l'etape suivante rapidement.",
    "",
    "Oumar Business"
  ].join("\n");
}

function quoteWhatsAppText(quote: QuoteWithClient) {
  return [
    `Bonjour ${quote.client.name},`,
    `Voici votre devis pour ${quote.serviceType}.`,
    `Montant: ${Number(quote.total).toLocaleString("fr-FR")} ${quote.currency}`,
    `Validite: ${new Date(quote.validUntil).toLocaleDateString("fr-FR")}`,
    `Resume: ${quote.brief}`,
    "Si c'est bon pour vous, nous pouvons lancer la suite."
  ].join("\n");
}
