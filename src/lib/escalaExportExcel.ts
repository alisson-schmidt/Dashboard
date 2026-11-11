import ExcelJS from "exceljs";
import { Escala } from "@/types/escala";
import { formatBrDate } from "./escalaFormatText";

/**
 * Exporta a escala de serviço para uma planilha Excel (.xlsx) altamente estilizada
 * com padrão visual institucional da Casa Militar:
 * - Cabeçalho institucional azul escuro (#1E3A8A) com texto branco em negrito
 * - Seção de dados gerais (Data, Título, Unidade, Total)
 * - Linhas zebradas (#FFFFFF e #F0F4F8)
 * - Bordas finas (#CBD5E1)
 * - Ajuste automático de largura de colunas
 */
export async function exportEscalaToExcel(escala: Escala): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Casa Militar do Paraná - Sistema de Escalas";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Escala de Serviço", {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  // Cores institucionais
  const primaryNavy = "1E3A8A"; // Azul marinho escuro militar
  const secondaryNavy = "172554";
  const zebraLight = "F8FAFC"; // Cinza/azul suave para linhas zebradas
  const borderLight = "CBD5E1";

  // Linha 1: Título Geral do Órgão
  worksheet.mergeCells("A1:H1");
  const row1 = worksheet.getCell("A1");
  row1.value = "GOVERNO DO ESTADO DO PARANÁ — CASA MILITAR DA GOVERNADORIA";
  row1.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFF" } };
  row1.alignment = { horizontal: "center", vertical: "middle" };
  row1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: primaryNavy },
  };
  worksheet.getRow(1).height = 30;

  // Linha 2: Subtítulo
  worksheet.mergeCells("A2:H2");
  const row2 = worksheet.getCell("A2");
  row2.value = `ESCALA DE SERVIÇO — ${escala.titulo.toUpperCase()}`;
  row2.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
  row2.alignment = { horizontal: "center", vertical: "middle" };
  row2.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: secondaryNavy },
  };
  worksheet.getRow(2).height = 24;

  // Linha 3: Espaço em branco
  worksheet.getRow(3).height = 10;

  // Linha 4 e 5: Metadados da Escala
  const dataInicioBr = formatBrDate(escala.dataEscala);
  const dataFimBr = escala.dataFimEscala ? formatBrDate(escala.dataFimEscala) : "";
  const periodoTexto = dataFimBr && dataFimBr !== dataInicioBr 
    ? `${dataInicioBr} a ${dataFimBr}`
    : dataInicioBr;

  worksheet.mergeCells("A4:D4");
  worksheet.getCell("A4").value = `📅 Período: ${periodoTexto}`;
  worksheet.getCell("A4").font = { name: "Arial", size: 10, bold: true, color: { argb: "0F172A" } };

  worksheet.mergeCells("E4:H4");
  worksheet.getCell("E4").value = `👥 Total de Militares Escalados: ${escala.itens.length}`;
  worksheet.getCell("E4").font = { name: "Arial", size: 10, bold: true, color: { argb: "0F172A" } };

  worksheet.mergeCells("A5:D5");
  worksheet.getCell("A5").value = `🏛️ Setor Geral: ${escala.setorGeral || "Casa Militar - Sede"}`;
  worksheet.getCell("A5").font = { name: "Arial", size: 10, color: { argb: "334155" } };

  worksheet.mergeCells("E5:H5");
  const agora = new Date();
  const dataEmissao = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  worksheet.getCell("E5").value = `🕒 Gerado em: ${dataEmissao}`;
  worksheet.getCell("E5").font = { name: "Arial", size: 10, italic: true, color: { argb: "475569" } };

  worksheet.getRow(4).height = 20;
  worksheet.getRow(5).height = 20;
  worksheet.getRow(6).height = 10;

  // Linha 7: Cabeçalho da Tabela
  const headers = [
    { title: "Nº", key: "item", width: 6, align: "center" as const },
    { title: "DATA / PERÍODO", key: "data", width: 16, align: "center" as const },
    { title: "TURNO / HORÁRIO", key: "turno", width: 22, align: "center" as const },
    { title: "POSTO / GRAD.", key: "posto", width: 16, align: "center" as const },
    { title: "NOME DE GUERRA", key: "guerra", width: 18, align: "left" as const },
    { title: "NOME COMPLETO", key: "nome", width: 32, align: "left" as const },
    { title: "FUNÇÃO / POSTO DE SERVIÇO", key: "funcao", width: 28, align: "left" as const },
    { title: "OBSERVAÇÕES", key: "obs", width: 30, align: "left" as const },
  ];

  const headerRowNumber = 7;
  const headerRow = worksheet.getRow(headerRowNumber);
  headers.forEach((h, index) => {
    const colNumber = index + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h.title;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    cell.alignment = { horizontal: h.align, vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: primaryNavy },
    };
    cell.border = {
      top: { style: "medium", color: { argb: "0F172A" } },
      bottom: { style: "medium", color: { argb: "0F172A" } },
      left: { style: "thin", color: { argb: borderLight } },
      right: { style: "thin", color: { argb: borderLight } },
    };
  });
  headerRow.height = 26;

  // Adiciona as Linhas dos Militares Escalados com Zebrado
  let currentRowIndex = headerRowNumber + 1;

  if (escala.itens.length === 0) {
    worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`);
    const emptyCell = worksheet.getCell(`A${currentRowIndex}`);
    emptyCell.value = "Nenhum militar cadastrado nesta escala.";
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    emptyCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "64748B" } };
    worksheet.getRow(currentRowIndex).height = 28;
    currentRowIndex++;
  } else {
    escala.itens.forEach((item, idx) => {
      const row = worksheet.getRow(currentRowIndex);
      const isZebra = idx % 2 === 1;
      const rowBg = isZebra ? zebraLight : "FFFFFF";

      const dataStr = item.dataInicio 
        ? (item.dataFim && item.dataFim !== item.dataInicio ? `${formatBrDate(item.dataInicio)} - ${formatBrDate(item.dataFim)}` : formatBrDate(item.dataInicio))
        : periodoTexto;

      const horarioStr = (item.horaInicio && item.horaFim) 
        ? `${item.horaInicio} às ${item.horaFim}` 
        : "";
      const turnoCellVal = item.turno 
        ? (horarioStr ? `${item.turno} (${horarioStr})` : item.turno)
        : horarioStr || "Ordinário";

      const values = [
        idx + 1,
        dataStr,
        turnoCellVal,
        item.postoGrad || "—",
        item.nomeGuerra || "—",
        item.nomeCompleto || "—",
        item.funcao ? (item.setor ? `${item.funcao} [${item.setor}]` : item.funcao) : (item.setor || "Serviço Geral"),
        item.observacoes || "—",
      ];

      values.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.font = { name: "Arial", size: 9.5, color: { argb: "1E293B" } };
        cell.alignment = {
          horizontal: headers[colIdx].align,
          vertical: "middle",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: rowBg },
        };
        cell.border = {
          top: { style: "thin", color: { argb: borderLight } },
          bottom: { style: "thin", color: { argb: borderLight } },
          left: { style: "thin", color: { argb: borderLight } },
          right: { style: "thin", color: { argb: borderLight } },
        };
      });

      row.height = 24;
      currentRowIndex++;
    });
  }

  // Seção de Observações Gerais e Assinaturas no rodapé
  currentRowIndex++;
  if (escala.observacoesGerais) {
    worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`);
    const obsHeader = worksheet.getCell(`A${currentRowIndex}`);
    obsHeader.value = "OBSERVAÇÕES GERAIS:";
    obsHeader.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "0F172A" } };
    currentRowIndex++;

    worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex + 1}`);
    const obsText = worksheet.getCell(`A${currentRowIndex}`);
    obsText.value = escala.observacoesGerais;
    obsText.font = { name: "Arial", size: 9, italic: true, color: { argb: "334155" } };
    obsText.alignment = { vertical: "top", wrapText: true };
    currentRowIndex += 3;
  } else {
    currentRowIndex++;
  }

  // Rodapé com linhas de assinatura institucional
  worksheet.mergeCells(`B${currentRowIndex}:D${currentRowIndex}`);
  worksheet.mergeCells(`F${currentRowIndex}:H${currentRowIndex}`);
  const sign1 = worksheet.getCell(`B${currentRowIndex}`);
  const sign2 = worksheet.getCell(`F${currentRowIndex}`);
  sign1.value = "____________________________________";
  sign2.value = "____________________________________";
  sign1.alignment = { horizontal: "center" };
  sign2.alignment = { horizontal: "center" };
  currentRowIndex++;

  worksheet.mergeCells(`B${currentRowIndex}:D${currentRowIndex}`);
  worksheet.mergeCells(`F${currentRowIndex}:H${currentRowIndex}`);
  const signLabel1 = worksheet.getCell(`B${currentRowIndex}`);
  const signLabel2 = worksheet.getCell(`F${currentRowIndex}`);
  signLabel1.value = "Oficial de Dia / Supervisor de Escala";
  signLabel2.value = "Chefe da Divisão / Comandante";
  signLabel1.font = { name: "Arial", size: 9, bold: true, color: { argb: "334155" } };
  signLabel2.font = { name: "Arial", size: 9, bold: true, color: { argb: "334155" } };
  signLabel1.alignment = { horizontal: "center" };
  signLabel2.alignment = { horizontal: "center" };

  // Define larguras das colunas
  headers.forEach((h, idx) => {
    worksheet.getColumn(idx + 1).width = h.width;
  });

  // Gera o buffer e dispara o download no browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const sanitizedTitle = (escala.titulo || "Escala_Servico").replace(/[^a-zA-Z0-9_\-]/g, "_");
  anchor.href = url;
  anchor.download = `Escala_CM_${sanitizedTitle}_${escala.dataEscala || "atual"}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
