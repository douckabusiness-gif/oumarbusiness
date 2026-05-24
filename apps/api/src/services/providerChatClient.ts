export type ProviderChatConfig = {
  providerId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ProviderChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderChatInput = {
  systemPrompt: string;
  messages: ProviderChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

type OpenAiChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
};

type ClaudeMessagePayload = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type GeminiPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class ProviderChatError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string
  ) {
    super(message);
  }
}

function trimSlash(value: string) {
  return value.replace(/\/$/, "");
}

function extractText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function postJson(url: string, init: RequestInit, attempt = 1): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(45_000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const retriable = response.status === 429 || response.status >= 500;
    if (retriable && attempt < 2) {
      return postJson(url, init, attempt + 1);
    }

    throw new ProviderChatError(
      `Fournisseur IA refuse la requete (${response.status}) ${body.slice(0, 180)}`,
      response.status,
      body
    );
  }

  return response.json();
}

function toOpenAiMessages(systemPrompt: string, messages: ProviderChatMessage[]) {
  return [
    {
      role: "system",
      content: systemPrompt
    },
    ...messages
  ];
}

async function callOpenAiCompatible(provider: ProviderChatConfig, input: ProviderChatInput): Promise<string> {
  const payload = (await postJson(`${trimSlash(provider.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      messages: toOpenAiMessages(input.systemPrompt, input.messages),
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 1200
    })
  })) as OpenAiChatPayload;

  return extractText(payload.choices?.[0]?.message?.content);
}

async function callClaude(provider: ProviderChatConfig, input: ProviderChatInput): Promise<string> {
  const payload = (await postJson(`${trimSlash(provider.baseUrl)}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      system: input.systemPrompt,
      messages: input.messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 1200
    })
  })) as ClaudeMessagePayload;

  return (payload.content ?? [])
    .filter((part) => part.type === "text" || part.text)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

async function callGemini(provider: ProviderChatConfig, input: ProviderChatInput): Promise<string> {
  const url = `${trimSlash(provider.baseUrl)}/v1beta/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const payload = (await postJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.systemPrompt }]
      },
      contents: input.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxTokens ?? 1200
      }
    })
  })) as GeminiPayload;

  return (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function callProviderChat(provider: ProviderChatConfig, input: ProviderChatInput): Promise<string> {
  if (provider.providerId === "claude") {
    return callClaude(provider, input);
  }

  if (provider.providerId === "gemini") {
    return callGemini(provider, input);
  }

  return callOpenAiCompatible(provider, input);
}

export function providerChatErrorMessage(providerId: string, error: unknown) {
  const status = error instanceof ProviderChatError ? error.status : undefined;
  const body = error instanceof ProviderChatError ? error.body ?? "" : "";
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = `${message} ${body}`;

  if (status === 403 || /Authorization failed|Forbidden/i.test(fullMessage)) {
    if (providerId === "nvidia-nim") {
      return "Cle valide pour lister les modeles, mais non autorisee pour l'inference chat. NVIDIA a retourne: 403 Authorization failed.";
    }

    return "Le fournisseur refuse l'autorisation chat (403). La cle existe, mais elle n'a pas acces a l'inference ou au modele choisi.";
  }

  if (status === 401 || /unauthorized|invalid api key/i.test(fullMessage)) {
    return "Le fournisseur refuse la cle API (401). Remplace la cle puis relance le test chat.";
  }

  if (status === 404 || /model/i.test(fullMessage)) {
    return "Le modele choisi n'est pas disponible pour le chat chez ce fournisseur.";
  }

  if (status === 429 || /rate/i.test(fullMessage)) {
    return "Le fournisseur limite temporairement les requetes. Reessaie plus tard ou choisis un autre fournisseur.";
  }

  return message || "Test chat impossible pour ce fournisseur.";
}
