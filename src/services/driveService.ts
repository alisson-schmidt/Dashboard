import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { broadcastEvent } from "../lib/socket.js";

const dataPath = path.join(process.cwd(), "src/data/efetivo.json");

export interface DriveCacheState {
  data: any;
  lastSyncedAt: Date | null;
  status: "idle" | "syncing" | "success" | "error" | "skipped";
  error: string | null;
  fileModifiedTime?: string | null;
}

let driveCache: DriveCacheState = {
  data: null,
  lastSyncedAt: null,
  status: "idle",
  error: null,
  fileModifiedTime: null,
};

export function updateDriveCacheData(newMembers: any[]) {
  driveCache = {
    data: {
      success: true,
      totalRows: newMembers.length,
      rows: newMembers,
      data: newMembers,
      cachedAt: new Date().toISOString(),
    },
    lastSyncedAt: new Date(),
    status: "success",
    error: null,
    fileModifiedTime: driveCache.fileModifiedTime,
  };
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

function parseMatrixToObjects(rows: any[][]): any[] {
  if (!rows || rows.length < 2) return [];

  let headerIndex = 0;
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const rowStr = (rows[r] || []).join(" ").toUpperCase();
    if (
      rowStr.includes("NOME") ||
      rowStr.includes("POSTO") ||
      rowStr.includes("CARGO") ||
      rowStr.includes("RG") ||
      rowStr.includes("CPF")
    ) {
      headerIndex = r;
      break;
    }
  }

  const headers = (rows[headerIndex] || []).map((h) => String(h || "").trim());
  const objects: any[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c || !String(c).trim())) continue;

    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = row[idx] !== undefined && row[idx] !== null && row[idx] !== "" ? String(row[idx]).trim() : "";
    });

    const nameVal = String(
      obj["NOME"] || obj["Nome"] || obj["nome"] || obj["NOME COMPLETO"] || obj["Colaborador"] || ""
    ).trim();

    if (!nameVal) continue;

    const upperName = nameVal.toUpperCase();
    if (
      upperName.startsWith("TOTAL") ||
      upperName.startsWith("SUBTOTAL") ||
      upperName.startsWith("LEGENDA") ||
      upperName.startsWith("FONTE") ||
      upperName.startsWith("OBSERV") ||
      upperName.startsWith("QUADRO") ||
      upperName === "NOME" ||
      upperName === "N/A"
    ) {
      continue;
    }

    if (!/[a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/.test(nameVal)) continue;

    obj["NOME"] = nameVal;

    const postoVal = obj["POSTO/GRAD.  CARGO"] || obj["POSTO/GRAD. CARGO"] || obj["POSTO/GRAD."] || obj["POSTO"] || obj["CARGO"] || "";
    if (postoVal) {
      obj["POSTO/GRAD.  CARGO"] = postoVal;
      obj["POSTO/GRAD. CARGO"] = postoVal;
    }

    const formattedNum = String(objects.length + 1).padStart(2, "0");
    if (!obj["Nº"]) obj["Nº"] = formattedNum;

    objects.push(obj);
  }

  return objects;
}

export function getDriveCacheState(): DriveCacheState {
  return driveCache;
}

async function persistSyncedMembers(memberRows: any[]) {
  if (!memberRows || memberRows.length === 0) return;
  try {
    fs.writeFileSync(
      dataPath,
      JSON.stringify({ "EFETIVO TOTAL CM": memberRows }, null, 2),
      "utf-8"
    );
  } catch (fsErr) {
    logger.error("[Drive Sync] Error writing cache to efetivo.json", fsErr);
  }

  try {
    await prisma.efetivoMember.deleteMany({});
    const createData = memberRows.map((m: any) => ({
      numero: String(m["Nº"] || m["NUMERO"] || ""),
      tipo: String(m["TIPO"] || ""),
      postoCargo: String(m["POSTO/GRAD.  CARGO"] || m["CARGO"] || ""),
      qpm: String(m["QPM"] || ""),
      nome: String(m["NOME"] || "Sem Nome"),
      rg: String(m["RG"] || ""),
      idMeta4: String(m["ID-META4"] || ""),
      cpf: String(m["CPF"] || ""),
      nomeGuerra: String(m["NOME DE GUERRA"] || ""),
      dataInclusao: String(m["DATA DE INCLUSÃO"] || ""),
      divisao: String(m["DIVISÃO"] || ""),
      siglaDivisao: String(m["SIGLA DIVISÃO"] || ""),
      afastamentos: String(m["AFASTAMENTOS (colocar atestados e licenças)"] || ""),
      abonoPermanencia: String(m["ABONO PERMANÊNCIA INÍCIO"] || ""),
      dataNascimento: String(m["DATA DE NASCIMENTO"] || ""),
      alertaAniversario: String(m["ALERTA ANIVERSÁRIO"] || ""),
      idade: String(m["IDADE NO DIA"] || ""),
      genero: String(m["GÊNERO"] || ""),
      fppFce: String(m["FPP/FCE"] || ""),
      valor: typeof m["VALOR"] === "number" ? m["VALOR"] : parseFloat(String(m["VALOR"] || "0").replace(",", ".")) || 0,
      tipoFppFg: String(m["TIPO FPP/FG"] || ""),
      compulsoriaIdade: String(m["COMPULSÓRIA POR IDADE"] || ""),
      compulsoriaTempo: String(m["COMPULSÓRIA POR TEMPO DE SERVIÇO"] || ""),
      encaminharOficio: String(m["ENCAMINHAR OFÍCIO PARA DP-5 INFORMANDO COMPULSÓRIA (45 DIAS ANTES DA RR)"] || ""),
      mandarOficio: String(m["MANDAR OFICIO 44-A - 44-B  (7 MESES ANTES DA RR)"] || ""),
      dataApresentacao: String(m["DATA APRESENTACIÓN"] || m["DATA APRESENTAÇÃO"] || ""),
      atoTransferencia: String(m["ATO DE TRANSFERÊNCIA"] || ""),
      protocoloApres: String(m["PROTOCOLO APRESENTAÇÃO"] || ""),
      email: String(m["E-MAIL"] || ""),
      telefone: String(m["TELEFONE"] || ""),
      endereco: String(m["ENDEREÇO"] || ""),
      rawJson: JSON.stringify(m),
    }));

    await prisma.efetivoMember.createMany({ data: createData });
    logger.info(`[Prisma DB] Inseridos ${createData.length} registros no banco SQLite`);
  } catch (dbErr) {
    logger.error("[Prisma DB Error] Failed to store members in SQLite", dbErr);
  }
}

async function syncViaDirectSpreadsheet(fileId: string): Promise<{
  success: boolean;
  skipped?: boolean;
  message?: string;
  data?: any;
  error?: string;
}> {
  const directUrls = [
    `https://docs.google.com/spreadsheets/d/${fileId}/gviz/tq?tqx=out:csv`,
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`,
  ];

  for (const url of directUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/csv, application/json, text/plain, */*",
        },
      });

      if (res.ok) {
        const text = await res.text();
        const matrix = parseCSV(text);
        const memberRows = parseMatrixToObjects(matrix);

        if (memberRows && memberRows.length > 50) {
          await persistSyncedMembers(memberRows);
          driveCache = {
            data: {
              success: true,
              fileId,
              fileName: "Planilha Efetivo",
              mimeType: "text/csv",
              totalRows: memberRows.length,
              rows: memberRows,
              data: memberRows,
              cachedAt: new Date().toISOString(),
            },
            lastSyncedAt: new Date(),
            status: "success",
            error: null,
            fileModifiedTime: new Date().toISOString(),
          };

          broadcastEvent("drive_synced", {
            fileId,
            fileName: "Planilha Efetivo",
            totalRows: memberRows.length,
            lastSyncedAt: driveCache.lastSyncedAt,
            modifiedTime: driveCache.fileModifiedTime,
          });

          logger.info(`[Drive Sync] Planilha de efetivo sincronizada com sucesso (${memberRows.length} militares)`);
          return { success: true, data: driveCache.data };
        }
      }
    } catch {
      // Sem rota externa no terminal; o navegador faz a sincronização pelo painel
    }
  }

  logger.info("[Drive Sync] Modo cliente ativo (sincronização do efetivo via navegador corporativo)");
  return { success: false, error: "Modo cliente/navegador ativo" };
}

/**
 * Sync Google Drive File with modifiedTime optimization
 */
export async function syncGoogleDriveData(forceRefresh = false): Promise<{
  success: boolean;
  skipped?: boolean;
  message?: string;
  data?: any;
  error?: string;
}> {
  const DEFAULT_EFETIVO_SPREADSHEET_ID = "SEU_SPREADSHEET_ID_EFETIVO";
  const rawFileId =
    process.env.GOOGLE_SHEET_ID ||
    process.env.DRIVE_FILE_ID ||
    DEFAULT_EFETIVO_SPREADSHEET_ID;
  const rawClientEmail = process.env.GOOGLE_CLIENT_EMAIL || "";
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || "";

  const fileId = rawFileId.replace(/^"|"$/g, "").trim();
  const clientEmail = rawClientEmail.replace(/^"|"$/g, "").trim();
  let privateKey = rawPrivateKey.replace(/^"|"$/g, "").trim();

  // If using placeholder credentials, safely retain local shadow data without throwing or downloading
  const isPlaceholder = (val: string) =>
    !val ||
    val.includes("SEU_") ||
    val.includes("EXEMPLO") ||
    val.includes("seu-projeto") ||
    val.includes("SUA_CHAVE");

  if (isPlaceholder(fileId) || isPlaceholder(clientEmail) || isPlaceholder(privateKey)) {
    logger.info("[Drive Sync] Modo exemplo ativo ou credenciais placeholder configuradas. Utilizando dados locais sombra.");
    driveCache.status = "idle";
    return {
      success: true,
      skipped: true,
      message: "Credenciais de exemplo configuradas. Base local mantida.",
    };
  }

  try {
    driveCache.status = "syncing";
    logger.info(`[Drive Sync] Checking metadata for file ID: ${fileId}...`);

    privateKey = privateKey.replace(/\\n/g, "\n");
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const drive = google.drive({ version: "v3", auth });

    // Step 1: Check metadata and modifiedTime BEFORE downloading file body
    const meta: any = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: "id, name, mimeType, size, modifiedTime",
    } as any);

    const currentModifiedTime = meta.data.modifiedTime || null;
    const fileName = meta.data.name || "Arquivo Google Drive";
    const mimeType = meta.data.mimeType || "";

    // Retrieve previous sync metadata from Prisma database
    let lastMeta = null;
    try {
      lastMeta = await prisma.driveSyncMetadata.findUnique({
        where: { id: "default" },
      });
    } catch (dbErr) {
      logger.warn("[Drive Sync] Could not fetch DriveSyncMetadata from DB", dbErr);
    }

    // Step 2: Skip download if file was NOT modified since last successful sync
    if (
      !forceRefresh &&
      lastMeta &&
      lastMeta.status === "success" &&
      lastMeta.driveModifiedTime &&
      currentModifiedTime &&
      lastMeta.driveModifiedTime === currentModifiedTime &&
      driveCache.data
    ) {
      logger.info(
        `[Drive Sync Skipped] File modifiedTime (${currentModifiedTime}) matches cached timestamp. Skipping full download.`
      );
      driveCache.status = "skipped";
      driveCache.lastSyncedAt = new Date();

      return {
        success: true,
        skipped: true,
        message: "O arquivo não foi modificado no Google Drive desde a última sincronização.",
        data: driveCache.data,
      };
    }

    logger.info(
      `[Drive Sync Downloading] File modified: ${currentModifiedTime}. Downloading updated content...`
    );

    let syncedPayload: any = null;
    let memberRows: any[] = [];

    if (mimeType.includes("spreadsheet") || mimeType.includes("google-apps.spreadsheet")) {
      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId: fileId });
      const sheetList = spreadsheetMeta.data.sheets || [];
      const firstSheetName = sheetList[0]?.properties?.title || "Sheet1";

      const valuesRes = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: `'${firstSheetName}'!A1:ZZ5000`,
      });

      const rows = valuesRes.data.values || [];
      memberRows = parseMatrixToObjects(rows);
      if (memberRows.length === 0) {
        memberRows = rows;
      }
      syncedPayload = {
        success: true,
        fileId,
        fileName,
        mimeType,
        sheetName: firstSheetName,
        totalRows: memberRows.length,
        rows: memberRows,
        data: memberRows,
        cachedAt: new Date().toISOString(),
      };
    } else {
      const response: any = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true } as any,
        { responseType: "text" } as any
      );
      const rawContent = response.data;
      let parsedData: any = rawContent;

      if (typeof rawContent === "string") {
        try {
          parsedData = JSON.parse(rawContent);
          if (Array.isArray(parsedData)) {
            memberRows = parsedData;
          } else if (parsedData && Array.isArray(parsedData["EFETIVO TOTAL CM"])) {
            memberRows = parsedData["EFETIVO TOTAL CM"];
          }
        } catch {
          parsedData = { fileName, mimeType, content: rawContent };
        }
      }

      syncedPayload = {
        success: true,
        fileId,
        fileName,
        mimeType,
        data: parsedData,
        cachedAt: new Date().toISOString(),
      };
    }

    // Step 3 & 4: Persist synced data to local JSON and SQLite DB
    await persistSyncedMembers(memberRows);

    // Step 5: Update DriveSyncMetadata record in SQLite
    try {
      await prisma.driveSyncMetadata.upsert({
        where: { id: "default" },
        update: {
          fileId,
          fileName,
          mimeType,
          driveModifiedTime: currentModifiedTime,
          status: "success",
          totalRows: memberRows.length,
          errorMessage: null,
          lastSyncedAt: new Date(),
        },
        create: {
          id: "default",
          fileId,
          fileName,
          mimeType,
          driveModifiedTime: currentModifiedTime,
          status: "success",
          totalRows: memberRows.length,
          errorMessage: null,
          lastSyncedAt: new Date(),
        },
      });
    } catch (metaErr) {
      logger.error("[DriveSyncMetadata Error] Failed to update metadata in SQLite", metaErr);
    }

    // Step 6: Update Memory Cache
    driveCache = {
      data: syncedPayload,
      lastSyncedAt: new Date(),
      status: "success",
      error: null,
      fileModifiedTime: currentModifiedTime,
    };

    // Step 7: Broadcast WebSocket event to all connected dashboard clients
    broadcastEvent("drive_synced", {
      fileId,
      fileName,
      totalRows: memberRows.length,
      lastSyncedAt: driveCache.lastSyncedAt,
      modifiedTime: currentModifiedTime,
    });

    logger.info(`[Drive Sync Success] Successfully synced ${memberRows.length} rows at ${driveCache.lastSyncedAt?.toISOString() || new Date().toISOString()}`);
    return { success: true, data: syncedPayload };
  } catch (err: any) {
    logger.warn(`[Drive Sync API Error] Falha na API do Google Drive: ${err?.message || err}. Tentando fallback direto via CSV da planilha...`);

    // Fallback: Tenta baixar diretamente o CSV da planilha (útil se rede privada bloquear Drive API ou Service Account sem permissão)
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      const csvRes = await fetch(csvUrl);
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        const csvMatrix = parseCSV(csvText);
        let memberRows = parseMatrixToObjects(csvMatrix);
        if (memberRows.length === 0 && csvMatrix.length > 1) {
          memberRows = csvMatrix as any;
        }

        if (memberRows.length > 0) {
          logger.info(`[Drive Sync CSV Fallback Success] Baixados ${memberRows.length} registros com sucesso via CSV!`);
          await persistSyncedMembers(memberRows);

          driveCache = {
            data: {
              success: true,
              fileId,
              fileName: "Planilha Efetivo",
              mimeType: "text/csv",
              totalRows: memberRows.length,
              rows: memberRows,
              data: memberRows,
              cachedAt: new Date().toISOString(),
            },
            lastSyncedAt: new Date(),
            status: "success",
            error: null,
            fileModifiedTime: new Date().toISOString(),
          };

          broadcastEvent("drive_synced", {
            fileId,
            fileName: "Planilha Efetivo",
            totalRows: memberRows.length,
            lastSyncedAt: driveCache.lastSyncedAt,
            modifiedTime: driveCache.fileModifiedTime,
          });

          return { success: true, data: driveCache.data };
        }
      }
    } catch (fallbackErr: any) {
      logger.error("[Drive Sync Fallback Error]", fallbackErr?.message || fallbackErr);
    }

    driveCache.status = "error";
    driveCache.error = err?.message || String(err);

    try {
      await prisma.driveSyncMetadata.upsert({
        where: { id: "default" },
        update: {
          fileId,
          status: "error",
          errorMessage: driveCache.error,
        },
        create: {
          id: "default",
          fileId,
          status: "error",
          errorMessage: driveCache.error,
        },
      });
    } catch {}

    return { success: false, error: driveCache.error || "Unknown error" };
  }
}

// Start 10-minute automatic background interval
export function startDriveSyncScheduler() {
  // Sync on server launch
  syncGoogleDriveData();

  // Run every 10 minutes (600,000 ms)
  const SYNC_INTERVAL_MS = 10 * 60 * 1000;
  setInterval(() => {
    syncGoogleDriveData();
  }, SYNC_INTERVAL_MS);

  logger.info("[Drive Sync Scheduler] Scheduled automatic background sync every 10 minutes");
}
