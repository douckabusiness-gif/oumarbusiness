import { prisma } from "../db/prisma.js";
import { logger } from "../services/logger.js";
import { sendBusinessPushNotificationSafe } from "../routes/modules/notifications.js";

const PROJECT_DEADLINE_ALERTS_KEY = "project_deadline_alerts";
const pollIntervalMs = 5 * 60 * 1000;
const activeStatuses = new Set(["scoping", "active", "review"]);

type DeadlineAlertRecord = {
  projectId: string;
  deadline: string;
  notifiedAt: string;
};

async function readAlertState(): Promise<DeadlineAlertRecord[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: PROJECT_DEADLINE_ALERTS_KEY } }).catch(() => null);
  return Array.isArray(stored?.value) ? (stored.value as DeadlineAlertRecord[]) : [];
}

async function writeAlertState(items: DeadlineAlertRecord[]) {
  await prisma.appSetting
    .upsert({
      where: { key: PROJECT_DEADLINE_ALERTS_KEY },
      create: { key: PROJECT_DEADLINE_ALERTS_KEY, value: items as never },
      update: { value: items as never }
    })
    .catch(() => undefined);
}

async function pollOnce() {
  try {
    const now = new Date();
    const projects = await prisma.project.findMany({
      where: {
        deadline: { not: null, lt: now },
        completedAt: null
      },
      include: {
        client: {
          select: { name: true }
        }
      },
      orderBy: { deadline: "asc" }
    });

    const alertState = await readAlertState();
    const alertMap = new Map(alertState.map((item) => [item.projectId, item]));
    const nextState: DeadlineAlertRecord[] = [];

    for (const project of projects) {
      if (!activeStatuses.has(project.status)) continue;
      if (!project.deadline) continue;

      const deadlineIso = project.deadline.toISOString();
      const previous = alertMap.get(project.id);
      nextState.push(previous && previous.deadline === deadlineIso ? previous : {
        projectId: project.id,
        deadline: deadlineIso,
        notifiedAt: new Date().toISOString()
      });

      if (previous && previous.deadline === deadlineIso) {
        continue;
      }

      const deadlineLabel = project.deadline.toLocaleString("fr-FR");
      await sendBusinessPushNotificationSafe({
        title: "Projet en retard",
        body: `${project.name} pour ${project.client.name} a depasse la deadline du ${deadlineLabel}.`,
        url: "/projects",
        tag: `project-delayed-${project.id}`,
        source: "project_delay"
      });
    }

    await writeAlertState(nextState);
  } catch (error) {
    logger.warn(
      { errorMessage: error instanceof Error ? error.message : String(error) },
      "Poll retards projets a echoue"
    );
  }
}

export function startProjectDeadlinePoller() {
  const run = () => {
    void pollOnce().catch((error) =>
      logger.warn(
        { errorMessage: error instanceof Error ? error.message : String(error) },
        "Poll retards projets impossible"
      )
    );
  };

  setTimeout(run, 45_000);
  setInterval(run, pollIntervalMs);
}
