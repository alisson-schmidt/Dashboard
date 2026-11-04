import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer as createViteServer } from "vite";

import { logger } from "./src/lib/logger.js";
import { configureNetworkProxy } from "./src/lib/proxySetup.js";
import { initSocketServer } from "./src/lib/socket.js";
import apiRoutes from "./src/routes/apiRoutes.js";
import { globalErrorHandler } from "./src/middlewares/errorHandler.js";
import { startDriveSyncScheduler } from "./src/services/driveService.js";
import { startBackupScheduler } from "./src/services/backupService.js";

// Inicializa suporte a Proxy de rede privada corporativa (se configurado)
configureNetworkProxy();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const HOST = "0.0.0.0";

  // 1. Configure Trust Proxy (1 hop for reverse proxy / Cloud Run ingress)
  app.set("trust proxy", 1);

  // 2. Helmet Security Headers (adjusted for iframe preview compatibility)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );

  // 3. HTTP Compression
  app.use(compression());

  // 4. Configurable CORS
  const corsOrigins = process.env.CORS_ORIGIN || "*";
  app.use(
    cors({
      origin: corsOrigins === "*" ? true : corsOrigins.split(",").map((s) => s.trim()),
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  );

  // 5. Body Parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // 6. Request Logging Middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
    next();
  });

  // 7. API Routes Mount
  app.use("/api", apiRoutes);

  // 8. Vite Middleware or Static Production Assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    logger.info("[Server Mode] Development with Vite middleware active");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    logger.info(`[Server Mode] Production serving static assets from ${distPath}`);
  }

  // 9. Global Centralized Error Handler
  app.use(globalErrorHandler);

  // 10. Create HTTP Server & Initialize WebSocket Server
  const httpServer = http.createServer(app);
  initSocketServer(httpServer, corsOrigins);

  // 11. Start Background Services
  startDriveSyncScheduler();
  startBackupScheduler();

  // 12. Listen on Port
  httpServer.listen(PORT, HOST, () => {
    logger.info(`=======================================================`);
    logger.info(`🚀 Efetivo CM Server running on http://${HOST}:${PORT}`);
    logger.info(`  - Access locally: http://localhost:${PORT}`);
    logger.info(`  - Access via LAN IP: http://<SERVER_IP>:${PORT}`);
    logger.info(`=======================================================`);
  });
}

startServer().catch((err) => {
  logger.error("Fatal error starting Efetivo CM server:", err);
  process.exit(1);
});
