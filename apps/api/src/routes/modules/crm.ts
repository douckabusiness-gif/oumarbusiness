import { Router } from "express";
import { prisma } from "../../db/prisma.js";

export const crmRouter = Router();

crmRouter.get("/clients", async (_req, res, next) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });
    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

crmRouter.post("/prospects", async (req, res, next) => {
  try {
    const name = stringField(req.body.name);
    if (!name) {
      res.status(400).json({ error: "Le nom du prospect est requis." });
      return;
    }

    const email = stringField(req.body.email) || undefined;
    const whatsapp = stringField(req.body.whatsapp) || undefined;
    const company = stringField(req.body.company) || undefined;
    const tags = Array.isArray(req.body.tags) ? req.body.tags.map(String).filter(Boolean) : [];

    const existing = await prisma.client.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          whatsapp ? { whatsapp } : undefined,
          company ? { company } : undefined
        ].filter(Boolean) as Array<{ email?: string; whatsapp?: string; company?: string }>
      }
    });

    const data = {
      name,
      company,
      email,
      whatsapp,
      country: stringField(req.body.country) || undefined,
      language: stringField(req.body.language) || "fr",
      source: "sourcing_agent",
      status: "prospect",
      tags: Array.from(new Set(["sourcing", ...tags])),
      lastContact: new Date()
    };

    const client = existing
      ? await prisma.client.update({
          where: { id: existing.id },
          data: {
            ...data,
            tags: Array.from(new Set([...existing.tags, ...data.tags]))
          }
        })
      : await prisma.client.create({ data });

    res.status(existing ? 200 : 201).json({ client, created: !existing });
  } catch (error) {
    next(error);
  }
});

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
