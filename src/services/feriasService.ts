import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

export interface FeriasMember {
  ORD: string;
  "POSTO /GRAD": string;
  QUADRO: string;
  NOME: string;
  RG: string;
  OBSERVAÇÃO: string;
  "INÍCIO FRUIÇÃO": string;
  "TÉRMINO FRUIÇÃO": string;
  "2019": string;
  "2020": string;
  "2021": string;
  "2023": string;
  "2024": string;
  "2025": string;
  "2026": string;
  DIVISÃO: string;
  [key: string]: any;
}

const feriasDataPath = path.join(process.cwd(), "src/data/ferias.json");
const SPREADSHEET_FERIAS_ID = process.env.GOOGLE_SHEET_FERIAS_ID || process.env.DRIVE_FERIAS_FILE_ID || "SEU_SPREADSHEET_ID_FERIAS";

// Google Sheets URLs prioritárias: GVIZ não sofre redirecionamento 307 para googleusercontent.com (evita bloqueio de firewall corporativo)
const FERIAS_URLS = [
  process.env.GOOGLE_SHEETS_FERIAS_URL,
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_FERIAS_ID}/gviz/tq?tqx=out:csv&sheet=GERAL`,
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_FERIAS_ID}/export?format=csv&sheet=GERAL`,
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_FERIAS_ID}/export?format=csv&gid=0`,
].filter(Boolean) as string[];

let cachedFerias: FeriasMember[] | null = null;
let lastSyncTime: Date | null = null;

/**
 * Salva membros de férias diretamente no cache de memória e no arquivo local
 */
export function saveFeriasMembers(members: FeriasMember[]): void {
  cachedFerias = members;
  lastSyncTime = new Date();
  try {
    fs.mkdirSync(path.dirname(feriasDataPath), { recursive: true });
    fs.writeFileSync(feriasDataPath, JSON.stringify({ FERIAS: members }, null, 2), "utf-8");
    logger.info(`[Ferias Service] Salvos ${members.length} registros de férias com sucesso.`);
  } catch (err: any) {
    logger.error(`[Ferias Service] Erro ao salvar ferias.json: ${err?.message || err}`);
  }
}

/**
 * Robust CSV parser handling multiline, quoted strings and escaping
 */
function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentField += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentLine.push(currentField.trim());
      if (currentLine.some((f) => f.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }
  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some((f) => f.length > 0)) {
      lines.push(currentLine);
    }
  }
  return lines;
}

/**
 * Get all ferias members either from cache, local file or remote sync
 */
export async function getFeriasMembers(forceRefresh = false): Promise<FeriasMember[]> {
  if (cachedFerias && !forceRefresh) {
    return cachedFerias;
  }

  if (forceRefresh) {
    try {
      await syncFeriasFromGoogleSheets();
      if (cachedFerias) return cachedFerias;
    } catch (err: any) {
      logger.info("[Ferias Service] Utilizando base local de férias.");
    }
  }

  // Fallback to local JSON file
  if (fs.existsSync(feriasDataPath)) {
    try {
      const content = fs.readFileSync(feriasDataPath, "utf-8");
      const parsed = JSON.parse(content);
      const rows: FeriasMember[] = Array.isArray(parsed)
        ? parsed
        : parsed["FERIAS"] || parsed["ferias"] || [];
      cachedFerias = rows;
      if (!lastSyncTime) {
        lastSyncTime = new Date();
      }
      return rows;
    } catch (err: any) {
      logger.error(`[Ferias Service] Error reading local ferias.json: ${err.message}`);
    }
  }

  return [];
}

/**
 * Synchronize Ferias directly from the Google Sheets spreadsheet
 */
export async function syncFeriasFromGoogleSheets(): Promise<{
  success: boolean;
  total: number;
  lastSyncedAt: Date;
}> {
  // If spreadsheet ID is a placeholder, retain local data
  if (!SPREADSHEET_FERIAS_ID || SPREADSHEET_FERIAS_ID.includes("SEU_") || SPREADSHEET_FERIAS_ID.includes("EXEMPLO")) {
    const existing = await getFeriasMembers();
    return {
      success: true,
      total: existing.length,
      lastSyncedAt: lastSyncTime || new Date(),
    };
  }

  logger.info("[Ferias Service] Consultando planilha de férias no Google Sheets...");
  let csvText = "";
  let isNetworkOffline = false;

  for (const url of FERIAS_URLS) {
    if (isNetworkOffline) break;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/csv, application/json, text/plain, */*",
        },
        redirect: "follow",
      });

      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 500 && (text.includes("POSTO") || text.includes("QOEM") || text.includes("FRUINDO"))) {
          csvText = text;
          logger.info(`[Ferias Service] Download de férias concluído via Google Sheets (${text.length} bytes)`);
          break;
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("ETIMEDOUT")) {
        isNetworkOffline = true;
        logger.info("[Ferias Service] Ambiente de rede privada/restrita detectado no servidor. O navegador completará a sincronização.");
        break;
      }
    }
  }

  if (!csvText) {
    throw new Error(
      isNetworkOffline
        ? "REDE_RESTRITA_NAVEGADOR"
        : "Nenhuma resposta CSV válida recebida das URLs da planilha de férias"
    );
  }

  const parsed = parseCSV(csvText);
  if (!parsed || parsed.length < 2) {
    throw new Error("Planilha de férias retornou conteúdo vazio ou inválido");
  }

  const headers = parsed[0];
  const rawMembers: FeriasMember[] = parsed.slice(1).map((row) => {
    const obj: any = {};
    headers.forEach((h, idx) => {
      let key = h.trim();
      if (!key) {
        if (idx === 0) key = "ORD";
        else if (idx === 4) key = "RG";
        else if (idx === 6) key = "INÍCIO FRUIÇÃO";
        else if (idx === 7) key = "TÉRMINO FRUIÇÃO";
        else key = `col_${idx}`;
      }
      const upperKey = key.toUpperCase();
      if (
        upperKey.includes("PLANO") ||
        upperKey.includes("TERÇO") ||
        upperKey.includes("TERCO")
      ) {
        return;
      }
      obj[key] = row[idx] ?? "";
    });
    return obj as FeriasMember;
  });

  // Consolidate/deduplicate rows by militar (RG or NOME)
  // A planilha do Google Sheets possui linhas de planejamento que duplicam servidores (396 linhas para 218 servidores).
  // Priorizamos a linha que contém informações ativas de fruição e saldo atualizado.
  const isFruindo = (o: any) =>
    !!(
      o["INÍCIO FRUIÇÃO"] ||
      o["TÉRMINO FRUIÇÃO"] ||
      (o["OBSERVAÇÃO"] && o["OBSERVAÇÃO"].toString().toUpperCase().includes("FRUINDO"))
    );

  const deduplicatedMap = new Map<string, FeriasMember>();
  for (const m of rawMembers) {
    const rg = (m.RG || "").toString().trim();
    const nome = (m.NOME || "").toString().trim();
    const key = rg || nome;
    if (!key) continue;

    if (!deduplicatedMap.has(key)) {
      deduplicatedMap.set(key, { ...m });
    } else {
      const existing = deduplicatedMap.get(key)!;
      if (isFruindo(m)) {
        deduplicatedMap.set(key, {
          ...existing,
          ...m,
          ORD: existing.ORD || m.ORD,
        });
      } else if (!isFruindo(existing)) {
        for (const k of Object.keys(m)) {
          if (m[k] && !existing[k]) {
            existing[k] = m[k];
          }
        }
      }
    }
  }

  const members: FeriasMember[] = Array.from(deduplicatedMap.values());
  members.sort((a, b) => {
    const ordA = parseInt(String(a.ORD || "9999"), 10);
    const ordB = parseInt(String(b.ORD || "9999"), 10);
    if (!isNaN(ordA) && !isNaN(ordB) && ordA !== ordB) return ordA - ordB;
    return (a.NOME || "").localeCompare(b.NOME || "");
  });

  // Save to JSON cache
  cachedFerias = members;
  lastSyncTime = new Date();

  fs.mkdirSync(path.dirname(feriasDataPath), { recursive: true });
  fs.writeFileSync(feriasDataPath, JSON.stringify({ FERIAS: members }, null, 2), "utf-8");

  logger.info(`[Ferias Service] Successfully synced ${members.length} ferias records!`);
  return {
    success: true,
    total: members.length,
    lastSyncedAt: lastSyncTime,
  };
}

export function getFeriasSyncState() {
  return {
    cached: !!cachedFerias,
    total: cachedFerias?.length || 0,
    lastSyncedAt: lastSyncTime ? lastSyncTime.toISOString() : null,
  };
}
