import type { NormalizedMessage } from "@oumar/shared";

type WhatsAppCloudConfig = {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
};

type CloudAPIResponse = {
  messaging_product: "whatsapp";
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
};

export class WhatsAppCloudClient {
  constructor(private readonly config: WhatsAppCloudConfig) {}

  verifyWebhook(token: string, challenge: string) {
    if (token !== this.config.verifyToken) {
      throw new Error("Invalid WhatsApp Cloud webhook verify token");
    }

    return challenge;
  }

  parseWebhookPayload(body: any): NormalizedMessage {
    const change = body?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    return {
      id: message?.id ?? crypto.randomUUID(),
      channel: "whatsapp",
      from: message?.from ?? "unknown",
      to: change?.metadata?.display_phone_number,
      text: message?.text?.body,
      type: message?.type ?? "unknown",
      timestamp: message?.timestamp
        ? new Date(Number(message.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      raw: body
    };
  }

  async sendText(to: string, text: string): Promise<CloudAPIResponse> {
    return this.request("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    });
  }

  async sendTemplate(to: string, templateName: string, params: string[]): Promise<CloudAPIResponse> {
    return this.request("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "fr" },
        components: [
          {
            type: "body",
            parameters: params.map((text) => ({ type: "text", text }))
          }
        ]
      }
    });
  }

  async markAsRead(messageId: string) {
    await this.request("/messages", {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId
    });
  }

  async broadcastTemplate(contacts: string[], templateName: string, params: Record<string, string[]>) {
    const results = [];
    for (const contact of contacts) {
      results.push(await this.sendTemplate(contact, templateName, params[contact] ?? []));
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return { sent: results.length, results };
  }

  private async request(path: string, payload: Record<string, unknown>) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${this.config.phoneNumberId}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Cloud API error: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as CloudAPIResponse;
  }
}
