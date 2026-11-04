import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { logger } from "./logger.js";

const rawDbPath = process.env.DATABASE_URL || "file:prisma/data.db";
let cleanPath = rawDbPath;
if (cleanPath.startsWith("file:")) {
  cleanPath = cleanPath.slice(5);
}

const resolvedPath = path.resolve(process.cwd(), cleanPath);
const parentDir = path.dirname(resolvedPath);

if (!fs.existsSync(parentDir)) {
  try {
    fs.mkdirSync(parentDir, { recursive: true });
    logger.info(`[Prisma DB] Created database directory: ${parentDir}`);
  } catch (err) {
    logger.error(`[Prisma DB] Failed to create database directory ${parentDir}`, err);
  }
}

const adapter = new PrismaLibSql({
  url: `file:${resolvedPath}`,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.DEBUG_PRISMA ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function checkDatabaseHealth(): Promise<{ status: "ok" | "error"; message?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (err: any) {
    logger.error("Database connection check failed: %s", err.message || err);
    return { status: "error", message: err.message || String(err) };
  }
}
