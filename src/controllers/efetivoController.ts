import { Request, Response, NextFunction } from "express";
import { GoogleGenAI } from "@google/genai";
import { getEfetivoMembers, saveEfetivoMembers } from "../services/efetivoService.js";
import { getDriveCacheState, syncGoogleDriveData } from "../services/driveService.js";
import { logger } from "../lib/logger.js";
import { broadcastEvent } from "../lib/socket.js";
import { saveChatMessageToBigQuery } from "../services/bigqueryService.js";

export async function getEfetivoData(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Força a invalidação total de cache no navegador e no Proxy
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    // Se o frontend solicitar refresh=true (botão de sincronizar), executa o sync pelo Proxy do Drive
    let syncResult: any = null;
    if (req.query.refresh === "true") {
      try {
        syncResult = await syncGoogleDriveData(true);
      } catch (syncErr: any) {
        logger.error(`[EfetivoController Sync Error] Falha ao sincronizar via Proxy: ${syncErr.message}`);
        syncResult = { success: false, error: syncErr.message };
      }
    }

    // 2. Busca SEMPRE a lista atualizada direto do banco SQLite (Fonte da verdade)
    const members = await getEfetivoMembers();
    const driveCache = getDriveCacheState();

    return res.json({
      success: true,
      syncResult,
      driveStatus: driveCache.status,
      driveError: driveCache.error,
      totalRows: members.length,
      rows: members,
      data: members,
      fromCache: false,
      lastSyncedAt: driveCache.lastSyncedAt ? driveCache.lastSyncedAt.toISOString() : new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getDatabaseJson(req: Request, res: Response, next: NextFunction) {
  try {
    // Aplica cabeçalhos de no-cache também na rota JSON bruta
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const members = await getEfetivoMembers();
    res.json({
      "EFETIVO TOTAL CM": members,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateDatabaseJson(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body;
    let members: any[] = [];

    if (Array.isArray(payload)) {
      members = payload;
    } else if (payload && Array.isArray(payload["EFETIVO TOTAL CM"])) {
      members = payload["EFETIVO TOTAL CM"];
    } else {
      return res.status(400).json({ success: false, error: "Formato de dados inválido." });
    }

    if (JSON.stringify(members).toUpperCase().includes("TORDORO")) {
      return res.status(400).json({ success: false, error: "Modo exemplo ativo. Dados originais rejeitados." });
    }

    const saveResult = await saveEfetivoMembers(members);
    if (saveResult.success) {
      broadcastEvent("data_updated", {
        totalRows: saveResult.total,
        updatedAt: new Date().toISOString(),
      });
      return res.json({
        success: true,
        message: "Base de dados atualizada com sucesso no SQLite e cache local.",
        totalRows: saveResult.total,
      });
    } else {
      return res.status(500).json({ success: false, error: "Erro ao salvar os dados no SQLite." });
    }
  } catch (err) {
    next(err);
  }
}

export async function handleGeminiChat(req: Request, res: Response, next: NextFunction) {
  try {
    let { prompt, history, messages } = req.body || {};

    // Support payload with array of messages from ChatAgent frontend
    if (!prompt && Array.isArray(messages) && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
      if (lastUserMsg && lastUserMsg.content) {
        prompt = lastUserMsg.content;
      } else {
        prompt = messages[messages.length - 1]?.content;
      }
      history = messages.slice(0, messages.length - 1);
    }

    if (!prompt) {
      return res.status(400).json({ error: "Prompt é obrigatório." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Chave de API do Gemini (GEMINI_API_KEY) não configurada no servidor.",
      });
    }

    const members = await getEfetivoMembers();

    // Build context summary
    const total = members.length;
    const porDivisao = new Map<string, number>();
    const porPosto = new Map<string, number>();

    members.forEach((m) => {
      const div = m["SIGLA DIVISÃO"] || m["DIVISÃO"] || "OUTROS";
      porDivisao.set(div, (porDivisao.get(div) || 0) + 1);

      const posto = m["POSTO/GRAD.  CARGO"] || "OUTROS";
      porPosto.set(posto, (porPosto.get(posto) || 0) + 1);
    });

    const divisaoSummary = Array.from(porDivisao.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const postoSummary = Array.from(porPosto.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const systemInstruction = `Você é o assistente inteligente especializado em análise de dados do Efetivo da Casa Militar do Paraná.
Sua missão é responder perguntas dos gestores sobre a distribuição, estatísticas, cargos, divisões e dados analíticos do efetivo.

Estatísticas e dados gerais atuais:
- Total do Efetivo: ${total} integrantes.
- Por Divisão/Setor: ${divisaoSummary}.
- Por Posto/Graduação/Cargo: ${postoSummary}.

Lista completa e atualizada dos integrantes (JSON):
${JSON.stringify(members).slice(0, 150000)}

Diretrizes:
1. Responda de forma clara, cortês, profissional e objetiva em Português do Brasil.
2. Utilize formatação Markdown (tabelas, negrito, tópicos) para organizar informações complexas.
3. Se perguntarem sobre nomes específicos, liste as informações encontradas na base.
4. Mantenha sigilo e precisão nas contagens.`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content || h.text || "" }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: prompt }] },
      ],
      config: {
        systemInstruction,
      },
    });

    const outputText = response.text || "Não foi possível gerar uma resposta no momento.";

    // Salva o histórico diretamente no BigQuery em segundo plano
    saveChatMessageToBigQuery({
      userEmail: (req as any).user?.email || "anonymous",
      userPrompt: prompt,
      assistantResponse: outputText,
      model: "gemini-3.6-flash",
    }).catch((bqErr) => logger.warn(`[BigQuery Async Error] ${bqErr}`));

    return res.json({
      success: true,
      content: outputText,
      text: outputText,
    });
  } catch (err: any) {
    logger.error(`[Gemini Chat Error] ${err?.message || err}`);
    return res.status(500).json({
      error: `Erro ao processar consulta Gemini: ${err?.message || "Erro de execução"}`,
    });
  }
}