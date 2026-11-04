import winston from "winston";

const isProduction = process.env.NODE_ENV === "production";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    isProduction
      ? winston.format.json()
      : winston.format.printf(({ level, message, timestamp, stack }) => {
          return `[${timestamp}] [${level.toUpperCase()}]: ${message}${stack ? `\n${stack}` : ""}`;
        })
  ),
  defaultMeta: { service: "efetivo-cm-backend" },
  transports: [
    new winston.transports.Console(),
  ],
});
