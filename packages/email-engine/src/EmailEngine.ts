import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export type EmailAccountConfig = {
  id: string;
  name?: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure?: boolean;
  username: string;
  password: string;
  sentFolder?: string;
};

export type SendOptions = {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  account?: EmailAccountConfig;
};

export type EmailListMessage = {
  id: string;
  uid: number;
  folder: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  subject: string;
  preview: string;
  bodyText: string;
  receivedAt: string;
  isRead: boolean;
};

export class EmailEngine {
  async connect(account: EmailAccountConfig): Promise<void> {
    await this.testImap(account);
    await this.testSmtp(account);
  }

  async testImap(account: EmailAccountConfig): Promise<void> {
    const client = this.createImapClient(account);

    try {
      await client.connect();
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  async testSmtp(account: EmailAccountConfig): Promise<void> {
    const transporter = this.createSmtpTransport(account);
    await transporter.verify();
  }

  async sync() {
    return [];
  }

  async getThreads(_accountId: string, _folder: string, _page: number) {
    return [];
  }

  async listMessages(account: EmailAccountConfig, folder = "INBOX", limit = 30): Promise<EmailListMessage[]> {
    const client = this.createImapClient(account);

    try {
      await client.connect();
      const mailbox = await client.mailboxOpen(folder);
      const exists = Number(mailbox.exists ?? 0);
      if (!exists) {
        return [];
      }

      const start = Math.max(1, exists - Math.max(limit, 1) + 1);
      const messages: EmailListMessage[] = [];

      for await (const message of client.fetch(`${start}:*`, {
        envelope: true,
        flags: true,
        internalDate: true,
        source: true,
        uid: true
      })) {
        messages.push(this.serializeFetchedMessage(message, folder));
      }

      return messages.sort((left, right) => new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime());
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  async getThread(threadId: string) {
    return { id: threadId, messages: [] };
  }

  async getMessage(messageId: string) {
    return { id: messageId };
  }

  async getAttachment(_attachmentId: string) {
    return Buffer.from("");
  }

  async send(options: SendOptions) {
    if (!options.account) {
      return { id: crypto.randomUUID(), ...options, sentAt: new Date().toISOString(), simulated: true };
    }

    const transporter = this.createSmtpTransport(options.account);
    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    });

    await this.appendSentCopy(options.account, options, String(info.messageId ?? "")).catch(() => undefined);

    return {
      id: String(info.messageId ?? crypto.randomUUID()),
      ...options,
      sentAt: new Date().toISOString(),
      response: info.response
    };
  }

  async reply(messageId: string, content: string) {
    return { id: crypto.randomUUID(), inReplyTo: messageId, content };
  }

  async forward(messageId: string, to: string[]) {
    return { id: crypto.randomUUID(), forwarded: messageId, to };
  }

  async moveToFolder(_messageId: string, _folder: string) {}
  async markAsRead(_messageId: string) {}
  async addLabel(_messageId: string, _label: string) {}
  async snooze(_messageId: string, _until: Date) {}
  async scheduleEmail(options: SendOptions, sendAt: Date) {
    return { id: crypto.randomUUID(), ...options, sendAt };
  }
  async delete(_messageId: string) {}

  private createImapClient(account: EmailAccountConfig) {
    return new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure ?? account.imapPort === 993,
      auth: {
        user: account.username,
        pass: account.password
      },
      logger: false
    });
  }

  private createSmtpTransport(account: EmailAccountConfig) {
    return nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure ?? account.smtpPort === 465,
      auth: {
        user: account.username,
        pass: account.password
      }
    });
  }

  private async appendSentCopy(account: EmailAccountConfig, options: SendOptions, messageId: string) {
    const client = this.createImapClient(account);
    const raw = this.createRawMessage(options, messageId);

    try {
      await client.connect();
      await client.append(account.sentFolder ?? "Sent", Buffer.from(raw), ["\\Seen"]);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private createRawMessage(options: SendOptions, messageId: string) {
    const boundary = `oumar-${crypto.randomUUID()}`;
    const escapedSubject = options.subject.replace(/\r?\n/g, " ");
    const normalizedMessageId = messageId || `<${crypto.randomUUID()}@oumarbusiness.online>`;
    const html = options.html ?? "";
    const text = options.text ?? html.replace(/<[^>]+>/g, " ");

    if (!html) {
      return [
        `Message-ID: ${normalizedMessageId}`,
        `Date: ${new Date().toUTCString()}`,
        `From: ${options.from}`,
        `To: ${options.to.join(", ")}`,
        `Subject: ${escapedSubject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "",
        text
      ].join("\r\n");
    }

    return [
      `Message-ID: ${normalizedMessageId}`,
      `Date: ${new Date().toUTCString()}`,
      `From: ${options.from}`,
      `To: ${options.to.join(", ")}`,
      `Subject: ${escapedSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      text,
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
      `--${boundary}--`
    ].join("\r\n");
  }

  private serializeFetchedMessage(message: unknown, folder: string): EmailListMessage {
    const item = message as {
      uid?: number;
      seq?: number;
      envelope?: {
        subject?: string;
        from?: Array<{ name?: string; address?: string }>;
        to?: Array<{ name?: string; address?: string }>;
        date?: Date;
        messageId?: string;
      };
      flags?: Set<string> | string[];
      internalDate?: Date;
      source?: Buffer;
    };
    const envelope = item.envelope ?? {};
    const from = envelope.from?.[0] ?? {};
    const uid = Number(item.uid ?? item.seq ?? 0);
    const bodyText = this.extractTextFromRawMessage(item.source?.toString("utf8") ?? "");

    return {
      id: String(envelope.messageId ?? `${folder}-${uid}`),
      uid,
      folder,
      fromName: from.name ?? from.address ?? "Expediteur inconnu",
      fromEmail: from.address ?? "",
      to: (envelope.to ?? []).map((recipient) => recipient.address ?? recipient.name ?? "").filter(Boolean),
      subject: envelope.subject || "(Sans sujet)",
      preview: this.createPreview(bodyText),
      bodyText,
      receivedAt: (item.internalDate ?? envelope.date ?? new Date()).toISOString(),
      isRead: this.hasSeenFlag(item.flags)
    };
  }

  private hasSeenFlag(flags: Set<string> | string[] | undefined) {
    if (!flags) return false;
    if (Array.isArray(flags)) return flags.includes("\\Seen");
    return flags.has("\\Seen");
  }

  private extractTextFromRawMessage(raw: string): string {
    if (!raw) return "";

    const parsed = this.splitHeadersAndBody(raw);
    const contentType = parsed.headers["content-type"] ?? "";
    const transferEncoding = parsed.headers["content-transfer-encoding"] ?? "";
    const boundary = this.getBoundary(contentType);

    if (boundary) {
      const parts = parsed.body
        .split(`--${boundary}`)
        .map((part) => part.trim())
        .filter((part) => part && part !== "--");
      const textPart = parts.find((part) => /content-type:\s*text\/plain/i.test(part));
      const htmlPart = parts.find((part) => /content-type:\s*text\/html/i.test(part));
      const selected = textPart ?? htmlPart ?? parts[0] ?? "";
      return this.extractTextFromRawMessage(selected);
    }

    const decoded = this.decodeTransfer(parsed.body, transferEncoding);
    if (/text\/html/i.test(contentType)) {
      return this.stripHtml(decoded);
    }

    return this.normalizeText(decoded);
  }

  private splitHeadersAndBody(raw: string) {
    const separator = raw.search(/\r?\n\r?\n/);
    const headerText = separator >= 0 ? raw.slice(0, separator) : "";
    const body = separator >= 0 ? raw.slice(separator).replace(/^\r?\n\r?\n/, "") : raw;
    const headers: Record<string, string> = {};
    let currentHeader = "";

    for (const line of headerText.split(/\r?\n/)) {
      if (/^\s/.test(line) && currentHeader) {
        headers[currentHeader] = `${headers[currentHeader]} ${line.trim()}`;
        continue;
      }

      const [name, ...rest] = line.split(":");
      if (!name || rest.length === 0) continue;
      currentHeader = name.toLowerCase();
      headers[currentHeader] = rest.join(":").trim();
    }

    return { headers, body };
  }

  private getBoundary(contentType: string) {
    const match = contentType.match(/boundary="?([^";]+)"?/i);
    return match?.[1] ?? "";
  }

  private decodeTransfer(body: string, encoding: string) {
    if (/base64/i.test(encoding)) {
      return Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8");
    }

    if (/quoted-printable/i.test(encoding)) {
      return body
        .replace(/=\r?\n/g, "")
        .replace(/=([A-Fa-f0-9]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
    }

    return body;
  }

  private stripHtml(value: string) {
    return this.normalizeText(
      value
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    );
  }

  private normalizeText(value: string) {
    return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  private createPreview(value: string) {
    const preview = this.normalizeText(value).replace(/\s+/g, " ");
    return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
  }
}
