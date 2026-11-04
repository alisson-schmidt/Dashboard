import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

export interface FeriasCivisMember {
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

export interface FeriasCivisConfig {
  spreadsheetUrl: string;
  spreadsheetId: string;
  sheetName: string;
}

const feriasCivisDataPath = path.join(process.cwd(), "src/data/ferias_civis.json");
const configFilePath = path.join(process.cwd(), "src/data/ferias_civis_config.json");

// Default Google Sheets config for civil servants
const DEFAULT_CONFIG: FeriasCivisConfig = {
  spreadsheetUrl: process.env.GOOGLE_SHEETS_FERIAS_CIVIS_URL || "https://docs.google.com/spreadsheets/d/SEU_SPREADSHEET_ID_FERIAS_CIVIS/edit?usp=sharing",
  spreadsheetId: process.env.GOOGLE_SHEET_FERIAS_CIVIS_ID || process.env.DRIVE_FERIAS_CIVIS_FILE_ID || "SEU_SPREADSHEET_ID_FERIAS_CIVIS",
  sheetName: "ATIVOS",
};

let cachedMembers: FeriasCivisMember[] | null = null;
let lastSyncTime: Date | null = null;

export function getFeriasCivisConfig(): FeriasCivisConfig {
  try {
    if (fs.existsSync(configFilePath)) {
      const raw = fs.readFileSync(configFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    logger.warn("[Ferias Civis Service] Could not read config file, using defaults", err);
  }
  return DEFAULT_CONFIG;
}

export function saveFeriasCivisConfig(config: Partial<FeriasCivisConfig>): FeriasCivisConfig {
  const current = getFeriasCivisConfig();
  const updated: FeriasCivisConfig = {
    ...current,
    ...config,
  };

  // If a full URL is provided, extract spreadsheet ID
  if (config.spreadsheetUrl) {
    const match = config.spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      updated.spreadsheetId = match[1];
    }
  }

  try {
    fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
    fs.writeFileSync(configFilePath, JSON.stringify(updated, null, 2), "utf-8");
    logger.info(`[Ferias Civis Service] Config saved: ID ${updated.spreadsheetId}, Sheet ${updated.sheetName}`);
  } catch (err: any) {
    logger.error(`[Ferias Civis Service] Error saving config: ${err?.message || err}`);
  }
  return updated;
}

export function saveFeriasCivisMembers(members: FeriasCivisMember[]): void {
  cachedMembers = members;
  lastSyncTime = new Date();
  try {
    fs.mkdirSync(path.dirname(feriasCivisDataPath), { recursive: true });
    fs.writeFileSync(feriasCivisDataPath, JSON.stringify({ FERIAS_CIVIS: members }, null, 2), "utf-8");
    logger.info(`[Ferias Civis Service] Salvos ${members.length} registros de férias de servidores civis.`);
  } catch (err: any) {
    logger.error(`[Ferias Civis Service] Erro ao salvar ferias_civis.json: ${err?.message || err}`);
  }
}

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

export async function getFeriasCivisMembers(forceRefresh = false): Promise<FeriasCivisMember[]> {
  if (cachedMembers && !forceRefresh) {
    return cachedMembers;
  }

  if (forceRefresh) {
    try {
      await syncFeriasCivisFromGoogleSheets();
      if (cachedMembers) return cachedMembers;
    } catch (err: any) {
      logger.info("[Ferias Civis Service] Utilizando base local de férias de servidores civis.");
    }
  }

  if (fs.existsSync(feriasCivisDataPath)) {
    try {
      const content = fs.readFileSync(feriasCivisDataPath, "utf-8");
      const parsed = JSON.parse(content);
      const rows: FeriasCivisMember[] = Array.isArray(parsed)
        ? parsed
        : parsed["FERIAS_CIVIS"] || parsed["ferias_civis"] || parsed["FERIAS"] || [];
      cachedMembers = rows;
      if (!lastSyncTime) {
        lastSyncTime = new Date();
      }
      return rows;
    } catch (err: any) {
      logger.error(`[Ferias Civis Service] Error reading local ferias_civis.json: ${err.message}`);
    }
  }

  return [];
}

export async function syncFeriasCivisFromGoogleSheets(): Promise<{
  success: boolean;
  total: number;
  lastSyncedAt: Date;
}> {
  const config = getFeriasCivisConfig();
  const spreadsheetId = config.spreadsheetId;
  const sheetName = config.sheetName || "ATIVOS";

  // If spreadsheet ID is a placeholder, retain local data
  if (!spreadsheetId || spreadsheetId.includes("SEU_") || spreadsheetId.includes("EXEMPLO")) {
    const existing = getFeriasCivisMembers();
    return {
      success: true,
      total: existing.length,
      lastSyncedAt: lastSyncTime || new Date(),
    };
  }

  const altId = spreadsheetId.startsWith("10l")
    ? spreadsheetId.replace("10l", "10I")
    : spreadsheetId.startsWith("10I")
    ? spreadsheetId.replace("10I", "10l")
    : spreadsheetId;

  const urls = [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
    `https://docs.google.com/spreadsheets/d/${altId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`,
    `https://docs.google.com/spreadsheets/d/${altId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`,
  ].filter(Boolean) as string[];

  logger.info(`[Ferias Civis Service] Consultando planilha no Google Sheets (ID: ${spreadsheetId}, Aba: ${sheetName})...`);
  let csvText = "";
  let isNetworkOffline = false;

  for (const url of urls) {
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
        if (text && text.length > 200 && !text.includes("<html") && !text.includes("<!DOCTYPE")) {
          csvText = text;
          logger.info(`[Ferias Civis Service] Download concluído via Google Sheets (${text.length} bytes)`);
          break;
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("ETIMEDOUT")) {
        isNetworkOffline = true;
        logger.info("[Ferias Civis Service] Ambiente corporativo/rede restrita detectado. Navegador efetuará sync direto.");
        break;
      }
    }
  }

  if (!csvText) {
    throw new Error(
      isNetworkOffline
        ? "REDE_RESTRITA_NAVEGADOR"
        : "Nenhuma resposta CSV válida recebida da planilha Google de servidores civis"
    );
  }

  const parsed = parseCSV(csvText);
  if (!parsed || parsed.length < 2) {
    throw new Error("Planilha de servidores civis retornou conteúdo vazio ou inválido");
  }

  const headers = parsed[0];
  const rawMembers: FeriasCivisMember[] = parsed.slice(1).map((row) => {
    const obj: any = {};
    headers.forEach((h, idx) => {
      let key = h.trim();
      obj[key] = row[idx] ?? "";
    });

    const ord = obj["Nº"] || obj["ORD"] || obj["N°"] || "";
    const nome = (obj["NOME"] || "").trim();
    const cargo = (obj["CARGO"] || obj["POSTO /GRAD"] || "").trim();
    const tipo = (obj["TIPO"] || obj["QUADRO"] || "").trim();
    const rg = (obj["RG"] || "").trim();
    const divisao = (obj["DIVISÃO"] || obj["DIVISAO"] || "").trim();
    const obs = (obj["OBS"] || obj["OBSERVAÇÃO"] || obj["OBSERVACAO"] || "").trim();
    const inicioFruicao = (
      obj["FRUIÇÃO DE FÉRIAS -  INICIO"] ||
      obj["FRUIÇÃO DE FÉRIAS - INICIO"] ||
      obj["INÍCIO FRUIÇÃO"] ||
      obj["INICIO FRUICAO"] ||
      ""
    ).trim();
    const terminoFruicao = (
      obj["FRUIÇÃO DE FÉRIAS  - TERMINO"] ||
      obj["FRUIÇÃO DE FÉRIAS - TERMINO"] ||
      obj["TÉRMINO FRUIÇÃO"] ||
      obj["TERMINO FRUICAO"] ||
      ""
    ).trim();

    return {
      ...obj,
      ORD: ord,
      NOME: nome,
      "POSTO /GRAD": cargo,
      CARGO: cargo,
      QUADRO: tipo,
      TIPO: tipo,
      RG: rg,
      DIVISÃO: divisao,
      OBSERVAÇÃO: obs,
      OBS: obs,
      "INÍCIO FRUIÇÃO": inicioFruicao,
      "TÉRMINO FRUIÇÃO": terminoFruicao,
      "2023": obj["2023"] || "0",
      "2024": obj["2024"] || "0",
      "2025": obj["2025"] || "0",
      "2026": obj["2026"] || "0",
    } as FeriasCivisMember;
  });

  const isFruindo = (o: any) =>
    !!(
      o["INÍCIO FRUIÇÃO"] ||
      o["TÉRMINO FRUIÇÃO"] ||
      (o["OBSERVAÇÃO"] && o["OBSERVAÇÃO"].toString().toUpperCase().includes("FRUINDO"))
    );

  const deduplicatedMap = new Map<string, FeriasCivisMember>();
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

  const members: FeriasCivisMember[] = Array.from(deduplicatedMap.values());
  members.sort((a, b) => {
    const ordA = parseInt(String(a.ORD || "9999"), 10);
    const ordB = parseInt(String(b.ORD || "9999"), 10);
    if (!isNaN(ordA) && !isNaN(ordB) && ordA !== ordB) return ordA - ordB;
    return (a.NOME || "").localeCompare(b.NOME || "");
  });

  cachedMembers = members;
  lastSyncTime = new Date();

  fs.mkdirSync(path.dirname(feriasCivisDataPath), { recursive: true });
  fs.writeFileSync(feriasCivisDataPath, JSON.stringify({ FERIAS_CIVIS: members }, null, 2), "utf-8");

  logger.info(`[Ferias Civis Service] Successfully synced ${members.length} civil vacation records!`);
  return {
    success: true,
    total: members.length,
    lastSyncedAt: lastSyncTime,
  };
}

export function getFeriasCivisSyncState() {
  return {
    cached: !!cachedMembers,
    total: cachedMembers?.length || 0,
    lastSyncedAt: lastSyncTime ? lastSyncTime.toISOString() : null,
    config: getFeriasCivisConfig(),
  };
}
