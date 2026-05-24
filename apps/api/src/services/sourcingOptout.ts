import { prisma } from "../db/prisma.js";

const optOutKey = "sourcing_optouts";

export type OptOutChannel = "email" | "whatsapp";

type OptOutEntry = {
  value: string;
  channel: OptOutChannel;
  reason: string;
  at: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

const stopPattern = /^\s*(stop|unsubscribe|d[eé]sabonn|arr[eê]te?r?|annuler)/i;

export function isStopMessage(text: string | undefined | null): boolean {
  if (!text) return false;
  return stopPattern.test(text.trim());
}

async function readOptOuts(): Promise<OptOutEntry[]> {
  const stored = await prisma.appSetting.findUnique({ where: { key: optOutKey } }).catch(() => null);
  return Array.isArray(stored?.value) ? (stored.value as OptOutEntry[]) : [];
}

export async function registerOptOut(input: {
  value: string;
  channel: OptOutChannel;
  reason?: string;
}): Promise<boolean> {
  const normalized = input.channel === "email" ? normalizeEmail(input.value) : normalizePhone(input.value);
  if (!normalized) return false;

  const entries = await readOptOuts();
  if (entries.some((entry) => entry.channel === input.channel && entry.value === normalized)) {
    return true;
  }

  const next: OptOutEntry[] = [
    {
      value: normalized,
      channel: input.channel,
      reason: input.reason?.trim() || "STOP",
      at: new Date().toISOString()
    },
    ...entries
  ].slice(0, 5000);

  await prisma.appSetting.upsert({
    where: { key: optOutKey },
    create: { key: optOutKey, value: next },
    update: { value: next }
  });

  return true;
}

export async function isOptedOut(input: { email?: string; whatsapp?: string }): Promise<boolean> {
  const email = input.email ? normalizeEmail(input.email) : "";
  const phone = input.whatsapp ? normalizePhone(input.whatsapp) : "";
  if (!email && !phone) return false;

  const entries = await readOptOuts();
  return entries.some((entry) => {
    if (entry.channel === "email" && email) return entry.value === email;
    if (entry.channel === "whatsapp" && phone) return entry.value === phone;
    return false;
  });
}
