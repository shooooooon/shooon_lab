import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import pinoHttp from "pino-http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { logger } from "./logger";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // P6: trust proxy設定（本番環境でリバースプロキシの背後で動作する場合）
  if (ENV.isProduction) {
    app.set("trust proxy", 1);
  }

  // P2: セキュリティヘッダー（helmet）
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  // Vite HMR用
        styleSrc: ["'self'", "'unsafe-inline'"],  // TailwindCSS用
        imgSrc: ["'self'", "data:", "https:"],     // 外部画像URL対応
        connectSrc: ["'self'", "wss:", "https:"],  // WebSocket対応
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    },
    crossOriginEmbedderPolicy: false,  // 外部画像読み込み対応
  }));

  // P13: gzip圧縮
  app.use(compression());

  // P11: リクエストログ（構造化ログ）
  app.use(pinoHttp({ 
    logger,
    autoLogging: ENV.isProduction,  // 開発時は自動ログを無効化
  }));

  // P3: レート制限
  if (ENV.isProduction) {
    // API全体のレート制限
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,  // 15分
      max: 100,                   // 1IPあたり100リクエスト
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later" },
    });

    // OAuth認証のレート制限（より厳しく）
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { error: "Too many authentication attempts, please try again later" },
    });

    app.use("/api/trpc", apiLimiter);
    app.use("/api/oauth", authLimiter);
  }

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = ENV.port;
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const httpServer = server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);
  });

  // P5: グレースフルシャットダウン
  function gracefulShutdown(signal: string) {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    httpServer.close(() => {
      logger.info("HTTP server closed. Exiting.");
      process.exit(0);
    });

    // 強制終了のタイムアウト（10秒）
    setTimeout(() => {
      logger.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error(err, "Uncaught exception");
    gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection");
  });
}

startServer().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
