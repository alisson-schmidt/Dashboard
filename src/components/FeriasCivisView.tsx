import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  CalendarDays,
  RefreshCw,
  Download,
  Home,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import rawFeriasCivisData from "@/data/ferias_civis.json";
import { ThemeToggle, useTheme } from "@/context/ThemeContext";

export interface FeriasCivisRow {
  ORD?: string;
  "POSTO /GRAD"?: string;
  QUADRO?: string;
  NOME?: string;
  RG?: string;
  OBSERVAÇÃO?: string;
  "INÍCIO FRUIÇÃO"?: string;
  "TÉRMINO FRUIÇÃO"?: string;
  "2019"?: string;
  "2020"?: string;
  "2021"?: string;
  "2023"?: string;
  "2024"?: string;
  "2025"?: string;
  "2026"?: string;
  DIVISÃO?: string;
  [key: string]: any;
}

function deduplicateFeriasCivisRows(rawList: FeriasCivisRow[]): FeriasCivisRow[] {
  if (!Array.isArray(rawList)) return [];
  const isFruindo = (o: any) =>
    !!(
      o["INÍCIO FRUIÇÃO"] ||
      o["TÉRMINO FRUIÇÃO"] ||
      (o["OBSERVAÇÃO"] && o["OBSERVAÇÃO"].toString().toUpperCase().includes("FRUINDO"))
    );

  const map = new Map<string, FeriasCivisRow>();
  for (const r of rawList) {
    const rg = (r.RG || "").toString().trim();
    const nome = (r.NOME || "").toString().trim();
    const key = rg || nome;
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const existing = map.get(key)!;
      if (isFruindo(r)) {
        map.set(key, { ...existing, ...r, ORD: existing.ORD || r.ORD });
      } else if (!isFruindo(existing)) {
        for (const k of Object.keys(r)) {
          if (r[k] && !existing[k]) {
            existing[k] = r[k];
          }
        }
      }
    }
  }

  const list = Array.from(map.values());
  list.sort((a, b) => {
    const ordA = parseInt(String(a.ORD || "9999"), 10);
    const ordB = parseInt(String(b.ORD || "9999"), 10);
    if (!isNaN(ordA) && !isNaN(ordB) && ordA !== ordB) return ordA - ordB;
    return (a.NOME || "").localeCompare(b.NOME || "");
  });
  return list;
}

const initialRows: FeriasCivisRow[] = deduplicateFeriasCivisRows(
  (rawFeriasCivisData as any)["FERIAS_CIVIS"] || (rawFeriasCivisData as any)["ferias_civis"] || []
);

const ANOS_EXERCICIO = ["2019", "2020", "2021", "2023", "2024", "2025", "2026"];

const SIGLA_MAP: Record<string, string[]> = {
  CHEFE: ["CHEFE", "CHEFE DA CASA MILITAR"],
  GAB: ["GAB", "GABINETE", "GABINETE CASA MILITAR", "ADIDO/GABINETE GOV", "GOVERNADORIA"],
  DA: ["DA", "DIVISÃO ADMINISTRATIVA", "ADMINISTRATIVA"],
  DOF: ["DOF", "DIVISÃO ORÇAMENTÁRIA E FINANCEIRA", "FINANCEIRA", "ORÇAMENTÁRIA"],
  DTA: ["DTA", "DIVISÃO DE TRANSPORTE AÉREO", "TRANSPORTE AÉREO"],
  DOS: ["DOS", "DIVISÃO DE OPERAÇÕES E SEGURANÇA APROXIMADA", "OPERAÇÕES E SEGURANÇA", "OPERAÇÕES"],
  DSIPS: ["DSIPS", "DIVISÃO DE SEGURANÇA DAS INSTALAÇÕES E PALÁCIOS", "INSTALAÇÕES"],
  DCRI: ["DCRI", "DIVISÃO DE CERIMONIAL E RELAÇÕES INTERNACIONAIS", "CERIMONIAL", "RELAÇÕES INTERNACIONAIS"],
  DIG: ["DIG", "DIVISÃO DE INTELIGÊNCIA GOVERNAMENTAL", "INTELIGÊNCIA GOVERNAMENTAL"],
  NICS: ["NICS", "NÚCLEO DE INTELIGÊNCIA E COMUNICAÇÃO SOCIAL", "COMUNICAÇÃO SOCIAL"],
  AT: ["AT", "ASSESSORIA TÉCNICA", "ASSESSORIA"],
  DTT: ["DTT", "DIVISÃO DE TECNOLOGIA E TELECOMUNICAÇÕES", "TECNOLOGIA"],
};

function toCsv(rows: FeriasCivisRow[]): string {
  if (!rows.length) return "";
  const getSaldoTotalRow = (r: FeriasCivisRow) => {
    return ANOS_EXERCICIO.reduce((acc, ano) => {
      const val = parseInt(String(r[ano] || "0"), 10);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  };

  const cols = [
    "ORD",
    "POSTO /GRAD",
    "QUADRO",
    "NOME",
    "RG",
    "DIVISÃO",
    "SALDO TOTAL (DIAS)",
    "INÍCIO FRUIÇÃO",
    "TÉRMINO FRUIÇÃO",
    "OBSERVAÇÃO",
    "2019",
    "2020",
    "2021",
    "2023",
    "2024",
    "2025",
    "2026",
  ];
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(";"),
    ...rows.map((r) =>
      cols
        .map((c) => {
          if (c === "SALDO TOTAL (DIAS)") {
            return esc(getSaldoTotalRow(r));
          }
          return esc(r[c]);
        })
        .join(";")
    ),
  ].join("\n");
}

function downloadCsv(rows: FeriasCivisRow[], filename: string) {
  const blob = new Blob(["\ufeff" + toCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sincronização direta executada no navegador corporativo
 * Acessa a planilha oficial de Servidores Civis no Google Sheets (Aba ATIVOS)
 */
async function syncFeriasCivisDirectlyFromBrowser(): Promise<FeriasCivisRow[] | null> {
  const SPREADSHEET_ID = "SEU_SPREADSHEET_ID_FERIAS_CIVIS";
  if (SPREADSHEET_ID.includes("SEU_") || SPREADSHEET_ID.includes("EXEMPLO")) {
    return null;
  }
  const urls = [
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=ATIVOS`,
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&sheet=ATIVOS`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const csvText = await res.text();
      if (!csvText || csvText.length < 200) continue;

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
          if (currentLine.some((f) => f.length > 0)) lines.push(currentLine);
          currentLine = [];
          currentField = "";
        } else {
          currentField += char;
        }
      }
      if (currentField.length > 0 || currentLine.length > 0) {
        currentLine.push(currentField.trim());
        if (currentLine.some((f) => f.length > 0)) lines.push(currentLine);
      }

      if (lines.length < 2) continue;
      const headers = lines[0];
      const parsedRows: FeriasCivisRow[] = lines.slice(1).map((row) => {
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
        } as FeriasCivisRow;
      });

      if (parsedRows.length > 0) {
        try {
          await fetch("/api/ferias-civis/sync-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsedRows }),
          });
        } catch {
          // Em ambientes sem backend local (ex: Lovable frontend puro), continua normalmente no navegador
        }
        return parsedRows;
      }
    } catch (e) {
      console.warn("Erro ao buscar via browser na url:", url, e);
    }
  }
  return null;
}

export function FeriasCivisView({
  onNavigateHome,
  onNavigateFerias,
  authUser,
}: {
  onNavigateHome?: () => void;
  onNavigateFerias?: () => void;
  authUser?: { email: string; name: string; picture?: string; role?: "ADMINISTRADOR" | "VISUALIZADOR" };
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [rows, setRows] = useState<FeriasCivisRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [divisao, setDivisao] = useState("__all");
  const [posto, setPosto] = useState("__all");
  const [quadro, setQuadro] = useState("__all");
  const [situacao, setSituacao] = useState("__all");
  const [saldoFiltro, setSaldoFiltro] = useState("__all");
  const [ordenacao, setOrdenacao] = useState<string>("__all");
  const [detail, setDetail] = useState<FeriasCivisRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  // Fetch updated data directly from Google Sheets or fallback to local backend API
  const fetchFeriasCivisData = useCallback(async (refresh = false) => {
    setIsSyncing(true);
    try {
      // 1. Tentar sincronizar via browser diretamente do Google Sheets (Aba ATIVOS)
      const browserRows = await syncFeriasCivisDirectlyFromBrowser();
      if (browserRows && browserRows.length > 0) {
        setRows(deduplicateFeriasCivisRows(browserRows));
        const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setLastSyncTime(timeStr);
        if (refresh) {
          toast.success(`Férias de ${browserRows.length} servidores civis sincronizadas com sucesso (Aba ATIVOS)!`);
        }
        setIsSyncing(false);
        return;
      }

      // 2. Se a busca direta no navegador falhar (ex: sem conexão), busca da API local
      const res = await fetch("/api/ferias-civis");
      if (res.ok) {
        const json = await res.json();
        if (json.rows && Array.isArray(json.rows) && json.rows.length > 0) {
          setRows(deduplicateFeriasCivisRows(json.rows));
          if (refresh) {
            toast.info(`Férias carregadas da cópia local (${json.rows.length} servidores civis).`);
          }
        }
        if (json.lastSyncedAt) {
          setLastSyncTime(
            new Date(json.lastSyncedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        }
      }
    } catch (err) {
      console.warn("[FeriasCivisView] Falha ao sincronizar servidores civis:", err);
      if (refresh) {
        toast.error("Falha ao comunicar com a planilha de servidores civis.");
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeriasCivisData(false);
  }, [fetchFeriasCivisData]);

  const divisoes = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => (r["DIVISÃO"] ?? "").toString().trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  const postos = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => (r["POSTO /GRAD"] ?? "").toString().trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  const quadros = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => (r["QUADRO"] ?? "").toString().trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
  }, [rows]);

  const getSaldoTotal = (r: FeriasCivisRow) => {
    return ANOS_EXERCICIO.reduce((acc, ano) => {
      const val = parseInt(String(r[ano] || "0"), 10);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  };

  const isFruindo = (r: FeriasCivisRow) => {
    const ini = (r["INÍCIO FRUIÇÃO"] ?? "").toString().trim();
    const obs = (r["OBSERVAÇÃO"] ?? "").toString().toUpperCase();
    return !!ini || obs.includes("FRUINDO");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (divisao !== "__all") {
        const div = (r["DIVISÃO"] ?? r["SIGLA DIVISÃO"] ?? "").toString().trim().toUpperCase();
        const target = divisao.toUpperCase();
        const aliases = SIGLA_MAP[target] || [target];
        if (div !== target && !aliases.some((a) => div.includes(a))) return false;
      }

      if (posto !== "__all") {
        const p = (r["POSTO /GRAD"] ?? "").toString().trim().toUpperCase();
        if (p !== posto) return false;
      }

      if (quadro !== "__all") {
        const quad = (r["QUADRO"] ?? "").toString().trim().toUpperCase();
        if (quad !== quadro) return false;
      }

      if (situacao === "fruindo" && !isFruindo(r)) return false;
      if (situacao === "nao_fruindo" && isFruindo(r)) return false;

      const totalSaldo = getSaldoTotal(r);
      if (saldoFiltro === "maior_30" && totalSaldo <= 30) return false;
      if (saldoFiltro === "maior_60" && totalSaldo <= 60) return false;
      if (saldoFiltro === "sem_saldo" && totalSaldo > 0) return false;

      if (!q) return true;
      return [
        "NOME",
        "RG",
        "POSTO /GRAD",
        "QUADRO",
        "DIVISÃO",
        "OBSERVAÇÃO",
      ].some((k) => (r[k] ?? "").toString().toLowerCase().includes(q));
    });

    if (ordenacao === "saldo_desc") {
      result.sort((a, b) => {
        const saldoA = getSaldoTotal(a);
        const saldoB = getSaldoTotal(b);
        if (saldoB !== saldoA) return saldoB - saldoA;
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (ordenacao === "nome_asc") {
      result.sort((a, b) => (a["NOME"] ?? "").localeCompare(b["NOME"] ?? ""));
    }

    return result;
  }, [rows, search, divisao, posto, quadro, situacao, saldoFiltro, ordenacao]);

  const kpis = useMemo(() => {
    const totalInBase = rows.length;
    const totalFiltered = filtered.length;
    const totalEmFruicaoOverall = rows.filter(isFruindo).length;

    return {
      total: totalFiltered,
      totalBase: totalInBase,
      emFruicao: situacao === "fruindo" ? totalFiltered : totalEmFruicaoOverall,
    };
  }, [filtered, rows, situacao]);

  // Division counter for top header badges
  const getSiglaCount = (sigla: string) => {
    const target = sigla.toUpperCase();
    const base = situacao === "fruindo" ? rows.filter(isFruindo) : rows;
    return base.filter((r) => {
      const s = (r["DIVISÃO"] ?? r["SIGLA DIVISÃO"] ?? "").toString().trim().toUpperCase();
      if (s === target) return true;
      const aliases = SIGLA_MAP[target] || [];
      return aliases.some((a) => s.includes(a));
    }).length;
  };

  const clearFilters = () => {
    setSearch("");
    setDivisao("__all");
    setPosto("__all");
    setQuadro("__all");
    setSituacao("__all");
    setSaldoFiltro("__all");
    setOrdenacao("__all");
  };

  const anyFilter =
    search ||
    divisao !== "__all" ||
    posto !== "__all" ||
    quadro !== "__all" ||
    situacao !== "__all" ||
    saldoFiltro !== "__all" ||
    ordenacao !== "__all";

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row antialiased overflow-x-hidden font-sans transition-colors duration-150 ${
        isLight ? "bg-[#f4f5f8] text-slate-900" : "bg-[#0f0f11] text-[#ececed]"
      }`}
    >
      {/* Sidebar de Navegação & Filtros de Férias Servidores Civis */}
      <aside
        className={`w-full lg:w-[280px] shrink-0 border-r p-6 flex flex-col gap-6 transition-colors duration-150 ${
          isLight
            ? "bg-white border-slate-200 shadow-xs"
            : "bg-[#161618] border-[#ececed]/10"
        }`}
      >
        <div
          className={`header-brand flex flex-col gap-1 border-b pb-3 ${
            isLight ? "border-slate-200" : "border-[#ececed]/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <h1
              className={`font-syne font-extrabold text-2xl tracking-tight uppercase leading-none my-1 ${
                isLight ? "text-slate-900" : "text-[#ececed]"
              }`}
            >
              Efetivo CM
            </h1>
            <div
              className={`flex flex-col items-center justify-center px-2 py-0.5 rounded text-[8px] font-mono font-bold leading-tight uppercase border ${
                isLight
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : "bg-[#13233e] text-[#3b82f6] border-[#3b82f6]/40"
              }`}
            >
              <span>FÉRIAS</span>
              <span>CIVIS</span>
            </div>
          </div>
          <p
            className={`text-[10px] font-mono uppercase tracking-wider ${
              isLight ? "text-slate-500" : "text-[#ececed]/50"
            }`}
          >
            Casa Militar — PR
          </p>
        </div>

        {/* Navigation & Theme Toggle */}
        <nav className="nav-section flex flex-col gap-1.5 my-1">
          <button
            type="button"
            onClick={onNavigateHome}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border border-transparent transition-all w-full text-left cursor-pointer ${
              isLight
                ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                : "text-[#ececed]/70 hover:text-[#ececed] hover:bg-[#ececed]/5"
            }`}
          >
            <Home className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-[#ececed]/60"}`} />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={onNavigateFerias}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border border-transparent transition-all w-full text-left cursor-pointer ${
              isLight
                ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                : "text-[#ececed]/70 hover:text-[#ececed] hover:bg-[#ececed]/5"
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-[#ececed]/60"}`} />
            <span>Férias Militares</span>
          </button>

          <button
            type="button"
            onClick={() => {}}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border transition-all w-full text-left cursor-pointer font-bold ${
              isLight
                ? "text-amber-800 bg-amber-50 border-amber-200 shadow-xs"
                : "text-amber-400 bg-amber-500/10 border-amber-500/20"
            }`}
          >
            <Users className={`w-4 h-4 ${isLight ? "text-amber-700" : "text-amber-400"}`} />
            <span>Férias Servidores Civis</span>
          </button>

          {/* Theme Toggle Button */}
          <div className="pt-2">
            <ThemeToggle className="w-full" />
          </div>
        </nav>

        <div className="filter-stack flex flex-col gap-3">
          <span
            className={`section-tag flex items-center justify-between border-b pb-2 ${
              isLight ? "border-slate-200 text-slate-500" : "border-[#ececed]/10 text-[#ececed]/60"
            }`}
          >
            <span>Filtros Servidores Civis</span>
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-amber-600 dark:text-amber-400 hover:underline text-[9px] font-mono cursor-pointer font-bold"
              >
                LIMPAR
              </button>
            )}
          </span>

          {/* Search Input */}
          <div className="relative">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                isLight ? "text-slate-400" : "text-[#ececed]/40"
              }`}
            />
            <input
              type="text"
              placeholder="NOME, RG, CARGO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-xs pl-8 pr-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                isLight
                  ? "bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:bg-white"
                  : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] placeholder:text-[#ececed]/40 focus:border-amber-400"
              }`}
            />
          </div>

          {/* Select Divisão */}
          <select
            value={divisao}
            onChange={(e) => setDivisao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-amber-400"
            }`}
          >
            <option value="__all">Divisão / Lotação</option>
            {divisoes.map((d) => (
              <option key={d} value={d} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {d}
              </option>
            ))}
          </select>

          {/* Select Cargo / Função */}
          <select
            value={posto}
            onChange={(e) => setPosto(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-amber-400"
            }`}
          >
            <option value="__all">Cargo / Função</option>
            {postos.map((p) => (
              <option key={p} value={p} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {p}
              </option>
            ))}
          </select>

          {/* Select Quadro / Vínculo */}
          <select
            value={quadro}
            onChange={(e) => setQuadro(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-amber-400"
            }`}
          >
            <option value="__all">Vínculo / Quadro</option>
            {quadros.map((q) => (
              <option key={q} value={q} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {q}
              </option>
            ))}
          </select>

          {/* Select Situação de Fruição */}
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-amber-400"
            }`}
          >
            <option value="__all">Status Fruição</option>
            <option value="fruindo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              🏖️ Em Fruição Atualmente
            </option>
            <option value="nao_fruindo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              🏢 Em Atividade Normal
            </option>
          </select>

          {/* Select Saldo de Férias */}
          <select
            value={saldoFiltro}
            onChange={(e) => setSaldoFiltro(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-amber-400"
            }`}
          >
            <option value="__all">Saldo Total de Férias</option>
            <option value="maior_60" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              ⚠️ Acima de 60 dias acumulados
            </option>
            <option value="maior_30" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              📅 Acima de 30 dias acumulados
            </option>
            <option value="sem_saldo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              ✅ Sem férias pendentes (0 dias)
            </option>
          </select>

          {/* Select Ordenação */}
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-amber-400"
            }`}
          >
            <option value="__all">Ordem Padrão (Planilha)</option>
            <option value="saldo_desc" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Maior Saldo de Férias
            </option>
            <option value="nome_asc" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Nome do Servidor (A-Z)
            </option>
          </select>
        </div>

        {/* Sync Status & Action Buttons */}
        <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-[#ececed]/10">
          <div
            className={`text-[10px] font-mono flex items-center justify-between p-2 rounded-xs border ${
              isLight
                ? "bg-slate-50 border-slate-200 text-slate-600"
                : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/70"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSyncing ? "bg-amber-400 animate-ping" : "bg-emerald-500"
                }`}
              ></span>
              <span>Google Sheets (Civis)</span>
            </span>
            <span className={`text-[9px] font-mono ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
              {lastSyncTime ? `Última: ${lastSyncTime}` : "Conectado"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => fetchFeriasCivisData(true)}
            disabled={isSyncing}
            className={`w-full font-semibold text-xs py-2 rounded-xs transition-colors font-sans uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
              isLight
                ? "bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700"
                : "bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 border border-[#3b82f6]/40 text-[#3b82f6]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "ATUALIZANDO..." : "SINCRONIZAR CIVIS"}
          </button>
        </div>
      </aside>

      {/* Main Workspace for Ferias Servidores Civis */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header KPIs: Concentrated only in Total Férias Civis & Em Fruição */}
        <header
          className={`flex flex-col sm:flex-row border-b transition-colors ${
            isLight ? "bg-white border-slate-200" : "bg-[#0f0f11] border-[#ececed]/10"
          }`}
        >
          {/* TOTAL FÉRIAS CIVIS Button (Click to reset/view all) */}
          <button
            type="button"
            onClick={() => setSituacao("__all")}
            className={`p-4 border-r border-b sm:border-b-0 shrink-0 min-w-[220px] flex flex-col justify-center text-left transition-all cursor-pointer ${
              isLight
                ? situacao === "__all"
                  ? "bg-blue-50/70 border-slate-200 ring-2 ring-blue-500/20"
                  : "bg-slate-50/50 hover:bg-slate-100/70 border-slate-200"
                : situacao === "__all"
                ? "bg-[#131316] border-[#ececed]/10 ring-1 ring-[#3b82f6]/40"
                : "bg-[#0f0f11] hover:bg-[#161618] border-[#ececed]/10"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`font-mono text-[10px] uppercase tracking-wider block font-bold ${
                  isLight ? "text-slate-500" : "text-[#ececed]/50"
                }`}
              >
                TOTAL FÉRIAS CIVIS
              </span>
              {situacao === "__all" && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-semibold ${
                    isLight ? "bg-blue-100 text-blue-700" : "bg-blue-500/20 text-blue-300"
                  }`}
                >
                  TODOS
                </span>
              )}
            </div>
            <div
              className={`font-syne text-3xl font-extrabold my-0.5 tracking-tight ${
                isLight ? "text-blue-600" : "text-[#3b82f6]"
              }`}
            >
              {String(kpis.total).padStart(2, "0")}
            </div>
            <span
              className={`font-mono text-[9px] uppercase tracking-wider block ${
                isLight ? "text-slate-400" : "text-[#ececed]/40"
              }`}
            >
              {situacao === "__all"
                ? `BASE: ${rows.length} SERVIDORES`
                : "Clique para exibir todos"}
            </span>
          </button>

          {/* EM FRUIÇÃO Button (Clickable: filters table to display who is currently in fruição) */}
          <button
            type="button"
            onClick={() => setSituacao(situacao === "fruindo" ? "__all" : "fruindo")}
            className={`p-4 border-r border-b sm:border-b-0 flex-1 min-w-[260px] flex flex-col justify-center text-left transition-all cursor-pointer group ${
              situacao === "fruindo"
                ? isLight
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500"
                  : "bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/50"
                : isLight
                ? "bg-white hover:bg-emerald-50/50 border-slate-200"
                : "bg-[#111114] hover:bg-emerald-950/20 border-[#ececed]/10"
            }`}
            title="Clique para filtrar e visualizar apenas quem está em fruição"
          >
            <div className="flex items-center justify-between w-full">
              <span
                className={`font-mono text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                  isLight ? "text-emerald-700" : "text-emerald-400"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                EM FRUIÇÃO
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${
                  situacao === "fruindo"
                    ? isLight
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-emerald-500 text-black border-emerald-400"
                    : isLight
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:bg-emerald-100"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-500/20"
                }`}
              >
                {situacao === "fruindo" ? "FILTRADO ATIVO (CLIQUE P/ SAIR)" : "CLIQUE P/ VER QUEM ESTÁ FRUINDO"}
              </span>
            </div>
            <div
              className={`font-syne text-3xl font-extrabold my-0.5 tracking-tight ${
                isLight ? "text-emerald-700" : "text-emerald-400"
              }`}
            >
              {String(kpis.emFruicao).padStart(2, "0")}
            </div>
            <span
              className={`font-mono text-[9px] ${
                isLight ? "text-emerald-800/70" : "text-emerald-300/70"
              }`}
            >
              {situacao === "fruindo"
                ? "Exibindo servidores civis com férias em andamento neste momento"
                : "Servidores civis atualmente em período de fruição de férias"}
            </span>
          </button>
        </header>

        {/* Divisions Filter Buttons Header - Identical to image.png */}
        <div
          className={`border-b overflow-x-auto ${
            isLight ? "bg-white border-slate-200" : "bg-[#0f0f11] border-[#ececed]/10"
          }`}
        >
          <div className="grid grid-cols-6 sm:grid-cols-12 min-w-[760px]">
            {["CHEFE", "GAB", "DA", "DOF", "DTA", "DOS", "DSIPS", "DCRI", "DIG", "NICS", "AT", "DTT"].map(
              (sigla) => {
                const count = getSiglaCount(sigla);
                const isActive = divisao === sigla;
                return (
                  <button
                    key={sigla}
                    type="button"
                    onClick={() => setDivisao(isActive ? "__all" : sigla)}
                    className={`p-2.5 border-r last:border-r-0 flex flex-col justify-center items-start text-left transition-colors cursor-pointer ${
                      isLight ? "border-slate-200" : "border-[#ececed]/10"
                    } ${
                      isActive
                        ? isLight
                          ? "bg-blue-50 border-b-2 border-b-blue-600"
                          : "bg-[#3b82f6]/10 border-b-2 border-b-[#3b82f6]"
                        : isLight
                        ? "hover:bg-slate-50"
                        : "hover:bg-[#18181c]"
                    }`}
                  >
                    <span
                      className={`font-mono text-[9px] uppercase tracking-wider font-bold block ${
                        isLight ? "text-slate-600" : "text-[#ececed]/60"
                      }`}
                    >
                      {sigla}
                    </span>
                    <div
                      className={`font-syne text-lg font-extrabold my-0.5 tracking-tight ${
                        isLight ? "text-slate-900" : "text-[#ececed]"
                      }`}
                    >
                      {String(count).padStart(2, "0")}
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between p-4 border-b gap-3 transition-colors ${
            isLight ? "bg-slate-50/60 border-slate-200" : "bg-[#111114] border-[#ececed]/10"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={isLight ? "text-slate-600" : "text-[#ececed]/60"}>
              Exibindo:{" "}
              <strong className={isLight ? "text-slate-900" : "text-[#ececed]"}>
                {filtered.length}
              </strong>{" "}
              de {rows.length} servidores civis
            </span>
            {situacao === "fruindo" && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  isLight ? "bg-emerald-100 text-emerald-800" : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                Em Fruição
              </span>
            )}
            {divisao !== "__all" && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  isLight ? "bg-blue-100 text-blue-800" : "bg-blue-500/20 text-blue-300"
                }`}
              >
                Divisão: {divisao}
              </span>
            )}
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-blue-500 hover:underline font-mono cursor-pointer font-bold ml-1"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Technical Data Grid Table */}
        <div className="flex-1 p-4 lg:p-6 overflow-x-auto">
          <TechnicalFeriasCivisTable
            rows={filtered}
            onOpen={setDetail}
            isLight={isLight}
            ordenacao={ordenacao}
            onToggleSort={(newSort) => setOrdenacao(newSort)}
          />
        </div>

        {/* Footer with CSV Export (identical to Férias Militares) */}
        <footer
          className={`border-t px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs ${
            isLight
              ? "bg-white border-slate-200 text-slate-500"
              : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/50"
          }`}
        >
          <div className={`text-[11px] ${isLight ? "text-slate-500" : "text-[#ececed]/40"}`}>
            Fonte: Google Sheets (Aba ATIVOS) — Casa Militar / PR
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(filtered, `ferias-civis-cm-${Date.now()}.csv`)}
            className={`border px-4 py-1.5 text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer rounded-xs uppercase flex items-center gap-2 ${
              isLight
                ? "border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white"
                : "border-[#3b82f6] bg-transparent text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORTAR (.CSV)</span>
          </button>
        </footer>
      </main>

      {/* Modal de Detalhes do Servidor Civil */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent
          className={`max-w-2xl max-h-[90vh] overflow-y-auto ${
            isLight ? "bg-white text-slate-900 border-slate-200" : "bg-[#161618] text-[#ececed] border-[#ececed]/15"
          }`}
        >
          <DialogHeader>
            <DialogTitle className="font-syne text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <span>{detail?.NOME || "Detalhes do Servidor Civil"}</span>
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="flex flex-col gap-4 mt-2">
              {/* Informações Básicas */}
              <div
                className={`p-3 rounded-xs border grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0f0f11] border-[#ececed]/10"
                }`}
              >
                <div>
                  <span className={`block text-[9px] uppercase ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
                    ORD
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {detail.ORD ? String(detail.ORD).padStart(2, "0") : "—"}
                  </span>
                </div>
                <div>
                  <span className={`block text-[9px] uppercase ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
                    RG
                  </span>
                  <span>{detail.RG || "—"}</span>
                </div>
                <div>
                  <span className={`block text-[9px] uppercase ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
                    Cargo / Função
                  </span>
                  <span className="font-semibold">{detail["POSTO /GRAD"] || "—"}</span>
                </div>
                <div>
                  <span className={`block text-[9px] uppercase ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
                    Divisão / Lotação
                  </span>
                  <span className="font-semibold">{detail["DIVISÃO"] || "—"}</span>
                </div>
              </div>

              {/* Status de Fruição */}
              <div
                className={`p-3 rounded-xs border flex flex-col gap-1 ${
                  isFruindo(detail)
                    ? isLight
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                    : isLight
                    ? "bg-slate-50 border-slate-200"
                    : "bg-[#0f0f11] border-[#ececed]/10"
                }`}
              >
                <div className="font-mono text-[10px] uppercase font-bold flex items-center justify-between">
                  <span>Status de Fruição Atual</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] ${
                      isFruindo(detail)
                        ? "bg-emerald-500 text-white font-bold"
                        : isLight
                        ? "bg-slate-200 text-slate-700"
                        : "bg-[#ececed]/10 text-[#ececed]/70"
                    }`}
                  >
                    {isFruindo(detail) ? "EM FRUIÇÃO" : "EM ATIVIDADE NORMAL"}
                  </span>
                </div>
                <div className="text-xs font-mono">
                  {detail["INÍCIO FRUIÇÃO"] || detail["TÉRMINO FRUIÇÃO"] ? (
                    <span>
                      {detail["INÍCIO FRUIÇÃO"]} até {detail["TÉRMINO FRUIÇÃO"]}
                    </span>
                  ) : (
                    <span className={isLight ? "text-slate-400" : "text-[#ececed]/40"}>
                      Nenhum período em fruição
                    </span>
                  )}
                </div>
                {detail["OBSERVAÇÃO"] && (
                  <div
                    className={`text-xs font-mono mt-1 ${
                      isLight ? "text-amber-700" : "text-amber-300/90"
                    }`}
                  >
                    Obs: {detail["OBSERVAÇÃO"]}
                  </div>
                )}
              </div>

              {/* Saldo de Férias por Exercício */}
              <div className="flex flex-col gap-2">
                <div
                  className={`font-mono text-[10px] uppercase tracking-widest font-bold border-b pb-1 ${
                    isLight
                      ? "text-amber-800 border-slate-200"
                      : "text-amber-400 border-[#ececed]/10"
                  }`}
                >
                  Saldo de Dias Restantes por Ano / Exercício
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {ANOS_EXERCICIO.map((ano) => {
                    const val = parseInt(String(detail[ano] || "0"), 10);
                    const isZero = isNaN(val) || val === 0;
                    return (
                      <div
                        key={ano}
                        className={`p-2.5 rounded-xs border text-center flex flex-col items-center justify-center ${
                          isZero
                            ? isLight
                              ? "bg-slate-50 border-slate-200 text-slate-400"
                              : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/50"
                            : val > 20
                            ? isLight
                              ? "bg-rose-50 border-rose-200 text-rose-700 font-bold"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-300 font-bold"
                            : isLight
                            ? "bg-amber-50 border-amber-200 text-amber-800 font-bold"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold"
                        }`}
                      >
                        <span
                          className={`font-mono text-[9px] ${
                            isLight ? "text-slate-500" : "text-[#ececed]/60"
                          }`}
                        >
                          {ano}
                        </span>
                        <span className="font-syne text-lg font-extrabold">{val || 0}d</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-1">
                  <span
                    className={`font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    Total Acumulado:{" "}
                    <strong
                      className={`font-syne text-sm ${
                        isLight ? "text-amber-800" : "text-amber-400"
                      }`}
                    >
                      {getSaldoTotal(detail)} dias
                    </strong>
                  </span>
                </div>
              </div>

              {/* Todos os campos brutos */}
              <div
                className={`border-t pt-3 ${
                  isLight ? "border-slate-200" : "border-[#ececed]/10"
                }`}
              >
                <div
                  className={`font-mono text-[9px] uppercase tracking-widest mb-2 ${
                    isLight ? "text-slate-400" : "text-[#ececed]/40"
                  }`}
                >
                  Registro Completo
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
                  {Object.entries(detail)
                    .filter(([k, v]) => {
                      const upperK = k.toUpperCase();
                      return (
                        v !== null &&
                        v !== undefined &&
                        v !== "" &&
                        !upperK.includes("PLANO") &&
                        !upperK.includes("TERÇO") &&
                        !upperK.includes("TERCO")
                      );
                    })
                    .map(([k, v]) => (
                      <div
                        key={k}
                        className={`border-b pb-1 flex justify-between ${
                          isLight ? "border-slate-100" : "border-[#ececed]/5"
                        }`}
                      >
                        <span
                          className={`font-mono text-[9px] uppercase ${
                            isLight ? "text-slate-500" : "text-[#ececed]/50"
                          }`}
                        >
                          {k}:
                        </span>
                        <span
                          className={`font-medium text-[11px] ${
                            isLight ? "text-slate-800" : "text-[#ececed]"
                          }`}
                        >
                          {String(v)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TechnicalFeriasCivisTable({
  rows = [],
  onOpen,
  isLight = false,
  ordenacao = "saldo_desc",
  onToggleSort,
}: {
  rows?: FeriasCivisRow[];
  onOpen: (r: FeriasCivisRow) => void;
  isLight?: boolean;
  ordenacao?: string;
  onToggleSort?: (sort: string) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const safeRows = rows || [];
  const total = safeRows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, pages - 1);
  const currentP = Math.max(0, p);
  const slice = safeRows.slice(currentP * pageSize, (currentP + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [rows.length]);

  return (
    <div
      className={`border rounded-xs overflow-hidden ${
        isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-[#ececed]/10"
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b font-mono text-[10px] uppercase ${
                isLight
                  ? "bg-slate-100 border-slate-200 text-slate-600"
                  : "bg-[#161618] border-[#ececed]/10 text-[#ececed]/50"
              }`}
            >
              <th className="py-3 px-4">ORD</th>
              <th className="py-3 px-4">CARGO / FUNÇÃO</th>
              <th className="py-3 px-4">VÍNCULO / QUADRO</th>
              <th
                className="py-3 px-4 cursor-pointer select-none hover:text-blue-500 transition-colors"
                onClick={() => onToggleSort?.(ordenacao === "nome_asc" ? "__all" : "nome_asc")}
                title="Clique para ordenar por Nome (A-Z) ou restaurar Padrão"
              >
                <div className="flex items-center gap-1">
                  <span>NOME</span>
                  {ordenacao === "nome_asc" && <span className="text-blue-500">▲</span>}
                </div>
              </th>
              <th className="py-3 px-4">RG</th>
              <th className="py-3 px-4">DIVISÃO / LOTAÇÃO</th>
              <th className="py-3 px-4">FRUIÇÃO ATUAL</th>
              <th
                className="py-3 px-4 cursor-pointer select-none hover:text-blue-500 transition-colors"
                onClick={() =>
                  onToggleSort?.(ordenacao === "saldo_desc" ? "__all" : "saldo_desc")
                }
                title="Clique para ordenar por Maior Saldo ou restaurar Padrão"
              >
                <div className="flex items-center gap-1">
                  <span>SALDO (23/24/25/26)</span>
                  {ordenacao === "saldo_desc" && (
                    <span className="text-blue-500 font-bold" title="Maior para menor">
                      ▼
                    </span>
                  )}
                </div>
              </th>
              <th className="py-3 px-4">OBSERVAÇÕES</th>
            </tr>
          </thead>
          <tbody
            className={`font-sans ${
              isLight ? "divide-y divide-slate-100" : "divide-y divide-[#ececed]/5"
            }`}
          >
            {slice.map((r, i) => {
              const rawOrd = r["ORD"] ?? (currentP * pageSize + i + 1);
              const ordNum = parseInt(String(rawOrd), 10);
              const formattedOrd = !isNaN(ordNum)
                ? String(ordNum).padStart(2, "0")
                : String(rawOrd);

              const posto = r["POSTO /GRAD"] || r["CARGO"] || "—";
              const quadro = r["QUADRO"] || "—";
              const nome = r["NOME"] || "—";
              const rg = r["RG"] || "—";
              const divisao = r["DIVISÃO"] || "—";
              const iniFruicao = (r["INÍCIO FRUIÇÃO"] ?? "").toString().trim();
              const fimFruicao = (r["TÉRMINO FRUIÇÃO"] ?? "").toString().trim();
              const obs = (r["OBSERVAÇÃO"] ?? "").toString().trim();

              const saldo2023 = r["2023"] || "0";
              const saldo2024 = r["2024"] || "0";
              const saldo2025 = r["2025"] || "0";
              const saldo2026 = r["2026"] || "0";
              const totalSaldo =
                (parseInt(String(saldo2023), 10) || 0) +
                (parseInt(String(saldo2024), 10) || 0) +
                (parseInt(String(saldo2025), 10) || 0) +
                (parseInt(String(saldo2026), 10) || 0);

              const isFruindoNow = !!iniFruicao || obs.toUpperCase().includes("FRUINDO");

              return (
                <tr
                  key={i}
                  onClick={() => onOpen(r)}
                  className={`cursor-pointer transition-colors ${
                    isLight ? "hover:bg-blue-50/40" : "hover:bg-[#ececed]/[0.03]"
                  }`}
                >
                  <td
                    className={`py-3.5 px-4 font-mono text-xs font-semibold ${
                      isLight ? "text-blue-600" : "text-[#3b82f6]"
                    }`}
                  >
                    {formattedOrd}
                  </td>
                  <td className="py-3.5 px-4 font-medium">
                    <span
                      className={`px-1.5 py-0.5 rounded border font-mono text-[10px] ${
                        isLight
                          ? "bg-slate-100 border-slate-200 text-slate-700"
                          : "bg-[#ececed]/5 border-[#ececed]/10 text-[#ececed]/90"
                      }`}
                    >
                      {posto}
                    </span>
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-[11px] ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {quadro}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-bold uppercase ${
                      isLight ? "text-slate-900" : "text-[#ececed]"
                    }`}
                  >
                    {nome}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-xs ${
                      isLight ? "text-slate-600" : "text-[#ececed]/70"
                    }`}
                  >
                    {rg}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        isLight
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20"
                      }`}
                    >
                      {divisao}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {isFruindoNow ? (
                      <div className="flex flex-col">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            isLight
                              ? "text-emerald-800 bg-emerald-100 border-emerald-300"
                              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {iniFruicao && fimFruicao ? `${iniFruicao} - ${fimFruicao}` : "EM FRUIÇÃO"}
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`font-mono text-[11px] ${
                          isLight ? "text-slate-400" : "text-[#ececed]/40"
                        }`}
                      >
                        —
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          totalSaldo > 30
                            ? isLight
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : totalSaldo > 0
                            ? isLight
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : isLight
                            ? "bg-slate-100 text-slate-500"
                            : "bg-[#ececed]/5 text-[#ececed]/50"
                        }`}
                      >
                        {totalSaldo}d
                      </span>
                      <span
                        className={`text-[9px] ${
                          isLight ? "text-slate-400" : "text-[#ececed]/40"
                        }`}
                      >
                        ({saldo2023}/{saldo2024}/{saldo2025}/{saldo2026})
                      </span>
                    </div>
                  </td>
                  <td
                    className={`py-3.5 px-4 font-mono text-[10px] max-w-[200px] truncate ${
                      isLight ? "text-slate-500" : "text-[#ececed]/50"
                    }`}
                    title={obs}
                  >
                    {obs || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        className={`flex items-center justify-between p-3 border-t text-xs font-mono ${
          isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-[#161618] border-[#ececed]/10 text-[#ececed]/60"
        }`}
      >
        <div>
          Página {currentP + 1} de {pages} ({total} servidores civis)
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={currentP === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            className="px-2.5 py-1 rounded border disabled:opacity-30 cursor-pointer"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={currentP >= pages - 1}
            onClick={() => setPage((prev) => Math.min(pages - 1, prev + 1))}
            className="px-2.5 py-1 rounded border disabled:opacity-30 cursor-pointer"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
