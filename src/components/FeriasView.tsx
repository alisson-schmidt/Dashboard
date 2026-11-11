import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  CalendarDays,
  RefreshCw,
  Download,
  Home,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  Clock,
  ChevronDown,
  Plus,
  Share2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import rawFeriasData from "@/data/ferias.json";
import { ThemeToggle, useTheme } from "@/context/ThemeContext";

export interface FeriasRow {
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

// Consolida e remove duplicatas por militar (RG ou NOME), priorizando informações de fruição
function deduplicateFeriasRows(rawList: FeriasRow[]): FeriasRow[] {
  if (!Array.isArray(rawList)) return [];
  const isFruindo = (o: any) =>
    !!(
      o["INÍCIO FRUIÇÃO"] ||
      o["TÉRMINO FRUIÇÃO"] ||
      (o["OBSERVAÇÃO"] && o["OBSERVAÇÃO"].toString().toUpperCase().includes("FRUINDO"))
    );

  const map = new Map<string, FeriasRow>();
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

const initialRows: FeriasRow[] = deduplicateFeriasRows(
  (rawFeriasData as any)["FERIAS"] || (rawFeriasData as any)["ferias"] || []
);

const ANOS_EXERCICIO = ["2019", "2020", "2021", "2023", "2024", "2025", "2026"];

function toCsv(rows: FeriasRow[]): string {
  if (!rows.length) return "";
  const getSaldoTotalRow = (r: FeriasRow) => {
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

function downloadCsv(rows: FeriasRow[], filename: string) {
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
 * Fallback de sincronização executado no navegador corporativo
 * Útil quando o servidor Node local está em uma rede privada sem rota direta
 */
async function syncFeriasDirectlyFromBrowser(): Promise<FeriasRow[] | null> {
  const SPREADSHEET_ID = "SEU_SPREADSHEET_ID_FERIAS";
  if (SPREADSHEET_ID.includes("SEU_") || SPREADSHEET_ID.includes("EXEMPLO")) {
    return null;
  }
  const urls = [
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=GERAL`,
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&sheet=GERAL`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const csvText = await res.text();
      if (!csvText || csvText.length < 500) continue;

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
      const parsedRows: FeriasRow[] = lines.slice(1).map((row) => {
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
          const upper = key.toUpperCase();
          if (upper.includes("PLANO") || upper.includes("TERÇO") || upper.includes("TERCO")) return;
          obj[key] = row[idx] ?? "";
        });
        return obj as FeriasRow;
      });

      if (parsedRows.length > 0) {
        try {
          await fetch("/api/ferias/sync-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsedRows }),
          });
        } catch (e) {
          console.warn("Não foi possível persistir no backend:", e);
        }
        return parsedRows;
      }
    } catch (e) {
      console.warn("Erro ao buscar via browser na url:", url, e);
    }
  }
  return null;
}

export function FeriasView({
  onOpenSheetsModal,
  onNavigateHome,
  onNavigateFeriasCivis,
  onNavigateEscalas,
  authUser,
}: {
  onOpenSheetsModal?: () => void;
  onNavigateHome?: () => void;
  onNavigateFeriasCivis?: () => void;
  onNavigateEscalas?: (subTab?: "cadastrar" | "preview" | "exportar") => void;
  authUser?: { email: string; name: string; picture?: string; role?: "ADMINISTRADOR" | "VISUALIZADOR" };
}) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [isEscalasExpanded, setIsEscalasExpanded] = useState(false);

  const [rows, setRows] = useState<FeriasRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [divisao, setDivisao] = useState("__all");
  const [posto, setPosto] = useState("__all");
  const [situacao, setSituacao] = useState("__all");
  const [saldoFiltro, setSaldoFiltro] = useState("__all");
  const [ordenacao, setOrdenacao] = useState<string>("__all");
  const [detail, setDetail] = useState<FeriasRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  // Fetch updated data from backend API or sync directly via browser
  const fetchFeriasData = useCallback(async (refresh = false) => {
    setIsSyncing(true);
    try {
      if (refresh) {
        // Na rede corporativa militar, a busca direta pelo navegador é instantânea e evita restrições do Node
        const browserRows = await syncFeriasDirectlyFromBrowser();
        if (browserRows && browserRows.length > 0) {
          setRows(deduplicateFeriasRows(browserRows));
          const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          setLastSyncTime(timeStr);
          toast.success(`Férias sincronizadas com sucesso! ${browserRows.length} registros atualizados.`);
          return;
        }
      }

      // Leitura da base local/SQLite do backend
      const res = await fetch("/api/ferias");
      if (res.ok) {
        const json = await res.json();
        if (json.rows && Array.isArray(json.rows) && json.rows.length > 0) {
          setRows(deduplicateFeriasRows(json.rows));
          if (refresh) {
            toast.info(`Férias carregadas da cópia local (${json.rows.length} registros).`);
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
      console.warn("[FeriasView] Falha ao carregar API de férias:", err);
      toast.error("Falha ao comunicar com a planilha de férias.");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeriasData(false);
  }, [fetchFeriasData]);

  // List of unique divisions
  const divisoes = useMemo(() => {
    const list = Array.from(
      new Set(
        rows
          .map((r) => (r["DIVISÃO"] ?? "").toString().trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
    return list;
  }, [rows]);

  // List of unique postos
  const postos = useMemo(() => {
    const list = Array.from(
      new Set(
        rows
          .map((r) => (r["POSTO /GRAD"] ?? "").toString().trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();
    return list;
  }, [rows]);

  // Total saldo calculation for a row
  const getSaldoTotal = (r: FeriasRow) => {
    return ANOS_EXERCICIO.reduce((acc, ano) => {
      const val = parseInt(String(r[ano] || "0"), 10);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  };

  // Check if member is currently fruindo
  const isFruindo = (r: FeriasRow) => {
    const ini = (r["INÍCIO FRUIÇÃO"] ?? "").toString().trim();
    const obs = (r["OBSERVAÇÃO"] ?? "").toString().toUpperCase();
    return !!ini || obs.includes("FRUINDO");
  };

  // Filtered and sorted rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      // Divisao
      if (divisao !== "__all") {
        const div = (r["DIVISÃO"] ?? "").toString().trim().toUpperCase();
        if (div !== divisao) return false;
      }

      // Posto
      if (posto !== "__all") {
        const p = (r["POSTO /GRAD"] ?? "").toString().trim().toUpperCase();
        if (p !== posto) return false;
      }

      // Situacao Fruição (Em Fruição ou Fora de Fruição)
      if (situacao === "fruindo" && !isFruindo(r)) return false;
      if (situacao === "nao_fruindo" && isFruindo(r)) return false;

      // Saldo Filtro
      const totalSaldo = getSaldoTotal(r);
      if (saldoFiltro === "maior_30" && totalSaldo <= 30) return false;
      if (saldoFiltro === "maior_60" && totalSaldo <= 60) return false;
      if (saldoFiltro === "sem_saldo" && totalSaldo > 0) return false;

      // Search query
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

    // Ordenação
    if (ordenacao === "saldo_desc") {
      result.sort((a, b) => {
        const saldoA = getSaldoTotal(a);
        const saldoB = getSaldoTotal(b);
        if (saldoB !== saldoA) return saldoB - saldoA; // maior saldo primeiro
        return (a["NOME"] ?? "").localeCompare(b["NOME"] ?? "");
      });
    } else if (ordenacao === "nome_asc") {
      result.sort((a, b) => (a["NOME"] ?? "").localeCompare(b["NOME"] ?? ""));
    }

    return result;
  }, [rows, search, divisao, posto, situacao, saldoFiltro, ordenacao]);

  // Overall KPIs
  const kpis = useMemo(() => {
    // Total considering other filters except situation if situacao === 'fruindo' to show total in current scope
    const totalInBase = rows.length;
    const totalFiltered = filtered.length;
    const totalEmFruicaoOverall = rows.filter(isFruindo).length;
    const emFruicaoFiltered = filtered.filter(isFruindo).length;

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
      const s = (r["DIVISÃO"] ?? "").toString().trim().toUpperCase();
      return s === target;
    }).length;
  };

  const clearFilters = () => {
    setSearch("");
    setDivisao("__all");
    setPosto("__all");
    setSituacao("__all");
    setSaldoFiltro("__all");
    setOrdenacao("__all");
  };

  const anyFilter =
    search ||
    divisao !== "__all" ||
    posto !== "__all" ||
    situacao !== "__all" ||
    saldoFiltro !== "__all" ||
    ordenacao !== "__all";

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row antialiased overflow-x-hidden font-sans transition-colors duration-150 ${
        isLight ? "bg-[#f4f5f8] text-slate-900" : "bg-[#0f0f11] text-[#ececed]"
      }`}
    >
      {/* Sidebar de Navegação & Filtros de Férias */}
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
              <span>MILITARES</span>
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

          {/* Item expansível: Escalas */}
          {onNavigateEscalas && (
            <div className="flex flex-col rounded-xs overflow-hidden transition-all duration-200">
              <button
                type="button"
                onClick={() => {
                  setIsEscalasExpanded((prev) => !prev);
                  onNavigateEscalas("cadastrar");
                }}
                className={`nav-item flex items-center justify-between px-3 py-2.5 rounded-xs text-xs font-medium border border-transparent transition-all w-full text-left cursor-pointer ${
                  isLight
                    ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                    : "text-[#ececed]/70 hover:text-[#ececed] hover:bg-[#ececed]/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-[#ececed]/60"}`} />
                  <span>Escalas</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isEscalasExpanded ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>

              {isEscalasExpanded && (
                <div className="flex flex-col gap-1 pl-4 pr-1 py-1 mt-1 border-l-2 ml-4 border-blue-500/25">
                  <button
                    type="button"
                    onClick={() => onNavigateEscalas("cadastrar")}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-[11px] font-medium transition-all text-left cursor-pointer ${
                      isLight
                        ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        : "text-[#ececed]/60 hover:text-[#ececed] hover:bg-[#ececed]/5"
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Cadastrar Escala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateEscalas("preview")}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-[11px] font-medium transition-all text-left cursor-pointer ${
                      isLight
                        ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        : "text-[#ececed]/60 hover:text-[#ececed] hover:bg-[#ececed]/5"
                    }`}
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Preview e Compartilhamento</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateEscalas("exportar")}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-[11px] font-medium transition-all text-left cursor-pointer ${
                      isLight
                        ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        : "text-[#ececed]/60 hover:text-[#ececed] hover:bg-[#ececed]/5"
                    }`}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {}}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border transition-all w-full text-left cursor-pointer font-bold ${
              isLight
                ? "text-blue-700 bg-blue-50 border-blue-200 shadow-xs"
                : "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20"
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${isLight ? "text-blue-600" : "text-[#3b82f6]"}`} />
            <span>Férias Militares</span>
          </button>

          <button
            type="button"
            onClick={onNavigateFeriasCivis}
            className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xs text-xs font-medium border border-transparent transition-all w-full text-left cursor-pointer ${
              isLight
                ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                : "text-[#ececed]/70 hover:text-[#ececed] hover:bg-[#ececed]/5"
            }`}
          >
            <Users className={`w-4 h-4 ${isLight ? "text-slate-500" : "text-[#ececed]/60"}`} />
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
            <span>Filtros de Férias Militares</span>
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[#3b82f6] hover:underline text-[9px] font-mono cursor-pointer font-bold"
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
              placeholder="NOME, RG, POSTO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-xs pl-8 pr-3 py-2 text-xs font-mono transition-colors focus:outline-none ${
                isLight
                  ? "bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white"
                  : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] placeholder:text-[#ececed]/40 focus:border-[#3b82f6]"
              }`}
            />
          </div>

          {/* Select Divisão */}
          <select
            value={divisao}
            onChange={(e) => setDivisao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Divisão / Lotação</option>
            {divisoes.map((d) => (
              <option key={d} value={d} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {d}
              </option>
            ))}
          </select>

          {/* Select Posto */}
          <select
            value={posto}
            onChange={(e) => setPosto(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Posto / Graduação</option>
            {postos.map((p) => (
              <option key={p} value={p} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                {p}
              </option>
            ))}
          </select>

          {/* Select Situação de Fruição */}
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Status Fruição</option>
            <option value="fruindo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              🏖️ Em Fruição Atualmente
            </option>
            <option value="nao_fruindo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              🛡️ Fora de Fruição / Disponível
            </option>
          </select>

          {/* Select Saldo de Dias */}
          <select
            value={saldoFiltro}
            onChange={(e) => setSaldoFiltro(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none ${
              isLight
                ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-blue-600"
                : "bg-[#0f0f11] border border-[#ececed]/15 text-[#ececed] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all">Saldo Acumulado</option>
            <option value="maior_30" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Saldo &gt; 30 dias acumulados
            </option>
            <option value="maior_60" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Saldo &gt; 60 dias (Crítico)
            </option>
            <option value="sem_saldo" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Saldo Zerado (0 dias)
            </option>
          </select>

          {/* Select Ordenação */}
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
            className={`w-full rounded-xs px-3 py-2 text-xs font-mono focus:outline-none font-semibold ${
              isLight
                ? "bg-blue-50/60 border border-blue-300 text-blue-900 focus:border-blue-600"
                : "bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] focus:border-[#3b82f6]"
            }`}
          >
            <option value="__all" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              Ordenação
            </option>
            <option value="saldo_desc" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              ⬇️ Saldo: Maior para Menor
            </option>
            <option value="nome_asc" className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
              🔤 Nome (A-Z)
            </option>
          </select>
        </div>

        {/* Sync Info & Immediate Sync Button */}
        <div
          className={`mt-auto pt-3 border-t flex flex-col gap-2 select-none ${
            isLight ? "border-slate-200" : "border-[#ececed]/10"
          }`}
        >
          <div
            className={`flex items-center justify-between text-[10px] font-mono ${
              isLight ? "text-slate-500" : "text-[#ececed]/50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSyncing ? "bg-amber-400 animate-ping" : "bg-emerald-500"
                }`}
              ></span>
              <span>Google Sheets (GERAL)</span>
            </span>
            <span className={`text-[9px] font-mono ${isLight ? "text-slate-400" : "text-[#ececed]/40"}`}>
              {lastSyncTime ? `Última: ${lastSyncTime}` : "Conectado"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => fetchFeriasData(true)}
            disabled={isSyncing}
            className={`w-full font-semibold text-xs py-2 rounded-xs transition-colors font-sans uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 ${
              isLight
                ? "bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700"
                : "bg-[#3b82f6]/15 hover:bg-[#3b82f6]/25 border border-[#3b82f6]/40 text-[#3b82f6]"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "ATUALIZANDO..." : "SINCRONIZAR FÉRIAS MILITARES"}
          </button>
        </div>
      </aside>

      {/* Main Workspace for Ferias */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header KPIs: Concentrated only in Total Férias Militares & Em Fruição */}
        <header
          className={`flex flex-col sm:flex-row border-b transition-colors ${
            isLight ? "bg-white border-slate-200" : "bg-[#0f0f11] border-[#ececed]/10"
          }`}
        >
          {/* TOTAL FÉRIAS MILITARES Button (Click to reset/view all) */}
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
                Total Férias Militares
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
                ? `Base: ${rows.length} servidores`
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
                Em Fruição
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
                ? "Exibindo militares com férias em andamento neste momento"
                : "Militares atualmente em período de fruição de férias"}
            </span>
          </button>
        </header>

        {/* Divisions Filter Buttons Header */}
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

        {/* Main Table Section */}
        <section className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          <div
            className={`flex items-center justify-between border-b pb-3 ${
              isLight ? "border-slate-200" : "border-[#ececed]/10"
            }`}
          >
            <div
              className={`font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                isLight ? "text-slate-800" : "text-[#ececed]"
              }`}
            >
              <CalendarDays className={`w-4 h-4 ${isLight ? "text-blue-600" : "text-[#3b82f6]"}`} />
              <span>
                {situacao === "fruindo"
                  ? `MILITARES EM FRUIÇÃO DE FÉRIAS [${filtered.length}]`
                  : `CONTROLE DE FÉRIAS (ABA GERAL) — OFICIAIS E PRAÇAS [${filtered.length}]`}
              </span>
            </div>

            {anyFilter && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono ${
                    isLight ? "text-slate-500" : "text-[#ececed]/50"
                  }`}
                >
                  Filtros ativos ({filtered.length} de {rows.length})
                </span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:underline font-mono cursor-pointer font-bold"
                >
                  Limpar Todos
                </button>
              </div>
            )}
          </div>

          <div className="mt-2 flex-1">
            <TechnicalFeriasTable
              rows={filtered}
              onOpen={setDetail}
              isLight={isLight}
              ordenacao={ordenacao}
              onToggleSort={(tipo) => setOrdenacao(tipo)}
            />
          </div>
        </section>

        {/* Footer with CSV Export */}
        <footer
          className={`border-t px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs ${
            isLight
              ? "bg-white border-slate-200 text-slate-500"
              : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/50"
          }`}
        >
          <div className={`text-[11px] ${isLight ? "text-slate-500" : "text-[#ececed]/40"}`}>
            Fonte: Google Sheets (Aba GERAL) — Casa Militar / PR
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(filtered, `ferias-geral-cm-${Date.now()}.csv`)}
            className={`border px-4 py-1.5 text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer rounded-xs uppercase flex items-center gap-2 ${
              isLight
                ? "border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white"
                : "border-[#3b82f6] bg-transparent text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD REPORT (.CSV)</span>
          </button>
        </footer>
      </main>

      {/* Detail Dialog for Ferias */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent
          className={`max-w-3xl max-h-[90vh] overflow-y-auto border p-6 ${
            isLight
              ? "bg-white border-slate-300 text-slate-900"
              : "bg-[#161618] border-[#ececed]/20 text-[#ececed]"
          }`}
        >
          <DialogHeader
            className={`border-b pb-3 ${isLight ? "border-slate-200" : "border-[#ececed]/10"}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full border flex items-center justify-center font-syne font-bold text-sm ${
                  isLight
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-[#3b82f6]/20 border-[#3b82f6]/40 text-[#3b82f6]"
                }`}
              >
                {detail?.["POSTO /GRAD"] || "MIL"}
              </div>
              <div>
                <DialogTitle
                  className={`font-syne text-lg font-bold ${
                    isLight ? "text-slate-900" : "text-[#ececed]"
                  }`}
                >
                  {detail?.["NOME"] || "Militar"}
                </DialogTitle>
                <div
                  className={`flex items-center gap-2 font-mono text-[11px] mt-0.5 ${
                    isLight ? "text-slate-500" : "text-[#ececed]/60"
                  }`}
                >
                  <span>RG: {detail?.["RG"] || "—"}</span>
                  <span>•</span>
                  <span>Quadro: {detail?.["QUADRO"] || "—"}</span>
                  <span>•</span>
                  <span className={`font-bold ${isLight ? "text-blue-600" : "text-[#3b82f6]"}`}>
                    Divisão: {detail?.["DIVISÃO"] || "—"}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {detail && (
            <div className="flex flex-col gap-5 py-3">
              {/* Fruição Atual */}
              <div
                className={`p-3 border rounded-xs ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0f0f11] border-[#ececed]/10"
                }`}
              >
                <div
                  className={`font-mono text-[9px] uppercase tracking-widest ${
                    isLight ? "text-slate-500" : "text-[#ececed]/50"
                  }`}
                >
                  Fruição Atual / Período
                </div>
                <div
                  className={`text-sm font-semibold mt-1 flex items-center gap-2 ${
                    isLight ? "text-emerald-700" : "text-emerald-400"
                  }`}
                >
                  {detail["INÍCIO FRUIÇÃO"] && detail["TÉRMINO FRUIÇÃO"] ? (
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
                      ? "text-blue-700 border-slate-200"
                      : "text-[#3b82f6] border-[#ececed]/10"
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
                        isLight ? "text-blue-700" : "text-[#3b82f6]"
                      }`}
                    >
                      {getSaldoTotal(detail)} dias
                    </strong>
                  </span>
                </div>
              </div>

              {/* Todos os campos brutos (desconsiderando PLANO e TERÇO) */}
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

function TechnicalFeriasTable({
  rows = [],
  onOpen,
  isLight = false,
  ordenacao = "saldo_desc",
  onToggleSort,
}: {
  rows?: FeriasRow[];
  onOpen: (r: FeriasRow) => void;
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

  // Reset page when rows length changes
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
              <th className="py-3 px-4">POSTO / GRAD</th>
              <th className="py-3 px-4">QUADRO</th>
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
              <th className="py-3 px-4">DIVISÃO</th>
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

              const posto = r["POSTO /GRAD"] || r["POSTO"] || "—";
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
                    className={`py-3.5 px-4 font-sans text-xs ${
                      isLight ? "text-slate-700" : "text-[#ececed]/80"
                    }`}
                  >
                    {obs ? (
                      <span
                        className={`font-mono text-[10px] line-clamp-1 ${
                          isLight ? "text-amber-800 font-medium" : "text-amber-300/90"
                        }`}
                      >
                        {obs}
                      </span>
                    ) : (
                      <span className={`text-[10px] ${isLight ? "text-slate-400" : "text-[#ececed]/30"}`}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className={`text-center py-12 font-mono text-xs uppercase ${
                    isLight ? "text-slate-400" : "text-[#ececed]/50"
                  }`}
                >
                  Nenhum registro de férias encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className={`flex items-center justify-between p-3 border-t font-mono text-[11px] ${
          isLight
            ? "bg-slate-50 border-slate-200 text-slate-600"
            : "bg-[#0f0f11] border-[#ececed]/10 text-[#ececed]/50"
        }`}
      >
        <div>
          Pág: {p + 1} de {pages} ({total} Registros de Férias)
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            disabled={p === 0}
            onClick={() => setPage(p - 1)}
            className="disabled:opacity-30 hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed font-mono text-xs text-blue-600 font-bold"
          >
            &lt; Anterior
          </button>
          <button
            type="button"
            disabled={p >= pages - 1}
            onClick={() => setPage(p + 1)}
            className="disabled:opacity-30 hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed font-mono text-xs text-blue-600 font-bold"
          >
            Próximo &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
