import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Ocorreu um erro interno no servidor.";

  logger.error(
    `[Global Error] ${req.method} ${req.url} - Status: ${statusCode} - Error: ${message}`,
    {
      stack: err.stack,
      body: req.body,
      query: req.query,
      user: (req as any).user,
    }
  );

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}
