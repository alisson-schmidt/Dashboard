import rateLimit from "express-rate-limit";

// General API Rate Limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    status: 429,
    error: "Muitas requisições enviadas. Por favor, tente novamente mais tarde.",
  },
});

// Strict Rate Limiter for Authentication and Manual Sync Trigger
export const strictRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    status: 429,
    error: "Limite de tentativas excedido. Aguarde alguns minutos.",
  },
});
