export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SUPERVISOR"
  | "WHATSAPP_OPERATOR"
  | "EMAIL_OPERATOR"
  | "SALES_AGENT"
  | "MARKETING_AGENT"
  | "FREELANCER"
  | "CLIENT";

export type AgentType =
  | "autonomous"
  | "prospection"
  | "sales"
  | "project"
  | "web"
  | "ai-builder"
  | "marketing"
  | "email"
  | "whatsapp"
  | "billing"
  | "freelance"
  | "report";

export type MessageChannel = "whatsapp" | "email" | "portal" | "system";

export type AgentInput = {
  id?: string;
  channel: MessageChannel;
  clientId?: string;
  conversationId?: string;
  text: string;
  metadata?: Record<string, unknown>;
};

export type AgentDecision = {
  agent: AgentType;
  action: "reply" | "escalate" | "create_task" | "create_quote" | "send_invoice" | "report";
  confidence: number;
  escalate: boolean;
  reason?: string;
};

export type AgentResponse = {
  text: string;
  decision: AgentDecision;
  toolAction?: {
    tool: string;
    args: Record<string, unknown>;
    status: "proposed" | "executed" | "pending_human" | "failed";
    message?: string;
    result?: Record<string, unknown>;
    error?: string;
  };
  attachments?: Array<{
    name: string;
    url: string;
    mimeType: string;
  }>;
};

export type NormalizedMessage = {
  id: string;
  channel: MessageChannel;
  from: string;
  to?: string;
  text?: string;
  type: "text" | "image" | "video" | "audio" | "document" | "location" | "contact" | "unknown";
  mediaUrl?: string;
  mimetype?: string;
  filename?: string;
  fileSize?: number;
  caption?: string;
  timestamp: string;
  raw?: unknown;
};
