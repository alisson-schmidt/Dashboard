import { Request, Response, NextFunction } from "express";
import { getDriveCacheState, syncGoogleDriveData } from "../services/driveService.js";

export function getDriveSyncStatus(req: Request, res: Response) {
  const cache = getDriveCacheState();
  res.json({
    status: cache.status,
    lastSyncedAt: cache.lastSyncedAt ? cache.lastSyncedAt.toISOString() : null,
    hasCachedData: !!cache.data,
    fileModifiedTime: cache.fileModifiedTime || null,
    error: cache.error,
    intervalMinutes: 10,
  });
}

export async function triggerManualDriveSync(req: Request, res: Response, next: NextFunction) {
  try {
    const force = req.query.force === "true";
    const result = await syncGoogleDriveData(force);

    if (result.success) {
      return res.json({
        success: true,
        skipped: result.skipped || false,
        message: result.message || "Sincronização com o Google Drive concluída com sucesso!",
        lastSyncedAt: getDriveCacheState().lastSyncedAt,
        data: result.data,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || "Falha na sincronização com o Google Drive.",
      });
    }
  } catch (err) {
    next(err);
  }
}
