import { Request, Response, NextFunction } from "express";
import {
  getFeriasMembers,
  syncFeriasFromGoogleSheets,
  getFeriasSyncState,
  saveFeriasMembers,
  FeriasMember,
} from "../services/feriasService.js";
import { logger } from "../lib/logger.js";

/**
 * GET /api/ferias
 * Returns all Ferias records, with optional force refresh parameter (?refresh=true)
 */
export async function getFeriasData(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const forceRefresh = req.query.refresh === "true";
    let syncError: string | null = null;
    let syncSuccess = false;

    if (forceRefresh) {
      try {
        await syncFeriasFromGoogleSheets();
        syncSuccess = true;
      } catch (err: any) {
        syncError = err?.message || String(err);
        logger.info("[FeriasController] Sincronização de férias gerenciada via navegador corporativo.");
      }
    }

    const members = await getFeriasMembers(false);
    const syncState = getFeriasSyncState();

    return res.json({
      success: true,
      syncSuccess,
      syncError,
      totalRows: members.length,
      rows: members,
      data: members,
      lastSyncedAt: syncState.lastSyncedAt || new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error(`[FeriasController] Error in getFeriasData: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/ferias/sync-data
 * Recebe membros parseados pelo navegador (fallback para redes corporativas) e salva no servidor
 */
export async function saveFeriasData(req: Request, res: Response) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "Lista de membros de férias inválida ou vazia" });
    }

    if (JSON.stringify(rows).toUpperCase().includes("TORDORO")) {
      return res.status(400).json({ success: false, message: "Modo exemplo ativo. Dados originais rejeitados." });
    }

    saveFeriasMembers(rows as FeriasMember[]);
    return res.json({
      success: true,
      message: `Salvos ${rows.length} registros de férias com sucesso no servidor!`,
      totalRows: rows.length,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error(`[FeriasController] Erro ao salvar dados de férias recebidos: ${err?.message || err}`);
    return res.status(500).json({ success: false, message: err?.message || "Erro interno" });
  }
}

/**
 * POST /api/ferias/sync
 * Forces an immediate live sync from Google Sheets
 */
export async function triggerFeriasSync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncFeriasFromGoogleSheets();
    return res.json({
      success: true,
      message: "Sincronização de férias concluída com sucesso!",
      totalRows: result.total,
      lastSyncedAt: result.lastSyncedAt.toISOString(),
    });
  } catch (err: any) {
    logger.error(`[FeriasController] Error triggering ferias sync: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: `Falha ao sincronizar planilha de férias: ${err.message}`,
    });
  }
}

/**
 * GET /api/ferias/sync-status
 */
export async function getFeriasSyncStatus(req: Request, res: Response) {
  const syncState = getFeriasSyncState();
  return res.json({
    status: "ok",
    ...syncState,
  });
}
