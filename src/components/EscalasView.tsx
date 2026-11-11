import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Copy,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  Shield,
  UserCheck,
  Search,
  Users,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  Home,
  Check,
  Building,
  Briefcase,
  Layers,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Escala, EscalaItem, TurnoPresetId } from "@/types/escala";
import {
  TURNO_PRESETS,
  SETORES_PADRAO,
  FUNCOES_PADRAO,
  loadAllEscalas,
  saveAllEscalas,
  getActiveEscalaId,
  setActiveEscalaId,
} from "@/services/escalaStorage";
import { formatEscalaText, formatBrDate } from "@/lib/escalaFormatText";
import { exportEscalaToExcel } from "@/lib/escalaExportExcel";
import { ThemeToggle, useTheme } from "@/context/ThemeContext";

interface EscalasViewProps {
  onNavigateHome: () => void;
  onNavigateFerias?: () => void;
  onNavigateFeriasCivis?: () => void;
  activeSubTab?: "cadastrar" | "preview" | "exportar";
  onSubTabChange?: (tab: "cadastrar" | "preview" | "exportar") => void;
  efetivoTotalCM?: Record<string, any>[];
  authUser?: any;
}

export function EscalasView({
  onNavigateHome,
  onNavigateFerias,
  onNavigateFeriasCivis,
  activeSubTab = "cadastrar",
  onSubTabChange,
  efetivoTotalCM = [],
  authUser,
}: EscalasViewProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  // Gerenciamento de sub-abas internas caso não controlado
  const [internalSubTab, setInternalSubTab] = useState<"cadastrar" | "preview" | "exportar">(activeSubTab);
  const currentTab = onSubTabChange ? activeSubTab : internalSubTab;
  const setTab = (tab: "cadastrar" | "preview" | "exportar") => {
    if (onSubTabChange) onSubTabChange(tab);
    setInternalSubTab(tab);
  };

  // Escalas salvas
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [selectedEscalaId, setSelectedEscalaId] = useState<string>("");

  useEffect(() => {
    const list = loadAllEscalas();
    setEscalas(list);
    const activeId = getActiveEscalaId();
    if (list.some((e) => e.id === activeId)) {
      setSelectedEscalaId(activeId);
    } else if (list.length > 0) {
      setSelectedEscalaId(list[0].id);
    }
  }, []);

  const activeEscala = useMemo(() => {
    return escalas.find((e) => e.id === selectedEscalaId) || escalas[0] || null;
  }, [escalas, selectedEscalaId]);

  // ==========================================
  // ESTADO DO FORMULÁRIO DE CADASTRO DE ESCALA
  // ==========================================
  const hoje = new Date().toISOString().split("T")[0];
  const [tituloEscala, setTituloEscala] = useState(`Escala de Serviço - ${formatBrDate(hoje)}`);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [turnoPreset, setTurnoPreset] = useState<TurnoPresetId>("12x36_dia");
  const [horaInicio, setHoraInicio] = useState("06:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [setorSelecionado, setSetorSelecionado] = useState(SETORES_PADRAO[0]);
  const [customSetor, setCustomSetor] = useState("");
  const [funcaoSelecionada, setFuncaoSelecionada] = useState(FUNCOES_PADRAO[1]);
  const [customFuncao, setCustomFuncao] = useState("");
  const [observacoesMilitares, setObservacoesMilitares] = useState("");
  const [observacoesGerais, setObservacoesGerais] = useState(
    "Apresentação com 15 minutos de antecedência. Uniforme 3º RUPM e porte de armamento institucional conferido."
  );

  // Busca e seleção do militar vindo da planilha Google Sheets / efetivo
  const [militarSearch, setMilitarSearch] = useState("");
  const [militarSelecionado, setMilitarSelecionado] = useState<Record<string, any> | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Lista de militares em rascunho na criação
  const [itensRascunho, setItensRascunho] = useState<EscalaItem[]>([]);

  // Quando o preset de turno muda, auto-preenche horários
  const handleTurnoPresetChange = (presetId: TurnoPresetId) => {
    setTurnoPreset(presetId);
    if (presetId === "12x36_dia") {
      setHoraInicio("06:00");
      setHoraFim("18:00");
    } else if (presetId === "12x36_noite") {
      setHoraInicio("18:00");
      setHoraFim("06:00");
    } else if (presetId === "24x72") {
      setHoraInicio("07:00");
      setHoraFim("07:00");
    } else if (presetId === "expediente") {
      setHoraInicio("08:30");
      setHoraFim("18:00");
    } else if (presetId === "turno_a") {
      setHoraInicio("06:00");
      setHoraFim("14:00");
    } else if (presetId === "turno_b") {
      setHoraInicio("14:00");
      setHoraFim("22:00");
    } else if (presetId === "turno_c") {
      setHoraInicio("22:00");
      setHoraFim("06:00");
    }
  };

  // Lista formatada do efetivo exibindo SOMENTE Posto/Graduação e Nome de Guerra conforme solicitado
  const militaresFiltrados = useMemo(() => {
    if (!Array.isArray(efetivoTotalCM)) return [];
    const q = militarSearch.trim().toLowerCase();

    return efetivoTotalCM
      .map((r) => {
        const posto = (r["POSTO/GRAD.  CARGO"] || r["POSTO/GRAD. CARGO"] || r["POSTO /GRAD"] || "").toString().trim();
        const guerra = (r["NOME DE GUERRA"] || "").toString().trim();
        const nomeCompleto = (r["NOME"] || "").toString().trim();
        const rg = (r["RG"] || "").toString().trim();
        // Rótulo estrito: Posto/Graduação e Nome de Guerra
        const labelExibicao = `${posto} ${guerra}`.trim() || nomeCompleto;

        return {
          raw: r,
          posto,
          guerra,
          nomeCompleto,
          rg,
          labelExibicao,
        };
      })
      .filter((m) => {
        if (!q) return true;
        return (
          m.labelExibicao.toLowerCase().includes(q) ||
          m.posto.toLowerCase().includes(q) ||
          m.guerra.toLowerCase().includes(q) ||
          m.rg.toLowerCase().includes(q)
        );
      })
      .slice(0, 30); // Limita para melhor performance e usabilidade
  }, [efetivoTotalCM, militarSearch]);

  // Ação "Adicionar à Escala"
  const handleAdicionarMilitar = () => {
    if (!militarSelecionado) {
      toast.error("Por favor, selecione um militar da lista de efetivo.");
      return;
    }

    const posto =
      militarSelecionado["POSTO/GRAD.  CARGO"] ||
      militarSelecionado["POSTO/GRAD. CARGO"] ||
      militarSelecionado["POSTO /GRAD"] ||
      "—";
    const guerra = militarSelecionado["NOME DE GUERRA"] || militarSelecionado["NOME"] || "—";
    const nomeCompleto = militarSelecionado["NOME"] || "";
    const rg = militarSelecionado["RG"] || "";

    const selectedPresetObj = TURNO_PRESETS.find((t) => t.id === turnoPreset);
    const turnoLabel =
      turnoPreset === "custom"
        ? `Personalizado (${horaInicio} às ${horaFim})`
        : selectedPresetObj?.label || `${horaInicio} às ${horaFim}`;

    const setorFinal =
      setorSelecionado === "__custom"
        ? customSetor.trim() || "Posto Geral"
        : setorSelecionado;

    const funcaoFinal =
      funcaoSelecionada === "__custom"
        ? customFuncao.trim() || "Membro da Escala"
        : funcaoSelecionada;

    const novoItem: EscalaItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      militarRg: rg,
      postoGrad: String(posto).trim(),
      nomeGuerra: String(guerra).trim(),
      nomeCompleto: String(nomeCompleto).trim(),
      funcao: funcaoFinal,
      turno: turnoLabel,
      dataInicio,
      horaInicio,
      dataFim,
      horaFim,
      setor: setorFinal,
      observacoes: observacoesMilitares.trim(),
    };

    setItensRascunho((prev) => [...prev, novoItem]);
    toast.success(`Militar ${posto} ${guerra} adicionado com sucesso!`);

    // Limpa a seleção do militar para agilizar a próxima adição
    setMilitarSelecionado(null);
    setMilitarSearch("");
    setObservacoesMilitares("");
  };

  // Remover item do rascunho
  const handleRemoverItemRascunho = (id: string) => {
    setItensRascunho((prev) => prev.filter((item) => item.id !== id));
    toast.info("Militar removido do rascunho.");
  };

  // Botão "Finalizar Escala": salva e redireciona automaticamente para o preview
  const handleFinalizarEscala = () => {
    if (itensRascunho.length === 0) {
      toast.error("Adicione ao menos um militar à escala antes de finalizar.");
      return;
    }

    const novaEscala: Escala = {
      id: `escala-${Date.now()}`,
      titulo: tituloEscala.trim() || `Escala de Serviço - ${formatBrDate(dataInicio)}`,
      unidade: "Casa Militar do Paraná",
      dataCriacao: new Date().toISOString(),
      dataEscala: dataInicio,
      dataFimEscala: dataFim,
      turnoPadrao: TURNO_PRESETS.find((t) => t.id === turnoPreset)?.label,
      setorGeral: setorSelecionado === "__custom" ? customSetor : setorSelecionado,
      observacoesGerais: observacoesGerais.trim(),
      status: "ativa",
      itens: itensRascunho,
    };

    const atualizadas = [novaEscala, ...escalas];
    setEscalas(atualizadas);
    saveAllEscalas(atualizadas);
    setSelectedEscalaId(novaEscala.id);
    setActiveEscalaId(novaEscala.id);

    // Limpa o rascunho
    setItensRascunho([]);

    toast.success("Escala finalizada com sucesso! Redirecionando para visualização...");
    // Redireciona automaticamente para o Preview conforme requisito
    setTab("preview");
  };

  // Copiar Escala para a área de transferência
  const [copiado, setCopiado] = useState(false);
  const handleCopiarEscala = async () => {
    if (!activeEscala) {
      toast.error("Nenhuma escala selecionada para cópia.");
      return;
    }
    try {
      const texto = formatEscalaText(activeEscala);
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      toast.success("Escala copiada com sucesso para a área de transferência!", {
        description: "Pronta para envio no WhatsApp, Telegram ou e-mail institucional.",
      });
    } catch (err) {
      console.error("Erro ao copiar para clipboard:", err);
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  // Compartilhar via WhatsApp Web diretamente
  const handleCompartilharWhatsApp = () => {
    if (!activeEscala) return;
    const texto = formatEscalaText(activeEscala);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  // Exportar para Excel (.xlsx)
  const [isExporting, setIsExporting] = useState(false);
  const handleExportarExcel = async () => {
    if (!activeEscala) {
      toast.error("Nenhuma escala disponível para exportação.");
      return;
    }
    setIsExporting(true);
    try {
      await exportEscalaToExcel(activeEscala);
      toast.success("Download do arquivo Excel (.xlsx) concluído!", {
        description: "Planilha formatada com cabeçalho institucional e linhas zebradas.",
      });
    } catch (err) {
      console.error("Erro na exportação Excel:", err);
      toast.error("Falha ao gerar o arquivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row antialiased overflow-x-hidden font-sans transition-colors duration-150 ${
        isLight ? "bg-[#f4f5f8] text-slate-900" : "bg-[#0f0f11] text-[#ececed]"
      }`}
    >
      {/* ============================================================ */}
      {/* SIDEBAR DA CASA MILITAR COM NAVEGAÇÃO E SUB-OPÇÕES DE ESCALA  */}
      {/* ============================================================ */}
      <aside
        className={`w-full lg:w-[280px] shrink-0 border-r p-6 flex flex-col gap-6 transition-colors duration-150 ${
          isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-[#ececed]/10"
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
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                isLight ? "bg-blue-100 text-blue-800" : "bg-blue-500/20 text-blue-400"
              }`}
            >
              Escalas
            </span>
          </div>
          <p
            className={`text-[10px] font-mono uppercase tracking-wider ${
              isLight ? "text-slate-500" : "text-[#ececed]/50"
            }`}
          >
            Casa Militar — PR
          </p>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="nav-section flex flex-col gap-1.5 my-1">
          {/* Botão Home */}
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

          {/* ITEM EXPANSÍVEL: ESCALAS COM 3 SUB-OPÇÕES */}
          <div
            className={`rounded-xs border transition-all ${
              isLight
                ? "border-blue-200 bg-blue-50/50"
                : "border-[#3b82f6]/30 bg-[#3b82f6]/5"
            }`}
          >
            <div
              className={`flex items-center justify-between px-3 py-2.5 text-xs font-bold ${
                isLight ? "text-blue-700" : "text-[#3b82f6]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className={`w-4 h-4 ${isLight ? "text-blue-600" : "text-[#3b82f6]"}`} />
                <span>Escalas</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-blue-500/20">
                Módulo
              </span>
            </div>

            {/* Sub-opções do Accordion */}
            <div className="flex flex-col gap-1 px-2 pb-2 pt-1 border-t border-blue-500/10">
              <button
                type="button"
                onClick={() => setTab("cadastrar")}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-[11px] font-medium transition-all text-left cursor-pointer ${
                  currentTab === "cadastrar"
                    ? isLight
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : "bg-[#3b82f6] text-white font-bold"
                    : isLight
                    ? "text-slate-600 hover:bg-blue-100/60"
                    : "text-[#ececed]/70 hover:bg-white/5"
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>1. Cadastrar Escala</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-[11px] font-medium transition-all text-left cursor-pointer ${
                  currentTab === "preview"
                    ? isLight
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : "bg-[#3b82f6] text-white font-bold"
                    : isLight
                    ? "text-slate-600 hover:bg-blue-100/60"
                    : "text-[#ececed]/70 hover:bg-white/5"
                }`}
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>2. Preview e Compartilhamento</span>
              </button>

              <button
                type="button"
                onClick={() => setTab("exportar")}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-[11px] font-medium transition-all text-left cursor-pointer ${
                  currentTab === "exportar"
                    ? isLight
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : "bg-[#3b82f6] text-white font-bold"
                    : isLight
                    ? "text-slate-600 hover:bg-blue-100/60"
                    : "text-[#ececed]/70 hover:bg-white/5"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>3. Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Botão Férias Militares */}
          {onNavigateFerias && (
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
          )}

          {/* Botão Férias Civis */}
          {onNavigateFeriasCivis && (
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
          )}

          {/* Seletor de Tema */}
          <div className="pt-2">
            <ThemeToggle className="w-full" />
          </div>
        </nav>

        {/* Informações da Escala Ativa na Sidebar */}
        <div
          className={`p-3 rounded-xs border flex flex-col gap-2 mt-auto text-xs ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-[#1f1f23] border-white/5"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
            <span>Escala Ativa</span>
            <span className="text-emerald-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeEscala?.status || "Rascunho"}
            </span>
          </div>
          <p className="font-semibold text-xs truncate">
            {activeEscala?.titulo || "Nenhuma escala"}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Militares:</span>
            <span className="font-mono font-bold text-blue-500">
              {activeEscala?.itens.length || 0}
            </span>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* CONTEÚDO PRINCIPAL DO MÓDULO DE ESCALAS                       */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header do Módulo */}
        <header
          className={`border-b p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isLight ? "bg-white border-slate-200" : "bg-[#161618] border-[#ececed]/10"
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-600 text-white">
                Módulo Oficial
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Casa Militar da Governadoria — PR
              </span>
            </div>
            <h1 className="font-syne font-extrabold text-2xl tracking-tight uppercase">
              Gerenciamento de Escalas de Serviço
            </h1>
          </div>

          {/* Abas superiores rápidas */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("cadastrar")}
              className={`px-3 py-1.5 rounded-xs text-xs font-medium cursor-pointer transition-all flex items-center gap-2 ${
                currentTab === "cadastrar"
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar</span>
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`px-3 py-1.5 rounded-xs text-xs font-medium cursor-pointer transition-all flex items-center gap-2 ${
                currentTab === "preview"
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Preview & Copiar</span>
            </button>
            <button
              onClick={() => setTab("exportar")}
              className={`px-3 py-1.5 rounded-xs text-xs font-medium cursor-pointer transition-all flex items-center gap-2 ${
                currentTab === "exportar"
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* ABA 1: CADASTRAR ESCALA                                      */}
        {/* ============================================================ */}
        {currentTab === "cadastrar" && (
          <div className="p-6 max-w-6xl w-full mx-auto flex flex-col gap-6">
            {/* Bloco de Informações Gerais da Escala */}
            <div
              className={`rounded-lg border p-5 ${
                isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-white/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-4 border-b pb-2 border-slate-200 dark:border-white/10">
                <Clock className="w-4 h-4 text-blue-500" />
                <h2 className="font-bold text-sm uppercase tracking-wide">
                  Dados Gerais da Nova Escala
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Título / Identificação da Escala
                  </label>
                  <input
                    type="text"
                    value={tituloEscala}
                    onChange={(e) => setTituloEscala(e.target.value)}
                    placeholder="Ex: Escala de Serviço - Palácio Iguaçu"
                    className={`w-full rounded px-3 py-2 text-xs font-medium focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      if (dataFim < e.target.value) setDataFim(e.target.value);
                    }}
                    className={`w-full rounded px-3 py-2 text-xs font-mono focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    min={dataInicio}
                    onChange={(e) => setDataFim(e.target.value)}
                    className={`w-full rounded px-3 py-2 text-xs font-mono focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium mb-1 text-slate-400">
                  Instruções & Observações Gerais da Escala
                </label>
                <textarea
                  rows={2}
                  value={observacoesGerais}
                  onChange={(e) => setObservacoesGerais(e.target.value)}
                  placeholder="Orientações de uniforme, horário de assunção, conferência de armamento..."
                  className={`w-full rounded px-3 py-2 text-xs focus:outline-none resize-none ${
                    isLight
                      ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                      : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Formulário: Adicionar Militares para o Turno/Período */}
            <div
              className={`rounded-lg border p-5 ${
                isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-4 border-b pb-2 border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <h2 className="font-bold text-sm uppercase tracking-wide">
                    Adicionar Militar ao Turno / Posto
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {efetivoTotalCM.length} militares ativos disponíveis
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. SELEÇÃO DO PERÍODO / TURNO PREDEFINIDO */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Período / Turno de Serviço
                  </label>
                  <select
                    value={turnoPreset}
                    onChange={(e) => handleTurnoPresetChange(e.target.value as TurnoPresetId)}
                    className={`w-full rounded px-3 py-2 text-xs font-medium focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  >
                    {TURNO_PRESETS.map((t) => (
                      <option key={t.id} value={t.id} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horário Início / Fim */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-400">
                      Hora Início
                    </label>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className={`w-full rounded px-2.5 py-2 text-xs font-mono focus:outline-none ${
                        isLight
                          ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                          : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-slate-400">
                      Hora Fim
                    </label>
                    <input
                      type="time"
                      value={horaFim}
                      onChange={(e) => setHoraFim(e.target.value)}
                      className={`w-full rounded px-2.5 py-2 text-xs font-mono focus:outline-none ${
                        isLight
                          ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                          : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                      }`}
                    />
                  </div>
                </div>

                {/* 2. SELEÇÃO DO SETOR / POSTO */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Setor / Local
                  </label>
                  <select
                    value={setorSelecionado}
                    onChange={(e) => setSetorSelecionado(e.target.value)}
                    className={`w-full rounded px-3 py-2 text-xs font-medium focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  >
                    {SETORES_PADRAO.map((s) => (
                      <option key={s} value={s} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                        {s}
                      </option>
                    ))}
                    <option value="__custom">+ Outro Setor Personalizado</option>
                  </select>
                  {setorSelecionado === "__custom" && (
                    <input
                      type="text"
                      value={customSetor}
                      onChange={(e) => setCustomSetor(e.target.value)}
                      placeholder="Digite o nome do setor..."
                      className={`w-full mt-2 rounded px-3 py-1.5 text-xs focus:outline-none ${
                        isLight
                          ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                          : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                      }`}
                    />
                  )}
                </div>

                {/* 3. SELEÇÃO DA FUNÇÃO */}
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Função no Serviço
                  </label>
                  <select
                    value={funcaoSelecionada}
                    onChange={(e) => setFuncaoSelecionada(e.target.value)}
                    className={`w-full rounded px-3 py-2 text-xs font-medium focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  >
                    {FUNCOES_PADRAO.map((f) => (
                      <option key={f} value={f} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                        {f}
                      </option>
                    ))}
                    <option value="__custom">+ Outra Função Personalizada</option>
                  </select>
                  {funcaoSelecionada === "__custom" && (
                    <input
                      type="text"
                      value={customFuncao}
                      onChange={(e) => setCustomFuncao(e.target.value)}
                      placeholder="Digite o nome da função..."
                      className={`w-full mt-2 rounded px-3 py-1.5 text-xs focus:outline-none ${
                        isLight
                          ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                          : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                      }`}
                    />
                  )}
                </div>

                {/* 4. SELEÇÃO DINÂMICA DO MILITAR (Posto/Grad e Nome de Guerra) */}
                <div className="relative md:col-span-2">
                  <label className="block text-xs font-medium mb-1 text-slate-400 flex items-center justify-between">
                    <span>Militar (Carregado do Google Sheets / Efetivo)</span>
                    <span className="text-[10px] text-blue-500 font-mono">
                      Exibindo Posto/Graduação e Nome de Guerra
                    </span>
                  </label>

                  {/* Campo de Busca & Seletor */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={
                        militarSelecionado
                          ? `${militarSelecionado["POSTO/GRAD.  CARGO"] || militarSelecionado["POSTO/GRAD. CARGO"] || ""} ${militarSelecionado["NOME DE GUERRA"] || ""}`.trim()
                          : militarSearch
                      }
                      onChange={(e) => {
                        setMilitarSelecionado(null);
                        setMilitarSearch(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="Pesquisar por Posto/Graduação ou Nome de Guerra..."
                      className={`w-full rounded pl-9 pr-8 py-2 text-xs font-semibold focus:outline-none ${
                        isLight
                          ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                          : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                      }`}
                    />
                    {militarSelecionado && (
                      <button
                        type="button"
                        onClick={() => {
                          setMilitarSelecionado(null);
                          setMilitarSearch("");
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Resultados Dinâmicos */}
                  {isDropdownOpen && !militarSelecionado && (
                    <div
                      className={`absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border shadow-xl ${
                        isLight ? "bg-white border-slate-300" : "bg-[#1f1f23] border-white/15"
                      }`}
                    >
                      {militaresFiltrados.length === 0 ? (
                        <div className="p-3 text-xs text-center text-slate-400">
                          Nenhum militar encontrado com esse termo.
                        </div>
                      ) : (
                        militaresFiltrados.map((m) => (
                          <div
                            key={m.rg || m.nomeCompleto}
                            onClick={() => {
                              setMilitarSelecionado(m.raw);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-2.5 text-xs flex items-center justify-between cursor-pointer border-b last:border-0 transition-colors ${
                              isLight
                                ? "border-slate-100 hover:bg-blue-50"
                                : "border-white/5 hover:bg-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-500 px-1.5 py-0.5 rounded bg-blue-500/10 text-[10px]">
                                {m.posto || "MILITAR"}
                              </span>
                              <span className="font-bold text-sm tracking-wide">
                                {m.guerra || m.nomeCompleto}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              RG: {m.rg || "—"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Observações do militar */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium mb-1 text-slate-400">
                    Observações Específicas do Militar (Opcional)
                  </label>
                  <input
                    type="text"
                    value={observacoesMilitares}
                    onChange={(e) => setObservacoesMilitares(e.target.value)}
                    placeholder="Ex: Porte de Pistola Cal. 9mm, Rádio HT prefixo 04, Viatura blindada..."
                    className={`w-full rounded px-3 py-2 text-xs focus:outline-none ${
                      isLight
                        ? "bg-slate-50 border border-slate-300 focus:border-blue-600"
                        : "bg-[#0f0f11] border border-white/15 focus:border-blue-500"
                    }`}
                  />
                </div>
              </div>

              {/* Botão de Adicionar à Escala */}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={handleAdicionarMilitar}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar à Escala</span>
                </button>
              </div>
            </div>

            {/* Quadro de Militares Adicionados no Rascunho Atual */}
            <div
              className={`rounded-lg border p-5 ${
                isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-4 border-b pb-2 border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <h2 className="font-bold text-sm uppercase tracking-wide">
                    Quadro de Efetivo Escalado ({itensRascunho.length} militares)
                  </h2>
                </div>
                {itensRascunho.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setItensRascunho([])}
                    className="text-xs text-red-500 hover:underline cursor-pointer"
                  >
                    Limpar Rascunho
                  </button>
                )}
              </div>

              {itensRascunho.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 text-slate-500/50" />
                  <p className="text-xs">
                    Nenhum militar adicionado à escala ainda. Preencha o formulário acima e clique em{" "}
                    <strong>"Adicionar à Escala"</strong>.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr
                        className={`border-b text-[11px] uppercase font-mono ${
                          isLight ? "border-slate-200 text-slate-500 bg-slate-50" : "border-white/10 text-slate-400 bg-white/5"
                        }`}
                      >
                        <th className="p-2.5">Nº</th>
                        <th className="p-2.5">Posto / Guerra</th>
                        <th className="p-2.5">Função</th>
                        <th className="p-2.5">Setor</th>
                        <th className="p-2.5">Turno / Horário</th>
                        <th className="p-2.5">Observações</th>
                        <th className="p-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {itensRascunho.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isLight ? "hover:bg-slate-50" : "hover:bg-white/5"
                          }`}
                        >
                          <td className="p-2.5 font-mono text-slate-400 font-bold">
                            {index + 1}
                          </td>
                          <td className="p-2.5">
                            <span className="font-mono font-bold text-blue-500 mr-1.5">
                              {item.postoGrad}
                            </span>
                            <span className="font-bold uppercase">{item.nomeGuerra}</span>
                          </td>
                          <td className="p-2.5 font-medium">{item.funcao}</td>
                          <td className="p-2.5 text-slate-400">{item.setor}</td>
                          <td className="p-2.5 font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px]">
                              {item.turno}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400 italic">
                            {item.observacoes || "—"}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoverItemRascunho(item.id)}
                              className="text-red-400 hover:text-red-500 p-1 rounded hover:bg-red-500/10 cursor-pointer"
                              title="Remover militar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Botão de Finalização da Escala */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Ao finalizar, a escala será salva e você será redirecionado para a visualização e compartilhamento.
                </span>
                <button
                  type="button"
                  onClick={handleFinalizarEscala}
                  disabled={itensRascunho.length === 0}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-3 rounded-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalizar Escala</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 2: PREVIEW E COMPARTILHAMENTO (Copiar Escala)             */}
        {/* ============================================================ */}
        {currentTab === "preview" && (
          <div className="p-6 max-w-6xl w-full mx-auto flex flex-col gap-6">
            {/* Barra de Ações Superior do Preview */}
            <div
              className={`rounded-lg border p-4 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-white/10"
              }`}
            >
              {/* Seletor de Escalas Salvas */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="text-xs font-mono uppercase text-slate-400 shrink-0">
                  Selecionar Escala:
                </label>
                <select
                  value={selectedEscalaId}
                  onChange={(e) => {
                    setSelectedEscalaId(e.target.value);
                    setActiveEscalaId(e.target.value);
                  }}
                  className={`rounded px-3 py-1.5 text-xs font-medium focus:outline-none w-full sm:w-72 ${
                    isLight
                      ? "bg-slate-50 border border-slate-300"
                      : "bg-[#0f0f11] border border-white/15"
                  }`}
                >
                  {escalas.map((esc) => (
                    <option key={esc.id} value={esc.id} className={isLight ? "bg-white text-slate-900" : "bg-[#161618]"}>
                      {esc.titulo} ({esc.itens.length} militares)
                    </option>
                  ))}
                </select>
              </div>

              {/* Botões de Ação: Copiar e Compartilhar */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCopiarEscala}
                  className={`px-4 py-2 rounded-xs font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                    copiado
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {copiado ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copiado com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Escala (WhatsApp/Texto)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCompartilharWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xs transition-all flex items-center gap-2 cursor-pointer"
                  title="Abrir no WhatsApp"
                >
                  <Share2 className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab("exportar")}
                  className={`px-3.5 py-2 rounded-xs font-medium text-xs transition-all flex items-center gap-2 cursor-pointer border ${
                    isLight
                      ? "bg-slate-50 border-slate-300 hover:bg-slate-100"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Excel</span>
                </button>
              </div>
            </div>

            {/* Painel de Visualização Formatada da Escala */}
            {activeEscala ? (
              <div
                className={`rounded-lg border overflow-hidden ${
                  isLight ? "bg-white border-slate-200 shadow-sm" : "bg-[#161618] border-white/10"
                }`}
              >
                {/* Banner Oficial Institucional */}
                <div className="bg-[#1e3a8a] text-white p-6 border-b border-blue-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono tracking-widest uppercase opacity-80 mb-1">
                        Governo do Estado do Paraná • Casa Militar da Governadoria
                      </p>
                      <h2 className="text-xl font-syne font-extrabold tracking-tight uppercase">
                        {activeEscala.titulo}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-white/20 text-white font-mono text-xs font-bold">
                        {activeEscala.itens.length} Militares
                      </span>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/80 text-white font-mono text-xs font-bold uppercase">
                        {activeEscala.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <strong className="opacity-75 block text-[10px] uppercase font-mono">
                        Período / Data
                      </strong>
                      <span>
                        {formatBrDate(activeEscala.dataEscala)}
                        {activeEscala.dataFimEscala &&
                          activeEscala.dataFimEscala !== activeEscala.dataEscala &&
                          ` até ${formatBrDate(activeEscala.dataFimEscala)}`}
                      </span>
                    </div>
                    <div>
                      <strong className="opacity-75 block text-[10px] uppercase font-mono">
                        Setor Geral
                      </strong>
                      <span>{activeEscala.setorGeral || "Casa Militar - Sede"}</span>
                    </div>
                    <div>
                      <strong className="opacity-75 block text-[10px] uppercase font-mono">
                        Gerada em
                      </strong>
                      <span>{new Date(activeEscala.dataCriacao).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>

                {/* Conteúdo da Escala Agrupado por Turno */}
                <div className="p-6 flex flex-col gap-6">
                  {activeEscala.itens.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      Nenhum militar cadastrado nesta escala.
                    </div>
                  ) : (
                    // Agrupamento por Turno
                    Array.from(
                      new Set(activeEscala.itens.map((i) => i.turno || "Turno Ordinário"))
                    ).map((turnoNome) => {
                      const itensDoTurno = activeEscala.itens.filter(
                        (i) => (i.turno || "Turno Ordinário") === turnoNome
                      );

                      return (
                        <div
                          key={turnoNome}
                          className={`rounded border overflow-hidden ${
                            isLight ? "border-slate-200" : "border-white/10"
                          }`}
                        >
                          <div
                            className={`p-3 font-mono font-bold text-xs uppercase flex items-center justify-between ${
                              isLight ? "bg-slate-100 text-slate-800" : "bg-white/5 text-blue-400"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{turnoNome}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono">
                              {itensDoTurno.length} escalado(s)
                            </span>
                          </div>

                          <div className="divide-y divide-slate-200 dark:divide-white/5">
                            {itensDoTurno.map((militar, idx) => (
                              <div
                                key={militar.id}
                                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                                  idx % 2 === 1
                                    ? isLight
                                      ? "bg-slate-50/70"
                                      : "bg-white/[0.02]"
                                    : "bg-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                                        {militar.postoGrad}
                                      </span>
                                      <span className="font-bold text-sm tracking-wide">
                                        {militar.nomeGuerra}
                                      </span>
                                      {militar.militarRg && (
                                        <span className="text-[10px] font-mono text-slate-400">
                                          ({militar.militarRg})
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {militar.nomeCompleto}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 sm:text-right">
                                  <div className="flex flex-col sm:items-end">
                                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">
                                      {militar.funcao}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {militar.setor}
                                    </span>
                                  </div>
                                  {militar.observacoes && (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded border max-w-xs truncate ${
                                        isLight
                                          ? "bg-amber-50 border-amber-200 text-amber-800"
                                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                      }`}
                                      title={militar.observacoes}
                                    >
                                      Obs: {militar.observacoes}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Observações Gerais */}
                  {activeEscala.observacoesGerais && (
                    <div
                      className={`p-4 rounded border text-xs ${
                        isLight
                          ? "bg-slate-50 border-slate-200 text-slate-700"
                          : "bg-white/5 border-white/10 text-slate-300"
                      }`}
                    >
                      <strong className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Observações Gerais da Ordem de Serviço:
                      </strong>
                      <p className="leading-relaxed italic">{activeEscala.observacoesGerais}</p>
                    </div>
                  )}

                  {/* Exibição do Texto Formatado para Cópia Direta */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono uppercase text-slate-400 font-bold">
                        Visualização do Texto para WhatsApp / E-mail
                      </span>
                      <button
                        type="button"
                        onClick={handleCopiarEscala}
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar Texto</span>
                      </button>
                    </div>
                    <pre
                      className={`p-4 rounded text-[11px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border select-all ${
                        isLight
                          ? "bg-slate-900 text-emerald-400 border-slate-800"
                          : "bg-black/60 text-emerald-400 border-white/10"
                      }`}
                    >
                      {formatEscalaText(activeEscala)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                Nenhuma escala encontrada.
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 3: EXPORTAR PARA EXCEL                                   */}
        {/* ============================================================ */}
        {currentTab === "exportar" && (
          <div className="p-6 max-w-5xl w-full mx-auto flex flex-col gap-6">
            <div
              className={`rounded-lg border p-6 flex flex-col gap-6 ${
                isLight ? "bg-white border-slate-200 shadow-xs" : "bg-[#161618] border-white/10"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-600">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-syne font-bold uppercase">
                      Exportação Profissional para Excel (.xlsx)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Geração de planilha estilizada com padrão institucional da Casa Militar
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportarExcel}
                  disabled={!activeEscala || isExporting}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-3 rounded-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gerando Planilha...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Baixar Planilha Excel (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Destaques das Características da Planilha */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`p-4 rounded border text-xs flex flex-col gap-1.5 ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-blue-500 font-bold">
                    <Shield className="w-4 h-4" />
                    <span>Cabeçalho Institucional</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Identificação em azul escuro marinho (#1E3A8A) com texto branco em negrito e metadados oficiais.
                  </p>
                </div>

                <div
                  className={`p-4 rounded border text-xs flex flex-col gap-1.5 ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-emerald-500 font-bold">
                    <Layers className="w-4 h-4" />
                    <span>Linhas Zebradas & Bordas</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Alternância sutil de cores (#FFFFFF e #F8FAFC) com bordas finas para leitura e impressão otimizadas.
                  </p>
                </div>

                <div
                  className={`p-4 rounded border text-xs flex flex-col gap-1.5 ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-purple-500 font-bold">
                    <UserCheck className="w-4 h-4" />
                    <span>Campos de Homologação</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Espaço para assinaturas do Oficial de Dia e do Chefe da Divisão / Comandante no rodapé.
                  </p>
                </div>
              </div>

              {/* Informações da Escala que será exportada */}
              {activeEscala && (
                <div
                  className={`p-4 rounded border flex flex-col gap-3 ${
                    isLight ? "bg-blue-50/50 border-blue-200" : "bg-blue-500/5 border-blue-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-600">
                      Resumo da Planilha Selecionada:
                    </span>
                    <span className="font-mono text-slate-400">
                      {activeEscala.itens.length} linhas de dados
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-mono">
                        Escala
                      </span>
                      <strong className="truncate block">{activeEscala.titulo}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-mono">
                        Período
                      </span>
                      <span>{formatBrDate(activeEscala.dataEscala)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-mono">
                        Total Militares
                      </span>
                      <span className="font-mono font-bold text-emerald-500">
                        {activeEscala.itens.length} escalados
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-mono">
                        Formato
                      </span>
                      <span className="font-mono font-bold">.XLSX (Microsoft Excel)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
