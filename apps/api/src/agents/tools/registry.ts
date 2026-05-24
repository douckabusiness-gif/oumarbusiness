import type { AgentType, MessageChannel } from "@oumar/shared";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";

export type AgentToolName = "create_quote" | "create_task" | "send_invoice";

export type AgentToolContext = {
  agentType: AgentType;
  channel: MessageChannel;
  clientId?: string;
  conversationId?: string;
  originalText: string;
};

export type AgentToolExecution = {
  message: string;
  result: Record<string, unknown>;
};

export type AgentToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: AgentToolName;
  description: string;
  allowedAgents: AgentType[];
  schema: TSchema;
  execute(args: z.infer<TSchema>, ctx: AgentToolContext): Promise<AgentToolExecution>;
};

const currencySchema = z.enum(["XOF", "EUR", "USD"]).default("XOF");
const lineItemSchema = z.object({
  description: z.string().min(2),
  amount: z.coerce.number().nonnegative()
});

const createQuoteSchema = z.object({
  clientName: z.string().min(2).optional(),
  clientEmail: z.string().email().optional(),
  clientWhatsapp: z.string().min(5).optional(),
  serviceType: z.string().min(2),
  brief: z.string().min(5),
  total: z.coerce.number().positive(),
  currency: currencySchema,
  lineItems: z.array(lineItemSchema).optional(),
  validDays: z.coerce.number().int().min(1).max(60).default(15)
});

const createTaskSchema = z.object({
  projectId: z.string().min(5).optional(),
  projectName: z.string().min(2).optional(),
  clientName: z.string().min(2).optional(),
  clientEmail: z.string().email().optional(),
  clientWhatsapp: z.string().min(5).optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().optional()
});

const sendInvoiceSchema = z.object({
  clientName: z.string().min(2).optional(),
  clientEmail: z.string().email().optional(),
  clientWhatsapp: z.string().min(5).optional(),
  projectId: z.string().min(5).optional(),
  type: z.enum(["deposit", "milestone", "final", "subscription"]).default("deposit"),
  description: z.string().min(2),
  amount: z.coerce.number().positive(),
  currency: currencySchema,
  dueDays: z.coerce.number().int().min(1).max(90).default(7),
  paymentMethods: z.array(z.string().min(2)).default(["Wave", "Orange Money", "Virement bancaire"]),
  markAsSent: z.boolean().default(false)
});

async function resolveClient(
  ctx: AgentToolContext,
  input?: { clientName?: string; clientEmail?: string; clientWhatsapp?: string }
) {
  if (ctx.clientId) {
    const client = await prisma.client.findUnique({ where: { id: ctx.clientId } });
    if (client) return client;
  }

  const email = input?.clientEmail?.trim().toLowerCase();
  const whatsapp = input?.clientWhatsapp?.trim();
  const name = input?.clientName?.trim() || email || whatsapp || "Prospect cree par agent";

  const existing = await prisma.client.findFirst({
    where: {
      OR: [
        email ? { email } : undefined,
        whatsapp ? { whatsapp } : undefined,
        name ? { name: { equals: name, mode: "insensitive" } } : undefined
      ].filter(Boolean) as Array<Record<string, unknown>>
    }
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        email: existing.email ?? email,
        whatsapp: existing.whatsapp ?? whatsapp,
        tags: Array.from(new Set([...(existing.tags ?? []), "agent-action", ctx.agentType])),
        lastContact: new Date()
      }
    });
  }

  return prisma.client.create({
    data: {
      name,
      email,
      whatsapp,
      source: "agent_tool",
      status: "prospect",
      tags: ["agent-action", ctx.agentType],
      lastContact: new Date()
    }
  });
}

async function resolveProject(ctx: AgentToolContext, args: z.infer<typeof createTaskSchema>) {
  if (args.projectId) {
    const project = await prisma.project.findUnique({ where: { id: args.projectId } });
    if (project) return project;
  }

  const client = await resolveClient(ctx, args);
  const projectName = args.projectName?.trim() || args.title;
  const existingProject = await prisma.project.findFirst({
    where: {
      clientId: client.id,
      name: { equals: projectName, mode: "insensitive" },
      status: { notIn: ["completed", "cancelled"] }
    }
  });

  if (existingProject) return existingProject;

  return prisma.project.create({
    data: {
      name: projectName,
      clientId: client.id,
      type: "consulting",
      status: "scoping",
      brief: ctx.originalText,
      budget: 0,
      currency: "XOF"
    }
  });
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: {
      number: {
        startsWith: `OB-${year}-`
      }
    }
  });
  return `OB-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const agentTools: Record<AgentToolName, AgentToolDefinition> = {
  create_quote: {
    name: "create_quote",
    description: "Cree un vrai devis commercial dans le CRM.",
    allowedAgents: ["sales"],
    schema: createQuoteSchema,
    async execute(args, ctx) {
      const client = await resolveClient(ctx, args);
      const lineItems = args.lineItems?.length
        ? args.lineItems
        : [{ description: args.serviceType, amount: args.total }];
      const quote = await prisma.quote.create({
        data: {
          clientId: client.id,
          serviceType: args.serviceType,
          brief: args.brief,
          lineItems,
          total: args.total,
          currency: args.currency,
          status: "draft",
          validUntil: new Date(Date.now() + args.validDays * 24 * 60 * 60 * 1000)
        }
      });

      return {
        message: `Devis cree en brouillon: ${quote.total.toLocaleString("fr-FR")} ${quote.currency}.`,
        result: {
          quoteId: quote.id,
          clientId: client.id,
          total: quote.total,
          currency: quote.currency,
          status: quote.status
        }
      };
    }
  },
  create_task: {
    name: "create_task",
    description: "Cree une vraie tache projet, avec creation de projet si necessaire.",
    allowedAgents: ["project"],
    schema: createTaskSchema,
    async execute(args, ctx) {
      const project = await resolveProject(ctx, args);
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: args.title,
          description: args.description || ctx.originalText,
          priority: args.priority,
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined
        }
      });

      return {
        message: `Tache creee dans le projet: ${project.name}.`,
        result: {
          taskId: task.id,
          projectId: project.id,
          projectName: project.name,
          status: task.status,
          priority: task.priority
        }
      };
    }
  },
  send_invoice: {
    name: "send_invoice",
    description: "Cree une vraie facture. L'envoi externe reste gere par les workflows de facturation.",
    allowedAgents: ["billing"],
    schema: sendInvoiceSchema,
    async execute(args, ctx) {
      const client = await resolveClient(ctx, args);
      const invoice = await prisma.invoice.create({
        data: {
          number: await nextInvoiceNumber(),
          clientId: client.id,
          projectId: args.projectId,
          type: args.type,
          lineItems: [{ description: args.description, amount: args.amount }],
          subtotal: args.amount,
          tax: 0,
          total: args.amount,
          currency: args.currency,
          status: args.markAsSent ? "sent" : "draft",
          dueDate: new Date(Date.now() + args.dueDays * 24 * 60 * 60 * 1000),
          paymentMethods: args.paymentMethods,
          sentAt: args.markAsSent ? new Date() : undefined
        }
      });

      return {
        message: `Facture ${invoice.number} creee (${invoice.status}).`,
        result: {
          invoiceId: invoice.id,
          number: invoice.number,
          clientId: client.id,
          total: invoice.total,
          currency: invoice.currency,
          status: invoice.status
        }
      };
    }
  }
};

export function getToolsForAgent(agentType: AgentType) {
  return Object.values(agentTools).filter((tool) => tool.allowedAgents.includes(agentType));
}

export function getTool(name: string) {
  return agentTools[name as AgentToolName];
}

export function serializeToolsForPrompt(agentType: AgentType) {
  return getToolsForAgent(agentType).map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: zodSchemaHint(tool.name)
  }));
}

function zodSchemaHint(name: AgentToolName) {
  switch (name) {
    case "create_quote":
      return {
        clientName: "string optionnel",
        clientEmail: "email optionnel",
        clientWhatsapp: "telephone optionnel",
        serviceType: "string",
        brief: "string",
        total: "number",
        currency: "XOF|EUR|USD",
        lineItems: [{ description: "string", amount: "number" }],
        validDays: "number optionnel"
      };
    case "create_task":
      return {
        projectId: "string optionnel",
        projectName: "string optionnel",
        clientName: "string optionnel",
        clientEmail: "email optionnel",
        clientWhatsapp: "telephone optionnel",
        title: "string",
        description: "string optionnel",
        priority: "low|medium|high|urgent",
        dueDate: "YYYY-MM-DD optionnel"
      };
    case "send_invoice":
      return {
        clientName: "string optionnel",
        clientEmail: "email optionnel",
        clientWhatsapp: "telephone optionnel",
        projectId: "string optionnel",
        type: "deposit|milestone|final|subscription",
        description: "string",
        amount: "number",
        currency: "XOF|EUR|USD",
        dueDays: "number optionnel",
        paymentMethods: ["Wave", "Orange Money"],
        markAsSent: "boolean optionnel"
      };
  }
}
