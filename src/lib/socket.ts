import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger.js";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer, corsOrigins: string | string[]) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  logger.info("[Socket.IO] WebSocket server initialized");
  return io;
}

export function broadcastEvent(event: string, payload: any) {
  if (io) {
    io.emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
    logger.info(`[Socket.IO] Broadcasted event '${event}' to all clients`);
  }
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
