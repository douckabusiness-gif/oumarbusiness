import { Router } from "express";
import { prisma } from "../../db/prisma.js";

export const projectsRouter = Router();

projectsRouter.get("/", async (_req, res, next) => {
  try {
    const now = new Date();
    const projects = await prisma.project.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true
          }
        },
        milestones: {
          orderBy: { dueDate: "asc" },
          take: 3
        }
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }]
    });

    res.json({
      ok: true,
      projects: projects.map((project: (typeof projects)[number]) => ({
        id: project.id,
        name: project.name,
        type: project.type,
        status: project.status,
        budget: project.budget,
        currency: project.currency,
        deadline: project.deadline?.toISOString() ?? null,
        startDate: project.startDate?.toISOString() ?? null,
        completedAt: project.completedAt?.toISOString() ?? null,
        overdue: Boolean(project.deadline && !project.completedAt && project.deadline < now && !["completed", "cancelled"].includes(project.status)),
        client: project.client,
        milestones: project.milestones.map((milestone: (typeof project.milestones)[number]) => ({
          id: milestone.id,
          title: milestone.title,
          status: milestone.status,
          dueDate: milestone.dueDate.toISOString(),
          completedAt: milestone.completedAt?.toISOString() ?? null
        }))
      }))
    });
  } catch (error) {
    next(error);
  }
});
