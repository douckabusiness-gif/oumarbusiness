import { Router } from "express";
import { EmailEngine } from "@oumar/email-engine";
import { getRuntimeEmailAccount } from "./settings.js";

export const emailRouter = Router();

emailRouter.get("/threads", async (req, res) => {
  const folder = typeof req.query.folder === "string" && req.query.folder.trim() ? req.query.folder.trim() : "INBOX";
  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : "main";
  const limit = Math.min(Math.max(Number(req.query.limit ?? 30), 1), 50);

  try {
    const account = await getRuntimeEmailAccount(accountId);
    const engine = new EmailEngine();
    const messages = await engine.listMessages(account, folder, limit);

    res.json({
      ok: true,
      accountId: account.id,
      folder,
      threads: messages,
      messages
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? Number((error as { status: number }).status) : 502;
    res.status(status).json({
      ok: false,
      error: emailErrorMessage(error)
    });
  }
});

emailRouter.post("/send", async (req, res) => {
  const accountId = typeof req.body?.accountId === "string" ? req.body.accountId : "main";
  const to = normalizeRecipients(req.body?.to);
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const html = typeof req.body?.html === "string" ? req.body.html : undefined;

  if (to.length === 0) {
    return res.status(400).json({ ok: false, error: "Ajoute au moins un destinataire." });
  }

  if (!subject) {
    return res.status(400).json({ ok: false, error: "Ajoute un sujet au message." });
  }

  if (!text.trim() && !html?.trim()) {
    return res.status(400).json({ ok: false, error: "Ecris le contenu du message avant d'envoyer." });
  }

  try {
    const account = await getRuntimeEmailAccount(accountId);
    const engine = new EmailEngine();
    const sent = await engine.send({
      account,
      from: `${account.name ?? "Oumar Business"} <${account.email}>`,
      to,
      subject,
      text,
      html
    });

    res.json({
      ok: true,
      message: "Email envoye avec succes.",
      sent
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? Number((error as { status: number }).status) : 502;
    res.status(status).json({
      ok: false,
      error: smtpErrorMessage(error)
    });
  }
});

function normalizeRecipients(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function emailErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/mot de passe|password/i.test(message)) {
    return message;
  }

  if (/Invalid login|Authentication|AUTH|LOGIN/i.test(message)) {
    return "IMAP: authentification refusee. Verifie l'adresse email complete et le mot de passe LWS dans Parametres > Email.";
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(message)) {
    return "IMAP: serveur email inaccessible. Verifie mail.oumarbusiness.online, le port 993 et la connexion Docker.";
  }

  return `Impossible de lire les emails reels: ${message}`;
}

function smtpErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/mot de passe|password/i.test(message)) {
    return message;
  }

  if (/Invalid login|Authentication|AUTH|LOGIN/i.test(message)) {
    return "SMTP: authentification refusee. Verifie l'adresse email complete et le mot de passe LWS dans Parametres > Email.";
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(message)) {
    return "SMTP: serveur email inaccessible. Verifie mail.oumarbusiness.online, le port 465 et la connexion Docker.";
  }

  if (/recipient|RCPT|mailbox|address/i.test(message)) {
    return `SMTP: destinataire refuse. ${message}`;
  }

  return `Impossible d'envoyer l'email: ${message}`;
}
