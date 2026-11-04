import React, { useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  X,
  Copy,
  Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpdateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatabaseUpdated: (newData: any) => void;
}

export function UpdateDatabaseModal({
  isOpen,
  onClose,
  onDatabaseUpdated,
}: UpdateDatabaseModalProps) {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [pastedJson, setPastedJson] = useState<string>("");
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Parse CSV string to Array of Objects
  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Detect separator (; or , or \t)
    const firstLine = lines[0];
    let separator = ";";
    if (firstLine.includes(";")) separator = ";";
    else if (firstLine.includes(",")) separator = ",";
    else if (firstLine.includes("\t")) separator = "\t";

    const headers = firstLine
      .split(separator)
      .map((h) => h.replace(/^"|"$/g, "").trim());

    const result: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const currentline = lines[i].split(separator);
      if (currentline.length < headers.length) continue;

      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        let val = currentline[j] ? currentline[j].replace(/^"|"$/g, "").trim() : "";
        obj[headers[j]] = val;
      }
      result.push(obj);
    }
    return result;
  };

  const processInputData = (text: string, sourceName?: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    setParsedData(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMsg("O conteúdo informado está vazio.");
      return;
    }

    try {
      // Try JSON first
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const json = JSON.parse(trimmed);
        let rows: any[] = [];
        if (Array.isArray(json)) {
          rows = json;
        } else if (json && Array.isArray(json["EFETIVO TOTAL CM"])) {
          rows = json["EFETIVO TOTAL CM"];
        } else if (json && typeof json === "object") {
          // Find first array property
          const firstKey = Object.keys(json).find((k) => Array.isArray(json[k]));
          if (firstKey) rows = json[firstKey];
        }

        if (rows.length === 0) {
          setErrorMsg("JSON válido fornecido, porém nenhum registro/array foi encontrado.");
          return;
        }

        setParsedData(rows);
        setSuccessMsg(`JSON processado com sucesso! ${rows.length} registros prontos para importação.`);
        return;
      }

      // Try CSV parsing
      const csvRows = parseCSV(trimmed);
      if (csvRows.length > 0) {
        setParsedData(csvRows);
        setSuccessMsg(`Arquivo CSV processado com sucesso! ${csvRows.length} registros encontrados.`);
        return;
      }

      setErrorMsg("Não foi possível identificar o formato. Forneça um arquivo .json ou .csv válido.");
    } catch (err: any) {
      setErrorMsg(`Erro ao ler os dados: ${err.message || "Formato inválido"}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      processInputData(content, file.name);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedJson(text);
    if (text.trim().length > 10) {
      processInputData(text);
    } else {
      setParsedData(null);
      setErrorMsg("");
      setSuccessMsg("");
    }
  };

  const handleSaveDatabase = async () => {
    if (!parsedData || parsedData.length === 0) {
      setErrorMsg("Nenhum dado válido para salvar.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    const fullPayload = {
      "EFETIVO TOTAL CM": parsedData,
    };

    try {
      // 1. Send to server endpoint
      const response = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullPayload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao salvar na API do servidor");
      }

      // 2. Save in localStorage for fallback/instant client state
      localStorage.setItem("efetivo_custom_database", JSON.stringify(fullPayload));

      // 3. Trigger callback to update application state live
      onDatabaseUpdated(fullPayload);

      setSuccessMsg("Base de dados atualizada e salva no servidor com sucesso!");
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      // Fallback: update in localStorage & client state even if server fails
      localStorage.setItem("efetivo_custom_database", JSON.stringify(fullPayload));
      onDatabaseUpdated(fullPayload);

      setSuccessMsg("Base de dados atualizada no navegador com sucesso!");
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1200);
    }
  };

  const sampleJsonFormat = JSON.stringify(
    [
      {
        "#": 1,
        "POSTO/GRAD.  CARGO": "CEL",
        "NOME": "CARLOS ALBERTO MEDEIROS",
        "NOME DE GUERRA": "MEDEIROS",
        "DIVISÃO": "CHEFE DE DIVISÃO",
        "SIGLA DIVISÃO": "CHEFE",
        "RG": "10000001",
        "CPF": "000.000.000-00",
        "GÊNERO": "M",
        "CONTATO": "(41) 99999-9999",
        "FPP/FCE": "FCE-1",
        "TIPO FPP/FG": "CHEFE DE DIVISÃO",
        "VALOR": 3500
      }
    ],
    null,
    2
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#161618] border-[#ececed]/15 text-[#ececed] font-sans p-6 rounded-xs shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-[#ececed]/10 pb-4">
          <DialogTitle className="font-syne font-bold text-xl uppercase tracking-tight flex items-center gap-2 text-[#ececed]">
            <Database className="w-5 h-5 text-[#3b82f6]" />
            Atualizar Base de Dados do Efetivo
          </DialogTitle>
          <p className="text-xs text-[#ececed]/60 font-mono mt-1">
            Importe um novo arquivo JSON/CSV ou cole o código formatado para atualizar o cadastro completo do efetivo.
          </p>
        </DialogHeader>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 border-b border-[#ececed]/10 pt-2 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-2 ${
              activeTab === "file"
                ? "bg-[#3b82f6] text-white"
                : "bg-[#0f0f11] text-[#ececed]/60 hover:text-[#ececed] border border-[#ececed]/10"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload de Arquivo (JSON / CSV)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-2 ${
              activeTab === "paste"
                ? "bg-[#3b82f6] text-white"
                : "bg-[#0f0f11] text-[#ececed]/60 hover:text-[#ececed] border border-[#ececed]/10"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Colar Texto / JSON
          </button>
        </div>

        {/* Tab Content: File Upload */}
        {activeTab === "file" && (
          <div className="py-4 space-y-4">
            <div className="border-2 border-dashed border-[#ececed]/20 rounded-xs p-6 bg-[#0f0f11] text-center flex flex-col items-center justify-center hover:border-[#3b82f6]/50 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".json,.csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-[#3b82f6] mb-2" />
              <p className="text-sm font-medium text-[#ececed]">
                Clique aqui ou arraste o arquivo para esta área
              </p>
              <p className="text-xs font-mono text-[#ececed]/50 mt-1">
                Suporta arquivos .JSON e .CSV (com separador ; ou ,)
              </p>
              {fileName && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] font-mono text-xs rounded-xs">
                  <FileText className="w-3.5 h-3.5" />
                  {fileName}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Paste JSON */}
        {activeTab === "paste" && (
          <div className="py-4 space-y-3">
            <label className="text-xs font-mono uppercase tracking-wider text-[#ececed]/70 block">
              Cole abaixo a estrutura JSON do efetivo:
            </label>
            <textarea
              rows={8}
              value={pastedJson}
              onChange={handlePasteChange}
              placeholder={`[
  {
    "NOME": "NOME DO MILITAR",
    "POSTO/GRAD.  CARGO": "CAP",
    "DIVISÃO": "SEGURANÇA ORGANIZACIONAL",
    "SIGLA DIVISÃO": "DOS",
    ...
  }
]`}
              className="w-full bg-[#0f0f11] border border-[#ececed]/20 rounded-xs p-3 font-mono text-xs text-[#ececed] placeholder:text-[#ececed]/30 focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
        )}

        {/* Error / Success Banners */}
        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs rounded-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs rounded-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Parsed Data Preview Table */}
        {parsedData && parsedData.length > 0 && (
          <div className="space-y-2 border-t border-[#ececed]/10 pt-4">
            <div className="flex items-center justify-between font-mono text-xs text-[#ececed]/70">
              <span>Pré-visualização (Primeiros 3 de {parsedData.length} registros):</span>
              <span className="text-[#3b82f6] font-bold">{parsedData.length} Registros Válidos</span>
            </div>
            <div className="bg-[#0f0f11] border border-[#ececed]/10 rounded-xs overflow-x-auto max-h-48">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-[#18181c] text-[#ececed]/60 border-b border-[#ececed]/10 uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Posto / Grad</th>
                    <th className="p-2">Divisão</th>
                    <th className="p-2">Gratificação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ececed]/5 text-[#ececed]">
                  {parsedData.slice(0, 3).map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#161618]">
                      <td className="p-2 font-medium">{item["NOME"] || item["Nome"] || "—"}</td>
                      <td className="p-2">{item["POSTO/GRAD.  CARGO"] || item["POSTO"] || item["Cargo"] || "—"}</td>
                      <td className="p-2">{item["SIGLA DIVISÃO"] || item["DIVISÃO"] || "—"}</td>
                      <td className="p-2">{item["FPP/FCE"] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* JSON Structure Helper Accordion / Tip */}
        <div className="p-3 bg-[#0f0f11] border border-[#ececed]/10 rounded-xs space-y-1.5 font-mono text-[11px] text-[#ececed]/60">
          <div className="flex items-center gap-1.5 text-[#3b82f6] font-bold">
            <Info className="w-3.5 h-3.5" />
            Estrutura de Colunas Recomendada:
          </div>
          <p>
            Para melhor compatibilidade, utilize as colunas: <code className="text-[#ececed]">NOME</code>, <code className="text-[#ececed]">POSTO/GRAD.  CARGO</code>, <code className="text-[#ececed]">DIVISÃO</code>, <code className="text-[#ececed]">SIGLA DIVISÃO</code>, <code className="text-[#ececed]">RG</code>, <code className="text-[#ececed]">CPF</code>, <code className="text-[#ececed]">FPP/FCE</code>, <code className="text-[#ececed]">VALOR</code>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between border-t border-[#ececed]/10 pt-4 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-[#ececed]/20 hover:bg-[#0f0f11] text-[#ececed] font-mono text-xs uppercase"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={!parsedData || parsedData.length === 0 || isSaving}
            onClick={handleSaveDatabase}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-mono font-bold text-xs uppercase tracking-wider px-6 cursor-pointer"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Salvando Base...
              </span>
            ) : (
              `Confirmar e Atualizar Base (${parsedData?.length || 0})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
