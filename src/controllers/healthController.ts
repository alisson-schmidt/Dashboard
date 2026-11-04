import { Request, Response } from "express";
import { checkDatabaseHealth } from "../lib/prisma.js";
import { getDriveCacheState } from "../services/driveService.js";
import { getAllowedEmails } from "../middlewares/authMiddleware.js";

export async function getHealthStatus(req: Request, res: Response) {
  const dbHealth = await checkDatabaseHealth();
  const driveCache = getDriveCacheState();
  const allowedEmails = getAllowedEmails();

  const isHealthy = dbHealth.status === "ok";

  const responseData = {
    status: isHealthy ? "ok" : "degraded",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    components: {
      api: {
        status: "ok",
        version: "2.0.0",
      },
      database: {
        type: "SQLite (Prisma ORM)",
        status: dbHealth.status,
        ...(dbHealth.message ? { error: dbHealth.message } : {}),
      },
      cache: {
        status: driveCache.data ? "ok" : "empty",
        hasCachedData: !!driveCache.data,
        totalRows: driveCache.data?.totalRows || driveCache.data?.rows?.length || 0,
      },
      authentication: {
        status: "ok",
        provider: "Google OAuth 2.0 / Identity Services",
        authorizedEmailsCount: allowedEmails.length,
      },
      driveSync: {
        status: driveCache.status,
        lastSyncedAt: driveCache.lastSyncedAt ? driveCache.lastSyncedAt.toISOString() : null,
        fileModifiedTime: driveCache.fileModifiedTime || null,
        intervalMinutes: 10,
        error: driveCache.error || null,
      },
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsageMB: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    },
  };

  res.status(isHealthy ? 200 : 503).json(responseData);
}
