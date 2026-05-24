import "dotenv/config";
import cors, { type CorsOptions } from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";
import { registerRoutes } from "./routes/index.js";
import { logger } from "./services/logger.js";
import { pgvectorService } from "./rag/pgvector.service.js";
import { startEmailOptOutPoller } from "./jobs/emailOptoutPoller.js";
import { startEmailIncomingPoller } from "./jobs/emailIncomingPoller.js";
import { startProjectDeadlinePoller } from "./jobs/projectDeadlinePoller.js";
import { startNightReportJob } from "./jobs/nightReportJob.js";
import { startBaileysAutoReconnect } from "./routes/modules/whatsapp.js";

const defaultAppUrl = "http://localhost:1010";
const defaultLocalOrigins = [defaultAppUrl, "http://127.0.0.1:1010"];
const allowedOrigins = Array.from(
  new Set(
    [
      ...(process.env.CORS_ORIGINS?.split(",") ?? []),
      process.env.APP_URL,
      ...defaultLocalOrigins
    ]
      .map((origin) => origin?.trim())
      .filter((origin): origin is string => Boolean(origin))
  )
);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true
};

const app = express();
const httpServer = createServer(app);
const uploadsDir = process.env.UPLOADS_DIR ?? "/data/uploads";
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(uploadsDir), { maxAge: "7d" }));

app.set("io", io);
registerRoutes(app);
app.use((_req, res) => {
  res.status(404).json({ error: "Route API introuvable." });
});
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const errorWithMeta = error as {
    message?: string;
    status?: number;
    statusCode?: number;
    stack?: string;
    type?: string;
  };
  const status =
    typeof errorWithMeta.status === "number"
      ? errorWithMeta.status
      : typeof errorWithMeta.statusCode === "number"
        ? errorWithMeta.statusCode
        : errorWithMeta.type === "entity.parse.failed"
          ? 400
          : 500;
  const message =
    errorWithMeta.type === "entity.parse.failed"
      ? "Corps de requete JSON invalide."
      : status >= 500
        ? "Une erreur serveur est survenue."
        : errorWithMeta.message?.trim() || "Requete invalide.";

  logger.error({ err: errorWithMeta, status }, "API request failed");
  res.status(status).json({ error: message });
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "dashboard socket connected");
});

const port = Number(process.env.PORT ?? 4000);

async function start() {
  await pgvectorService.ensureReady();
  startEmailOptOutPoller();
  startEmailIncomingPoller();
  startProjectDeadlinePoller();
  startNightReportJob();

  httpServer.listen(port, () => {
    logger.info({ port }, "Oumar API started");
    // Reconnecte automatiquement les sessions Baileys actives après restart
    void startBaileysAutoReconnect(io);
  });
}

void start();
