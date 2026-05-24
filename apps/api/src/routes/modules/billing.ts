import { randomUUID } from "node:crypto";
import { Router } from "express";
import { EmailEngine } from "@oumar/email-engine";
import { baileysManager } from "@oumar/whatsapp-baileys";
import { prisma } from "../../db/prisma.js";
import { sendBusinessPushNotificationSafe } from "./notifications.js";
import { getRuntimeEmailAccount, loadBillingSettings, loadBrandingSettings } from "./settings.js";

export const billingRouter = Router();

const BILLING_INVOICES_KEY = "billing-manual-invoices";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type PaymentMethod = "wave" | "orange_money";

type ManualInvoice = {
  id: string;
  number: string;
  clientName: string;
  clientEmail?: string;
  clientWhatsapp?: string;
  projectName: string;
  amount: number;
  currency: "XOF" | "EUR" | "USD";
  dueDate: string;
  createdAt: string;
  sentAt: string;
  paidAt?: string;
  status: InvoiceStatus;
  paymentMethods: PaymentMethod[];
  paymentReference?: string;
  paymentMethodUsed?: PaymentMethod;
  notes?: string;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseInvoice(value: unknown): ManualInvoice | null {
  const source = asObject(value);
  const paymentMethods = Array.isArray(source.paymentMethods)
    ? source.paymentMethods.filter((item): item is PaymentMethod => item === "wave" || item === "orange_money")
    : [];

  if (
    typeof source.id !== "string" ||
    typeof source.number !== "string" ||
    typeof source.clientName !== "string" ||
    typeof source.projectName !== "string" ||
    typeof source.amount !== "number" ||
    typeof source.currency !== "string" ||
    typeof source.dueDate !== "string" ||
    typeof source.createdAt !== "string" ||
    typeof source.sentAt !== "string" ||
    typeof source.status !== "string"
  ) {
    return null;
  }

  if (!["draft", "sent", "paid", "overdue"].includes(source.status)) return null;

  return {
    id: source.id,
    number: source.number,
    clientName: source.clientName,
    clientEmail: typeof source.clientEmail === "string" ? source.clientEmail : undefined,
    clientWhatsapp: typeof source.clientWhatsapp === "string" ? source.clientWhatsapp : undefined,
    projectName: source.projectName,
    amount: source.amount,
    currency: source.currency as ManualInvoice["currency"],
    dueDate: source.dueDate,
    createdAt: source.createdAt,
    sentAt: source.sentAt,
    paidAt: typeof source.paidAt === "string" ? source.paidAt : undefined,
    status: source.status as InvoiceStatus,
    paymentMethods,
    paymentReference: typeof source.paymentReference === "string" ? source.paymentReference : undefined,
    paymentMethodUsed: source.paymentMethodUsed === "wave" || source.paymentMethodUsed === "orange_money" ? source.paymentMethodUsed : undefined,
    notes: typeof source.notes === "string" ? source.notes : undefined
  };
}

async function readInvoices() {
  const stored = await prisma.appSetting.findUnique({ where: { key: BILLING_INVOICES_KEY } }).catch(() => null);
  const raw = stored?.value;
  if (!Array.isArray(raw)) return [] as ManualInvoice[];
  return raw.map(parseInvoice).filter((item): item is ManualInvoice => Boolean(item));
}

async function writeInvoices(items: ManualInvoice[]) {
  await prisma.appSetting.upsert({
    where: { key: BILLING_INVOICES_KEY },
    update: { value: items as never },
    create: { key: BILLING_INVOICES_KEY, value: items as never }
  });
}

function sortInvoices(items: ManualInvoice[]) {
  return [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function invoiceSummary(items: ManualInvoice[]) {
  const paidXof = items.filter((item) => item.status === "paid" && item.currency === "XOF").reduce((sum, item) => sum + item.amount, 0);
  const pendingXof = items.filter((item) => item.status === "sent" && item.currency === "XOF").reduce((sum, item) => sum + item.amount, 0);
  const overdueXof = items.filter((item) => item.status === "overdue" && item.currency === "XOF").reduce((sum, item) => sum + item.amount, 0);

  return {
    paidXof,
    pendingXof,
    overdueXof,
    paidCount: items.filter((item) => item.status === "paid").length,
    pendingCount: items.filter((item) => item.status === "sent").length,
    overdueCount: items.filter((item) => item.status === "overdue").length
  };
}

function nextInvoiceNumber(prefix: string, items: ManualInvoice[]) {
  const year = new Date().getFullYear();
  const maxExisting = items
    .map((item) => {
      const match = item.number.match(/-(\d{3,})$/);
      return match ? Number(match[1]) : 0;
    })
    .reduce((max, current) => Math.max(max, current), 0);

  return `${prefix}-${year}-${String(maxExisting + 1).padStart(3, "0")}`;
}

function formatMethod(value: PaymentMethod) {
  return value === "wave" ? "Wave" : "Orange Money";
}

function formatStatus(value: InvoiceStatus) {
  if (value === "paid") return "Payee";
  if (value === "sent") return "Envoyee";
  if (value === "overdue") return "En retard";
  return "Brouillon";
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: Array<{ text: string; size?: number; x?: number; y: number }>) {
  const content = [
    "BT",
    "/F1 11 Tf",
    "0 0 0 rg"
  ];

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

function invoicePdfUrl(invoiceId: string) {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:1010";
  return `${appUrl}/api/billing/invoices/${invoiceId}/pdf`;
}

function invoiceEmailText(input: { invoice: ManualInvoice; settings: Awaited<ReturnType<typeof loadBillingSettings>>; branding: Awaited<ReturnType<typeof loadBrandingSettings>> }) {
  const methods = input.invoice.paymentMethods.map(formatMethod).join(", ");
  return [
    `Bonjour ${input.invoice.clientName},`,
    "",
    `Votre facture ${input.invoice.number} pour ${input.invoice.projectName} est prete.`,
    `Montant: ${input.invoice.amount.toLocaleString("fr-FR")} ${input.invoice.currency}`,
    `Echeance: ${input.invoice.dueDate}`,
    `Moyens de paiement: ${methods}`,
    "",
    input.invoice.paymentMethods.includes("wave") ? `Wave CI: ${input.settings.accounts.waveNumber}` : "",
    input.invoice.paymentMethods.includes("orange_money") ? `Orange Money: ${input.settings.accounts.orangeMoneyNumber}` : "",
    "",
    `Reference a rappeler: ${input.invoice.number}`,
    `PDF facture: ${invoicePdfUrl(input.invoice.id)}`,
    "",
    input.branding.agencyName || "Oumar Business"
  ].filter(Boolean).join("\n");
}

function invoiceWhatsAppText(input: { invoice: ManualInvoice; settings: Awaited<ReturnType<typeof loadBillingSettings>> }) {
  return [
    `Bonjour ${input.invoice.clientName},`,
    `Facture ${input.invoice.number} - ${input.invoice.projectName}`,
    `Montant: ${input.invoice.amount.toLocaleString("fr-FR")} ${input.invoice.currency}`,
    `Echeance: ${input.invoice.dueDate}`,
    input.invoice.paymentMethods.includes("wave") ? `Wave: ${input.settings.accounts.waveNumber}` : "",
    input.invoice.paymentMethods.includes("orange_money") ? `Orange Money: ${input.settings.accounts.orangeMoneyNumber}` : "",
    `Reference: ${input.invoice.number}`,
    `PDF: ${invoicePdfUrl(input.invoice.id)}`
  ].filter(Boolean).join("\n");
}

billingRouter.get("/invoices", async (_req, res, next) => {
  try {
    const [settings, invoices] = await Promise.all([loadBillingSettings(), readInvoices()]);
    res.json({
      settings,
      summary: invoiceSummary(invoices),
      invoices: sortInvoices(invoices)
    });
  } catch (error) {
    next(error);
  }
});

billingRouter.get("/invoices/:id/pdf", async (req, res, next) => {
  try {
    const invoiceId = String(req.params.id ?? "").trim();
    const [settings, branding, invoices] = await Promise.all([loadBillingSettings(), loadBrandingSettings(), readInvoices()]);
    const invoice = invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      res.status(404).json({ error: "Facture introuvable." });
      return;
    }

    const referenceHint = `${invoice.number}-${invoice.clientName}`.replace(/\s+/g, "-").slice(0, 40);
    const lines: Array<{ text: string; size?: number; x?: number; y: number }> = [
      { text: branding.agencyName || "Oumar Business", size: 18, x: 56, y: 790 },
      { text: "FACTURE", size: 18, x: 420, y: 790 },
      { text: `Numero: ${invoice.number}`, x: 56, y: 752 },
      { text: `Statut: ${formatStatus(invoice.status)}`, x: 320, y: 752 },
      { text: `Client: ${invoice.clientName}`, x: 56, y: 724 },
      { text: `Projet: ${invoice.projectName}`, x: 56, y: 700 },
      { text: `Montant: ${invoice.amount.toLocaleString("fr-FR")} ${invoice.currency}`, size: 18, x: 56, y: 660 },
      { text: `Echeance: ${invoice.dueDate}`, x: 56, y: 630 },
      { text: `Paiement manuel - reference a rappeler: ${referenceHint}`, x: 56, y: 602 },
      { text: "Methodes de paiement autorisees:", size: 18, x: 56, y: 560 }
    ];

    let cursor = 530;
    if (invoice.paymentMethods.includes("wave")) {
      lines.push({ text: `Wave CI: ${settings.accounts.waveNumber}`, x: 72, y: cursor });
      lines.push({ text: "Envoyer le montant exact puis partager la reference du paiement.", x: 72, y: cursor - 22 });
      cursor -= 56;
    }
    if (invoice.paymentMethods.includes("orange_money")) {
      lines.push({ text: `Orange Money: ${settings.accounts.orangeMoneyNumber}`, x: 72, y: cursor });
      lines.push({ text: "Envoyer le montant exact puis partager la reference du paiement.", x: 72, y: cursor - 22 });
      cursor -= 56;
    }

    lines.push({ text: `Methodes actives: ${invoice.paymentMethods.map(formatMethod).join(", ")}`, x: 56, y: cursor });
    cursor -= 30;
    lines.push({ text: `Reference recommandee: ${referenceHint}`, x: 56, y: cursor });
    cursor -= 30;
    if (invoice.paymentReference) {
      lines.push({ text: `Reference recue: ${invoice.paymentReference}`, x: 56, y: cursor });
      cursor -= 30;
    }
    if (invoice.notes) {
      lines.push({ text: `Note: ${invoice.notes.slice(0, 110)}`, x: 56, y: cursor });
      cursor -= 30;
    }
    lines.push({ text: branding.footerText || "Merci de votre confiance - Oumar Business", x: 56, y: 120 });

    const pdfBuffer = buildSimplePdf(lines);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/invoices", async (req, res, next) => {
  try {
    const [settings, invoices] = await Promise.all([loadBillingSettings(), readInvoices()]);
    const clientName = typeof req.body.clientName === "string" ? req.body.clientName.trim() : "";
    const clientEmail = typeof req.body.clientEmail === "string" ? req.body.clientEmail.trim() : "";
    const clientWhatsapp = typeof req.body.clientWhatsapp === "string" ? req.body.clientWhatsapp.trim() : "";
    const projectName = typeof req.body.projectName === "string" ? req.body.projectName.trim() : "";
    const amount = Number(req.body.amount ?? 0);
    const currency = req.body.currency === "EUR" || req.body.currency === "USD" ? req.body.currency : "XOF";
    const dueDate = typeof req.body.dueDate === "string" && req.body.dueDate.trim() ? req.body.dueDate.trim() : new Date().toISOString().slice(0, 10);
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";
    const paymentMethods = Array.isArray(req.body.paymentMethods)
      ? req.body.paymentMethods.filter((item: unknown): item is PaymentMethod => item === "wave" || item === "orange_money")
      : [];

    if (!clientName || !projectName) {
      res.status(400).json({ error: "Client et projet sont obligatoires." });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "Montant invalide." });
      return;
    }

    if (paymentMethods.length === 0) {
      res.status(400).json({ error: "Choisis au moins un moyen de paiement manuel." });
      return;
    }

    const invoice: ManualInvoice = {
      id: randomUUID(),
      number: nextInvoiceNumber(settings.invoicing.invoicePrefix, invoices),
      clientName,
      clientEmail: clientEmail || undefined,
      clientWhatsapp: clientWhatsapp || undefined,
      projectName,
      amount,
      currency,
      dueDate,
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      status: "sent",
      paymentMethods,
      notes: notes || undefined
    };

    const nextInvoices = [invoice, ...invoices];
    await writeInvoices(nextInvoices);

    res.status(201).json({
      ok: true,
      invoice,
      summary: invoiceSummary(nextInvoices)
    });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/invoices/:id/send", async (req, res, next) => {
  try {
    const invoiceId = String(req.params.id ?? "").trim();
    const channel = typeof req.body.channel === "string" ? req.body.channel.trim() : "";
    const [settings, branding, invoices] = await Promise.all([loadBillingSettings(), loadBrandingSettings(), readInvoices()]);
    const invoice = invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      res.status(404).json({ error: "Facture introuvable." });
      return;
    }

    if (channel === "email") {
      if (!invoice.clientEmail) {
        res.status(400).json({ error: "Aucun email client sur cette facture." });
        return;
      }

      const account = await getRuntimeEmailAccount("main");
      const engine = new EmailEngine();
      await engine.send({
        account,
        from: `${account.name ?? "Oumar Business"} <${account.email}>`,
        to: [invoice.clientEmail],
        subject: `Facture ${invoice.number} - ${invoice.projectName}`,
        text: invoiceEmailText({ invoice, settings, branding })
      });

      res.json({ ok: true, message: "Facture envoyee par email." });
      return;
    }

    if (channel === "whatsapp") {
      if (!invoice.clientWhatsapp) {
        res.status(400).json({ error: "Aucun numero WhatsApp client sur cette facture." });
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
        await client.sendText(invoice.clientWhatsapp, invoiceWhatsAppText({ invoice, settings }));
        res.json({ ok: true, message: "Facture envoyee par WhatsApp." });
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

billingRouter.patch("/invoices/:id/confirm-manual", async (req, res, next) => {
  try {
    const invoiceId = String(req.params.id ?? "").trim();
    const paymentMethod = req.body.paymentMethod === "orange_money" ? "orange_money" : req.body.paymentMethod === "wave" ? "wave" : null;
    const paymentReference = typeof req.body.paymentReference === "string" ? req.body.paymentReference.trim() : "";
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : "";

    if (!paymentMethod) {
      res.status(400).json({ error: "Methode de paiement invalide." });
      return;
    }

    const invoices = await readInvoices();
    const current = invoices.find((item) => item.id === invoiceId);
    if (!current) {
      res.status(404).json({ error: "Facture introuvable." });
      return;
    }

    const updated: ManualInvoice = {
      ...current,
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentMethodUsed: paymentMethod,
      paymentReference: paymentReference || current.paymentReference,
      notes: notes || current.notes
    };

    const nextInvoices = invoices.map((item) => (item.id === invoiceId ? updated : item));
    await writeInvoices(nextInvoices);

      await sendBusinessPushNotificationSafe({
        title: "Paiement confirme",
        body: `${updated.clientName} a regle la facture ${updated.number} par ${formatMethod(paymentMethod)}.`,
        url: "/billing",
        tag: `invoice-paid-${updated.id}`,
        source: "billing"
      });

    res.json({
      ok: true,
      invoice: updated,
      summary: invoiceSummary(nextInvoices)
    });
  } catch (error) {
    next(error);
  }
});

billingRouter.patch("/invoices/:id/status", async (req, res, next) => {
  try {
    const invoiceId = String(req.params.id ?? "").trim();
    const status = req.body.status === "draft" || req.body.status === "sent" || req.body.status === "overdue" ? req.body.status : null;
    if (!status) {
      res.status(400).json({ error: "Statut invalide." });
      return;
    }

    const invoices = await readInvoices();
    const current = invoices.find((item) => item.id === invoiceId);
    if (!current) {
      res.status(404).json({ error: "Facture introuvable." });
      return;
    }

    const updated: ManualInvoice = { ...current, status };
    const nextInvoices = invoices.map((item) => (item.id === invoiceId ? updated : item));
    await writeInvoices(nextInvoices);

    res.json({
      ok: true,
      invoice: updated,
      summary: invoiceSummary(nextInvoices)
    });
  } catch (error) {
    next(error);
  }
});
