import { Router } from "express";
import { getHealthStatus } from "../controllers/healthController.js";
import { getGoogleOAuthUrl, handleGoogleAuth, verifyAuthSession } from "../controllers/authController.js";
import { getDriveSyncStatus, triggerManualDriveSync } from "../controllers/driveController.js";
import { getEfetivoData, getDatabaseJson, updateDatabaseJson, handleGeminiChat } from "../controllers/efetivoController.js";
import { getFeriasData, triggerFeriasSync, getFeriasSyncStatus, saveFeriasData } from "../controllers/feriasController.js";
import {
  getFeriasCivisData,
  triggerFeriasCivisSync,
  getFeriasCivisSyncStatus,
  saveFeriasCivisData,
  getFeriasCivisConfigHandler,
  updateFeriasCivisConfigHandler,
} from "../controllers/feriasCivisController.js";
import { authMiddleware, requireAuth } from "../middlewares/authMiddleware.js";
import { apiRateLimiter, strictRateLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

// Apply auth middleware to all API requests to parse tokens
router.use(authMiddleware);

// System Health Endpoint (Unrestricted for monitoring services like UptimeRobot/CloudRun)
router.get("/health", getHealthStatus);

// Authentication Routes
router.get("/auth/google/url", strictRateLimiter, getGoogleOAuthUrl);
router.post("/auth/google", strictRateLimiter, handleGoogleAuth);
router.get("/verify-auth", verifyAuthSession);

// Google Drive Sync Routes
router.get("/drive/sync-status", apiRateLimiter, getDriveSyncStatus);
router.post("/drive/sync", strictRateLimiter, triggerManualDriveSync);

// Efetivo Member Data Routes
router.get("/dados", apiRateLimiter, getEfetivoData);
router.get("/database", apiRateLimiter, getDatabaseJson);
router.post("/database", requireAuth, updateDatabaseJson);

// Ferias (Controle de Férias) Routes
router.get("/ferias", apiRateLimiter, getFeriasData);
router.post("/ferias/sync", strictRateLimiter, triggerFeriasSync);
router.post("/ferias/sync-data", apiRateLimiter, saveFeriasData);
router.get("/ferias/sync-status", apiRateLimiter, getFeriasSyncStatus);

// Ferias Servidores Civis Routes
router.get("/ferias-civis", apiRateLimiter, getFeriasCivisData);
router.post("/ferias-civis/sync", strictRateLimiter, triggerFeriasCivisSync);
router.post("/ferias-civis/sync-data", apiRateLimiter, saveFeriasCivisData);
router.get("/ferias-civis/sync-status", apiRateLimiter, getFeriasCivisSyncStatus);
router.get("/ferias-civis/config", apiRateLimiter, getFeriasCivisConfigHandler);
router.post("/ferias-civis/config", requireAuth, updateFeriasCivisConfigHandler);

// Gemini AI Chatbot Route
router.post("/chat", apiRateLimiter, handleGeminiChat);

export default router;
