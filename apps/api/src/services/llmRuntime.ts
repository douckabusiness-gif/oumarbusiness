import { getChatProviderConfig, type ChatProviderConfig } from "../routes/modules/settings.js";
import { logger } from "./logger.js";
import { callProviderChat, providerChatErrorMessage } from "./providerChatClient.js";

export type LlmChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateAgentReplyInput = {
  providerId?: string;
  model?: string;
  systemPrompt: string;
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type GenerateAgentReplyResult = {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  fallbackFrom?: string;
};

const providerModelFallbacks: Record<string, string[]> = {
  "nvidia-nim": [
    "meta/llama-3.3-70b-instruct",
    "meta/llama-3.1-70b-instruct",
    "mistralai/mistral-large",
    "mistralai/mixtral-8x7b-instruct-v0.1"
  ],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  openai: ["gpt-4.1-mini", "gpt-4o-mini"],
  qwen: ["qwen-plus", "qwen-turbo"],
  glm: ["glm-4.5", "glm-4-air"],
  "kimi-k2": ["moonshot-v1-8k"]
};

async function callProviderWithModelFallback(
  provider: ChatProviderConfig,
  input: GenerateAgentReplyInput
): Promise<{ text: string; model: string }> {
  const models = [provider.model, ...(providerModelFallbacks[provider.providerId] ?? [])].filter(
    (model, index, list) => model && list.indexOf(model) === index
  );
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const text = await callProviderChat(
        { ...provider, model },
        {
          systemPrompt: input.systemPrompt,
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens
        }
      );
      return { text, model };
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          provider: provider.providerId,
          model,
          errorMessage: providerChatErrorMessage(provider.providerId, error)
        },
        "llm model attempt failed"
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Aucun modele IA compatible n'a repondu.");
}

export async function generateAgentReply(input: GenerateAgentReplyInput): Promise<GenerateAgentReplyResult | null> {
  const provider = await getChatProviderConfig(input.providerId, input.model);
  if (!provider) {
    return null;
  }

  try {
    const { text, model } = await callProviderWithModelFallback(provider, input);
    if (!text) {
      throw new Error("Le fournisseur IA a retourne une reponse vide.");
    }

    return {
      text,
      providerId: provider.providerId,
      providerName: provider.name,
      model,
      fallbackFrom: provider.fallbackFrom
    };
  } catch (error) {
    logger.warn(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        provider: provider.providerId,
        model: provider.model,
        fallbackFrom: provider.fallbackFrom
      },
      "llm provider call failed"
    );
    throw error;
  }
}
