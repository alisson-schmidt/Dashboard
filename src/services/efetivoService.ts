import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { updateDriveCacheData } from "./driveService.js";

const dataPath = path.join(process.cwd(), "src/data/efetivo.json");

export async function getEfetivoMembers(): Promise<any[]> {
  try {
    // Attempt reading from Prisma SQLite database
    const dbMembers = await prisma.efetivoMember.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (dbMembers && dbMembers.length > 0) {
      return dbMembers.map((m: any) => {
        try {
          return JSON.parse(m.rawJson);
        } catch {
          return {
            "Nº": m.numero,
            "TIPO": m.tipo,
            "POSTO/GRAD.  CARGO": m.postoCargo,
            "QPM": m.qpm,
            "NOME": m.nome,
            "RG": m.rg,
            "ID-META4": m.idMeta4,
            "CPF": m.cpf,
            "NOME DE GUERRA": m.nomeGuerra,
            "DATA DE INCLUSÃO": m.dataInclusao,
            "DATA DE NASCIMENTO": m.dataNascimento,
            "DIVISÃO": m.divisao,
            "SIGLA DIVISÃO": m.siglaDivisao,
            "VALOR": m.valor,
            "E-MAIL": m.email,
            "TELEFONE": m.telefone,
          };
        }
      });
    }
  } catch (err) {
    logger.warn("[Efetivo Service] SQLite query failed, falling back to JSON file", err);
  }

  // Fallback to local JSON file
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, "utf-8");
      const json = JSON.parse(raw);
      if (Array.isArray(json)) return json;
      if (json && Array.isArray(json["EFETIVO TOTAL CM"])) return json["EFETIVO TOTAL CM"];
    }
  } catch (err) {
    logger.error("[Efetivo Service] JSON fallback read error", err);
  }

  return [];
}

export async function saveEfetivoMembers(newMembers: any[]): Promise<{ success: boolean; total: number }> {
  try {
    // Sanitize and filter only legitimate military/civilian members
    const validMembers = (newMembers || []).filter((m: any) => {
      if (!m || typeof m !== "object") return false;
      const nome = String(
        m["NOME"] || m["Nome"] || m["nome"] || m["NOME COMPLETO"] || m["Colaborador"] || ""
      ).trim();
      if (!nome) return false;
      const upper = nome.toUpperCase();
      if (
        upper.startsWith("TOTAL") ||
        upper.startsWith("SUBTOTAL") ||
        upper.startsWith("LEGENDA") ||
        upper.startsWith("FONTE") ||
        upper.startsWith("OBSERV") ||
        upper.startsWith("QUADRO") ||
        upper === "NOME" ||
        upper === "N/A"
      ) {
        return false;
      }
      return /[a-zA-ZáéíóúÁÉÍÓÚãõÃÕâêîôûÂÊÎÔÛçÇ]/.test(nome);
    }).map((m: any, idx: number) => {
      const numStr = String(idx + 1).padStart(2, "0");
      return {
        ...m,
        "Nº": numStr,
        "N°": numStr,
      };
    });

    // 1. Write to JSON file
    fs.writeFileSync(dataPath, JSON.stringify({ "EFETIVO TOTAL CM": validMembers }, null, 2), "utf-8");

    // 2. Write to SQLite via Prisma
    await prisma.efetivoMember.deleteMany({});
    const createData = validMembers.map((m: any) => ({
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
      dataNascimento: String(
        m["DATA DE NASCIMENTO"] ||
        m["Data de Nascimento"] ||
        m["DATA NASCIMENTO"] ||
        m["NASCIMENTO"] ||
        m["DATA_NASCIMENTO"] ||
        m["O"] ||
        ""
      ),
      divisao: String(m["DIVISÃO"] || ""),
      siglaDivisao: String(m["SIGLA DIVISÃO"] || ""),
      fppFce: String(m["FPP/FCE"] || ""),
      valor: typeof m["VALOR"] === "number" ? m["VALOR"] : parseFloat(String(m["VALOR"] || "0").replace(",", ".")) || 0,
      email: String(m["E-MAIL"] || ""),
      telefone: String(m["TELEFONE"] || ""),
      rawJson: JSON.stringify(m),
    }));

    await prisma.efetivoMember.createMany({ data: createData });
    updateDriveCacheData(validMembers);
    logger.info(`[Efetivo Service] Saved ${validMembers.length} members to database and JSON cache`);
    return { success: true, total: validMembers.length };
  } catch (err) {
    logger.error("[Efetivo Service Error] Failed to save members", err);
    return { success: false, total: 0 };
  }
}
