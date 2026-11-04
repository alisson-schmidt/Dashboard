import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export function initBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`[Backup] Created backup directory at ${BACKUP_DIR}`);
  }
}

export async function createDatabaseBackup(): Promise<{ success: boolean; filepath?: string; error?: string }> {
  try {
    initBackupDirectory();
    const rawDbUrl = process.env.DATABASE_URL || "file:prisma/data.db";
    const cleanDbPath = rawDbUrl.startsWith("file:") ? rawDbUrl.slice(5) : rawDbUrl;
    const dbPath = path.resolve(process.cwd(), cleanDbPath);

    if (!fs.existsSync(dbPath)) {
      logger.warn(`[Backup Skip] Database file does not exist at ${dbPath}`);
      return { success: false, error: "Database file not found" };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `efetivo_backup_${timestamp}.db`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    // Copy SQLite database file safely
    fs.copyFileSync(dbPath, backupFilePath);
    const stats = fs.statSync(backupFilePath);

    logger.info(`[Backup Success] Created database backup: ${backupFileName} (${(stats.size / 1024).toFixed(2)} KB)`);

    // Record in Prisma Database
    try {
      await prisma.backupLog.create({
        data: {
          filename: backupFileName,
          filepath: backupFilePath,
          sizeBytes: BigInt(stats.size),
          status: "success",
        },
      });
    } catch (dbErr) {
      logger.warn("[Backup Log Error] Failed to write backup log to database", dbErr);
    }

    // Clean up backups older than 30 days
    cleanupOldBackups(30);

    return { success: true, filepath: backupFilePath };
  } catch (err: any) {
    logger.error("[Backup Error] Failed to create database backup", err);
    return { success: false, error: err.message || String(err) };
  }
}

function cleanupOldBackups(maxAgeDays: number = 30) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.endsWith(".db")) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          logger.info(`[Backup Cleanup] Removed old backup file: ${file}`);
        }
      }
    }
  } catch (err) {
    logger.error("[Backup Cleanup Error]", err);
  }
}

// Start daily backup scheduler
export function startBackupScheduler() {
  initBackupDirectory();
  // Run initial backup on startup if non-existent or > 24 hours
  createDatabaseBackup();

  // Run every 24 hours (24 * 60 * 60 * 1000 ms)
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    createDatabaseBackup();
  }, TWENTY_FOUR_HOURS_MS);

  logger.info("[Backup Scheduler] Initialized daily database backup job");
}
