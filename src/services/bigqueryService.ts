import { BigQuery } from "@google-cloud/bigquery";
import { logger } from "../lib/logger.js";

export interface ChatBigQueryRecord {
  sessionId?: string;
  userEmail?: string;
  userPrompt: string;
  assistantResponse: string;
  model?: string;
  timestamp?: string;
}

let bigqueryClient: BigQuery | null = null;

export function getBigQueryClient(): BigQuery | null {
  if (bigqueryClient) return bigqueryClient;

  const projectId =
    process.env.BIGQUERY_PROJECT_ID ||
    process.env.GOOGLE_PROJECT_ID ||
    "batalhao-insight-drive";
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  try {
    if (clientEmail && privateKey) {
      bigqueryClient = new BigQuery({
        projectId,
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
      });
    } else {
      bigqueryClient = new BigQuery({ projectId });
    }
    return bigqueryClient;
  } catch (err: any) {
    logger.warn(`[BigQuery Init Warning] Não foi possível inicializar cliente BigQuery: ${err?.message || err}`);
    return null;
  }
}

/**
 * Garante que o Dataset e a Tabela historico_chat existam no BigQuery antes de inserir.
 */
async function ensureDatasetAndTableExists(bq: BigQuery, datasetId: string, tableId: string) {
  try {
    const dataset = bq.dataset(datasetId);
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      await bq.createDataset(datasetId, { location: "US" });
      logger.info(`[BigQuery Setup] Dataset '${datasetId}' criado com sucesso.`);
    }

    const table = dataset.table(tableId);
    const [tableExists] = await table.exists();
    if (!tableExists) {
      const schema = [
        { name: "session_id", type: "STRING", mode: "NULLABLE" },
        { name: "user_email", type: "STRING", mode: "NULLABLE" },
        { name: "user_prompt", type: "STRING", mode: "REQUIRED" },
        { name: "assistant_response", type: "STRING", mode: "REQUIRED" },
        { name: "model", type: "STRING", mode: "NULLABLE" },
        { name: "created_at", type: "TIMESTAMP", mode: "NULLABLE" },
      ];
      await dataset.createTable(tableId, { schema });
      logger.info(`[BigQuery Setup] Tabela '${tableId}' criada com sucesso no dataset '${datasetId}'.`);
    }
  } catch (err: any) {
    logger.warn(`[BigQuery Setup Warning] Falha ao verificar/criar dataset e tabela: ${err?.message || err}`);
  }
}

/**
 * Persiste a mensagem/resposta do chat na tabela `historico_chat` do BigQuery.
 */
export async function saveChatMessageToBigQuery(record: ChatBigQueryRecord): Promise<boolean> {
  try {
    const bq = getBigQueryClient();
    if (!bq) return false;

    const datasetId = process.env.BIGQUERY_DATASET_ID || "efetivo_analytics";
    const tableId = process.env.BIGQUERY_TABLE_ID || "historico_chat";

    const dataset = bq.dataset(datasetId);
    const table = dataset.table(tableId);

    const row = {
      session_id: record.sessionId || `session_${Date.now()}`,
      user_email: record.userEmail || "anonymous",
      user_prompt: record.userPrompt,
      assistant_response: record.assistantResponse,
      model: record.model || "gemini-3.6-flash",
      created_at: record.timestamp || new Date().toISOString(),
    };

    try {
      await table.insert([row], { ignoreUnknownValues: true });
    } catch (insertErr: any) {
      if (insertErr?.code === 404 || insertErr?.message?.includes("Not found")) {
        await ensureDatasetAndTableExists(bq, datasetId, tableId);
        await table.insert([row], { ignoreUnknownValues: true });
      } else {
        throw insertErr;
      }
    }

    logger.info(`[BigQuery Log] Histórico de conversa gravado com sucesso na tabela ${datasetId}.${tableId}`);
    return true;
  } catch (err: any) {
    logger.warn(`[BigQuery Log Warning] Erro ao salvar histórico no BigQuery: ${err?.message || err}`);
    return false;
  }
}

// Alias para compatibilidade com chamadas existentes
export const saveChatToBigQuery = saveChatMessageToBigQuery;

