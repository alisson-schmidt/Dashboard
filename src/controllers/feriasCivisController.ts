import { Request, Response, NextFunction } from "express";
import {
  getFeriasCivisMembers,
  syncFeriasCivisFromGoogleSheets,
  getFeriasCivisSyncState,
  saveFeriasCivisMembers,
  saveFeriasCivisConfig,
  getFeriasCivisConfig,
  FeriasCivisMember,
} from "../services/feriasCivisService.js";
import { logger } from "../lib/logger.js";

/**
 * GET /api/ferias-civis
 * Returns all Ferias Servidores Civis records, with optional force refresh parameter (?refresh=true)
 */
export async function getFeriasCivisData(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const forceRefresh = req.query.refresh === "true";
    let syncError: string | null = null;
    let syncSuccess = false;

    if (forceRefresh) {
      try {
        await syncFeriasCivisFromGoogleSheets();
        syncSuccess = true;
      } catch (err: any) {
        syncError = err?.message || String(err);
        logger.info("[FeriasCivisController] Sincronização gerenciada via navegador corporativo.");
      }
    }

    const members = await getFeriasCivisMembers(false);
    const syncState = getFeriasCivisSyncState();

    return res.json({
      success: true,
      syncSuccess,
      syncError,
      totalRows: members.length,
      rows: members,
      data: members,
      lastSyncedAt: syncState.lastSyncedAt || new Date().toISOString(),
      config: syncState.config,
    });
  } catch (err: any) {
    logger.error(`[FeriasCivisController] Error in getFeriasCivisData: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/ferias-civis/sync-data
 * Recebe membros parseados pelo navegador e salva no servidor
 */
export async function saveFeriasCivisData(req: Request, res: Response) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: "Lista de servidores civis inválida ou vazia" });
    }

    if (JSON.stringify(rows).toUpperCase().includes("ADELSON")) {
      return res.status(400).json({ success: false, message: "Modo exemplo ativo. Dados originais rejeitados." });
    }

    saveFeriasCivisMembers(rows as FeriasCivisMember[]);
    return res.json({
      success: true,
      message: `Salvos ${rows.length} registros de férias de servidores civis com sucesso no servidor!`,
      totalRows: rows.length,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error(`[FeriasCivisController] Erro ao salvar dados de servidores civis: ${err?.message || err}`);
    return res.status(500).json({ success: false, message: err?.message || "Erro interno" });
  }
}

/**
 * POST /api/ferias-civis/sync
 * Forces an immediate live sync from Google Sheets
 */
export async function triggerFeriasCivisSync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncFeriasCivisFromGoogleSheets();
    return res.json({
      success: true,
      message: "Sincronização de férias de servidores civis concluída com sucesso!",
      totalRows: result.total,
      lastSyncedAt: result.lastSyncedAt.toISOString(),
    });
  } catch (err: any) {
    logger.error(`[FeriasCivisController] Error triggering sync: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: `Falha ao sincronizar planilha de servidores civis: ${err.message}`,
    });
  }
}

/**
 * GET /api/ferias-civis/sync-status
 */
export async function getFeriasCivisSyncStatus(req: Request, res: Response) {
  const syncState = getFeriasCivisSyncState();
  return res.json({
    status: "ok",
    ...syncState,
  });
}

/**
 * GET /api/ferias-civis/config
 */
export async function getFeriasCivisConfigHandler(req: Request, res: Response) {
  const config = getFeriasCivisConfig();
  return res.json({
    success: true,
    config,
  });
}

/**
 * POST /api/ferias-civis/config
 * Salva a URL da nova planilha no Drive/Sheets
 */
export async function updateFeriasCivisConfigHandler(req: Request, res: Response) {
  try {
    const { spreadsheetUrl, spreadsheetId, sheetName } = req.body;
    const updated = saveFeriasCivisConfig({
      spreadsheetUrl,
      spreadsheetId,
      sheetName,
    });
    return res.json({
      success: true,
      message: "Configurações da planilha de servidores civis salvas com sucesso!",
      config: updated,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Erro ao salvar configurações",
    });
  }
}
