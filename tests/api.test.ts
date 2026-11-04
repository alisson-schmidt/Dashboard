import { describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import supertest from "supertest";

import apiRoutes from "../src/routes/apiRoutes.js";
import { globalErrorHandler } from "../src/middlewares/errorHandler.js";

const app = express();
app.use(express.json());
app.use("/api", apiRoutes);
app.use(globalErrorHandler);

const request = supertest(app);

describe("Efetivo CM Production API Integration Tests", () => {
  it("GET /api/health - should return status ok with all component health statuses", async () => {
    const res = await request.get("/api/health");
    assert.strictEqual(res.status, 200);

    assert.strictEqual(res.body.status, "ok");
    assert.ok(res.body.components);
    assert.strictEqual(res.body.components.api.status, "ok");
    assert.strictEqual(res.body.components.database.type, "SQLite (Prisma ORM)");
    assert.strictEqual(res.body.components.database.status, "ok");
    assert.ok(res.body.components.cache);
    assert.ok(res.body.components.authentication);
    assert.ok(res.body.components.driveSync);
    assert.strictEqual(res.body.components.driveSync.intervalMinutes, 10);
  });

  it("GET /api/drive/sync-status - should return sync state metadata", async () => {
    const res = await request.get("/api/drive/sync-status");
    assert.strictEqual(res.status, 200);

    assert.ok("status" in res.body);
    assert.ok("lastSyncedAt" in res.body);
    assert.ok("hasCachedData" in res.body);
    assert.strictEqual(res.body.intervalMinutes, 10);
  });

  it("GET /api/auth/google/url - should return valid Google OAuth authorization URL", async () => {
    const res = await request.get("/api/auth/google/url");
    assert.strictEqual(res.status, 200);

    assert.strictEqual(res.body.hasClientId, true);
    assert.ok(res.body.url.includes("accounts.google.com"));
    assert.ok(res.body.redirectUri);
  });

  it("GET /api/dados - should return efetivo dataset from cache or database", async () => {
    const res = await request.get("/api/dados");
    assert.strictEqual(res.status, 200);

    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.rows) || Array.isArray(res.body.data));
  });

  it("POST /api/database - should process dataset modification in local mode", async () => {
    const res = await request.post("/api/database").send({ "EFETIVO TOTAL CM": [] });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it("POST /api/chat - should accept messages array and process request", async () => {
    const res = await request
      .post("/api/chat")
      .send({ messages: [{ role: "user", content: "Qual o total de efetivo?" }] });
    // Should not return 400 Prompt é obrigatório
    assert.notStrictEqual(res.status, 400);
  });
});
