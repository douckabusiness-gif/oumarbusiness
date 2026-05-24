import { Router } from "express";
import {
  getSearchIntelligenceConfig,
  researchObjective,
  searchSerper,
  searchTavily
} from "../../services/searchIntelligence.js";

export const intelligenceRouter = Router();

intelligenceRouter.get("/search/providers", (_req, res) => {
  res.json(getSearchIntelligenceConfig());
});

intelligenceRouter.post("/search/objective", async (req, res, next) => {
  try {
    const objective = String(req.body.objective ?? "");
    if (!objective.trim()) {
      res.status(400).json({ error: "objective_required" });
      return;
    }

    const result = await researchObjective({
      objective,
      country: req.body.country,
      language: req.body.language,
      audience: req.body.audience,
      limit: req.body.limit
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

intelligenceRouter.post("/serper/search", async (req, res, next) => {
  try {
    const query = String(req.body.query ?? "");
    if (!query.trim()) {
      res.status(400).json({ error: "query_required" });
      return;
    }

    res.json(
      await searchSerper({
        query,
        limit: Number(req.body.limit ?? 5),
        country: req.body.country,
        language: req.body.language
      })
    );
  } catch (error) {
    next(error);
  }
});

intelligenceRouter.post("/tavily/search", async (req, res, next) => {
  try {
    const query = String(req.body.query ?? "");
    if (!query.trim()) {
      res.status(400).json({ error: "query_required" });
      return;
    }

    res.json(
      await searchTavily({
        query,
        limit: Number(req.body.limit ?? 5),
        language: req.body.language
      })
    );
  } catch (error) {
    next(error);
  }
});
