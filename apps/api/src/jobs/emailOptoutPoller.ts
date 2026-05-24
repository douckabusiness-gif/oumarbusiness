import { EmailEngine } from "@oumar/email-engine";
import { prisma } from "../db/prisma.js";
import { logger } from "../services/logger.js";
import { isStopMessage, registerOptOut } from "../services/sourcingOptout.js";
import { getRuntimeEmailAccount } from "../routes/modules/settings.js";

const processedKey = "email_optout_processed";
const pollIntervalMs = 3 * 60 * 1000;
const maxProcessedIds = 800;

function firstMeaningfulLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith(">")) ?? ""
  );
}

async function readProcessed(): Promise<string[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: processedKey } }).catch(() => null);
  return Array.isArray(stored?.value) ? (stored.value as string[]) : [];
}

async function pollOnce() {
  let account: Awaited<ReturnType<typeof getRuntimeEmailAccount>>;
  try {
    account = await getRuntimeEmailAccount("main");
  } catch {
    return;
  }
  if (!account || !account.email || !account.password || !account.imapHost) return;

  try {
    const engine = new EmailEngine();
    const messages = await engine.listMessages(account, "INBOX", 40);

    const processedSet = new Set(await readProcessed());
    const ownEmail = account.email.trim().toLowerCase();
    let optOutCount = 0;
    let hasNew = false;

    for (const message of messages) {
      if (!message.id || processedSet.has(message.id)) continue;
      processedSet.add(message.id);
      hasNew = true;

      const sender = message.fromEmail.trim().toLowerCase();
      if (!sender || sender === ownEmail) continue;

      const isStop = isStopMessage(message.subject) || isStopMessage(firstMeaningfulLine(message.bodyText));
      if (isStop) {
        await registerOptOut({ value: sender, channel: "email", reason: "STOP email" }).catch(() => undefined);
        optOutCount += 1;
        logger.info({ sender }, "Opt-out STOP email enregistre");
      }
    }

    if (hasNew) {
      const nextProcessed = Array.from(processedSet).slice(-maxProcessedIds);
      await prisma.appSetting
        .upsert({
          where: { key: processedKey },
          create: { key: processedKey, value: nextProcessed },
          update: { value: nextProcessed }
        })
        .catch(() => undefined);
    }

    if (optOutCount > 0) {
      logger.info({ optOutCount }, "Poll opt-out email termine");
    }
  } catch (error) {
    logger.warn(
      { errorMessage: error instanceof Error ? error.message : String(error) },
      "Poll opt-out email: lecture de la boite de reception impossible"
    );
  }
}

export function startEmailOptOutPoller() {
  const run = () => {
    void pollOnce().catch((error) =>
      logger.warn(
        { errorMessage: error instanceof Error ? error.message : String(error) },
        "Poll opt-out email a echoue"
      )
    );
  };

  setTimeout(run, 20_000);
  setInterval(run, pollIntervalMs);
}
