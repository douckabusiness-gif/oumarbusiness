import { Router } from "express";
import { prisma } from "../../db/prisma.js";
import { clientMemoryService } from "../../memory/client-memory.service.js";
import { knowledgeIngestionService } from "../../rag/ingestion.service.js";
import { documentExtractionService } from "../../rag/document-extraction.service.js";
import { retrievalService } from "../../rag/retrieval.service.js";

export const memoryRouter = Router();

memoryRouter.get("/clients", async (_req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memoryProfile: {
          include: {
            facts: {
              orderBy: { createdAt: "desc" },
              take: 3
            },
            preferences: {
              orderBy: { createdAt: "desc" },
              take: 3
            }
          }
        },
        conversationSessions: {
          orderBy: { updatedAt: "desc" },
          take: 1
        }
      }
    });

    res.json({ clients, total: clients.length });
  } catch (error) {
    next(error);
  }
});

memoryRouter.get("/clients/:clientId", async (req, res, next) => {
  try {
    const memory = await clientMemoryService.getProfile(req.params.clientId);
    if (!memory) {
      res.status(404).json({ error: "memoire_client_introuvable" });
      return;
    }

    res.json({ memory });
  } catch (error) {
    next(error);
  }
});

memoryRouter.get("/sessions/:sessionId", async (req, res, next) => {
  try {
    const session = await prisma.conversationSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100
        },
        summaries: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      }
    });

    if (!session) {
      res.status(404).json({ error: "session_introuvable" });
      return;
    }

    res.json({ session });
  } catch (error) {
    next(error);
  }
});

memoryRouter.post("/knowledge/documents", async (req, res, next) => {
  try {
    const rawText = String(req.body.rawText ?? "");
    if (!rawText.trim()) {
      res.status(400).json({ error: "rawText_requis" });
      return;
    }

    const document = await knowledgeIngestionService.ingestDocument({
      title: String(req.body.title ?? "Document sans titre"),
      type: String(req.body.type ?? "knowledge"),
      scope: req.body.scope === "client" ? "client" : "global",
      source: req.body.source === "url" ? "url" : req.body.source === "upload" ? "upload" : "manual",
      clientId: req.body.clientId ? String(req.body.clientId) : undefined,
      sourceUrl: req.body.sourceUrl ? String(req.body.sourceUrl) : undefined,
      rawText,
      metadata: req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : undefined
    });

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
});

memoryRouter.post("/knowledge/files", async (req, res, next) => {
  try {
    const fileName = String(req.body.fileName ?? "");
    const base64 = String(req.body.base64 ?? "");
    if (!fileName.trim() || !base64.trim()) {
      res.status(400).json({ error: "fileName_et_base64_requis" });
      return;
    }

    const rawBase64 = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
    const buffer = Buffer.from(rawBase64, "base64");
    const rawText = await documentExtractionService.extractText({
      filename: fileName,
      mimeType: req.body.mimeType ? String(req.body.mimeType) : undefined,
      buffer
    });

    if (!rawText.trim()) {
      res.status(400).json({ error: "aucun_texte_extrait" });
      return;
    }

    const document = await knowledgeIngestionService.ingestDocument({
      title: String(req.body.title ?? fileName.replace(/\.[^.]+$/, "")),
      type: String(req.body.type ?? "knowledge"),
      scope: req.body.scope === "client" ? "client" : "global",
      source: "file",
      clientId: req.body.clientId ? String(req.body.clientId) : undefined,
      sourceUrl: req.body.sourceUrl ? String(req.body.sourceUrl) : undefined,
      rawText,
      metadata: {
        fileName,
        mimeType: req.body.mimeType ? String(req.body.mimeType) : undefined,
        uploadedBytes: buffer.length
      }
    });

    res.status(201).json({ document, extractedCharacters: rawText.length });
  } catch (error) {
    next(error);
  }
});

memoryRouter.post("/knowledge/files/preview", async (req, res, next) => {
  try {
    const fileName = String(req.body.fileName ?? "");
    const base64 = String(req.body.base64 ?? "");
    if (!fileName.trim() || !base64.trim()) {
      res.status(400).json({ error: "fileName_et_base64_requis" });
      return;
    }

    const rawBase64 = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
    const buffer = Buffer.from(rawBase64, "base64");
    const rawText = await documentExtractionService.extractText({
      filename: fileName,
      mimeType: req.body.mimeType ? String(req.body.mimeType) : undefined,
      buffer
    });

    const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 800);

    res.json({
      ok: true,
      fileName,
      characters: rawText.length,
      preview,
      detectedType: req.body.mimeType ? String(req.body.mimeType) : "unknown"
    });
  } catch (error) {
    next(error);
  }
});

memoryRouter.get("/knowledge/documents", async (_req, res, next) => {
  try {
    const documents = await knowledgeIngestionService.listDocuments();
    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

memoryRouter.post("/search", async (req, res, next) => {
  try {
    const query = String(req.body.query ?? "");
    if (!query.trim()) {
      res.status(400).json({ error: "query_requise" });
      return;
    }

    const results = await retrievalService.search({
      query,
      clientId: req.body.clientId ? String(req.body.clientId) : undefined,
      agentType: req.body.agentType ? String(req.body.agentType) : undefined,
      limit: Number(req.body.limit ?? 5)
    });

    res.json({ results, total: results.length });
  } catch (error) {
    next(error);
  }
});
