import { prisma } from "../db/prisma.js";
import { logger } from "../services/logger.js";
import { orchestrator } from "../agents/orchestrator.js";
import { getRuntimeEmailAccount } from "../routes/modules/settings.js";
import { EmailEngine } from "@oumar/email-engine";
import { sendBusinessPushNotificationSafe } from "../routes/modules/notifications.js";

const REPORT_LAST_RUN_KEY = "night_report_last_run";
const REPORT_HOUR = 7; // 7h du matin
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // vérification toutes les 5 min

// ─── Vérification si le rapport a déjà tourné aujourd'hui ─────────────────

async function wasRunToday(): Promise<boolean> {
  const stored = await prisma.appSetting.findUnique({ where: { key: REPORT_LAST_RUN_KEY } }).catch(() => null);
  if (!stored || !stored.value) return false;
  const today = new Date().toISOString().slice(0, 10);
  const value = typeof stored.value === "string" ? stored.value : String(stored.value);
  return value.startsWith(today);
}

async function markRunToday() {
  const iso = new Date().toISOString();
  await prisma.appSetting
    .upsert({
      where: { key: REPORT_LAST_RUN_KEY },
      update: { value: iso as never },
      create: { key: REPORT_LAST_RUN_KEY, value: iso as never }
    })
    .catch(() => undefined);
}

// ─── Construction du contexte journalier depuis la DB ─────────────────────

async function buildDailyContext(): Promise<string> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const [
    activeProjects,
    overdueProjects,
    newTasksYesterday,
    newInvoicesYesterday,
    overdueInvoices,
    newClientsThisMonth,
    revenueThisMonth
  ] = await Promise.all([
    prisma.project.count({ where: { status: { in: ["scoping", "active", "review"] } } }),
    prisma.project.count({
      where: { deadline: { lt: now }, completedAt: null, status: { notIn: ["completed", "cancelled"] } }
    }),
    prisma.task.findMany({
      where: { createdAt: { gte: yesterday } },
      include: { project: { select: { name: true } } },
      take: 10,
      orderBy: { createdAt: "desc" }
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: yesterday } },
      include: { client: { select: { name: true } } },
      take: 10,
      orderBy: { createdAt: "desc" }
    }),
    prisma.invoice.count({
      where: { status: { in: ["draft", "sent"] }, dueDate: { lt: now } }
    }),
    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.invoice.aggregate({
      where: { status: "paid", createdAt: { gte: startOfMonth } },
      _sum: { total: true }
    })
  ]);

  const revenue = Number(revenueThisMonth._sum.total ?? 0).toLocaleString("fr-FR");

  const lines: string[] = [
    `RAPPORT DU ${dateLabel.toUpperCase()}`,
    `Genere automatiquement a ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    "",
    "── TABLEAU DE BORD ──",
    `Projets actifs          : ${activeProjects}`,
    `Projets en retard       : ${overdueProjects}${overdueProjects > 0 ? " ⚠️" : " ✅"}`,
    `Factures impayées       : ${overdueInvoices}${overdueInvoices > 0 ? " ⚠️" : " ✅"}`,
    `Nouveaux clients (mois) : ${newClientsThisMonth}`,
    `Revenus encaisses (mois): ${revenue} XOF`,
    ""
  ];

  if (newTasksYesterday.length > 0) {
    lines.push(`── TACHES CREEES HIER (${newTasksYesterday.length}) ──`);
    for (const task of newTasksYesterday) {
      lines.push(`  • ${task.title} — ${task.project?.name ?? "sans projet"} [${task.status}]`);
    }
    lines.push("");
  } else {
    lines.push("Aucune nouvelle tache creee hier.");
    lines.push("");
  }

  if (newInvoicesYesterday.length > 0) {
    lines.push(`── FACTURES EMISES HIER (${newInvoicesYesterday.length}) ──`);
    for (const inv of newInvoicesYesterday) {
      const amount = Number(inv.total).toLocaleString("fr-FR");
      lines.push(`  • ${inv.number} — ${inv.client?.name ?? "client"} — ${amount} XOF [${inv.status}]`);
    }
    lines.push("");
  } else {
    lines.push("Aucune facture emise hier.");
    lines.push("");
  }

  if (overdueProjects > 0) {
    lines.push(`⚠️  ACTION REQUISE : ${overdueProjects} projet(s) ont depasse leur deadline.`);
  }
  if (overdueInvoices > 0) {
    lines.push(`⚠️  ACTION REQUISE : ${overdueInvoices} facture(s) non reglees sont en souffrance.`);
  }

  return lines.join("\n");
}

// ─── Exécution du rapport ──────────────────────────────────────────────────

async function runNightReport() {
  if (await wasRunToday()) return;

  logger.info("Lancement du rapport de nuit...");

  try {
    const context = await buildDailyContext();

    // Appel de l'agent Rapport
    const response = await orchestrator.chat({
      channel: "system",
      text: context,
      requestedAgent: "report",
      metadata: { source: "night_report", automated: true }
    });

    const reportText = response.text?.trim() ? response.text : context;

    // ── Notification push ──────────────────────────────────────────────
    await sendBusinessPushNotificationSafe({
      title: `📊 Rapport du ${new Date().toLocaleDateString("fr-FR")}`,
      body: reportText.slice(0, 150) + (reportText.length > 150 ? "…" : ""),
      url: "/overview",
      tag: "night-report",
      source: "night_report"
    });

    // ── Email au propriétaire ──────────────────────────────────────────
    try {
      const account = await getRuntimeEmailAccount("main");
      const engine = new EmailEngine();
      const dateLabel = new Date().toLocaleDateString("fr-FR");
      const htmlReport = reportText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/⚠️/g, '<span style="color:#f59e0b">⚠️</span>')
        .replace(/✅/g, '<span style="color:#34d399">✅</span>')
        .replace(/\n/g, "<br>");

      await engine.send({
        account,
        from: `${account.name ?? "Oumar Business"} <${account.email}>`,
        to: [account.email],
        subject: `📊 Rapport du ${dateLabel} — Oumar Business`,
        text: reportText,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#0e0e0e;color:#e5e5e5;border-radius:16px">
          <h2 style="color:#d4a020;margin:0 0 24px">Rapport du ${dateLabel}</h2>
          <div style="background:#1a1a1a;border-radius:12px;padding:20px;font-size:14px;line-height:1.7;white-space:pre-wrap;font-family:monospace">${htmlReport}</div>
          <p style="color:#555;font-size:12px;margin-top:24px">Genere automatiquement par Oumar Business</p>
        </div>`
      });
      logger.info({ to: account.email }, "Rapport de nuit envoye par email");
    } catch (emailErr) {
      logger.warn(
        { errorMessage: emailErr instanceof Error ? emailErr.message : String(emailErr) },
        "Rapport de nuit : echec envoi email (push envoyee quand meme)"
      );
    }

    await markRunToday();
    logger.info("Rapport de nuit complete avec succes");
  } catch (error) {
    logger.warn(
      { errorMessage: error instanceof Error ? error.message : String(error) },
      "Rapport de nuit : echec general"
    );
  }
}

// ─── Démarrage ─────────────────────────────────────────────────────────────

export function startNightReportJob() {
  const run = () => {
    const hour = new Date().getHours();
    if (hour === REPORT_HOUR) {
      void runNightReport().catch((err) =>
        logger.warn(
          { errorMessage: err instanceof Error ? err.message : String(err) },
          "Night report job: erreur non geree"
        )
      );
    }
  };

  // Premier check 1 min après le démarrage (au cas où le serveur redémarre à 7h)
  setTimeout(run, 60_000);
  setInterval(run, CHECK_INTERVAL_MS);
  logger.info({ hour: REPORT_HOUR }, "Rapport de nuit planifie");
}
