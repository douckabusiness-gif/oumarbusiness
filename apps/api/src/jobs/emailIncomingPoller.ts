import { EmailEngine } from "@oumar/email-engine";
import { prisma } from "../db/prisma.js";
import { getRuntimeEmailAccount } from "../routes/modules/settings.js";
import { logger } from "../services/logger.js";
import { sendBusinessPushNotificationSafe } from "../routes/modules/notifications.js";
import { orchestrator } from "../agents/orchestrator.js";

const processedKey = "email_inbox_processed";
const autorepliedKey = "email_inbox_autoreplied";
const pollIntervalMs = 90 * 1000;
const maxProcessedIds = 800;
const MAX_AUTOREPLIES_PER_DAY = 20;

type AutorepliedRecord = { id: string; date: string };

async function readProcessed(): Promise<string[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: processedKey } }).catch(() => null);
  return Array.isArray(stored?.value) ? (stored.value as string[]) : [];
}

async function writeProcessed(ids: string[]) {
  await prisma.appSetting
    .upsert({
      where: { key: processedKey },
      create: { key: processedKey, value: ids as never },
      update: { value: ids as never }
    })
    .catch(() => undefined);
}

async function readAutoreplied(): Promise<AutorepliedRecord[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: autorepliedKey } }).catch(() => null);
  return Array.isArray(stored?.value) ? (stored.value as AutorepliedRecord[]) : [];
}

async function writeAutoreplied(records: AutorepliedRecord[]) {
  await prisma.appSetting
    .upsert({
      where: { key: autorepliedKey },
      create: { key: autorepliedKey, value: records as never },
      update: { value: records as never }
    })
    .catch(() => undefined);
}

async function pollOnce() {
  let account: Awaited<ReturnType<typeof getRuntimeEmailAccount>>;
  try {
    account = await getRuntimeEmailAccount("main");
  } catch {
    return;
  }

  if (!account.email || !account.password || !account.imapHost) return;

  try {
    const engine = new EmailEngine();
    const messages = await engine.listMessages(account, "INBOX", 25);
    const processedSet = new Set(await readProcessed());
    const autoreplied = await readAutoreplied();

    const today = new Date().toISOString().slice(0, 10);
    const todayReplies = autoreplied.filter((r) => r.date === today);
    let repliedCount = todayReplies.length;
    const newReplied: AutorepliedRecord[] = [];

    const ownEmail = account.email.trim().toLowerCase();
    let changed = false;

    for (const message of messages) {
      if (!message.id || processedSet.has(message.id)) continue;

      processedSet.add(message.id);
      changed = true;

      const sender = message.fromEmail.trim().toLowerCase();
      if (!sender || sender === ownEmail) continue;

      // ── Notification push (comportement existant) ───────────────────────
      await sendBusinessPushNotificationSafe({
        title: "Nouvel email entrant",
        body: `${message.fromName || message.fromEmail}: ${message.subject}`,
        url: "/email",
        tag: `email-incoming-${message.uid || message.id}`,
        source: "email_incoming"
      });

      // ── Auto-réponse via agent Email ────────────────────────────────────
      if (repliedCount >= MAX_AUTOREPLIES_PER_DAY) {
        logger.info({ repliedCount }, "Limite d'auto-reponse email atteinte pour aujourd'hui");
        continue;
      }

      const emailText = [
        `Email de : ${message.fromName || sender} <${sender}>`,
        `Sujet : ${message.subject}`,
        "",
        message.bodyText || message.preview || "(contenu vide)"
      ].join("\n");

      try {
        const response = await orchestrator.chat({
          channel: "email",
          text: emailText,
          clientId: sender,
          requestedAgent: "email",
          metadata: {
            source: "email_incoming_auto",
            fromName: message.fromName,
            fromEmail: sender,
            subject: message.subject
          }
        });

        if (!response.decision.escalate && response.text.trim()) {
          const replySubject = message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`;
          await engine.send({
            account,
            from: `${account.name ?? "Oumar Business"} <${account.email}>`,
            to: [sender],
            subject: replySubject,
            text: response.text
          });

          repliedCount++;
          newReplied.push({ id: message.id, date: today });
          logger.info({ to: sender, subject: replySubject }, "Auto-reponse email envoyee");
        } else {
          logger.info({ sender, reason: response.decision.reason }, "Agent email : escalade — pas d'auto-reponse");
        }
      } catch (err) {
        logger.warn(
          { errorMessage: err instanceof Error ? err.message : String(err) },
          "Auto-reponse email : echec orchestrateur"
        );
      }
    }

    if (changed) {
      await writeProcessed(Array.from(processedSet).slice(-maxProcessedIds));
    }

    if (newReplied.length > 0) {
      const allRecords = [...autoreplied, ...newReplied]
        .filter((r) => r.date >= today)
        .slice(-500);
      await writeAutoreplied(allRecords);
    }
  } catch (error) {
    logger.warn(
      { errorMessage: error instanceof Error ? error.message : String(error) },
      "Poll emails entrants: lecture IMAP impossible"
    );
  }
}

export function startEmailIncomingPoller() {
  const run = () => {
    void pollOnce().catch((error) =>
      logger.warn(
        { errorMessage: error instanceof Error ? error.message : String(error) },
        "Poll emails entrants a echoue"
      )
    );
  };

  setTimeout(run, 30_000);
  setInterval(run, pollIntervalMs);
}
