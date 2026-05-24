"use client";

import { useEffect } from "react";
import { useState } from "react";
import { Bot, Loader2, MessageCircle, Minimize2, Send, UserRound } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

type LandingAssistantSettings = {
  enabled: boolean;
  assistantName: string;
  launcherTitle: string;
  launcherSubtitle: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  defaultDraft: string;
  quickPrompts: string[];
};

type LandingAgentPayload = {
  text: string;
  agentName: string;
  orchestratorGroup: "growth" | "operations";
  routeReason: string;
  decision: {
    confidence: number;
    escalate: boolean;
  };
};

type LandingChatMessage = {
  id: string;
  role: "user" | "agent";
  body: string;
  meta?: string;
  payload?: LandingAgentPayload;
};

const defaultSettings: LandingAssistantSettings = {
  enabled: true,
  assistantName: "Assistant Oumar Business",
  launcherTitle: "Besoin d'aide ?",
  launcherSubtitle: "Discute avec l'assistant",
  welcomeMessage: "Bonjour, je suis l'assistant Oumar Business. Ecris ton besoin et je t'oriente.",
  inputPlaceholder: "Ecris ton besoin...",
  defaultDraft: "Bonjour, je veux un site web avec agent IA.",
  quickPrompts: [
    "Je veux un devis pour un site web.",
    "Je veux un agent WhatsApp.",
    "Je veux automatiser mes relances."
  ]
};

const apiBaseUrl = getApiBaseUrl();

export function LandingAssistantChat() {
  const [settings, setSettings] = useState<LandingAssistantSettings>(defaultSettings);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(defaultSettings.defaultDraft);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<LandingChatMessage[]>([
    {
      id: "landing-welcome",
      role: "agent",
      body: defaultSettings.welcomeMessage,
      meta: "Assistant"
    }
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings/assistant`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as LandingAssistantSettings;
        if (!mounted) return;

        setSettings(payload);
        setInput(payload.defaultDraft);
        setMessages([
          {
            id: "landing-welcome",
            role: "agent",
            body: payload.welcomeMessage,
            meta: "Assistant"
          }
        ]);
      } catch {
        // Keep the assistant usable with local defaults.
      }
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  if (!settings.enabled) {
    return null;
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        body: text,
        meta: "Visiteur"
      }
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/agent-test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "whatsapp",
          text,
          locale: "fr",
          conversationId: "landing-assistant-chat"
        })
      });

      const payload = (await response.json()) as LandingAgentPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? `API ${response.status}`);
      }

      setMessages((current) => [
        ...current,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          body: payload.text,
          meta: `${payload.agentName} · ${payload.orchestratorGroup === "operations" ? "Operations" : "Growth"}`,
          payload
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "agent",
          body: "Je n'ai pas pu joindre l'assistant pour le moment.",
          meta: error instanceof Error ? error.message : "Erreur inconnue"
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] w-[min(92vw,24rem)]">
      {open ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-line bg-ink px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{settings.assistantName}</p>
                <p className="text-xs text-zinc-400">Pose ta question ici.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-line p-2 text-zinc-300 transition hover:border-gold/50 hover:text-white"
              aria-label="Réduire le chat"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[22rem] space-y-3 overflow-y-auto bg-ink p-4">
            {messages.slice(-5).map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl border px-3 py-2.5 text-sm ${
                    message.role === "user" ? "border-gold/40 bg-gold text-black" : "border-line bg-panel text-white"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-[11px] opacity-75">
                    {message.role === "user" ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    {message.meta}
                  </div>
                  <p className="leading-6">{message.body}</p>
                </div>
              </div>
            ))}

            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                L'assistant repond...
              </div>
            ) : null}
          </div>

          <div className="border-t border-line bg-panel px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {settings.quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={loading}
                  className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-300 transition hover:border-gold/50 hover:text-white disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                className="h-11 flex-1 rounded-xl border border-line bg-ink px-4 text-sm outline-none transition focus:border-gold/60"
                placeholder={settings.inputPlaceholder}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={loading}
                className="btn-gold inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex items-center gap-3 rounded-2xl border border-gold/40 bg-ink/95 px-4 py-3 text-left shadow-2xl shadow-black/40 transition hover:border-gold/70"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-black">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">{settings.launcherTitle}</span>
            <span className="block text-xs text-zinc-400">{settings.launcherSubtitle}</span>
          </span>
        </button>
      )}
    </div>
  );
}
