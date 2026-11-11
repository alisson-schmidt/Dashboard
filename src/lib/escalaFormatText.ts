import { Escala, EscalaItem } from "@/types/escala";

/**
 * Formata a data de YYYY-MM-DD para DD/MM/YYYY
 */
export function formatBrDate(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Gera a versão em texto formatado para compartilhamento em WhatsApp, Telegram ou E-mail.
 * Cabeçalho estrito solicitado:
 * Casa Militar do Paraná - Escala de Serviço
 */
export function formatEscalaText(escala: Escala): string {
  const dataInicioBr = formatBrDate(escala.dataEscala);
  const dataFimBr = escala.dataFimEscala ? formatBrDate(escala.dataFimEscala) : "";
  const periodoTexto = dataFimBr && dataFimBr !== dataInicioBr 
    ? `${dataInicioBr} até ${dataFimBr}`
    : dataInicioBr;

  const lines: string[] = [];

  lines.push("══════════════════════════════════");
  lines.push("Casa Militar do Paraná - Escala de Serviço");
  lines.push("══════════════════════════════════");
  lines.push("");
  lines.push(`📋 Identificação: ${escala.titulo || "Escala de Serviço Ordinária"}`);
  lines.push(`📅 Período: ${periodoTexto}`);
  if (escala.setorGeral) {
    lines.push(`🏛️ Setor Geral: ${escala.setorGeral}`);
  }
  lines.push(`👥 Total Escalados: ${escala.itens.length} militares`);
  lines.push("");

  if (escala.itens.length === 0) {
    lines.push("(Nenhum militar escalado nesta escala)");
    lines.push("");
  } else {
    // Agrupa por Turno
    const turnosMap = new Map<string, EscalaItem[]>();
    for (const item of escala.itens) {
      const turnoKey = item.turno || "Turno Geral";
      if (!turnosMap.has(turnoKey)) {
        turnosMap.set(turnoKey, []);
      }
      turnosMap.get(turnoKey)!.push(item);
    }

    turnosMap.forEach((itens, turnoNome) => {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`⏰ TURNO: ${turnoNome.toUpperCase()}`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Agrupa por Setor/Posto de Serviço dentro do turno se houver
      itens.forEach((militar, idx) => {
        const postoGuerra = `${militar.postoGrad} ${militar.nomeGuerra}`.trim();
        const funcaoStr = militar.funcao ? ` | ${militar.funcao}` : "";
        const setorStr = militar.setor ? ` [${militar.setor}]` : "";
        const horarioStr = militar.horaInicio && militar.horaFim ? ` (${militar.horaInicio} às ${militar.horaFim})` : "";
        const obsStr = militar.observacoes ? ` - Obs: ${militar.observacoes}` : "";

        lines.push(`${idx + 1}. 👮 ${postoGuerra}${funcaoStr}${setorStr}${horarioStr}${obsStr}`);
      });
      lines.push("");
    });
  }

  if (escala.observacoesGerais) {
    lines.push("📝 OBSERVAÇÕES GERAIS:");
    lines.push(escala.observacoesGerais);
    lines.push("");
  }

  const agora = new Date();
  const dataHoraEmissao = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  lines.push("──────────────────────────────────");
  lines.push("Governo do Estado do Paraná");
  lines.push("Casa Militar da Governadoria — CM/PR");
  lines.push(`Gerado em: ${dataHoraEmissao}`);

  return lines.join("\n");
}
