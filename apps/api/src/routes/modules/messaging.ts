import { Router } from "express";

export const messagingRouter = Router();

const now = new Date().toISOString();

const conversations = [
  {
    id: "conv_awa",
    title: "Awa Kouame",
    channel: "client_portal",
    status: "open",
    priority: "high",
    aiMode: "autonomous",
    aiSummary: "Awa veut automatiser les reponses WhatsApp de son commerce et demande une estimation.",
    aiSentiment: "positive",
    unreadCount: 3,
    labels: ["prospect-chaud", "whatsapp", "agent-ia"],
    client: { id: "client_awa", name: "Awa Kouame", company: "Boutique Nimba" },
    project: { id: "project_ai_commerce", name: "Agent WhatsApp commerce" },
    assignedTo: "Agent autonome",
    lastMessage: "Pouvez-vous me proposer une formule avec installation rapide ?",
    lastMessageAt: now
  },
  {
    id: "conv_clinic",
    title: "ClinicAI",
    channel: "internal",
    status: "escalated",
    priority: "urgent",
    aiMode: "assist",
    aiSummary: "Projet en review client, retard possible sur le jalon integration.",
    aiSentiment: "neutral",
    unreadCount: 1,
    labels: ["projet", "retard"],
    client: { id: "client_clinic", name: "ClinicAI", company: "ClinicAI" },
    project: { id: "project_clinic", name: "Site vitrine ClinicAI" },
    assignedTo: "Oumar",
    lastMessage: "L'agent projet recommande une replanification du jalon.",
    lastMessageAt: now
  },
  {
    id: "conv_baobab",
    title: "Baobab Market",
    channel: "client_portal",
    status: "open",
    priority: "normal",
    aiMode: "off",
    aiSummary: "Client attend la facture finale et les derniers livrables.",
    aiSentiment: "positive",
    unreadCount: 0,
    labels: ["client", "facturation"],
    client: { id: "client_baobab", name: "Baobab Market", company: "Baobab Market" },
    project: { id: "project_baobab", name: "Portail client Baobab" },
    assignedTo: "Fatou",
    lastMessage: "Merci, nous validons le livrable.",
    lastMessageAt: now
  }
];

const messagesByConversation: Record<string, Array<Record<string, unknown>>> = {
  conv_awa: [
    {
      id: "msg_1",
      senderType: "client",
      senderName: "Awa Kouame",
      body: "Bonjour, je veux un systeme qui repond automatiquement a mes clients.",
      status: "read",
      createdAt: now
    },
    {
      id: "msg_2",
      senderType: "agent",
      senderName: "Agent autonome",
      agentType: "autonomous",
      body: "Bonjour Awa, oui. Je peux qualifier les demandes, repondre aux questions frequentes et transmettre les cas urgents.",
      status: "read",
      aiGenerated: true,
      createdAt: now
    },
    {
      id: "msg_3",
      senderType: "client",
      senderName: "Awa Kouame",
      body: "Pouvez-vous me proposer une formule avec installation rapide ?",
      status: "delivered",
      createdAt: now
    }
  ],
  conv_clinic: [
    {
      id: "msg_4",
      senderType: "agent",
      senderName: "Agent chef de projet",
      agentType: "project",
      body: "Le jalon integration risque de glisser de 48h. Je recommande de prevenir le client aujourd'hui.",
      status: "sent",
      aiGenerated: true,
      createdAt: now
    }
  ],
  conv_baobab: [
    {
      id: "msg_5",
      senderType: "client",
      senderName: "Baobab Market",
      body: "Merci, nous validons le livrable.",
      status: "read",
      createdAt: now
    }
  ]
};

messagingRouter.get("/conversations", (_req, res) => {
  res.json({ conversations });
});

messagingRouter.post("/conversations", (req, res) => {
  const conversation = {
    id: `conv_${Date.now()}`,
    title: String(req.body.title ?? "Nouvelle conversation"),
    channel: String(req.body.channel ?? "internal"),
    status: "open",
    priority: String(req.body.priority ?? "normal"),
    aiMode: String(req.body.aiMode ?? "assist"),
    labels: req.body.labels ?? [],
    unreadCount: 0,
    lastMessage: "",
    lastMessageAt: new Date().toISOString()
  };

  res.status(201).json({ conversation });
});

messagingRouter.get("/conversations/:id", (req, res) => {
  const conversation = conversations.find((item) => item.id === req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  return res.json({
    conversation,
    participants: [
      { id: "p_client", type: "client", displayName: conversation.client.name },
      { id: "p_agent", type: "agent", displayName: conversation.assignedTo }
    ],
    messages: messagesByConversation[conversation.id] ?? []
  });
});

messagingRouter.post("/conversations/:id/messages", (req, res) => {
  const conversation = conversations.find((item) => item.id === req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const message = {
    id: `msg_${Date.now()}`,
    senderType: String(req.body.senderType ?? "user"),
    senderName: String(req.body.senderName ?? "Oumar"),
    body: String(req.body.body ?? ""),
    status: "sent",
    aiGenerated: Boolean(req.body.aiGenerated),
    createdAt: new Date().toISOString()
  };

  const messages = messagesByConversation[conversation.id] ?? [];
  messages.push(message);
  messagesByConversation[conversation.id] = messages;

  res.status(201).json({ message });
});

messagingRouter.patch("/conversations/:id/ai-mode", (req, res) => {
  res.json({
    ok: true,
    conversationId: req.params.id,
    aiMode: String(req.body.aiMode ?? "assist")
  });
});

messagingRouter.post("/conversations/:id/summarize", (req, res) => {
  res.json({
    conversationId: req.params.id,
    summary:
      "Le client exprime un besoin clair, le ton est positif, et la prochaine action recommandee est d'envoyer une proposition commerciale."
  });
});
