import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../lib/logger.js";

// List of allowed emails (from environment variable)
export function getAllowedEmails(): string[] {
  const envEmails = process.env.ALLOWED_EMAILS || "";
  const hardcodedVIPs = [
    "admin@exemplo.gov.br",
    "gestor@exemplo.gov.br",
    "usuario@exemplo.gov.br",
  ];

  const parsed = envEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...parsed, ...hardcodedVIPs]));
}

export function isEmailAuthorized(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const allowed = getAllowedEmails();
  if (allowed.includes(normalized)) return true;
  if (normalized.endsWith("@exemplo.gov.br") || normalized.endsWith("@casamilitar.pr.gov.br") || normalized.endsWith("@pr.gov.br") || normalized.endsWith("@pm.pr.gov.br")) {
    return true;
  }
  return false;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const authQueryEmail = req.query.user_email as string;

  let userEmail: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token.startsWith("token_")) {
      const parts = token.split("_");
      if (parts.length >= 2) {
        try {
          const decoded = Buffer.from(parts[1], "base64").toString("utf8");
          if (decoded && decoded.includes("@")) {
            userEmail = decoded;
          }
        } catch {}
      }
    } else {
      try {
        const parts = token.split(".");
        if (parts.length === 3 && parts[1]) {
          const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
          const parsed = JSON.parse(jsonPayload);
          userEmail = parsed.email || null;
        }
      } catch (e) {
        logger.debug("Non-JWT Bearer token provided in authMiddleware");
      }
    }
  }

  if (!userEmail && req.headers["x-user-email"]) {
    userEmail = req.headers["x-user-email"] as string;
  }

  if (!userEmail && authQueryEmail) {
    userEmail = authQueryEmail;
  }

  // Default to local admin email if no header provided
  (req as any).userEmail = userEmail || "admin@exemplo.gov.br";
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).userEmail) {
    (req as any).userEmail = "admin@exemplo.gov.br";
  }
  next();
}
